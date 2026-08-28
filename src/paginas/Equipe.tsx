import { useEffect, useState } from 'react'
import {
  darPapel, empresas as carregarEmpresas, papeisDaEquipe, pessoas,
  salvarPessoa, tirarPapel,
  ErroDoBanco, PAPEIS, VINCULOS,
  type Empresa, type PapelDaPessoa, type Pessoa, type PessoaEdicao,
} from '../lib/banco'
import { EsqueletoDeTabela } from '../componentes/Esqueleto'

/**
 * A equipe: quem existe, o que cada um alcança, e quem já consegue entrar.
 *
 * Pessoa não é usuário. Quem aparece aqui pode nunca fazer login — é o que
 * permite alocar e apontar hora de terceiro sem criar conta para ele. Por
 * isso a coluna "acesso" existe: ela separa quem está cadastrado de quem
 * consegue entrar, que são perguntas diferentes.
 *
 * Papel é por EMPRESA, não por pessoa: o mesmo alguém pode ser gerente numa e
 * só enxergar a outra. Quem escreve aqui é o proprietário — a política de
 * `pessoa`, `pessoa_papel` e `convite` é `app.é_proprietario()`.
 */

const VAZIA: PessoaEdicao = {
  nome: '', email: null, fone: null, cargo: null, setor: null,
  vinculo: 'CLT', custo_hora: 0, ativo: true,
}

export function Equipe() {
  const [lista, setLista] = useState<Pessoa[]>([])
  const [papeis, setPapeis] = useState<PapelDaPessoa[]>([])
  const [listaEmpresas, setListaEmpresas] = useState<Empresa[]>([])
  const [rascunho, setRascunho] = useState<PessoaEdicao | null>(null)
  const [novoPapel, setNovoPapel] = useState<{ pessoa: string; empresa: string; papel: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)

  async function recarregar() {
    const [ps, pp, es] = await Promise.all([pessoas(), papeisDaEquipe(), carregarEmpresas()])
    setLista(ps)
    setPapeis(pp)
    setListaEmpresas(es)
  }

  useEffect(() => {
    recarregar()
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  async function comOBanco(acao: () => Promise<void>) {
    setOcupado(true)
    setErro(null)
    try {
      await acao()
      await recarregar()
    } catch (e) {
      setErro(e instanceof ErroDoBanco ? e.mensagem : e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  const papeisDe = (pessoaId: string) => papeis.filter((p) => p.pessoa_id === pessoaId)
  const nomeDaEmpresa = (id: string) => listaEmpresas.find((e) => e.id === id)?.nome ?? '—'
  const nomeDoPapel = (codigo: string) =>
    PAPEIS.find((p) => p.codigo === codigo)?.nome ?? codigo

  if (carregando) return <EsqueletoDeTabela linhas={5} colunas={5} />

  return (
    <>
      <header className="cabecalho-pagina">
        <div className="titulo-projeto">
          <h1>Equipe</h1>
          <button
            className="botao botao--acao"
            onClick={() => setRascunho(rascunho ? null : { ...VAZIA })}
          >
            {rascunho ? 'Cancelar' : 'Acrescentar pessoa'}
          </button>
        </div>
        <p>Todo mundo que pode ser alocado — faça login ou não.</p>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      {rascunho && (
        <section className="cartao" style={{ marginBottom: 'var(--e5)' }}>
          <h2>{rascunho.id ? 'Editar pessoa' : 'Nova pessoa'}</h2>
          <dl className="campos">
            <div className="campo-linha">
              <dt><label htmlFor="p-nome">Nome</label></dt>
              <dd>
                <input
                  id="p-nome" className="campo" value={rascunho.nome}
                  onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                />
              </dd>
            </div>
            <div className="campo-linha">
              <dt><label htmlFor="p-email">E-mail</label></dt>
              <dd>
                <input
                  id="p-email" className="campo" type="email" value={rascunho.email ?? ''}
                  onChange={(e) => setRascunho({ ...rascunho, email: e.target.value || null })}
                />
                <p className="ajuda">
                  É por ele que a pessoa vai pedir o link de acesso. Cadastrar aqui ainda não dá
                  acesso — veja a coluna “acesso” na lista.
                </p>
              </dd>
            </div>
            <div className="campo-linha">
              <dt><label htmlFor="p-cargo">Cargo</label></dt>
              <dd>
                <input
                  id="p-cargo" className="campo" value={rascunho.cargo ?? ''}
                  onChange={(e) => setRascunho({ ...rascunho, cargo: e.target.value || null })}
                />
              </dd>
            </div>
            <div className="campo-linha">
              <dt><label htmlFor="p-setor">Setor</label></dt>
              <dd>
                <input
                  id="p-setor" className="campo" value={rascunho.setor ?? ''}
                  onChange={(e) => setRascunho({ ...rascunho, setor: e.target.value || null })}
                />
              </dd>
            </div>
            <div className="campo-linha">
              <dt><label htmlFor="p-fone">Telefone</label></dt>
              <dd>
                <input
                  id="p-fone" className="campo" value={rascunho.fone ?? ''}
                  onChange={(e) => setRascunho({ ...rascunho, fone: e.target.value || null })}
                />
              </dd>
            </div>
            <div className="campo-linha">
              <dt><label htmlFor="p-vinculo">Vínculo</label></dt>
              <dd>
                <select
                  id="p-vinculo" className="campo" value={rascunho.vinculo}
                  onChange={(e) => setRascunho({ ...rascunho, vinculo: e.target.value })}
                >
                  {VINCULOS.map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}
                </select>
              </dd>
            </div>
            <div className="campo-linha">
              <dt><label htmlFor="p-custo">Custo por hora</label></dt>
              <dd>
                <input
                  id="p-custo" className="campo num" type="number" step="0.01" min="0"
                  value={rascunho.custo_hora}
                  onChange={(e) => setRascunho({ ...rascunho, custo_hora: Number(e.target.value) || 0 })}
                />
              </dd>
            </div>
            <div className="campo-linha">
              <dt>Situação</dt>
              <dd>
                <label className="marcador">
                  <input
                    type="checkbox" checked={rascunho.ativo}
                    onChange={(e) => setRascunho({ ...rascunho, ativo: e.target.checked })}
                  />
                  {rascunho.ativo ? 'ativa' : 'inativa'}
                </label>
              </dd>
            </div>
          </dl>

          <p className="acoes">
            <button
              className="botao botao--acao"
              disabled={ocupado || rascunho.nome.trim() === ''}
              onClick={() =>
                comOBanco(async () => {
                  await salvarPessoa({ ...rascunho, nome: rascunho.nome.trim() })
                  setRascunho(null)
                })}
            >
              {ocupado ? 'Salvando…' : 'Salvar'}
            </button>
            <button className="botao" onClick={() => setRascunho(null)}>Fechar</button>
          </p>
        </section>
      )}

      {lista.length === 0 ? (
        <p className="vazio">
          Nenhuma pessoa cadastrada. Comece por quem vai receber projeto — o papel se dá depois,
          por empresa.
        </p>
      ) : (
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th className="principal">Nome</th>
                <th>Cargo</th>
                <th>E-mail</th>
                <th>Papéis</th>
                <th>Acesso</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td className="principal">
                    {p.nome}
                    {p.proprietario && <span className="selo selo--urgente">proprietário</span>}
                  </td>
                  <td>{p.cargo ?? '—'}</td>
                  <td className="dado">{p.email ?? '—'}</td>
                  <td>
                    <div className="fichas">
                      {papeisDe(p.id).map((pp) => (
                        <button
                          key={pp.id} className="ficha" disabled={ocupado}
                          title={`${nomeDoPapel(pp.papel)} em ${nomeDaEmpresa(pp.empresa_id)} — clique para tirar`}
                          onClick={() => comOBanco(() => tirarPapel(pp.id))}
                        >
                          {nomeDoPapel(pp.papel)} · {nomeDaEmpresa(pp.empresa_id)}{' '}
                          <span aria-hidden>×</span>
                        </button>
                      ))}
                      <button
                        className="ficha"
                        onClick={() =>
                          setNovoPapel(
                            novoPapel?.pessoa === p.id
                              ? null
                              : { pessoa: p.id, empresa: listaEmpresas[0]?.id ?? '', papel: PAPEIS[0].codigo },
                          )}
                      >
                        + papel
                      </button>
                    </div>

                    {novoPapel?.pessoa === p.id && (
                      <p className="acoes">
                        <select
                          className="campo" value={novoPapel.empresa}
                          onChange={(e) => setNovoPapel({ ...novoPapel, empresa: e.target.value })}
                        >
                          {listaEmpresas.map((e) => (
                            <option key={e.id} value={e.id}>{e.nome}</option>
                          ))}
                        </select>
                        <select
                          className="campo" value={novoPapel.papel}
                          onChange={(e) => setNovoPapel({ ...novoPapel, papel: e.target.value })}
                        >
                          {PAPEIS.map((x) => (
                            <option key={x.codigo} value={x.codigo} title={x.ajuda}>{x.nome}</option>
                          ))}
                        </select>
                        <button
                          className="botao" disabled={ocupado || !novoPapel.empresa}
                          onClick={() =>
                            comOBanco(async () => {
                              await darPapel(novoPapel.pessoa, novoPapel.empresa, novoPapel.papel)
                              setNovoPapel(null)
                            })}
                        >
                          Dar papel
                        </button>
                      </p>
                    )}
                  </td>
                  <td>
                    {/* Cadastrada e com acesso são coisas diferentes: o vínculo
                        com o login só existe quando auth_user_id está preenchido. */}
                    <span className={p.auth_user_id ? 'selo selo--ok' : 'selo'}>
                      {p.auth_user_id ? 'entra' : 'sem acesso'}
                    </span>
                  </td>
                  <td>
                    <span className={p.ativo ? 'selo selo--ok' : 'selo'}>
                      {p.ativo ? 'ativa' : 'inativa'}
                    </span>
                  </td>
                  <td className="acoes-linha">
                    <button
                      className="voltar"
                      onClick={() =>
                        setRascunho({
                          id: p.id, nome: p.nome, email: p.email, fone: p.fone, cargo: p.cargo,
                          setor: p.setor, vinculo: p.vinculo, custo_hora: p.custo_hora,
                          ativo: p.ativo,
                        })}
                    >
                      editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lista.some((p) => !p.auth_user_id) && (
        <div className="aviso" style={{ marginTop: 'var(--e4)' }}>
          <strong>Cadastrar não dá acesso.</strong>
          <p>
            Quem está como “sem acesso” aparece na equipe, pode ser responsável por tarefa e
            receber alocação — mas ainda não entra no sistema. Falta a peça que liga o login à
            pessoa: hoje só o <code>primeiro_acesso.sql</code> faz isso, um a um. Está anotado
            como a próxima migração.
          </p>
        </div>
      )}
    </>
  )
}
