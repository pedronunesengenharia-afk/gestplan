import { useEffect, useState } from 'react'
import { empresas, salvarEmpresa, type Empresa } from '../lib/banco'

/**
 * Empresa é cadastro, não lista no código. O prefixo é o que separa a
 * numeração de projeto de cada uma: CMP-2026-001 e CEM-2026-001 convivem.
 */
export function Empresas() {
  const [lista, setLista] = useState<Empresa[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [prefixo, setPrefixo] = useState('')
  const [salvando, setSalvando] = useState(false)

  function recarregar() {
    empresas().then(setLista).catch((e: Error) => setErro(e.message))
  }
  useEffect(recarregar, [])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setSalvando(true)
    try {
      await salvarEmpresa({ nome: nome.trim(), prefixo: prefixo.trim().toUpperCase() })
      setNome('')
      setPrefixo('')
      recarregar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <header className="cabecalho-pagina">
        <h1>Empresas</h1>
        <p>Quantas forem. O prefixo entra no código de cada projeto.</p>
      </header>

      {erro && <div className="aviso" style={{ marginBottom: 'var(--e4)' }}>{erro}</div>}

      <form
        onSubmit={criar}
        className="cartao"
        style={{ display: 'flex', gap: 'var(--e3)', alignItems: 'end', flexWrap: 'wrap', marginBottom: 'var(--e5)' }}
      >
        <div style={{ flex: '2 1 14rem' }}>
          <label htmlFor="nome">Nome</label>
          <input id="nome" className="campo" required value={nome}
                 onChange={(e) => setNome(e.target.value)} placeholder="Cimentpav" />
        </div>
        <div style={{ flex: '1 1 8rem' }}>
          <label htmlFor="prefixo">Prefixo</label>
          <input id="prefixo" className="campo" required value={prefixo}
                 onChange={(e) => setPrefixo(e.target.value.toUpperCase())}
                 pattern="[A-Za-z]{2,6}" maxLength={6} placeholder="CMP" />
        </div>
        <button className="botao botao--acao" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Cadastrar'}
        </button>
      </form>

      {lista.length === 0 ? (
        <p className="vazio">Nenhuma empresa cadastrada.</p>
      ) : (
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr><th>Prefixo</th><th>Nome</th><th>CNPJ</th><th>Cidade</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id}>
                  <td className="dado">{e.prefixo}</td>
                  <td>{e.nome}</td>
                  <td className="dado">{e.cnpj ?? '—'}</td>
                  <td>{[e.cidade, e.uf].filter(Boolean).join('/') || '—'}</td>
                  <td>
                    <span className={e.ativo ? 'selo selo--ok' : 'selo'}>
                      {e.ativo ? 'ativa' : 'inativa'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
