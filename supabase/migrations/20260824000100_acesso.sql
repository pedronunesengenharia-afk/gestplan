-- =============================================================================
-- GestPlan · 002_acesso.sql
-- Pessoas, empresas e vínculo de papel. É aqui que mora a permissão.
--
-- Duas decisões que valem ser lidas antes do código:
--
-- 1. PESSOA NÃO É USUÁRIO. Toda pessoa alocável tem linha em `pessoa`; só quem
--    entra no sistema tem `auth_user_id` preenchido. Isso permite alocar e
--    apontar hora de quem nunca vai fazer login — o pedreiro, o terceiro.
--
-- 2. PAPEL É POR EMPRESA, NÃO GLOBAL. A mesma pessoa pode ser gerente numa
--    empresa e apenas estrutura em outra. Custa uma tabela e evita o remendo
--    de "papel global com exceções".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Empresa
-- -----------------------------------------------------------------------------

-- Papel da empresa é cadastro, não CHECK fixo: acrescentar um papel novo
-- não pode exigir migração.
create table empresa_papel (
  id        uuid primary key default gen_random_uuid(),
  codigo    text not null unique,
  nome      text not null,
  ordem     int  not null default 0,
  ativo     boolean not null default true
);

create table empresa (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  razao_social  text,
  cnpj          text unique,
  papel_id      uuid references empresa_papel(id) on delete set null,
  prefixo       text not null unique
                check (prefixo ~ '^[A-Z]{2,6}$'),
  endereco      text,
  cidade        text,
  uf            char(2),
  logo_url      text,
  observacao    text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  criado_por    uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

comment on column empresa.prefixo is
  'Prefixo do código de projeto (ex.: CMP). Duas empresas nunca disputam o mesmo número.';

create index empresa_ativo_idx on empresa (ativo) where ativo;

-- -----------------------------------------------------------------------------
-- Pessoa
-- -----------------------------------------------------------------------------
create table pessoa (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  email         text unique,
  fone          text,
  cargo         text,
  setor         text,
  vinculo       text check (vinculo in ('CLT','PJ','TERCEIRO','SOCIO','ESTAGIO')),
  custo_hora    numeric(12,2) not null default 0 check (custo_hora >= 0),
  avatar_url    text,

  -- Só quem faz login tem isto preenchido.
  auth_user_id  uuid unique,
  proprietario  boolean not null default false,

  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  criado_por    uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

comment on column pessoa.auth_user_id is
  'Vínculo com auth.users do Supabase. Nulo = recurso alocável que não acessa o sistema.';
comment on column pessoa.proprietario is
  'Único papel global. Enxerga e altera tudo, em todas as empresas.';

create index pessoa_auth_idx  on pessoa (auth_user_id) where auth_user_id is not null;
create index pessoa_ativo_idx on pessoa (ativo) where ativo;

-- No Supabase, amarra em auth.users. Fora dele (teste local), segue sem a FK.
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'auth' and table_name = 'users') then
    alter table pessoa
      add constraint pessoa_auth_user_fk
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

-- Agora que pessoa existe, a auditoria de 001 pode apontar para ela.
alter table evento
  add constraint evento_pessoa_fk
  foreign key (pessoa_id) references pessoa(id) on delete set null;

alter table empresa
  add constraint empresa_criado_por_fk     foreign key (criado_por)     references pessoa(id) on delete set null,
  add constraint empresa_atualizado_por_fk foreign key (atualizado_por) references pessoa(id) on delete set null;

alter table pessoa
  add constraint pessoa_criado_por_fk     foreign key (criado_por)     references pessoa(id) on delete set null,
  add constraint pessoa_atualizado_por_fk foreign key (atualizado_por) references pessoa(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Papel da pessoa dentro de cada empresa
-- -----------------------------------------------------------------------------
create table pessoa_papel (
  id         uuid primary key default gen_random_uuid(),
  pessoa_id  uuid not null references pessoa(id)  on delete cascade,
  empresa_id uuid not null references empresa(id) on delete cascade,
  papel      text not null check (papel in (
                'GERENTE_PROJETOS',    -- toca a carteira: escopo, prazo, equipe, valores
                'TIME_TI',             -- desenvolvimento: projetos do tipo TI
                'ESTRUTURA',           -- executa e usa: tarefa, apontamento, foto, ideia
                'FINANCEIRO_COMPRAS',  -- valores, parcelas, contratos, parecer financeiro
                'AVALIADOR',           -- assina o parecer do seu setor
                'EXTERNO'              -- fornecedor. Existe no modelo; sem convite por ora.
              )),
  criado_em  timestamptz not null default now(),
  criado_por uuid references pessoa(id) on delete set null,
  unique (pessoa_id, empresa_id, papel)
);

comment on table pessoa_papel is
  'Uma pessoa pode ter mais de um papel na mesma empresa, e papéis diferentes em empresas diferentes.';
comment on column pessoa_papel.papel is
  'EXTERNO fica definido desde o dia um, mesmo sem uso: enxertar perfil externo depois exigiria reescrever política em todas as tabelas.';

create index pessoa_papel_pessoa_idx  on pessoa_papel (pessoa_id);
create index pessoa_papel_empresa_idx on pessoa_papel (empresa_id, papel);

-- Fornecedor externo só enxerga o que passa por este vínculo (usado em 008).
-- A FK para fornecedor entra em 006, quando a tabela existir.
alter table pessoa add column fornecedor_id uuid;
comment on column pessoa.fornecedor_id is
  'Preenchido apenas para pessoa com papel EXTERNO: diz de qual fornecedor ela é.';

-- -----------------------------------------------------------------------------
-- Convite
-- -----------------------------------------------------------------------------
create table convite (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  empresa_id  uuid not null references empresa(id) on delete cascade,
  papel       text not null,
  token       text not null unique default encode(gen_random_bytes(24),'hex'),
  expira_em   timestamptz not null default now() + interval '7 days',
  aceito_em   timestamptz,
  pessoa_id   uuid references pessoa(id) on delete set null,
  criado_em   timestamptz not null default now(),
  criado_por  uuid references pessoa(id) on delete set null
);

create index convite_email_idx on convite (lower(email)) where aceito_em is null;

-- -----------------------------------------------------------------------------
-- Quem é o usuário da vez
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER de propósito: a função lê `pessoa` por baixo da RLS.
-- Sem isso, a política de `pessoa` chamaria uma função que lê `pessoa` — recursão.
create or replace function app.pessoa_atual()
returns uuid
language sql
stable
security definer
set search_path = public, app
as $$
  select p.id
    from pessoa p
   where p.auth_user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      or p.auth_user_id = nullif(current_setting('app.usuario', true), '')::uuid
   limit 1;
$$;

comment on function app.pessoa_atual() is
  'Traduz o usuário autenticado para pessoa.id. Lê o JWT do Supabase e, em teste local, app.usuario.';

-- -----------------------------------------------------------------------------
-- Instrumentação
-- -----------------------------------------------------------------------------
select app.instrumentar('empresa');
select app.instrumentar('pessoa');
