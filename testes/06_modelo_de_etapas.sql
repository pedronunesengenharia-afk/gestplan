-- =============================================================================
-- GestPlan · testes/06_modelo_de_etapas.sql
-- O projeto que nasce com a EAP do seu tipo, e com prazo.
--
-- O que está sendo protegido aqui é a promessa de que o modelo é DADO: um tipo
-- com modelo semeia, um tipo sem modelo não semeia, e mudar o processo é mudar
-- linhas. Se um dia alguém escrever as etapas dentro de um `if`, estes casos
-- continuam passando e a regra de ouro morre em silêncio — por isso há também
-- um caso que cria um modelo NOVO, para outro tipo, e confere que ele vale.
-- =============================================================================
\set ON_ERROR_STOP on

reset role;
select set_config('app.usuario', '', false);
select set_config('request.jwt.claims', '', false);


-- =============================================================================
-- Dias úteis
-- =============================================================================
-- 2026-08-28 é uma sexta-feira.
select teste('mais_dias_uteis: sexta + 1 e segunda',
  app.mais_dias_uteis(date '2026-08-28', 1) = date '2026-08-31');
select teste('mais_dias_uteis: sexta + 0 continua sexta',
  app.mais_dias_uteis(date '2026-08-28', 0) = date '2026-08-28');
select teste('mais_dias_uteis: sabado sem dias anda para segunda',
  app.mais_dias_uteis(date '2026-08-29', 0) = date '2026-08-31');
select teste('mais_dias_uteis: uma semana util e cinco dias corridos + 2',
  app.mais_dias_uteis(date '2026-08-31', 5) = date '2026-09-07');


-- =============================================================================
-- O modelo de TI, aplicado
-- =============================================================================
do $$
declare
  v_tipo uuid; v_fase uuid; v_emp uuid; v_p uuid;
  v_etapas int; v_tarefas int; v_peso numeric;
  v_ini date; v_fim date;
begin
  select id into v_tipo from tipo_projeto where codigo = 'TI';
  select id into v_fase from tipo_fase where tipo_projeto_id = v_tipo and inicial;
  select id into v_emp  from empresa order by nome limit 1;

  insert into projeto (nome, tipo_projeto_id, fase_id, empresa_id, data_inicio_prev)
  values ('Projeto de TI de teste', v_tipo, v_fase, v_emp, date '2026-09-01')
  returning id into v_p;

  select count(*) into v_etapas  from etapa  where projeto_id = v_p;
  select count(*) into v_tarefas from tarefa where projeto_id = v_p;
  select sum(peso_percentual) into v_peso from etapa where projeto_id = v_p;

  perform teste('projeto de TI nasce com as 4 etapas do modelo', v_etapas = 4);
  perform teste('e com uma tarefa por etapa que tem duracao',    v_tarefas = 4);
  perform teste('os pesos do modelo somam 100',                  v_peso = 100);

  perform teste('toda tarefa gerada aponta para a sua etapa',
    (select count(*) from tarefa where projeto_id = v_p and etapa_id is null) = 0);

  perform teste('toda tarefa gerada tem as duas datas',
    (select count(*) from tarefa
      where projeto_id = v_p and (data_inicio_prev is null or data_fim_prev is null)) = 0);

  -- 2026-09-01 e uma terca. Levantamento sao 3 dias uteis: ter, qua, qui.
  select data_inicio_prev, data_fim_prev into v_ini, v_fim
    from tarefa where projeto_id = v_p and codigo = '1';
  perform teste('a primeira tarefa comeca no inicio previsto do projeto', v_ini = date '2026-09-01');
  perform teste('e termina 3 dias uteis depois',                          v_fim = date '2026-09-03');

  -- A seguinte comeca no dia util seguinte ao fim da anterior.
  select data_inicio_prev into v_ini from tarefa where projeto_id = v_p and codigo = '2';
  perform teste('a etapa seguinte comeca depois que a anterior termina', v_ini = date '2026-09-04');

  -- Nenhuma tarefa comeca em sabado ou domingo.
  perform teste('nenhuma tarefa gerada cai em fim de semana',
    (select count(*) from tarefa
      where projeto_id = v_p
        and (extract(isodow from data_inicio_prev) > 5
          or extract(isodow from data_fim_prev) > 5)) = 0);

  -- O projeto aprende o proprio prazo com as tarefas que gerou.
  perform teste('o projeto ganha fim previsto da ultima tarefa',
    (select data_fim_prev from projeto where id = v_p) = date '2026-09-24');
  perform teste('e o inicio da primeira',
    (select data_inicio_prev from projeto where id = v_p) = date '2026-09-01');

  -- Aplicar de novo nao duplica nada.
  perform app.aplicar_modelo_de_etapas(v_p);
  perform teste('aplicar o modelo de novo nao duplica etapa',
    (select count(*) from etapa where projeto_id = v_p) = 4);
end $$;


-- =============================================================================
-- Tipo SEM modelo continua nascendo vazio
-- =============================================================================
do $$
declare v_tipo uuid; v_fase uuid; v_emp uuid; v_p uuid;
begin
  select id into v_tipo from tipo_projeto where codigo = 'MANUTENCAO';
  select id into v_fase from tipo_fase where tipo_projeto_id = v_tipo and inicial;
  select id into v_emp  from empresa order by nome limit 1;

  insert into projeto (nome, tipo_projeto_id, fase_id, empresa_id)
  values ('Manutencao sem modelo', v_tipo, v_fase, v_emp) returning id into v_p;

  perform teste('tipo sem modelo nasce sem etapa',
    (select count(*) from etapa where projeto_id = v_p) = 0);
end $$;


-- =============================================================================
-- O modelo é DADO: cadastrar um novo faz o próximo projeto sair diferente
--
-- Este é o caso que impede a regressão para `if (tipo === ...)`: se alguém
-- trocar a leitura de `tipo_etapa` por uma lista no código, o projeto abaixo
-- continuaria nascendo vazio e o teste cairia.
-- =============================================================================
do $$
declare v_tipo uuid; v_fase uuid; v_emp uuid; v_p uuid;
begin
  select id into v_tipo from tipo_projeto where codigo = 'MANUTENCAO';
  select id into v_fase from tipo_fase where tipo_projeto_id = v_tipo and inicial;
  select id into v_emp  from empresa order by nome limit 1;

  insert into tipo_etapa (tipo_projeto_id, codigo, nome, ordem, peso_percentual, duracao_dias)
  values (v_tipo, '1', 'Inspecao', 1, 40, 1),
         (v_tipo, '2', 'Reparo',   2, 60, 2);

  insert into projeto (nome, tipo_projeto_id, fase_id, empresa_id, data_inicio_prev)
  values ('Manutencao com modelo novo', v_tipo, v_fase, v_emp, date '2026-09-01')
  returning id into v_p;

  perform teste('modelo cadastrado agora vale para o proximo projeto',
    (select count(*) from etapa where projeto_id = v_p) = 2);
  perform teste('e as tarefas dele tambem saem com prazo',
    (select count(*) from tarefa where projeto_id = v_p and data_fim_prev is not null) = 2);
  perform teste('com os nomes que foram cadastrados, nao com os de TI',
    (select string_agg(nome, ', ' order by codigo) from etapa where projeto_id = v_p)
      = 'Inspecao, Reparo');
end $$;


-- =============================================================================
-- Quem pode mexer no modelo
-- =============================================================================
set role authenticated;
select set_config('app.usuario', '33333333-3333-3333-3333-333333333333', false);  -- Estrutura

select teste('quem esta dentro LE o modelo', (select count(*) from tipo_etapa) > 0);

do $$
declare v_tipo uuid;
begin
  select id into v_tipo from tipo_projeto where codigo = 'TI';
  begin
    insert into tipo_etapa (tipo_projeto_id, codigo, nome, ordem)
    values (v_tipo, 'X', 'Etapa intrusa', 9);
    perform teste('estrutura NAO deveria escrever no modelo', false);
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform teste('estrutura nao escreve no modelo', true);
  end;
end $$;

reset role;
select set_config('app.usuario', '', false);

\echo ''
\echo '  --- modelo de etapas: todos os testes passaram ---'
\echo ''
