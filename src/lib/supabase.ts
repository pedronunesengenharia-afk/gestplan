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
