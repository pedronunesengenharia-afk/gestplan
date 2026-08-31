import { useEffect, useState } from 'react'
import {
  abrirChamadoPublico, empresasParaChamado,
  ErroDoBanco,
} from '../lib/banco'
import { ehHomolog, refDoBanco } from '../lib/supabase'
import { Marca } from '../componentes/Marca'

/**
 * O chamado que se abre sem entrar no sistema.
 *
 * Quem está com a impressora parada não tem login, e não deveria precisar de um
 * para pedir socorro. A tela pede as três coisas que o time precisa saber para
 * começar: quem é, de qual empresa, e qual o problema.
 *
 * É a única tela do sistema que fala com o banco sem sessão. Ela não lê nada —
 * só a lista de empresas, por uma função feita para isso — e só escreve pela
 * `abrir_chamado_publico`, que confere tudo do lado de lá. O que esta tela
 * valida é para a pessoa não levar um erro depois de escrever um parágrafo;
 * quem decide de verdade é o banco.
 */

export function ChamadoPublico({ aoEntrar }: { aoEntrar: () => void }) {
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([])
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [fone, setFone] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [setor, setSetor] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')

  const [codigo, setCodigo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    empresasParaChamado()
      .then((es) => {
        setEmpresas(es)
        if (es.length === 1) setEmpresa(es[0].id)
      })
      .catch((e: Error) => setErro(e.message))
  }, [])

  const emailParece = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email.trim())
  const podeEnviar =
    !enviando &&
    nome.trim().length >= 3 &&
    emailParece &&
    empresa !== '' &&
    titulo.trim().length >= 5

  async function enviar() {
    setEnviando(true)
    setErro(null)
    try {
      const c = await abrirChamadoPublico({
        nome: nome.trim(),
        email: email.trim(),
        empresa_id: empresa,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        setor: setor.trim() || null,
        fone: fone.trim() || null,
      })
      setCodigo(c)
    } catch (e) {
      setErro(e instanceof ErroDoBanco ? e.mensagem : e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  // Depois de aberto, a tela some e dá lugar ao número do chamado. É a única
  // coisa que a pessoa precisa levar daqui.
  if (codigo) {
    return (
      <div className="publico">
      {ehHomolog && (
        <div className="tarja-ambiente" role="status">
          HOMOLOGAÇÃO · banco {refDoBanco} — os dados aqui são descartáveis
        </div>
      )}

        <div className="publico-cartao">
          <div className="marca">
            <i><b /></i>
            <span>GestPlan</span>
          </div>

          <h1>Chamado aberto</h1>
          <p>
            Guarde este número — é por ele que você cobra e é por ele que o time responde:
          </p>
          <p className="codigo-chamado">{codigo}</p>
          <p className="ajuda">
            Mandamos o chamado para a fila de atendimento. O retorno vem no e-mail que você
            informou.
          </p>

          <p className="acoes">
            <button
              className="botao"
              onClick={() => {
                setCodigo(null)
                setTitulo('')
                setDescricao('')
              }}
            >
              Abrir outro chamado
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="publico">
      {ehHomolog && (
        <div className="tarja-ambiente" role="status">
          HOMOLOGAÇÃO · banco {refDoBanco} — os dados aqui são descartáveis
        </div>
      )}
      <div className="publico-cartao">
        <Marca tamanho="grande" comAssinatura />

        <h1>Abrir chamado</h1>
        <p className="ajuda">
          Para pedir manutenção ou suporte. Não precisa de senha — só diga quem é você, de qual
          empresa, e o que está acontecendo.
        </p>

        {erro && <div className="aviso">{erro}</div>}

        <label htmlFor="pub-nome">Seu nome</label>
        <input
          id="pub-nome" className="campo" value={nome} autoComplete="name"
          onChange={(e) => setNome(e.target.value)}
        />

        <label htmlFor="pub-email">Seu e-mail</label>
        <input
          id="pub-email" className="campo" type="email" value={email} autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
        {email !== '' && !emailParece && (
          <p className="erro-campo">É por ele que o time responde — confira se está certo.</p>
        )}

        <label htmlFor="pub-fone">Telefone (opcional)</label>
        <input
          id="pub-fone" className="campo" value={fone} autoComplete="tel"
          onChange={(e) => setFone(e.target.value)}
        />

        <label htmlFor="pub-empresa">Empresa</label>
        <select
          id="pub-empresa" className="campo" value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
        >
          <option value="">escolha a empresa</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>

        <label htmlFor="pub-setor">Setor (opcional)</label>
        <input
          id="pub-setor" className="campo" value={setor} placeholder="Estoque, Produção, Escritório…"
          onChange={(e) => setSetor(e.target.value)}
        />

        <label htmlFor="pub-titulo">O que está acontecendo</label>
        <input
          id="pub-titulo" className="campo" value={titulo}
          placeholder="Impressora do estoque parou de puxar papel"
          onChange={(e) => setTitulo(e.target.value)}
        />

        <label htmlFor="pub-descricao">Detalhes (opcional)</label>
        <textarea
          id="pub-descricao" className="campo" rows={4} value={descricao}
          placeholder="Desde quando, o que já foi tentado, se está travando o trabalho de alguém"
          onChange={(e) => setDescricao(e.target.value)}
        />

        <p className="acoes">
          <button className="botao botao--acao" onClick={enviar} disabled={!podeEnviar}>
            {enviando ? 'Enviando…' : 'Abrir chamado'}
          </button>
        </p>

        <p className="ajuda">
          É da equipe e tem login?{' '}
          <button className="voltar" onClick={aoEntrar}>Entrar no sistema</button>
        </p>
      </div>
    </div>
  )
}
