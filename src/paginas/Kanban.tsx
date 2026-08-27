import { useEffect, useState } from 'react'
import {
  camposDoTipo, carteiraDoTipo, etapasDoProjeto, fasesDoTipo, mudarFase,
  pareceresDoProjeto, setores as carregarSetores, tarefasDoProjeto,
  tiposDeProjeto, transicoesDaFase,
  ErroDoBanco,
  type CampoDefinicao, type Fase, type Projeto, type Setor, type TipoProjeto,
  type Transicao,
} from '../lib/banco'
import { ListaDePendencias } from '../componentes/Pendencias'
import { calcularPendencias, temPendencia, type Pendencias } from '../lib/pendencias'
import { guardarParametros, lerParametros } from '../lib/url'

/**
 * A carteira em colunas de fase.
 *
 * Um kanban precisa de um tipo escolhido, e isso não é detalhe de
 * implementação: tipos diferentes têm fases diferentes, então não existe um
 * quadro que sirva para todos. A tela diz isso em vez de escolher sozinha.
 *
 * Nenhum nome de fase aparece aqui. Coluna, cor, ordem, o que é permitido
 * soltar e o que a mudança vai cobrar saem todos de tipo_fase e
 * tipo_transicao.
 */

const SELO: Record<string, string> = {
  URGENTE: 'selo selo--urgente',
  IMPORTANTE: 'selo selo--importante',
  PLANEJAMENTO: 'selo selo--planejamento',
}

type Arrastando = { projeto: Projeto; transicoes: Transicao[] }

type Proposta = {
  projeto: Projeto
  transicao: Transicao
  faseDestino: Fase
  pend: Pendencias
  motivo: string
}

export function Kanban({ aoAbrir }: { aoAbrir: (id: string) => void }) {
  const [tipos, setTipos] = useState<TipoProjeto[]>([])
  const [tipoId, setTipoId] = useState<string>(lerParametros().tipo ?? '')
  const [fases, setFases] = useState<Fase[]>([])
  const [campos, setCampos] = useState<CampoDefinicao[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [listaSetores, setListaSetores] = useState<Setor[]>([])
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set())

  const [arrastando, setArrastando] = useState<Arrastando | null>(null)
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    Promise.all([tiposDeProjeto(), carregarSetores()])
      .then(([ts, ss]) => {
        setTipos(ts)
        setListaSetores(ss)
      })
      .catch((e: Error) => setErro(e.message))
  }, [])

  useEffect(() => {
    if (!tipoId) {
      setFases([])
      setProjetos([])
      return
    }
    let vivo = true
    setCarregando(true)
    Promise.all([fasesDoTipo(tipoId), camposDoTipo(tipoId), carteiraDoTipo(tipoId)])
      .then(([fs, cs, ps]) => {
        if (!vivo) return
        setFases(fs)
        setCampos(cs)
        setProjetos(ps)
        // A coluna de arquivados junta o histórico inteiro e encheria a tela.
        // Quem diz que ela é de arquivo é a categoria, não o nome.
        setRecolhidas(new Set(fs.filter((f) => f.categoria === 'ARQUIVADO').map((f) => f.id)))
      })
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [tipoId])

  function escolherTipo(id: string) {
    setTipoId(id)
    guardarParametros({ tipo: id })
  }

  async function comecarArraste(p: Projeto) {
    setErro(null)
    try {
      const ts = await transicoesDaFase(p.fase_id)
      setArrastando({ projeto: p, transicoes: ts })
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    }
  }

  /** A coluna aceita o cartão? Só se a transição existir em tipo_transicao. */
  function aceita(fase: Fase): boolean {
    if (!arrastando) return false
    return arrastando.transicoes.some((t) => t.para_fase_id === fase.id)
  }

  async function soltar(fase: Fase) {
    if (!arrastando) return
    const transicao = arrastando.transicoes.find((t) => t.para_fase_id === fase.id)
    const projeto = arrastando.projeto
    setArrastando(null)
    if (!transicao) return

    setOcupado(true)
    setErro(null)
    try {
      const faseAtual = fases.find((f) => f.id === projeto.fase_id)
      const pareceres = await pareceresDoProjeto(projeto.id)
      // Só se pergunta o que a fase de origem cobra.
      const [es, ts] = await Promise.all([
        faseAtual?.exige_orcamento ? etapasDoProjeto(projeto.id) : Promise.resolve(null),
        faseAtual?.exige_cronograma ? tarefasDoProjeto(projeto.id) : Promise.resolve(null),
      ])

      const pend = calcularPendencias({
        campos,
        fases,
        faseAtual,
        faseDestino: fase,
        valores: projeto.campos,
        pareceres,
        temOrcamento: es === null ? null : es.some((e) => e.folha && (e.valor ?? 0) > 0),
        cronogramaCompleto:
          ts === null
            ? null
            : ts.every(
                (t) =>
                  t.status === 'CANCELADA' ||
                  (t.data_inicio_prev !== null && t.data_fim_prev !== null),
              ),
      })

      if (temPendencia(pend) || transicao.exige_motivo) {
        setProposta({ projeto, transicao, faseDestino: fase, pend, motivo: '' })
        return
      }
      await mover(projeto, transicao, fase, '')
    } catch (e) {
      setErro(e instanceof ErroDoBanco ? e.mensagem : e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  async function mover(projeto: Projeto, transicao: Transicao, destino: Fase, motivo: string) {
    setOcupado(true)
    setErro(null)
    // Move o cartão na tela antes da resposta — e devolve se o banco recusar.
    const antes = projetos
    setProjetos((ps) =>
      ps.map((p) =>
        p.id === projeto.id
          ? { ...p, fase_id: destino.id, fase_nome: destino.nome, fase_ordem: destino.ordem }
          : p,
      ),
    )
    try {
      await mudarFase(projeto.id, transicao.para_fase_id, motivo.trim() || undefined)
      setProjetos(await carteiraDoTipo(tipoId))
      setProposta(null)
    } catch (e) {
      setProjetos(antes)
      setProposta(null)
      setErro(e instanceof ErroDoBanco ? e.mensagem : e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  if (tipos.length === 0 && !erro) return <p className="vazio">Carregando…</p>

  return (
    <>
      {erro && <div className="aviso">{erro}</div>}

      <p className="acoes">
        <label htmlFor="tipo-kanban">Tipo de projeto</label>
        <select
          id="tipo-kanban" className="campo" value={tipoId}
          onChange={(e) => escolherTipo(e.target.value)}
        >
          <option value="">escolha um tipo</option>
          {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </p>

      {!tipoId && (
        <p className="vazio">
          O quadro é por tipo: cada tipo de projeto tem as suas fases, então não existe um
          kanban que sirva para todos ao mesmo tempo. Escolha um tipo acima.
        </p>
      )}

      {tipoId && carregando && <p className="vazio">Carregando o quadro…</p>}

      {tipoId && !carregando && (
        <div className="kanban">
          {fases.map((f) => {
            const cartoes = projetos.filter((p) => p.fase_id === f.id)
            const recolhida = recolhidas.has(f.id)
            const podeSoltar = aceita(f)
            const origem = arrastando?.projeto.fase_id === f.id

            return (
              <section
                key={f.id}
                className={
                  'coluna' +
                  (recolhida ? ' coluna--recolhida' : '') +
                  (arrastando && podeSoltar ? ' coluna--aceita' : '') +
                  (arrastando && !podeSoltar && !origem ? ' coluna--recusa' : '')
                }
                onDragOver={(e) => {
                  if (podeSoltar) e.preventDefault()
                }}
                onDrop={() => soltar(f)}
              >
                <h2 style={{ borderTopColor: f.cor }}>
                  <button
                    className="voltar"
                    onClick={() =>
                      setRecolhidas((r) => {
                        const novo = new Set(r)
                        if (novo.has(f.id)) novo.delete(f.id)
                        else novo.add(f.id)
                        return novo
                      })}
                  >
                    {recolhida ? '▸' : '▾'}
                  </button>{' '}
                  {f.nome} <span className="conta">{cartoes.length}</span>
                </h2>

                {!recolhida &&
                  cartoes.map((p) => (
                    <article
                      key={p.id}
                      className="cartao"
                      draggable={!ocupado}
                      onDragStart={() => comecarArraste(p)}
                      onDragEnd={() => setArrastando(null)}
                      onClick={() => aoAbrir(p.id)}
                    >
                      <span className="dado codigo-projeto">{p.codigo}</span>
                      <strong>{p.nome}</strong>
                      <div className="selos">
                        <span className={SELO[p.prioridade]}>{p.prioridade}</span>
                        <span
                          className="dado pontos-total"
                          title={`${p.pontuacao_total} pontos nos criterios ativos — abra o projeto e clique em pontuar para ver criterio por criterio`}
                        >
                          {p.pontuacao_total} pts
                        </span>
                      </div>
                      <span className="campo-vazio">{p.gerente_nome ?? 'sem gerente'}</span>
                    </article>
                  ))}

                {!recolhida && cartoes.length === 0 && <p className="campo-vazio">vazia</p>}
              </section>
            )
          })}
        </div>
      )}

      {proposta && (
        <div className="aviso">
          <strong>
            {proposta.projeto.codigo} → {proposta.faseDestino.nome} ({proposta.transicao.rotulo})
          </strong>

          {temPendencia(proposta.pend) && (
            <>
              <p>O banco vai recusar enquanto faltar:</p>
              <ListaDePendencias
                pend={proposta.pend}
                fases={fases}
                setores={listaSetores}
                faseAtual={fases.find((f) => f.id === proposta.projeto.fase_id)}
              />
            </>
          )}

          {proposta.transicao.exige_motivo && (
            <p>
              <label htmlFor="motivo-kanban">Esta transição exige motivo</label>
              <br />
              <textarea
                id="motivo-kanban" className="campo" rows={2} value={proposta.motivo}
                onChange={(e) => setProposta({ ...proposta, motivo: e.target.value })}
              />
            </p>
          )}

          <p className="acoes">
            <button
              className="botao botao--acao"
              disabled={
                ocupado || (proposta.transicao.exige_motivo && proposta.motivo.trim() === '')
              }
              onClick={() =>
                mover(proposta.projeto, proposta.transicao, proposta.faseDestino, proposta.motivo)}
            >
              {temPendencia(proposta.pend) ? 'Mandar assim mesmo' : 'Mudar de fase'}
            </button>
            <button className="botao" onClick={() => setProposta(null)} disabled={ocupado}>
              Cancelar
            </button>
          </p>
        </div>
      )}
    </>
  )
}
