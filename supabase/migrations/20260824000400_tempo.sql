-- =============================================================================
-- GestPlan · 005_tempo.sql
-- Calendário de trabalho, linha de base e as funções de dia útil que o motor
-- de cronograma usa.
--
-- O cálculo de CPM em si roda no cliente, em TypeScript: é iterativo, muda a
-- cada arrastar de barra e não vale a viagem ao banco. O que fica aqui é o que
-- precisa ser verdade para todo mundo — o calendário e o congelamento da base.
-- =============================================================================

create table calendario (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid references empresa(id) on delete cascade,   -- nulo = vale para todas
  nome         text not null,
  padrao       boolean not null default false,
  -- Um dia por posição ISO: 1=segunda … 7=domingo.
  dias_uteis   boolean[] not null default '{true,true,true,true,true,false,false}'
               check (array_length(dias_uteis, 1) = 7),
  horas_dia    numeric(5,2) not null default 8 check (horas_dia > 0 and horas_dia <= 24),
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table calendario is
  'Jornada e dias úteis. Um calendário por empresa; o marcado como padrão atende quem não tem o seu.';

create unique index calendario_padrao_unico on calendario (padrao) where padrao;
create index calendario_empresa_idx on calendario (empresa_id);

create table calendario_excecao (
  id            uuid primary key default gen_random_uuid(),
  calendario_id uuid not null references calendario(id) on delete cascade,
  data          date not null,
  tipo          text not null default 'FERIADO'
                check (tipo in ('FERIADO','PARADA','EXTRA')),
  descricao     text not null,
  unique (calendario_id, data)
);

comment on column calendario_excecao.tipo is
  'FERIADO e PARADA tiram o dia; EXTRA devolve um dia que a semana normal não teria (mutirão de sábado).';

create index calendario_excecao_idx on calendario_excecao (calendario_id, data);

-- -----------------------------------------------------------------------------
-- Dia útil
-- -----------------------------------------------------------------------------
create or replace function app.é_dia_util(p_calendario uuid, p_data date)
returns boolean
language sql
stable
as $$
  select case
    when exists (select 1 from calendario_excecao
                  where calendario_id = p_calendario and data = p_data
                    and tipo in ('FERIADO','PARADA')) then false
    when exists (select 1 from calendario_excecao
                  where calendario_id = p_calendario and data = p_data
                    and tipo = 'EXTRA') then true
    else coalesce(
      (select dias_uteis[extract(isodow from p_data)::int]
         from calendario where id = p_calendario),
      extract(isodow from p_data) < 6)
  end;
$$;

create or replace function app.dias_uteis_entre(p_calendario uuid, p_de date, p_ate date)
returns int
language sql
stable
as $$
  select count(*)::int
    from generate_series(p_de, p_ate, interval '1 day') d
   where app.é_dia_util(p_calendario, d::date);
$$;

comment on function app.dias_uteis_entre(uuid, date, date) is
  'Conta dias úteis no intervalo, extremos incluídos. Usado para duração e para aferir atraso.';

create or replace function app.somar_dias_uteis(p_calendario uuid, p_de date, p_dias int)
returns date
language plpgsql
stable
as $$
declare
  v_data  date := p_de;
  v_resta int  := p_dias;
  v_passo int  := case when p_dias < 0 then -1 else 1 end;
  v_limite int := 0;
begin
  if p_dias = 0 then
    return p_de;
  end if;
  v_resta := abs(p_dias);
  while v_resta > 0 loop
    v_data := v_data + v_passo;
    v_limite := v_limite + 1;
    if v_limite > 3650 then
      raise exception 'Calendário sem dia útil em 10 anos — confira dias_uteis do calendário %', p_calendario;
    end if;
    if app.é_dia_util(p_calendario, v_data) then
      v_resta := v_resta - 1;
    end if;
  end loop;
  return v_data;
end;
$$;

comment on function app.somar_dias_uteis(uuid, date, int) is
  'Avança (ou recua) N dias úteis a partir de uma data. É o que traduz duração em data-fim.';

-- -----------------------------------------------------------------------------
-- Linha de base — o planejado congelado
-- -----------------------------------------------------------------------------
create table linha_base (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references projeto(id) on delete cascade,
  versao         int  not null,
  descricao      text,
  data_aprovacao date not null default current_date,
  vigente        boolean not null default true,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references pessoa(id) on delete set null,
  unique (projeto_id, versao)
);

comment on table linha_base is
  'Congela o planejado no momento da aprovação. Replanejar não apaga: cria versão nova, e a curva S passa a comparar as três linhas.';

create unique index linha_base_vigente_unica
  on linha_base (projeto_id) where vigente;

create table linha_base_item (
  id             uuid primary key default gen_random_uuid(),
  linha_base_id  uuid not null references linha_base(id) on delete cascade,
  tarefa_id      uuid references tarefa(id) on delete cascade,
  etapa_id       uuid references etapa(id)  on delete cascade,
  competencia    char(7) check (competencia ~ '^\d{4}-\d{2}$'),
  data_inicio    date,
  data_fim       date,
  percentual_previsto numeric(7,4) not null default 0,
  valor_previsto      numeric(14,2) not null default 0,
  constraint aponta_para_algo check (tarefa_id is not null or etapa_id is not null)
);

create index linha_base_item_idx    on linha_base_item (linha_base_id);
create index linha_base_item_comp_idx on linha_base_item (linha_base_id, competencia);

-- Ao marcar uma base como vigente, as demais do mesmo projeto saem de cena.
create or replace function app.unica_base_vigente()
returns trigger
language plpgsql
as $$
begin
  if new.vigente then
    update linha_base set vigente = false
     where projeto_id = new.projeto_id and id <> new.id and vigente;
  end if;
  return new;
end;
$$;

create trigger linha_base_vigencia
  before insert or update of vigente on linha_base
  for each row when (new.vigente) execute function app.unica_base_vigente();

-- Numeração automática da versão.
create or replace function app.numerar_linha_base()
returns trigger
language plpgsql
as $$
begin
  if new.versao is null then
    select coalesce(max(versao), 0) + 1 into new.versao
      from linha_base where projeto_id = new.projeto_id;
  end if;
  return new;
end;
$$;

create trigger linha_base_numero
  before insert on linha_base
  for each row execute function app.numerar_linha_base();

