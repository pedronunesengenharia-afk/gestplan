import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Impede que um erro de uma tela apague o app inteiro.
 *
 * Sem isto, um erro de renderização deixa a página em branco: nem menu, nem
 * mensagem, nem caminho de volta — e quem está usando conclui que o sistema
 * caiu. Com isto, a tela quebrada mostra o que quebrou e o resto continua
 * navegável.
 *
 * Existe porque aconteceu: o Painel quebrou na primeira execução e o navegador
 * mostrou uma página vazia, sem nenhuma pista do motivo.
 */
export class FronteiraDeErro extends Component<
  { children: ReactNode; nome: string },
  { erro: Error | null }
> {
  state: { erro: Error | null } = { erro: null }

  static getDerivedStateFromError(erro: Error) {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // O console do navegador continua sendo onde se investiga.
    console.error(`[${this.props.nome}]`, erro, info.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="aviso">
        <strong>A tela {this.props.nome} não conseguiu ser desenhada.</strong>
        <p className="justificativa">{this.state.erro.message}</p>
        <p className="acoes">
          <button className="botao" onClick={() => this.setState({ erro: null })}>
            Tentar de novo
          </button>
        </p>
      </div>
    )
  }
}
