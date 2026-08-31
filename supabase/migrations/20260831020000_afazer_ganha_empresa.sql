-- =============================================================================
-- GestPlan · o afazer passa a poder dizer de que empresa ele é
--
-- `projeto_id` já existia e resolve o lembrete que se refere a um projeto. Mas
-- boa parte do que se anota não tem projeto e tem dono: "cobrar a nota da
-- Cemare", "levar o contrato da Cimentpav". Sem a empresa, esses viram texto
-- solto e não dá para separar a lista por frente de trabalho.
--
-- As duas ligações são INDEPENDENTES de propósito. Preencher a empresa a
-- partir do projeto pareceria conveniente e criaria uma segunda verdade: no
-- dia em que o projeto mudar de empresa — ou for rateado entre duas, que é o
-- que `projeto_empresa` permite — a cópia no afazer ficaria mentindo. Quem
-- quiser a empresa do projeto pergunta ao projeto.
-- =============================================================================

alter table afazer
  add column if not exists empresa_id uuid references empresa(id) on delete set null;

comment on column afazer.empresa_id is
  'De que empresa é este lembrete. Independente de `projeto_id`: um afazer '
  'pode ter empresa sem projeto, projeto sem empresa, os dois ou nenhum.';

-- `set null` pelo mesmo motivo do projeto: "cobrar a nota fiscal" não deixa de
-- precisar ser feito porque alguém desativou o cadastro da empresa.

-- A política é `for all` e foi escrita com o `with check` inteiro, então
-- acrescentar uma condição obriga a reescrevê-la. O resto continua igual.
drop policy if exists afazer_e_so_meu on afazer;

create policy afazer_e_so_meu on afazer for all
  using (pessoa_id = app.pessoa_atual())
  with check (
    pessoa_id = app.pessoa_atual()
    -- Ligar a um projeto ou a uma empresa que não se alcança não vazaria nada
    -- — o id já é conhecido de quem o digitou — mas deixaria a tela mostrando
    -- um traço para sempre. Melhor recusar na hora.
    and (projeto_id is null or app.pode_ver_interno(projeto_id))
    and (empresa_id is null or empresa_id in (select app.empresas_visiveis()))
  );

comment on policy afazer_e_so_meu on afazer is
  'Cada um só alcança a própria lista, e não há exceção para o proprietário. '
  'Ver o comentário da tabela: é decisão de produto.';
