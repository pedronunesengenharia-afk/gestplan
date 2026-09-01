-- =============================================================================
-- GestPlan · a carteira separa o que acabou do que está andando
--
-- A carteira mostrava projeto finalizado junto com projeto em andamento, para
-- sempre. Vinte e nove projetos ainda cabem numa tela; a lista só cresce, e o
-- que acabou vai empurrando para baixo o que precisa de olho hoje.
--
-- QUEM RESPONDE "ISTO ACABOU" É `tipo_fase.conclusiva`, e não a categoria.
-- Nos cinco tipos de hoje toda fase de categoria ENCERRAMENTO é a conclusiva,
-- e por isso as duas perguntas parecem a mesma. Elas se separam no dia em que
-- um tipo tiver "Entrega" E "Encerramento": aí a categoria diria que o projeto
-- acabou enquanto ele ainda está sendo entregue. `conclusiva` é o campo feito
-- para esta pergunta — a carteira passa a fazê-la a ele.
--
-- Uma coluna só, no fim: `create or replace view` não aceita coluna no meio, e
-- derrubar a view para reordenar custaria recriar tudo que depende dela por
-- estética. Ela fica fora de ordem e isso é de propósito.
--
-- Coluna NOVA em view não quebra tela antiga — a tela simplesmente não a pede.
-- Sobe antes do dist, como sempre.
-- =============================================================================

create or replace view vw_projeto with (security_invoker = true) as
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
  p.criado_em,

  -- A coluna nova. `ativo` continua dizendo "não foi arquivado"; esta diz
  -- "chegou ao fim por bem". São estados diferentes e a carteira separa os
  -- dois: arquivado é o que não vai acontecer, finalizado é o que aconteceu.
  f.conclusiva as fase_conclusiva
from projeto p
join tipo_projeto tp on tp.id = p.tipo_projeto_id
join tipo_fase   f   on f.id  = p.fase_id
join empresa     e   on e.id  = p.empresa_id
left join pessoa g   on g.id  = p.gerente_id
left join projeto_valor v on v.projeto_id = p.id;

comment on view vw_projeto is
  'Linha da carteira. Valores e campos MOEDA vêm vazios para quem não tem '
  'alcance financeiro — a linha aparece, o dinheiro não. `ativo` é "não foi '
  'arquivado"; `fase_conclusiva` é "chegou ao fim". Arquivado é o que não vai '
  'acontecer, finalizado é o que aconteceu.';
