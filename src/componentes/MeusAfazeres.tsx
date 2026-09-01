import { useEffect, useRef, useState } from 'react'
import {
  atualizarAfazer, criarAfazer, empresas as carregarEmpresas, excluirAfazer,
  meusAfazeres, projetosParaEscolha, PRIORIDADES_AFAZER,
  type Afazer, type Empresa,
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
  const [listaEmpresas, setListaEmpresas] = useState<Empresa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [mostrarFeitos, setMostrarFeitos] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  /**
   * Qual campo de qual linha esta aberto para troca, como "id:campo".
   *
   * Um estado so para os quatro campos, em vez de quatro estados: assim abrir
   * um fecha o outro sozinho, que e o que se espera de uma linha onde os
   * controles ficam lado a lado.
   */
  const [abertoParaTrocar, setAbertoParaTrocar] = useState<string | null>(null)

  // O que a caixa de escrita está montando.
  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState('')
  const [projeto, setProjeto] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [prioridade, setPrioridade] = useState('NORMAL')
  const caixa = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let vivo = true
    Promise.all([meusAfazeres(), projetosParaEscolha(), carregarEmpresas()])
      .then(([a, p, e]) => {
        if (!vivo) return
        setLista(a)
        setProjetos(p)
        setListaEmpresas(e.filter((x) => x.ativo))
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
          empresa_id: empresa || null,
          prioridade,
          // Novo item entra no topo: quem acabou de anotar quer ver anotado.
          ordem: Math.min(0, ...lista.map((a) => a.ordem)) - 1,
        },
        pessoaId,
      )
      setTitulo('')
      setPrazo('')
      setProjeto('')
      // A empresa NAO e limpa: quem esta anotando tres coisas da Cemare nao
      // quer escolher Cemare tres vezes. Prazo e titulo mudam a cada item; a
      // empresa costuma ser a mesma na sequencia.
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

  const aberto = (a: Afazer, campo: string) => abertoParaTrocar === `${a.id}:${campo}`
  const fechar = () => setAbertoParaTrocar(null)

  /** Troca um campo e fecha. Nao grava se o valor for o mesmo. */
  function trocar(a: Afazer, mudanca: Record<string, string | null>) {
    fechar()
    const [campo, valor] = Object.entries(mudanca)[0]
    if ((a as unknown as Record<string, unknown>)[campo] === valor) return
    comOBanco(async () => { await atualizarAfazer(a.id, mudanca) })
  }

  /** id da empresa -> nome, da lista que o seletor ja carregou. */
  const nomeDaEmpresa = (id: string | null) =>
    id ? listaEmpresas.find((e) => e.id === id)?.nome ?? null : null

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
          {/* TODO CAMPO DA LINHA E TROCAVEL, e nao so o titulo e o prazo.
              Anotar rapido significa anotar incompleto — "ligar para o
              fornecedor" primeiro, de que empresa e depois. Se o que se
              escolheu na pressa nao puder mudar, a pessoa apaga e reescreve,
              e perde o que ja tinha marcado. */}

          {aberto(a, 'prioridade') ? (
            <select
              className="campo campo--linha" autoFocus
              defaultValue={a.prioridade}
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

          {aberto(a, 'empresa') ? (
            <select
              className="campo campo--linha" autoFocus
              defaultValue={a.empresa_id ?? ''}
              aria-label={`Empresa de ${a.titulo}`}
              onBlur={fechar}
              onChange={(e) => trocar(a, { empresa_id: e.target.value || null })}
            >
              <option value="">sem empresa</option>
              {listaEmpresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          ) : (
            <button
              className={a.empresa_id ? 'marca-etapa clicavel' : 'marca-etapa clicavel discreto'}
              onClick={() => setAbertoParaTrocar(`${a.id}:empresa`)}
              title="Mudar a empresa"
            >
              {nomeDaEmpresa(a.empresa_id) ?? '+ empresa'}
            </button>
          )}

          {aberto(a, 'projeto') ? (
            <select
              className="campo campo--linha" autoFocus
              defaultValue={a.projeto_id ?? ''}
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
              title="Mudar o projeto"
            >
              {a.projeto_codigo ?? '+ projeto'}
            </button>
          )}

          {/* O prazo e o que mais muda depois de anotado — "isso fica para
              segunda" e a frase mais comum de uma lista de afazeres. */}
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
                ondeCai(a) === 'atrasado'
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
          className="campo campo--empresa" value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          aria-label="Empresa (opcional)" title="De que empresa e este lembrete"
        >
          <option value="">sem empresa</option>
          {listaEmpresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
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
