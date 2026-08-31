import logotipo from '../ativos/marca.png'
import simbolo from '../ativos/marca-simbolo.png'

/**
 * A marca, do arquivo original.
 *
 * Era desenhada em SVG por mim, a partir de uma imagem — e ficou
 * parecida-mas-errada duas vezes. Agora e o arquivo de verdade.
 *
 * DUAS PECAS, e a razao e o fundo:
 *
 *   · o logotipo completo tem "PLAN" e a assinatura em cinza-escuro, feitos
 *     para viver sobre claro. Vai nas telas de entrada, que sao claras.
 *   · na lateral escura entra so o SIMBOLO — o hexagono, que e colorido e se
 *     le sobre qualquer coisa — e o nome vem em texto, em tom claro. Por o
 *     logotipo inteiro ali exigiria uma versao invertida do arquivo, que nao
 *     existe; e logotipo sobre uma placa branca no meio de uma lateral escura
 *     e remendo, nao solucao.
 *
 * As imagens sao importadas em vez de referenciadas por caminho para o Vite
 * por a impressao digital no nome: navegador com a marca antiga em cache nao
 * fica mostrando a marca antiga depois de uma troca.
 */

export function Marca({
  tamanho = 'normal', comAssinatura = false,
}: {
  /** `normal` na lateral, `grande` nas telas de entrada. */
  tamanho?: 'normal' | 'grande'
  /** So faz efeito no tamanho grande: o logotipo ja traz a assinatura. */
  comAssinatura?: boolean
}) {
  if (tamanho === 'grande') {
    return (
      <div className="marca marca--grande">
        <img
          src={logotipo}
          alt={comAssinatura ? 'GestPlan — Gestao e Planejamento de Projetos' : 'GestPlan'}
        />
      </div>
    )
  }

  return (
    <div className="marca">
      <img src={simbolo} alt="" aria-hidden="true" />
      <span className="marca-nome">
        <span className="marca-logotipo"><b>GEST</b><i>PLAN</i></span>
      </span>
    </div>
  )
}
