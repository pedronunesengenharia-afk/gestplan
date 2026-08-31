import { useEffect, useState } from 'react'
import {
  limparAvisosLidos, marcarAvisoLido, marcarTodosLidos, meusAvisos,
  type Notificacao,
} from '../lib/banco'
import { EsqueletoDeTabela } from '../componentes/Esqueleto'

/**
 * A caixa de avisos.
 *
 * O que ela resolve: até aqui o GestPlan só respondia quando era aberto.
 * Ninguém ficava sabendo que ganhou uma tarefa, que foi mencionado num
 * comentário ou que um parecer passou a depender dele — descobria abrindo o
 * projeto certo por acaso.
 *
 * Ela é SÓ LEITURA sobre o que os gatilhos escreveram. A tela não cria aviso,
 * e não existe caminho para criar: `notificacao` não tem política de INSERT.
 *
 * Não há caixa de outra pessoa para olhar. A política é
 * `pessoa_id = app.pessoa_atual()`, sem exceção nem para o proprietário.
 */

/** O rótulo de cada tipo. Novo tipo sem rótulo cai no próprio código, à vista. */
const ROTULO: Record<string, string> = {
  TAREFA_ATRIBUIDA: 'tarefa',
  COMENTARIO_MENCAO: 'menção',
  COMENTARIO_RESPOSTA: 'resposta',
  PARECER_PENDENTE: 'parecer',
  PROJETO_MUDOU_DE_FASE: 'fase',
}

/** Quanto tempo faz, em palavras. Data exata fica no `title`. */
function quando(iso: string): string {
  const minutos = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.round(horas / 24)
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function Avisos({
  aoAbrirProjeto, aoMudarContagem,
}: {
  aoAbrirProjeto: (projetoId: string) => void
  /** O contador do menu vive no App; a caixa avisa quando ele muda. */
  aoMudarContagem: () => void
}) {
  const [lista, setLista] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    meusAvisos()
      .then((a) => vivo && setLista(a))
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  async function comOBanco(acao: () => Promise<void>) {
    setOcupado(true)
    setErro(null)
    try {
      await acao()
      setLista(await meusAvisos())
      aoMudarContagem()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  // Abrir o aviso é lê-lo: marcar na mão o que se acabou de ler seria trabalho
  // que o sistema pode poupar.
  async function abrir(a: Notificacao) {
    if (!a.lida_em) {
      try {
        await marcarAvisoLido(a.id)
        setLista((antes) =>
          antes.map((x) => (x.id === a.id ? { ...x, lida_em: new Date().toISOString() } : x)),
        )
        aoMudarContagem()
      } catch {
        // Falhar em marcar como lido não pode impedir de abrir o projeto.
      }
    }
    if (a.projeto_id) aoAbrirProjeto(a.projeto_id)
  }

  if (carregando) return <EsqueletoDeTabela linhas={5} colunas={3} />

  const naoLidos = lista.filter((a) => !a.lida_em)
  const lidos = lista.filter((a) => a.lida_em)

  const linha = (a: Notificacao) => (
    <li key={a.id} className={a.lida_em ? 'aviso-item aviso-item--lido' : 'aviso-item'}>
      <button
        className="aviso-corpo"
        onClick={() => abrir(a)}
        disabled={ocupado}
        title={a.projeto_id ? 'Abrir o projeto' : 'Marcar como lido'}
      >
        <span className="aviso-titulo">
          {!a.lida_em && <i className="aviso-ponto" aria-label="não lido" />}
          {a.titulo}
        </span>
        {a.corpo && <span className="aviso-texto">{a.corpo}</span>}
      </button>
      <span className="aviso-lado">
        <span className="marca-etapa">{ROTULO[a.tipo] ?? a.tipo.toLowerCase()}</span>
        <span className="dado" title={new Date(a.criado_em).toLocaleString('pt-BR')}>
          {quando(a.criado_em)}
        </span>
      </span>
    </li>
  )

  return (
    <>
      <header className="cabecalho-pagina">
        <h1>Avisos</h1>
        <p>
          {naoLidos.length === 0
            ? 'Nada esperando por você.'
            : `${naoLidos.length} não lido${naoLidos.length === 1 ? '' : 's'}`}
          {lidos.length > 0 && ` · ${lidos.length} já lido${lidos.length === 1 ? '' : 's'}`}
        </p>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      {lista.length === 0 ? (
        <p className="vazio">
          Nenhum aviso ainda. Eles chegam sozinhos quando uma tarefa fica sua, quando alguém
          menciona ou responde você, quando um parecer passa a depender de você, e quando um
          projeto seu muda de fase.
        </p>
      ) : (
        <>
          <section className="secao">
            <h2>
              Esperando por você <span className="conta">{naoLidos.length}</span>
              {naoLidos.length > 0 && (
                <button
                  className="voltar conta"
                  disabled={ocupado}
                  onClick={() => comOBanco(marcarTodosLidos)}
                >
                  marcar tudo como lido
                </button>
              )}
            </h2>
            {naoLidos.length === 0 ? (
              <p className="vazio">Nada esperando por você.</p>
            ) : (
              <ul className="lista-avisos">{naoLidos.map(linha)}</ul>
            )}
          </section>

          {lidos.length > 0 && (
            <section className="secao">
              <h2>
                Já lidos <span className="conta">{lidos.length}</span>
                <button
                  className="voltar conta"
                  disabled={ocupado}
                  onClick={() => comOBanco(async () => { await limparAvisosLidos() })}
                >
                  limpar os lidos
                </button>
              </h2>
              <ul className="lista-avisos">{lidos.map(linha)}</ul>
            </section>
          )}
        </>
      )}
    </>
  )
}
