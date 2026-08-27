-- ============================================================================
-- GestPlan · primeiro acesso
--
-- Rode UMA VEZ, depois de aplicar as migrações e depois de você já ter pedido
-- o link de acesso na tela de entrada (é isso que cria a linha em auth.users).
--
-- Ele liga o seu login à sua pessoa e marca você como proprietário. Sem isso a
-- RLS nega tudo — corretamente: o banco não sabe quem você é.
--
-- Troque o e-mail e o nome abaixo. No Supabase: SQL Editor > cole > Run.
-- ============================================================================

do $$
declare
  v_email text := 'pedronunesengenharia@gmail.com';   -- <<< o seu e-mail
  v_nome  text := 'Pedro Nunes de Oliveira';          -- <<< o seu nome
  v_auth  uuid;
  v_pessoa uuid;
begin
  select id into v_auth from auth.users where lower(email) = lower(v_email);

  if v_auth is null then
    raise exception
      'Nenhum login com o e-mail %. Peça o link de acesso na tela de entrada primeiro.', v_email;
  end if;

  insert into pessoa (nome, email, auth_user_id, proprietario)
  values (v_nome, v_email, v_auth, true)
  on conflict (auth_user_id) do update
     set proprietario = true, nome = excluded.nome
  returning id into v_pessoa;

  raise notice 'Pronto. pessoa.id = %  — você é proprietário.', v_pessoa;
end $$;
