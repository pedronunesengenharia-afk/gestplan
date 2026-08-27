-- =============================================================================
-- GestPlan · a tabela de pontuação tem de somar o total que ela mostra
--
-- Achado na tela de detalhe do projeto, com os dados importados: o cabeçalho
-- diz "19 pontos" e a tabela abaixo soma 35. Acontece em 23 dos 29 projetos.
--
-- A culpa é da view, não da tela. `vw_pontuacao` devolvia uma linha para cada
-- nota registrada, inclusive as dos cinco critérios que a importação deixou
-- DESLIGADOS — e a nota de um critério desligado existe, mas não conta na fila.
-- A tela somava tudo, corretamente, uma coisa que o total nunca somou.
--
-- Duas mudanças:
--   `pontos` passa a ser a contribuição REAL para o total (zero quando o
--   critério está desligado), então a coluna fecha com o cabeçalho por
--   construção — não por coincidência;
--   `ativo` e `pontos_se_ligado` entram para a tela poder mostrar a nota
--   guardada e dizer que ela não conta, em vez de escondê-la.
--
-- Nota registrada nunca some da vista: sumir seria perder a informação de que
-- alguém já avaliou aquele critério.
-- =============================================================================

drop view if exists vw_pontuacao;

create view vw_pontuacao with (security_invoker = true) as
select
  pp.projeto_id,
  c.codigo        as criterio,
  c.nome          as criterio_nome,
  c.descricao     as criterio_descricao,
  c.ordem,
  c.ativo,
  pp.nota,
  c.minimo,
  c.maximo,
  c.peso,
  -- O que esta nota acrescenta ao total do projeto, hoje.
  case when c.ativo then pp.nota * c.peso else 0 end as pontos,
  -- O que ela acrescentaria se o critério fosse ligado.
  (pp.nota * c.peso)                                 as pontos_se_ligado,
  (c.maximo * c.peso)                                as pontos_maximos,
  pp.justificativa,
  pp.pessoa_id,
  pp.em
from projeto_pontuacao pp
join pontuacao_criterio c on c.id = pp.criterio_id;

comment on view vw_pontuacao is
  'Pontuação aberta de um projeto. A coluna `pontos` soma exatamente projeto.pontuacao_total; `ativo` diz se o critério conta na fila hoje.';
