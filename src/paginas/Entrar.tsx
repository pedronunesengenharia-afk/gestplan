import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Marca } from '../componentes/Marca'

/**
 * A entrada, com dois caminhos.
 *
 * SENHA é o padrão, e existe por um motivo prático: o link por e-mail depende
 * de a mensagem chegar, e o Supabase limita quantas ele manda por hora. Numa
 * apresentação, ou num dia de muita gente entrando, o link simplesmente não
 * vem — e não há nada a fazer além de esperar.
 *
 * O LINK continua ali, e é ele quem resolve a primeira entrada: quem ainda não
 * tem senha entra pelo link e define a sua em Conta. Ninguém precisa de uma
 * senha provisória mandada por alguém, que é como senha vaza.
 */
export function Entrar({ aoAbrirChamado }: { aoAbrirChamado: () => void }) {
  const [modo, setModo] = useState<'senha' | 'link'>('senha')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado'>('parado')
  const [erro, setErro] = useState<string | null>(null)

  async function entrarComSenha(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setEstado('enviando')
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })
    if (error) {
      // A mensagem do Supabase vem em inglês e não distingue e-mail de senha —
      // de propósito, para não dizer a um estranho quais e-mails existem.
      setErro(
        /invalid login/i.test(error.message)
          ? 'E-mail ou senha não conferem. Se ainda não definiu uma senha, entre pelo link.'
          : error.message,
      )
      setEstado('parado')
      return
    }
    setEstado('parado')
  }

  async function pedirLink(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setEstado('enviando')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setErro(
        /rate limit|too many/i.test(error.message)
          ? 'O serviço de e-mail já mandou links demais nesta hora. Entre com a senha, ou espere alguns minutos.'
          : error.message,
      )
      setEstado('parado')
      return
    }
    setEstado('enviado')
  }

  return (
    <div className="entrar">
      <form onSubmit={modo === 'senha' ? entrarComSenha : pedirLink}>
        <Marca tamanho="grande" comAssinatura />

        {estado === 'enviado' ? (
          <>
            <div className="aviso">
              Enviamos um link para <strong>{email}</strong>. Abra o e-mail neste mesmo
              navegador para entrar.
            </div>
            <p className="ajuda">
              Depois de entrar, defina uma senha em <strong>Conta</strong> — assim a próxima
              entrada não depende de e-mail nenhum.
            </p>
            <button type="button" className="voltar" onClick={() => setEstado('parado')}>
              voltar
            </button>
          </>
        ) : (
          <>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              className="campo"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com.br"
            />

            {modo === 'senha' && (
              <>
                <label htmlFor="senha">Senha</label>
                <input
                  id="senha"
                  className="campo"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </>
            )}

            <button className="botao botao--acao" disabled={estado === 'enviando'}>
              {estado === 'enviando'
                ? modo === 'senha' ? 'Entrando…' : 'Enviando…'
                : modo === 'senha' ? 'Entrar' : 'Receber link de acesso'}
            </button>

            {erro && <div className="aviso">{erro}</div>}

            <p className="ajuda">
              {modo === 'senha' ? (
                <>
                  Primeira vez, ou esqueceu a senha?{' '}
                  <button type="button" className="voltar" onClick={() => { setModo('link'); setErro(null) }}>
                    Receber um link por e-mail
                  </button>
                </>
              ) : (
                <>
                  Já tem senha?{' '}
                  <button type="button" className="voltar" onClick={() => { setModo('senha'); setErro(null) }}>
                    Entrar com senha
                  </button>
                </>
              )}
            </p>

            {/* Quem precisa de manutencao nao tem login, e nao deveria
                precisar de um para pedir socorro. */}
            <p className="ajuda">
              Precisa abrir um chamado de manutenção e não tem acesso?{' '}
              <button type="button" className="voltar" onClick={aoAbrirChamado}>
                Abrir sem entrar
              </button>
            </p>
          </>
        )}
      </form>
    </div>
  )
}
