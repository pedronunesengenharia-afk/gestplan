import { useEffect, useState } from 'react'
import {
  atualizarDecisao, criarDecisao, decisoesDoProjeto, excluirDecisao,
  pessoasDoProjeto, possoEditarProjeto, projeto as carregarProjeto,
  type Decisao, type Pessoa, type Projeto,
} from '../lib/banco'
import { EsqueletoDeTabela } from '../componentes/Esqueleto'
import { CabecalhoImpresso, BotaoImprimir } from '../componentes/Imprimir'
import { data as formatarData } from '../lib/formato'

/**
 * O registro de decisões do projeto: o que ficou combinado, e por quê.
 *
 * Não é o registro de ocorrências, que é outra tela. Decisão NÃO TEM SITUAÇÃO —
 * ela não fica pendente, é tomada. Por isso aqui não há status para acompanhar
 * nem prazo para cobrar: o que se guarda é memória, não pendência.
 *
 * O CAMPO QUE JUSTIFICA ESTA TELA EXISTIR É "o que foi descartado". Guardar só
 * a escolha faz a mesma discussão voltar do zero toda vez que alguém novo
 * chega e pergunta "por que não fizemos do outro jeito?". A tela pede o
 * descartado logo abaixo da escolha, de propósito.
 *
 * Quem decidiu pode não ter cadastro — diretor, cliente, fornecedor. Por isso
 * há a escolha na equipe e o campo livre ao lado, como em `aprovacao`.
 */

const HOJE = new Date().toISOString().slice(0, 10)

const VAZIA = {
  decidido_em: HOJE, titulo: '', contexto: '', decisao: '', alternativas: '',
  decidido_por: '', quem_avulso: '',
}

export function Decisoes({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const [projeto, setProjeto] = useState<Projeto | null>(null)
  const [lista, setLista] = useState<Decisao[]>([])
  const [equipe, setEquipe] = useState<Pessoa[]>([])
  const [soLeitura, setSoLeitura] = useState(true)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [abrindo, setAbrindo] = useState(false)
  const [rascunho, setRascunho] = useState({ ...VAZIA })
  const [editando, setEditando] = useState<string | null>(null)

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

      const [ds, gente, podeEditar] = await Promise.all([
        decisoesDoProjeto(id),
        pessoasDoProjeto(id),
        possoEditarProjeto(id),
      ])
      if (!vivo) return
      setLista(ds)
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
      setLista(await decisoesDoProjeto(id))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  if (carregando) return <EsqueletoDeTabela linhas={4} colunas={3} />
  if (!projeto) {
    return (
      <>
        <button className="voltar" onClick={aoVoltar}>← Projeto</button>
        <p className="vazio">Este projeto não existe ou você não alcança ele.</p>
      </>
    )
  }

  const quemDecidiu = (d: Decisao) =>
    equipe.find((p) => p.id === d.decidido_por)?.nome ?? d.quem_avulso ?? '—'

  const podeSalvar =
    rascunho.titulo.trim() !== '' &&
    rascunho.decisao.trim() !== '' &&
    (rascunho.decidido_por !== '' || rascunho.quem_avulso.trim() !== '')

  return (
    <>
      <button className="voltar" onClick={aoVoltar}>← Projeto</button>

      <CabecalhoImpresso titulo={`${projeto.codigo} · Decisões`} sub={projeto.nome} />

      <header className="cabecalho-pagina">
        <div className="titulo-projeto">
          <span className="dado codigo-projeto">{projeto.codigo}</span>
          <h1>Decisões</h1>
        </div>
        <div className="selos">
          {!soLeitura && !abrindo && (
            <button className="botao botao--acao" onClick={() => setAbrindo(true)}>
              Registrar decisão
            </button>
          )}
          <BotaoImprimir />
        </div>
        <p>
          {lista.length === 0 ? 'Nenhuma decisão registrada' : `${lista.length} registrada${lista.length === 1 ? '' : 's'}`}
          {' · o que ficou combinado, e por quê'}
        </p>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      {abrindo && (
        <div className="cartao" style={{ marginBottom: 'var(--e4)' }}>
          <dl className="campos">
            <div className="campo-linha campo-largo">
              <dt><label htmlFor="de-titulo">Sobre o quê</label></dt>
              <dd>
                <input
                  id="de-titulo" className="campo" value={rascunho.titulo}
                  placeholder="Trocar o fornecedor do guindaste"
                  onChange={(e) => setRascunho({ ...rascunho, titulo: e.target.value })}
                />
              </dd>
            </div>

            <div className="campo-linha campo-largo">
              <dt><label htmlFor="de-contexto">O que estava em jogo</label></dt>
              <dd>
                <textarea
                  id="de-contexto" className="campo" rows={2} value={rascunho.contexto}
                  placeholder="O primeiro remarcou duas vezes e travou a montagem"
                  onChange={(e) => setRascunho({ ...rascunho, contexto: e.target.value })}
                />
                <p className="ajuda">
                  Sem isto, a decisão lida daqui a um ano parece arbitrária.
                </p>
              </dd>
            </div>

            <div className="campo-linha campo-largo">
              <dt><label htmlFor="de-decisao">O que ficou combinado</label></dt>
              <dd>
                <textarea
                  id="de-decisao" className="campo" rows={2} value={rascunho.decisao}
                  placeholder="Fica com a Cyborg, mesmo custando 8% a mais"
                  onChange={(e) => setRascunho({ ...rascunho, decisao: e.target.value })}
                />
              </dd>
            </div>

            <div className="campo-linha campo-largo">
              <dt><label htmlFor="de-alt">O que foi descartado</label></dt>
              <dd>
                <textarea
                  id="de-alt" className="campo" rows={2} value={rascunho.alternativas}
                  placeholder="Manter o atual (sem data firme); alugar (mais caro em 90 dias)"
                  onChange={(e) => setRascunho({ ...rascunho, alternativas: e.target.value })}
                />
                <p className="ajuda">
                  <strong>É o campo que faz esta tela valer.</strong> Guardar só a escolha faz a
                  mesma discussão voltar do zero quando alguém novo chega.
                </p>
              </dd>
            </div>

            <div className="campo-linha">
              <dt><label htmlFor="de-quando">Quando</label></dt>
              <dd>
                <input
                  id="de-quando" className="campo" type="date" value={rascunho.decidido_em}
                  onChange={(e) => setRascunho({ ...rascunho, decidido_em: e.target.value })}
                />
              </dd>
            </div>

            <div className="campo-linha">
              <dt><label htmlFor="de-quem">Quem decidiu</label></dt>
              <dd>
                <select
                  id="de-quem" className="campo" value={rascunho.decidido_por}
                  onChange={(e) =>
                    setRascunho({ ...rascunho, decidido_por: e.target.value, quem_avulso: '' })}
                >
                  <option value="">alguém de fora da equipe…</option>
                  {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                {rascunho.decidido_por === '' && (
                  <input
                    className="campo" style={{ marginTop: 'var(--e2)' }}
                    placeholder="Diretoria da Cimentpav"
                    value={rascunho.quem_avulso}
                    aria-label="Quem decidiu, sem cadastro"
                    onChange={(e) => setRascunho({ ...rascunho, quem_avulso: e.target.value })}
                  />
                )}
              </dd>
            </div>
          </dl>

          <p className="acoes">
            <button
              className="botao botao--acao"
              disabled={ocupado || !podeSalvar}
              onClick={() =>
                comOBanco(async () => {
                  await criarDecisao({
                    projeto_id: id,
                    decidido_em: rascunho.decidido_em,
                    titulo: rascunho.titulo.trim(),
                    contexto: rascunho.contexto.trim() || null,
                    decisao: rascunho.decisao.trim(),
                    alternativas: rascunho.alternativas.trim() || null,
                    decidido_por: rascunho.decidido_por || null,
                    quem_avulso: rascunho.decidido_por ? null : rascunho.quem_avulso.trim(),
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

      {lista.length === 0 ? (
        <p className="vazio">
          Nenhuma decisão registrada. É aqui que fica o que foi combinado — e, principalmente,
          o que foi descartado e por quê.
        </p>
      ) : (
        <ul className="lista-decisoes">
          {lista.map((d) => (
            <li key={d.id} className="cartao decisao">
              <header>
                <h3>{d.titulo}</h3>
                <span className="dado">{formatarData(d.decidido_em)}</span>
                <span className="marca-etapa">{quemDecidiu(d)}</span>
                {!soLeitura && (
                  <button
                    className="voltar apagar-decisao" disabled={ocupado}
                    onClick={() => comOBanco(async () => { await excluirDecisao(d.id) })}
                  >
                    apagar
                  </button>
                )}
              </header>

              {d.contexto && (
                <p className="decisao-parte">
                  <b>O que estava em jogo</b>
                  {d.contexto}
                </p>
              )}

              <p className="decisao-parte decisao-escolha">
                <b>Ficou combinado</b>
                {editando === d.id ? (
                  <textarea
                    className="campo" rows={2} defaultValue={d.decisao} autoFocus
                    onBlur={(e) => {
                      const novo = e.target.value.trim()
                      setEditando(null)
                      if (novo !== '' && novo !== d.decisao) {
                        comOBanco(async () => { await atualizarDecisao(d.id, { decisao: novo }) })
                      }
                    }}
                  />
                ) : soLeitura ? (
                  d.decisao
                ) : (
                  <button className="cartao-titulo" onClick={() => setEditando(d.id)}>
                    {d.decisao}
                  </button>
                )}
              </p>

              {d.alternativas ? (
                <p className="decisao-parte">
                  <b>Descartado</b>
                  {d.alternativas}
                </p>
              ) : (
                <p className="decisao-parte decisao-falta">
                  <b>Descartado</b>
                  Não foi registrado — e é o que mais falta fazer sentido daqui a um ano.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
