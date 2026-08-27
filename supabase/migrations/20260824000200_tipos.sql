-- =============================================================================
-- GestPlan · 003_tipos.sql
-- A Camada 2: tipos de projeto, fases, transições e campos customizados.
--
-- É o coração da estratégia. Tudo que varia de um tipo de projeto para outro
-- vive AQUI, como dado. Nenhuma outra migração pode conter
-- `if tipo = 'INVESTIMENTO'` — se precisar, é porque a regra deveria estar
-- descrita nestas tabelas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipo de projeto
-- -----------------------------------------------------------------------------
create table tipo_projeto (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,
  nome          text not null,
  descricao     text,
  cor           text not null default '#009DB0' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  icone         text,
  ordem         int  not null default 0,

  -- Capacidades. São booleanos, não jsonb, porque o resto do schema depende
  -- deles e um erro de digitação em chave de jsonb passa silencioso.
  usa_etapas      boolean not null default true,   -- decomposição hierárquica
  usa_orcamento   boolean not null default true,   -- etapa carrega quantidade e preço
  usa_cronograma  boolean not null default true,   -- datas e dependências
  usa_medicao     boolean not null default false,  -- boletim de medição por item
  usa_recorrencia boolean not null default false,  -- gera ocorrências futuras
  usa_pontuacao   boolean not null default true,   -- entra na fila por prioridade

  mede_avanco_por text not null default 'ETAPAS'
                  check (mede_avanco_por in ('ETAPAS','TAREFAS','MEDICAO','CHECKLIST','DESEMBOLSO')),

  extras        jsonb not null default '{}'::jsonb,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table tipo_projeto is
  'Um template. Acrescentar um tipo novo é INSERT, nunca migração.';

-- -----------------------------------------------------------------------------
-- Fases de cada tipo — substitui o CHECK fixo de projeto.fase
-- -----------------------------------------------------------------------------
create table tipo_fase (
  id               uuid primary key default gen_random_uuid(),
  tipo_projeto_id  uuid not null references tipo_projeto(id) on delete cascade,
  codigo           text not null,
  nome             text not null,
  ordem            int  not null,
  categoria        text not null check (categoria in
                     ('PREPARACAO','EXECUCAO','ENCERRAMENTO','ARQUIVADO')),
  cor              text not null default '#647C85' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  inicial          boolean not null default false,
  conclusiva       boolean not null default false,

  -- Regras de saída: o que precisa estar pronto para deixar esta fase.
  exige_setores    text[] not null default '{}',   -- setores que precisam assinar
  exige_cronograma boolean not null default false, -- todas as tarefas com data
  exige_orcamento  boolean not null default false, -- pelo menos um item de orçamento

  unique (tipo_projeto_id, codigo),
  unique (tipo_projeto_id, ordem) deferrable initially deferred
);

comment on column tipo_fase.exige_setores is
  'Setores cujo parecer precisa estar assinado para sair da fase. É assim que "não avança sem viabilidade" vira dado, não código.';

-- Uma fase inicial por tipo, e no máximo uma.
create unique index tipo_fase_inicial_unica
  on tipo_fase (tipo_projeto_id) where inicial;

-- -----------------------------------------------------------------------------
-- Transições permitidas
-- -----------------------------------------------------------------------------
create table tipo_transicao (
  id           uuid primary key default gen_random_uuid(),
  de_fase_id   uuid not null references tipo_fase(id) on delete cascade,
  para_fase_id uuid not null references tipo_fase(id) on delete cascade,
  rotulo       text not null,
  papeis       text[] not null default '{GERENTE_PROJETOS}',
  exige_motivo boolean not null default false,
  ordem        int not null default 0,
  check (de_fase_id <> para_fase_id),
  unique (de_fase_id, para_fase_id)
);

comment on table tipo_transicao is
  'Grafo de fases. O que não está aqui não acontece — o trigger de 004 recusa.';

-- As duas fases de uma transição têm de ser do mesmo tipo de projeto.
create or replace function app.validar_transicao()
returns trigger
language plpgsql
as $$
declare
  v_de uuid; v_para uuid;
begin
  select tipo_projeto_id into v_de   from tipo_fase where id = new.de_fase_id;
  select tipo_projeto_id into v_para from tipo_fase where id = new.para_fase_id;
  if v_de is distinct from v_para then
    raise exception 'Transição entre tipos de projeto diferentes (% e %)', v_de, v_para;
  end if;
  return new;
end;
$$;

create trigger tipo_transicao_mesmo_tipo
  before insert or update on tipo_transicao
  for each row execute function app.validar_transicao();

-- -----------------------------------------------------------------------------
-- Campos customizados — o motor
-- -----------------------------------------------------------------------------
create table campo_definicao (
  id               uuid primary key default gen_random_uuid(),
  tipo_projeto_id  uuid not null references tipo_projeto(id) on delete cascade,
  grupo            text not null default 'Geral',
  codigo           text not null check (codigo ~ '^[a-z][a-z0-9_]*$'),
  rotulo           text not null,
  ajuda            text,
  tipo_dado        text not null check (tipo_dado in (
                     'TEXTO','TEXTO_LONGO','NUMERO','MOEDA','PERCENTUAL',
                     'DATA','BOOLEANO','SELECAO','SELECAO_MULTIPLA',
                     'PESSOA','EMPRESA','ARQUIVO')),
  opcoes           jsonb not null default '[]'::jsonb,   -- para SELECAO*
  valor_padrao     jsonb,
  minimo           numeric,
  maximo           numeric,

  -- Fase que o campo tranca: para SAIR dela, o campo tem de estar preenchido.
  -- Nulo = opcional sempre. A semântica é a mesma de tipo_fase.exige_setores —
  -- exigência de saída, não de entrada. Entra-se na Viabilidade justamente
  -- para preenchê-la; o que não se faz é sair dela em branco.
  exigido_para_sair_de uuid references tipo_fase(id) on delete set null,

  papeis_leitura   text[] not null default '{}',  -- vazio = todos que veem o projeto
  ordem            int not null default 0,
  ativo            boolean not null default true,
  unique (tipo_projeto_id, codigo)
);

comment on table campo_definicao is
  'Esquema dos campos próprios de cada tipo. Os valores ficam em projeto.campos (jsonb).';
comment on column campo_definicao.exigido_para_sair_de is
  'Para deixar esta fase, o campo precisa estar preenchido. Nulo = opcional sempre.';

create index campo_definicao_tipo_idx on campo_definicao (tipo_projeto_id, ordem);

-- -----------------------------------------------------------------------------
-- Validação dos valores contra o esquema
-- -----------------------------------------------------------------------------
create or replace function app.validar_campos()
returns trigger
language plpgsql
as $$
declare
  d          record;
  v          jsonb;
  v_ordem    int;
  v_extras   text[];
begin
  -- Ordem da fase atual, para decidir o que já é obrigatório.
  select f.ordem into v_ordem from tipo_fase f where f.id = new.fase_id;
  v_ordem := coalesce(v_ordem, 0);

  -- Nenhuma chave desconhecida. Campo que não existe é erro de digitação,
  -- e erro de digitação silencioso em jsonb é dívida que aparece meses depois.
  select array_agg(k) into v_extras
    from jsonb_object_keys(new.campos) as k
   where not exists (
     select 1 from campo_definicao cd
      where cd.tipo_projeto_id = new.tipo_projeto_id and cd.codigo = k and cd.ativo);
  if v_extras is not null then
    raise exception 'Campo inexistente para este tipo de projeto: %', array_to_string(v_extras, ', ');
  end if;

  for d in
    select * from campo_definicao
     where tipo_projeto_id = new.tipo_projeto_id and ativo
  loop
    v := new.campos -> d.codigo;

    -- Exigência de saída: só cobra quando o projeto JÁ PASSOU da fase que o
    -- campo tranca.
    if d.exigido_para_sair_de is not null then
      if v_ordem > (select ordem from tipo_fase where id = d.exigido_para_sair_de)
         and (v is null or v = 'null'::jsonb
              or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '')) then
        raise exception 'Campo obrigatório para sair de %: % (%)',
          (select nome from tipo_fase where id = d.exigido_para_sair_de), d.rotulo, d.codigo;
      end if;
    end if;

    if v is null or v = 'null'::jsonb then
      continue;
    end if;

    -- Tipo do valor.
    case d.tipo_dado
      when 'NUMERO','MOEDA','PERCENTUAL' then
        if jsonb_typeof(v) <> 'number' then
          raise exception 'Campo % espera número, recebeu %', d.codigo, jsonb_typeof(v);
        end if;
        if d.minimo is not null and (v #>> '{}')::numeric < d.minimo then
          raise exception 'Campo % abaixo do mínimo (%)', d.codigo, d.minimo;
        end if;
        if d.maximo is not null and (v #>> '{}')::numeric > d.maximo then
          raise exception 'Campo % acima do máximo (%)', d.codigo, d.maximo;
        end if;
      when 'BOOLEANO' then
        if jsonb_typeof(v) <> 'boolean' then
          raise exception 'Campo % espera verdadeiro/falso', d.codigo;
        end if;
      when 'DATA' then
        begin
          perform (v #>> '{}')::date;
        exception when others then
          raise exception 'Campo % espera data no formato AAAA-MM-DD', d.codigo;
        end;
      when 'SELECAO' then
        if not (d.opcoes @> jsonb_build_array(v #>> '{}')) then
          raise exception 'Campo %: opção inválida (%)', d.codigo, v #>> '{}';
        end if;
      when 'SELECAO_MULTIPLA' then
        if jsonb_typeof(v) <> 'array' then
          raise exception 'Campo % espera uma lista', d.codigo;
        end if;
        if exists (select 1 from jsonb_array_elements_text(v) e
                    where not (d.opcoes @> jsonb_build_array(e))) then
          raise exception 'Campo %: lista contém opção inválida', d.codigo;
        end if;
      else
        null;  -- TEXTO, PESSOA, EMPRESA, ARQUIVO: conferidos por FK/aplicação
    end case;
  end loop;

  return new;
end;
$$;

comment on function app.validar_campos() is
  'Trigger de projeto: confere projeto.campos contra campo_definicao — tipo, faixa, opção e obrigatoriedade por fase.';
