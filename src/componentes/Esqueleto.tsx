/**
 * O contorno da tela enquanto o dado não chegou.
 *
 * "Carregando…" some com tudo e a página pula quando o dado chega — a pessoa
 * perde o lugar onde estava olhando. O esqueleto ocupa o mesmo espaço que a
 * tabela vai ocupar, então a chegada do dado não move nada.
 */

export function EsqueletoDeTabela({ linhas = 8, colunas = 6 }: { linhas?: number; colunas?: number }) {
  return (
    <div className="tabela-rolavel" aria-busy="true" aria-live="polite">
      <table className="esqueleto">
        <thead>
          <tr>
            {Array.from({ length: colunas }, (_, i) => (
              <th key={i}><span className="barra" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: linhas }, (_, l) => (
            <tr key={l}>
              {Array.from({ length: colunas }, (_, c) => (
                <td key={c}>
                  {/* Larguras diferentes por coluna: bloco uniforme não parece
                      texto, parece defeito. */}
                  <span className="barra" style={{ width: `${[70, 95, 55, 60, 45, 50][c % 6]}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EsqueletoDeFichas({ quantas = 4 }: { quantas?: number }) {
  return (
    <div className="painel" aria-busy="true">
      {Array.from({ length: quantas }, (_, i) => (
        <div className="ficha-numero esqueleto" key={i}>
          <span className="barra" style={{ width: '45%', height: '.6rem' }} />
          <span className="barra" style={{ width: '70%', height: '1.6rem' }} />
        </div>
      ))}
    </div>
  )
}
