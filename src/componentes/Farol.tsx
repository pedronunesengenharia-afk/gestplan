import type { Fase } from '../lib/banco'

/**
 * O farol das fases: um LED por fase do tipo, na ordem.
 *
 * A leitura é a de um painel de máquina — verde o que passou, âmbar onde está,
 * apagado o que vem, vermelho o que trava. Mas com uma disciplina que painel
 * de máquina não tem e software precisa ter: **cor nunca anda sozinha**. Cada
 * LED carrega o nome da fase ao lado ou no title, e o estado aparece também na
 * forma (aceso, anel, apagado). Oito por cento dos homens não separam verde de
 * vermelho; um farol que só fala por cor mente para eles.
 *
 * Nenhum nome de fase é escrito aqui. Ordem, cor e categoria vêm de
 * `tipo_fase`; quem trava vem do mesmo cálculo de pendências que o kanban e a
 * avaliação usam.
 */

export type EstadoDoLed = 'vencida' | 'atual' | 'futura' | 'travada' | 'arquivada'

const ROTULO: Record<EstadoDoLed, string> = {
  vencida: 'concluída',
  atual: 'em andamento',
  futura: 'ainda não começou',
  travada: 'travada — falta o que o banco exige para sair',
  arquivada: 'arquivada',
}

export function estadoDaFase(
  fase: Fase,
  faseAtual: Fase | undefined,
  trava: boolean,
): EstadoDoLed {
  if (fase.categoria === 'ARQUIVADO') return faseAtual?.id === fase.id ? 'arquivada' : 'futura'
  if (!faseAtual) return 'futura'
  if (fase.ordem < faseAtual.ordem) return 'vencida'
  if (fase.ordem > faseAtual.ordem) return 'futura'
  return trava ? 'travada' : 'atual'
}

export function Farol({
  fases, faseAtual, trava = false, compacto = false,
}: {
  fases: Fase[]
  faseAtual: Fase | undefined
  /** A fase atual tem pendência que o banco vai cobrar na saída? */
  trava?: boolean
  /** Compacto esconde os nomes e deixa só os LEDs, com o nome no title. */
  compacto?: boolean
}) {
  return (
    <ol className={compacto ? 'farol farol--compacto' : 'farol'}>
      {fases.map((f) => {
        const estado = estadoDaFase(f, faseAtual, trava)
        return (
          <li
            key={f.id}
            className={`led led--${estado}`}
            title={`${f.nome}: ${ROTULO[estado]}`}
          >
            <i aria-hidden />
            <span className="nome-da-fase">{f.nome}</span>
            <span className="so-leitor">{ROTULO[estado]}</span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * O farol da carteira: quantos projetos estão em cada fase.
 *
 * Aqui o LED não diz "por onde passei", diz "quanto tem parado aqui" — é o
 * mesmo desenho servindo a uma pergunta de carteira em vez de uma de projeto.
 */
export function FarolDaCarteira({
  fases, contagem, aoEscolher, faseEscolhida,
}: {
  fases: Fase[]
  contagem: Map<string, number>
  aoEscolher?: (faseId: string | null) => void
  faseEscolhida?: string | null
}) {
  const total = [...contagem.values()].reduce((t, n) => t + n, 0)

  return (
    <ol className="farol farol--carteira">
      {fases.map((f) => {
        const n = contagem.get(f.id) ?? 0
        const escolhida = faseEscolhida === f.id
        return (
          <li
            key={f.id}
            className={
              'led led--carteira' +
              (n === 0 ? ' led--futura' : '') +
              (escolhida ? ' led--escolhida' : '')
            }
          >
            <button
              type="button"
              onClick={() => aoEscolher?.(escolhida ? null : f.id)}
              disabled={!aoEscolher}
              title={`${f.nome}: ${n} de ${total} projeto${total === 1 ? '' : 's'}`}
            >
              {/* A cor da fase é dado (tipo_fase.cor); o número diz o mesmo
                  que ela, para quem não a distingue. */}
              <i aria-hidden style={n > 0 ? { background: f.cor, boxShadow: `0 0 12px ${f.cor}` } : undefined} />
              <strong>{n}</strong>
              <span className="nome-da-fase">{f.nome}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
