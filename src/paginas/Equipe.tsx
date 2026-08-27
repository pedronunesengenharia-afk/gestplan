import { useEffect, useState } from 'react'
import { pessoas, type Pessoa } from '../lib/banco'

/**
 * Pessoa não é usuário: quem aparece aqui pode nunca fazer login. É o que
 * permite alocar e apontar hora de terceiro sem criar conta para ele.
 */
export function Equipe() {
  const [lista, setLista] = useState<Pessoa[]>([])
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    pessoas().then(setLista).catch((e: Error) => setErro(e.message))
  }, [])

  return (
    <>
      <header className="cabecalho-pagina">
        <h1>Equipe</h1>
        <p>Todo mundo que pode ser alocado — faça login ou não.</p>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      {lista.length === 0 ? (
        <p className="vazio">Nenhuma pessoa cadastrada.</p>
      ) : (
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr><th>Nome</th><th>Cargo</th><th>E-mail</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.nome}
                    {p.proprietario && <> <span className="selo selo--urgente">proprietário</span></>}
                  </td>
                  <td>{p.cargo ?? '—'}</td>
                  <td className="dado">{p.email ?? '—'}</td>
                  <td>
                    <span className={p.ativo ? 'selo selo--ok' : 'selo'}>
                      {p.ativo ? 'ativa' : 'inativa'}
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
