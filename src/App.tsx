import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { eu, type Pessoa } from './lib/banco'
import { Entrar } from './paginas/Entrar'
import { Carteira } from './paginas/Carteira'
import { Projeto } from './paginas/Projeto'
import { EditarProjeto } from './paginas/EditarProjeto'
import { Etapas } from './paginas/Etapas'
import { Tarefas } from './paginas/Tarefas'
import { Pontuacao } from './paginas/Pontuacao'
import { Empresas } from './paginas/Empresas'
import { Equipe } from './paginas/Equipe'

type Pagina = 'carteira' | 'empresas' | 'equipe'

const PAGINAS: { chave: Pagina; nome: string }[] = [
  { chave: 'carteira', nome: 'Carteira' },
  { chave: 'empresas', nome: 'Empresas' },
  { chave: 'equipe', nome: 'Equipe' },
]

export function App() {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [pagina, setPagina] = useState<Pagina>('carteira')
  // Sem biblioteca de rotas por enquanto: a carteira abre o projeto por estado.
  const [projetoAberto, setProjetoAberto] = useState<string | null>(null)
  // { id: null } = projeto novo; { id } = editando um existente.
  const [editando, setEditando] = useState<{ id: string | null } | null>(null)
  const [etapasDe, setEtapasDe] = useState<string | null>(null)
  const [tarefasDe, setTarefasDe] = useState<string | null>(null)
  const [pontuacaoDe, setPontuacaoDe] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSessao(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sessao) {
      setPessoa(null)
      return
    }
    eu().then(setPessoa).catch(() => setPessoa(null))
  }, [sessao])

  if (carregando) return <div className="vazio">Carregando…</div>
  if (!sessao) return <Entrar />

  return (
    <div className="app">
      <nav className="lateral">
        <div className="marca">
          <i><b /></i>
          <span>GestPlan</span>
        </div>

        <div className="menu">
          {PAGINAS.map((p) => (
            <button
              key={p.chave}
              onClick={() => {
                setPagina(p.chave)
                setProjetoAberto(null)
                setEditando(null)
                setEtapasDe(null)
                setTarefasDe(null)
                setPontuacaoDe(null)
              }}
              aria-current={pagina === p.chave ? 'page' : undefined}
            >
              {p.nome}
            </button>
          ))}
        </div>

        <div className="rodape-lateral">
          {pessoa ? (
            <>
              {pessoa.nome}
              {pessoa.proprietario && ' · proprietário'}
            </>
          ) : (
            <>{sessao.user.email}</>
          )}
          <br />
          <button onClick={() => supabase.auth.signOut()}>sair</button>
        </div>
      </nav>

      <main className="conteudo">
        {/* Sem cadastro de pessoa, a RLS nega tudo — e a tela viraria uma lista
            vazia inexplicável. Melhor dizer o que falta. */}
        {!pessoa && (
          <div className="aviso" style={{ marginBottom: 'var(--e5)' }}>
            Este login ainda não está vinculado a uma pessoa do GestPlan, então o
            banco não devolve nada. Rode o comando de primeiro acesso descrito no{' '}
            <code>README.md</code> para criar a sua pessoa e marcá-la como
            proprietária.
          </div>
        )}
        {pagina === 'carteira' &&
          (editando ? (
            <EditarProjeto
              id={editando.id}
              aoSair={(idSalvo) => {
                setEditando(null)
                if (idSalvo) setProjetoAberto(idSalvo)
              }}
            />
          ) : etapasDe ? (
            <Etapas id={etapasDe} aoVoltar={() => setEtapasDe(null)} />
          ) : tarefasDe ? (
            <Tarefas id={tarefasDe} aoVoltar={() => setTarefasDe(null)} />
          ) : pontuacaoDe ? (
            <Pontuacao id={pontuacaoDe} aoVoltar={() => setPontuacaoDe(null)} />
          ) : projetoAberto ? (
            <Projeto
              id={projetoAberto}
              aoVoltar={() => setProjetoAberto(null)}
              aoEditar={() => setEditando({ id: projetoAberto })}
              aoAbrirEtapas={() => setEtapasDe(projetoAberto)}
              aoAbrirTarefas={() => setTarefasDe(projetoAberto)}
              aoAbrirPontuacao={() => setPontuacaoDe(projetoAberto)}
            />
          ) : (
            <Carteira aoAbrir={setProjetoAberto} aoNovo={() => setEditando({ id: null })} />
          ))}
        {pagina === 'empresas' && <Empresas />}
        {pagina === 'equipe' && <Equipe />}
      </main>
    </div>
  )
}
