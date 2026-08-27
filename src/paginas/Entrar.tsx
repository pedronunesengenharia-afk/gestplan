import { useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Entrada por link no e-mail. Sem senha para guardar, esquecer ou vazar —
 * com dez pessoas, é o melhor negócio.
 */
export function Entrar() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado'>('parado')
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setEstado('enviando')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setErro(error.message)
      setEstado('parado')
      return
    }
    setEstado('enviado')
  }

  return (
    <div className="entrar">
      <form onSubmit={enviar}>
        <div className="marca">
          <i><b /></i>
          <span>GestPlan</span>
        </div>

        {estado === 'enviado' ? (
          <div className="aviso">
            Enviamos um link para <strong>{email}</strong>. Abra o e-mail neste
            mesmo navegador para entrar.
          </div>
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
            <button className="botao botao--acao" disabled={estado === 'enviando'}>
              {estado === 'enviando' ? 'Enviando…' : 'Receber link de acesso'}
            </button>
            {erro && <div className="aviso">{erro}</div>}
          </>
        )}
      </form>
    </div>
  )
}
