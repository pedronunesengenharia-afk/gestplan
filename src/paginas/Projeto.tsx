import { useEffect, useState } from 'react'
import {
  camposDoTipo, etapasDoProjeto, fasesDoTipo, pessoas, pontuacaoDoProjeto,
  projeto as carregarProjeto, tarefasDoProjeto, tipoDeProjeto,
  type CampoDefinicao, type Etapa, type LinhaPontuacao, type Pessoa,
  type Projeto as ProjetoDado, type Tarefa, type TipoProjeto,
} from '../lib/banco'
import { data, moeda } from '../lib/formato'

const SELO: Record<string, string> = {
  URGENTE: 'selo selo--urgente',
  IMPORTANTE: 'selo selo--importante',
  PLANEJAMENTO: 'selo selo--planejamento',
}

/**
 * Como cada tipo_dado se lê. É a única coisa que a tela sabe sobre campos — e
 * o que ela sabe é o TIPO do dado, nunca o nome de um campo nem o de um tipo
 * de projeto. Campo novo em `campo_definicao` aparece aqui sem tocar no código.
 */
function valorLegivel(campo: CampoDefinicao, bruto: unknown): string {
  if (bruto === null || bruto === undefined || bruto === '') return '—'
  switch (campo.tipo_dado) {
    case 'MOEDA':
      return moeda(Number(bruto))
    case 'PERCENTUAL':
      return `${Number(bruto).toLocaleString('pt-BR')}%`
    case 'NUMERO':
      return Number(bruto).toLocaleString('pt-BR')
    case 'DATA':
      return data(String(bruto))
    case 'BOOLEANO':
      return bruto ? 'Sim' : 'Não'
    case 'SELECAO_MULTIPLA':
      return Array.isArray(bruto) ? bruto.join(', ') : String(bruto)
    default:
      return String(bruto)
  }
}

/** Achata a EAP na ordem da árvore, guardando a profundidade de cada linha. */
function emOrdemDaArvore(etapas: Etapa[]): { etapa: Etapa; profundidade: number }[] {
  const filhos = new Map<string | null, Etapa[]>()
  for (const e of etapas) {
    const chave = e.pai_id ?? null
    filhos.set(chave, [...(filhos.get(chave) ?? []), e])
  }
  for (const lista of filhos.values()) {
    lista.sort((a, b) => a.ordem - b.ordem || (a.codigo ?? '').localeCompare(b.codigo ?? ''))
  }

  const linhas: { etapa: Etapa; profundidade: number }[] = []
  const descer = (pai: string | null, profundidade: number) => {
    for (const e of filhos.get(pai) ?? []) {
      linhas.push({ etapa: e, profundidade })
      descer(e.id, profundidade + 1)
    }
  }
  descer(null, 0)

  // Etapa cujo pai a RLS não devolveu não pode sumir da tela.
  if (linhas.length < etapas.length) {
    const vistas = new Set(linhas.map((l) => l.etapa.id))
    for (const e of etapas) if (!vistas.has(e.id)) linhas.push({ etapa: e, profundidade: 0 })
  }
  return linhas
}

export function Projeto({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const [projeto, setProjeto] = useState<ProjetoDado | null>(null)
  const [tipo, setTipo] = useState<TipoProjeto | null>(null)
  const [campos, setCampos] = useState<CampoDefinicao[]>([])
  const [fases, setFases] = useState<Map<string, string>>(new Map())
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [pontos, setPontos] = useState<LinhaPontuacao[]>([])
  const [equipe, setEquipe] = useState<Map<string, Pessoa>>(new Map())
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    setErro(null)

    const buscar = async () => {
      const p = await carregarProjeto(id)
      if (!vivo) return
      setProjeto(p)
      if (!p) return

      const [t, cs, fs, es, ts, pts, gente] = await Promise.all([
        tipoDeProjeto(p.tipo_projeto_id),
        camposDoTipo(p.tipo_projeto_id),
        fasesDoTipo(p.tipo_projeto_id),
        etapasDoProjeto(p.id),
        tarefasDoProjeto(p.id),
        pontuacaoDoProjeto(p.id),
        pessoas(),
      ])
      if (!vivo) return
      setTipo(t)
      setCampos(cs)
      setFases(new Map(fs.map((f) => [f.id, f.nome])))
      setEtapas(es)
      setTarefas(ts)
      setPontos(pts)
      setEquipe(new Map(gente.map((q) => [q.id, q])))
    }

    buscar()
      .catch((e: Error) => {
        if (vivo) setErro(e.message)
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })

    return () => {
      vivo = false
    }
  }, [id])

  if (carregando) return <p className="vazio">Carregando…</p>
  if (erro) return <div className="aviso">{erro}</div>
  if (!projeto) {
    return (
      <>
        <button className="voltar" onClick={aoVoltar}>← Carteira</button>
        <p className="vazio">Este projeto não existe ou você não alcança ele.</p>
      </>
    )
  }

  // Os grupos saem na ordem em que os campos aparecem: a ordem também é dado.
  const grupos: { nome: string; campos: CampoDefinicao[] }[] = []
  for (const c of campos) {
    const grupo = grupos.find((g) => g.nome === c.grupo)
    if (grupo) grupo.campos.push(c)
    else grupos.push({ nome: c.grupo, campos: [c] })
  }

  const linhas = emOrdemDaArvore(etapas)

  // Orçamento é decisão do tipo. Valor nulo com o tipo orçando é a RLS
  // escondendo dinheiro de quem não alcança — nos dois casos, a coluna some.
  const mostraOrcamento = (tipo?.usa_orcamento ?? false) && etapas.some((e) => e.valor !== null)
  const mostraValorDoProjeto = projeto.valor_orcado !== null || projeto.valor_estimado !== null

  return (
    <>
      <button className="voltar" onClick={aoVoltar}>← Carteira</button>

      <header className="cabecalho-pagina">
        <div className="titulo-projeto">
          <span className="dado codigo-projeto">{projeto.codigo}</span>
          <h1>{projeto.nome}</h1>
        </div>
        <div className="selos">
          <span
            className="selo"
            style={{ background: projeto.tipo_cor + '22', color: projeto.tipo_cor }}
          >
            {projeto.tipo_nome}
          </span>
          <span className="selo selo--fase">{projeto.fase_nome}</span>
          <span className={SELO[projeto.prioridade]}>{projeto.prioridade}</span>
          <span className="dado pontos-total">{projeto.pontuacao_total} pontos</span>
          {projeto.seguranca && <span className="selo selo--atrasado">Segurança do trabalho</span>}
        </div>
      </header>

      <dl className="ficha">
        <div><dt>Empresa</dt><dd>{projeto.empresa_nome}</dd></div>
        <div><dt>Gerente</dt><dd>{projeto.gerente_nome ?? '—'}</dd></div>
        <div><dt>Frente</dt><dd>{projeto.frente ?? '—'}</dd></div>
        <div><dt>Início previsto</dt><dd className="dado">{data(projeto.data_inicio_prev)}</dd></div>
        <div><dt>Fim previsto</dt><dd className="dado">{data(projeto.data_fim_prev)}</dd></div>
        <div><dt>Fim real</dt><dd className="dado">{data(projeto.data_fim_real)}</dd></div>
        {mostraValorDoProjeto && (
          <>
            <div><dt>Estimado</dt><dd className="num">{moeda(projeto.valor_estimado)}</dd></div>
            <div><dt>Orçado</dt><dd className="num">{moeda(projeto.valor_orcado)}</dd></div>
            <div><dt>Realizado</dt><dd className="num">{moeda(projeto.valor_realizado)}</dd></div>
          </>
        )}
      </dl>

      {grupos.map((g) => (
        <section className="secao" key={g.nome}>
          <h2>{g.nome}</h2>
          <dl className="campos">
            {g.campos.map((c) => {
              const exige = c.exigido_para_sair_de ? fases.get(c.exigido_para_sair_de) : null
              const bruto = projeto.campos?.[c.codigo]
              const vazio = bruto === undefined || bruto === null || bruto === ''
              return (
                <div className="campo-linha" key={c.id}>
                  <dt>
                    {c.rotulo}
                    {exige && (
                      <span
                        className="exigencia"
                        title={`Precisa estar preenchido para o projeto sair da fase ${exige}`}
                      >
                        exigido para sair de {exige}
                      </span>
                    )}
                  </dt>
                  <dd className={vazio ? 'campo-vazio' : undefined}>{valorLegivel(c, bruto)}</dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}

      <section className="secao">
        <h2>Etapas <span className="conta">{etapas.length}</span></h2>
        {etapas.length === 0 ? (
          <p className="vazio">Nenhuma etapa cadastrada.</p>
        ) : (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Etapa</th>
                  {mostraOrcamento && <th>Un.</th>}
                  {mostraOrcamento && <th className="direita">Qtd.</th>}
                  {mostraOrcamento && <th className="direita">Preço unit.</th>}
                  {mostraOrcamento && <th className="direita">Valor</th>}
                  <th className="direita">Concluído</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ etapa: e, profundidade }) => (
                  <tr key={e.id} className={e.folha ? undefined : 'linha-grupo'}>
                    <td className="dado">{e.codigo ?? '—'}</td>
                    <td style={{ paddingLeft: `calc(var(--e3) + ${profundidade} * var(--e4))` }}>
                      {e.nome}
                      {e.a_confirmar && (
                        <span className="marca-etapa" title="Preço ainda é palpite">a confirmar</span>
                      )}
                    </td>
                    {mostraOrcamento && <td>{e.unidade ?? '—'}</td>}
                    {mostraOrcamento && (
                      <td className="num direita">
                        {e.quantidade === null ? '—' : e.quantidade.toLocaleString('pt-BR')}
                      </td>
                    )}
                    {mostraOrcamento && <td className="num direita">{moeda(e.preco_unitario)}</td>}
                    {mostraOrcamento && <td className="num direita">{moeda(e.valor)}</td>}
                    <td className="num direita">{e.percentual_concluido}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="secao">
        <h2>Tarefas <span className="conta">{tarefas.length}</span></h2>
        {tarefas.length === 0 ? (
          <p className="vazio">Nenhuma tarefa cadastrada.</p>
        ) : (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Tarefa</th>
                  <th>Responsável</th>
                  <th>Situação</th>
                  <th className="direita">Concluído</th>
                  <th>Início prev.</th>
                  <th>Fim prev.</th>
                </tr>
              </thead>
              <tbody>
                {tarefas.map((t) => (
                  <tr key={t.id}>
                    <td className="dado">{t.codigo ?? '—'}</td>
                    <td>
                      {t.nome}
                      {t.marco && <span className="marca-etapa">marco</span>}
                    </td>
                    <td>{(t.responsavel_id && equipe.get(t.responsavel_id)?.nome) || '—'}</td>
                    <td>{t.status.replace(/_/g, ' ').toLowerCase()}</td>
                    <td className="num direita">{t.percentual_concluido}%</td>
                    <td className="dado">{data(t.data_inicio_prev)}</td>
                    <td className="dado">{data(t.data_fim_prev)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(tipo?.usa_pontuacao ?? false) && (
        <section className="secao">
          <h2>Pontuação <span className="conta">{projeto.pontuacao_total} pontos</span></h2>
          {pontos.length === 0 ? (
            <p className="vazio">Projeto ainda não pontuado.</p>
          ) : (
            <div className="tabela-rolavel">
              <table>
                <thead>
                  <tr>
                    <th>Critério</th>
                    <th className="direita">Nota</th>
                    <th className="direita">Peso</th>
                    <th className="direita">Pontos</th>
                    <th>Justificativa</th>
                  </tr>
                </thead>
                <tbody>
                  {pontos.map((p) => (
                    <tr key={p.criterio}>
                      <td>{p.criterio_nome}</td>
                      <td className="num direita">{p.nota} / {p.maximo}</td>
                      <td className="num direita">{p.peso}</td>
                      <td className="num direita">{p.pontos}</td>
                      <td className="justificativa">{p.justificativa ?? '—'}</td>
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
