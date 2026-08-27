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
 * Em que ambiente esta tela está rodando, e contra qual banco.
 *
 * O modo do Vite responde três coisas diferentes, e a tarja precisa dizer a
 * verdade nas três:
 *
 *   'homolog'      `npm run dev:homolog` — banco de homologação, dado
 *                  descartável;
 *   'development'  `npm run dev` — o `.env` comum, que HOJE aponta para
 *                  produção. Dizer "descartável" aqui seria tranquilizar
 *                  alguém prestes a escrever em dado real;
 *   'production'   o build servido no Hostinger. Sem tarja.
 *
 * Por isso a tarja também mostra o ref do projeto Supabase: é o único jeito de
 * a pessoa conferir, olhando a tela, em qual banco ela está mexendo.
 */
export const ambiente = import.meta.env.MODE
export const ehProducao = ambiente === 'production'
export const ehHomolog = ambiente === 'homolog'
export const refDoBanco = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url)?.[1] ?? 'desconhecido'
