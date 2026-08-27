import { useEffect, useState } from 'react'
import {
  etapasDoProjeto, pessoas, pontuacaoDoProjeto, projeto as carregarProjeto,
  tarefasDoProjeto, tipoDeProjeto,
  type Etapa, type LinhaPontuacao, type Pessoa,
  type Projeto as ProjetoDado, type Tarefa, type TipoProjeto,
} from '../lib/banco'
import { CamposDoTipo } from '../componentes/CamposDoTipo'
import { emOrdemDaArvore } from '../lib/arvore'
import { data, moeda } from '../lib/formato'

const SELO: Record<string, string> = {
  URGENTE: 'selo selo--urgente',
  IMPORTANTE: 'selo selo--importante',
  PLANEJAMENTO: 'selo selo--planejamento',
}

export function Projeto({
  id, aoVoltar, aoEditar, aoAbrirEtapas, aoAbrirTarefas, aoAbrirPontuacao,
}: {
  id: string
  aoVoltar: () => void
  aoEditar: () => void
  aoAbrirEtapas: () => void
  aoAbrirTarefas: () => void
  aoAbrirPontuacao: () => void
}) {
  const [projeto, setProjeto] = useState<ProjetoDado | null>(null)
  const [tipo, setTipo] = useState<TipoProjeto | null>(null)
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

      const [t, es, ts, pts, gente] = await Promise.all([
        tipoDeProjeto(p.tipo_projeto_id),
        etapasDoProjeto(p.id),
        tarefasDoProjeto(p.id),
        pontuacaoDoProjeto(p.id),
        pessoas(),
      ])
      if (!vivo) return
      setTipo(t)
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

  const linhas = emOrdemDaArvore(etapas)

  // Orçamento é decisão do tipo. Valor nulo com o tipo orçando é a RLS
  // escondendo dinheiro de quem não alcança — nos dois casos, a coluna some.
  const mostraOrcamento = (tipo?.usa_orcamento ?? false) && etapas.some((e) => e.valor !== null)
  const mostraValorDoProjeto = projeto.valor_orcado !== null || projeto.valor_estimado !== null

  // A view garante que `pontos` some o total do projeto. Somar aqui e comparar
  // é o que faz a tela avisar caso um dia pare de garantir.
  const somaPontos = pontos.reduce((t, p) => t + p.pontos, 0)
  const desligados = pontos.filter((p) => !p.ativo).length

  return (
    <>
      <button className="voltar" onClick={aoVoltar}>← Carteira</button>

      <header className="cabecalho-pagina">
        <div className="titulo-projeto">
          <span className="dado codigo-projeto">{projeto.codigo}</span>
          <h1>{projeto.nome}</h1>
        </div>
        <div className="selos">
          <button className="botao" onClick={aoEditar}>Editar</button>
          <button className="botao" onClick={aoAbrirEtapas}>Etapas</button>
          <button className="botao" onClick={aoAbrirTarefas}>Tarefas</button>
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

      {/* Os campos próprios se montam sozinhos, lendo campo_definicao. A mesma
          peça vira formulário quando recebe aoMudar. */}
      <CamposDoTipo
        tipoProjetoId={projeto.tipo_projeto_id}
        valores={projeto.campos}
        faseAtualId={projeto.fase_id}
      />

      <section className="secao">
        <h2>
          Etapas <span className="conta">{etapas.length}</span>
          <button className="voltar conta" onClick={aoAbrirEtapas}>editar a EAP</button>
        </h2>
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
                {linhas.map(({ item: e, profundidade }) => (
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
        <h2>
          Tarefas <span className="conta">{tarefas.length}</span>
          <button className="voltar conta" onClick={aoAbrirTarefas}>editar as tarefas</button>
        </h2>
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
          <h2>
            Pontuação <span className="conta">{projeto.pontuacao_total} pontos</span>
            <button className="voltar conta" onClick={aoAbrirPontuacao}>pontuar</button>
          </h2>
          {pontos.length === 0 ? (
            <p className="vazio">Projeto ainda não pontuado.</p>
          ) : (
            <>
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
                      <tr key={p.criterio} className={p.ativo ? undefined : 'linha-inativa'}>
                        <td>
                          {p.criterio_nome}
                          {!p.ativo && (
                            <span
                              className="marca-etapa"
                              title={`A nota está guardada e valeria ${p.pontos_se_ligado} pontos, mas este critério não entra na fila enquanto estiver desligado`}
                            >
                              não conta hoje
                            </span>
                          )}
                        </td>
                        <td className="num direita">{p.nota} / {p.maximo}</td>
                        <td className="num direita">{p.peso}</td>
                        <td className="num direita">
                          {p.ativo ? p.pontos : <span title={`valeria ${p.pontos_se_ligado}`}>0</span>}
                        </td>
                        <td className="justificativa">{p.justificativa ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>
                        Total{desligados > 0 && ` — ${desligados} critério${desligados === 1 ? '' : 's'} desligado${desligados === 1 ? '' : 's'} não somam`}
                      </td>
                      <td className="num direita">{somaPontos}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {somaPontos !== projeto.pontuacao_total && (
                <div className="aviso">
                  A soma dos critérios dá {somaPontos}, mas o projeto está gravado com{' '}
                  {projeto.pontuacao_total}. Alguma nota mudou sem o total ser recalculado —
                  vale rodar <code>select app.recalcular_prioridade(id) from projeto</code>.
                </div>
              )}
            </>
          )}
        </section>
      )}
    </>
  )
}
