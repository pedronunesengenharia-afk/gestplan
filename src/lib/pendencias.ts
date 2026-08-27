import type { CampoDefinicao, Fase, Parecer } from './banco'

/**
 * O que o banco vai cobrar numa mudança de fase, perguntado antes de mandar.
 *
 * Espelha, uma a uma, as regras que os triggers aplicam ao UPDATE de
 * `projeto.fase_id`:
 *
 *   app.validar_campos    todo campo cuja fase exigente vem ANTES da fase de
 *                         destino — as tarjas vermelha e âmbar da tela;
 *   app.exigir_pareceres  os setores que a fase de ORIGEM lista em
 *                         exige_setores e ainda não têm parecer APROVADO ou
 *                         CIENTE; o parecer REPROVADO, que tranca tudo; e
 *                         exige_orcamento / exige_cronograma da origem.
 *
 * Arquivar é exceção no banco — `app.exigir_pareceres` devolve cedo quando a
 * fase de destino é da categoria ARQUIVADO — e é exceção aqui pelo mesmo
 * motivo. Quem diz isso é a categoria, que é dado, não o nome da fase.
 *
 * Mora em `lib` porque três telas fazem a mesma pergunta: o formulário de
 * projeto, o kanban e a avaliação. Três cópias divergiriam, e a que
 * divergisse mentiria sobre o que o banco aceita.
 */

export type Pendencias = {
  campos: CampoDefinicao[]
  setores: string[]
  reprovou: string | null
  outras: string[]
}

export const SEM_PENDENCIA: Pendencias = { campos: [], setores: [], reprovou: null, outras: [] }

export function temPendencia(p: Pendencias): boolean {
  return p.campos.length > 0 || p.setores.length > 0 || p.outras.length > 0 || p.reprovou !== null
}

function estaVazio(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
}

export function calcularPendencias({
  campos, fases, faseAtual, faseDestino, valores, pareceres,
  temOrcamento, cronogramaCompleto,
}: {
  campos: CampoDefinicao[]
  fases: Fase[]
  faseAtual: Fase | undefined
  faseDestino: Fase | undefined
  valores: Record<string, unknown> | null | undefined
  pareceres: Parecer[]
  /** Nulo quando a fase de origem não cobra orçamento — nem se pergunta. */
  temOrcamento: boolean | null
  cronogramaCompleto: boolean | null
}): Pendencias {
  if (!faseAtual || !faseDestino) return SEM_PENDENCIA

  const ordemDaFase = (faseId: string) => fases.find((f) => f.id === faseId)?.ordem ?? 0

  const camposFaltando = campos.filter(
    (c) =>
      c.exigido_para_sair_de !== null &&
      ordemDaFase(c.exigido_para_sair_de) < faseDestino.ordem &&
      estaVazio(valores?.[c.codigo]),
  )

  const arquivando = faseDestino.categoria === 'ARQUIVADO'

  const setoresFaltando = arquivando
    ? []
    : faseAtual.exige_setores.filter(
        (s) =>
          !pareceres.some(
            (p) =>
              p.fase_id === faseAtual.id &&
              p.setor_codigo === s &&
              (p.decisao === 'APROVADO' || p.decisao === 'CIENTE'),
          ),
      )

  const reprovou = arquivando
    ? null
    : pareceres.find((p) => p.fase_id === faseAtual.id && p.decisao === 'REPROVADO')?.setor_codigo ??
      null

  const outras: string[] = []
  if (!arquivando && faseAtual.exige_orcamento && temOrcamento === false) {
    outras.push(`${faseAtual.nome} exige orçamento com pelo menos um item valorado`)
  }
  if (!arquivando && faseAtual.exige_cronograma && cronogramaCompleto === false) {
    outras.push(`${faseAtual.nome} exige todas as tarefas com data prevista`)
  }

  return { campos: camposFaltando, setores: setoresFaltando, reprovou, outras }
}
