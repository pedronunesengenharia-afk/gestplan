-- =============================================================================
-- GestPlan · ajustes exigidos pelos dados reais do desktop
--
-- Migração escrita depois de ler o `gestao_projetos.db` de verdade. Cada bloco
-- aqui existe porque um dado real não coube no modelo — e o dado é que está
-- certo: ele descreve como o trabalho acontece.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Frente de serviço e marca de segurança
--
-- O desktop classifica projeto por FRENTE (Melhoria Predial, Equipamentos,
-- Segurança do trabalho…) e marca os de segurança para filtrar a carteira. As
-- duas coisas valem para qualquer tipo de projeto, então são núcleo — não
-- campo customizado de um tipo.
-- -----------------------------------------------------------------------------
alter table projeto add column if not exists frente text;
alter table projeto add column if not exists seguranca boolean not null default false;

comment on column projeto.frente is
  'Agrupamento da carteira, como o desktop já usava. Texto livre por ora; vira cadastro quando a lista estabilizar.';
comment on column projeto.seguranca is
  'Projeto de segurança do trabalho. Filtro da carteira — herdado do desktop, onde já era usado.';

create index if not exists projeto_frente_idx on projeto (frente) where frente is not null;
create index if not exists projeto_seguranca_idx on projeto (seguranca) where seguranca;

-- -----------------------------------------------------------------------------
-- 2 · Parcela: a regra, não só a data
--
-- Eu modelei `parcela` como valor + vencimento. O desktop modela outra coisa, e
-- modela melhor: "40% na aprovação, 60% na conclusão, 30 dias". Isso é uma
-- REGRA — a data nasce quando o evento acontece. Guardar só a data derivada
-- perde a informação que permite replanejar.
--
-- Então valor e vencimento passam a ser opcionais: existem quando a parcela já
-- foi ancorada num evento que ocorreu. Enquanto não ocorreu, valem percentual,
-- evento e prazo.
-- -----------------------------------------------------------------------------
alter table parcela add column if not exists percentual numeric(7,4)
  check (percentual is null or (percentual > 0 and percentual <= 100));
alter table parcela add column if not exists evento text
  check (evento is null or evento in ('INICIO','APROVACAO','CONCLUSAO','ENTREGA','DATA_FIXA'));
alter table parcela add column if not exists prazo_dias int
  check (prazo_dias is null or prazo_dias >= 0);
alter table parcela add column if not exists descricao_evento text;

alter table parcela alter column valor      drop not null;
alter table parcela alter column vencimento drop not null;

comment on column parcela.evento is
  'O que dispara o pagamento. A data sai do evento mais prazo_dias — por isso vencimento pode estar vazio até lá.';

-- Uma parcela é ou uma data firme, ou uma regra. Nunca nenhuma das duas.
alter table parcela drop constraint if exists parcela_e_data_ou_regra;
alter table parcela add constraint parcela_e_data_ou_regra check (
  (vencimento is not null and valor is not null)
  or (percentual is not null and evento is not null)
);

-- app.competencia() precisa aceitar nulo agora que vencimento aceita.
create or replace function app.competencia(p_data date)
returns char(7)
language sql
immutable
as $$
  select case when p_data is null then null else
    (lpad(extract(year  from p_data)::text, 4, '0') || '-' ||
     lpad(extract(month from p_data)::text, 2, '0'))::char(7)
  end;
$$;

-- -----------------------------------------------------------------------------
-- 3 · Os nove critérios de pontuação que o desktop usa de fato
--
-- Eu tinha semeado seis. O banco real usa NOVE, em dois blocos que foram
-- criados em momentos diferentes: os quatro `pont_*` originais e os cinco
-- `imp_*` que vieram depois.
--
-- `pont_faturamento` e `imp_faturamento` coexistem e divergem em 19 dos 29
-- projetos — não são a mesma nota digitada duas vezes. Entram os dois, com
-- rótulos que dizem de onde vêm, para nenhuma nota se perder na importação.
-- Se a intenção era que o segundo bloco substituísse o primeiro, o conserto é
-- `update pontuacao_criterio set ativo = false` nos quatro antigos: como os
-- cortes de prioridade são FRAÇÃO do máximo possível, a régua se reajusta
-- sozinha e nenhum projeto precisa ser repontuado.
-- -----------------------------------------------------------------------------
insert into pontuacao_criterio (codigo, nome, descricao, minimo, maximo, peso, ordem) values
  ('IMP_FATURAMENTO', 'Importância — faturamento',
   'Bloco de importância. Convive com "Aumenta faturamento", do bloco de prioridade.', 0, 5, 1, 7),
  ('ORGANIZACAO', 'Organização',
   'Ganho de ordem, fluxo e controle na operação.', 0, 5, 1, 8),
  ('ARQUITETONICO', 'Arquitetônico',
   'Efeito sobre a aparência e a apresentação da planta.', 0, 5, 1, 9)
on conflict (codigo) do nothing;

-- Os cinco critérios do bloco de importância entram DESLIGADOS. Não é
-- desconfiança do bloco: é que ele está preenchido em 12 a 23 dos 29 projetos,
-- enquanto os quatro do bloco de prioridade estão em 28. Ligar os nove sem
-- terminar de pontuar não acrescenta informação — dilui a régua.
--
-- Os números, medidos sobre a carteira importada:
--
--   os 4 do desktop      →  10 urgentes, 18 importantes,  1 planejamento
--   os 9 juntos          →   1 urgente,  25 importantes,  3 planejamento
--   só os 5 novos        →   0 urgentes, 19 importantes, 10 planejamento
--
-- Com os nove ligados, 25 de 29 projetos viram "importante" e a fila deixa de
-- ordenar. Então o padrão da importação é a régua que você já usava — as notas
-- do outro bloco entram e ficam guardadas, sem contar.
--
-- Para ligá-los, depois de pontuar os projetos que faltam:
--   update pontuacao_criterio set ativo = true
--    where codigo in ('ACIDENTE','MARGEM','IMP_FATURAMENTO','ORGANIZACAO','ARQUITETONICO');
--   -- e recalcular: select app.recalcular_prioridade(id) from projeto;
--
-- O peso 1,5 de ACIDENTE continua registrado e passa a valer nesse dia.
update pontuacao_criterio set ativo = false
 where codigo in ('ACIDENTE','MARGEM','IMP_FATURAMENTO','ORGANIZACAO','ARQUITETONICO');

-- -----------------------------------------------------------------------------
-- 4 · Categoria de custo que só existe no desktop
-- -----------------------------------------------------------------------------
insert into categoria_custo (codigo, nome, tipo, ordem) values
  ('ADM', 'Administrativo', 'INDIRETO', 11)
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- 5 · Entrada do pagamento é dinheiro, e dinheiro tem porta própria
--
-- `projeto.valor_entrada` do desktop NÃO vira campo customizado: `projeto.campos`
-- é lido por qualquer um que enxergue o projeto, e um valor de entrada é
-- exatamente o que a decisão 04 do modelo mandou manter atrás da RLS.
-- -----------------------------------------------------------------------------
alter table projeto_valor add column if not exists valor_entrada numeric(14,2);

comment on column projeto_valor.valor_entrada is
  'Entrada acordada com o fornecedor. Fica aqui, e não em projeto.campos, porque campos não tem porta de dinheiro.';

-- -----------------------------------------------------------------------------
-- 6 · A carteira não entrega campo de dinheiro a quem não pode ver dinheiro
--
-- Achado da importação: `projeto.campos` traz campos MOEDA — economia mensal,
-- receita prevista — e a view devolvia o jsonb inteiro para qualquer um que
-- enxergasse o projeto. A regra de ouro do dinheiro valia para as colunas e
-- não valia para o jsonb.
--
-- Aqui a view passa a remover as chaves cujo campo é MOEDA quando quem consulta
-- não tem alcance financeiro. `jsonb - text[]` apaga chaves.
--
-- Fica um resíduo conhecido: quem consultar a TABELA `projeto` direto, em vez
-- da view, continua vendo o jsonb inteiro. O front lê `vw_projeto` (ver
-- src/lib/banco.ts), então na prática está coberto — mas fechar de vez pede
-- tirar o SELECT direto em `projeto.campos`, e isso é assunto da Fase 1.
-- -----------------------------------------------------------------------------
-- CREATE OR REPLACE VIEW só aceita acrescentar coluna no fim; aqui entram
-- colunas no meio, então a view cai e nasce de novo.
drop view if exists vw_projeto;
create view vw_projeto with (security_invoker = true) as
select
  p.id, p.codigo, p.nome, p.prioridade, p.pontuacao_total, p.saude,
  p.frente, p.seguranca,
  tp.codigo as tipo_codigo, tp.nome as tipo_nome, tp.cor as tipo_cor,
  f.codigo as fase_codigo, f.nome as fase_nome, f.categoria as fase_categoria,
  f.ordem as fase_ordem,
  e.nome as empresa_nome, e.prefixo as empresa_prefixo,
  g.nome as gerente_nome,
  p.empresa_id, p.tipo_projeto_id, p.fase_id, p.gerente_id, p.projeto_pai_id,
  p.data_inicio_prev, p.data_fim_prev, p.data_inicio_real, p.data_fim_real,
  p.arquivado_em, p.motivo_arquivo, p.retorno_em,
  case when p.retorno_em is not null then (p.retorno_em - current_date) end as dias_para_retorno,
  (p.arquivado_em is null and f.categoria <> 'ARQUIVADO') as ativo,
  v.valor_estimado, v.valor_aprovado, v.valor_orcado, v.valor_realizado,
  v.valor_pago, v.valor_entrada,
  case when coalesce(v.valor_aprovado, 0) > 0
       then round(100 * v.valor_realizado / v.valor_aprovado, 2) end as consumo_percentual,
  case
    when app.pode_ver_valores(p.id) then p.campos
    else p.campos - coalesce(
      (select array_agg(cd.codigo)
         from campo_definicao cd
        where cd.tipo_projeto_id = p.tipo_projeto_id and cd.tipo_dado = 'MOEDA'),
      '{}'::text[])
  end as campos,
  p.criado_em
from projeto p
join tipo_projeto tp on tp.id = p.tipo_projeto_id
join tipo_fase   f   on f.id  = p.fase_id
join empresa     e   on e.id  = p.empresa_id
left join pessoa g   on g.id  = p.gerente_id
left join projeto_valor v on v.projeto_id = p.id;

comment on view vw_projeto is
  'Linha da carteira. Valores e campos MOEDA vêm vazios para quem não tem alcance financeiro — a linha aparece, o dinheiro não.';

-- -----------------------------------------------------------------------------
-- 7 · Origem do registro, para a importação ser repetível e reversível
-- -----------------------------------------------------------------------------
alter table projeto add column if not exists origem_legado text;
comment on column projeto.origem_legado is
  'Código do projeto no sistema desktop. Preenchido só pela importação; serve para conferir e para desfazer.';

create unique index if not exists projeto_origem_legado_idx
  on projeto (origem_legado) where origem_legado is not null;

-- -----------------------------------------------------------------------------
-- 8 · Campo que a origem usa e o seed não tinha
-- -----------------------------------------------------------------------------
select app.campo('INVESTIMENTO','Viabilidade','vi_data','Data do estudo','DATA', 9);
