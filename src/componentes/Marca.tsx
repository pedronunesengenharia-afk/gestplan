/**
 * A marca.
 *
 * O LOGOTIPO está fiel à prancheta: "GEST" no azul primário e "PLAN" em
 * cinza, caixa alta, com a assinatura embaixo.
 *
 * O SÍMBOLO é provisório, e está marcado como tal lá embaixo. O da prancheta é
 * um hexágono de fitas dobradas onde o G e o P formam a silhueta; redesenhá-lo
 * a partir de uma imagem deu duas versões parecidas-mas-erradas, e logotipo
 * quase certo é pior que logotipo nenhum. O que está aqui é honesto no que é:
 * hexágono, gradiente da marca, monograma na fonte da marca.
 *
 * O logotipo é "GEST" no azul primário e "PLAN" em cinza, caixa alta, com a
 * assinatura embaixo — como na prancheta. Na lateral escura as duas cores
 * sobem de tom pelo CSS, porque #0056D2 sobre grafite não se lê.
 *
 * O `id` do gradiente é único por instância: a mesma página pode mostrar a
 * marca duas vezes, e dois `defs` com o mesmo id fazem o segundo herdar o
 * primeiro — um defeito que só aparece quando alguém põe as duas juntas.
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
  const azulTeal = `at-${id}`
  const hex = `hx-${id}`

  return (
    <div className={tamanho === 'grande' ? 'marca marca--grande' : 'marca'}>
      <svg viewBox="0 0 64 64" role="img" aria-label="GestPlan" focusable="false">
        <defs>
          {/* O gradiente da prancheta: azul de confiança, teal de crescimento,
              verde de ação — nessa ordem, na diagonal. */}
          <linearGradient id={azulTeal} x1="6" y1="58" x2="58" y2="6" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0056D2" />
            <stop offset=".5" stopColor="#0097A7" />
            <stop offset="1" stopColor="#4CAF50" />
          </linearGradient>

          {/* O monograma é VAZADO do hexágono: assim a marca assenta sobre
              qualquer fundo, claro ou escuro, sem precisar de duas versões. */}
          <mask id={hex}>
            <rect width="64" height="64" fill="#fff" />
            <text
              x="32" y="34" fill="#000"
              textAnchor="middle" dominantBaseline="central"
              fontFamily="var(--fonte-titulo)" fontWeight="800"
              fontSize="29" letterSpacing="-1.5"
            >
              GP
            </text>
          </mask>
        </defs>

        {/* SÍMBOLO PROVISÓRIO, e é bom que fique escrito.
            O da prancheta é um hexágono de fitas dobradas onde o G e o P
            formam a própria silhueta. Redesenhei duas vezes a partir da imagem
            e as duas ficaram parecidas-mas-erradas — e logotipo quase certo é
            pior que logotipo nenhum, porque passa por certo.
            Este aqui é honesto no que é: o hexágono e o gradiente da marca,
            com o monograma na fonte da marca. Assim que o arquivo vetorial
            existir em `public/marca.svg`, troque este bloco por um <img> e
            apague este comentário. */}
        <path
          d="M32 1.5 60 17.6v28.8L32 62.5 4 46.4V17.6z"
          fill={`url(#${azulTeal})`}
          mask={`url(#${hex})`}
        />
      </svg>

      <span className="marca-nome">
        <span className="marca-logotipo">
          <b>GEST</b><i>PLAN</i>
        </span>
        {comAssinatura && <small>Gestão e Planejamento de Projetos</small>}
      </span>
    </div>
  )
}
