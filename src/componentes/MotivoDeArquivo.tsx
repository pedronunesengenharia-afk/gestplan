import { MOTIVOS_ARQUIVO, type MotivoArquivo } from '../lib/banco'

/**
 * O que se pergunta quando um projeto vai para uma fase da categoria ARQUIVADO.
 *
 * NAO E O MESMO QUE O MOTIVO DA TRANSICAO. O texto livre conta a historia e vai
 * para o historico de fase; isto aqui e um dos quatro codigos que `projeto`
 * guarda, e ele existe para a carteira poder responder "quantos projetos
 * cairam por nao aprovacao neste ano" sem ninguem ler frase nenhuma.
 *
 * A data de retorno so aparece em EM_AGUARDO, e ali ela e obrigatoria: e a
 * regra `aguardo_tem_retorno`, que veio do desktop. Projeto posto de lado sem
 * data de volta e projeto perdido — foi assim que se decidiu cobrar a data.
 *
 * As tres telas que arquivam usam este mesmo bloco. Copiar as opcoes em cada
 * uma seria o jeito de elas discordarem no dia em que um motivo novo aparecer.
 */

export type EscolhaDeArquivo = {
  motivoArquivo: MotivoArquivo | ''
  retornoEm: string
}

export const ARQUIVO_VAZIO: EscolhaDeArquivo = { motivoArquivo: '', retornoEm: '' }

/** A escolha esta completa? Mesma pergunta que `mudarFase` faz antes de gravar. */
export function arquivoCompleto(e: EscolhaDeArquivo): boolean {
  if (e.motivoArquivo === '') return false
  return e.motivoArquivo !== 'EM_AGUARDO' || e.retornoEm !== ''
}

export function MotivoDeArquivo({
  prefixo,
  valor,
  aoMudar,
}: {
  prefixo: string
  valor: EscolhaDeArquivo
  aoMudar: (e: EscolhaDeArquivo) => void
}) {
  return (
    <>
      <p>
        <label htmlFor={`${prefixo}-motivo-arquivo`}>Arquivar por qual motivo</label>
        <br />
        <select
          id={`${prefixo}-motivo-arquivo`}
          className="campo"
          value={valor.motivoArquivo}
          onChange={(e) =>
            aoMudar({
              motivoArquivo: e.target.value as MotivoArquivo | '',
              retornoEm: e.target.value === 'EM_AGUARDO' ? valor.retornoEm : '',
            })
          }
        >
          <option value="">escolha…</option>
          {MOTIVOS_ARQUIVO.map((m) => (
            <option key={m.codigo} value={m.codigo}>{m.rotulo}</option>
          ))}
        </select>
      </p>

      {valor.motivoArquivo === 'EM_AGUARDO' && (
        <p>
          <label htmlFor={`${prefixo}-retorno`}>Volta a olhar em</label>
          <br />
          <input
            id={`${prefixo}-retorno`}
            className="campo"
            type="date"
            value={valor.retornoEm}
            onChange={(e) => aoMudar({ ...valor, retornoEm: e.target.value })}
          />
          <span className="ajuda">
            Sem data, o projeto em aguardo some da vista e ninguem volta nele.
          </span>
        </p>
      )}
    </>
  )
}
