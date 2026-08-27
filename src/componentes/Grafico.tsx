import { useState, type ReactNode } from 'react'

/**
 * A moldura de todo gráfico do painel.
 *
 * Existe para que três coisas sejam impossíveis de esquecer, e não uma
 * lembrança de quem escreve cada tela:
 *
 *   · a legenda aparece sempre que houver duas séries ou mais;
 *   · todo gráfico tem "ver tabela", porque quem lê por leitor de tela ou
 *     imprime em preto e branco precisa dos números;
 *   · gráfico sem dado mostra o MOTIVO. Um retângulo em branco faz a pessoa
 *     achar que o sistema quebrou; "sem alocação ativa" responde a pergunta.
 */

export type Serie = { chave: string; nome: string; cor: string }

export function Grafico({
  titulo, nota, series, vazio, colunas, linhas, largo, children,
}: {
  titulo: string
  nota?: string
  /** Ordem FIXA: a cor segue a entidade, não a posição na lista filtrada. */
  series?: Serie[]
  /** Quando há motivo, ele aparece no lugar do gráfico. */
  vazio?: string
  /** Os mesmos números em texto, para o "ver tabela". */
  colunas?: string[]
  linhas?: (string | number)[][]
  largo?: boolean
  children: ReactNode
}) {
  const [tabela, setTabela] = useState(false)

  return (
    <section className={largo ? 'cartao-grafico largo' : 'cartao-grafico'}>
      <header>
        <h3>{titulo}</h3>
        {colunas && linhas && (
          <button className="ver-tabela" onClick={() => setTabela(!tabela)}>
            {tabela ? 'ver gráfico' : 'ver tabela'}
          </button>
        )}
      </header>

      {nota && <p className="nota">{nota}</p>}

      {series && series.length > 1 && (
        <div className="legenda">
          {series.map((s) => (
            <span key={s.chave}>
              <i style={{ background: s.cor }} /> {s.nome}
            </span>
          ))}
        </div>
      )}

      {vazio ? (
        <p className="vazio">{vazio}</p>
      ) : tabela && colunas && linhas ? (
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr>
                {colunas.map((c, i) => (
                  <th key={c} className={i === 0 ? undefined : 'direita'}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i}>
                  {l.map((celula, j) => (
                    <td key={j} className={j === 0 ? undefined : 'num direita'}>{celula}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  )
}

/** Quando a resposta é um número, é um número — não uma rosca de uma fatia. */
export function FichaDeNumero({
  rotulo, numero, apoio, destaque,
}: {
  rotulo: string
  numero: string
  apoio?: string
  destaque?: 'bom' | 'atencao' | 'serio' | 'critico'
}) {
  return (
    <div className="ficha-numero">
      <span className="rotulo">{rotulo}</span>
      <span className="numero" style={destaque ? { color: `var(--st-${destaque})` } : undefined}>
        {numero}
      </span>
      {apoio && <span className="apoio">{apoio}</span>}
    </div>
  )
}
