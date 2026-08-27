/**
 * Achatamento de árvore por `pai_id`, na ordem em que se lê.
 *
 * Serve etapa hoje e tarefa amanhã: as duas guardam hierarquia do mesmo jeito.
 * Mora aqui, e não dentro de uma tela, porque duas telas que montam a mesma
 * árvore de dois jeitos acabam discordando sobre o que é filho de quem.
 */

export type NoDaArvore = {
  id: string
  pai_id: string | null
  ordem: number
  codigo: string | null
}

export type LinhaDaArvore<T> = { item: T; profundidade: number }

/**
 * Devolve os itens na ordem da árvore, com a profundidade de cada um.
 *
 * Protegido contra ciclo: o banco impede um nó de ser pai de si mesmo, mas não
 * impede A→B→A, e a recursão travaria a aba. Nó preso num ciclo — ou cujo pai
 * a RLS não devolveu — aparece na raiz, nunca some.
 */
export function emOrdemDaArvore<T extends NoDaArvore>(itens: T[]): LinhaDaArvore<T>[] {
  const filhos = new Map<string | null, T[]>()
  for (const i of itens) {
    const chave = i.pai_id ?? null
    filhos.set(chave, [...(filhos.get(chave) ?? []), i])
  }
  for (const lista of filhos.values()) {
    lista.sort((a, b) => a.ordem - b.ordem || (a.codigo ?? '').localeCompare(b.codigo ?? ''))
  }

  const linhas: LinhaDaArvore<T>[] = []
  const vistos = new Set<string>()
  const descer = (pai: string | null, profundidade: number) => {
    for (const i of filhos.get(pai) ?? []) {
      if (vistos.has(i.id)) continue
      vistos.add(i.id)
      linhas.push({ item: i, profundidade })
      descer(i.id, profundidade + 1)
    }
  }
  descer(null, 0)

  for (const i of itens) {
    if (!vistos.has(i.id)) {
      vistos.add(i.id)
      linhas.push({ item: i, profundidade: 0 })
    }
  }
  return linhas
}

/** Os ids de todos os descendentes de um nó — o que um `on delete cascade` leva junto. */
export function descendentes<T extends NoDaArvore>(itens: T[], id: string): T[] {
  const achados: T[] = []
  const fila = [id]
  const vistos = new Set<string>([id])
  while (fila.length > 0) {
    const atual = fila.shift() as string
    for (const i of itens) {
      if (i.pai_id === atual && !vistos.has(i.id)) {
        vistos.add(i.id)
        achados.push(i)
        fila.push(i.id)
      }
    }
  }
  return achados
}
