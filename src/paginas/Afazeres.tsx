import { useCallback, useEffect, useState } from 'react'
import {
  atualizarAfazer, criarAfazer, criarSecao, empresas as carregarEmpresas,
  eu as carregarEu, excluirAfazer, excluirSecao, meusAfazeres, projetosParaEscolha,
  PRIORIDADES_AFAZER, renomearSecao, secoesDaLista,
  type Afazer, type AfazerSecao, type Empresa, type Pessoa,
} from '../lib/banco'
import { EsqueletoDeTabela } from '../componentes/Esqueleto'
import { data as formatarData } from '../lib/formato'
import { guardarParametros, lerParametros } from '../lib/url'

/**
 * O quadro de afazeres — o único lugar da lista pessoal.
 *
 * UMA LISTA POR EMPRESA CADASTRADA, e só. Não há lista "Pessoal": o que se
 * anota aqui é trabalho, e trabalho é de alguma das empresas. Empresa nova
 * aparece sozinha assim que for cadastrada em Empresas — a lista da esquerda é
 * o cadastro, não uma segunda configuração para manter.
 *
 * Dentro de cada lista, colunas que a própria pessoa cria. A COLUNA VAZIA É
 * INFORMAÇÃO: "Qualidade 0" diz que ninguém anotou nada ali ainda, e é por isso
 * que seção é linha de tabela e não texto no afazer — com texto, esvaziar a
 * coluna a apagaria.
 *
 * TUDO NO CARTÃO É EDITÁVEL, na própria linha. Anotar rápido significa anotar
 * incompleto: "ligar para o fornecedor" primeiro, prazo e projeto depois. Se o
 * que se escreveu na pressa não puder mudar, a pessoa apaga e reescreve.
 *
 * Privado de verdade: a política do banco é `pessoa_id = app.pessoa_atual()`,
 * sem exceção nem para o proprietário.
 */

const SEM_SECAO = 'sem-secao'

const ROTULO_PRIORIDADE: Record<string, string> = {
  ALTA: 'alta', NORMAL: 'normal', BAIXA: 'baixa',
}

const HOJE = new Date().toISOString().slice(0, 10)

export function Afazeres() {
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [listaEmpresas, setListaEmpresas] = useState<Empresa[]>([])
  const [projetos, setProjetos] = useState<{ id: string; codigo: string; nome: string }[]>([])
  const [itens, setItens] = useState<Afazer[]>([])
  const [secoes, setSecoes] = useState<AfazerSecao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const [lista, setLista] = useState<string | null>(lerParametros().lista ?? null)
  const [verFeitos, setVerFeitos] = useState(false)

  const [escrevendoEm, setEscrevendoEm] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState('')
  const [novaSecao, setNovaSecao] = useState('')
  const [criandoSecao, setCriandoSecao] = useState(false)
  const [editandoTitulo, setEditandoTitulo] = useState<string | null>(null)
  const [abertoParaTrocar, setAbertoParaTrocar] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<Afazer | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)

  const recarregar = useCallback(async (empresaId: string | null) => {
    const [tudo, cols] = await Promise.all([
      meusAfazeres(),
      empresaId ? secoesDaLista(empresaId) : Promise.resolve([]),
    ])
    setItens(tudo)
    setSecoes(cols)
  }, [])

  useEffect(() => {
    let vivo = true
    Promise.all([carregarEu(), carregarEmpresas(), projetosParaEscolha()])
      .then(async ([quem, es, ps]) => {
        if (!vivo) return
        const ativas = es.filter((e) => e.ativo)
        setPessoa(quem)
        setListaEmpresas(ativas)
        setProjetos(ps)
        // Sem lista na URL — ou com uma que não existe mais — abre na primeira.
        const escolhida = ativas.some((e) => e.id === lista) ? lista : ativas[0]?.id ?? null
        setLista(escolhida)
        await recarregar(escolhida)
      })
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
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

  async function irPara(empresaId: string) {
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
          Este login ainda não está ligado a uma pessoa do GestPlan, então não há lista de quem
          buscar.
        </p>
      </>
    )
  }

  if (listaEmpresas.length === 0) {
    return (
      <>
        <header className="cabecalho-pagina"><h1>Afazeres</h1></header>
        <p className="vazio">
          As listas são as empresas cadastradas, e ainda não há nenhuma ativa. Cadastre em{' '}
          <strong>Empresas</strong> e a lista aparece aqui sozinha.
        </p>
      </>
    )
  }

  const daLista = itens.filter((a) => a.empresa_id === lista && (verFeitos || !a.feito_em))
  const contar = (empresaId: string) =>
    itens.filter((a) => a.empresa_id === empresaId && !a.feito_em).length
  const feitosDaLista = itens.filter((a) => a.empresa_id === lista && a.feito_em).length

  const colunas: { id: string; nome: string; fixa?: boolean }[] = [
    ...(daLista.some((a) => !a.secao_id)
      ? [{ id: SEM_SECAO, nome: 'Sem coluna', fixa: true }]
      : []),
    ...secoes.map((s) => ({ id: s.id, nome: s.nome })),
  ]

  const naColuna = (id: string) =>
    daLista
      .filter((a) => (a.secao_id ?? SEM_SECAO) === id)
      .sort((x, y) =>
        Number(!!x.feito_em) - Number(!!y.feito_em) ||
        x.ordem - y.ordem ||
        x.criado_em.localeCompare(y.criado_em))

  const aberto = (a: Afazer, campo: string) => abertoParaTrocar === `${a.id}:${campo}`
  const fechar = () => setAbertoParaTrocar(null)

  function trocar(a: Afazer, mudanca: Record<string, string | null>) {
    fechar()
    const [campo, valor] = Object.entries(mudanca)[0]
    if ((a as unknown as Record<string, unknown>)[campo] === valor) return
    comOBanco(async () => { await atualizarAfazer(a.id, mudanca) })
  }

  const codigoDoProjeto = (id: string | null) =>
    id ? projetos.find((p) => p.id === id)?.codigo ?? null : null

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

  async function virar(a: Afazer) {
    const feito = a.feito_em ? null : new Date().toISOString()
    setItens((antes) => antes.map((x) => (x.id === a.id ? { ...x, feito_em: feito } : x)))
    try {
      const mudou = await atualizarAfazer(a.id, { feito_em: feito })
      if (mudou === 0) throw new Error('O item não mudou.')
    } catch (e) {
      setErro((e as Error).message)
      await recarregar(lista)
    }
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

  const cartao = (a: Afazer) => (
    <li
      key={a.id}
      className={a.feito_em ? 'cartao-afazer cartao-afazer--feito' : 'cartao-afazer'}
      draggable={!ocupado && editandoTitulo !== a.id}
      onDragStart={() => setArrastando(a)}
      onDragEnd={() => { setArrastando(null); setAlvo(null) }}
    >
      <label>
        <input
          type="checkbox"
          checked={a.feito_em !== null}
          onChange={() => virar(a)}
          aria-label={a.feito_em ? `Desfazer ${a.titulo}` : `Concluir ${a.titulo}`}
        />
      </label>

      <span className="cartao-corpo">
        {editandoTitulo === a.id ? (
          <input
            className="campo"
            defaultValue={a.titulo}
            autoFocus
            onBlur={(e) => {
              const novo = e.target.value.trim()
              setEditandoTitulo(null)
              if (novo !== '' && novo !== a.titulo) {
                comOBanco(async () => { await atualizarAfazer(a.id, { titulo: novo }) })
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setEditandoTitulo(null)
            }}
          />
        ) : (
          <button className="cartao-titulo" onClick={() => setEditandoTitulo(a.id)}>
            {a.titulo}
          </button>
        )}

        <span className="cartao-marcas">
          {/* Prioridade */}
          {aberto(a, 'prioridade') ? (
            <select
              className="campo campo--linha" autoFocus defaultValue={a.prioridade}
              aria-label={`Prioridade de ${a.titulo}`}
              onBlur={fechar}
              onChange={(e) => trocar(a, { prioridade: e.target.value })}
            >
              {PRIORIDADES_AFAZER.map((v) => (
                <option key={v} value={v}>{ROTULO_PRIORIDADE[v]}</option>
              ))}
            </select>
          ) : (
            <button
              className={
                a.prioridade === 'ALTA' ? 'selo selo--urgente clicavel'
                  : a.prioridade === 'BAIXA' ? 'selo selo--planejamento clicavel'
                  : 'marca-etapa clicavel discreto'
              }
              onClick={() => setAbertoParaTrocar(`${a.id}:prioridade`)}
              title="Mudar a prioridade"
            >
              {a.prioridade === 'NORMAL' ? 'prioridade' : ROTULO_PRIORIDADE[a.prioridade]}
            </button>
          )}

          {/* Projeto */}
          {aberto(a, 'projeto') ? (
            <select
              className="campo campo--linha" autoFocus defaultValue={a.projeto_id ?? ''}
              aria-label={`Projeto de ${a.titulo}`}
              onBlur={fechar}
              onChange={(e) => trocar(a, { projeto_id: e.target.value || null })}
            >
              <option value="">sem projeto</option>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>
              ))}
            </select>
          ) : (
            <button
              className={a.projeto_id ? 'marca-etapa clicavel' : 'marca-etapa clicavel discreto'}
              onClick={() => setAbertoParaTrocar(`${a.id}:projeto`)}
              title="Ligar a um projeto"
            >
              {codigoDoProjeto(a.projeto_id) ?? '+ projeto'}
            </button>
          )}

          {/* Prazo — o que mais muda depois de anotado */}
          {aberto(a, 'prazo') ? (
            <input
              className="campo campo--linha" type="date" autoFocus
              defaultValue={a.prazo ?? ''}
              aria-label={`Prazo de ${a.titulo}`}
              onBlur={fechar}
              onKeyDown={(e) => { if (e.key === 'Escape') fechar() }}
              onChange={(e) => trocar(a, { prazo: e.target.value || null })}
            />
          ) : (
            <button
              className={
                a.prazo && a.prazo < HOJE && !a.feito_em
                  ? 'dado prazo-do-afazer prazo-vencido'
                  : a.prazo ? 'dado prazo-do-afazer' : 'prazo-do-afazer discreto'
              }
              onClick={() => setAbertoParaTrocar(`${a.id}:prazo`)}
              title="Mudar o prazo — apagar o campo tira o prazo"
            >
              {a.prazo ? formatarData(a.prazo) : '+ prazo'}
            </button>
          )}
        </span>
      </span>

      <button
        className="voltar afazer-tirar"
        disabled={ocupado}
        aria-label={`Apagar ${a.titulo}`}
        title="Apagar"
        onClick={() => comOBanco(async () => { await excluirAfazer(a.id) })}
      >
        ×
      </button>
    </li>
  )

  const nomeDaLista = listaEmpresas.find((e) => e.id === lista)?.nome ?? 'Lista'

  return (
    <>
      <header className="cabecalho-pagina">
        <div className="titulo-projeto">
          <h1>Afazeres</h1>
          {feitosDaLista > 0 && (
            <label className="marcador">
              <input
                type="checkbox"
                checked={verFeitos}
                onChange={(e) => setVerFeitos(e.target.checked)}
              />
              mostrar concluídos ({feitosDaLista})
            </label>
          )}
        </div>
        <p>Sua lista, por empresa. Ninguém mais a alcança — nem o proprietário.</p>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      <div className="quadro-afazeres">
        <nav className="listas" aria-label="Listas">
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
                  {c.fixa ? c.nome : (
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
                    title="Apagar a coluna — o que está dentro volta para 'Sem coluna'"
                    onClick={() => comOBanco(async () => { await excluirSecao(c.id) })}
                  >
                    ×
                  </button>
                )}
              </header>

              <ul>{naColuna(c.id).map(cartao)}</ul>

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
          "Produção", "Qualidade", o que fizer sentido — e comece a anotar dentro.
        </p>
      )}
    </>
  )
}
