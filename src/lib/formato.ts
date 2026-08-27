const moedaBR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const dataBR = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

/** Valor em reais. Nulo vira travessão — nunca "R$ 0,00", que mente. */
export function moeda(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return moedaBR.format(v)
}

/** Data ISO (AAAA-MM-DD) para dd/mm/aaaa, sem passar por fuso. */
export function data(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return dataBR.format(new Date(a, m - 1, d))
}

/** 'AAAA-MM' para 'mmm/aa'. */
export function competencia(c: string | null | undefined): string {
  if (!c) return '—'
  const [a, m] = c.split('-').map(Number)
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${meses[m - 1]}/${String(a).slice(2)}`
}
