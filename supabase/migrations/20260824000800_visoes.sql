-- =============================================================================
-- GestPlan · 009_visoes.sql
-- As visões de leitura. A Camada 3 consome estas — não monta SQL na tela.
--
-- TODAS levam `security_invoker = true`. Sem isso a view rodaria com os
-- direitos de quem a criou e devolveria linhas que a RLS negaria na tabela.
-- É a pegadinha clássica de RLS no Postgres: a política está certa, a view
-- vaza. Nenhuma view deste projeto pode ser criada sem essa cláusula.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Carteira
-- -----------------------------------------------------------------------------
create view vw_projeto with (security_invoker = true) as
select
  p.id,
  p.codigo,
  p.nome,
  p.prioridade,
  p.pontuacao_total,
  p.saude,
  tp.codigo               as tipo_codigo,
  tp.nome                 as tipo_nome,
  tp.cor                  as tipo_cor,
  f.codigo                as fase_codigo,
  f.nome                  as fase_nome,
  f.categoria             as fase_categoria,
  f.ordem                 as fase_ordem,
  e.nome                  as empresa_nome,
  e.prefixo               as empresa_prefixo,
  g.nome                  as gerente_nome,
  p.empresa_id,
  p.tipo_projeto_id,
  p.fase_id,
  p.gerente_id,
  p.projeto_pai_id,
  p.data_inicio_prev,
  p.data_fim_prev,
  p.data_inicio_real,
  p.data_fim_real,
  p.arquivado_em,
  p.motivo_arquivo,
  p.retorno_em,
  case when p.retorno_em is not null
       then (p.retorno_em - current_date) end            as dias_para_retorno,
  (p.arquivado_em is null and f.categoria <> 'ARQUIVADO') as ativo,
  -- Nulo quando quem consulta não pode ver dinheiro. A RLS de projeto_valor
  -- faz o LEFT JOIN não casar, e a coluna vem vazia em vez de negar a linha.
  v.valor_estimado,
  v.valor_aprovado,
  v.valor_orcado,
  v.valor_realizado,
  v.valor_pago,
  case when coalesce(v.valor_aprovado, 0) > 0
       then round(100 * v.valor_realizado / v.valor_aprovado, 2) end as consumo_percentual,
  p.campos,
  p.criado_em
from projeto p
join tipo_projeto tp on tp.id = p.tipo_projeto_id
join tipo_fase   f   on f.id  = p.fase_id
join empresa     e   on e.id  = p.empresa_id
left join pessoa g   on g.id  = p.gerente_id
left join projeto_valor v on v.projeto_id = p.id;

comment on view vw_projeto is
  'Linha da carteira. Campos de valor vêm nulos para quem não tem alcance financeiro — a linha aparece, o dinheiro não.';

-- -----------------------------------------------------------------------------
-- Avanço físico: média das etapas-folha ponderada pelo peso
-- -----------------------------------------------------------------------------
create view vw_avanco with (security_invoker = true) as
select
  e.projeto_id,
  sum(e.peso_percentual)                                    as peso_total,
  case when sum(e.peso_percentual) > 0
       then round(sum(e.percentual_concluido * e.peso_percentual)
                  / sum(e.peso_percentual), 2)
       else 0 end                                           as avanco_fisico,
  count(*)                                                  as etapas,
  count(*) filter (where e.percentual_concluido >= 100)     as etapas_concluidas
from etapa e
where e.folha
group by e.projeto_id;

-- -----------------------------------------------------------------------------
-- Curva S: previsto de base, previsto atual e realizado, mês a mês
-- -----------------------------------------------------------------------------
create view vw_curva_s with (security_invoker = true) as
with base as (
  select b.projeto_id, i.competencia, sum(i.valor_previsto) as valor
    from linha_base b
    join linha_base_item i on i.linha_base_id = b.id
   where b.vigente and i.competencia is not null
   group by b.projeto_id, i.competencia
),
previsto as (
  select projeto_id, competencia, sum(valor) as valor
    from parcela group by projeto_id, competencia
),
realizado as (
  select projeto_id, competencia, sum(valor) as valor
    from custo where status_pagamento <> 'CANCELADO'
   group by projeto_id, competencia
),
meses as (
  select projeto_id, competencia from base
  union select projeto_id, competencia from previsto
  union select projeto_id, competencia from realizado
)
select
  m.projeto_id,
  m.competencia,
  coalesce(b.valor, 0) as base_mes,
  coalesce(p.valor, 0) as previsto_mes,
  coalesce(r.valor, 0) as realizado_mes,
  sum(coalesce(b.valor, 0)) over j as base_acumulada,
  sum(coalesce(p.valor, 0)) over j as previsto_acumulado,
  sum(coalesce(r.valor, 0)) over j as realizado_acumulado
from meses m
left join base      b on b.projeto_id = m.projeto_id and b.competencia = m.competencia
left join previsto  p on p.projeto_id = m.projeto_id and p.competencia = m.competencia
left join realizado r on r.projeto_id = m.projeto_id and r.competencia = m.competencia
window j as (partition by m.projeto_id order by m.competencia
             rows between unbounded preceding and current row);

-- -----------------------------------------------------------------------------
-- Fluxo de pagamento consolidado
-- -----------------------------------------------------------------------------
create view vw_fluxo_mensal with (security_invoker = true) as
select
  pa.projeto_id,
  pa.competencia,
  sum(pa.valor)                                          as a_pagar,
  sum(pa.valor) filter (where pa.pago_em is not null)    as pago,
  sum(pa.valor) filter (where pa.pago_em is null
                          and pa.vencimento < current_date) as vencido,
  count(*)                                               as parcelas
from parcela pa
group by pa.projeto_id, pa.competencia;

-- -----------------------------------------------------------------------------
-- O que está atrasado
-- -----------------------------------------------------------------------------
create view vw_tarefa_atrasada with (security_invoker = true) as
select
  t.id, t.projeto_id, p.codigo as projeto_codigo, p.nome as projeto_nome,
  t.nome, t.status, t.percentual_concluido,
  t.data_fim_prev,
  (current_date - t.data_fim_prev) as dias_atraso,
  t.responsavel_id, r.nome as responsavel_nome,
  t.marco, t.caminho_critico
from tarefa t
join projeto p on p.id = t.projeto_id
left join pessoa r on r.id = t.responsavel_id
where t.status not in ('CONCLUIDA','CANCELADA')
  and t.data_fim_prev is not null
  and t.data_fim_prev < current_date
  and p.arquivado_em is null;

-- -----------------------------------------------------------------------------
-- Projetos em aguardo cuja data de retorno chegou
-- -----------------------------------------------------------------------------
create view vw_retomada with (security_invoker = true) as
select
  p.id, p.codigo, p.nome, p.retorno_em,
  (p.retorno_em - current_date) as dias,
  e.nome as empresa_nome
from projeto p
join empresa e on e.id = p.empresa_id
where p.motivo_arquivo = 'EM_AGUARDO'
  and p.retorno_em is not null
order by p.retorno_em;

-- -----------------------------------------------------------------------------
-- Capacidade da equipe: quem está sobrealocado
-- -----------------------------------------------------------------------------
create view vw_capacidade with (security_invoker = true) as
select
  a.pessoa_id,
  pe.nome                       as pessoa_nome,
  count(distinct a.projeto_id)  as projetos,
  sum(a.percentual_dedicacao)   as dedicacao_total,
  (sum(a.percentual_dedicacao) > 100) as sobrealocada
from alocacao a
join pessoa pe on pe.id = a.pessoa_id
where a.ativo
  and (a.data_fim is null or a.data_fim >= current_date)
  and (a.data_inicio is null or a.data_inicio <= current_date)
group by a.pessoa_id, pe.nome;

comment on view vw_capacidade is
  'Soma a dedicação ativa de cada pessoa. Acima de 100% é atraso que ainda não aconteceu.';

-- -----------------------------------------------------------------------------
-- Agenda: tarefas e marcos por pessoa, para o calendário e o iCal
-- -----------------------------------------------------------------------------
create view vw_agenda with (security_invoker = true) as
select
  t.id                as tarefa_id,
  t.projeto_id,
  p.codigo            as projeto_codigo,
  t.nome              as titulo,
  t.data_inicio_prev  as inicio,
  t.data_fim_prev     as fim,
  t.marco,
  t.status,
  t.responsavel_id,
  tp.cor              as cor
from tarefa t
join projeto p       on p.id  = t.projeto_id
join tipo_projeto tp on tp.id = p.tipo_projeto_id
where t.data_inicio_prev is not null
  and t.status <> 'CANCELADA'
  and p.arquivado_em is null;

-- -----------------------------------------------------------------------------
-- Pontuação aberta, para explicar a fila
-- -----------------------------------------------------------------------------
create view vw_pontuacao with (security_invoker = true) as
select
  pp.projeto_id,
  c.codigo    as criterio,
  c.nome      as criterio_nome,
  pp.nota,
  c.maximo,
  c.peso,
  (pp.nota * c.peso) as pontos,
  pp.justificativa
from projeto_pontuacao pp
join pontuacao_criterio c on c.id = pp.criterio_id;

-- =============================================================================
-- Permissão de objeto para o papel do PostgREST
--
-- Vem por último de propósito: `grant on all tables` alcança apenas o que já
-- existe, e as views acima precisam entrar na conta. Quem decide o que cada um
-- lê continua sendo a RLS — o GRANT só abre a porta da tabela.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema public, app to authenticated';
    execute 'grant select, insert, update, delete on all tables in schema public to authenticated';
    execute 'grant execute on all functions in schema app to authenticated';
    execute 'grant usage, select on all sequences in schema public to authenticated';
    -- Objeto criado depois desta migração já nasce com a permissão certa.
    execute 'alter default privileges in schema public
               grant select, insert, update, delete on tables to authenticated';
  end if;
end $$;
