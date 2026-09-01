import { useEffect, useState } from 'react'
import { trilhaDeFases, type PassoDeFase } from '../lib/banco'
import { data as formatarData } from '../lib/formato'

/**
 * Por onde o projeto passou, e quanto tempo ficou em cada lugar.
 *
 * NADA AQUI É DADO NOVO. `projeto_fase_hist` recebe uma linha a cada mudança de
 * fase desde a primeira migração — quem mudou, de onde para onde, quando e por
 * quê — e nunca tinha sido mostrada. Este componente é a terceira perna do
 * histórico do projeto, ao lado da ocorrência e da decisão, e a única que já
 * estava escrita esse tempo todo.
 *
 * O QUE ELE ACRESCENTA É A DURAÇÃO. "Entrou em Viabilidade em 12/03" não move
 * ninguém; "ficou 41 dias na Viabilidade" move. A conta sai da view, não daqui:
 * é a pergunta que se faz do histórico, e refazê-la em cada tela que precisar
 * dela é como duas telas passam a discordar.
 *
 * A fase de agora aparece por último, aberta, com os dias correndo — é a linha
 * que interessa quando alguém pergunta "e esse projeto, como está?".
 */

const HOJE = new Date().toISOString().slice(0, 10)

export function TrilhaDeFases({ projetoId }: { projetoId: string }) {
  const [passos, setPassos] = useState<PassoDeFase[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    trilhaDeFases(projetoId)
      .then((t) => vivo && setPassos(t))
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [projetoId])

  if (carregando) return null
  if (erro) return <div className="aviso">{erro}</div>
  if (passos.length === 0) return null

  const ultimo = passos[passos.length - 1]
  const diasAgora = Math.round(
    (Date.parse(HOJE) - Date.parse(ultimo.em.slice(0, 10))) / 86_400_000,
  )

  // A soma do que já foi fechado. A fase de agora não entra: ela não terminou,
  // e somar o que ainda corre com o que já correu daria um número que muda de
  // significado todo dia.
  const totalFechado = passos.reduce((t, p) => t + (p.dias_na_anterior ?? 0), 0)

  return (
    <section className="secao">
      <h2>
        Por onde passou <span className="conta">{passos.length} mudança{passos.length === 1 ? '' : 's'}</span>
        {totalFechado > 0 && (
          <span className="conta conta--fraca">{totalFechado} dias de fases fechadas</span>
        )}
      </h2>

      <ol className="trilha">
        {passos.map((p, i) => (
          <li key={p.id} className={i === passos.length - 1 ? 'passo passo--agora' : 'passo'}>
            <i className="passo-marca" style={{ background: p.para_cor }} />

            <span className="passo-corpo">
              <span className="passo-fase">
                {p.de_fase ? (
                  <>
                    <span className="passo-de">{p.de_fase}</span>
                    <span aria-hidden> → </span>
                  </>
                ) : (
                  <span className="passo-de">criado em </span>
                )}
                <strong>{p.para_fase}</strong>
              </span>

              <span className="passo-quando">
                <span className="dado">{formatarData(p.em.slice(0, 10))}</span>
                {p.pessoa_nome && <span className="marca-etapa">{p.pessoa_nome}</span>}
                {/* A duração pertence à fase que ACABOU DE SAIR, não à que
                    entrou — por isso ela é dita aqui, na linha da saída. */}
                {p.dias_na_anterior !== null && p.de_fase && (
                  <span className="passo-duracao">
                    {p.dias_na_anterior} dia{p.dias_na_anterior === 1 ? '' : 's'} em {p.de_fase}
                  </span>
                )}
              </span>

              {p.motivo && <span className="passo-motivo">{p.motivo}</span>}
              {p.observacao && <span className="passo-motivo">{p.observacao}</span>}
            </span>
          </li>
        ))}

        <li className="passo passo--aberto">
          <i className="passo-marca" style={{ background: ultimo.para_cor }} />
          <span className="passo-corpo">
            <span className="passo-fase">
              está em <strong>{ultimo.para_fase}</strong>
            </span>
            <span className="passo-quando">
              <span className="passo-duracao">
                {diasAgora === 0
                  ? 'entrou hoje'
                  : `há ${diasAgora} dia${diasAgora === 1 ? '' : 's'}`}
              </span>
            </span>
          </span>
        </li>
      </ol>
    </section>
  )
}
