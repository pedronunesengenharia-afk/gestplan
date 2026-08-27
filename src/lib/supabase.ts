import { createClient } from '@supabase/supabase-js'

// A chave anon é pública por natureza — quem protege o dado é a RLS do
// Postgres, não ela. A service_role NUNCA aparece no front: operação
// privilegiada vai por Edge Function.
const url = import.meta.env.VITE_SUPABASE_URL
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !chave) {
  throw new Error(
    'Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. ' +
      'Copie .env.example para .env e preencha com os dados do painel do Supabase.',
  )
}

export const supabase = createClient(url, chave, {
  auth: { persistSession: true, autoRefreshToken: true },
})

/**
 * Em que ambiente esta tela esta rodando.
 *
 * Vem do modo do Vite: `npm run dev` e produção, `npm run dev:homolog` carrega
 * `.env.homolog` e responde 'homolog'. A casca do app usa isto para avisar, em
 * letras grandes, quando o dado da tela é descartável — porque a diferença
 * entre os dois ambientes é invisível olhando a tela, e foi assim que um teste
 * de navegador escreveu num preço real.
 */
export const ambiente = import.meta.env.MODE
export const ehProducao = ambiente === 'production'
