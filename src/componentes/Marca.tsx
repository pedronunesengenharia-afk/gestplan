/**
 * A marca, em SVG.
 *
 * Antes era um quadrado laranja com um furo — um marcador, não uma marca. A
 * prancheta pede o hexágono com o monograma GP e o gradiente que vai do azul
 * de confiança ao verde de ação, passando pelo teal de crescimento.
 *
 * É desenhado, não uma imagem: escala sem borrar, acompanha o tamanho da
 * fonte, e no tema escuro continua com a mesma cor — a marca não muda de cor
 * com o tema, senão deixa de ser marca.
 *
 * O `id` do gradiente é único por instância porque a mesma página pode mostrar
 * a marca duas vezes (lateral e tela pública), e dois `defs` com o mesmo id
 * fazem o segundo herdar o primeiro — um bug que só aparece quando alguém põe
 * as duas na mesma tela.
 */

import { useId } from 'react'

export function Marca({
  tamanho = 'normal', comAssinatura = false,
}: {
  /** `normal` na lateral, `grande` nas telas de entrada. */
  tamanho?: 'normal' | 'grande'
  /** A linha "Gestão e Planejamento de Projetos", só onde há espaço. */
  comAssinatura?: boolean
}) {
  const id = useId()
  const grad = `g-${id}`
  const corte = `c-${id}`

  return (
    <div className={tamanho === 'grande' ? 'marca marca--grande' : 'marca'}>
      <svg viewBox="0 0 64 64" role="img" aria-label="GestPlan" focusable="false">
        <defs>
          <linearGradient id={grad} x1="6" y1="58" x2="58" y2="6" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0056D2" />
            <stop offset=".52" stopColor="#0097A7" />
            <stop offset="1" stopColor="#4CAF50" />
          </linearGradient>

          {/* O monograma é VAZADO do hexágono, não desenhado por cima: assim a
              marca funciona sobre qualquer fundo, claro ou escuro.

              Letra de verdade, na fonte da marca, em vez de um desenho meu de
              "G" e "P": num monograma de 27px na lateral, a diferença entre uma
              letra bem desenhada e uma aproximação aparece — e a Urbanist já
              está carregada. */}
          <mask id={corte}>
            <rect width="64" height="64" fill="#fff" />
            <text
              x="32" y="33" fill="#000"
              textAnchor="middle" dominantBaseline="central"
              fontFamily="var(--fonte-titulo)" fontWeight="800"
              fontSize="30" letterSpacing="-1.5"
            >
              GP
            </text>
          </mask>
      </defs>

        {/* Hexágono de pé, com canto levemente macio: a prancheta é de cantos
            macios, e um vértice em ponta viva destoaria do resto do sistema. */}
        <path
          d="M32 2.6 58.4 17.8a4.6 4.6 0 0 1 2.3 4v24.4a4.6 4.6 0 0 1-2.3 4L32 61.4
             a4.6 4.6 0 0 1-4.6 0L5.6 50.2a4.6 4.6 0 0 1-2.3-4V21.8a4.6 4.6 0 0 1 2.3-4z"
          fill={`url(#${grad})`}
          mask={`url(#${corte})`}
        />
      </svg>

      <span className="marca-nome">
        <b>Gest</b>Plan
        {comAssinatura && (
          <small>Gestão e Planejamento de Projetos</small>
        )}
      </span>
    </div>
  )
}
