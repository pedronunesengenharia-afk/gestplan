-- =============================================================================
-- GestPlan · a trilha de fases sai do escuro
--
-- `projeto_fase_hist` grava toda mudança de fase desde a primeira migração:
-- quem mudou, de onde para onde, quando e por quê. Nunca foi mostrada em tela
-- nenhuma. É a terceira perna do histórico do projeto — ao lado da ocorrência
-- e da decisão — e a única que já estava sendo escrita esse tempo todo.
--
-- O QUE A VIEW ACRESCENTA AO QUE JÁ EXISTIA: quanto tempo o projeto ficou em
-- cada fase. A tabela guarda instantes; a pergunta que se faz é duração, e ela
-- só aparece comparando cada linha com a anterior. Deixar essa conta para a
-- tela significaria refazê-la em todo lugar que precisar dela — e a resposta
-- ("a Viabilidade levou 40 dias") é a mais útil que este histórico tem.
--
-- `security_invoker = true`, como toda view aqui: sem isso ela rodaria com os
-- direitos de quem a criou e devolveria linhas que a RLS negaria na tabela.
-- =============================================================================

create or replace view vw_fase_hist with (security_invoker = true) as
select
  h.id,
  h.projeto_id,
  h.em,
  h.motivo,
  h.observacao,

  de.nome      as de_fase,
  para.nome    as para_fase,
  para.cor     as para_cor,
  para.categoria as para_categoria,

  p.nome       as pessoa_nome,

  -- Quanto tempo o projeto ficou na fase que ACABOU DE SAIR. Nulo na primeira
  -- linha, que é a criação do projeto: não havia fase anterior.
  --
  -- `lag` sobre a janela do projeto, e não um `join` da tabela com ela mesma:
  -- a mesma fase pode ser visitada mais de uma vez — projeto volta para a
  -- Viabilidade — e o join casaria a visita errada.
  (h.em::date - (lag(h.em) over (partition by h.projeto_id order by h.em))::date)
    as dias_na_anterior
from projeto_fase_hist h
join tipo_fase para on para.id = h.para_fase_id
left join tipo_fase de on de.id = h.de_fase_id
left join pessoa p    on p.id  = h.pessoa_id;

comment on view vw_fase_hist is
  'A trilha de fases de cada projeto, com quanto tempo ficou na fase anterior. '
  'A duração sai de `lag` sobre a janela do projeto: a mesma fase pode ser '
  'visitada mais de uma vez, e um join da tabela com ela mesma casaria a '
  'visita errada.';
