import { useCallback, useEffect, useState } from 'react'
import {
  atualizarAfazer, criarAfazer, criarSecao, empresas as carregarEmpresas,
  eu as carregarEu, excluirAfazer, excluirSecao, meusAfazeres, renomearSecao,
  secoesDaLista,
  type Afazer, type AfazerSecao, type Empresa, type Pessoa,
} from '../lib/banco'
import { EsqueletoDeTabela } from '../componentes/Esqueleto'
import { data as formatarData } from '../lib/formato'
import { guardarParametros, lerParametros } from '../lib/url'

/**
 * O quadro de afazeres.
 *
 * Uma lista por empresa, mais a "Pessoal" — a dos lembretes que não são de
 * empresa nenhuma. Dentro de cada lista, colunas que a própria pessoa cria.
 *
 * DUAS TELAS PARA A MESMA COISA, E É DE PROPÓSITO. "Meu trabalho" responde
 * *o que vence hoje*, misturando afazer com tarefa de projeto e ordenando por
 * urgência. Este quadro responde *onde as coisas ficam*. São perguntas
 * diferentes e quem usa uma raramente quer a outra no mesmo momento — é a
 * mesma razão pela qual o Todoist tem "Hoje" e tem o quadro do projeto.
 *
 * A COLUNA VAZIA É INFORMAÇÃO. "Qualidade 0" diz que ninguém anotou nada ali
 * ainda, e é por isso que seção é linha de tabela e não texto no afazer: com
 * texto, esvaziar a coluna a apagaria.
 *
 * Tudo aqui é privado — a política do banco é `pessoa_id = app.pessoa_atual()`
 * sem exceção, nem para o proprietário.
 */

const SEM_SECAO = 'sem-secao'

export function Afazeres() {
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [listaEmpresas, setListaEmpresas] = useState<Empresa[]>([])
  const [itens, setItens] = useState<Afazer[]>([])
  const [secoes, setSecoes] = useState<AfazerSecao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  // `null` é a lista Pessoal. Sobrevive ao F5 pela query string, então o link
  // de uma lista pode ser mandado para você mesmo depois.
  const [lista, setLista] = useState<string | null>(lerParametros().lista ?? null)

  const [escrevendoEm, setEscrevendoEm] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState('')
  const [novaSecao, setNovaSecao] = useState('')
  const [criandoSecao, setCriandoSecao] = useState(false)
  const [arrastando, setArrastando] = useState<Afazer | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)

  const recarregar = useCallback(async (empresaId: string | null) => {
    const [tudo, cols] = await Promise.all([meusAfazeres(), secoesDaLista(empresaId)])
    setItens(tudo)
    setSecoes(cols)
  }, [])

  useEffect(() => {
    let vivo = true
    Promise.all([carregarEu(), carregarEmpresas()])
      .then(async ([quem, es]) => {
        if (!vivo) return
        setPessoa(quem)
        setListaEmpresas(es.filter((e) => e.ativo))
        await recarregar(lista)
      })
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
    // Só na montagem: a troca de lista é tratada por `irPara`.
  }, [])

  async function comOBanco(acao: () => Promise<void>) {
    setOcupado(true)
    setErro(null)
    try {
      await acao()
      await recarregar(lista)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function irPara(empresaId: string | null) {
    setLista(empresaId)
    guardarParametros({ lista: empresaId })
    setEscrevendoEm(null)
    setCriandoSecao(false)
    setOcupado(true)
    try {
      await recarregar(empresaId)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  if (carregando) return <EsqueletoDeTabela linhas={5} colunas={4} />

  if (!pessoa) {
    return (
      <>
        <header className="cabecalho-pagina"><h1>Afazeres</h1></header>
        <p className="vazio">
          Este login ainda não está ligado a uma pessoa do GestPlan, então não há lista de
          quem buscar.
        </p>
      </>
    )
  }

  const daLista = itens.filter((a) => (a.empresa_id ?? null) === lista && !a.feito_em)
  const contar = (empresaId: string | null) =>
    itens.filter((a) => (a.empresa_id ?? null) === empresaId && !a.feito_em).length

  // A faixa "sem coluna" só aparece quando há algo nela — coluna vazia é
  // informação, mas uma gaveta que ninguém criou não é.
  const colunas: { id: string; nome: string; fixa?: boolean }[] = [
    ...(daLista.some((a) => !a.secao_id)
      ? [{ id: SEM_SECAO, nome: 'Sem coluna', fixa: true }]
      : []),
    ...secoes.map((s) => ({ id: s.id, nome: s.nome })),
  ]

  const naColuna = (id: string) =>
    daLista
      .filter((a) => (a.secao_id ?? SEM_SECAO) === id)
      .sort((x, y) => x.ordem - y.ordem || x.criado_em.localeCompare(y.criado_em))

  async function anotar(colunaId: string) {
    const t = rascunho.trim()
    if (t === '') return
    await comOBanco(async () => {
      await criarAfazer(
        {
          titulo: t,
          empresa_id: lista,
          secao_id: colunaId === SEM_SECAO ? null : colunaId,
          ordem: Math.min(0, ...daLista.map((a) => a.ordem)) - 1,
        },
        pessoa!.id,
      )
      setRascunho('')
    })
  }

  async function soltarEm(colunaId: string) {
    const a = arrastando
    setArrastando(null)
    setAlvo(null)
    if (!a) return
    const destino = colunaId === SEM_SECAO ? null : colunaId
    if ((a.secao_id ?? null) === destino) return
    // Move na tela antes do banco: arrastar e esperar a rede é o que faz o
    // cartão parecer que voltou sozinho.
    setItens((antes) => antes.map((x) => (x.id === a.id ? { ...x, secao_id: destino } : x)))
    try {
      const mudou = await atualizarAfazer(a.id, { secao_id: destino })
      if (mudou === 0) throw new Error('O item não mudou de coluna.')
    } catch (e) {
      setErro((e as Error).message)
      await recarregar(lista)
    }
  }

  const nomeDaLista = lista === null
    ? 'Pessoal'
    : listaEmpresas.find((e) => e.id === lista)?.nome ?? 'Lista'

  return (
    <>
      <header className="cabecalho-pagina">
        <h1>Afazeres</h1>
        <p>
          Sua lista, por empresa. Ninguém mais a alcança — nem o proprietário.
        </p>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      <div className="quadro-afazeres">
        {/* ------------------------------------------------ as listas --- */}
        <nav className="listas" aria-label="Listas">
          <button
            className={lista === null ? 'lista-escolhida' : undefined}
            onClick={() => irPara(null)}
          >
            Pessoal <span className="conta">{contar(null)}</span>
          </button>
          {listaEmpresas.map((e) => (
            <button
              key={e.id}
              className={lista === e.id ? 'lista-escolhida' : undefined}
              onClick={() => irPara(e.id)}
            >
              {e.nome} <span className="conta">{contar(e.id)}</span>
            </button>
          ))}
        </nav>

        {/* -------------------------------------------------- o quadro --- */}
        <div className="colunas-afazer">
          <h2 className="so-leitor">{nomeDaLista}</h2>

          {colunas.map((c) => (
            <section
              key={c.id}
              className={alvo === c.id ? 'coluna-afazer coluna-afazer--alvo' : 'coluna-afazer'}
              onDragOver={(e) => { e.preventDefault(); setAlvo(c.id) }}
              onDragLeave={() => setAlvo((x) => (x === c.id ? null : x))}
              onDrop={() => soltarEm(c.id)}
            >
              <header>
                <h3>
                  {c.fixa ? (
                    c.nome
                  ) : (
                    <input
                      className="nome-da-coluna"
                      defaultValue={c.nome}
                      aria-label={`Nome da coluna ${c.nome}`}
                      onBlur={(e) => {
                        const novo = e.target.value.trim()
                        if (novo !== '' && novo !== c.nome) {
                          comOBanco(async () => { await renomearSecao(c.id, novo) })
                        } else {
                          e.target.value = c.nome
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      }}
                    />
                  )}
                </h3>
                <span className="conta">{naColuna(c.id).length}</span>
                {!c.fixa && (
                  <button
                    className="voltar apagar-coluna"
                    disabled={ocupado}
                    title="Apagar a coluna — o que está dentro não some, volta para 'Sem coluna'"
                    onClick={() => comOBanco(async () => { await excluirSecao(c.id) })}
                  >
                    ×
                  </button>
                )}
              </header>

              <ul>
                {naColuna(c.id).map((a) => (
                  <li
                    key={a.id}
                    className="cartao-afazer"
                    draggable={!ocupado}
                    onDragStart={() => setArrastando(a)}
                    onDragEnd={() => { setArrastando(null); setAlvo(null) }}
                  >
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`Concluir ${a.titulo}`}
                        onChange={() =>
                          comOBanco(async () => {
                            await atualizarAfazer(a.id, { feito_em: new Date().toISOString() })
                          })}
                      />
                    </label>
                    <span className="cartao-corpo">
                      <span>{a.titulo}</span>
                      {(a.prazo || a.prioridade !== 'NORMAL') && (
                        <span className="cartao-marcas">
                          {a.prioridade === 'ALTA' && <i className="selo selo--urgente">alta</i>}
                          {a.prazo && <i className="dado">{formatarData(a.prazo)}</i>}
                        </span>
                      )}
                    </span>
                    <button
                      className="voltar afazer-tirar"
                      disabled={ocupado}
                      aria-label={`Apagar ${a.titulo}`}
                      onClick={() => comOBanco(async () => { await excluirAfazer(a.id) })}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>

              {escrevendoEm === c.id ? (
                <form
                  className="novo-cartao"
                  onSubmit={(e) => { e.preventDefault(); anotar(c.id) }}
                >
                  <input
                    className="campo" autoFocus placeholder="O que precisa ser feito?"
                    value={rascunho}
                    onChange={(e) => setRascunho(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEscrevendoEm(null) }}
                    aria-label="Novo afazer"
                  />
                  <span className="acoes-linha">
                    <button className="botao botao--acao" disabled={rascunho.trim() === ''}>
                      Anotar
                    </button>
                    <button
                      type="button" className="voltar"
                      onClick={() => { setEscrevendoEm(null); setRascunho('') }}
                    >
                      cancelar
                    </button>
                  </span>
                </form>
              ) : (
                <button
                  className="voltar mais-cartao"
                  onClick={() => { setEscrevendoEm(c.id); setRascunho('') }}
                >
                  + Adicionar tarefa
                </button>
              )}
            </section>
          ))}

          {/* --------------------------------------- criar uma coluna --- */}
          <section className="coluna-afazer coluna-afazer--nova">
            {criandoSecao ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const n = novaSecao.trim()
                  if (n === '') return
                  comOBanco(async () => {
                    await criarSecao(pessoa.id, lista, n, secoes.length)
                    setNovaSecao('')
                    setCriandoSecao(false)
                  })
                }}
              >
                <input
                  className="campo" autoFocus placeholder="Nome da coluna"
                  value={novaSecao}
                  onChange={(e) => setNovaSecao(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setCriandoSecao(false) }}
                  aria-label="Nome da nova coluna"
                />
                <span className="acoes-linha">
                  <button className="botao botao--acao" disabled={novaSecao.trim() === ''}>
                    Criar
                  </button>
                  <button type="button" className="voltar" onClick={() => setCriandoSecao(false)}>
                    cancelar
                  </button>
                </span>
              </form>
            ) : (
              <button className="voltar" onClick={() => setCriandoSecao(true)}>
                + Adicionar coluna
              </button>
            )}
          </section>
        </div>
      </div>

      {colunas.length === 0 && !criandoSecao && (
        <p className="vazio">
          A lista <strong>{nomeDaLista}</strong> ainda não tem colunas. Crie a primeira —
          "Produção", "Qualidade", o que fizer sentido para você — e comece a anotar dentro.
        </p>
      )}
    </>
  )
}
