import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ambiente, ehHomolog, ehProducao, refDoBanco, supabase } from './lib/supabase'
import { eu, vincularMeuAcesso, type Pessoa } from './lib/banco'
import { Entrar } from './paginas/Entrar'
import { FronteiraDeErro } from './componentes/FronteiraDeErro'
import { Painel } from './paginas/Painel'
import { Chamados } from './paginas/Chamados'
import { Conta } from './paginas/Conta'
import { ChamadoPublico } from './paginas/ChamadoPublico'
import { Carteira } from './paginas/Carteira'
import { Projeto } from './paginas/Projeto'
import { EditarProjeto } from './paginas/EditarProjeto'
import { Etapas } from './paginas/Etapas'
import { Tarefas } from './paginas/Tarefas'
import { Pontuacao } from './paginas/Pontuacao'
import { Avaliacao } from './paginas/Avaliacao'
import { Empresas } from './paginas/Empresas'
import { Equipe } from './paginas/Equipe'

type Pagina = 'painel' | 'carteira' | 'chamados' | 'empresas' | 'equipe' | 'conta'

const PAGINAS: { chave: Pagina; nome: string }[] = [
  { chave: 'painel', nome: 'Painel' },
  { chave: 'carteira', nome: 'Carteira' },
  { chave: 'chamados', nome: 'Chamados' },
  { chave: 'empresas', nome: 'Empresas' },
  { chave: 'equipe', nome: 'Equipe' },
  { chave: 'conta', nome: 'Conta' },
]

export function App() {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [pagina, setPagina] = useState<Pagina>('painel')
  // Sem biblioteca de rotas por enquanto: a carteira abre o projeto por estado.
  // A tela publica nao depende de sessao: quem chega por ?chamado abre um
  // pedido sem entrar. Fica antes de tudo por isso.
  const [publico, setPublico] = useState(
    new URLSearchParams(window.location.search).has('chamado'),
  )
  const [projetoAberto, setProjetoAberto] = useState<string | null>(null)
  // { id: null } = projeto novo; { id } = editando um existente.
  const [editando, setEditando] = useState<{ id: string | null } | null>(null)
  const [etapasDe, setEtapasDe] = useState<string | null>(null)
  const [tarefasDe, setTarefasDe] = useState<string | null>(null)
  const [pontuacaoDe, setPontuacaoDe] = useState<string | null>(null)
  const [avaliacaoDe, setAvaliacaoDe] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s)
      // Quem acabou de entrar comeca no Painel, nao na tela onde estava antes
      // de sair. Renovacao de token nao mexe em nada.
      if (evento === 'SIGNED_IN') setPagina('painel')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sessao) {
      setPessoa(null)
      return
    }
    // Apresenta o login a pessoa cadastrada com o mesmo e-mail, se houver, e
    // so entao pergunta quem sou eu — senao quem acabou de ser cadastrado
    // continuaria vendo "login nao vinculado" ate alguem rodar SQL na mao.
    vincularMeuAcesso()
      .then(() => eu())
      .then(setPessoa)
      .catch(() => setPessoa(null))
  }, [sessao])

  if (publico) {
    return (
      <ChamadoPublico
        aoEntrar={() => {
          setPublico(false)
          window.history.replaceState(null, '', window.location.pathname)
        }}
      />
    )
  }

  if (carregando) return <div className="vazio">Carregando…</div>
  if (!sessao) return <Entrar aoAbrirChamado={() => setPublico(true)} />

  return (
    <div className={ehHomolog ? 'app app--ensaio' : 'app'}>
      {/* A tarja é só de HOMOLOGAÇÃO, onde "dados descartáveis" é verdade e
          precisa ser impossível de ignorar. Em desenvolvimento ela saiu: o
          `dev` aponta para o banco real e a tarja virava ruído em toda sessão
          de trabalho — e aviso que aparece sempre deixa de ser aviso.
          Qual banco está atrás continua legível no rodapé da lateral. */}
      {ehHomolog && (
        <div className="tarja-ambiente" role="status">
          HOMOLOGAÇÃO · banco {refDoBanco} — os dados aqui são descartáveis
        </div>
      )}
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
                setAvaliacaoDe(null)
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
          {!ehProducao && (
            <>
              <br />
              <span title="Modo do Vite e projeto Supabase desta sessão">
                {ambiente} · {refDoBanco.slice(0, 8)}
              </span>
            </>
          )}
        </div>
      </nav>

      <main className="conteudo">
        {/* Uma tela que quebra mostra o que quebrou; o menu continua de pé. */}
        <FronteiraDeErro nome={PAGINAS.find((p) => p.chave === pagina)?.nome ?? pagina}>
        {/* Sem cadastro de pessoa, a RLS nega tudo — e a tela viraria uma lista
            vazia inexplicável. Melhor dizer o que falta. */}
        {!pessoa && (
          <div className="aviso" style={{ marginBottom: 'var(--e5)' }}>
            Este login ainda não está vinculado a uma pessoa do GestPlan, então o banco não
            devolve nada. O vínculo acontece sozinho quando existe uma pessoa cadastrada com
            este mesmo e-mail — peça ao proprietário para cadastrar você em Equipe. Se você é o
            proprietário e ainda não existe ninguém, rode o{' '}
            <code>supabase/primeiro_acesso.sql</code>.
          </div>
        )}
        {pagina === 'painel' &&
          (projetoAberto ? (
            <Projeto
              id={projetoAberto}
              aoVoltar={() => setProjetoAberto(null)}
              aoEditar={() => setEditando({ id: projetoAberto })}
              aoAbrirEtapas={() => setEtapasDe(projetoAberto)}
              aoAbrirTarefas={() => setTarefasDe(projetoAberto)}
              aoAbrirPontuacao={() => setPontuacaoDe(projetoAberto)}
              aoAbrirAvaliacao={() => setAvaliacaoDe(projetoAberto)}
            />
          ) : (
            <Painel aoAbrir={setProjetoAberto} />
          ))}

        {pagina === 'chamados' &&
          (projetoAberto ? (
            <Projeto
              id={projetoAberto}
              aoVoltar={() => setProjetoAberto(null)}
              aoEditar={() => setEditando({ id: projetoAberto })}
              aoAbrirEtapas={() => setEtapasDe(projetoAberto)}
              aoAbrirTarefas={() => setTarefasDe(projetoAberto)}
              aoAbrirPontuacao={() => setPontuacaoDe(projetoAberto)}
              aoAbrirAvaliacao={() => setAvaliacaoDe(projetoAberto)}
            />
          ) : (
            <Chamados aoAbrir={setProjetoAberto} />
          ))}

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
          ) : avaliacaoDe ? (
            <Avaliacao id={avaliacaoDe} aoVoltar={() => setAvaliacaoDe(null)} />
          ) : projetoAberto ? (
            <Projeto
              id={projetoAberto}
              aoVoltar={() => setProjetoAberto(null)}
              aoEditar={() => setEditando({ id: projetoAberto })}
              aoAbrirEtapas={() => setEtapasDe(projetoAberto)}
              aoAbrirTarefas={() => setTarefasDe(projetoAberto)}
              aoAbrirPontuacao={() => setPontuacaoDe(projetoAberto)}
              aoAbrirAvaliacao={() => setAvaliacaoDe(projetoAberto)}
            />
          ) : (
            <Carteira aoAbrir={setProjetoAberto} aoNovo={() => setEditando({ id: null })} />
          ))}
        {pagina === 'conta' && <Conta />}
        {pagina === 'empresas' && <Empresas />}
        {pagina === 'equipe' && <Equipe />}
        </FronteiraDeErro>
      </main>
    </div>
  )
}
