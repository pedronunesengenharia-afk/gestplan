/**
 * O estado que precisa sobreviver ao F5 e caber num link.
 *
 * Sem biblioteca de rotas: o que a tela guarda é a query string, lida na
 * montagem e reescrita com `replaceState` — sem empilhar histórico a cada
 * clique num filtro, que encheria o botão Voltar do navegador de lixo.
 */

export function lerParametros(): Record<string, string> {
  const p = new URLSearchParams(window.location.search)
  const saida: Record<string, string> = {}
  p.forEach((valor, chave) => {
    if (valor !== '') saida[chave] = valor
  })
  return saida
}

/** Escreve as chaves dadas; valor vazio ou nulo remove a chave da URL. */
export function guardarParametros(mudancas: Record<string, string | null | undefined>): void {
  const p = new URLSearchParams(window.location.search)
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor === null || valor === undefined || valor === '') p.delete(chave)
    else p.set(chave, valor)
  }
  const busca = p.toString()
  window.history.replaceState(null, '', busca ? `?${busca}` : window.location.pathname)
}
