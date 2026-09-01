-- =============================================================================
-- GestPlan · a decisão ganha lugar próprio, e a ocorrência deixa de acumular
--
-- Duas coisas separadas, porque são perguntas diferentes:
--
--   OCORRÊNCIA responde "o que aconteceu e o que se faz a respeito" — risco,
--   problema, paralisação. Tem gravidade, probabilidade, responsável e
--   SITUAÇÃO: nasce aberta e precisa ser fechada. Serve para cobrar.
--
--   DECISÃO responde "o que ficou combinado, e por quê". Não tem situação:
--   decisão não fica pendente, ela é tomada. O que ela tem e a ocorrência não
--   é o que foi DESCARTADO — e é justamente isso que ninguém lembra seis meses
--   depois, quando alguém pergunta "por que não fizemos do outro jeito?".
--
-- A TABELA `ocorrencia` JÁ EXISTIA e tinha 'DECISAO' na lista de tipos. Sai
-- daí: com a tabela nova, registrar decisão em dois lugares diferentes daria
-- duas listas incompletas, e nenhuma delas seria a verdadeira. A remoção é
-- segura porque a tabela está VAZIA em produção — conferido antes de escrever.
--
-- E os campos da ocorrência mostram para que ela foi feita: `probabilidade` e
-- `resolvido_em` não querem dizer nada numa decisão.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Decisão
-- -----------------------------------------------------------------------------
create table decisao (
  id           uuid primary key default gen_random_uuid(),
  projeto_id   uuid not null references projeto(id) on delete cascade,

  decidido_em  date not null default current_date,
  titulo       text not null check (btrim(titulo) <> ''),

  -- O que estava em jogo quando se decidiu. Sem isto, a decisão lida daqui a
  -- um ano parece arbitrária — e quem a lê não sabe o que ela resolvia.
  contexto     text,

  -- O que ficou combinado. É o único campo além do título que a tela cobra.
  decisao      text not null check (btrim(decisao) <> ''),

  -- O QUE FOI DESCARTADO, e por quê. É o campo que justifica esta tabela
  -- existir: guardar só a escolha faz a mesma discussão voltar do zero toda
  -- vez que alguém novo chega.
  alternativas text,

  -- Quem decidiu. Duas colunas pelo mesmo motivo de `aprovacao`: quem decide
  -- nem sempre tem cadastro — diretor, cliente, fornecedor.
  decidido_por uuid references pessoa(id) on delete set null,
  quem_avulso  text,

  criado_em    timestamptz not null default now(),
  criado_por   uuid references pessoa(id) on delete set null,

  constraint decisao_tem_quem
    check (decidido_por is not null or btrim(coalesce(quem_avulso, '')) <> '')
);

comment on table decisao is
  'O que ficou combinado num projeto, e por quê. Separada de `ocorrencia` '
  'porque decisão não tem situação — ela não fica pendente, é tomada. O campo '
  'que a justifica é `alternativas`: sem o que foi descartado, a mesma '
  'discussão volta do zero.';

create index decisao_do_projeto_idx on decisao (projeto_id, decidido_em desc);

alter table decisao enable row level security;
alter table decisao force row level security;

-- Mesma regra dos filhos de projeto: quem alcança o projeto lê; quem edita o
-- projeto registra.
create policy decisao_le on decisao for select
  using (app.pode_ver_interno(projeto_id));
create policy decisao_escreve on decisao for all
  using (app.pode_editar_projeto(projeto_id))
  with check (app.pode_editar_projeto(projeto_id));

-- -----------------------------------------------------------------------------
-- A ocorrência para de acumular decisão
-- -----------------------------------------------------------------------------
-- Só é seguro porque a tabela está vazia; com linha 'DECISAO' dentro, isto
-- precisaria de uma migração de dados antes.
alter table ocorrencia drop constraint if exists ocorrencia_tipo_check;
alter table ocorrencia add constraint ocorrencia_tipo_check
  check (tipo in ('NOTA','RISCO','PROBLEMA','REUNIAO','PARALISACAO'));

comment on table ocorrencia is
  'O que aconteceu no projeto e o que se faz a respeito: risco, problema, '
  'paralisação. Nasce ABERTA e precisa ser fechada — serve para cobrar. '
  'Decisão NÃO mora aqui: tem tabela própria desde 20260901180000.';

-- Faltava a política de UPDATE: dava para abrir uma ocorrência e nunca mais
-- mudar o status dela, o que torna o registro inútil para acompanhamento.
create policy ocorrencia_trata on ocorrencia for update
  using (app.pode_editar_projeto(projeto_id))
  with check (app.pode_editar_projeto(projeto_id));

create policy ocorrencia_apaga on ocorrencia for delete
  using (app.pode_editar_projeto(projeto_id));
