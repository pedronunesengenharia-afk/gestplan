-- =============================================================================
-- GestPlan · 001_base.sql
-- Extensões, schema utilitário, carimbo de autoria e trilha de auditoria.
--
-- Roda antes de tudo. Nada aqui é específico de projeto — são as ferramentas
-- que as demais migrações usam.
-- =============================================================================

create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists btree_gin;     -- índice composto em jsonb + coluna

-- Schema das funções internas. Fica fora do "public" para não virar endpoint
-- do PostgREST sem querer.
create schema if not exists app;

-- -----------------------------------------------------------------------------
-- Configuração global (a organização é uma só; não há tabela para ela)
-- -----------------------------------------------------------------------------
create table configuracao (
  chave        text primary key,
  valor        jsonb not null,
  descricao    text,
  atualizado_em timestamptz not null default now()
);

comment on table configuracao is
  'Ajustes globais em chave/valor. Substitui uma tabela "organizacao" que teria uma linha só.';

-- -----------------------------------------------------------------------------
-- Carimbo de alteração
-- -----------------------------------------------------------------------------
create or replace function app.marcar_atualizacao()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  begin
    new.atualizado_por := app.pessoa_atual();
  exception when undefined_column then
    null;   -- tabela sem coluna de autoria: só o timestamp
  end;
  return new;
end;
$$;

comment on function app.marcar_atualizacao() is
  'Trigger BEFORE UPDATE: atualiza atualizado_em e, quando a coluna existe, atualizado_por.';

-- -----------------------------------------------------------------------------
-- Trilha de auditoria — apenas inclusão, nunca alteração
-- -----------------------------------------------------------------------------
create table evento (
  id           bigint generated always as identity primary key,
  tabela       text        not null,
  registro_id  uuid        not null,
  acao         text        not null check (acao in ('INSERIU','ALTEROU','REMOVEU')),
  antes        jsonb,
  depois       jsonb,
  campos       text[],                       -- o que de fato mudou, em ALTEROU
  pessoa_id    uuid,                         -- FK criada em 002, quando pessoa existir
  em           timestamptz not null default now()
);

create index evento_registro_idx on evento (tabela, registro_id, em desc);
create index evento_pessoa_idx   on evento (pessoa_id, em desc);

comment on table evento is
  'Histórico de quem mudou o quê. Sem UPDATE e sem DELETE — a política de RLS em 008 garante.';

create or replace function app.auditar()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_antes  jsonb;
  v_depois jsonb;
  v_campos text[];
  v_id     uuid;
begin
  if tg_op = 'INSERT' then
    v_depois := to_jsonb(new);
    v_id     := (v_depois->>'id')::uuid;
  elsif tg_op = 'UPDATE' then
    v_antes  := to_jsonb(old);
    v_depois := to_jsonb(new);
    v_id     := (v_depois->>'id')::uuid;
    -- só os campos que mudaram de verdade; carimbo de hora não conta
    select array_agg(chave)
      into v_campos
      from jsonb_each(v_antes) as a(chave, valor)
     where chave not in ('atualizado_em','atualizado_por')
       and a.valor is distinct from (v_depois -> a.chave);
    if v_campos is null then
      return new;                            -- nada de substancial mudou
    end if;
  else
    v_antes := to_jsonb(old);
    v_id    := (v_antes->>'id')::uuid;
  end if;

  insert into evento (tabela, registro_id, acao, antes, depois, campos, pessoa_id)
  values (
    tg_table_name,
    v_id,
    case tg_op when 'INSERT' then 'INSERIU' when 'UPDATE' then 'ALTEROU' else 'REMOVEU' end,
    v_antes, v_depois, v_campos, app.pessoa_atual()
  );

  return coalesce(new, old);
end;
$$;

-- Liga carimbo + auditoria numa tabela só com o nome dela.
create or replace function app.instrumentar(p_tabela text)
returns void
language plpgsql
as $$
begin
  execute format(
    'create trigger %I before update on %I
       for each row execute function app.marcar_atualizacao()',
    p_tabela || '_carimbo', p_tabela);

  execute format(
    'create trigger %I after insert or update or delete on %I
       for each row execute function app.auditar()',
    p_tabela || '_auditoria', p_tabela);
end;
$$;

comment on function app.instrumentar(text) is
  'Atalho: liga os triggers de carimbo e de auditoria numa tabela.';

-- -----------------------------------------------------------------------------
-- Utilitário de datas úteis — usado pelo motor de cronograma em 005
-- -----------------------------------------------------------------------------
create or replace function app.é_fim_de_semana(p_data date)
returns boolean
language sql
immutable
as $$
  select extract(isodow from p_data) >= 6;
$$;

-- Competência 'AAAA-MM'. Precisa ser IMMUTABLE porque vira coluna gerada em
-- 006 — to_char() não serve: depende de configuração de sessão e o Postgres
-- recusa.
create or replace function app.competencia(p_data date)
returns char(7)
language sql
immutable
as $$
  select (lpad(extract(year  from p_data)::text, 4, '0') || '-' ||
          lpad(extract(month from p_data)::text, 2, '0'))::char(7);
$$;
