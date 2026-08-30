import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { eu as carregarEu, type Pessoa } from '../lib/banco'

/**
 * A sua conta: quem você é para o sistema, e a sua senha.
 *
 * A senha é definida aqui, por quem é dono dela — nunca mandada por alguém.
 * Senha que chega pronta por e-mail ou por mensagem é senha que já vazou antes
 * de ser usada.
 *
 * Quem entra pela primeira vez usa o link no e-mail e passa por aqui uma vez.
 * Da segunda em diante, a entrada não depende de e-mail nenhum — o que
 * importa quando o serviço de e-mail limita quantas mensagens manda por hora.
 */

export function Conta() {
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [email, setEmail] = useState<string | null>(null)


  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [recado, setRecado] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([carregarEu(), supabase.auth.getUser()])
      .then(([p, { data }]) => {
        if (!vivo) return
        setPessoa(p)
        setEmail(data.user?.email ?? null)
        // Não dá para saber daqui se já existe senha: o Supabase lista o
        // provedor 'email' mesmo para quem só usa link, e a API não conta a
        // diferença. Então a tela não afirma — ela oferece.
      })
      .catch((e: Error) => vivo && setErro(e.message))
    return () => {
      vivo = false
    }
  }, [])

  const curta = nova.length > 0 && nova.length < 8
  const diferentes = confirma.length > 0 && nova !== confirma
  const podeSalvar = !salvando && nova.length >= 8 && nova === confirma

  async function salvar() {
    setSalvando(true)
    setErro(null)
    setRecado(null)
    const { error } = await supabase.auth.updateUser({ password: nova })
    if (error) {
      setErro(error.message)
      setSalvando(false)
      return
    }
    setNova('')
    setConfirma('')
    setRecado('Senha definida. Da próxima vez você entra direto, sem esperar e-mail.')
    setSalvando(false)
  }

  return (
    <>
      <header className="cabecalho-pagina">
        <h1>Conta</h1>
        <p>{pessoa?.nome ?? 'Sem pessoa vinculada'} · {email ?? '—'}</p>
      </header>

      {erro && <div className="aviso">{erro}</div>}
      {recado && <div className="aviso aviso--ok">{recado}</div>}

      <section className="cartao" style={{ maxWidth: '32rem' }}>
        <h2>Definir ou trocar a senha</h2>

        <p className="ajuda">
          Com senha, a entrada não depende de a mensagem de e-mail chegar. Vale a partir da
          próxima vez que você entrar.
        </p>

        <dl className="campos">
          <div className="campo-linha campo-largo">
            <dt><label htmlFor="nova">Nova senha</label></dt>
            <dd>
              <input
                id="nova" className="campo" type="password" autoComplete="new-password"
                value={nova} onChange={(e) => setNova(e.target.value)}
              />
              {curta && <p className="erro-campo">Pelo menos 8 caracteres.</p>}
            </dd>
          </div>

          <div className="campo-linha campo-largo">
            <dt><label htmlFor="confirma">Repita</label></dt>
            <dd>
              <input
                id="confirma" className="campo" type="password" autoComplete="new-password"
                value={confirma} onChange={(e) => setConfirma(e.target.value)}
              />
              {diferentes && <p className="erro-campo">As duas não são iguais.</p>}
            </dd>
          </div>
        </dl>

        <p className="acoes">
          <button className="botao botao--acao" onClick={salvar} disabled={!podeSalvar}>
            {salvando ? 'Salvando…' : 'Salvar senha'}
          </button>
        </p>
      </section>

      <section className="secao" style={{ marginTop: 'var(--e6)' }}>
        <h2>Como funciona o acesso</h2>
        <ul className="checklist">
          <li>
            <strong>Senha</strong> — o caminho normal, e o que não depende de e-mail.
          </li>
          <li>
            <strong>Link no e-mail</strong> — para a primeira entrada e para quem esqueceu a
            senha. O serviço de e-mail limita quantos links manda por hora.
          </li>
          <li>
            <strong>Cadastro não é acesso</strong> — quem o proprietário cadastra em Equipe com
            um e-mail entra sozinho no primeiro link que pedir: o sistema liga o login à pessoa
            pelo e-mail.
          </li>
        </ul>
      </section>
    </>
  )
}
