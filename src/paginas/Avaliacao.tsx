import { useEffect, useState } from 'react'
import {
  camposDoTipo, etapasDoProjeto, eu as carregarEu, fasesDoTipo, mudarFase,
  pareceresDoProjeto, pessoas as carregarPessoas, possoAssinar,
  projeto as carregarProjeto, registrarParecer, setores as carregarSetores,
  tarefasDoProjeto, transicoesDaFase,
  ErroDoBanco, DECISOES,
  type CampoDefinicao, type Fase, type Parecer, type Pessoa,
  type Projeto as ProjetoDado, type Setor, type Transicao,
} from '../lib/banco'
import { ListaDePendencias } from '../componentes/Pendencias'
import { calcularPendencias, temPendencia } from '../lib/pendencias'
import { data as formatarData } from '../lib/formato'

/**
 * A avaliação da fase: quem já se pronunciou e o que falta para avançar.
 *
 * Os setores que a fase cobra saem de `tipo_fase.exige_setores`; os nomes, da
 * tabela `setor`. Nenhum código de setor aparece escrito aqui.
 *
 * O que o banco exige de cada decisão está em CHECK — parecer escrito em
 * REPROVADO, data em POSTERGADO — e a tela cobra antes, para a pessoa não
 * descobrir a regra levando um erro na cara depois de escrever tudo.
 */

export function Avaliacao({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const [projeto, setProjeto] = useState<ProjetoDado | null>(null)
  const [fases, setFases] = useState<Fase[]>([])
  const [campos, setCampos] = useState<CampoDefinicao[]>([])
  const [pareceres, setPareceres] = useState<Parecer[]>([])
  const [listaSetores, setListaSetores] = useState<Setor[]>([])
  const [equipe, setEquipe] = useState<Pessoa[]>([])
  const [transicoes, setTransicoes] = useState<Transicao[]>([])
  const [minhaPessoaId, setMinhaPessoaId] = useState<string | null>(null)
  const [temOrcamento, setTemOrcamento] = useState<boolean | null>(null)
  const [cronogramaCompleto, setCronogramaCompleto] = useState<boolean | null>(null)
  const [podeAssinarProjeto, setPodeAssinarProjeto] = useState(false)

  const [setorEmFoco, setSetorEmFoco] = useState<string>('')
  const [decisao, setDecisao] = useState<string>('CIENTE')
  const [texto, setTexto] = useState('')
  const [retorno, setRetorno] = useState('')

  const [erro, setErro] = useState<string | null>(null)
  const [recado, setRecado] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    const buscar = async () => {
      const p = await carregarProjeto(id)
      if (!vivo) return
      setProjeto(p)
      if (!p) return

      const [fs, cs, par, ss, gente, quemSouEu, ts, assina] = await Promise.all([
        fasesDoTipo(p.tipo_projeto_id),
        camposDoTipo(p.tipo_projeto_id),
        pareceresDoProjeto(id),
        carregarSetores(),
        carregarPessoas(),
        carregarEu(),
        transicoesDaFase(p.fase_id),
        possoAssinar(id),
      ])
      if (!vivo) return
      setPodeAssinarProjeto(assina)
      setFases(fs)
      setCampos(cs)
      setPareceres(par)
      setListaSetores(ss)
      setEquipe(gente)
      setMinhaPessoaId(quemSouEu?.id ?? null)
      setTransicoes(ts)

      const atual = fs.find((f) => f.id === p.fase_id)
      const [es, tsk] = await Promise.all([
        atual?.exige_orcamento ? etapasDoProjeto(id) : Promise.resolve(null),
        atual?.exige_cronograma ? tarefasDoProjeto(id) : Promise.resolve(null),
      ])
      if (!vivo) return
      setTemOrcamento(es === null ? null : es.some((e) => e.folha && (e.valor ?? 0) > 0))
      setCronogramaCompleto(
        tsk === null
          ? null
          : tsk.every(
              (t) =>
                t.status === 'CANCELADA' ||
                (t.data_inicio_prev !== null && t.data_fim_prev !== null),
            ),
      )
    }
    buscar()
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [id])

  async function recarregar() {
    const [p, par] = await Promise.all([carregarProjeto(id), pareceresDoProjeto(id)])
    setProjeto(p)
    setPareceres(par)
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

  const faseAtual = fases.find((f) => f.id === projeto.fase_id)
  const daFase = pareceres.filter((p) => p.fase_id === projeto.fase_id)
  const cobrados = faseAtual?.exige_setores ?? []
  const nomeDoSetor = (cod: string) => listaSetores.find((s) => s.codigo === cod)?.nome ?? cod
  const reprovou = daFase.find((p) => p.decisao === 'REPROVADO') ?? null

  // Avançar é ir para a fase de ordem maior mais próxima — quem diz isso é a
  // ordem, que é dado; e arquivar é a transição cujo destino é da categoria
  // ARQUIVADO.
  const destinoDe = (t: Transicao) => fases.find((f) => f.id === t.para_fase_id)
  const avancar = transicoes
    .filter((t) => (destinoDe(t)?.ordem ?? 0) > (faseAtual?.ordem ?? 0))
    .sort((a, b) => (destinoDe(a)?.ordem ?? 0) - (destinoDe(b)?.ordem ?? 0))[0]
  const arquivar = transicoes.find((t) => destinoDe(t)?.categoria === 'ARQUIVADO')

  const pend = calcularPendencias({
    campos,
    fases,
    faseAtual,
    faseDestino: avancar ? destinoDe(avancar) : undefined,
    valores: projeto.campos,
    pareceres,
    temOrcamento,
    cronogramaCompleto,
  })

  // O que cada decisão obriga, do CHECK da tabela.
  const faltaTexto = decisao === 'REPROVADO' && texto.trim() === ''
  const faltaData = decisao === 'POSTERGADO' && retorno === ''
  const podeAssinar =
    podeAssinarProjeto && setorEmFoco !== '' && !faltaTexto && !faltaData && !ocupado

  async function assinar() {
    setOcupado(true)
    setErro(null)
    setRecado(null)
    try {
      await registrarParecer({
        projeto_id: id,
        fase_id: projeto!.fase_id,
        setor_codigo: setorEmFoco,
        pessoa_id: minhaPessoaId,
        decisao,
        parecer: texto.trim() || null,
        postergado_para: decisao === 'POSTERGADO' ? retorno : null,
      })
      await recarregar()
      setRecado(`Parecer de ${nomeDoSetor(setorEmFoco)} registrado.`)
      setSetorEmFoco('')
      setTexto('')
      setRetorno('')
    } catch (e) {
      setErro(e instanceof ErroDoBanco ? e.mensagem : e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  async function arquivarProjeto() {
    if (!arquivar) return
    const motivo = window.prompt(
      `Arquivar ${projeto!.codigo}. O motivo fica no histórico de fase:`,
      reprovou ? `Reprovado por ${nomeDoSetor(reprovou.setor_codigo)}` : '',
    )
    if (motivo === null) return
    setOcupado(true)
    setErro(null)
    try {
      await mudarFase(id, arquivar.para_fase_id, motivo || undefined)
      await recarregar()
      setRecado('Projeto arquivado.')
    } catch (e) {
      setErro(e instanceof ErroDoBanco ? e.mensagem : e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <button className="voltar" onClick={aoVoltar}>← Projeto</button>

      <header className="cabecalho-pagina">
        <div className="titulo-projeto">
          <span className="dado codigo-projeto">{projeto.codigo}</span>
          <h1>Avaliação</h1>
        </div>
        <p>
          {projeto.nome} · em {faseAtual?.nome ?? '—'}
          {cobrados.length === 0 && ' · esta fase não pede parecer de setor nenhum'}
        </p>
      </header>

      {erro && <div className="aviso">{erro}</div>}
      {recado && <div className="aviso aviso--ok">{recado}</div>}

      {reprovou && (
        <div className="aviso">
          <strong>{nomeDoSetor(reprovou.setor_codigo)} reprovou o projeto nesta fase.</strong>
          <p>
            Enquanto o parecer estiver de pé, o banco recusa qualquer avanço — a saída que o
            modelo prevê é arquivar.
          </p>
          {reprovou.parecer && <p className="justificativa">{reprovou.parecer}</p>}
          {arquivar && (
            <p className="acoes">
              <button className="botao" onClick={arquivarProjeto} disabled={ocupado}>
                {arquivar.rotulo}
              </button>
            </p>
          )}
        </div>
      )}

      {cobrados.length > 0 && (
        <section className="secao">
          <h2>
            Setores que {faseAtual?.nome} exige <span className="conta">{cobrados.length}</span>
          </h2>
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Setor</th>
                  <th>Decisão</th>
                  <th>Quem</th>
                  <th>Quando</th>
                  <th>Parecer</th>
                </tr>
              </thead>
              <tbody>
                {cobrados.map((cod) => {
                  const p = daFase.find((x) => x.setor_codigo === cod)
                  return (
                    <tr key={cod} className={p ? undefined : 'linha-inativa'}>
                      <td>{nomeDoSetor(cod)}</td>
                      <td>{p ? p.decisao.toLowerCase() : 'sem parecer'}</td>
                      <td>
                        {p
                          ? equipe.find((q) => q.id === p.pessoa_id)?.nome ??
                            (p.pessoa_id ? '—' : 'não registrado')
                          : '—'}
                      </td>
                      <td className="dado">{p ? formatarData(p.em.slice(0, 10)) : '—'}</td>
                      <td className="justificativa">{p?.parecer ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="secao">
        <h2>Registrar parecer</h2>
        {!podeAssinarProjeto && (
          <p className="ajuda">
            Assinar parecer é do papel AVALIADOR, e do proprietário. Quem o banco deixa assinar
            é decidido por <code>app.pode_assinar</code> — esta tela só pergunta.
          </p>
        )}
        <dl className="campos">
          <div className="campo-linha">
            <dt><label htmlFor="setor">Setor</label></dt>
            <dd>
              <select
                id="setor" className="campo" value={setorEmFoco}
                onChange={(e) => setSetorEmFoco(e.target.value)}
              >
                <option value="">—</option>
                {/* Os que a fase cobra primeiro; os demais continuam possíveis,
                    porque parecer voluntário é informação, não erro. */}
                {[...cobrados, ...listaSetores.map((s) => s.codigo).filter((c) => !cobrados.includes(c))]
                  .map((c) => (
                    <option key={c} value={c}>
                      {nomeDoSetor(c)}{cobrados.includes(c) ? '' : ' (não exigido nesta fase)'}
                    </option>
                  ))}
              </select>
            </dd>
          </div>

          <div className="campo-linha">
            <dt><label htmlFor="decisao">Decisão</label></dt>
            <dd>
              <select
                id="decisao" className="campo" value={decisao}
                onChange={(e) => setDecisao(e.target.value)}
              >
                {DECISOES.map((d) => (
                  <option key={d} value={d}>{d.toLowerCase()}</option>
                ))}
              </select>
            </dd>
          </div>

          {decisao === 'POSTERGADO' && (
            <div className="campo-linha">
              <dt><label htmlFor="retorno">Voltar a olhar em</label></dt>
              <dd>
                <input
                  id="retorno" type="date" className="campo dado" value={retorno}
                  onChange={(e) => setRetorno(e.target.value)}
                />
                {faltaData && <p className="erro-campo">Postergar exige a data de retorno.</p>}
              </dd>
            </div>
          )}

          <div className="campo-linha campo-largo">
            <dt><label htmlFor="texto">Parecer</label></dt>
            <dd>
              <textarea
                id="texto" className="campo" rows={3} value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              {faltaTexto && (
                <p className="erro-campo">
                  Reprovar exige o parecer escrito: quem recebe a recusa precisa saber por quê.
                </p>
              )}
            </dd>
          </div>
        </dl>

        <p className="acoes">
          <button className="botao botao--acao" onClick={assinar} disabled={!podeAssinar}>
            {ocupado ? 'Registrando…' : 'Registrar parecer'}
          </button>
        </p>
      </section>

      <section className="secao">
        <h2>O que falta para avançar</h2>
        {!avancar ? (
          <p className="campo-vazio">
            Não há transição de avanço a partir de {faseAtual?.nome}.
          </p>
        ) : temPendencia(pend) ? (
          <>
            <p>
              Para {avancar.rotulo.toLowerCase()} para{' '}
              <strong>{destinoDe(avancar)?.nome}</strong>, o banco vai cobrar:
            </p>
            <ListaDePendencias
              pend={pend} fases={fases} setores={listaSetores} faseAtual={faseAtual}
            />
          </>
        ) : (
          <p className="ajuda">
            Nada pendente: {avancar.rotulo.toLowerCase()} para {destinoDe(avancar)?.nome} deve
            passar.
          </p>
        )}
      </section>

      {pareceres.length > daFase.length && (
        <section className="secao">
          <h2>
            Pareceres de fases anteriores
            <span className="conta">{pareceres.length - daFase.length}</span>
          </h2>
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Fase</th>
                  <th>Setor</th>
                  <th>Decisão</th>
                  <th>Quando</th>
                </tr>
              </thead>
              <tbody>
                {pareceres
                  .filter((p) => p.fase_id !== projeto.fase_id)
                  .map((p) => (
                    <tr key={p.id}>
                      <td>{fases.find((f) => f.id === p.fase_id)?.nome ?? '—'}</td>
                      <td>{nomeDoSetor(p.setor_codigo)}</td>
                      <td>{p.decisao.toLowerCase()}</td>
                      <td className="dado">{formatarData(p.em.slice(0, 10))}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
