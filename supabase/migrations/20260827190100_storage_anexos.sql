-- =============================================================================
-- GestPlan · bucket de anexos e quem alcança cada arquivo
--
-- O Storage do Supabase é uma tabela como as outras — `storage.objects` — e
-- obedece a RLS igual. Sem política, arquivo anexado a projeto é arquivo que
-- qualquer autenticado baixa: a permissão da tabela `anexo` não protege o
-- binário, só a linha que aponta para ele.
--
-- A convenção de caminho é `projeto/<uuid do projeto>/<arquivo>`, escrita pelo
-- subir_anexos.py. É o segundo pedaço do caminho que diz de quem é o arquivo.
-- =============================================================================

-- O schema `storage` existe no Supabase e não no Postgres puro onde a suíte de
-- testes roda. Fora do Supabase, esta migração não faz nada em vez de quebrar.
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'Sem o schema storage (fora do Supabase) — nada a fazer aqui.';
    return;
  end if;

  execute $sql$
  insert into storage.buckets (id, name, public)
  values ('anexos', 'anexos', false)
  on conflict (id) do nothing;

  -- Ler: quem alcança o projeto internamente.
  drop policy if exists anexo_le on storage.objects;
  create policy anexo_le on storage.objects for select
  using (
    bucket_id = 'anexos'
    and array_length(storage.foldername(name), 1) >= 2
    and app.pode_ver_interno((storage.foldername(name))[2]::uuid)
  );

  -- Enviar e apagar: quem pode editar o projeto.
  drop policy if exists anexo_envia on storage.objects;
  create policy anexo_envia on storage.objects for insert
  with check (
    bucket_id = 'anexos'
    and array_length(storage.foldername(name), 1) >= 2
    and app.pode_editar_projeto((storage.foldername(name))[2]::uuid)
  );

  drop policy if exists anexo_apaga on storage.objects;
  create policy anexo_apaga on storage.objects for delete
  using (
    bucket_id = 'anexos'
    and array_length(storage.foldername(name), 1) >= 2
    and app.pode_editar_projeto((storage.foldername(name))[2]::uuid)
  );

  -- O subir_anexos.py usa a chave service_role, que passa por cima destas
  -- políticas — é por isso que ela roda no seu terminal e nunca no navegador.
  $sql$;
end $$;
