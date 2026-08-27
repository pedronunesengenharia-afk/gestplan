import { useEffect, useState } from 'react'
import {
  carteiraFiltrada, empresas as carregarEmpresas, fasesDoTipo, frentesUsadas,
  tiposDeProjeto,
  type Empresa, type Fase, type FiltroCarteira, type Projeto, type TipoProjeto,
} from '../lib/banco'
import { moeda, data } from '../lib/formato'
import { Kanban } from './Kanban'
import { guardarParametros, lerParametros } from '../lib/url'

const SELO: Record<string, string> = {
  URGENTE: 'selo selo--urgente',
  IMPORTANTE: 'selo selo--importante',
  PLANEJAMENTO: 'selo selo--planejamento',
}

/** As prioridades, do CHECK de `projeto.prioridade`. */
const PRIORIDADES = ['URGENTE', 'IMPORTANTE', 'PLANEJAMENTO']

/** O filtro vive na URL: sobrevive ao F5 e cabe num link. */
function filtroDaUrl(): FiltroCarteira {
  const p = lerParametros()
  return {
    empresa_id: p.empresa,
    tipo_projeto_id: p.tipo,
    fase_id: p.fase,
    prioridade: p.prioridade,
    frente: p.frente,
    seguranca: p.seguranca === '1' ? true : undefined,
    busca: p.busca,
    arquivados: p.arquivados === '1' ? true : undefined,
  }
}

function paraUrl(f: FiltroCarteira): Record<string, string | null> {
  return {
    empresa: f.empresa_id ?? null,
    tipo: f.tipo_projeto_id ?? null,
    fase: f.fase_id ?? null,
    prioridade: f.prioridade ?? null,
    frente: f.frente ?? null,
    seguranca: f.seguranca ? '1' : null,
    busca: f.busca ?? null,
    arquivados: f.arquivados ? '1' : null,
  }
}

export function Carteira({
  aoAbrir, aoNovo,
}: {
  aoAbrir: (id: string) => void
  aoNovo: () => void
}) {
  const [visao, setVisao] = useState<'lista' | 'kanban'>(
    lerParametros().visao === 'kanban' ? 'kanban' : 'lista',
  )
  const [filtro, setFiltro] = useState<FiltroCarteira>(filtroDaUrl())
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [total, setTotal] = useState<number | null>(null)

  const [listaEmpresas, setListaEmpresas] = useState<Empresa[]>([])
  const [tipos, setTipos] = useState<TipoProjeto[]>([])
  const [fases, setFases] = useState<Fase[]>([])
  const [frentes, setFrentes] = useState<string[]>([])

  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  // As opções vêm do banco, nunca de uma lista escrita aqui.
  useEffect(() => {
    Promise.all([carregarEmpresas(), tiposDeProjeto(), frentesUsadas(), carteiraFiltrada({})])
      .then(([es, ts, fs, todos]) => {
        setListaEmpresas(es)
        setTipos(ts)
        setFrentes(fs)
        setTotal(todos.length)
      })
      .catch((e: Error) => setErro(e.message))
  }, [])

  // Fase depende de tipo: são as fases DAQUELE tipo.
  useEffect(() => {
    if (!filtro.tipo_projeto_id) {
      setFases([])
      return
    }
    fasesDoTipo(filtro.tipo_projeto_id)
      .then(setFases)
      .catch((e: Error) => setErro(e.message))
  }, [filtro.tipo_projeto_id])

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    carteiraFiltrada(filtro)
      .then((ps) => vivo && setProjetos(ps))
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [filtro])

  function mudar(mudancas: Partial<FiltroCarteira>) {
    // Trocar de tipo derruba a fase escolhida: ela era de outro tipo.
    const novo = { ...filtro, ...mudancas }
    if ('tipo_projeto_id' in mudancas) novo.fase_id = undefined
    setFiltro(novo)
    guardarParametros(paraUrl(novo))
  }

  function limparTudo() {
    setFiltro({})
    guardarParametros(paraUrl({}))
  }

  const mostraValor = projetos.some((p) => p.valor_orcado !== null)

  // As fichas do que está filtrado, cada uma removível.
  const fichas: { chave: string; texto: string; remover: () => void }[] = []
  if (filtro.busca) {
    fichas.push({ chave: 'busca', texto: `"${filtro.busca}"`, remover: () => mudar({ busca: undefined }) })
  }
  if (filtro.empresa_id) {
    fichas.push({
      chave: 'empresa',
      texto: listaEmpresas.find((e) => e.id === filtro.empresa_id)?.nome ?? 'empresa',
      remover: () => mudar({ empresa_id: undefined }),
    })
  }
  if (filtro.tipo_projeto_id) {
    fichas.push({
      chave: 'tipo',
      texto: tipos.find((t) => t.id === filtro.tipo_projeto_id)?.nome ?? 'tipo',
      remover: () => mudar({ tipo_projeto_id: undefined }),
    })
  }
  if (filtro.fase_id) {
    fichas.push({
      chave: 'fase',
      texto: fases.find((f) => f.id === filtro.fase_id)?.nome ?? 'fase',
      remover: () => mudar({ fase_id: undefined }),
    })
  }
  if (filtro.prioridade) {
    fichas.push({
      chave: 'prioridade',
      texto: filtro.prioridade,
      remover: () => mudar({ prioridade: undefined }),
    })
  }
  if (filtro.frente) {
    fichas.push({ chave: 'frente', texto: filtro.frente, remover: () => mudar({ frente: undefined }) })
  }
  if (filtro.seguranca) {
    fichas.push({
      chave: 'seguranca',
      texto: 'segurança do trabalho',
      remover: () => mudar({ seguranca: undefined }),
    })
  }
  // Esconder arquivado é decisão da tela, não do banco — então é dito em voz
  // alta, com o mesmo peso das outras fichas. Sumiço silencioso é o que faz
  // alguém jurar que o projeto se perdeu.
  if (!filtro.arquivados) {
    fichas.push({
      chave: 'arquivados',
      texto: 'arquivados escondidos',
      remover: () => mudar({ arquivados: true }),
    })
  }

  const filtrando = fichas.length > (filtro.arquivados ? 0 : 1)

  return (
    <>
      <header className="cabecalho-pagina">
        <div className="titulo-projeto">
          <h1>Carteira</h1>
          <span className="alternador">
            <button
              className={visao === 'lista' ? 'botao botao--ligado' : 'botao'}
              onClick={() => { setVisao('lista'); guardarParametros({ visao: null }) }}
            >
              Lista
            </button>
            <button
              className={visao === 'kanban' ? 'botao botao--ligado' : 'botao'}
              onClick={() => { setVisao('kanban'); guardarParametros({ visao: 'kanban' }) }}
            >
              Kanban
            </button>
          </span>
          <button className="botao botao--acao" onClick={aoNovo}>Novo projeto</button>
        </div>
        <p>
          {carregando
            ? 'Carregando…'
            : filtrando && total !== null
              ? `${projetos.length} de ${total} projeto${total === 1 ? '' : 's'}`
              : `${projetos.length} projeto${projetos.length === 1 ? '' : 's'}, em ordem de prioridade`}
        </p>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      {visao === 'lista' && (
        <>
          <div className="filtros">
            <input
              className="campo" type="search" placeholder="código ou nome"
              value={filtro.busca ?? ''}
              onChange={(e) => mudar({ busca: e.target.value || undefined })}
            />
            <select
              className="campo" value={filtro.empresa_id ?? ''}
              onChange={(e) => mudar({ empresa_id: e.target.value || undefined })}
            >
              <option value="">todas as empresas</option>
              {listaEmpresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <select
              className="campo" value={filtro.tipo_projeto_id ?? ''}
              onChange={(e) => mudar({ tipo_projeto_id: e.target.value || undefined })}
            >
              <option value="">todos os tipos</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <select
              className="campo" value={filtro.fase_id ?? ''}
              disabled={!filtro.tipo_projeto_id}
              title={
                filtro.tipo_projeto_id
                  ? undefined
                  : 'Cada tipo tem as suas fases: escolha um tipo para poder filtrar por fase.'
              }
              onChange={(e) => mudar({ fase_id: e.target.value || undefined })}
            >
              <option value="">
                {filtro.tipo_projeto_id ? 'todas as fases' : 'fase — escolha um tipo antes'}
              </option>
              {fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <select
              className="campo" value={filtro.prioridade ?? ''}
              onChange={(e) => mudar({ prioridade: e.target.value || undefined })}
            >
              <option value="">toda prioridade</option>
              {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              className="campo" value={filtro.frente ?? ''}
              onChange={(e) => mudar({ frente: e.target.value || undefined })}
            >
              <option value="">todas as frentes</option>
              {frentes.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <label className="marcador">
              <input
                type="checkbox" checked={filtro.seguranca ?? false}
                onChange={(e) => mudar({ seguranca: e.target.checked || undefined })}
              />
              segurança
            </label>
          </div>

          <div className="fichas">
            {fichas.map((f) => (
              <button key={f.chave} className="ficha" onClick={f.remover}>
                {f.texto} <span aria-hidden>×</span>
              </button>
            ))}
            {filtrando && (
              <button className="voltar" onClick={limparTudo}>limpar tudo</button>
            )}
          </div>
        </>
      )}

      {visao === 'kanban' && <Kanban aoAbrir={aoAbrir} />}

      {visao === 'lista' && !carregando && !erro && projetos.length === 0 && (
        <p className="vazio">
          {filtrando
            ? 'Nenhum projeto com esses filtros.'
            : 'Nenhum projeto ainda. Cadastre uma empresa e crie o primeiro.'}
        </p>
      )}

      {visao === 'lista' && projetos.length > 0 && (
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Projeto</th>
                <th>Tipo</th>
                <th>Fase</th>
                <th>Empresa</th>
                <th>Prioridade</th>
                <th>Prazo</th>
                {mostraValor && <th className="direita">Orçado</th>}
                {mostraValor && <th className="direita">Realizado</th>}
              </tr>
            </thead>
            <tbody>
              {projetos.map((p) => (
                <tr
                  key={p.id}
                  className="linha-clicavel"
                  onClick={() => aoAbrir(p.id)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && aoAbrir(p.id)}
                >
                  <td className="dado">{p.codigo}</td>
                  <td>
                    {p.nome}
                    {p.seguranca && <span className="marca-etapa">segurança</span>}
                  </td>
                  <td>
                    <span
                      className="selo"
                      style={{ background: p.tipo_cor + '22', color: p.tipo_cor }}
                    >
                      {p.tipo_nome}
                    </span>
                  </td>
                  <td>{p.fase_nome}</td>
                  <td>{p.empresa_nome}</td>
                  <td
                    title={
                      `${p.pontuacao_total} pontos nos criterios ativos. ` +
                      'A prioridade sai da fracao do maximo possivel, com os cortes de ' +
                      'configuracao.prioridade.cortes. Abra o projeto e clique em pontuar ' +
                      'para ver criterio por criterio.'
                    }
                  >
                    <span className={SELO[p.prioridade]}>{p.prioridade}</span>{' '}
                    <span className="dado" style={{ color: 'var(--apagado)', fontSize: '.78rem' }}>
                      {p.pontuacao_total}
                    </span>
                  </td>
                  <td className="dado">{data(p.data_fim_prev)}</td>
                  {mostraValor && <td className="num direita">{moeda(p.valor_orcado)}</td>}
                  {mostraValor && <td className="num direita">{moeda(p.valor_realizado)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
