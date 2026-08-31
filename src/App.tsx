import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ambiente, ehHomolog, ehProducao, refDoBanco, supabase } from './lib/supabase'
import { contarAvisosNaoLidos, eu, vincularMeuAcesso, type Pessoa } from './lib/banco'
import { Entrar } from './paginas/Entrar'
import { FronteiraDeErro } from './componentes/FronteiraDeErro'
import { Painel } from './paginas/Painel'
import { MeuTrabalho } from './paginas/MeuTrabalho'
import { Avisos } from './paginas/Avisos'
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
import { Marca } from './componentes/Marca'

type Pagina = 'painel' | 'meu' | 'avisos' | 'carteira' | 'chamados' | 'empresas' | 'equipe' | 'conta'

/**
 * `principal` decide quem cabe na barra de baixo do celular.
 *
 * Oito destinos nao cabem no polegar. Os quatro marcados sao os que se usa no
 * telefone — o que e meu, o que me chamaram, a carteira, o painel. Empresas,
 * Equipe e Conta sao administracao: entram atras do "Mais".
 *
 * `curto` existe porque "Meu trabalho" nao cabe embaixo de um icone de 60px.
 */
const PAGINAS: { chave: Pagina; nome: string; curto?: string; principal?: boolean }[] = [
  { chave: 'painel', nome: 'Painel', principal: true },
  { chave: 'meu', nome: 'Meu trabalho', curto: 'Meu dia', principal: true },
  { chave: 'avisos', nome: 'Avisos', principal: true },
  { chave: 'carteira', nome: 'Carteira', principal: true },
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
  const [naoLidos, setNaoLidos] = useState(0)
  // A folha do "Mais", no celular. No computador nunca abre: a lateral tem tudo.
  const [maisAberto, setMaisAberto] = useState(false)
  /** Quem estava logado da ultima vez que o estado de autenticacao mudou. */
  const usuarioAnterior = useRef<string | null>(null)
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
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSessao(s)

      // Quem acabou de entrar comeca no Painel. Quem so voltou para a aba
      // continua onde estava.
      //
      // NAO da para confiar no evento `SIGNED_IN` para isso, e o comentario
      // que estava aqui dizia o contrario. O `auth-js` reemite `SIGNED_IN` em
      // pelo menos dois casos que nao sao entrada nenhuma: ao recuperar a
      // sessao do armazenamento quando a aba volta a ter foco, e ao
      // retransmitir por BroadcastChannel o que outra aba fez. O efeito era
      // sair do sistema e voltar caindo no Painel, perdendo a tela aberta.
      //
      // O que decide agora e a IDENTIDADE mudar: de ninguem para alguem, ou de
      // uma pessoa para outra. Reemissao com o mesmo usuario nao mexe em nada.
      const quem = s?.user.id ?? null
      if (quem !== null && quem !== usuarioAnterior.current) setPagina('painel')
      usuarioAnterior.current = quem
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
    // Depende do ID, nao do objeto da sessao: o objeto e novo a cada reemissao
    // de evento, e isso refazia duas idas ao banco toda vez que a aba voltava.
  }, [sessao?.user.id])

  // O contador do menu. Recarrega a cada minuto porque quem escreve aviso e um
  // gatilho no banco, disparado por outra pessoa — nao ha nada nesta sessao
  // para observar. Um minuto e frequente o bastante para parecer vivo e raro o
  // bastante para nao pesar.
  const recontarAvisos = () => {
    contarAvisosNaoLidos().then(setNaoLidos).catch(() => setNaoLidos(0))
  }

  useEffect(() => {
    if (!pessoa) {
      setNaoLidos(0)
      return
    }
    recontarAvisos()
    const relogio = setInterval(recontarAvisos, 60_000)
    return () => clearInterval(relogio)
  }, [pessoa])

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

  // Trocar de pagina fecha tudo que estava aberto por cima dela. Estava
  // repetido no onClick de cada botao; agora e um lugar so, e a barra de baixo
  // usa o mesmo.
  const ir = (destino: Pagina) => {
    setPagina(destino)
    setProjetoAberto(null)
    setEditando(null)
    setEtapasDe(null)
    setTarefasDe(null)
    setPontuacaoDe(null)
    setAvaliacaoDe(null)
    setMaisAberto(false)
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
      {/* Barra de cima, so no celular e no tablet de pe: a marca e a saida.
          No computador a lateral ja carrega as duas. */}
      <header className="barra-topo">
        <Marca />
        <button className="voltar" onClick={() => supabase.auth.signOut()}>sair</button>
      </header>

      <nav className="lateral">
        <Marca />

        <div className="menu">
          {PAGINAS.map((p) => (
            <button
              key={p.chave}
              onClick={() => ir(p.chave)}
              aria-current={pagina === p.chave ? 'page' : undefined}
            >
              {p.nome}
              {p.chave === 'avisos' && naoLidos > 0 && (
                <span className="selo-contador" aria-label={`${naoLidos} não lidos`}>
                  {naoLidos > 99 ? '99+' : naoLidos}
                </span>
              )}
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

        {pagina === 'meu' &&
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
            <MeuTrabalho aoAbrir={setProjetoAberto} />
          ))}

        {pagina === 'avisos' &&
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
            <Avisos aoAbrirProjeto={setProjetoAberto} aoMudarContagem={recontarAvisos} />
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

      {/* Barra de baixo: so no celular e no tablet de pe. Fica fixa porque a
          lateral de antes rolava para fora com a pagina — depois de rolar a
          tela nao havia navegacao nenhuma. */}
      <nav className="barra-baixo" aria-label="Navegação">
        {PAGINAS.filter((p) => p.principal).map((p) => (
          <button
            key={p.chave}
            onClick={() => ir(p.chave)}
            aria-current={pagina === p.chave ? 'page' : undefined}
          >
            <span>{p.curto ?? p.nome}</span>
            {p.chave === 'avisos' && naoLidos > 0 && (
              <i className="selo-contador" aria-label={`${naoLidos} não lidos`}>
                {naoLidos > 99 ? '99+' : naoLidos}
              </i>
            )}
          </button>
        ))}
        <button
          onClick={() => setMaisAberto(!maisAberto)}
          aria-expanded={maisAberto}
          aria-current={
            PAGINAS.some((p) => !p.principal && p.chave === pagina) ? 'page' : undefined
          }
        >
          <span>Mais</span>
        </button>
      </nav>

      {maisAberto && (
        <>
          {/* O veu fecha a folha ao ser tocado. Sem ele, so o "Mais" fecharia,
              e tocar fora e o que todo mundo tenta primeiro. */}
          <button className="veu" aria-label="Fechar" onClick={() => setMaisAberto(false)} />
          <div className="folha-menu" role="dialog" aria-label="Mais destinos">
            {PAGINAS.filter((p) => !p.principal).map((p) => (
              <button
                key={p.chave}
                onClick={() => ir(p.chave)}
                aria-current={pagina === p.chave ? 'page' : undefined}
              >
                {p.nome}
              </button>
            ))}
            <span className="folha-quem">
              {pessoa ? pessoa.nome : sessao.user.email}
              {!ehProducao && ` · ${ambiente} · ${refDoBanco.slice(0, 8)}`}
            </span>
            <button className="botao" onClick={() => supabase.auth.signOut()}>Sair</button>
          </div>
        </>
      )}
    </div>
  )
}
