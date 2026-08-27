-- =============================================================================
-- GestPlan · app.pessoa_atual() lê o claim do jeito que o PostgREST publica hoje
--
-- A versão de 20260824000100_acesso.sql lia só
-- `current_setting('request.jwt.claim.sub')` — o GUC por claim que o PostgREST
-- deixou de popular na v9. O Supabase de hoje define um único
-- `request.jwt.claims`, com o JWT inteiro em JSON.
--
-- Consequência de não corrigir: a função devolve NULL em toda requisição vinda
-- do navegador; como quase toda política pendura nela, a RLS nega tudo a todo
-- mundo. O sintoma é o app dizer que o login não está vinculado a uma pessoa
-- mesmo com `pessoa.auth_user_id` certo — foi assim que apareceu.
--
-- A suíte não pegou porque só exercitava o segundo braço, `app.usuario`, que é
-- o atalho de teste local. `testes/02_permissao.sql` ganha, neste mesmo commit,
-- o caso que entra pelo caminho do JWT.
--
-- Os dois nomes ficam de pé: o legado primeiro (não custa e cobre self-hosted
-- antigo), o atual em seguida. Não uso `auth.uid()` de propósito — ela não
-- existe no Postgres puro onde a suíte roda.
-- =============================================================================

create or replace function app.pessoa_atual()
returns uuid
language sql
stable
security definer
set search_path = public, app
as $$
  select p.id
    from pessoa p
   where p.auth_user_id = coalesce(
           nullif(current_setting('request.jwt.claim.sub', true), ''),
           nullif(current_setting('request.jwt.claims',    true), '')::jsonb ->> 'sub'
         )::uuid
      or p.auth_user_id = nullif(current_setting('app.usuario', true), '')::uuid
   limit 1;
$$;

comment on function app.pessoa_atual() is
  'Traduz o usuário autenticado para pessoa.id. Lê o claim sub do JWT — pelo '
  'GUC legado ou pelo JSON request.jwt.claims — e, em teste local, app.usuario.';
