import type { LinhaAvanco, Projeto, Tarefa, TipoProjeto } from '../lib/banco'
import { moeda } from '../lib/formato'

/**
 * Como este tipo de projeto mede que andou.
 *
 * Quem responde é `tipo_projeto.mede_avanco_por`, e o valor é dado: TAREFAS,
 * ETAPAS, MEDICAO, CHECKLIST ou DESEMBOLSO. A tela não sabe que "TI mede por
 * tarefa" — ela sabe ler a coluna. Um tipo novo que meça por outra coisa entra
 * acrescentando um caso aqui e uma linha no banco, não reescrevendo a tela.
 *
 * O que muda entre tipos é só o numerador, o denominador e o rótulo. A barra é
 * a mesma, de propósito: quem gerencia uma obra e um projeto de TI lê o mesmo
 * desenho nos dois.
 */

export type Medida = {
  rotulo: string
  feito: number
  total: number
  /** Como o número se lê: contagem ou dinheiro. */
  formato: 'contagem' | 'moeda'
  /** Quando não há o que medir, o motivo — nunca uma barra em zero sem explicação. */
  motivo?: string
}

export function medirEvolucao({
  tipo, projetos, tarefas, avanco, itensDeChecklist, itensFeitos,
}: {
  tipo: TipoProjeto
  projetos: Projeto[]
  tarefas: Tarefa[]
  avanco: LinhaAvanco[]
  itensDeChecklist: number
  itensFeitos: number
}): Medida {
  switch (tipo.mede_avanco_por) {
    case 'TAREFAS': {
      const validas = tarefas.filter((t) => t.status !== 'CANCELADA')
      return {
        rotulo: 'Tarefas concluídas',
        feito: validas.filter((t) => t.status === 'CONCLUIDA').length,
        total: validas.length,
        formato: 'contagem',
        motivo: validas.length === 0 ? 'Nenhuma tarefa cadastrada nos projetos deste tipo.' : undefined,
      }
    }

    case 'ETAPAS': {
      const total = avanco.reduce((t, a) => t + Number(a.etapas ?? 0), 0)
      return {
        rotulo: 'Etapas concluídas',
        feito: avanco.reduce((t, a) => t + Number(a.etapas_concluidas ?? 0), 0),
        total,
        formato: 'contagem',
        motivo: total === 0 ? 'Nenhuma etapa cadastrada nos projetos deste tipo.' : undefined,
      }
    }

    case 'CHECKLIST':
      return {
        rotulo: 'Itens de checklist concluídos',
        feito: itensFeitos,
        total: itensDeChecklist,
        formato: 'contagem',
        motivo:
          itensDeChecklist === 0
            ? 'Nenhum item de checklist nas tarefas deste tipo — é por eles que este tipo mede avanço.'
            : undefined,
      }

    case 'MEDICAO': {
      // Medição é da Fase 3; até lá, o tipo diz que mede assim e o dado não
      // existe. Dizer isso é mais honesto do que mostrar zero.
      return {
        rotulo: 'Medido',
        feito: 0,
        total: 0,
        formato: 'moeda',
        motivo:
          'Este tipo mede avanço por medição, e medição é da Fase 3 — ainda não há o que somar.',
      }
    }

    case 'DESEMBOLSO':
    default: {
      const orcado = projetos.reduce((t, p) => t + (p.valor_orcado ?? 0), 0)
      return {
        rotulo: 'Desembolsado do orçado',
        feito: projetos.reduce((t, p) => t + (p.valor_realizado ?? 0), 0),
        total: orcado,
        formato: 'moeda',
        motivo:
          orcado === 0
            ? 'Nenhum projeto deste tipo tem orçamento lançado, e é sobre ele que este tipo mede avanço.'
            : undefined,
      }
    }
  }
}

export function BarraDeEvolucao({ medida }: { medida: Medida }) {
  if (medida.motivo) {
    return (
      <div className="evolucao">
        <span className="rotulo">{medida.rotulo}</span>
        <p className="vazio">{medida.motivo}</p>
      </div>
    )
  }

  const fracao = medida.total > 0 ? medida.feito / medida.total : 0
  const pct = fracao * 100
  const mostrar = (v: number) =>
    medida.formato === 'moeda' ? moeda(v) : v.toLocaleString('pt-BR')

  return (
    <div className="evolucao">
      <span className="rotulo">{medida.rotulo}</span>
      <span className="numero">
        {pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
      </span>
      {/* A barra repete o número, não o substitui: quem imprime em preto e
          branco lê o texto; quem bate o olho lê o comprimento. */}
      <div
        className="trilha"
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={medida.rotulo}
      >
        <span style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="apoio">
        {mostrar(medida.feito)} de {mostrar(medida.total)}
      </span>
    </div>
  )
}
