import type { Fase, Setor } from '../lib/banco'
import { temPendencia, type Pendencias } from '../lib/pendencias'

/**
 * A lista do que falta para o projeto sair da fase.
 *
 * O texto é o mesmo no formulário, no kanban e na avaliação — a pessoa lê a
 * mesma frase onde quer que encontre a pendência.
 */
export function ListaDePendencias({
  pend, fases, setores, faseAtual,
}: {
  pend: Pendencias
  fases: Fase[]
  setores: Setor[]
  faseAtual: Fase | undefined
}) {
  if (!temPendencia(pend)) return null
  const nomeDoSetor = (cod: string) => setores.find((s) => s.codigo === cod)?.nome ?? cod

  return (
    <ul>
      {pend.campos.map((c) => (
        <li key={c.id}>
          {c.rotulo} — exigido para sair de{' '}
          {fases.find((f) => f.id === c.exigido_para_sair_de)?.nome}
        </li>
      ))}
      {pend.setores.map((s) => (
        <li key={s}>
          Parecer de {nomeDoSetor(s)}, que {faseAtual?.nome} exige
        </li>
      ))}
      {pend.outras.map((o) => (
        <li key={o}>{o}</li>
      ))}
      {pend.reprovou && (
        <li>
          {nomeDoSetor(pend.reprovou)} reprovou o projeto nesta fase — o caminho é arquivar,
          não avançar
        </li>
      )}
    </ul>
  )
}
