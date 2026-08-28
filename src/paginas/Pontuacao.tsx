import { useEffect, useState } from 'react'
import {
  cortesDePrioridade, criteriosDePontuacao, eu as carregarEu, notasDoProjeto,
  projeto as carregarProjeto, salvarNotas,
  ErroDoBanco,
  type Criterio, type NotaDoProjeto, type Projeto as ProjetoDado,
} from '../lib/banco'

/**
 * A pontuação que ordena a fila.
 *
 * A conta é feita aqui só para a pessoa ver o resultado enquanto digita. Quem
 * decide de verdade é `app.recalcular_prioridade`, no trigger — por isso a
 * tela nunca escreve `pontuacao_total` nem `prioridade`, e relê o projeto
 * depois de salvar em vez de confiar na própria conta.
 *
 * Os cortes vêm de `configuracao`, chave `prioridade.cortes`. Repetir os
 * números aqui faria a tela e o banco discordarem no dia em que alguém
 * mudasse a régua.
 */

const SELO: Record<string, string> = {
  URGENTE: 'selo selo--urgente',
  IMPORTANTE: 'selo selo--importante',
  PLANEJAMENTO: 'selo selo--planejamento',
}

type Rascunho = Record<string, { nota: string; justificativa: string }>

export function Pontuacao({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const [projeto, setProjeto] = useState<ProjetoDado | null>(null)
  const [criterios, setCriterios] = useState<Criterio[]>([])
  const [rascunho, setRascunho] = useState<Rascunho>({})
  const [cortes, setCortes] = useState({ urgente: 0.7, importante: 0.25 })
  const [minhaPessoaId, setMinhaPessoaId] = useState<string | null>(null)

  const [erro, setErro] = useState<string | null>(null)
  const [recado, setRecado] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let vivo = true
    const buscar = async () => {
      const p = await carregarProjeto(id)
      if (!vivo) return
      setProjeto(p)
      if (!p) return
      const [cs, notas, ct, quemSouEu] = await Promise.all([
        criteriosDePontuacao(p.tipo_projeto_id),
        notasDoProjeto(id),
        cortesDePrioridade(),
        carregarEu(),
      ])
      if (!vivo) return
      setCriterios(cs)
      setCortes(ct)
      setMinhaPessoaId(quemSouEu?.id ?? null)
      const r: Rascunho = {}
      for (const c of cs) {
        const n = notas.find((x) => x.criterio_id === c.id)
        r[c.id] = {
          nota: n ? String(n.nota) : '',
          justificativa: n?.justificativa ?? '',
        }
      }
      setRascunho(r)
    }
    buscar()
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [id])

  if (carregando) return <p className="vazio">Carregando…</p>
  if (!projeto) {
    return (
      <>
        <button className="voltar" onClick={aoVoltar}>← Projeto</button>
        <p className="vazio">Este projeto não existe ou você não alcança ele.</p>
      </>
    )
  }

  // A mesma conta do banco, para a tela mostrar o resultado antes de salvar:
  // só critério ativo entra no total e no máximo.
  const ativos = criterios.filter((c) => c.ativo)
  const total = ativos.reduce(
    (t, c) => t + (Number(rascunho[c.id]?.nota) || 0) * Number(c.peso), 0,
  )
  const maximo = ativos.reduce((t, c) => t + c.maximo * Number(c.peso), 0)
  const fracao = maximo > 0 ? total / maximo : 0
  const prioridadePrevista =
    fracao >= cortes.urgente ? 'URGENTE' : fracao >= cortes.importante ? 'IMPORTANTE' : 'PLANEJAMENTO'

  async function salvar() {
    setSalvando(true)
    setErro(null)
    setRecado(null)
    try {
      const notas: NotaDoProjeto[] = criterios
        .filter((c) => rascunho[c.id]?.nota !== '')
        .map((c) => ({
          criterio_id: c.id,
          nota: Number(rascunho[c.id].nota),
          justificativa: rascunho[c.id].justificativa.trim() || null,
        }))
      await salvarNotas(id, minhaPessoaId, notas)
      // Relê: pontuacao_total e prioridade saem do trigger, não da conta acima.
      const p = await carregarProjeto(id)
      setProjeto(p)
      setRecado(
        `Salvo. O banco calculou ${p?.pontuacao_total} pontos e prioridade ${p?.prioridade}.`,
      )
    } catch (e) {
      setErro(e instanceof ErroDoBanco ? e.mensagem : e instanceof Error ? e.message : String(e))
    } finally {
      setSalvando(false)
    }
  }

  const desligados = criterios.filter((c) => !c.ativo).length

  /**
   * Notas fora da faixa do próprio critério.
   *
   * O banco recusa com "Nota 9 fora da faixa 0 a 5 deste critério" — uma
   * mensagem que não diz QUAL critério, porque o trigger olha uma linha por
   * vez. A tela sabe: é esta lista. Então o erro do banco encosta na linha
   * certa em vez de ficar solto no topo.
   */
  const foraDaFaixa = criterios.filter((c) => {
    const n = rascunho[c.id]?.nota
    if (n === undefined || n === '') return false
    const v = Number(n)
    return Number.isNaN(v) || v < c.minimo || v > c.maximo
  })

  return (
    <>
      <button className="voltar" onClick={aoVoltar}>← Projeto</button>

      <header className="cabecalho-pagina">
        <div className="titulo-projeto">
          <span className="dado codigo-projeto">{projeto.codigo}</span>
          <h1>Pontuação</h1>
        </div>
        <p>{projeto.nome}</p>
      </header>

      {erro && foraDaFaixa.length === 0 && <div className="aviso">{erro}</div>}
      {recado && <div className="aviso aviso--ok">{recado}</div>}

      <section className="ficha-projeto">
        <div>
          <dt>Gravado no banco</dt>
          <dd>
            {projeto.pontuacao_total} pontos{' '}
            <span className={SELO[projeto.prioridade]}>{projeto.prioridade}</span>
          </dd>
        </div>
        <div>
          <dt>Com o que está na tela</dt>
          <dd>
            {total.toLocaleString('pt-BR')} de {maximo.toLocaleString('pt-BR')}{' '}
            <span className="campo-vazio">
              ({(fracao * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)
            </span>
          </dd>
        </div>
        <div>
          <dt>Prioridade que resulta</dt>
          <dd>
            <span className={SELO[prioridadePrevista]}>{prioridadePrevista}</span>
          </dd>
        </div>
        <div>
          <dt>A régua</dt>
          <dd className="campo-vazio">
            urgente a partir de {(cortes.urgente * 100).toLocaleString('pt-BR')}%, importante a
            partir de {(cortes.importante * 100).toLocaleString('pt-BR')}%
          </dd>
        </div>
      </section>

      {desligados > 0 && (
        <p className="ajuda">
          {desligados} critério{desligados === 1 ? '' : 's'} desligado
          {desligados === 1 ? '' : 's'} aparece{desligados === 1 ? '' : 'm'} abaixo, esmaecido
          {desligados === 1 ? '' : 's'}. A nota continua sendo gravada — pontuar hoje é o que
          permite ligar o bloco depois, sem ter de revisitar projeto por projeto.
        </p>
      )}

      <div className="tabela-rolavel">
        <table>
          <thead>
            <tr>
              <th>Critério</th>
              <th className="direita">Nota</th>
              <th className="direita">Peso</th>
              <th className="direita">Pontos</th>
              <th>Justificativa</th>
            </tr>
          </thead>
          <tbody>
            {criterios.map((c) => {
              const r = rascunho[c.id] ?? { nota: '', justificativa: '' }
              const pontos = (Number(r.nota) || 0) * Number(c.peso)
              return (
                <tr key={c.id} className={c.ativo ? undefined : 'linha-inativa'}>
                  <td>
                    {c.nome}
                    {!c.ativo && (
                      <span
                        className="marca-etapa"
                        title={`A nota fica gravada e valeria ${pontos} pontos, mas este critério não entra na fila enquanto estiver desligado`}
                      >
                        não conta hoje
                      </span>
                    )}
                    {c.descricao && <p className="ajuda">{c.descricao}</p>}
                  </td>
                  <td className="num direita">
                    <input
                      type="number" className="campo num estreito"
                      min={c.minimo} max={c.maximo} value={r.nota}
                      onChange={(e) =>
                        setRascunho({ ...rascunho, [c.id]: { ...r, nota: e.target.value } })}
                    />
                    <span className="campo-vazio"> /{c.maximo}</span>
                  </td>
                  <td className="num direita">{Number(c.peso).toLocaleString('pt-BR')}</td>
                  <td className="num direita">
                    {c.ativo ? pontos.toLocaleString('pt-BR') : <span title={`valeria ${pontos}`}>0</span>}
                  </td>
                  <td>
                    <input
                      className="campo" value={r.justificativa}
                      onChange={(e) =>
                        setRascunho({ ...rascunho, [c.id]: { ...r, justificativa: e.target.value } })}
                    />
                    {foraDaFaixa.some((x) => x.id === c.id) && (
                      <p className="erro-campo">
                        {erro ?? `Nota fora da faixa ${c.minimo} a ${c.maximo} deste critério.`}
                      </p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total dos critérios ativos</td>
              <td className="num direita">{total.toLocaleString('pt-BR')}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="acoes">
        <button
          className="botao botao--acao" onClick={salvar}
          disabled={salvando || foraDaFaixa.length > 0}
        >
          {salvando ? 'Salvando…' : 'Salvar pontuação'}
        </button>
        <button className="botao" onClick={aoVoltar} disabled={salvando}>Fechar</button>
      </p>
    </>
  )
}
