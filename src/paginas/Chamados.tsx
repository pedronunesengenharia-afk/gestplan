import { useEffect, useState } from 'react'
import {
  abrirChamado, carteiraFiltrada, empresas as carregarEmpresas, eu as carregarEu,
  fasesDoTipo, tipoDeChamado,
  ErroDoBanco,
  type Empresa, type Fase, type Pessoa, type Projeto,
} from '../lib/banco'
import { Farol } from '../componentes/Farol'
import { EsqueletoDeTabela } from '../componentes/Esqueleto'
import { data as formatarData } from '../lib/formato'

/**
 * Abrir chamado de manutenção, e acompanhar os seus.
 *
 * Um chamado é um projeto — no tipo que `configuracao.chamado.tipo_projeto`
 * apontar, nascendo na fase inicial dele. Não há tabela de chamado, nem
 * conceito novo: o que o time de TI recebe é um projeto na fila dele, com
 * fases, tarefas, comentários e anexos que já existem.
 *
 * A tela não sabe que a fila é o TI. Ela lê a configuração, e trocar de fila é
 * trocar aquela linha.
 *
 * Quem abre não precisa ser gerente: quem cria é `public.abrir_chamado`, que
 * roda com os direitos do banco justamente para não afrouxar a política de
 * INSERT de `projeto`.
 */

export function Chamados({ aoAbrir }: { aoAbrir: (id: string) => void }) {
  const [tipo, setTipo] = useState<{ id: string; nome: string } | null>(null)
  const [fases, setFases] = useState<Fase[]>([])
  const [meus, setMeus] = useState<Projeto[]>([])
  const [listaEmpresas, setListaEmpresas] = useState<Empresa[]>([])
  const [minhaPessoa, setMinhaPessoa] = useState<Pessoa | null>(null)

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [setor, setSetor] = useState('')
  const [empresa, setEmpresa] = useState('')

  const [erro, setErro] = useState<string | null>(null)
  const [recado, setRecado] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  async function recarregar() {
    const t = await tipoDeChamado()
    setTipo(t)
    const [quemSouEu, es, fs, ps] = await Promise.all([
      carregarEu(),
      carregarEmpresas(),
      t ? fasesDoTipo(t.id) : Promise.resolve([] as Fase[]),
      t ? carteiraFiltrada({ tipo_projeto_id: t.id, arquivados: true }) : Promise.resolve([] as Projeto[]),
    ])
    setMinhaPessoa(quemSouEu)
    setListaEmpresas(es)
    setFases(fs)
    setMeus(ps)
    setSetor((s) => s || quemSouEu?.setor || '')
  }

  useEffect(() => {
    recarregar()
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  async function enviar() {
    setEnviando(true)
    setErro(null)
    setRecado(null)
    try {
      const id = await abrirChamado({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        setor: setor.trim() || null,
        empresa_id: empresa || null,
      })
      setTitulo('')
      setDescricao('')
      await recarregar()
      setRecado(`Chamado aberto. Ele está na fila de ${tipo?.nome ?? 'atendimento'}.`)
      if (id) aoAbrir(id)
    } catch (e) {
      setErro(e instanceof ErroDoBanco ? e.mensagem : e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) return <EsqueletoDeTabela linhas={4} colunas={4} />

  return (
    <>
      <header className="cabecalho-pagina">
        <h1>Chamados</h1>
        <p>
          {tipo
            ? `Pedido de manutenção e suporte. Cai direto na fila de ${tipo.nome}.`
            : 'Nenhuma fila configurada para receber chamado.'}
        </p>
      </header>

      {erro && <div className="aviso">{erro}</div>}
      {recado && <div className="aviso aviso--ok">{recado}</div>}

      {!tipo && (
        <div className="aviso">
          Falta dizer ao banco qual tipo de projeto recebe chamado, na linha
          <code> configuracao.chamado.tipo_projeto</code>. Sem ela ninguém sabe para onde mandar.
        </div>
      )}

      {tipo && (
        <section className="cartao" style={{ marginBottom: 'var(--e5)' }}>
          <h2>Abrir chamado</h2>
          <dl className="campos">
            <div className="campo-linha campo-largo">
              <dt><label htmlFor="c-titulo">O que aconteceu</label></dt>
              <dd>
                <input
                  id="c-titulo" className="campo" value={titulo}
                  placeholder="Impressora do estoque parou de puxar papel"
                  onChange={(e) => setTitulo(e.target.value)}
                />
                <p className="ajuda">
                  É por este título que o time reconhece o pedido na fila. Uma frase que diga o
                  problema vale mais que “urgente”.
                </p>
              </dd>
            </div>

            <div className="campo-linha campo-largo">
              <dt><label htmlFor="c-descricao">Detalhes</label></dt>
              <dd>
                <textarea
                  id="c-descricao" className="campo" rows={4} value={descricao}
                  placeholder="Desde quando, o que já foi tentado, se trava o trabalho de alguém"
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </dd>
            </div>

            <div className="campo-linha">
              <dt><label htmlFor="c-setor">Setor</label></dt>
              <dd>
                <input
                  id="c-setor" className="campo" value={setor}
                  onChange={(e) => setSetor(e.target.value)}
                />
              </dd>
            </div>

            <div className="campo-linha">
              <dt><label htmlFor="c-empresa">Empresa</label></dt>
              <dd>
                <select
                  id="c-empresa" className="campo" value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                >
                  <option value="">a minha</option>
                  {listaEmpresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
                <p className="ajuda">
                  Em branco, o banco usa a empresa em que você tem papel.
                </p>
              </dd>
            </div>
          </dl>

          <p className="acoes">
            <button
              className="botao botao--acao"
              disabled={enviando || titulo.trim() === '' || !minhaPessoa}
              onClick={enviar}
            >
              {enviando ? 'Abrindo…' : 'Abrir chamado'}
            </button>
          </p>

          {!minhaPessoa && (
            <p className="erro-campo">
              O seu login ainda não está ligado a uma pessoa da equipe, e chamado precisa de
              autor. Peça ao proprietário para cadastrar você com este e-mail.
            </p>
          )}
        </section>
      )}

      {tipo && (
        <section className="secao">
          <h2>
            Na fila <span className="conta">{meus.length}</span>
          </h2>

          {meus.length === 0 ? (
            <p className="vazio">
              Nenhum chamado ainda. O primeiro que você abrir aparece aqui e na fila do time.
            </p>
          ) : (
            <div className="tabela-rolavel">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th className="principal">Chamado</th>
                    <th>Onde está</th>
                    <th className="data">Aberto em</th>
                  </tr>
                </thead>
                <tbody>
                  {meus.map((p) => {
                    const faseAtual = fases.find((f) => f.id === p.fase_id)
                    return (
                      <tr
                        key={p.id} className="linha-clicavel" onClick={() => aoAbrir(p.id)}
                        tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && aoAbrir(p.id)}
                      >
                        <td className="dado">{p.codigo}</td>
                        <td className="principal">{p.nome}</td>
                        <td>
                          {/* O mesmo farol da carteira, aqui contando a história
                              de um chamado só: por onde ele passou e onde está. */}
                          <Farol fases={fases} faseAtual={faseAtual} compacto />
                          <span className="campo-vazio">{faseAtual?.nome}</span>
                        </td>
                        <td className="dado data">{formatarData(p.criado_em?.slice(0, 10))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  )
}
