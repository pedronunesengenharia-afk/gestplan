import { useEffect, useState } from 'react'
import {
  atualizarProjeto, camposDoTipo, criarProjeto, empresas as carregarEmpresas,
  etapasDoProjeto, fasesDoTipo, mudarFase, pareceresDoProjeto,
  pessoas as carregarPessoas, projetoParaEdicao, rateioDoProjeto, salvarRateio,
  setores as carregarSetores, tarefasDoProjeto, tiposDeProjeto, transicoesDaFase,
  ErroDoBanco,
  type CampoDefinicao, type Empresa, type Fase, type Parecer, type Pessoa,
  type ProjetoEdicao, type Rateio, type Setor, type TipoProjeto, type Transicao,
} from '../lib/banco'
import { CamposDoTipo } from '../componentes/CamposDoTipo'
import { ListaDePendencias } from '../componentes/Pendencias'
import { calcularPendencias, temPendencia as temAlguma } from '../lib/pendencias'

/**
 * Criar e editar projeto.
 *
 * Tudo que varia entre tipos vem do banco: as fases de `tipo_fase`, as saídas
 * de `tipo_transicao`, os campos próprios de `campo_definicao`, os setores que
 * cobram parecer de `tipo_fase.exige_setores`. Esta tela não conhece o nome de
 * nenhum tipo, de nenhuma fase e de nenhum campo.
 */

const VAZIO: Partial<ProjetoEdicao> = {
  nome: '', seguranca: false, campos: {},
}

/**
 * De que campo o banco está falando.
 *
 * `app.validar_campos` fala de duas formas: a exigência de saída termina com o
 * código entre parênteses — "…: Situação atual (vi_situacao_atual)" — e as
 * demais começam com ele — "Campo vi_vida_util_anos espera número". A ordem
 * importa: a primeira tentativa cobre a mensagem que também começa com
 * "Campo", mas com uma palavra que não é código.
 */
export function codigoDoErro(mensagem: string): string | null {
  const noFim = mensagem.match(/\(([a-z][a-z0-9_]*)\)\s*$/)
  if (noFim) return noFim[1]
  const noComeco = mensagem.match(/^Campo ([a-z][a-z0-9_]*)[\s:,]/)
  if (noComeco) return noComeco[1]
  return null
}

export function EditarProjeto({
  id, aoSair,
}: {
  /** Nulo = projeto novo. */
  id: string | null
  aoSair: (idSalvo?: string) => void
}) {
  const [idAtual, setIdAtual] = useState<string | null>(id)
  const [dados, setDados] = useState<Partial<ProjetoEdicao>>(VAZIO)
  const [codigo, setCodigo] = useState<string | null>(null)

  const [tipos, setTipos] = useState<TipoProjeto[]>([])
  const [listaEmpresas, setListaEmpresas] = useState<Empresa[]>([])
  const [listaPessoas, setListaPessoas] = useState<Pessoa[]>([])
  const [listaSetores, setListaSetores] = useState<Setor[]>([])

  const [fases, setFases] = useState<Fase[]>([])
  const [campos, setCampos] = useState<CampoDefinicao[]>([])
  const [transicoes, setTransicoes] = useState<Transicao[]>([])
  const [pareceres, setPareceres] = useState<Parecer[]>([])
  const [rateio, setRateio] = useState<Rateio[]>([])
  // Só são consultados quando a fase de origem cobra orçamento ou cronograma.
  const [temOrcamento, setTemOrcamento] = useState<boolean | null>(null)
  const [cronogramaCompleto, setCronogramaCompleto] = useState<boolean | null>(null)

  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroTopo, setErroTopo] = useState<string | null>(null)
  const [recado, setRecado] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(true)

  const [transicaoEscolhida, setTransicaoEscolhida] = useState<string>('')
  const [motivo, setMotivo] = useState('')
  const [confirmarTransicao, setConfirmarTransicao] = useState(false)

  const criando = idAtual === null

  // Cadastros que a tela usa em qualquer modo.
  useEffect(() => {
    let vivo = true
    Promise.all([tiposDeProjeto(), carregarEmpresas(), carregarPessoas(), carregarSetores()])
      .then(([ts, es, ps, ss]) => {
        if (!vivo) return
        setTipos(ts)
        setListaEmpresas(es)
        setListaPessoas(ps)
        setListaSetores(ss)
      })
      .catch((e: Error) => vivo && setErroTopo(e.message))
    return () => {
      vivo = false
    }
  }, [])

  // O projeto, quando é edição.
  useEffect(() => {
    let vivo = true
    if (!id) {
      setCarregando(false)
      return
    }
    recarregar(id)
      .catch((e: Error) => vivo && setErroTopo(e.message))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [id])

  // O que depende do tipo escolhido: fases e campos próprios.
  useEffect(() => {
    let vivo = true
    const tipoId = dados.tipo_projeto_id
    if (!tipoId) {
      setFases([])
      setCampos([])
      return
    }
    Promise.all([fasesDoTipo(tipoId), camposDoTipo(tipoId)])
      .then(([fs, cs]) => {
        if (!vivo) return
        setFases(fs)
        setCampos(cs)
        // Projeto novo nasce na fase marcada como inicial — qual é ela, quem
        // diz é tipo_fase.
        setDados((d) =>
          d.fase_id ? d : { ...d, fase_id: fs.find((f) => f.inicial)?.id },
        )
      })
      .catch((e: Error) => vivo && setErroTopo(e.message))
    return () => {
      vivo = false
    }
  }, [dados.tipo_projeto_id])

  // As saídas da fase em que o projeto está.
  useEffect(() => {
    let vivo = true
    if (criando || !dados.fase_id) {
      setTransicoes([])
      return
    }
    transicoesDaFase(dados.fase_id)
      .then((ts) => vivo && setTransicoes(ts))
      .catch((e: Error) => vivo && setErroTopo(e.message))
    return () => {
      vivo = false
    }
  }, [dados.fase_id, criando])

  // Orçamento e cronograma da fase de origem: perguntados só se ela cobrar.
  useEffect(() => {
    let vivo = true
    const atual = fases.find((f) => f.id === dados.fase_id)
    if (!idAtual || !atual || (!atual.exige_orcamento && !atual.exige_cronograma)) {
      setTemOrcamento(null)
      setCronogramaCompleto(null)
      return
    }
    Promise.all([
      atual.exige_orcamento ? etapasDoProjeto(idAtual) : Promise.resolve(null),
      atual.exige_cronograma ? tarefasDoProjeto(idAtual) : Promise.resolve(null),
    ])
      .then(([es, ts]) => {
        if (!vivo) return
        setTemOrcamento(es === null ? null : es.some((e) => e.folha && (e.valor ?? 0) > 0))
        setCronogramaCompleto(
          ts === null
            ? null
            : ts.every(
                (t) =>
                  t.status === 'CANCELADA' ||
                  (t.data_inicio_prev !== null && t.data_fim_prev !== null),
              ),
        )
      })
      .catch((e: Error) => vivo && setErroTopo(e.message))
    return () => {
      vivo = false
    }
  }, [idAtual, dados.fase_id, fases])

  /**
   * Relê do banco. Os triggers mexem em codigo, numero, pontuacao_total,
   * prioridade e data_fase — confiar no estado local depois de salvar seria
   * mostrar uma versão que não existe.
   */
  async function recarregar(projetoId: string) {
    const [p, r, par] = await Promise.all([
      projetoParaEdicao(projetoId),
      rateioDoProjeto(projetoId),
      pareceresDoProjeto(projetoId),
    ])
    if (!p) {
      setErroTopo('Este projeto não existe ou você não alcança ele.')
      return
    }
    setDados(p)
    setCodigo(p.codigo)
    setRateio(r)
    setPareceres(par)
  }

  function mudarCampo<C extends keyof ProjetoEdicao>(campo: C, valor: ProjetoEdicao[C]) {
    setDados((d) => ({ ...d, [campo]: valor }))
  }

  /** Espalha o erro do banco: no campo que o causou, ou no topo. */
  function mostrarErro(e: unknown) {
    if (e instanceof ErroDoBanco) {
      const codigoDoCampo = codigoDoErro(e.mensagem)
      // Confere contra a lista real de campos: "Campo inexistente para este
      // tipo de projeto: foo" também casa com o padrão, e "inexistente" não é
      // campo nenhum — erro assim vai para o topo, onde se lê inteiro.
      if (codigoDoCampo && campos.some((c) => c.codigo === codigoDoCampo)) {
        setErros({ [codigoDoCampo]: e.mensagem })
        setErroTopo(null)
        return
      }
      setErroTopo(e.mensagem)
      return
    }
    setErroTopo(e instanceof Error ? e.message : String(e))
  }

  const totalRateio = rateio.reduce((t, l) => t + (Number(l.percentual) || 0), 0)
  const rateioFecha = rateio.length === 0 || Math.abs(totalRateio - 100) < 0.001

  async function salvar() {
    setSalvando(true)
    setErros({})
    setErroTopo(null)
    setRecado(null)
    try {
      const carga: Partial<ProjetoEdicao> = {
        nome: dados.nome,
        gerente_id: dados.gerente_id || null,
        solicitante_id: dados.solicitante_id || null,
        setor: dados.setor || null,
        frente: dados.frente || null,
        seguranca: dados.seguranca ?? false,
        descricao: dados.descricao || null,
        objetivo: dados.objetivo || null,
        problema: dados.problema || null,
        beneficios: dados.beneficios || null,
        local: dados.local || null,
        cidade: dados.cidade || null,
        uf: dados.uf || null,
        data_inicio_prev: dados.data_inicio_prev || null,
        data_fim_prev: dados.data_fim_prev || null,
        campos: dados.campos ?? {},
      }

      let alvo = idAtual
      if (alvo) {
        await atualizarProjeto(alvo, carga)
      } else {
        // Só na criação vão tipo, empresa e fase: depois eles não mudam por
        // aqui — fase anda por transição, tipo e empresa não andam.
        alvo = await criarProjeto({
          ...carga,
          tipo_projeto_id: dados.tipo_projeto_id,
          empresa_id: dados.empresa_id,
          fase_id: dados.fase_id,
        })
        // Marcar o id ANTES de qualquer outra coisa: se o rateio falhar, o
        // segundo clique edita o projeto que nasceu em vez de criar outro.
        setIdAtual(alvo)
      }

      await salvarRateio(alvo, rateio)
      await recarregar(alvo)
      setRecado('Salvo.')
    } catch (e) {
      mostrarErro(e)
    } finally {
      setSalvando(false)
    }
  }

  const faseAtual = fases.find((f) => f.id === dados.fase_id)
  const transicao = transicoes.find((t) => t.id === transicaoEscolhida)
  const faseDestino = transicao ? fases.find((f) => f.id === transicao.para_fase_id) : undefined

  // O mesmo cálculo que o kanban e a avaliação fazem — em lib/pendencias.
  const pend = calcularPendencias({
    campos,
    fases,
    faseAtual,
    faseDestino,
    valores: dados.campos,
    pareceres,
    temOrcamento,
    cronogramaCompleto,
  })
  const temPendencia = temAlguma(pend)

  async function avancar() {
    if (!transicao || !idAtual) return
    if (temPendencia && !confirmarTransicao) {
      setConfirmarTransicao(true)
      return
    }
    setSalvando(true)
    setErros({})
    setErroTopo(null)
    setRecado(null)
    try {
      await mudarFase(idAtual, transicao.para_fase_id, motivo.trim() || undefined)
      await recarregar(idAtual)
      setTransicaoEscolhida('')
      setMotivo('')
      setConfirmarTransicao(false)
      setRecado(`Projeto movido para ${faseDestino?.nome}.`)
    } catch (e) {
      mostrarErro(e)
      setConfirmarTransicao(false)
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <p className="vazio">Carregando…</p>

  const podeSalvar =
    !salvando &&
    Boolean(dados.nome?.trim()) &&
    Boolean(dados.tipo_projeto_id) &&
    Boolean(dados.empresa_id) &&
    rateioFecha

  return (
    <>
      <button className="voltar" onClick={() => aoSair(idAtual ?? undefined)}>
        ← {criando ? 'Carteira' : 'Projeto'}
      </button>

      <header className="cabecalho-pagina">
        <div className="titulo-projeto">
          {codigo && <span className="dado codigo-projeto">{codigo}</span>}
          <h1>{criando ? 'Novo projeto' : dados.nome}</h1>
        </div>
        <p>
          {criando
            ? 'O código sai do banco quando salvar, com o prefixo da empresa.'
            : `Em ${faseAtual?.nome ?? '—'}`}
        </p>
      </header>

      {erroTopo && <div className="aviso">{erroTopo}</div>}
      {recado && <div className="aviso aviso--ok">{recado}</div>}

      <section className="secao">
        <h2>Identificação</h2>
        <dl className="campos">
          <div className="campo-linha campo-largo">
            <dt><label htmlFor="nome">Nome</label></dt>
            <dd>
              <input
                id="nome" className="campo" type="text" value={dados.nome ?? ''}
                onChange={(e) => mudarCampo('nome', e.target.value)}
              />
            </dd>
          </div>

          <div className="campo-linha">
            <dt><label htmlFor="tipo">Tipo de projeto</label></dt>
            <dd>
              <select
                id="tipo" className="campo" value={dados.tipo_projeto_id ?? ''}
                disabled={!criando}
                onChange={(e) => setDados((d) => ({
                  ...d, tipo_projeto_id: e.target.value, fase_id: undefined, campos: {},
                }))}
              >
                <option value="">—</option>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              {!criando && (
                <p className="ajuda">
                  O tipo não muda depois de criado: ele define as fases, os campos próprios e
                  as regras que o projeto já percorreu.
                </p>
              )}
            </dd>
          </div>

          <div className="campo-linha">
            <dt><label htmlFor="empresa">Empresa principal</label></dt>
            <dd>
              <select
                id="empresa" className="campo" value={dados.empresa_id ?? ''}
                disabled={!criando}
                onChange={(e) => mudarCampo('empresa_id', e.target.value)}
              >
                <option value="">—</option>
                {listaEmpresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
              {!criando && (
                <p className="ajuda">
                  A empresa não muda depois de criada: o código {codigo} carrega o prefixo dela
                  e a numeração é por empresa e ano.
                </p>
              )}
            </dd>
          </div>

          {criando && faseAtual && (
            <div className="campo-linha">
              <dt>Fase inicial</dt>
              <dd>{faseAtual.nome}</dd>
            </div>
          )}

          <div className="campo-linha">
            <dt><label htmlFor="gerente">Gerente</label></dt>
            <dd>
              <select
                id="gerente" className="campo" value={dados.gerente_id ?? ''}
                onChange={(e) => mudarCampo('gerente_id', e.target.value || null)}
              >
                <option value="">—</option>
                {listaPessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </dd>
          </div>

          <div className="campo-linha">
            <dt><label htmlFor="solicitante">Solicitante</label></dt>
            <dd>
              <select
                id="solicitante" className="campo" value={dados.solicitante_id ?? ''}
                onChange={(e) => mudarCampo('solicitante_id', e.target.value || null)}
              >
                <option value="">—</option>
                {listaPessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </dd>
          </div>

          <div className="campo-linha">
            <dt><label htmlFor="setor">Setor</label></dt>
            <dd>
              <input
                id="setor" className="campo" type="text" value={dados.setor ?? ''}
                onChange={(e) => mudarCampo('setor', e.target.value)}
              />
            </dd>
          </div>

          <div className="campo-linha">
            <dt><label htmlFor="frente">Frente</label></dt>
            <dd>
              <input
                id="frente" className="campo" type="text" value={dados.frente ?? ''}
                onChange={(e) => mudarCampo('frente', e.target.value)}
              />
            </dd>
          </div>

          <div className="campo-linha">
            <dt>Segurança do trabalho</dt>
            <dd>
              <label className="marcador">
                <input
                  type="checkbox" checked={dados.seguranca ?? false}
                  onChange={(e) => mudarCampo('seguranca', e.target.checked)}
                />
                {dados.seguranca ? 'Sim' : 'Não'}
              </label>
            </dd>
          </div>

          <div className="campo-linha">
            <dt><label htmlFor="local">Local</label></dt>
            <dd>
              <input
                id="local" className="campo" type="text" value={dados.local ?? ''}
                onChange={(e) => mudarCampo('local', e.target.value)}
              />
            </dd>
          </div>

          <div className="campo-linha">
            <dt><label htmlFor="cidade">Cidade</label></dt>
            <dd>
              <input
                id="cidade" className="campo" type="text" value={dados.cidade ?? ''}
                onChange={(e) => mudarCampo('cidade', e.target.value)}
              />
            </dd>
          </div>

          <div className="campo-linha">
            <dt><label htmlFor="uf">UF</label></dt>
            <dd>
              <input
                id="uf" className="campo" type="text" maxLength={2} value={dados.uf ?? ''}
                onChange={(e) => mudarCampo('uf', e.target.value.toUpperCase())}
              />
            </dd>
          </div>

          <div className="campo-linha">
            <dt><label htmlFor="inicio">Início previsto</label></dt>
            <dd>
              <input
                id="inicio" className="campo dado" type="date"
                value={dados.data_inicio_prev ?? ''}
                onChange={(e) => mudarCampo('data_inicio_prev', e.target.value || null)}
              />
            </dd>
          </div>

          <div className="campo-linha">
            <dt><label htmlFor="fim">Fim previsto</label></dt>
            <dd>
              <input
                id="fim" className="campo dado" type="date"
                value={dados.data_fim_prev ?? ''}
                onChange={(e) => mudarCampo('data_fim_prev', e.target.value || null)}
              />
            </dd>
          </div>
        </dl>
      </section>

      <section className="secao">
        <h2>Descrição</h2>
        <dl className="campos">
          {([
            ['descricao', 'Descrição'],
            ['objetivo', 'Objetivo'],
            ['problema', 'Problema'],
            ['beneficios', 'Benefícios'],
          ] as const).map(([campo, rotulo]) => (
            <div className="campo-linha campo-largo" key={campo}>
              <dt><label htmlFor={campo}>{rotulo}</label></dt>
              <dd>
                <textarea
                  id={campo} className="campo" rows={3} value={dados[campo] ?? ''}
                  onChange={(e) => mudarCampo(campo, e.target.value)}
                />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {dados.tipo_projeto_id && (
        <CamposDoTipo
          tipoProjetoId={dados.tipo_projeto_id}
          valores={dados.campos ?? {}}
          aoMudar={(novos) => setDados((d) => ({ ...d, campos: novos }))}
          faseAtualId={dados.fase_id}
          erros={erros}
        />
      )}

      <section className="secao">
        <h2>
          Rateio entre empresas
          <span className="conta">
            {rateio.length === 0 ? 'sem divisão' : `${totalRateio.toLocaleString('pt-BR')}%`}
          </span>
        </h2>

        {rateio.length === 0 ? (
          <p className="vazio">
            Sem linha nenhuma, o projeto é 100% da empresa principal. Acrescente linhas só
            quando o custo for dividido.
          </p>
        ) : (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th className="direita">Percentual</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rateio.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <select
                        className="campo" value={l.empresa_id}
                        onChange={(e) => setRateio((r) =>
                          r.map((x, j) => (j === i ? { ...x, empresa_id: e.target.value } : x)))}
                      >
                        <option value="">—</option>
                        {listaEmpresas.map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td className="direita">
                      <input
                        className="campo num" type="number" step="0.001" min="0.001" max="100"
                        value={l.percentual}
                        onChange={(e) => setRateio((r) =>
                          r.map((x, j) => (j === i ? { ...x, percentual: Number(e.target.value) } : x)))}
                      />
                    </td>
                    <td>
                      <button
                        className="voltar"
                        onClick={() => setRateio((r) => r.filter((_, j) => j !== i))}
                      >
                        remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className={rateioFecha ? 'num direita' : 'num direita total-errado'}>
                    {totalRateio.toLocaleString('pt-BR')}%
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!rateioFecha && (
          <div className="aviso">
            O rateio precisa fechar 100% — falta {(100 - totalRateio).toLocaleString('pt-BR')}%.
            O banco recusa a gravação enquanto não fechar.
          </div>
        )}

        <p>
          <button
            className="botao"
            onClick={() => setRateio((r) => [...r, { empresa_id: '', percentual: 0, observacao: null }])}
          >
            Acrescentar empresa
          </button>
        </p>
      </section>

      <p className="acoes">
        <button className="botao botao--acao" onClick={salvar} disabled={!podeSalvar}>
          {salvando ? 'Salvando…' : criando ? 'Criar projeto' : 'Salvar'}
        </button>
        <button className="botao" onClick={() => aoSair(idAtual ?? undefined)} disabled={salvando}>
          Fechar
        </button>
      </p>

      {!criando && transicoes.length > 0 && (
        <section className="secao">
          <h2>Mudar de fase</h2>
          <p className="ajuda">
            De <strong>{faseAtual?.nome}</strong>. As saídas abaixo são as declaradas em
            tipo_transicao — não há outras.
          </p>

          <dl className="campos">
            <div className="campo-linha">
              <dt><label htmlFor="transicao">Para onde</label></dt>
              <dd>
                <select
                  id="transicao" className="campo" value={transicaoEscolhida}
                  onChange={(e) => {
                    setTransicaoEscolhida(e.target.value)
                    setConfirmarTransicao(false)
                  }}
                >
                  <option value="">—</option>
                  {transicoes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.rotulo} → {fases.find((f) => f.id === t.para_fase_id)?.nome}
                    </option>
                  ))}
                </select>
              </dd>
            </div>

            {transicao?.exige_motivo && (
              <div className="campo-linha campo-largo">
                <dt><label htmlFor="motivo">Motivo</label></dt>
                <dd>
                  <textarea
                    id="motivo" className="campo" rows={2} value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                  <p className="ajuda">Esta transição exige motivo; ele fica no histórico de fase.</p>
                </dd>
              </div>
            )}
          </dl>

          {transicao && temPendencia && (
            <div className="aviso">
              <strong>O banco vai recusar esta mudança enquanto faltar:</strong>
              <ListaDePendencias
                pend={pend} fases={fases} setores={listaSetores} faseAtual={faseAtual}
              />
              {confirmarTransicao
                ? 'Clique de novo para mandar assim mesmo e ver o que o banco responde.'
                : 'Preencha o que falta, ou clique para tentar mesmo assim.'}
            </div>
          )}

          {transicao && !temPendencia && (
            <p className="ajuda">Nada pendente: esta mudança deve passar.</p>
          )}

          <p className="acoes">
            <button
              className="botao"
              onClick={avancar}
              disabled={
                salvando ||
                !transicao ||
                (transicao.exige_motivo && motivo.trim() === '')
              }
            >
              {confirmarTransicao ? 'Mandar assim mesmo' : 'Mudar de fase'}
            </button>
          </p>
        </section>
      )}
    </>
  )
}
