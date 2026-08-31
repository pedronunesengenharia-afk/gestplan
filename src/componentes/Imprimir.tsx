import logotipo from '../ativos/marca.png'

/**
 * O cabecalho que so existe no papel, e o botao que manda imprimir.
 *
 * Nao ha biblioteca de PDF aqui de proposito. O navegador ja gera PDF —
 * "Salvar como PDF" no dialogo de impressao — e o que faltava era a pagina
 * parar de ser aplicativo e virar documento, que e trabalho de folha de
 * estilo (estilos/impressao.css). Uma biblioteca de PDF significaria
 * reimplementar paginacao, quebra de tabela e fonte embutida, e manter isso.
 *
 * O que o navegador da de graca e que a biblioteca custaria caro: o documento
 * sai exatamente como a tela mostra, entao nao existe a classe de defeito em
 * que o PDF diverge do sistema.
 */

export function CabecalhoImpresso({ titulo, sub }: { titulo: string; sub?: string }) {
  const agora = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  return (
    <header className="cabecalho-impresso">
      <img src={logotipo} alt="GestPlan" />
      <span>
        <strong>{titulo}</strong>
        {sub && <em>{sub}</em>}
        {/* Sem a data, uma folha achada na mesa daqui a tres meses parece
            atual — e numero de carteira envelhece rapido. */}
        <small>Emitido em {agora}</small>
      </span>
    </header>
  )
}

export function BotaoImprimir({ rotulo = 'PDF' }: { rotulo?: string }) {
  return (
    <button
      className="botao"
      onClick={() => window.print()}
      title="Abre o diálogo de impressão — escolha 'Salvar como PDF'"
    >
      {rotulo}
    </button>
  )
}
