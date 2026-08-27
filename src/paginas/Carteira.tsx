import { useEffect, useState } from 'react'
import { carteira, type Projeto } from '../lib/banco'
import { moeda, data } from '../lib/formato'

const SELO: Record<string, string> = {
  URGENTE: 'selo selo--urgente',
  IMPORTANTE: 'selo selo--importante',
  PLANEJAMENTO: 'selo selo--planejamento',
}

export function Carteira({ aoAbrir }: { aoAbrir: (id: string) => void }) {
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carteira()
      .then(setProjetos)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  // Quem não tem alcance financeiro recebe a linha com os valores nulos.
  // A coluna some inteira em vez de mostrar traço em tudo.
  const mostraValor = projetos.some((p) => p.valor_orcado !== null)

  return (
    <>
      <header className="cabecalho-pagina">
        <h1>Carteira</h1>
        <p>
          {carregando
            ? 'Carregando…'
            : `${projetos.length} projeto${projetos.length === 1 ? '' : 's'}, em ordem de prioridade`}
        </p>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      {!carregando && !erro && projetos.length === 0 && (
        <p className="vazio">Nenhum projeto ainda. Cadastre uma empresa e crie o primeiro.</p>
      )}

      {projetos.length > 0 && (
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
                {mostraValor && <th style={{ textAlign: 'right' }}>Orçado</th>}
                {mostraValor && <th style={{ textAlign: 'right' }}>Realizado</th>}
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
                  <td>{p.nome}</td>
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
                  <td>
                    <span className={SELO[p.prioridade]}>{p.prioridade}</span>{' '}
                    <span className="dado" style={{ color: 'var(--apagado)', fontSize: '.78rem' }}>
                      {p.pontuacao_total}
                    </span>
                  </td>
                  <td className="dado">{data(p.data_fim_prev)}</td>
                  {mostraValor && <td className="num" style={{ textAlign: 'right' }}>{moeda(p.valor_orcado)}</td>}
                  {mostraValor && <td className="num" style={{ textAlign: 'right' }}>{moeda(p.valor_realizado)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
