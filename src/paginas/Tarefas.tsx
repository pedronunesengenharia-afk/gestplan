import { Fragment, useEffect, useState } from 'react'
import {
  atualizarTarefa, checklistDasTarefas, criarDependencia, criarItemChecklist,
  criarTarefa, dependenciasDasTarefas, etapasDoProjeto, eu as carregarEu,
  excluirDependencia, excluirItemChecklist, excluirTarefa, marcarItemChecklist,
  pessoas as carregarPessoas, possoEditarProjeto, projeto as carregarProjeto,
  reordenarTarefas, tarefasDoProjeto, tipoDeProjeto,
  ErroDoBanco, STATUS_TAREFA, TIPOS_DE_DEPENDENCIA,
  type Dependencia, type Etapa, type ItemChecklist, type Pessoa,
  type Projeto as ProjetoDado, type Tarefa, type TipoProjeto,
} from '../lib/banco'
import { emOrdemDaArvore } from '../lib/arvore'
import { data as formatarData } from '../lib/formato'

/**
 * As tarefas do projeto.
 *
 * A tela aparece se `tipo_projeto.usa_cronograma`. Não calcula data nenhuma:
 * o motor de CPM é a Fase 2, e inventar data aqui seria trabalho jogado fora.
 *
 * Sobre quem pode editar o quê: a RLS tem duas políticas para `tarefa` — quem
 * edita o projeto mexe em tudo, e o responsável mexe na dele. A tela pergunta
 * ao banco qual é o caso, por `posso_editar_projeto`: a mesma função que a
 * política usa, exposta em `public` para a tela poder consultar sem reescrever
 * a regra em TypeScript.
 *
 * O UPDATE que volta com zero linhas continua tratado, como rede: se a
 * permissão mudar entre a pergunta e o clique, a tela diz o que aconteceu em
 * vez de fingir que salvou.
 */

type Rascunho = {
  nome: string
  descricao: string
  responsavel_id: string
  etapa_id: string
  status: string
  marco: boolean
  percentual_concluido: string
  data_inicio_prev: string
  data_fim_prev: string
  data_inicio_real: string
  data_fim_real: string
  duracao_dias: string
}

function rascunhoDe(t: Tarefa, descricao = '', duracao: number | null = null): Rascunho {
  return {
    nome: t.nome,
    descricao,
    responsavel_id: t.responsavel_id ?? '',
    etapa_id: t.etapa_id ?? '',
    status: t.status,
    marco: t.marco,
    percentual_concluido: String(t.percentual_concluido ?? 0),
    data_inicio_prev: t.data_inicio_prev ?? '',
    data_fim_prev: t.data_fim_prev ?? '',
    data_inicio_real: '',
    data_fim_real: t.data_fim_real ?? '',
    duracao_dias: duracao === null ? '' : String(duracao),
  }
}

const ROTULO_STATUS = (s: string) => s.replace(/_/g, ' ').toLowerCase()

export function Tarefas({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const [projeto, setProjeto] = useState<ProjetoDado | null>(null)
  const [tipo, setTipo] = useState<TipoProjeto | null>(null)
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [equipe, setEquipe] = useState<Pessoa[]>([])
  const [checklist, setChecklist] = useState<ItemChecklist[]>([])
  const [dependencias, setDependencias] = useState<Dependencia[]>([])
  const [minhaPessoa, setMinhaPessoa] = useState<Pessoa | null>(null)

  const [editando, setEditando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [textoNovo, setTextoNovo] = useState('')
  const [novaDep, setNovaDep] = useState({ predecessora: '', tipo: 'TI', folga: '0' })

  const [soLeitura, setSoLeitura] = useState(false)
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
      const [t, ts, es, gente, quemSouEu, podeEditar] = await Promise.all([
        tipoDeProjeto(p.tipo_projeto_id),
        tarefasDoProjeto(id),
        etapasDoProjeto(id),
        carregarPessoas(),
        carregarEu(),
        possoEditarProjeto(id),
      ])
      if (!vivo) return
      setSoLeitura(!podeEditar)
      setTipo(t)
      setTarefas(ts)
      setEtapas(es)
      setEquipe(gente)
      setMinhaPessoa(quemSouEu)
      const ids = ts.map((x) => x.id)
      const [cl, deps] = await Promise.all([checklistDasTarefas(ids), dependenciasDasTarefas(ids)])
      if (!vivo) return
      setChecklist(cl)
      setDependencias(deps)
    }
    buscar()
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [id])

  async function recarregar() {
    const ts = await tarefasDoProjeto(id)
    setTarefas(ts)
    const ids = ts.map((x) => x.id)
    const [cl, deps] = await Promise.all([checklistDasTarefas(ids), dependenciasDasTarefas(ids)])
    setChecklist(cl)
    setDependencias(deps)
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

  if (!(tipo?.usa_cronograma ?? false)) {
    return (
      <>
        <button className="voltar" onClick={aoVoltar}>← Projeto</button>
        <p className="vazio">
          O tipo {projeto.tipo_nome} não usa cronograma, então este projeto não tem tarefas.
        </p>
      </>
    )
  }

  const souResponsavel = (t: Tarefa) =>
    minhaPessoa !== null && t.responsavel_id === minhaPessoa.id
  /** Editar esta tarefa é oferecido? Sempre para a minha; para as outras, até a RLS dizer não. */
  const possoMexer = (t: Tarefa) => souResponsavel(t) || !soLeitura

  const linhas = emOrdemDaArvore(tarefas)
  const irmasDe = (paiId: string | null) =>
    tarefas.filter((t) => (t.pai_id ?? null) === paiId).sort((a, b) => a.ordem - b.ordem)

  function acrescentar(pai: Tarefa | null) {
    const irmas = irmasDe(pai?.id ?? null)
    comOBanco(async () => {
      await criarTarefa({
        projeto_id: id,
        pai_id: pai?.id ?? null,
        nome: 'Nova tarefa',
        status: 'NAO_INICIADA',
        ordem: irmas.length,
        percentual_concluido: 0,
        marco: false,
      })
    })
  }

  function salvarLinha(t: Tarefa) {
    if (!rascunho) return
    comOBanco(async () => {
      const mudou = await atualizarTarefa(t.id, {
        nome: rascunho.nome.trim(),
        descricao: rascunho.descricao.trim() || null,
        responsavel_id: rascunho.responsavel_id || null,
        etapa_id: rascunho.etapa_id || null,
        status: rascunho.status,
        marco: rascunho.marco,
        // Marco não tem duração: o banco tem CHECK para isso, e a pessoa não
        // deve chegar nele para descobrir.
        duracao_dias: rascunho.marco ? 0 : rascunho.duracao_dias === '' ? null : Number(rascunho.duracao_dias),
        percentual_concluido: Number(rascunho.percentual_concluido) || 0,
        data_inicio_prev: rascunho.data_inicio_prev || null,
        data_fim_prev: rascunho.data_fim_prev || null,
        data_fim_real: rascunho.data_fim_real || null,
      })
      if (mudou === 0) {
        // Rede: a permissão mudou entre a pergunta e o clique.
        setSoLeitura(true)
        setErro(
          'A RLS recusou em silêncio: você pode alterar apenas as tarefas de que é ' +
            'responsável. A tela passou a modo leitura para as demais.',
        )
        return
      }
      setEditando(null)
      setRascunho(null)
    })
  }

  function excluir(t: Tarefa) {
    const filhas = tarefas.filter((x) => x.pai_id === t.id)
    const aviso =
      filhas.length === 0
        ? `Excluir "${t.nome}"?`
        : `Excluir "${t.nome}" leva junto ${filhas.length} subtarefa(s). Continuar?`
    if (!window.confirm(aviso)) return
    comOBanco(async () => {
      const apagou = await excluirTarefa(t.id)
      if (apagou === 0) {
        setSoLeitura(true)
        setErro('A RLS recusou a exclusão: só quem edita o projeto pode excluir tarefa.')
      }
    })
  }

  function mover(t: Tarefa, direcao: -1 | 1) {
    const irmas = irmasDe(t.pai_id ?? null)
    const i = irmas.findIndex((x) => x.id === t.id)
    const j = i + direcao
    if (i < 0 || j < 0 || j >= irmas.length) return
    const nova = [...irmas]
    nova[i] = irmas[j]
    nova[j] = irmas[i]
    comOBanco(() => reordenarTarefas(nova.map((x, k) => ({ id: x.id, ordem: k }))))
  }

  const semData = tarefas.filter((t) => !t.data_inicio_prev && !t.data_fim_prev).length

  return (
    <>
      <button className="voltar" onClick={aoVoltar}>← Projeto</button>

      <header className="cabecalho-pagina">
        <div className="titulo-projeto">
          <span className="dado codigo-projeto">{projeto.codigo}</span>
          <h1>Tarefas</h1>
        </div>
        <p>
          {projeto.nome} · {tarefas.length} tarefa{tarefas.length === 1 ? '' : 's'}
          {semData > 0 && ` · ${semData} sem data prevista`}
        </p>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      <p className="acoes">
        <button
          className="botao botao--acao" onClick={() => acrescentar(null)}
          disabled={ocupado || soLeitura}
        >
          Acrescentar tarefa
        </button>
      </p>

      {tarefas.length === 0 ? (
        <p className="vazio">Nenhuma tarefa ainda.</p>
      ) : (
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Tarefa</th>
                <th>Responsável</th>
                <th>Etapa</th>
                <th>Situação</th>
                <th className="direita">Concluído</th>
                <th>Início prev.</th>
                <th>Fim prev.</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ item: t, profundidade }) => {
                const emEdicao = editando === t.id && rascunho !== null
                const itens = checklist.filter((c) => c.tarefa_id === t.id)
                const feitos = itens.filter((c) => c.concluido).length
                const deps = dependencias.filter((d) => d.tarefa_id === t.id)

                return (
                  <Fragment key={t.id}>
                    <tr className={t.marco ? 'linha-grupo' : undefined}>
                      <td className="dado">{t.codigo ?? '—'}</td>
                      <td style={{ paddingLeft: `calc(var(--e3) + ${profundidade} * var(--e4))` }}>
                        {emEdicao ? (
                          <input
                            className="campo" value={rascunho.nome}
                            onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                          />
                        ) : (
                          <>
                            <button
                              className="voltar"
                              onClick={() => setAberta(aberta === t.id ? null : t.id)}
                            >
                              {aberta === t.id ? '▾' : '▸'}
                            </button>{' '}
                            {t.nome}
                            {t.marco && <span className="marca-etapa">marco</span>}
                            {souResponsavel(t) && <span className="marca-etapa">sua</span>}
                            {itens.length > 0 && (
                              <span className="marca-etapa">{feitos}/{itens.length}</span>
                            )}
                            {deps.length > 0 && (
                              <span className="marca-etapa">{deps.length} predecessora(s)</span>
                            )}
                          </>
                        )}
                      </td>
                      <td>
                        {emEdicao ? (
                          <select
                            className="campo" value={rascunho.responsavel_id}
                            onChange={(e) => setRascunho({ ...rascunho, responsavel_id: e.target.value })}
                          >
                            <option value="">—</option>
                            {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                          </select>
                        ) : (
                          equipe.find((p) => p.id === t.responsavel_id)?.nome ?? '—'
                        )}
                      </td>
                      <td>
                        {emEdicao ? (
                          <select
                            className="campo" value={rascunho.etapa_id}
                            onChange={(e) => setRascunho({ ...rascunho, etapa_id: e.target.value })}
                          >
                            <option value="">—</option>
                            {etapas.map((e) => (
                              <option key={e.id} value={e.id}>{e.codigo} {e.nome}</option>
                            ))}
                          </select>
                        ) : (
                          etapas.find((e) => e.id === t.etapa_id)?.nome ?? '—'
                        )}
                      </td>
                      <td>
                        {emEdicao ? (
                          <select
                            className="campo" value={rascunho.status}
                            onChange={(e) => setRascunho({ ...rascunho, status: e.target.value })}
                          >
                            {STATUS_TAREFA.map((s) => (
                              <option key={s} value={s}>{ROTULO_STATUS(s)}</option>
                            ))}
                          </select>
                        ) : (
                          ROTULO_STATUS(t.status)
                        )}
                      </td>
                      <td className="num direita">
                        {emEdicao ? (
                          <input
                            type="number" min="0" max="100" className="campo num estreito"
                            value={rascunho.percentual_concluido}
                            onChange={(e) =>
                              setRascunho({ ...rascunho, percentual_concluido: e.target.value })}
                          />
                        ) : (
                          `${t.percentual_concluido}%`
                        )}
                      </td>
                      <td className="dado">
                        {emEdicao ? (
                          <input
                            type="date" className="campo dado estreito" value={rascunho.data_inicio_prev}
                            onChange={(e) =>
                              setRascunho({ ...rascunho, data_inicio_prev: e.target.value })}
                          />
                        ) : (
                          formatarData(t.data_inicio_prev)
                        )}
                      </td>
                      <td className="dado">
                        {emEdicao ? (
                          <input
                            type="date" className="campo dado estreito" value={rascunho.data_fim_prev}
                            onChange={(e) => setRascunho({ ...rascunho, data_fim_prev: e.target.value })}
                          />
                        ) : (
                          formatarData(t.data_fim_prev)
                        )}
                      </td>
                      <td className="acoes-linha">
                        {emEdicao ? (
                          <>
                            <button className="voltar" onClick={() => salvarLinha(t)} disabled={ocupado}>
                              salvar
                            </button>
                            <button
                              className="voltar"
                              onClick={() => { setEditando(null); setRascunho(null) }}
                            >
                              cancelar
                            </button>
                            <label className="marcador">
                              <input
                                type="checkbox" checked={rascunho.marco}
                                onChange={(e) =>
                                  setRascunho({
                                    ...rascunho,
                                    marco: e.target.checked,
                                    // Marco não tem duração; travar o campo é mais
                                    // honesto do que deixar digitar e o banco recusar.
                                    duracao_dias: e.target.checked ? '0' : rascunho.duracao_dias,
                                  })}
                              />
                              é marco
                            </label>
                            {!rascunho.marco && (
                              <input
                                type="number" min="0" className="campo num estreito"
                                placeholder="dias" value={rascunho.duracao_dias}
                                onChange={(e) =>
                                  setRascunho({ ...rascunho, duracao_dias: e.target.value })}
                              />
                            )}
                          </>
                        ) : possoMexer(t) ? (
                          <>
                            <button className="voltar" onClick={() => mover(t, -1)} disabled={ocupado}>↑</button>
                            <button className="voltar" onClick={() => mover(t, 1)} disabled={ocupado}>↓</button>
                            <button
                              className="voltar"
                              onClick={() => { setEditando(t.id); setRascunho(rascunhoDe(t)) }}
                              disabled={ocupado}
                            >
                              editar
                            </button>
                            {!soLeitura && (
                              <>
                                <button className="voltar" onClick={() => acrescentar(t)} disabled={ocupado}>
                                  + sub
                                </button>
                                <button className="voltar" onClick={() => excluir(t)} disabled={ocupado}>
                                  excluir
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="campo-vazio">leitura</span>
                        )}
                      </td>
                    </tr>

                    {aberta === t.id && (
                      <tr>
                        <td />
                        <td colSpan={8}>
                          <Detalhe
                            tarefa={t}
                            tarefas={tarefas}
                            itens={itens}
                            deps={deps}
                            equipe={equipe}
                            podeMexer={possoMexer(t)}
                            ocupado={ocupado}
                            textoNovo={textoNovo}
                            setTextoNovo={setTextoNovo}
                            novaDep={novaDep}
                            setNovaDep={setNovaDep}
                            minhaPessoaId={minhaPessoa?.id ?? null}
                            comOBanco={comOBanco}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/** Checklist e dependências de uma tarefa. */
function Detalhe({
  tarefa, tarefas, itens, deps, equipe, podeMexer, ocupado,
  textoNovo, setTextoNovo, novaDep, setNovaDep, minhaPessoaId, comOBanco,
}: {
  tarefa: Tarefa
  tarefas: Tarefa[]
  itens: ItemChecklist[]
  deps: Dependencia[]
  equipe: Pessoa[]
  podeMexer: boolean
  ocupado: boolean
  textoNovo: string
  setTextoNovo: (s: string) => void
  novaDep: { predecessora: string; tipo: string; folga: string }
  setNovaDep: (d: { predecessora: string; tipo: string; folga: string }) => void
  minhaPessoaId: string | null
  comOBanco: (acao: () => Promise<void>) => Promise<void>
}) {
  return (
    <div className="detalhe-tarefa">
      <div>
        <h3>Checklist</h3>
        {itens.length === 0 && <p className="campo-vazio">Nenhum item.</p>}
        <ul className="checklist">
          {itens.map((c) => (
            <li key={c.id}>
              <label className="marcador">
                <input
                  type="checkbox" checked={c.concluido} disabled={!podeMexer || ocupado}
                  onChange={(e) =>
                    comOBanco(() => marcarItemChecklist(c.id, e.target.checked, minhaPessoaId))}
                />
                <span className={c.concluido ? 'campo-vazio' : undefined}>{c.texto}</span>
              </label>
              {c.concluido && (
                <span className="marca-etapa">
                  {equipe.find((p) => p.id === c.concluido_por)?.nome ?? 'alguém'}
                  {c.concluido_em ? ` · ${formatarData(c.concluido_em.slice(0, 10))}` : ''}
                </span>
              )}
              {podeMexer && (
                <button
                  className="voltar" disabled={ocupado}
                  onClick={() => comOBanco(() => excluirItemChecklist(c.id))}
                >
                  remover
                </button>
              )}
            </li>
          ))}
        </ul>
        {podeMexer && (
          <p className="acoes">
            <input
              className="campo" placeholder="Novo item" value={textoNovo}
              onChange={(e) => setTextoNovo(e.target.value)}
            />
            <button
              className="botao" disabled={ocupado || textoNovo.trim() === ''}
              onClick={() =>
                comOBanco(async () => {
                  await criarItemChecklist(tarefa.id, textoNovo.trim(), itens.length)
                  setTextoNovo('')
                })}
            >
              Acrescentar
            </button>
          </p>
        )}
      </div>

      <div>
        <h3>Predecessoras</h3>
        <p className="ajuda">
          As datas não se movem por aqui: o motor que recalcula o cronograma é a Fase 2.
        </p>
        {deps.length === 0 && <p className="campo-vazio">Nenhuma.</p>}
        <ul className="checklist">
          {deps.map((d) => (
            <li key={d.id}>
              {tarefas.find((t) => t.id === d.predecessora_id)?.nome ?? '—'}
              <span className="marca-etapa">
                {TIPOS_DE_DEPENDENCIA.find((x) => x.codigo === d.tipo)?.nome ?? d.tipo}
                {d.folga_dias !== 0 && ` · folga ${d.folga_dias}d`}
              </span>
              {podeMexer && (
                <button
                  className="voltar" disabled={ocupado}
                  onClick={() => comOBanco(() => excluirDependencia(d.id))}
                >
                  remover
                </button>
              )}
            </li>
          ))}
        </ul>
        {podeMexer && (
          <p className="acoes">
            <select
              className="campo" value={novaDep.predecessora}
              onChange={(e) => setNovaDep({ ...novaDep, predecessora: e.target.value })}
            >
              <option value="">—</option>
              {tarefas.filter((t) => t.id !== tarefa.id).map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
            <select
              className="campo" value={novaDep.tipo}
              onChange={(e) => setNovaDep({ ...novaDep, tipo: e.target.value })}
            >
              {TIPOS_DE_DEPENDENCIA.map((x) => (
                <option key={x.codigo} value={x.codigo}>{x.nome}</option>
              ))}
            </select>
            <input
              type="number" className="campo num estreito" value={novaDep.folga}
              onChange={(e) => setNovaDep({ ...novaDep, folga: e.target.value })}
            />
            <button
              className="botao" disabled={ocupado || novaDep.predecessora === ''}
              onClick={() =>
                comOBanco(async () => {
                  await criarDependencia(
                    tarefa.id, novaDep.predecessora, novaDep.tipo, Number(novaDep.folga) || 0,
                  )
                  setNovaDep({ predecessora: '', tipo: 'TI', folga: '0' })
                })}
            >
              Ligar
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
