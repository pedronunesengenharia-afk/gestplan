-- =============================================================================
-- GestPlan · 006_dinheiro.sql
-- Fornecedores, contratos, parcelas, custo realizado e medição.
--
-- Só saída. Não existe contrato de venda, cliente faturado nem nota de saída:
-- com a AWG fora do modelo, o GestPlan controla desembolso, não receita. Se um
-- dia entrar obra faturada, isso é um tipo novo na Camada 2 com as tabelas
-- dele — não colunas "para o caso de" aqui.
-- =============================================================================

create table categoria_custo (
  id     uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome   text not null,
  tipo   text not null check (tipo in ('DIRETO','INDIRETO')),
  ordem  int  not null default 0,
  ativo  boolean not null default true
);

create table fornecedor (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  razao_social  text,
  cnpj_cpf      text,
  tipo          text check (tipo in ('MATERIAL','SERVICO','EQUIPAMENTO','MAO_DE_OBRA','OUTRO')),
  contato_nome  text,
  contato_email text,
  contato_fone  text,
  cidade        text,
  uf            char(2),
  observacao    text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  criado_por    uuid references pessoa(id) on delete set null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references pessoa(id) on delete set null
);

create unique index fornecedor_cnpj_idx on fornecedor (cnpj_cpf) where cnpj_cpf is not null;
create index fornecedor_ativo_idx on fornecedor (ativo) where ativo;

-- Fecha o vínculo do papel EXTERNO, prometido em 002.
alter table pessoa
  add constraint pessoa_fornecedor_fk
  foreign key (fornecedor_id) references fornecedor(id) on delete set null;

-- E as FKs que 004 deixou em aberto.
alter table etapa
  add constraint etapa_categoria_fk  foreign key (categoria_id)  references categoria_custo(id) on delete set null,
  add constraint etapa_fornecedor_fk foreign key (fornecedor_id) references fornecedor(id)      on delete set null;

-- -----------------------------------------------------------------------------
-- Contrato — sempre de coisa contratada
-- -----------------------------------------------------------------------------
create table contrato (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references projeto(id) on delete cascade,
  fornecedor_id   uuid not null references fornecedor(id) on delete restrict,
  numero          text not null,
  objeto          text not null,
  categoria_id    uuid references categoria_custo(id) on delete set null,
  valor           numeric(14,2) not null default 0,
  valor_aditivos  numeric(14,2) not null default 0,   -- mantido por trigger
  data_assinatura date,
  data_inicio     date,
  data_fim        date,
  forma_pagamento text,
  garantia_meses  int check (garantia_meses is null or garantia_meses >= 0),
  status          text not null default 'VIGENTE'
                  check (status in ('EM_NEGOCIACAO','VIGENTE','SUSPENSO','ENCERRADO','RESCINDIDO')),
  observacao      text,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references pessoa(id) on delete set null,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references pessoa(id) on delete set null,
  unique (projeto_id, numero),
  constraint vigencia_valida check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);

create index contrato_projeto_idx    on contrato (projeto_id);
create index contrato_fornecedor_idx on contrato (fornecedor_id, status);

create table contrato_aditivo (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid not null references contrato(id) on delete cascade,
  numero        text not null,
  tipo          text not null check (tipo in ('VALOR','PRAZO','VALOR_E_PRAZO','ESCOPO')),
  data          date not null default current_date,
  valor         numeric(14,2) not null default 0,
  dias_prazo    int not null default 0,
  justificativa text,
  criado_em     timestamptz not null default now(),
  criado_por    uuid references pessoa(id) on delete set null,
  unique (contrato_id, numero)
);

create or replace function app.somar_aditivos()
returns trigger
language plpgsql
as $$
declare v_contrato uuid := coalesce(new.contrato_id, old.contrato_id);
begin
  update contrato c
     set valor_aditivos = coalesce(
           (select sum(valor) from contrato_aditivo where contrato_id = v_contrato), 0)
   where c.id = v_contrato;
  return null;
end;
$$;

create trigger contrato_aditivo_soma
  after insert or update or delete on contrato_aditivo
  for each row execute function app.somar_aditivos();

-- Agora anexo pode apontar para contrato.
alter table anexo
  add constraint anexo_contrato_fk foreign key (contrato_id) references contrato(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Parcelas — o cronograma financeiro, item a item
-- -----------------------------------------------------------------------------
create table parcela (
  id           uuid primary key default gen_random_uuid(),
  projeto_id   uuid not null references projeto(id) on delete cascade,
  etapa_id     uuid references etapa(id)    on delete cascade,
  contrato_id  uuid references contrato(id) on delete cascade,
  numero       int  not null check (numero > 0),
  descricao    text,
  valor        numeric(14,2) not null check (valor >= 0),
  vencimento   date not null,
  competencia  char(7) generated always as (app.competencia(vencimento)) stored,
  pago_em      date,
  valor_pago   numeric(14,2),
  criado_em    timestamptz not null default now(),
  criado_por   uuid references pessoa(id) on delete set null,
  constraint parcela_tem_origem check (etapa_id is not null or contrato_id is not null),
  constraint pago_tem_valor check (pago_em is null or valor_pago is not null)
);

create index parcela_projeto_idx on parcela (projeto_id, vencimento);
create index parcela_aberta_idx  on parcela (vencimento) where pago_em is null;

comment on table parcela is
  'Desdobramento do pagamento de um item ou contrato. É o que alimenta o fluxo mensal e a curva de desembolso.';

-- -----------------------------------------------------------------------------
-- Custo realizado
-- -----------------------------------------------------------------------------
create table custo (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references projeto(id) on delete cascade,
  etapa_id       uuid references etapa(id)       on delete set null,
  categoria_id   uuid not null references categoria_custo(id) on delete restrict,
  fornecedor_id  uuid references fornecedor(id)  on delete set null,
  contrato_id    uuid references contrato(id)    on delete set null,
  parcela_id     uuid references parcela(id)     on delete set null,
  origem         text not null default 'LANCAMENTO'
                 check (origem in ('LANCAMENTO','APONTAMENTO_HORA','RATEIO','IMPORTACAO')),
  data           date not null default current_date,
  competencia    char(7) generated always as (app.competencia(data)) stored,
  documento      text,
  descricao      text not null,
  quantidade     numeric(14,4) not null default 0,
  unidade        text,
  preco_unitario numeric(14,4) not null default 0,
  valor          numeric(14,2) not null,
  status_pagamento text not null default 'PREVISTO'
                 check (status_pagamento in ('PREVISTO','APROVADO','PAGO','CANCELADO')),
  vencimento     date,
  pago_em        date,
  observacao     text,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references pessoa(id) on delete set null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references pessoa(id) on delete set null,
  constraint pago_tem_data check (status_pagamento <> 'PAGO' or pago_em is not null)
);

create index custo_projeto_idx  on custo (projeto_id, data desc);
create index custo_comp_idx     on custo (projeto_id, competencia);
create index custo_categoria_idx on custo (categoria_id);
create index custo_aberto_idx   on custo (vencimento)
  where status_pagamento in ('PREVISTO','APROVADO');

-- -----------------------------------------------------------------------------
-- Medição — para os tipos que medem por item executado
-- -----------------------------------------------------------------------------
create table medicao (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references projeto(id) on delete cascade,
  contrato_id    uuid references contrato(id) on delete set null,
  numero         int not null check (numero > 0),
  competencia    char(7) not null check (competencia ~ '^\d{4}-\d{2}$'),
  data_inicio    date,
  data_fim       date,
  data_medicao   date not null default current_date,
  status         text not null default 'ABERTA'
                 check (status in ('ABERTA','FECHADA','APROVADA','PAGA')),
  valor_bruto    numeric(14,2) not null default 0,
  valor_retencao numeric(14,2) not null default 0,
  valor_liquido  numeric(14,2) generated always as (valor_bruto - valor_retencao) stored,
  observacao     text,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references pessoa(id) on delete set null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references pessoa(id) on delete set null,
  unique (projeto_id, numero)
);

create index medicao_projeto_idx on medicao (projeto_id, competencia);

create table medicao_item (
  id          uuid primary key default gen_random_uuid(),
  medicao_id  uuid not null references medicao(id) on delete cascade,
  etapa_id    uuid not null references etapa(id)   on delete cascade,
  quantidade  numeric(14,4) not null default 0,
  percentual  numeric(7,4)  not null default 0 check (percentual between 0 and 100),
  valor       numeric(14,2) not null default 0,
  observacao  text,
  unique (medicao_id, etapa_id)
);

alter table anexo
  add constraint anexo_medicao_fk foreign key (medicao_id) references medicao(id) on delete set null;

-- Soma os itens no cabeçalho da medição.
create or replace function app.somar_medicao()
returns trigger
language plpgsql
as $$
declare v_medicao uuid := coalesce(new.medicao_id, old.medicao_id);
begin
  update medicao m
     set valor_bruto = coalesce((select sum(valor) from medicao_item where medicao_id = v_medicao), 0)
   where m.id = v_medicao;
  return null;
end;
$$;

create trigger medicao_item_soma
  after insert or update or delete on medicao_item
  for each row execute function app.somar_medicao();

-- -----------------------------------------------------------------------------
-- Espelho dos totais em projeto_valor
--
-- Poderia ser view. É coluna porque a carteira lista 300 projetos com os
-- totais na tela, e recalcular a soma de custo de todos a cada abertura é o
-- tipo de lentidão que faz o time voltar para a planilha.
-- -----------------------------------------------------------------------------
create or replace function app.atualizar_valores_do_projeto(p_projeto uuid)
returns void
language sql
as $$
  update projeto_valor v
     set valor_orcado    = coalesce((select sum(valor) from etapa where projeto_id = p_projeto and folha), 0),
         valor_realizado = coalesce((select sum(valor) from custo
                                      where projeto_id = p_projeto
                                        and status_pagamento <> 'CANCELADO'), 0),
         valor_pago      = coalesce((select sum(valor) from custo
                                      where projeto_id = p_projeto
                                        and status_pagamento = 'PAGO'), 0),
         atualizado_em   = now()
   where v.projeto_id = p_projeto;
$$;

create or replace function app.disparar_totais()
returns trigger
language plpgsql
as $$
begin
  perform app.atualizar_valores_do_projeto(coalesce(new.projeto_id, old.projeto_id));
  return null;
end;
$$;

create trigger etapa_totais after insert or update or delete on etapa
  for each row execute function app.disparar_totais();
create trigger custo_totais after insert or update or delete on custo
  for each row execute function app.disparar_totais();

select app.instrumentar('fornecedor');
select app.instrumentar('contrato');
select app.instrumentar('custo');
select app.instrumentar('medicao');
