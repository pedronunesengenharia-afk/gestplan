import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Grafico } from './Grafico'
import type { Afazer } from '../lib/banco'

/**
 * Quanto foi concluído por dia, nos últimos catorze.
 *
 * NÃO PRECISOU DE CONSULTA NOVA NEM DE COLUNA NOVA: `afazer.feito_em` é
 * `timestamptz` desde o primeiro dia, e o comentário da migração já dizia por
 * quê — "instante, não dia: serve para saber quando foi feito". A página já
 * carrega a lista inteira da pessoa, concluídos inclusive, porque é deles que
 * sai o "mostrar concluídos". Então a conta é aqui mesmo: são dezenas de
 * linhas, não milhares.
 *
 * O DIA É O LOCAL, e isso não é detalhe. `feito_em` é UTC; um item marcado às
 * 21h de Brasília vira 00h do dia seguinte em UTC. Usar `toISOString().slice`
 * — o jeito curto e o errado — jogaria no amanhã tudo que se fez depois das
 * 21h, que é justamente quando alguém fecha o dia.
 *
 * Conta TODAS as listas, e o rótulo diz isso. O quadro é por empresa, mas "o
 * que eu fiz hoje" é uma pergunta sobre a pessoa, não sobre a empresa: quem
 * trabalhou em três empresas fez o dia inteiro, e um gráfico por lista diria
 * que fez um terço.
 */

const DIAS = 14

/** O dia local de um instante, como 'aaaa-mm-dd'. Ver a nota acima. */
function diaLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

export function FeitoNoDia({ itens }: { itens: Afazer[] }) {
  const porDia = new Map<string, number>()
  for (const i of itens) {
    if (!i.feito_em) continue
    const chave = diaLocal(new Date(i.feito_em))
    porDia.set(chave, (porDia.get(chave) ?? 0) + 1)
  }

  const hoje = new Date()
  const dias: {
    dia: string; rotulo: string; longo: string; feitos: number; ehHoje: boolean
  }[] = []
  for (let atras = DIAS - 1; atras >= 0; atras--) {
    const d = new Date(hoje)
    d.setDate(d.getDate() - atras)
    const chave = diaLocal(d)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    dias.push({
      dia: chave,
      // So o dia no eixo: catorze rotulos de 'dd/mm' se atropelam num celular
      // de 360px. A data inteira fica na dica e no "ver tabela".
      rotulo: dd,
      longo: `${dd}/${mm}`,
      feitos: porDia.get(chave) ?? 0,
      ehHoje: atras === 0,
    })
  }

  const deHoje = dias[dias.length - 1].feitos
  const total = dias.reduce((t, d) => t + d.feitos, 0)

  const nota =
    total === 0
      ? 'Todas as listas.'
      : `${deHoje} hoje · ${total} em ${DIAS} dias · todas as listas.`

  return (
    <Grafico
      titulo="Concluídos por dia"
      nota={nota}
      vazio={total === 0 ? `Nada concluído nos últimos ${DIAS} dias.` : undefined}
      colunas={['Dia', 'Concluídos']}
      linhas={dias.map((d) => [d.longo, d.feitos])}
    >
      <ResponsiveContainer width="100%" height={132}>
        <BarChart data={dias} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--g-grade)" vertical={false} />
          {/* `preserveEnd` e nao `interval={0}`: quando a tela e estreita o
              recharts pula rotulos em vez de empilha-los uns sobre os outros,
              e o de hoje — o unico que a pessoa procura — e o preservado. */}
          <XAxis
            dataKey="rotulo"
            tick={{ stroke: 'var(--g-eixo)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--g-eixo)' }}
            tickLine={false}
            interval="preserveEnd"
          />
          {/* `allowDecimals` desligado: meio afazer não existe, e sem isto o
              eixo mostra 0,5 nos dias de um item só. */}
          <YAxis
            tick={{ stroke: 'var(--g-eixo)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--g-vazio)' }}
            content={({ active, payload, label }) =>
              active && payload && payload.length > 0 ? (
                <div className="dica-grafico">
                  <b>{String(payload[0].payload?.longo ?? label)}</b>
                  <div>
                    {Number(payload[0].value ?? 0)} concluído
                    {Number(payload[0].value ?? 0) === 1 ? '' : 's'}
                  </div>
                </div>
              ) : null
            }
          />
          <Bar dataKey="feitos" name="Concluídos" radius={[3, 3, 0, 0]}>
            {/* Hoje em cheio, os outros em tom recessivo: o dia de hoje é a
                pergunta, o resto é a régua para responder "é muito ou pouco?". */}
            {dias.map((d) => (
              <Cell key={d.dia} fill={d.ehHoje ? 'var(--g1)' : 'var(--seq2)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Grafico>
  )
}
