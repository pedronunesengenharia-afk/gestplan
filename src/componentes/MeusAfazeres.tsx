import { useEffect, useRef, useState } from 'react'
import {
  atualizarAfazer, criarAfazer, excluirAfazer, meusAfazeres, projetosParaEscolha,
  type Afazer,
} from '../lib/banco'
import { data as formatarData } from '../lib/formato'

/**
 * A lista pessoal — o pedaço "tipo Todoist" do Meu trabalho.
 *
 * O que ela NÃO é: tarefa de projeto. "Ligar para o fornecedor" e "revisar a
 * ata" não são escopo, não entram no cronograma e não contam avanço. Forçá-los
 * na tarefa sujaria o percentual de todo projeto com lembrete, e é assim que
 * um cronograma deixa de significar alguma coisa.
 *
 * É PRIVADA, inclusive do proprietário — a política do banco é
 * `pessoa_id = app.pessoa_atual()`, sem exceção. A tela diz isso em voz alta,
 * uma vez, porque uma lista pessoal só é usada para o que serve quando quem
 * escreve tem certeza de que ninguém está lendo.
 *
 * A caixa de escrita é uma linha só, e é de propósito: a coisa mais importante
 * numa lista de afazeres é o atrito entre lembrar e anotar. Data, projeto e
 * prioridade estão ali do lado, opcionais, sem abrir formulário nenhum.
 */

const HOJE = new Date().toISOString().slice(0, 10)

function fimDaSemana(): string {
  const d = new Date(HOJE + 'T12:00:00')
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  return d.toISOString().slice(0, 10)
}
const DOMINGO = fimDaSemana()

const GRUPOS: { chave: string; titulo: string }[] = [
  { chave: 'atrasado', titulo: 'Atrasados' },
  { chave: 'hoje', titulo: 'Para hoje' },
  { chave: 'semana', titulo: 'Esta semana' },
  { chave: 'depois', titulo: 'Depois' },
  { chave: 'sem-data', titulo: 'Quando der' },
]

function ondeCai(a: Afazer): string {
  if (!a.prazo) return 'sem-data'
  if (a.prazo < HOJE) return 'atrasado'
  if (a.prazo === HOJE) return 'hoje'
  if (a.prazo <= DOMINGO) return 'semana'
  return 'depois'
}

const ROTULO_PRIORIDADE: Record<string, string> = {
  ALTA: 'alta', NORMAL: 'normal', BAIXA: 'baixa',
}

export function MeusAfazeres({ pessoaId }: { pessoaId: string }) {
  const [lista, setLista] = useState<Afazer[]>([])
  const [projetos, setProjetos] = useState<{ id: string; codigo: string; nome: string }[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [mostrarFeitos, setMostrarFeitos] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)

  // O que a caixa de escrita está montando.
  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState('')
  const [projeto, setProjeto] = useState('')
  const [prioridade, setPrioridade] = useState('NORMAL')
  const caixa = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let vivo = true
    Promise.all([meusAfazeres(), projetosParaEscolha()])
      .then(([a, p]) => {
        if (!vivo) return
        setLista(a)
        setProjetos(p)
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
      setLista(await meusAfazeres())
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function incluir() {
    const t = titulo.trim()
    if (t === '') return
    await comOBanco(async () => {
      await criarAfazer(
        {
          titulo: t,
          prazo: prazo || null,
          projeto_id: projeto || null,
          prioridade,
          // Novo item entra no topo: quem acabou de anotar quer ver anotado.
          ordem: Math.min(0, ...lista.map((a) => a.ordem)) - 1,
        },
        pessoaId,
      )
      setTitulo('')
      setPrazo('')
      setProjeto('')
      setPrioridade('NORMAL')
    })
    caixa.current?.focus()
  }

  // Marcar e desmarcar mexem na tela na hora e só depois no banco: numa lista
  // de afazeres, esperar a rede para o risco aparecer é o que faz a pessoa
  // clicar duas vezes.
  async function virar(a: Afazer) {
    const feito = a.feito_em ? null : new Date().toISOString()
    setLista((antes) => antes.map((x) => (x.id === a.id ? { ...x, feito_em: feito } : x)))
    try {
      const mudou = await atualizarAfazer(a.id, { feito_em: feito })
      if (mudou === 0) throw new Error('O item não mudou.')
    } catch (e) {
      setErro((e as Error).message)
      setLista(await meusAfazeres())
    }
  }

  if (carregando) return <p className="vazio">Carregando…</p>

  const pendentes = lista.filter((a) => !a.feito_em)
  const feitos = lista.filter((a) => a.feito_em)
  const atrasados = pendentes.filter((a) => ondeCai(a) === 'atrasado').length

  const porGrupo = GRUPOS.map((g) => ({
    ...g,
    itens: pendentes
      .filter((a) => ondeCai(a) === g.chave)
      .sort((x, y) => x.ordem - y.ordem || x.criado_em.localeCompare(y.criado_em)),
  })).filter((g) => g.itens.length > 0)

  const linha = (a: Afazer) => (
    <li key={a.id} className={a.feito_em ? 'afazer afazer--feito' : 'afazer'}>
      <label className="afazer-marca">
        <input
          type="checkbox"
          checked={a.feito_em !== null}
          onChange={() => virar(a)}
          aria-label={a.feito_em ? `Desfazer ${a.titulo}` : `Concluir ${a.titulo}`}
        />
      </label>

      <span className="afazer-corpo">
        {editando === a.id ? (
          <input
            className="campo"
            defaultValue={a.titulo}
            autoFocus
            onBlur={(e) => {
              const novo = e.target.value.trim()
              setEditando(null)
              if (novo !== '' && novo !== a.titulo) {
                comOBanco(async () => { await atualizarAfazer(a.id, { titulo: novo }) })
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setEditando(null)
            }}
          />
        ) : (
          <button className="afazer-titulo" onClick={() => setEditando(a.id)}>
            {a.titulo}
          </button>
        )}

        <span className="afazer-marcas">
          {a.prioridade !== 'NORMAL' && (
            <span className={`selo selo--${a.prioridade === 'ALTA' ? 'urgente' : 'planejamento'}`}>
              {ROTULO_PRIORIDADE[a.prioridade]}
            </span>
          )}
          {a.projeto_codigo && <span className="marca-etapa">{a.projeto_codigo}</span>}
          {a.prazo && (
            <span className={ondeCai(a) === 'atrasado' ? 'dado prazo-vencido' : 'dado'}>
              {formatarData(a.prazo)}
            </span>
          )}
        </span>
      </span>

      <button
        className="voltar afazer-tirar"
        disabled={ocupado}
        onClick={() => comOBanco(async () => { await excluirAfazer(a.id) })}
        aria-label={`Apagar ${a.titulo}`}
        title="Apagar"
      >
        ×
      </button>
    </li>
  )

  return (
    <section className="secao">
      <h2>
        Meus afazeres <span className="conta">{pendentes.length}</span>
        {atrasados > 0 && (
          <span className="conta conta--fraca">{atrasados} com prazo vencido</span>
        )}
      </h2>

      {erro && <div className="aviso">{erro}</div>}

      <form
        className="afazer-caixa"
        onSubmit={(e) => { e.preventDefault(); incluir() }}
      >
        <input
          ref={caixa}
          className="campo"
          placeholder="O que precisa ser feito?"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          aria-label="Novo afazer"
        />
        <input
          className="campo campo--prazo" type="date" value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          aria-label="Prazo (opcional)" title="Prazo, se houver"
        />
        <select
          className="campo campo--prioridade" value={prioridade}
          onChange={(e) => setPrioridade(e.target.value)}
          aria-label="Prioridade" title="Prioridade"
        >
          <option value="ALTA">alta</option>
          <option value="NORMAL">normal</option>
          <option value="BAIXA">baixa</option>
        </select>
        <select
          className="campo campo--projeto" value={projeto}
          onChange={(e) => setProjeto(e.target.value)}
          aria-label="Projeto (opcional)" title="Ligar a um projeto, se for o caso"
        >
          <option value="">sem projeto</option>
          {projetos.map((p) => (
            <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>
          ))}
        </select>
        <button className="botao botao--acao" disabled={ocupado || titulo.trim() === ''}>
          Anotar
        </button>
      </form>

      <p className="ajuda">
        Esta lista é <strong>sua</strong>: ninguém mais a alcança, nem o proprietário. O que é
        combinado com outra pessoa mora na tarefa do projeto, que a equipe vê.
      </p>

      {pendentes.length === 0 ? (
        <p className="vazio">
          Nada anotado. O que passar pela cabeça e não couber num projeto cabe aqui.
        </p>
      ) : (
        porGrupo.map((g) => (
          <div className="afazer-grupo" key={g.chave}>
            <h3>{g.titulo} <span className="conta">{g.itens.length}</span></h3>
            <ul className="lista-afazeres">{g.itens.map(linha)}</ul>
          </div>
        ))
      )}

      {feitos.length > 0 && (
        <div className="afazer-grupo">
          <h3>
            Feitos <span className="conta">{feitos.length}</span>
            <button className="voltar conta" onClick={() => setMostrarFeitos(!mostrarFeitos)}>
              {mostrarFeitos ? 'esconder' : 'mostrar'}
            </button>
          </h3>
          {mostrarFeitos && <ul className="lista-afazeres">{feitos.map(linha)}</ul>}
        </div>
      )}
    </section>
  )
}
