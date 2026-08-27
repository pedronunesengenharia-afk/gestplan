import { useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import {
  avancoDosProjetos, capacidadeDaEquipe, carteiraFiltrada, curvaS,
  custoPorCategoria, fluxoMensal, possoVerValores, projetosARetomar,
  tarefasAtrasadas,
  type LinhaAvanco, type LinhaCapacidade, type LinhaCurvaS, type LinhaFluxo,
  type ProjetoARetomar, type Projeto, type TarefaAtrasada,
} from '../lib/banco'
import { EsqueletoDeFichas } from '../componentes/Esqueleto'
import { FichaDeNumero, Grafico, type Serie } from '../componentes/Grafico'
import { competencia as formatarCompetencia, data as formatarData, moeda } from '../lib/formato'

/**
 * O painel da carteira.
 *
 * Consome as seis views que já existiam e nenhuma tela lia. A conta pesada é
 * do Postgres; aqui só se soma o que era por projeto e se desenha.
 *
 * Nenhuma cor é escrita neste arquivo: todas saem de `graficos.css`, onde a
 * paleta passou pelos seis checks do validador nos dois temas. Cor inventada
 * aqui quebraria a separação que um daltônico depende para ler o gráfico.
 */

const EIXO = { stroke: 'var(--g-eixo)', fontSize: 11 }
const GRADE = 'var(--g-grade)'

/** Dica única do painel: mesma moldura, mesmos números tabulares. */
function Dica({ active, payload, label, prefixo }: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string; payload?: Record<string, unknown> }[]
  label?: string | number
  prefixo?: (v: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="dica-grafico">
      <b>{label}</b>
      {payload.map((p, i) => (
        <div key={i}>
          {p.name}: {prefixo ? prefixo(Number(p.value ?? 0)) : String(p.value)}
        </div>
      ))}
    </div>
  )
}

export function Painel({ aoAbrir }: { aoAbrir: (id: string) => void }) {
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [curva, setCurva] = useState<LinhaCurvaS[]>([])
  const [fluxo, setFluxo] = useState<LinhaFluxo[]>([])
  const [avanco, setAvanco] = useState<LinhaAvanco[]>([])
  const [capacidade, setCapacidade] = useState<LinhaCapacidade[]>([])
  const [atrasadas, setAtrasadas] = useState<TarefaAtrasada[]>([])
  const [retomar, setRetomar] = useState<ProjetoARetomar[]>([])
  const [categorias, setCategorias] = useState<{ nome: string; valor: number }[]>([])
  const [veDinheiro, setVeDinheiro] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    const buscar = async () => {
      const ps = await carteiraFiltrada({})
      if (!vivo) return
      setProjetos(ps)

      // O alcance financeiro se pergunta uma vez, por um projeto qualquer da
      // carteira: a regra é por projeto, mas quem não alcança nenhum não
      // alcança este também. Sem carteira, não há dinheiro a mostrar.
      const alcanca = ps.length > 0 ? await possoVerValores(ps[0].id) : false
      if (!vivo) return
      setVeDinheiro(alcanca)

      const [c, f, a, cap, at, ret, cat] = await Promise.all([
        curvaS(),
        fluxoMensal(),
        avancoDosProjetos(),
        capacidadeDaEquipe(),
        tarefasAtrasadas(),
        projetosARetomar(),
        alcanca ? custoPorCategoria() : Promise.resolve([]),
      ])
      if (!vivo) return
      setCurva(c)
      setFluxo(f)
      setAvanco(a)
      setCapacidade(cap)
      setAtrasadas(at)
      setRetomar(ret)
      setCategorias(cat)
    }
    buscar()
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [])

  if (carregando) return <EsqueletoDeFichas quantas={5} />

  const ativos = projetos.filter((p) => p.ativo)
  const orcado = ativos.reduce((t, p) => t + (p.valor_orcado ?? 0), 0)
  const realizado = ativos.reduce((t, p) => t + (p.valor_realizado ?? 0), 0)
  const urgentes = ativos.filter((p) => p.prioridade === 'URGENTE').length
  const consumo = orcado > 0 ? (realizado / orcado) * 100 : 0

  // --- curva S: somar os projetos por competência, e acumular ---------------
  const porMes = new Map<string, { base: number; previsto: number; realizado: number }>()
  let curvaSemCompetencia = 0
  for (const l of curva) {
    // Linha sem competência não tem onde ser desenhada numa série temporal —
    // e uma chave nula derrubava a tela inteira na ordenação.
    if (!l.competencia) {
      curvaSemCompetencia += 1
      continue
    }
    const m = porMes.get(l.competencia) ?? { base: 0, previsto: 0, realizado: 0 }
    m.base += Number(l.base_mes ?? 0)
    m.previsto += Number(l.previsto_mes ?? 0)
    m.realizado += Number(l.realizado_mes ?? 0)
    porMes.set(l.competencia, m)
  }
  let ab = 0
  let ap = 0
  let ar = 0
  const dadosCurva = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => {
      ab += v.base
      ap += v.previsto
      ar += v.realizado
      return { mes: formatarCompetencia(mes), base: ab, previsto: ap, realizado: ar }
    })
  const seriesCurva: Serie[] = [
    { chave: 'base', nome: 'Linha de base', cor: 'var(--g4)' },
    { chave: 'previsto', nome: 'Previsto', cor: 'var(--g1)' },
    { chave: 'realizado', nome: 'Realizado', cor: 'var(--g2)' },
  ]
  const semBase = dadosCurva.every((d) => d.base === 0 && d.previsto === 0)

  // --- fluxo mensal ---------------------------------------------------------
  const fluxoPorMes = new Map<string, { pago: number; aPagar: number; vencido: number }>()
  let parcelasSemData = 0
  for (const l of fluxo) {
    if (!l.competencia) {
      parcelasSemData += Number(l.parcelas ?? 0)
      continue
    }
    const m = fluxoPorMes.get(l.competencia) ?? { pago: 0, aPagar: 0, vencido: 0 }
    m.pago += Number(l.pago ?? 0)
    m.aPagar += Number(l.a_pagar ?? 0)
    m.vencido += Number(l.vencido ?? 0)
    fluxoPorMes.set(l.competencia, m)
  }
  const dadosFluxo = [...fluxoPorMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({ mes: formatarCompetencia(mes), ...v }))
  const seriesFluxo: Serie[] = [
    { chave: 'pago', nome: 'Pago', cor: 'var(--st-bom)' },
    { chave: 'aPagar', nome: 'Em aberto no prazo', cor: 'var(--g1)' },
    { chave: 'vencido', nome: 'Vencido', cor: 'var(--st-critico)' },
  ]

  // --- magnitudes: frente e categoria ---------------------------------------
  const porFrente = new Map<string, number>()
  for (const p of ativos) {
    const f = p.frente ?? 'Sem frente'
    porFrente.set(f, (porFrente.get(f) ?? 0) + 1)
  }
  const dadosFrente = [...porFrente.entries()]
    .map(([nome, n]) => ({ nome, n }))
    .sort((a, b) => b.n - a.n)

  /** Sequencial: cinco passos, do mais claro ao mais escuro, por posição. */
  const passo = (i: number, total: number) =>
    `var(--seq${Math.max(1, 5 - Math.floor((i / Math.max(1, total)) * 5))})`

  // --- avanço × desembolso --------------------------------------------------
  const avancoDe = new Map(avanco.map((a) => [a.projeto_id, Number(a.avanco_fisico ?? 0)]))
  const dispersao = ativos
    .filter((p) => (p.valor_orcado ?? 0) > 0)
    .map((p) => ({
      codigo: p.codigo,
      nome: p.nome,
      id: p.id,
      desembolso: ((p.valor_realizado ?? 0) / (p.valor_orcado ?? 1)) * 100,
      fisico: avancoDe.get(p.id) ?? 0,
    }))
  // Rotulado direto só quem sai da faixa de equilíbrio; o resto fica na dica.
  const foraDaFaixa = dispersao.filter((d) => Math.abs(d.fisico - d.desembolso) > 20)

  const piorRetomada = retomar[0]

  return (
    <>
      <header className="cabecalho-pagina">
        <h1>Painel</h1>
        <p>
          {ativos.length} projeto{ativos.length === 1 ? '' : 's'} ativo
          {ativos.length === 1 ? '' : 's'} · {formatarData(new Date().toISOString().slice(0, 10))}
        </p>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      {/* ---------------- FAIXA 1 · números ---------------- */}
      <div className="painel">
        <FichaDeNumero
          rotulo="Projetos ativos"
          numero={String(ativos.length)}
          apoio={`${urgentes} urgente${urgentes === 1 ? '' : 's'}`}
        />

        {veDinheiro && (
          <FichaDeNumero rotulo="Orçado na carteira" numero={moeda(orcado)} />
        )}

        {veDinheiro && (
          <FichaDeNumero
            rotulo="Desembolsado"
            numero={moeda(realizado)}
            apoio={`${consumo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do orçado`}
          />
        )}

        <FichaDeNumero
          rotulo="Tarefas atrasadas"
          numero={String(atrasadas.length)}
          apoio={
            atrasadas.length > 0
              ? `pior: ${atrasadas[0].dias_atraso} dias — ${atrasadas[0].projeto_codigo}`
              : 'nenhuma tarefa vencida'
          }
          destaque={atrasadas.length > 0 ? 'serio' : undefined}
        />

        <FichaDeNumero
          rotulo="A retomar"
          numero={String(retomar.length)}
          apoio={
            piorRetomada
              ? `${piorRetomada.codigo} — ${piorRetomada.dias} dias`
              : 'nenhum projeto postergado com data'
          }
          destaque={retomar.length > 0 ? 'atencao' : undefined}
        />
      </div>

      {/* ---------------- FAIXA 2 · curva S e fluxo ---------------- */}
      <div className="painel">
        <Grafico
          titulo="Curva S da carteira"
          nota={
            (semBase
              ? 'Nenhum projeto tem linha de base nem desembolso previsto gravado: as duas séries ficam em zero, e só o realizado tem o que mostrar.'
              : 'Acumulado por competência, somando os projetos.') +
            (curvaSemCompetencia > 0
              ? ` ${curvaSemCompetencia} lançamento(s) sem competência ficaram de fora.`
              : '')
          }
          series={seriesCurva}
          vazio={dadosCurva.length === 0 ? 'Nenhum custo lançado ainda — a curva começa no primeiro pagamento.' : undefined}
          colunas={['Competência', 'Base', 'Previsto', 'Realizado']}
          linhas={dadosCurva.map((d) => [d.mes, moeda(d.base), moeda(d.previsto), moeda(d.realizado)])}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dadosCurva} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={GRADE} vertical={false} />
              <XAxis dataKey="mes" tick={EIXO} axisLine={{ stroke: 'var(--g-eixo)' }} tickLine={false} />
              <YAxis
                tick={EIXO} axisLine={false} tickLine={false} width={72}
                tickFormatter={(v: number) => (v / 1000).toLocaleString('pt-BR') + ' mil'}
              />
              <Tooltip content={<Dica prefixo={moeda} />} cursor={{ stroke: 'var(--g-eixo)' }} />
              {seriesCurva.map((s) => (
                <Line
                  key={s.chave} type="monotone" dataKey={s.chave} name={s.nome}
                  stroke={s.cor} strokeWidth={2} dot={false} activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Grafico>

        <Grafico
          titulo="Fluxo mensal"
          nota={
            parcelasSemData > 0
              ? `${parcelasSemData} parcelas são REGRA, não data — "40% na aprovação, 30 dias". Elas entram no fluxo quando o evento acontecer e o vencimento existir.`
              : 'Por competência, empilhado.'
          }
          series={seriesFluxo}
          vazio={
            dadosFluxo.length === 0
              ? 'Nenhuma parcela tem vencimento ainda, então não há competência para empilhar.'
              : undefined
          }
          colunas={['Competência', 'Pago', 'Em aberto', 'Vencido']}
          linhas={dadosFluxo.map((d) => [d.mes, moeda(d.pago), moeda(d.aPagar), moeda(d.vencido)])}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dadosFluxo} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={GRADE} vertical={false} />
              <XAxis dataKey="mes" tick={EIXO} axisLine={{ stroke: 'var(--g-eixo)' }} tickLine={false} />
              <YAxis
                tick={EIXO} axisLine={false} tickLine={false} width={72}
                tickFormatter={(v: number) => (v / 1000).toLocaleString('pt-BR') + ' mil'}
              />
              <Tooltip content={<Dica prefixo={moeda} />} cursor={{ fill: 'var(--g-vazio)' }} />
              {seriesFluxo.map((s) => (
                <Bar
                  key={s.chave} dataKey={s.chave} name={s.nome} stackId="fluxo"
                  fill={s.cor} stroke="var(--superficie)" strokeWidth={2}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </div>

      {/* ---------------- FAIXA 3 · magnitudes ---------------- */}
      <div className="painel">
        <Grafico
          titulo="Carteira por frente"
          nota="Projetos ativos agrupados por frente de serviço."
          vazio={dadosFrente.length === 0 ? 'Nenhum projeto ativo.' : undefined}
          colunas={['Frente', 'Projetos']}
          linhas={dadosFrente.map((d) => [d.nome, d.n])}
        >
          <ResponsiveContainer width="100%" height={Math.max(180, dadosFrente.length * 34)}>
            <BarChart data={dadosFrente} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={GRADE} horizontal={false} />
              <XAxis type="number" tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="nome" tick={EIXO} axisLine={false} tickLine={false} width={150} />
              <Tooltip content={<Dica />} cursor={{ fill: 'var(--g-vazio)' }} />
              <Bar dataKey="n" name="Projetos" radius={[0, 2, 2, 0]}>
                {dadosFrente.map((_, i) => (
                  <Cell key={i} fill={passo(i, dadosFrente.length)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Grafico>

        <Grafico
          titulo="Custo por categoria"
          nota="Custo realizado, somado por categoria."
          vazio={
            !veDinheiro
              ? 'Você não tem alcance financeiro nesta carteira.'
              : categorias.length === 0
                ? 'Nenhum custo lançado ainda.'
                : undefined
          }
          colunas={['Categoria', 'Custo']}
          linhas={categorias.map((c) => [c.nome, moeda(c.valor)])}
        >
          <ResponsiveContainer width="100%" height={Math.max(180, categorias.length * 34)}>
            <BarChart data={categorias} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={GRADE} horizontal={false} />
              <XAxis
                type="number" tick={EIXO} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => (v / 1000).toLocaleString('pt-BR') + ' mil'}
              />
              <YAxis type="category" dataKey="nome" tick={EIXO} axisLine={false} tickLine={false} width={150} />
              <Tooltip content={<Dica prefixo={moeda} />} cursor={{ fill: 'var(--g-vazio)' }} />
              <Bar dataKey="valor" name="Custo" radius={[0, 2, 2, 0]}>
                {categorias.map((_, i) => (
                  <Cell key={i} fill={passo(i, categorias.length)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </div>

      {/* ---------------- FAIXA 4 · avanço x desembolso ---------------- */}
      <div className="painel">
        <Grafico
          largo
          titulo="Avanço físico × desembolso"
          nota={
            avanco.every((a) => Number(a.avanco_fisico ?? 0) === 0)
              ? 'Nenhuma etapa tem percentual concluído lançado, então todos os pontos ficam na base do gráfico. A diagonal marca o equilíbrio: acima dela o projeto entrega mais do que gasta.'
              : 'Acima da diagonal, entrega mais do que gasta; abaixo, gasta mais do que entrega.'
          }
          vazio={
            !veDinheiro
              ? 'Sem alcance financeiro não há desembolso para comparar com o avanço.'
              : dispersao.length === 0
                ? 'Nenhum projeto com orçamento lançado.'
                : undefined
          }
          colunas={['Projeto', 'Desembolso %', 'Avanço %']}
          linhas={dispersao.map((d) => [
            `${d.codigo} ${d.nome}`,
            d.desembolso.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
            d.fisico.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
          ])}
        >
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 12, right: 24, bottom: 24, left: 8 }}>
              <CartesianGrid stroke={GRADE} />
              <XAxis
                type="number" dataKey="desembolso" name="Desembolsado" unit="%"
                domain={[0, 100]} tick={EIXO} axisLine={{ stroke: 'var(--g-eixo)' }} tickLine={false}
              />
              <YAxis
                type="number" dataKey="fisico" name="Avanço físico" unit="%"
                domain={[0, 100]} tick={EIXO} axisLine={false} tickLine={false} width={56}
              />
              <ZAxis range={[80, 80]} />
              {/* O equilíbrio, tênue: é referência, não dado. */}
              <ReferenceLine
                segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
                stroke="var(--g-eixo)" strokeDasharray="4 4"
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: 'var(--g-eixo)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as (typeof dispersao)[number]
                  return (
                    <div className="dica-grafico">
                      <b>{d.codigo}</b>
                      <div>{d.nome}</div>
                      <div>
                        desembolsado {d.desembolso.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                        {' · '}avanço {d.fisico.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                      </div>
                    </div>
                  )
                }}
              />
              <Scatter
                name="Projetos" data={dispersao} fill="var(--g1)"
                onClick={(p: unknown) => aoAbrir((p as { id: string }).id)}
              />
              {foraDaFaixa.length > 0 && (
                <Scatter name="Fora da faixa" data={foraDaFaixa} fill="var(--g2)" />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </Grafico>
      </div>

      {/* ---------------- capacidade e atrasos ---------------- */}
      <div className="painel">
        <Grafico
          titulo="Capacidade da equipe"
          nota="Dedicação somada por pessoa, entre projetos ativos."
          vazio={
            capacidade.length === 0
              ? 'Sem alocação ativa: ninguém foi alocado a projeto nenhum ainda, então não há dedicação a somar.'
              : undefined
          }
          colunas={['Pessoa', 'Projetos', 'Dedicação %']}
          linhas={capacidade.map((c) => [c.pessoa_nome, c.projetos, c.dedicacao_total])}
        >
          <ResponsiveContainer width="100%" height={Math.max(180, capacidade.length * 34)}>
            <BarChart data={capacidade} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={GRADE} horizontal={false} />
              <XAxis type="number" tick={EIXO} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="pessoa_nome" tick={EIXO} axisLine={false} tickLine={false} width={150} />
              <Tooltip content={<Dica />} cursor={{ fill: 'var(--g-vazio)' }} />
              <Bar dataKey="dedicacao_total" name="Dedicação">
                {capacidade.map((c, i) => (
                  <Cell key={i} fill={c.sobrealocada ? 'var(--st-critico)' : 'var(--g1)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Grafico>

        <section className="cartao-grafico">
          <header>
            <h3>Tarefas atrasadas</h3>
          </header>
          {atrasadas.length === 0 ? (
            <p className="vazio">Nenhuma tarefa vencida — o que, com 130 tarefas sem data, diz menos do que parece.</p>
          ) : (
            <div className="tabela-rolavel">
              <table>
                <thead>
                  <tr>
                    <th>Projeto</th>
                    <th>Tarefa</th>
                    <th>Responsável</th>
                    <th className="direita">Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {atrasadas.map((t) => (
                    <tr
                      key={t.id} className="linha-clicavel" onClick={() => aoAbrir(t.projeto_id)}
                      tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && aoAbrir(t.projeto_id)}
                    >
                      <td className="dado">{t.projeto_codigo}</td>
                      <td>
                        {t.nome}
                        {t.caminho_critico && <span className="marca-etapa">caminho crítico</span>}
                      </td>
                      <td>{t.responsavel_nome ?? '—'}</td>
                      <td className="num direita" style={{ color: 'var(--st-serio)' }}>
                        {t.dias_atraso} d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
