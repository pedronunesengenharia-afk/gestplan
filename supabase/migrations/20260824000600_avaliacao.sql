-- =============================================================================
-- GestPlan · 007_avaliacao.sql
-- Pontuação de prioridade, pareceres e notificação.
--
-- Sem faixa de alçada, TODO projeto passa por avaliação. Isso tira a
-- ramificação por valor do fluxo — e joga o peso todo na pontuação: sem faixa
-- separando o pequeno do grande, é a nota que decide o que entra primeiro.
-- Por isso ela é do núcleo e é calculada pelo banco, não digitada.
-- =============================================================================

create table setor (
  id     uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome   text not null,
  ordem  int  not null default 0,
  ativo  boolean not null default true
);

comment on table setor is
  'Setores que emitem parecer. Cadastro, não CHECK: acrescentar Qualidade não pode exigir migração.';

-- Os setores exigidos por uma fase precisam existir.
create or replace function app.validar_setores_da_fase()
returns trigger
language plpgsql
as $$
declare v_faltando text[];
begin
  select array_agg(s) into v_faltando
    from unnest(new.exige_setores) s
   where not exists (select 1 from setor where codigo = s and ativo);
  if v_faltando is not null then
    raise exception 'Setor inexistente em exige_setores: %', array_to_string(v_faltando, ', ');
  end if;
  return new;
end;
$$;

create trigger tipo_fase_setores_existem
  before insert or update of exige_setores on tipo_fase
  for each row when (array_length(new.exige_setores, 1) > 0)
  execute function app.validar_setores_da_fase();

-- -----------------------------------------------------------------------------
-- Critérios de pontuação
-- -----------------------------------------------------------------------------
create table pontuacao_criterio (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique,
  nome            text not null,
  descricao       text,
  -- Nulo = vale para todo tipo de projeto.
  tipo_projeto_id uuid references tipo_projeto(id) on delete cascade,
  minimo          int not null default 0,
  maximo          int not null default 5,
  peso            numeric(5,2) not null default 1 check (peso > 0),
  ordem           int not null default 0,
  ativo           boolean not null default true,
  check (maximo > minimo)
);

create table projeto_pontuacao (
  id            uuid primary key default gen_random_uuid(),
  projeto_id    uuid not null references projeto(id) on delete cascade,
  criterio_id   uuid not null references pontuacao_criterio(id) on delete cascade,
  nota          int  not null,
  justificativa text,
  pessoa_id     uuid references pessoa(id) on delete set null,
  em            timestamptz not null default now(),
  unique (projeto_id, criterio_id)
);

-- A nota tem de caber na faixa do critério.
create or replace function app.validar_nota()
returns trigger
language plpgsql
as $$
declare c record;
begin
  select minimo, maximo into c from pontuacao_criterio where id = new.criterio_id;
  if new.nota < c.minimo or new.nota > c.maximo then
    raise exception 'Nota % fora da faixa % a % deste critério', new.nota, c.minimo, c.maximo;
  end if;
  return new;
end;
$$;

create trigger projeto_pontuacao_faixa
  before insert or update on projeto_pontuacao
  for each row execute function app.validar_nota();

-- -----------------------------------------------------------------------------
-- Recálculo da prioridade
--
-- Os cortes vêm de `configuracao`, em percentual do máximo possível — não em
-- pontos absolutos. O desktop usava "acima de 14" para um máximo de 20 pontos;
-- guardar 70% preserva a régua mesmo quando alguém acrescenta um critério.
-- -----------------------------------------------------------------------------
insert into configuracao (chave, valor, descricao) values
  ('prioridade.cortes',
   '{"urgente": 0.70, "importante": 0.25}'::jsonb,
   'Frações do máximo possível a partir das quais o projeto é urgente ou importante.')
on conflict (chave) do nothing;

create or replace function app.recalcular_prioridade(p_projeto uuid)
returns void
language plpgsql
as $$
declare
  v_total   numeric := 0;
  v_maximo  numeric := 0;
  v_frac    numeric := 0;
  v_cortes  jsonb;
  v_tipo    uuid;
begin
  select tipo_projeto_id into v_tipo from projeto where id = p_projeto;

  select coalesce(sum(pp.nota * c.peso), 0),
         coalesce(sum(c.maximo * c.peso), 0)
    into v_total, v_maximo
    from pontuacao_criterio c
    left join projeto_pontuacao pp
      on pp.criterio_id = c.id and pp.projeto_id = p_projeto
   where c.ativo
     and (c.tipo_projeto_id is null or c.tipo_projeto_id = v_tipo);

  if v_maximo > 0 then
    v_frac := v_total / v_maximo;
  end if;

  select valor into v_cortes from configuracao where chave = 'prioridade.cortes';

  update projeto
     set pontuacao_total = round(v_total)::int,
         prioridade = case
           when v_frac >= (v_cortes->>'urgente')::numeric    then 'URGENTE'
           when v_frac >= (v_cortes->>'importante')::numeric then 'IMPORTANTE'
           else 'PLANEJAMENTO'
         end
   where id = p_projeto;
end;
$$;

create or replace function app.disparar_prioridade()
returns trigger
language plpgsql
as $$
begin
  perform app.recalcular_prioridade(coalesce(new.projeto_id, old.projeto_id));
  return null;
end;
$$;

create trigger projeto_pontuacao_recalcula
  after insert or update or delete on projeto_pontuacao
  for each row execute function app.disparar_prioridade();

-- -----------------------------------------------------------------------------
-- Parecer / assinatura
-- -----------------------------------------------------------------------------
create table aprovacao (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references projeto(id) on delete cascade,
  fase_id     uuid not null references tipo_fase(id) on delete restrict,
  setor_codigo text not null references setor(codigo) on delete restrict,
  pessoa_id   uuid references pessoa(id) on delete set null,
  nome_avulso text,                       -- quem assinou e não tem cadastro
  decisao     text not null check (decisao in ('APROVADO','REPROVADO','POSTERGADO','CIENTE')),
  parecer     text,
  postergado_para date,
  em          timestamptz not null default now(),
  unique (projeto_id, fase_id, setor_codigo),
  constraint postergado_tem_data
    check (decisao <> 'POSTERGADO' or postergado_para is not null),
  constraint reprovado_tem_parecer
    check (decisao <> 'REPROVADO' or btrim(coalesce(parecer, '')) <> '')
);

comment on table aprovacao is
  'Um parecer por setor e por fase. É o registro que a fase seguinte exige para deixar a anterior.';

create index aprovacao_projeto_idx on aprovacao (projeto_id);

-- -----------------------------------------------------------------------------
-- A regra de saída da fase
--
-- É aqui que "não avança sem parecer" deixa de ser combinado e vira coisa que
-- o banco recusa. O que cada fase exige está em tipo_fase.exige_setores — dado,
-- não código, exatamente como manda a regra de ouro.
-- -----------------------------------------------------------------------------
create or replace function app.exigir_pareceres()
returns trigger
language plpgsql
as $$
declare
  f          record;
  v_faltando text[];
  v_reprovou text;
begin
  if new.fase_id is not distinct from old.fase_id then
    return new;
  end if;

  select * into f from tipo_fase where id = old.fase_id;

  -- Arquivar não pede parecer: é justamente o que se faz quando o projeto para.
  if (select categoria from tipo_fase where id = new.fase_id) = 'ARQUIVADO' then
    return new;
  end if;

  if array_length(f.exige_setores, 1) > 0 then
    select array_agg(s) into v_faltando
      from unnest(f.exige_setores) s
     where not exists (
       select 1 from aprovacao a
        where a.projeto_id = new.id and a.fase_id = old.fase_id
          and a.setor_codigo = s and a.decisao in ('APROVADO','CIENTE'));

    if v_faltando is not null then
      raise exception 'Falta parecer de: % (fase %)',
        array_to_string(v_faltando, ', '), f.nome;
    end if;
  end if;

  select setor_codigo into v_reprovou
    from aprovacao
   where projeto_id = new.id and fase_id = old.fase_id and decisao = 'REPROVADO'
   limit 1;
  if v_reprovou is not null then
    raise exception 'Projeto reprovado por % — arquive em vez de avançar', v_reprovou;
  end if;

  if f.exige_orcamento and not exists (
       select 1 from etapa where projeto_id = new.id and folha and valor > 0) then
    raise exception 'A fase % exige orçamento com pelo menos um item valorado', f.nome;
  end if;

  if f.exige_cronograma and exists (
       select 1 from tarefa
        where projeto_id = new.id
          and status not in ('CANCELADA')
          and (data_inicio_prev is null or data_fim_prev is null)) then
    raise exception 'A fase % exige todas as tarefas com data prevista', f.nome;
  end if;

  return new;
end;
$$;

-- Roda depois de app.controlar_fase (ordem alfabética do nome do trigger).
create trigger projeto_pareceres
  before update of fase_id on projeto
  for each row execute function app.exigir_pareceres();

-- -----------------------------------------------------------------------------
-- Notificação
-- -----------------------------------------------------------------------------
create table notificacao (
  id         uuid primary key default gen_random_uuid(),
  pessoa_id  uuid not null references pessoa(id) on delete cascade,
  tipo       text not null,
  titulo     text not null,
  corpo      text,
  projeto_id uuid references projeto(id) on delete cascade,
  tarefa_id  uuid references tarefa(id)  on delete cascade,
  link       text,
  lida_em    timestamptz,
  criado_em  timestamptz not null default now()
);

create index notificacao_pendente_idx
  on notificacao (pessoa_id, criado_em desc) where lida_em is null;
