import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Etapa, Projeto, Tarefa } from '../lib/banco'
import { Grafico } from './Grafico'
import { data as formatarData } from '../lib/formato'

/**
 * O acompanhamento de um projeto no tempo.
 *
 * Três perguntas, três desenhos — e nenhum gráfico com dois eixos y:
 *
 *   quando   a linha do tempo das tarefas, do início ao fim previsto;
 *   quanto   o avanço de cada etapa, com o peso ao lado — avançar 90% de uma
 *            etapa que pesa 5 não é o mesmo que 10% da que pesa 55;
 *   e daí    prazo, avanço e atraso, que é o que se olha antes de perguntar
 *            "como estamos".
 *
 * As datas moram na TAREFA, não na etapa: é onde o modelo as colocou, e é de
 * onde o Gantt da Fase 2 vai ler. Aqui elas só são desenhadas.
 *
 * O avanço por etapa é MEDIDOR, não gráfico de barra. Recharts não desenha
 * retângulo de valor zero — medido: zero retângulos num projeto recém-criado —
 * então o gráfico ficava vazio justamente no caso mais comum. Barra de
 * progresso com trilho lê bem em 0% e não depende de biblioteca nenhuma.
 */

const DIA = 24 * 60 * 60 * 1000

/** Data ISO para dia inteiro, sem passar por fuso. */
function paraDia(iso: string | null): number | null {
  if (!iso) return null
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(a, m - 1, d) / DIA
}

const ROTULO_STATUS: Record<string, string> = {
  NAO_INICIADA: 'não iniciada',
  EM_ANDAMENTO: 'em andamento',
  BLOQUEADA: 'bloqueada',
  CONCLUIDA: 'concluída',
  CANCELADA: 'cancelada',
}

/** Cada situação com a sua cor de estado — que nunca anda sem o rótulo. */
const COR_STATUS: Record<string, string> = {
  NAO_INICIADA: 'var(--linha)',
  EM_ANDAMENTO: 'var(--g1)',
  BLOQUEADA: 'var(--st-critico)',
  CONCLUIDA: 'var(--st-bom)',
  CANCELADA: 'var(--apagado)',
}

export function AcompanhamentoDoProjeto({
  projeto, etapas, tarefas,
}: {
  projeto: Projeto
  etapas: Etapa[]
  tarefas: Tarefa[]
}) {
  const hoje = Math.floor(Date.now() / DIA)

  // ---------------------------------------------------------- linha do tempo
  const comData = tarefas.filter((t) => t.data_inicio_prev && t.data_fim_prev)
  const dias = comData
    .flatMap((t) => [paraDia(t.data_inicio_prev), paraDia(t.data_fim_prev)])
    .filter((d): d is number => d !== null)
  const origem = dias.length > 0 ? Math.min(...dias) : hoje

  const linhaDoTempo = comData
    .slice()
    .sort((a, b) => (paraDia(a.data_inicio_prev) ?? 0) - (paraDia(b.data_inicio_prev) ?? 0))
    .map((t) => {
      const ini = (paraDia(t.data_inicio_prev) ?? origem) - origem
      const fim = (paraDia(t.data_fim_prev) ?? origem) - origem
      return {
        nome: t.nome,
        antes: ini,
        previsto: Math.max(1, fim - ini + 1),
        concluido: t.percentual_concluido,
        status: t.status,
        inicioTexto: formatarData(t.data_inicio_prev),
        fimTexto: formatarData(t.data_fim_prev),
      }
    })

  const diaParaTexto = (d: number) => {
    const data = new Date((origem + d) * DIA)
    return `${String(data.getUTCDate()).padStart(2, '0')}/${String(data.getUTCMonth() + 1).padStart(2, '0')}`
  }

  // ------------------------------------------------------------------ avanço
  const folhas = etapas.filter((e) => e.folha || etapas.every((x) => x.pai_id !== e.id))
  const avanco = folhas
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((e) => ({
      nome: e.nome,
      codigo: e.codigo ?? '',
      concluido: Number(e.percentual_concluido ?? 0),
      peso: Number(e.peso_percentual ?? 0),
    }))

  const pesoTotal = avanco.reduce((t, e) => t + e.peso, 0)
  const avancoPonderado =
    pesoTotal > 0
      ? avanco.reduce((t, e) => t + (e.concluido * e.peso) / pesoTotal, 0)
      : avanco.length > 0
        ? avanco.reduce((t, e) => t + e.concluido, 0) / avanco.length
        : 0

  // ------------------------------------------------------------------- prazo
  const fimPrevisto = paraDia(projeto.data_fim_prev)
  const diasParaOFim = fimPrevisto !== null ? fimPrevisto - hoje : null
  const atrasadas = tarefas
    .filter(
      (t) =>
        t.status !== 'CONCLUIDA' &&
        t.status !== 'CANCELADA' &&
        t.data_fim_prev !== null &&
        (paraDia(t.data_fim_prev) ?? hoje) < hoje,
    )
    .sort((a, b) => (paraDia(a.data_fim_prev) ?? 0) - (paraDia(b.data_fim_prev) ?? 0))

  // ------------------------------------------------------ situação das tarefas
  const porStatus = [...new Set(tarefas.map((t) => t.status))]
    .map((s) => ({ status: s, n: tarefas.filter((t) => t.status === s).length }))
    .sort((a, b) => b.n - a.n)

  return (
    <>
      {/* Os três números que se olha antes de qualquer gráfico. */}
      <div className="painel painel--numeros">
        <div className="ficha-numero">
          <span className="rotulo">Prazo</span>
          {diasParaOFim === null ? (
            <>
              <span className="numero">—</span>
              <span className="apoio">sem data de fim prevista</span>
            </>
          ) : (
            <>
              <span
                className="numero"
                style={{ color: diasParaOFim < 0 ? 'var(--st-critico)' : undefined }}
              >
                {Math.abs(diasParaOFim)} d
              </span>
              <span className="apoio">
                {diasParaOFim < 0 ? 'depois do previsto' : 'até o fim previsto'} ·{' '}
                {formatarData(projeto.data_fim_prev)}
              </span>
            </>
          )}
        </div>

        <div className="ficha-numero">
          <span className="rotulo">Avanço físico</span>
          <span className="numero">
            {avancoPonderado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
          </span>
          <span className="apoio">
            {pesoTotal > 0
              ? 'ponderado pelo peso das etapas'
              : 'média simples — nenhum peso definido'}
          </span>
        </div>

        <div className="ficha-numero">
          <span className="rotulo">Tarefas atrasadas</span>
          <span
            className="numero"
            style={{ color: atrasadas.length > 0 ? 'var(--st-serio)' : undefined }}
          >
            {atrasadas.length}
          </span>
          <span className="apoio">
            {atrasadas.length > 0
              ? `a pior venceu em ${formatarData(atrasadas[0].data_fim_prev)}`
              : `de ${tarefas.length} tarefa${tarefas.length === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>

      <div className="painel">
        <Grafico
          titulo="Linha do tempo"
          nota={
            comData.length === 0
              ? undefined
              : 'Cada barra é uma tarefa, do início ao fim previsto. Dias úteis, sem feriado — o calendário é da Fase 2.'
          }
          vazio={
            comData.length === 0
              ? 'Nenhuma tarefa com data prevista. As tarefas geradas pelo modelo do tipo já nascem com prazo; estas vieram da importação, e o desktop não guardava datas.'
              : undefined
          }
          colunas={['Tarefa', 'Início', 'Fim', 'Situação']}
          linhas={linhaDoTempo.map((l) => [
            l.nome, l.inicioTexto, l.fimTexto, ROTULO_STATUS[l.status] ?? l.status,
          ])}
        >
          <ResponsiveContainer width="100%" height={Math.max(180, linhaDoTempo.length * 44)}>
            <BarChart
              data={linhaDoTempo} layout="vertical"
              margin={{ top: 8, right: 24, bottom: 4, left: 8 }}
            >
              <CartesianGrid stroke="var(--g-grade)" horizontal={false} />
              <XAxis
                type="number" tick={{ stroke: 'var(--g-eixo)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--g-eixo)' }} tickLine={false}
                tickFormatter={diaParaTexto}
              />
              <YAxis
                type="category" dataKey="nome" width={170}
                tick={{ stroke: 'var(--g-eixo)', fontSize: 11 }} axisLine={false} tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--g-vazio)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const l = payload[0].payload as (typeof linhaDoTempo)[number]
                  return (
                    <div className="dica-grafico">
                      <b>{l.nome}</b>
                      <div>{l.inicioTexto} → {l.fimTexto}</div>
                      <div>{ROTULO_STATUS[l.status] ?? l.status} · {l.concluido}%</div>
                    </div>
                  )
                }}
              />
              {/* O primeiro pedaço não é dado: é o espaço até a barra começar. */}
              <Bar dataKey="antes" stackId="t" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="previsto" stackId="t" radius={[0, 3, 3, 0]} fill="var(--g1)" />
            </BarChart>
          </ResponsiveContainer>
        </Grafico>

        <section className="cartao-grafico">
          <header>
            <h3>Avanço por etapa</h3>
            <span className="nota">
              {avancoPonderado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do projeto
            </span>
          </header>

          {avanco.length === 0 ? (
            <p className="vazio">Nenhuma etapa cadastrada — não há o que acompanhar ainda.</p>
          ) : (
            <ul className="medidores">
              {avanco.map((e, i) => (
                <li key={i}>
                  <div className="medidor-topo">
                    <span><span className="dado">{e.codigo}</span> {e.nome}</span>
                    <span className="num">{e.concluido.toLocaleString('pt-BR')}%</span>
                  </div>
                  <div
                    className="trilha"
                    role="meter"
                    aria-valuenow={Math.round(e.concluido)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={e.nome}
                  >
                    <span style={{ width: `${Math.min(100, Math.max(0, e.concluido))}%` }} />
                  </div>
                  <span className="apoio">peso {e.peso.toLocaleString('pt-BR')}% do projeto</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {tarefas.length > 0 && (
        <section className="cartao-grafico">
          <header>
            <h3>Situação das tarefas</h3>
            <span className="nota">{tarefas.length} no total</span>
          </header>
          {/* Uma barra empilhada: a proporção se lê de relance, e cada pedaço
              leva rótulo e número na legenda — cor nunca sozinha. */}
          <div className="barra-situacao">
            {porStatus.map((s) => (
              <span
                key={s.status}
                style={{
                  width: `${(s.n / tarefas.length) * 100}%`,
                  background: COR_STATUS[s.status] ?? 'var(--g-vazio)',
                }}
                title={`${ROTULO_STATUS[s.status] ?? s.status}: ${s.n}`}
              />
            ))}
          </div>
          <div className="legenda">
            {porStatus.map((s) => (
              <span key={s.status}>
                <i style={{ background: COR_STATUS[s.status] ?? 'var(--g-vazio)' }} />
                {ROTULO_STATUS[s.status] ?? s.status} <strong className="num">{s.n}</strong>
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
