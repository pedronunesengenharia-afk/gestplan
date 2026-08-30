import { useEffect, useState } from 'react'
import {
  atualizarTarefa, eu as carregarEu, minhasAlocacoes, minhasTarefas,
  STATUS_TAREFA, type Alocacao, type MinhaTarefa, type Pessoa,
} from '../lib/banco'
import { FichaDeNumero } from '../componentes/Grafico'
import { EsqueletoDeTabela } from '../componentes/Esqueleto'
import { data as formatarData } from '../lib/formato'

/**
 * O que é meu, hoje, em todos os projetos.
 *
 * Toda outra tela do sistema parte do projeto: escolha um, veja o que há
 * dentro. Esta parte da pessoa, que é como o dia realmente funciona — ninguém
 * abre sete projetos de manhã para descobrir o que fazer.
 *
 * A tarefa é agrupada por URGÊNCIA, não por projeto. Um atraso de dezesseis
 * dias e uma tarefa de novembro não pertencem à mesma lista só porque saíram
 * do mesmo projeto.
 *
 * Não usa `vw_agenda`: aquela view exige data de início, porque nasceu para o
 * calendário e o iCal da Fase 2. A maior parte das tarefas herdadas do desktop
 * não tem data — pela agenda, esta tela abriria quase vazia.
 */

const HOJE = new Date().toISOString().slice(0, 10)

/** O domingo que fecha a semana corrente, em ISO. Semana começa na segunda. */
function fimDaSemana(): string {
  const d = new Date(HOJE + 'T12:00:00')
  const diasAteDomingo = (7 - d.getDay()) % 7
  d.setDate(d.getDate() + diasAteDomingo)
  return d.toISOString().slice(0, 10)
}

const DOMINGO = fimDaSemana()

type Balde = 'atrasada' | 'hoje' | 'semana' | 'depois' | 'sem-data'

const BALDES: { chave: Balde; titulo: string; explica: string }[] = [
  { chave: 'atrasada', titulo: 'Atrasadas', explica: 'o prazo já passou' },
  { chave: 'hoje', titulo: 'Para hoje', explica: 'vencem hoje' },
  { chave: 'semana', titulo: 'Esta semana', explica: 'até domingo' },
  { chave: 'depois', titulo: 'Depois', explica: 'com prazo mais adiante' },
  { chave: 'sem-data', titulo: 'Sem prazo', explica: 'ninguém marcou quando' },
]

function ondeCai(t: MinhaTarefa): Balde {
  if (!t.data_fim_prev) return 'sem-data'
  if (t.data_fim_prev < HOJE) return 'atrasada'
  if (t.data_fim_prev === HOJE) return 'hoje'
  if (t.data_fim_prev <= DOMINGO) return 'semana'
  return 'depois'
}

export function MeuTrabalho({ aoAbrir }: { aoAbrir: (projetoId: string) => void }) {
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [tarefas, setTarefas] = useState<MinhaTarefa[]>([])
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [recado, setRecado] = useState<string | null>(null)
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false)

  useEffect(() => {
    let vivo = true
    const buscar = async () => {
      const quem = await carregarEu()
      if (!vivo) return
      setPessoa(quem)
      if (!quem) return
      const [ts, as_] = await Promise.all([minhasTarefas(quem.id), minhasAlocacoes(quem.id)])
      if (!vivo) return
      setTarefas(ts)
      setAlocacoes(as_)
    }
    buscar()
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  async function mudarStatus(t: MinhaTarefa, status: string) {
    setRecado(null)
    setErro(null)
    // Concluir sem data de fim real deixaria o histórico sem quando. A tela
    // preenche o dia de hoje; quem precisar de outra data corrige em Tarefas.
    const extra =
      status === 'CONCLUIDA'
        ? { percentual_concluido: 100, data_fim_real: t.data_fim_real ?? HOJE }
        : status === 'EM_ANDAMENTO' && !t.data_inicio_real
          ? { data_inicio_real: HOJE }
          : {}
    try {
      const mudadas = await atualizarTarefa(t.id, { status, ...extra })
      if (mudadas === 0) {
        setErro(`"${t.nome}" não mudou: você não tem permissão para editar ${t.projeto_codigo}.`)
        return
      }
      setTarefas((antes) =>
        antes.map((x) => (x.id === t.id ? { ...x, status, ...extra } : x)),
      )
      setRecado(`"${t.nome}" agora está ${status.replace(/_/g, ' ').toLowerCase()}.`)
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  if (carregando) return <EsqueletoDeTabela linhas={6} colunas={5} />

  if (!pessoa) {
    return (
      <>
        <header className="cabecalho-pagina"><h1>Meu trabalho</h1></header>
        <p className="vazio">
          Este login ainda não está ligado a uma pessoa do GestPlan, então não há de quem
          buscar tarefa.
        </p>
      </>
    )
  }

  const abertas = tarefas.filter((t) => t.status !== 'CONCLUIDA')
  const concluidas = tarefas.filter((t) => t.status === 'CONCLUIDA')
  const atrasadas = abertas.filter((t) => ondeCai(t) === 'atrasada')
  const paraHoje = abertas.filter((t) => ondeCai(t) === 'hoje')
  const emAndamento = abertas.filter((t) => t.status === 'EM_ANDAMENTO')
  const bloqueadas = abertas.filter((t) => t.status === 'BLOQUEADA')

  const dedicacao = alocacoes.reduce((t, a) => t + a.percentual_dedicacao, 0)

  const piorAtraso = atrasadas.reduce<number>((pior, t) => {
    const dias = Math.round(
      (Date.parse(HOJE) - Date.parse(t.data_fim_prev as string)) / 86_400_000,
    )
    return Math.max(pior, dias)
  }, 0)

  const porBalde = BALDES.map((b) => ({
    ...b,
    itens: abertas
      .filter((t) => ondeCai(t) === b.chave)
      .sort((a, c) => (a.data_fim_prev ?? '9999').localeCompare(c.data_fim_prev ?? '9999')),
  })).filter((b) => b.itens.length > 0)

  return (
    <>
      <header className="cabecalho-pagina">
        <h1>Meu trabalho</h1>
        <p>
          {pessoa.nome} · {abertas.length} tarefa{abertas.length === 1 ? '' : 's'} em aberto ·{' '}
          {formatarData(HOJE)}
        </p>
      </header>

      {erro && <div className="aviso">{erro}</div>}
      {recado && <div className="aviso aviso--ok">{recado}</div>}

      <div className="painel painel--numeros">
        <FichaDeNumero
          rotulo="Atrasadas"
          numero={String(atrasadas.length)}
          apoio={piorAtraso > 0 ? `a pior com ${piorAtraso} dia${piorAtraso === 1 ? '' : 's'}` : 'nada vencido'}
          destaque={atrasadas.length === 0 ? 'bom' : piorAtraso > 15 ? 'critico' : 'serio'}
        />
        <FichaDeNumero
          rotulo="Para hoje"
          numero={String(paraHoje.length)}
          apoio={paraHoje.length === 0 ? 'nada vence hoje' : 'vencem hoje'}
        />
        <FichaDeNumero
          rotulo="Em andamento"
          numero={String(emAndamento.length)}
          apoio={bloqueadas.length > 0 ? `${bloqueadas.length} bloqueada${bloqueadas.length === 1 ? '' : 's'}` : 'nenhuma bloqueada'}
          destaque={bloqueadas.length > 0 ? 'atencao' : undefined}
        />
        <FichaDeNumero
          rotulo="Minha dedicação"
          numero={alocacoes.length === 0 ? '—' : `${dedicacao}%`}
          apoio={
            alocacoes.length === 0
              ? 'você não está alocado em nenhum projeto'
              : `em ${alocacoes.length} projeto${alocacoes.length === 1 ? '' : 's'}`
          }
          destaque={dedicacao > 100 ? 'critico' : undefined}
        />
      </div>

      {dedicacao > 100 && (
        <div className="aviso">
          A soma das suas alocações passa de 100%. Isso não impede nada — é um aviso de que o
          compromisso assumido é maior que o tempo que existe.
        </div>
      )}

      {abertas.length === 0 ? (
        <p className="vazio">
          Nenhuma tarefa em aberto com você como responsável. Se isso parece errado, veja se as
          tarefas dos seus projetos têm responsável marcado — sem isso elas não aparecem para
          ninguém.
        </p>
      ) : (
        porBalde.map((b) => (
          <section className="secao" key={b.chave}>
            <h2>
              {b.titulo} <span className="conta">{b.itens.length}</span>
              <span className="conta conta--fraca">{b.explica}</span>
            </h2>
            <div className="tabela-rolavel">
              <table>
                <thead>
                  <tr>
                    <th>Tarefa</th>
                    <th>Projeto</th>
                    <th className="data">Prazo</th>
                    <th className="direita">Feito</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {b.itens.map((t) => (
                    <tr key={t.id} className={b.chave === 'atrasada' ? 'linha-vencida' : undefined}>
                      <td>
                        {t.nome}
                        {t.marco && <span className="marca-etapa">marco</span>}
                      </td>
                      <td>
                        <button
                          className="voltar"
                          onClick={() => aoAbrir(t.projeto_id)}
                          title={t.projeto_nome}
                        >
                          <i className="ponto-tipo" style={{ background: t.projeto_cor }} />
                          {t.projeto_codigo}
                        </button>
                      </td>
                      <td className="dado">{formatarData(t.data_fim_prev)}</td>
                      <td className="num direita">{t.percentual_concluido}%</td>
                      <td>
                        <select
                          className="campo campo--situacao"
                          value={t.status}
                          aria-label={`Situação de ${t.nome}`}
                          onChange={(e) => mudarStatus(t, e.target.value)}
                        >
                          {STATUS_TAREFA.filter((s) => s !== 'CANCELADA').map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {alocacoes.length > 0 && (
        <section className="secao">
          <h2>Onde estou alocado <span className="conta">{alocacoes.length}</span></h2>
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Papel</th>
                  <th className="direita">Dedicação</th>
                  <th className="data">De</th>
                  <th className="data">Até</th>
                </tr>
              </thead>
              <tbody>
                {alocacoes.map((a) => (
                  <tr key={a.id} className="linha-clicavel" onClick={() => aoAbrir(a.projeto_id)}>
                    <td>
                      <span className="dado">{a.projeto_codigo}</span> {a.projeto_nome}
                    </td>
                    <td>{a.papel ?? '—'}</td>
                    <td className="num direita">{a.percentual_dedicacao}%</td>
                    <td className="dado">{formatarData(a.data_inicio)}</td>
                    <td className="dado">{formatarData(a.data_fim)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Somado</td>
                  <td className="num direita">{dedicacao}%</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {concluidas.length > 0 && (
        <section className="secao">
          <h2>
            Concluídas <span className="conta">{concluidas.length}</span>
            <button className="voltar conta" onClick={() => setMostrarConcluidas(!mostrarConcluidas)}>
              {mostrarConcluidas ? 'esconder' : 'mostrar'}
            </button>
          </h2>
          {mostrarConcluidas && (
            <div className="tabela-rolavel">
              <table>
                <thead>
                  <tr>
                    <th>Tarefa</th>
                    <th>Projeto</th>
                    <th className="data">Prazo</th>
                    <th className="data">Fim real</th>
                  </tr>
                </thead>
                <tbody>
                  {concluidas.map((t) => (
                    <tr key={t.id}>
                      <td>{t.nome}</td>
                      <td className="dado">{t.projeto_codigo}</td>
                      <td className="dado">{formatarData(t.data_fim_prev)}</td>
                      <td className="dado">{formatarData(t.data_fim_real)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  )
}
