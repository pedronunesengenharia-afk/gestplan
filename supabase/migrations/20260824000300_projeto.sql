-- =============================================================================
-- GestPlan · 004_projeto.sql
-- A Camada 1: o núcleo invariante. Vale para qualquer tipo de projeto.
--
-- Decisão que atravessa o arquivo: os VALORES DO PROJETO ficam numa tabela
-- separada (projeto_valor). Não é normalização — é permissão. Com os valores
-- em coluna do próprio projeto, esconder dinheiro de quem não pode ver exige
-- GRANT por coluna, que quebra no primeiro `select *`. Numa tabela à parte, a
-- própria RLS resolve, e nenhum `select *` distraído vaza margem.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Projeto
-- -----------------------------------------------------------------------------
create table projeto (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique,           -- CMP-2026-014, gerado por trigger
  numero           int  not null,                  -- sequencial dentro de empresa+ano
  ano              int  not null,

  nome             text not null,
  tipo_projeto_id  uuid not null references tipo_projeto(id) on delete restrict,
  fase_id          uuid not null references tipo_fase(id)    on delete restrict,
  empresa_id       uuid not null references empresa(id)      on delete restrict,
  projeto_pai_id   uuid references projeto(id) on delete set null,

  gerente_id       uuid references pessoa(id) on delete set null,
  solicitante_id   uuid references pessoa(id) on delete set null,
  setor            text,

  descricao        text,
  objetivo         text,
  problema         text,
  beneficios       text,
  local            text,
  cidade           text,
  uf               char(2),

  -- Camada 2: valores dos campos próprios do tipo. Validado por trigger
  -- contra campo_definicao — jsonb aqui não significa "vale tudo".
  campos           jsonb not null default '{}'::jsonb,

  saude            text check (saude in ('VERDE','AMARELO','VERMELHO')),
  pontuacao_total  int  not null default 0,        -- recalculado em 007
  prioridade       text not null default 'PLANEJAMENTO'
                   check (prioridade in ('URGENTE','IMPORTANTE','PLANEJAMENTO')),

  data_solicitacao date,
  data_inicio_prev date,
  data_fim_prev    date,
  data_inicio_real date,
  data_fim_real    date,
  data_fase        timestamptz not null default now(),

  -- Arquivamento e aguardo
  arquivado_em     timestamptz,
  motivo_arquivo   text check (motivo_arquivo in
                     ('NAO_APROVADO','EM_AGUARDO','CANCELADO','DISTRATO')),
  retorno_em       date,

  observacao       text,
  criado_em        timestamptz not null default now(),
  criado_por       uuid references pessoa(id) on delete set null,
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid references pessoa(id) on delete set null,

  unique (empresa_id, ano, numero),
  -- Regra que veio do desktop e continua valendo: projeto em aguardo tem de
  -- ter data de retorno, senão ele some da vista e ninguém volta nele.
  constraint aguardo_tem_retorno
    check (motivo_arquivo is distinct from 'EM_AGUARDO' or retorno_em is not null),
  constraint arquivado_tem_motivo
    check ((arquivado_em is null) = (motivo_arquivo is null)),
  constraint nao_e_pai_de_si
    check (projeto_pai_id is distinct from id)
);

comment on column projeto.campos is
  'Valores dos campos definidos em campo_definicao para este tipo. Conferido pelo trigger app.validar_campos().';

create index projeto_empresa_idx  on projeto (empresa_id, ano desc, numero desc);
create index projeto_fase_idx     on projeto (fase_id);
create index projeto_tipo_idx     on projeto (tipo_projeto_id);
create index projeto_gerente_idx  on projeto (gerente_id);
create index projeto_pai_idx      on projeto (projeto_pai_id) where projeto_pai_id is not null;
create index projeto_ativo_idx    on projeto (empresa_id) where arquivado_em is null;
create index projeto_retorno_idx  on projeto (retorno_em) where retorno_em is not null;
create index projeto_campos_idx   on projeto using gin (campos);

-- -----------------------------------------------------------------------------
-- Valores — tabela separada por causa da permissão (ver cabeçalho)
-- -----------------------------------------------------------------------------
create table projeto_valor (
  projeto_id       uuid primary key references projeto(id) on delete cascade,
  valor_estimado   numeric(14,2) not null default 0,   -- o que se pediu
  valor_aprovado   numeric(14,2) not null default 0,   -- o que se liberou
  valor_revisoes   numeric(14,2) not null default 0,   -- aditivos e revisões
  valor_orcado     numeric(14,2) not null default 0,   -- soma das etapas
  valor_realizado  numeric(14,2) not null default 0,   -- soma dos custos
  valor_pago       numeric(14,2) not null default 0,
  atualizado_em    timestamptz not null default now()
);

comment on table projeto_valor is
  'Dinheiro do projeto, isolado para que a RLS possa negá-lo por inteiro a quem não é gerente, financeiro ou proprietário.';

create or replace function app.criar_valor_do_projeto()
returns trigger language plpgsql as $$
begin
  insert into projeto_valor (projeto_id) values (new.id)
  on conflict (projeto_id) do nothing;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rateio entre empresas — agora sem limite de duas
-- -----------------------------------------------------------------------------
create table projeto_empresa (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references projeto(id)  on delete cascade,
  empresa_id  uuid not null references empresa(id)  on delete restrict,
  percentual  numeric(6,3) not null check (percentual > 0 and percentual <= 100),
  observacao  text,
  criado_em   timestamptz not null default now(),
  unique (projeto_id, empresa_id)
);

comment on table projeto_empresa is
  'Divisão do projeto entre empresas. A soma tem de fechar 100% — conferido por trigger no fim da instrução.';

create index projeto_empresa_empresa_idx on projeto_empresa (empresa_id);

-- Constraint que só faz sentido depois de todas as linhas: trigger de instrução.
create or replace function app.conferir_rateio()
returns trigger language plpgsql as $$
declare r record;
begin
  for r in
    select projeto_id, round(sum(percentual), 3) as total
      from projeto_empresa
     group by projeto_id
    having round(sum(percentual), 3) <> 100
  loop
    raise exception 'Rateio do projeto % soma %%% — tem de fechar 100%%', r.projeto_id, r.total;
  end loop;
  return null;
end;
$$;

create constraint trigger projeto_empresa_fecha_100
  after insert or update or delete on projeto_empresa
  deferrable initially deferred
  for each row execute function app.conferir_rateio();

-- -----------------------------------------------------------------------------
-- Código do projeto: PREFIXO-ANO-NNN, sequencial por empresa e ano
-- -----------------------------------------------------------------------------
create table projeto_contador (
  empresa_id uuid not null references empresa(id) on delete cascade,
  ano        int  not null,
  ultimo     int  not null default 0,
  primary key (empresa_id, ano)
);

create or replace function app.gerar_codigo_projeto()
returns trigger
language plpgsql
as $$
declare
  v_prefixo text;
  v_num     int;
begin
  if new.codigo is not null and new.codigo <> '' then
    return new;                                   -- migração traz código pronto
  end if;

  new.ano := coalesce(new.ano, extract(year from coalesce(new.data_solicitacao, current_date))::int);

  insert into projeto_contador (empresa_id, ano, ultimo)
  values (new.empresa_id, new.ano, 1)
  on conflict (empresa_id, ano) do update set ultimo = projeto_contador.ultimo + 1
  returning ultimo into v_num;

  select prefixo into v_prefixo from empresa where id = new.empresa_id;

  new.numero := v_num;
  new.codigo := format('%s-%s-%s', v_prefixo, new.ano, lpad(v_num::text, 3, '0'));
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fase: só anda por transição declarada em tipo_transicao
-- -----------------------------------------------------------------------------
create table projeto_fase_hist (
  id           uuid primary key default gen_random_uuid(),
  projeto_id   uuid not null references projeto(id) on delete cascade,
  de_fase_id   uuid references tipo_fase(id) on delete set null,
  para_fase_id uuid not null references tipo_fase(id) on delete restrict,
  motivo       text,
  observacao   text,
  pessoa_id    uuid references pessoa(id) on delete set null,
  em           timestamptz not null default now()
);

create index projeto_fase_hist_idx on projeto_fase_hist (projeto_id, em desc);

create or replace function app.controlar_fase()
returns trigger
language plpgsql
as $$
declare
  v_tipo_da_fase uuid;
begin
  -- A fase tem de pertencer ao tipo do projeto. Sempre.
  select tipo_projeto_id into v_tipo_da_fase from tipo_fase where id = new.fase_id;
  if v_tipo_da_fase is distinct from new.tipo_projeto_id then
    raise exception 'A fase escolhida não pertence ao tipo de projeto';
  end if;

  if tg_op = 'UPDATE' and new.fase_id is distinct from old.fase_id then
    if not exists (select 1 from tipo_transicao
                    where de_fase_id = old.fase_id and para_fase_id = new.fase_id) then
      raise exception 'Transição não permitida: % → %',
        (select nome from tipo_fase where id = old.fase_id),
        (select nome from tipo_fase where id = new.fase_id);
    end if;
    new.data_fase := now();
  end if;

  return new;
end;
$$;

comment on function app.controlar_fase() is
  'Recusa fase de outro tipo e transição não declarada. Regra de fluxo é dado (tipo_transicao), não código.';

-- O histórico é gravado DEPOIS: em BEFORE INSERT a linha do projeto ainda não
-- existe, e a chave estrangeira de projeto_fase_hist não teria para onde apontar.
create or replace function app.registrar_fase()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into projeto_fase_hist (projeto_id, para_fase_id, pessoa_id)
    values (new.id, new.fase_id, app.pessoa_atual());
  elsif new.fase_id is distinct from old.fase_id then
    insert into projeto_fase_hist (projeto_id, de_fase_id, para_fase_id, motivo, pessoa_id)
    values (new.id, old.fase_id, new.fase_id, new.motivo_arquivo, app.pessoa_atual());
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Etapa — a decomposição do projeto (EAP) E a linha de orçamento
--
-- No desktop eram duas tabelas (eap e orcamento_previsto) que na prática
-- andavam juntas: cada grupo de orçamento virava etapa do cronograma. Aqui é
-- uma coisa só. Um item de orçamento é uma etapa que tem preço; uma etapa de
-- projeto de TI simplesmente não tem.
-- -----------------------------------------------------------------------------
create table etapa (
  id               uuid primary key default gen_random_uuid(),
  projeto_id       uuid not null references projeto(id) on delete cascade,
  pai_id           uuid references etapa(id) on delete cascade,
  codigo           text not null,                  -- 1, 1.1, 1.1.2
  nome             text not null,
  descricao        text,
  nivel            int  not null default 1 check (nivel between 1 and 6),
  ordem            int  not null default 0,
  folha            boolean not null default true,

  -- Orçamento (só preenchido quando o tipo usa_orcamento)
  unidade          text,
  quantidade       numeric(14,4) not null default 0,
  preco_unitario   numeric(14,4) not null default 0,
  valor            numeric(16,4) generated always as (quantidade * preco_unitario) stored,
  categoria_id     uuid,                           -- FK criada em 006
  fornecedor_id    uuid,                           -- FK criada em 006
  a_confirmar      boolean not null default false, -- preço ainda é palpite

  peso_percentual  numeric(7,4) not null default 0 check (peso_percentual >= 0),
  percentual_concluido numeric(6,3) not null default 0
                   check (percentual_concluido between 0 and 100),

  criado_em        timestamptz not null default now(),
  criado_por       uuid references pessoa(id) on delete set null,
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid references pessoa(id) on delete set null,
  unique (projeto_id, codigo),
  constraint nao_e_pai_de_si check (pai_id is distinct from id)
);

create index etapa_projeto_idx on etapa (projeto_id, ordem);
create index etapa_pai_idx     on etapa (pai_id) where pai_id is not null;

comment on column etapa.a_confirmar is
  'Preço é estimativa, não proposta. Aparece marcado no relatório para não virar número firme por engano.';

-- -----------------------------------------------------------------------------
-- Tarefa — o trabalho agendável
-- -----------------------------------------------------------------------------
create table tarefa (
  id               uuid primary key default gen_random_uuid(),
  projeto_id       uuid not null references projeto(id) on delete cascade,
  etapa_id         uuid references etapa(id)  on delete set null,
  pai_id           uuid references tarefa(id) on delete cascade,
  codigo           text,
  nome             text not null,
  descricao        text,
  responsavel_id   uuid references pessoa(id) on delete set null,

  status           text not null default 'NAO_INICIADA'
                   check (status in ('NAO_INICIADA','EM_ANDAMENTO','BLOQUEADA',
                                     'CONCLUIDA','CANCELADA')),
  marco            boolean not null default false,
  caminho_critico  boolean not null default false,

  data_inicio_prev date,
  data_fim_prev    date,
  data_inicio_real date,
  data_fim_real    date,
  duracao_dias     int check (duracao_dias is null or duracao_dias >= 0),
  folga_total_dias int,
  percentual_concluido numeric(6,3) not null default 0
                   check (percentual_concluido between 0 and 100),

  ordem            int not null default 0,
  observacao       text,
  criado_em        timestamptz not null default now(),
  criado_por       uuid references pessoa(id) on delete set null,
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid references pessoa(id) on delete set null,
  constraint nao_e_pai_de_si check (pai_id is distinct from id),
  constraint marco_nao_tem_duracao
    check (not marco or coalesce(duracao_dias, 0) = 0),
  constraint fim_depois_do_inicio
    check (data_fim_prev is null or data_inicio_prev is null
           or data_fim_prev >= data_inicio_prev)
);

create index tarefa_projeto_idx     on tarefa (projeto_id, ordem);
create index tarefa_etapa_idx       on tarefa (etapa_id) where etapa_id is not null;
create index tarefa_responsavel_idx on tarefa (responsavel_id, status);
create index tarefa_prazo_idx       on tarefa (data_fim_prev)
  where status not in ('CONCLUIDA','CANCELADA');

-- -----------------------------------------------------------------------------
-- Dependências
-- -----------------------------------------------------------------------------
create table tarefa_dependencia (
  id             uuid primary key default gen_random_uuid(),
  tarefa_id      uuid not null references tarefa(id) on delete cascade,
  predecessora_id uuid not null references tarefa(id) on delete cascade,
  tipo           text not null default 'TI'
                 check (tipo in ('TI','II','TT','IT')),
  folga_dias     int not null default 0,
  criado_em      timestamptz not null default now(),
  unique (tarefa_id, predecessora_id),
  constraint nao_depende_de_si check (tarefa_id <> predecessora_id)
);

create index tarefa_dep_pred_idx on tarefa_dependencia (predecessora_id);

-- Ciclo em rede de precedência trava o cálculo de datas e é fácil de criar
-- sem perceber. Barrado na entrada.
create or replace function app.impedir_ciclo()
returns trigger
language plpgsql
as $$
begin
  if exists (
    with recursive cadeia as (
      select new.tarefa_id as id
      union all
      select d.tarefa_id
        from tarefa_dependencia d
        join cadeia c on d.predecessora_id = c.id
    )
    select 1 from cadeia where id = new.predecessora_id
  ) then
    raise exception 'Esta dependência fecha um ciclo no cronograma';
  end if;
  return new;
end;
$$;

create trigger tarefa_dependencia_sem_ciclo
  before insert or update on tarefa_dependencia
  for each row execute function app.impedir_ciclo();

-- -----------------------------------------------------------------------------
-- Checklist
-- -----------------------------------------------------------------------------
create table tarefa_checklist (
  id           uuid primary key default gen_random_uuid(),
  tarefa_id    uuid not null references tarefa(id) on delete cascade,
  texto        text not null,
  concluido    boolean not null default false,
  concluido_em timestamptz,
  concluido_por uuid references pessoa(id) on delete set null,
  ordem        int not null default 0
);

create index tarefa_checklist_idx on tarefa_checklist (tarefa_id, ordem);

-- -----------------------------------------------------------------------------
-- Equipe: alocação e apontamento
-- -----------------------------------------------------------------------------
create table alocacao (
  id                   uuid primary key default gen_random_uuid(),
  projeto_id           uuid not null references projeto(id) on delete cascade,
  tarefa_id            uuid references tarefa(id) on delete cascade,
  pessoa_id            uuid not null references pessoa(id) on delete cascade,
  papel                text,
  percentual_dedicacao numeric(6,3) not null default 100
                       check (percentual_dedicacao > 0 and percentual_dedicacao <= 100),
  custo_hora           numeric(12,2) not null default 0,   -- congelado na alocação
  data_inicio          date,
  data_fim             date,
  ativo                boolean not null default true,
  criado_em            timestamptz not null default now(),
  constraint periodo_valido check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);

create index alocacao_pessoa_idx  on alocacao (pessoa_id, ativo);
create index alocacao_projeto_idx on alocacao (projeto_id);

create table apontamento_hora (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references projeto(id) on delete cascade,
  tarefa_id   uuid references tarefa(id) on delete set null,
  etapa_id    uuid references etapa(id)  on delete set null,
  pessoa_id   uuid not null references pessoa(id) on delete cascade,
  data        date not null default current_date,
  horas       numeric(6,2) not null check (horas > 0 and horas <= 24),
  custo_hora  numeric(12,2) not null default 0,
  valor       numeric(14,2) generated always as (horas * custo_hora) stored,
  descricao   text,
  criado_em   timestamptz not null default now(),
  criado_por  uuid references pessoa(id) on delete set null
);

create index apontamento_pessoa_idx  on apontamento_hora (pessoa_id, data desc);
create index apontamento_projeto_idx on apontamento_hora (projeto_id, data desc);

-- -----------------------------------------------------------------------------
-- Conversa, arquivo, ocorrência, ideia
-- -----------------------------------------------------------------------------
create table comentario (
  id            uuid primary key default gen_random_uuid(),
  projeto_id    uuid not null references projeto(id) on delete cascade,
  tarefa_id     uuid references tarefa(id) on delete cascade,
  etapa_id      uuid references etapa(id)  on delete cascade,
  responde_id   uuid references comentario(id) on delete cascade,
  pessoa_id     uuid not null references pessoa(id) on delete restrict,
  texto         text not null check (btrim(texto) <> ''),
  mencionados   uuid[] not null default '{}',
  criado_em     timestamptz not null default now(),
  editado_em    timestamptz
);

create index comentario_projeto_idx on comentario (projeto_id, criado_em desc);
create index comentario_tarefa_idx  on comentario (tarefa_id, criado_em) where tarefa_id is not null;

create table anexo (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references projeto(id) on delete cascade,
  tarefa_id      uuid references tarefa(id) on delete set null,
  etapa_id       uuid references etapa(id)  on delete set null,
  contrato_id    uuid,                              -- FK criada em 006
  medicao_id     uuid,                              -- FK criada em 006
  tipo           text not null default 'OUTRO'
                 check (tipo in ('PROJETO','MEMORIAL','ART','CONTRATO','ADITIVO',
                                 'MEDICAO','PROPOSTA','NOTA_FISCAL','FOTO',
                                 'RELATORIO','OUTRO')),
  titulo         text not null,
  versao         text,
  storage_path   text not null,                     -- caminho no Supabase Storage
  mime           text,
  bytes          bigint check (bytes is null or bytes >= 0),
  data_documento date,
  autor          text,
  secao          text,                              -- agrupa fotos no relatório
  ordem          int not null default 0,
  observacao     text,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references pessoa(id) on delete set null
);

create index anexo_projeto_idx on anexo (projeto_id, tipo);

create table ocorrencia (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references projeto(id) on delete cascade,
  tarefa_id      uuid references tarefa(id) on delete set null,
  data           date not null default current_date,
  tipo           text not null default 'NOTA'
                 check (tipo in ('NOTA','RISCO','PROBLEMA','DECISAO','REUNIAO','PARALISACAO')),
  titulo         text not null,
  descricao      text,
  impacto        text check (impacto in ('BAIXO','MEDIO','ALTO')),
  probabilidade  text check (probabilidade in ('BAIXA','MEDIA','ALTA')),
  responsavel_id uuid references pessoa(id) on delete set null,
  status         text not null default 'ABERTA'
                 check (status in ('ABERTA','EM_TRATATIVA','RESOLVIDA','ACEITA')),
  resolvido_em   date,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references pessoa(id) on delete set null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references pessoa(id) on delete set null
);

create index ocorrencia_projeto_idx on ocorrencia (projeto_id, data desc);
create index ocorrencia_aberta_idx  on ocorrencia (status) where status in ('ABERTA','EM_TRATATIVA');

-- Banco de ideias: agora do núcleo, não só do rito de investimento.
create table ideia (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  descricao       text,
  local           text,
  empresa_id      uuid references empresa(id) on delete set null,
  autor_id        uuid references pessoa(id)  on delete set null,
  autor_nome      text,                        -- quem sugeriu e não tem cadastro
  valor_estimado  numeric(14,2),
  tipo_projeto_id uuid references tipo_projeto(id) on delete set null,
  situacao        text not null default 'NOVA'
                  check (situacao in ('NOVA','EM_ANALISE','VIROU_PROJETO','DESCARTADA')),
  motivo          text,
  projeto_id      uuid references projeto(id) on delete set null,
  data            date not null default current_date,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references pessoa(id) on delete set null,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references pessoa(id) on delete set null,
  constraint virou_projeto_tem_projeto
    check (situacao <> 'VIROU_PROJETO' or projeto_id is not null),
  constraint descartada_tem_motivo
    check (situacao <> 'DESCARTADA' or motivo is not null)
);

create index ideia_situacao_idx on ideia (situacao, data desc);

-- -----------------------------------------------------------------------------
-- Triggers do projeto
-- -----------------------------------------------------------------------------
create trigger projeto_codigo
  before insert on projeto
  for each row execute function app.gerar_codigo_projeto();

-- Nome escolhido pela ordem: triggers de mesmo tempo disparam em ordem
-- alfabética, e a mensagem que o usuário vê é a do primeiro que reclamar.
-- A sequência útil é fase (transição existe?) → pareceres (fase anterior
-- cumprida?) → campos (o que falta preencher). Daí "validacao" vir depois
-- de "fase" e de "pareceres".
create trigger projeto_validacao_campos
  before insert or update of campos, fase_id, tipo_projeto_id on projeto
  for each row execute function app.validar_campos();

create trigger projeto_fase
  before insert or update of fase_id on projeto
  for each row execute function app.controlar_fase();

create trigger projeto_valor_inicial
  after insert on projeto
  for each row execute function app.criar_valor_do_projeto();

-- Nome com "z" de propósito: triggers de mesmo tempo disparam em ordem
-- alfabética, e o histórico tem de ser o último a rodar.
create trigger projeto_zz_historico
  after insert or update of fase_id on projeto
  for each row execute function app.registrar_fase();

select app.instrumentar('projeto');
select app.instrumentar('etapa');
select app.instrumentar('tarefa');
select app.instrumentar('ocorrencia');
select app.instrumentar('ideia');
