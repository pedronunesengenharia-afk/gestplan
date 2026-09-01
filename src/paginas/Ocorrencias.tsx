import { useEffect, useState } from 'react'
import {
  atualizarOcorrencia, criarOcorrencia, excluirOcorrencia, GRAUS,
  ocorrenciasDoProjeto, pessoasDoProjeto, possoEditarProjeto, PROBABILIDADES,
  projeto as carregarProjeto, SITUACOES_OCORRENCIA, TIPOS_OCORRENCIA,
  type Ocorrencia, type Pessoa, type Projeto,
} from '../lib/banco'
import { EsqueletoDeTabela } from '../componentes/Esqueleto'
import { CabecalhoImpresso, BotaoImprimir } from '../componentes/Imprimir'
import { data as formatarData } from '../lib/formato'

/**
 * O registro de ocorrências do projeto: o que aconteceu e o que se faz a
 * respeito.
 *
 * Não é o registro de decisões, que é outra tela. A diferença não é de arrumação
 * — é de uso: ocorrência NASCE ABERTA e precisa ser fechada, então esta tela
 * serve para cobrar. Decisão não fica pendente, e a tela dela serve para
 * lembrar por quê.
 *
 * Por isso o que salta aqui é a situação e o que está em aberto há mais tempo,
 * e não a ordem cronológica pura.
 */

const ROTULO_TIPO: Record<string, string> = {
  NOTA: 'nota', RISCO: 'risco', PROBLEMA: 'problema',
  REUNIAO: 'reunião', PARALISACAO: 'paralisação',
}
const ROTULO_SITUACAO: Record<string, string> = {
  ABERTA: 'aberta', EM_TRATATIVA: 'em tratativa',
  RESOLVIDA: 'resolvida', ACEITA: 'aceita',
}
const ENCERRADA = ['RESOLVIDA', 'ACEITA']
const HOJE = new Date().toISOString().slice(0, 10)

const VAZIA = {
  data: HOJE, tipo: 'PROBLEMA', titulo: '', descricao: '',
  impacto: '', probabilidade: '', responsavel_id: '',
}

export function Ocorrencias({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const [projeto, setProjeto] = useState<Projeto | null>(null)
  const [lista, setLista] = useState<Ocorrencia[]>([])
  const [equipe, setEquipe] = useState<Pessoa[]>([])
  const [soLeitura, setSoLeitura] = useState(true)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [abrindo, setAbrindo] = useState(false)
  const [rascunho, setRascunho] = useState({ ...VAZIA })
  const [verEncerradas, setVerEncerradas] = useState(false)

  useEffect(() => {
    let vivo = true
    // O PROJETO VEM PRIMEIRO, SOZINHO. Com tudo num `Promise.all`, uma carga
    // que falha derruba as outras e `projeto` fica nulo — e a tela passa a
    // dizer "este projeto nao existe", que e mentira. Medido: a tabela
    // `decisao` ainda nao existia em producao e a tela culpou o projeto.
    const buscar = async () => {
      const p = await carregarProjeto(id)
      if (!vivo) return
      setProjeto(p)
      if (!p) return

      const [os, gente, podeEditar] = await Promise.all([
        ocorrenciasDoProjeto(id),
        pessoasDoProjeto(id),
        possoEditarProjeto(id),
      ])
      if (!vivo) return
      setLista(os)
      setEquipe(gente)
      setSoLeitura(!podeEditar)
    }

    buscar()
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => {
        if (vivo) setCarregando(false)
      })

    return () => {
      vivo = false
    }
  }, [id])

  async function comOBanco(acao: () => Promise<void>) {
    setOcupado(true)
    setErro(null)
    try {
      await acao()
      setLista(await ocorrenciasDoProjeto(id))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  if (carregando) return <EsqueletoDeTabela linhas={5} colunas={5} />
  if (!projeto) {
    return (
      <>
        <button className="voltar" onClick={aoVoltar}>← Projeto</button>
        <p className="vazio">Este projeto não existe ou você não alcança ele.</p>
      </>
    )
  }

  const abertas = lista.filter((o) => !ENCERRADA.includes(o.status))
  const encerradas = lista.filter((o) => ENCERRADA.includes(o.status))
  const mostradas = verEncerradas ? lista : abertas

  const diasEmAberto = (o: Ocorrencia) =>
    Math.round((Date.parse(HOJE) - Date.parse(o.data)) / 86_400_000)

  return (
    <>
      <button className="voltar" onClick={aoVoltar}>← Projeto</button>

      <CabecalhoImpresso
        titulo={`${projeto.codigo} · Ocorrências`}
        sub={projeto.nome}
      />

      <header className="cabecalho-pagina">
        <div className="titulo-projeto">
          <span className="dado codigo-projeto">{projeto.codigo}</span>
          <h1>Ocorrências</h1>
        </div>
        <div className="selos">
          {!soLeitura && !abrindo && (
            <button className="botao botao--acao" onClick={() => setAbrindo(true)}>
              Registrar ocorrência
            </button>
          )}
          <BotaoImprimir />
          {encerradas.length > 0 && (
            <label className="marcador">
              <input
                type="checkbox" checked={verEncerradas}
                onChange={(e) => setVerEncerradas(e.target.checked)}
              />
              mostrar encerradas ({encerradas.length})
            </label>
          )}
        </div>
        <p>
          {abertas.length === 0
            ? 'Nada em aberto.'
            : `${abertas.length} em aberto`}
          {' · o que aconteceu e o que se faz a respeito'}
        </p>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      {abrindo && (
        <div className="cartao" style={{ marginBottom: 'var(--e4)' }}>
          <dl className="campos">
            <div className="campo-linha campo-largo">
              <dt><label htmlFor="oc-titulo">O que aconteceu</label></dt>
              <dd>
                <input
                  id="oc-titulo" className="campo" value={rascunho.titulo}
                  placeholder="Guindaste não chegou na data"
                  onChange={(e) => setRascunho({ ...rascunho, titulo: e.target.value })}
                />
              </dd>
            </div>

            <div className="campo-linha">
              <dt><label htmlFor="oc-tipo">Tipo</label></dt>
              <dd>
                <select
                  id="oc-tipo" className="campo" value={rascunho.tipo}
                  onChange={(e) => setRascunho({ ...rascunho, tipo: e.target.value })}
                >
                  {TIPOS_OCORRENCIA.map((t) => (
                    <option key={t} value={t}>{ROTULO_TIPO[t]}</option>
                  ))}
                </select>
              </dd>
            </div>

            <div className="campo-linha">
              <dt><label htmlFor="oc-data">Quando</label></dt>
              <dd>
                <input
                  id="oc-data" className="campo" type="date" value={rascunho.data}
                  onChange={(e) => setRascunho({ ...rascunho, data: e.target.value })}
                />
              </dd>
            </div>

            <div className="campo-linha">
              <dt><label htmlFor="oc-impacto">Impacto</label></dt>
              <dd>
                <select
                  id="oc-impacto" className="campo" value={rascunho.impacto}
                  onChange={(e) => setRascunho({ ...rascunho, impacto: e.target.value })}
                >
                  <option value="">—</option>
                  {GRAUS.map((g) => <option key={g} value={g}>{g.toLowerCase()}</option>)}
                </select>
              </dd>
            </div>

            <div className="campo-linha">
              <dt><label htmlFor="oc-prob">Probabilidade</label></dt>
              <dd>
                <select
                  id="oc-prob" className="campo" value={rascunho.probabilidade}
                  onChange={(e) => setRascunho({ ...rascunho, probabilidade: e.target.value })}
                >
                  <option value="">—</option>
                  {PROBABILIDADES.map((g) => (
                    <option key={g} value={g}>{g.toLowerCase()}</option>
                  ))}
                </select>
                <p className="ajuda">Faz sentido em risco; em problema que já aconteceu, não.</p>
              </dd>
            </div>

            <div className="campo-linha">
              <dt><label htmlFor="oc-resp">Quem cuida</label></dt>
              <dd>
                <select
                  id="oc-resp" className="campo" value={rascunho.responsavel_id}
                  onChange={(e) => setRascunho({ ...rascunho, responsavel_id: e.target.value })}
                >
                  <option value="">—</option>
                  {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </dd>
            </div>

            <div className="campo-linha campo-largo">
              <dt><label htmlFor="oc-desc">Detalhe</label></dt>
              <dd>
                <textarea
                  id="oc-desc" className="campo" rows={3} value={rascunho.descricao}
                  onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
                />
              </dd>
            </div>
          </dl>

          <p className="acoes">
            <button
              className="botao botao--acao"
              disabled={ocupado || rascunho.titulo.trim() === ''}
              onClick={() =>
                comOBanco(async () => {
                  await criarOcorrencia({
                    projeto_id: id,
                    data: rascunho.data,
                    tipo: rascunho.tipo,
                    titulo: rascunho.titulo.trim(),
                    descricao: rascunho.descricao.trim() || null,
                    impacto: rascunho.impacto || null,
                    probabilidade: rascunho.probabilidade || null,
                    responsavel_id: rascunho.responsavel_id || null,
                  })
                  setRascunho({ ...VAZIA })
                  setAbrindo(false)
                })}
            >
              {ocupado ? 'Registrando…' : 'Registrar'}
            </button>
            <button className="botao" onClick={() => { setAbrindo(false); setErro(null) }}>
              cancelar
            </button>
          </p>
        </div>
      )}

      {mostradas.length === 0 ? (
        <p className="vazio">
          Nenhuma ocorrência registrada. É aqui que entram o risco que se enxerga, o problema
          que apareceu e a paralisação — cada um com quem cuida e até quando.
        </p>
      ) : (
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th className="data">Quando</th>
                <th>Tipo</th>
                <th>O que aconteceu</th>
                <th>Impacto</th>
                <th>Quem cuida</th>
                <th>Situação</th>
                {!soLeitura && <th />}
              </tr>
            </thead>
            <tbody>
              {mostradas.map((o) => (
                <tr key={o.id} className={ENCERRADA.includes(o.status) ? 'linha-inativa' : undefined}>
                  <td className="dado">{formatarData(o.data)}</td>
                  <td><span className="marca-etapa">{ROTULO_TIPO[o.tipo] ?? o.tipo}</span></td>
                  <td>
                    <strong>{o.titulo}</strong>
                    {o.descricao && <div className="justificativa">{o.descricao}</div>}
                  </td>
                  <td>
                    {o.impacto && (
                      <span className={o.impacto === 'ALTO' ? 'selo selo--atrasado' : 'selo'}>
                        {o.impacto.toLowerCase()}
                      </span>
                    )}
                    {o.probabilidade && (
                      <span className="marca-etapa">prob. {o.probabilidade.toLowerCase()}</span>
                    )}
                  </td>
                  <td>{equipe.find((p) => p.id === o.responsavel_id)?.nome ?? '—'}</td>
                  <td>
                    {soLeitura ? (
                      ROTULO_SITUACAO[o.status]
                    ) : (
                      <select
                        className="campo campo--situacao" value={o.status}
                        aria-label={`Situação de ${o.titulo}`}
                        onChange={(e) => {
                          const status = e.target.value
                          comOBanco(async () => {
                            await atualizarOcorrencia(o.id, {
                              status,
                              // Encerrar sem registrar quando deixa o histórico
                              // sem a metade que interessa: quanto tempo levou.
                              resolvido_em: ENCERRADA.includes(status)
                                ? o.resolvido_em ?? HOJE
                                : null,
                            })
                          })
                        }}
                      >
                        {SITUACOES_OCORRENCIA.map((s) => (
                          <option key={s} value={s}>{ROTULO_SITUACAO[s]}</option>
                        ))}
                      </select>
                    )}
                    {!ENCERRADA.includes(o.status) && diasEmAberto(o) > 0 && (
                      <div className="dado" style={{ fontSize: '.7rem', color: 'var(--apagado)' }}>
                        há {diasEmAberto(o)} dia{diasEmAberto(o) === 1 ? '' : 's'}
                      </div>
                    )}
                    {o.resolvido_em && (
                      <div className="dado" style={{ fontSize: '.7rem', color: 'var(--apagado)' }}>
                        em {formatarData(o.resolvido_em)}
                      </div>
                    )}
                  </td>
                  {!soLeitura && (
                    <td>
                      <button
                        className="voltar" disabled={ocupado}
                        onClick={() => comOBanco(async () => { await excluirOcorrencia(o.id) })}
                      >
                        apagar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
