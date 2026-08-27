import { useEffect, useState } from 'react'
import {
  atualizarEtapa, criarEtapa, etapasDoProjeto, excluirEtapa,
  projeto as carregarProjeto, reordenarEtapas, tipoDeProjeto,
  ErroDoBanco,
  type Etapa, type Projeto as ProjetoDado, type TipoProjeto,
} from '../lib/banco'
import { descendentes, emOrdemDaArvore } from '../lib/arvore'
import { moeda } from '../lib/formato'

/**
 * A EAP do projeto: criar, editar, excluir e reordenar etapas.
 *
 * Quem decide se isto é uma EAP ou um orçamento é `tipo_projeto.usa_orcamento`.
 * Num tipo que não orça, as colunas de dinheiro não existem — não aparecem
 * vazias, não aparecem com travessão: não existem.
 */

/** O que uma linha em edição carrega. Só o que se pode escrever. */
type Rascunho = {
  codigo: string
  nome: string
  unidade: string
  quantidade: string
  preco_unitario: string
  a_confirmar: boolean
  peso_percentual: string
  percentual_concluido: string
}

function rascunhoDe(e: Etapa): Rascunho {
  return {
    codigo: e.codigo ?? '',
    nome: e.nome,
    unidade: e.unidade ?? '',
    quantidade: String(e.quantidade ?? 0),
    preco_unitario: String(e.preco_unitario ?? 0),
    a_confirmar: e.a_confirmar,
    peso_percentual: String(e.peso_percentual ?? 0),
    percentual_concluido: String(e.percentual_concluido ?? 0),
  }
}

export function Etapas({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const [projeto, setProjeto] = useState<ProjetoDado | null>(null)
  const [tipo, setTipo] = useState<TipoProjeto | null>(null)
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [editando, setEditando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    const buscar = async () => {
      const p = await carregarProjeto(id)
      if (!vivo) return
      setProjeto(p)
      if (!p) return
      const [t, es] = await Promise.all([tipoDeProjeto(p.tipo_projeto_id), etapasDoProjeto(id)])
      if (!vivo) return
      setTipo(t)
      setEtapas(es)
    }
    buscar()
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [id])

  async function recarregar() {
    const [p, es] = await Promise.all([carregarProjeto(id), etapasDoProjeto(id)])
    setProjeto(p)
    setEtapas(es)
  }

  async function comOBanco(acao: () => Promise<void>) {
    setOcupado(true)
    setErro(null)
    try {
      await acao()
      await recarregar()
    } catch (e) {
      setErro(e instanceof ErroDoBanco ? e.mensagem : e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  if (carregando) return <p className="vazio">Carregando…</p>
  if (!projeto) {
    return (
      <>
        <button className="voltar" onClick={aoVoltar}>← Projeto</button>
        <p className="vazio">Este projeto não existe ou você não alcança ele.</p>
      </>
    )
  }

  // Duas perguntas diferentes, e as duas somem com a coluna:
  // o tipo orça? (configuração) e esta pessoa alcança dinheiro? (RLS, que
  // devolve os valores do projeto nulos para quem não alcança).
  const tipoOrca = tipo?.usa_orcamento ?? false
  const alcancaDinheiro = projeto.valor_orcado !== null
  const mostraOrcamento = tipoOrca && alcancaDinheiro

  const linhas = emOrdemDaArvore(etapas)
  const filhosDe = (paiId: string | null) =>
    etapas.filter((e) => (e.pai_id ?? null) === paiId).sort((a, b) => a.ordem - b.ordem)

  /** Subtotal de um nó: só as folhas descendentes têm valor próprio. */
  function subtotal(e: Etapa): { total: number; palpite: number } {
    const descendencia = descendentes(etapas, e.id)
    const folhas = descendencia.length === 0 ? [e] : descendencia.filter((d) => d.folha)
    return {
      total: folhas.reduce((t, f) => t + (f.valor ?? 0), 0),
      palpite: folhas.reduce((t, f) => t + (f.a_confirmar ? f.valor ?? 0 : 0), 0),
    }
  }

  const folhas = etapas.filter((e) => e.folha)
  const totalProjeto = folhas.reduce((t, f) => t + (f.valor ?? 0), 0)
  const totalPalpite = folhas.reduce((t, f) => t + (f.a_confirmar ? f.valor ?? 0 : 0), 0)

  /** Soma dos pesos entre irmãs. Zerado em toda parte = peso ainda não usado. */
  function pesoDoGrupo(paiId: string | null): { soma: number; usado: boolean } {
    const irmas = filhosDe(paiId)
    const soma = irmas.reduce((t, i) => t + (i.peso_percentual ?? 0), 0)
    return { soma, usado: irmas.some((i) => (i.peso_percentual ?? 0) > 0) }
  }

  /** Próximo código livre: "3" na raiz, "1.4" dentro da etapa "1". */
  function proximoCodigo(pai: Etapa | null): string {
    const irmas = filhosDe(pai?.id ?? null)
    const prefixo = pai?.codigo ? `${pai.codigo}.` : ''
    let n = irmas.length + 1
    const usados = new Set(etapas.map((e) => e.codigo))
    while (usados.has(`${prefixo}${n}`)) n += 1
    return `${prefixo}${n}`
  }

  function acrescentar(pai: Etapa | null) {
    const irmas = filhosDe(pai?.id ?? null)

    // Folha com valor próprio virando grupo é a armadilha desta tela: o total
    // do projeto soma `where folha`, então no instante em que o pai deixa de
    // ser folha o valor DELE sai da conta. Num item de R$ 315.000 isso é o
    // total despencando por causa de um clique em "+ filha". Levar o valor
    // para a filha preserva a soma e é o que a pessoa quis dizer — mas é
    // mexida em dinheiro, e mexida em dinheiro se pergunta antes.
    const herdaValor = Boolean(pai && pai.folha && (pai.valor ?? 0) > 0)
    if (pai && herdaValor) {
      const ok = window.confirm(
        `"${pai.nome}" vale ${moeda(pai.valor)} e vai virar grupo.
Grupo não tem valor próprio: ele passa a valer a soma das filhas.

OK move ${moeda(pai.valor)} para a primeira filha, e o total do projeto não muda.
Cancelar não cria nada.`,
      )
      if (!ok) return
    }

    comOBanco(async () => {
      await criarEtapa({
        projeto_id: id,
        pai_id: pai?.id ?? null,
        codigo: proximoCodigo(pai),
        nome: herdaValor && pai ? pai.nome : 'Nova etapa',
        nivel: (pai?.nivel ?? 0) + 1,
        ordem: irmas.length,
        folha: true,
        unidade: herdaValor ? pai?.unidade ?? null : null,
        quantidade: herdaValor ? pai?.quantidade ?? 0 : 0,
        preco_unitario: herdaValor ? pai?.preco_unitario ?? 0 : 0,
        a_confirmar: herdaValor ? pai?.a_confirmar ?? false : false,
      })

      // Quem ganha filha deixa de ser folha. Não há trigger para isso, e o
      // total do projeto soma `where folha` — pai contado como folha
      // duplicaria o dinheiro das filhas.
      if (pai && pai.folha) {
        await atualizarEtapa(pai.id, {
          folha: false,
          ...(herdaValor ? { quantidade: 0, preco_unitario: 0, a_confirmar: false } : {}),
        })
      }
    })
  }

  function salvarLinha(e: Etapa) {
    if (!rascunho) return
    comOBanco(async () => {
      await atualizarEtapa(e.id, {
        codigo: rascunho.codigo.trim(),
        nome: rascunho.nome.trim(),
        unidade: rascunho.unidade.trim() || null,
        quantidade: Number(rascunho.quantidade) || 0,
        preco_unitario: Number(rascunho.preco_unitario) || 0,
        a_confirmar: rascunho.a_confirmar,
        peso_percentual: Number(rascunho.peso_percentual) || 0,
        percentual_concluido: Number(rascunho.percentual_concluido) || 0,
      })
      setEditando(null)
      setRascunho(null)
    })
  }

  function excluir(e: Etapa) {
    const filhotes = descendentes(etapas, e.id)
    const aviso =
      filhotes.length === 0
        ? `Excluir "${e.nome}"?`
        : `Excluir "${e.nome}" leva junto ${filhotes.length} etapa${filhotes.length === 1 ? '' : 's'} abaixo dela:\n\n` +
          filhotes.slice(0, 8).map((f) => `  ${f.codigo ?? ''} ${f.nome}`).join('\n') +
          (filhotes.length > 8 ? `\n  … e mais ${filhotes.length - 8}` : '') +
          '\n\nA exclusão em cascata é do banco e não tem volta. Continuar?'
    if (!window.confirm(aviso)) return

    const pai = etapas.find((x) => x.id === e.pai_id) ?? null
    comOBanco(async () => {
      await excluirEtapa(e.id)
      // Pai que ficou sem filho volta a ser folha, senão o valor dele para de
      // entrar no total do projeto.
      if (pai) {
        const sobraram = etapas.filter((x) => x.pai_id === pai.id && x.id !== e.id)
        if (sobraram.length === 0) await atualizarEtapa(pai.id, { folha: true })
      }
    })
  }

  function mover(e: Etapa, direcao: -1 | 1) {
    const irmas = filhosDe(e.pai_id ?? null)
    const i = irmas.findIndex((x) => x.id === e.id)
    const j = i + direcao
    if (i < 0 || j < 0 || j >= irmas.length) return
    const nova = [...irmas]
    nova[i] = irmas[j]
    nova[j] = irmas[i]
    comOBanco(() => reordenarEtapas(nova.map((x, k) => ({ id: x.id, ordem: k }))))
  }

  const colunas = mostraOrcamento ? 9 : 5

  return (
    <>
      <button className="voltar" onClick={aoVoltar}>← Projeto</button>

      <header className="cabecalho-pagina">
        <div className="titulo-projeto">
          <span className="dado codigo-projeto">{projeto.codigo}</span>
          <h1>Etapas</h1>
        </div>
        <p>
          {projeto.nome} · {etapas.length} etapa{etapas.length === 1 ? '' : 's'}
          {!tipoOrca && ' · este tipo de projeto não usa orçamento'}
          {tipoOrca && !alcancaDinheiro && ' · você não tem alcance financeiro neste projeto'}
        </p>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      <p className="acoes">
        <button className="botao botao--acao" onClick={() => acrescentar(null)} disabled={ocupado}>
          Acrescentar etapa
        </button>
      </p>

      {etapas.length === 0 ? (
        <p className="vazio">Nenhuma etapa ainda.</p>
      ) : (
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Etapa</th>
                {mostraOrcamento && <th>Un.</th>}
                {mostraOrcamento && <th className="direita">Qtd.</th>}
                {mostraOrcamento && <th className="direita">Preço unit.</th>}
                {mostraOrcamento && <th className="direita">Valor</th>}
                <th className="direita">Peso</th>
                <th className="direita">Concluído</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ item: e, profundidade }) => {
                const emEdicao = editando === e.id && rascunho !== null
                const st = subtotal(e)
                const grupo = !e.folha

                return (
                  <tr key={e.id} className={grupo ? 'linha-grupo' : undefined}>
                    <td className="dado">
                      {emEdicao ? (
                        <input
                          className="campo dado estreito" value={rascunho.codigo}
                          onChange={(ev) => setRascunho({ ...rascunho, codigo: ev.target.value })}
                        />
                      ) : (
                        e.codigo ?? '—'
                      )}
                    </td>

                    <td style={{ paddingLeft: `calc(var(--e3) + ${profundidade} * var(--e4))` }}>
                      {emEdicao ? (
                        <input
                          className="campo" value={rascunho.nome}
                          onChange={(ev) => setRascunho({ ...rascunho, nome: ev.target.value })}
                        />
                      ) : (
                        <>
                          {e.nome}
                          {e.a_confirmar && mostraOrcamento && (
                            <span className="marca-etapa" title="O preço ainda é palpite">
                              a confirmar
                            </span>
                          )}
                        </>
                      )}
                    </td>

                    {mostraOrcamento && (
                      <td>
                        {emEdicao && e.folha ? (
                          <input
                            className="campo estreito" value={rascunho.unidade}
                            onChange={(ev) => setRascunho({ ...rascunho, unidade: ev.target.value })}
                          />
                        ) : (
                          (e.folha && e.unidade) || ''
                        )}
                      </td>
                    )}

                    {mostraOrcamento && (
                      <td className="num direita">
                        {emEdicao && e.folha ? (
                          <input
                            type="number" step="0.0001" className="campo num estreito"
                            value={rascunho.quantidade}
                            onChange={(ev) => setRascunho({ ...rascunho, quantidade: ev.target.value })}
                          />
                        ) : e.folha ? (
                          (e.quantidade ?? 0).toLocaleString('pt-BR')
                        ) : (
                          ''
                        )}
                      </td>
                    )}

                    {mostraOrcamento && (
                      <td className="num direita">
                        {emEdicao && e.folha ? (
                          <input
                            type="number" step="0.01" className="campo num estreito"
                            value={rascunho.preco_unitario}
                            onChange={(ev) => setRascunho({ ...rascunho, preco_unitario: ev.target.value })}
                          />
                        ) : e.folha ? (
                          moeda(e.preco_unitario)
                        ) : (
                          ''
                        )}
                      </td>
                    )}

                    {mostraOrcamento && (
                      <td className="num direita">
                        {/* Valor é coluna gerada: aqui só se lê. Em grupo, o
                            que se mostra é a soma das folhas abaixo. */}
                        {grupo ? moeda(st.total) : moeda(e.valor)}
                        {st.palpite > 0 && (
                          <span className="marca-etapa" title={`${moeda(st.palpite)} ainda é palpite`}>
                            ?
                          </span>
                        )}
                      </td>
                    )}

                    <td className="num direita">
                      {emEdicao ? (
                        <input
                          type="number" step="0.01" className="campo num estreito"
                          value={rascunho.peso_percentual}
                          onChange={(ev) => setRascunho({ ...rascunho, peso_percentual: ev.target.value })}
                        />
                      ) : (
                        `${(e.peso_percentual ?? 0).toLocaleString('pt-BR')}%`
                      )}
                    </td>

                    <td className="num direita">
                      {emEdicao ? (
                        <input
                          type="number" step="0.1" min="0" max="100"
                          className="campo num estreito" value={rascunho.percentual_concluido}
                          onChange={(ev) =>
                            setRascunho({ ...rascunho, percentual_concluido: ev.target.value })}
                        />
                      ) : (
                        `${(e.percentual_concluido ?? 0).toLocaleString('pt-BR')}%`
                      )}
                    </td>

                    <td className="acoes-linha">
                      {emEdicao ? (
                        <>
                          <button className="voltar" onClick={() => salvarLinha(e)} disabled={ocupado}>
                            salvar
                          </button>
                          <button
                            className="voltar"
                            onClick={() => {
                              setEditando(null)
                              setRascunho(null)
                            }}
                          >
                            cancelar
                          </button>
                          {mostraOrcamento && e.folha && (
                            <label className="marcador">
                              <input
                                type="checkbox" checked={rascunho.a_confirmar}
                                onChange={(ev) =>
                                  setRascunho({ ...rascunho, a_confirmar: ev.target.checked })}
                              />
                              a confirmar
                            </label>
                          )}
                        </>
                      ) : (
                        <>
                          <button className="voltar" onClick={() => mover(e, -1)} disabled={ocupado}>↑</button>
                          <button className="voltar" onClick={() => mover(e, 1)} disabled={ocupado}>↓</button>
                          <button
                            className="voltar"
                            onClick={() => {
                              setEditando(e.id)
                              setRascunho(rascunhoDe(e))
                            }}
                            disabled={ocupado}
                          >
                            editar
                          </button>
                          <button className="voltar" onClick={() => acrescentar(e)} disabled={ocupado}>
                            + filha
                          </button>
                          <button className="voltar" onClick={() => excluir(e)} disabled={ocupado}>
                            excluir
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {mostraOrcamento && (
              <tfoot>
                <tr>
                  <td colSpan={colunas - 4}>Total do projeto</td>
                  <td className="num direita">{moeda(totalProjeto)}</td>
                  <td colSpan={3} />
                </tr>
                {totalPalpite > 0 && (
                  <tr>
                    <td colSpan={colunas - 4} className="campo-vazio">
                      do total acima, ainda é palpite
                    </td>
                    <td className="num direita campo-vazio">{moeda(totalPalpite)}</td>
                    <td colSpan={3} />
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
      )}

      {etapas.length > 0 && <Pesos etapas={etapas} pesoDoGrupo={pesoDoGrupo} />}
    </>
  )
}

/**
 * Quanto os pesos somam dentro de cada pai.
 *
 * O banco não exige que fechem 100, e nos 460 registros importados eles estão
 * todos em zero — avisar em toda linha treinaria a pessoa a ignorar o aviso.
 * Então: grupo com algum peso posto e soma diferente de 100 é apontado; grupo
 * inteiro em zero é apenas informado.
 */
function Pesos({
  etapas, pesoDoGrupo,
}: {
  etapas: Etapa[]
  pesoDoGrupo: (paiId: string | null) => { soma: number; usado: boolean }
}) {
  const pais: (string | null)[] = [null, ...etapas.filter((e) => !e.folha).map((e) => e.id)]
  const grupos = pais
    .map((paiId) => ({
      paiId,
      nome: paiId ? etapas.find((e) => e.id === paiId)?.nome ?? '' : 'Raiz',
      ...pesoDoGrupo(paiId),
    }))
    .filter((g) => g.usado && Math.abs(g.soma - 100) > 0.001)

  if (grupos.length === 0) {
    const algumPeso = etapas.some((e) => (e.peso_percentual ?? 0) > 0)
    return (
      <p className="ajuda">
        {algumPeso
          ? 'Os pesos fecham 100% dentro de cada grupo.'
          : 'Nenhum peso definido ainda — o avanço físico vai sair da média simples até que sejam postos.'}
      </p>
    )
  }

  return (
    <div className="aviso">
      <strong>Pesos que não fecham 100% dentro do mesmo pai:</strong>
      <ul>
        {grupos.map((g) => (
          <li key={g.paiId ?? 'raiz'}>
            {g.nome}: {g.soma.toLocaleString('pt-BR')}%
          </li>
        ))}
      </ul>
      O banco não exige isto — projeto em rascunho tem peso solto. Mas o avanço físico é
      ponderado por eles, e peso que não fecha distorce a leitura de quanto o projeto andou.
    </div>
  )
}
