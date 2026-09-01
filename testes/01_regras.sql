-- =============================================================================
-- GestPlan · testes/01_regras.sql
-- Prova que as regras de negócio estão no banco, não na promessa.
-- Roda como superusuário; a parte de permissão troca de papel de propósito.
-- =============================================================================
\set ON_ERROR_STOP on
\timing off

create or replace function teste(p_nome text, p_ok boolean)
returns void language plpgsql as $$
begin
  if p_ok then
    raise notice '  ok   %', p_nome;
  else
    raise exception 'FALHOU: %', p_nome;
  end if;
end $$;

-- Espera que o comando exploda. Se passar, é o teste que falhou.
create or replace function teste_recusa(p_nome text, p_sql text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice '  ok   % (recusado: %)', p_nome, left(sqlerrm, 60);
    return;
  end;
  raise exception 'FALHOU: % — o banco aceitou o que deveria recusar', p_nome;
end $$;

-- =============================================================================
-- Cenário
-- =============================================================================
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','dono@teste'),
  ('22222222-2222-2222-2222-222222222222','gerente@teste'),
  ('33333333-3333-3333-3333-333333333333','estrutura@teste'),
  ('44444444-4444-4444-4444-444444444444','financeiro@teste'),
  ('55555555-5555-5555-5555-555555555555','fornecedor@teste');

insert into empresa (id, nome, prefixo, papel_id)
values ('aaaaaaaa-0000-0000-0000-000000000001','Empresa Alfa','ALF',
        (select id from empresa_papel where codigo='ADMINISTRADA')),
       ('aaaaaaaa-0000-0000-0000-000000000002','Empresa Beta','BET',
        (select id from empresa_papel where codigo='ADMINISTRADA'));

insert into pessoa (id, nome, auth_user_id, proprietario) values
  ('bbbbbbbb-0000-0000-0000-000000000001','Dono',      '11111111-1111-1111-1111-111111111111', true),
  ('bbbbbbbb-0000-0000-0000-000000000002','Gerente',   '22222222-2222-2222-2222-222222222222', false),
  ('bbbbbbbb-0000-0000-0000-000000000003','Estrutura', '33333333-3333-3333-3333-333333333333', false),
  ('bbbbbbbb-0000-0000-0000-000000000004','Financeiro','44444444-4444-4444-4444-444444444444', false),
  ('bbbbbbbb-0000-0000-0000-000000000005','Fornecedor','55555555-5555-5555-5555-555555555555', false);

insert into pessoa_papel (pessoa_id, empresa_id, papel) values
  ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','GERENTE_PROJETOS'),
  ('bbbbbbbb-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','ESTRUTURA'),
  ('bbbbbbbb-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000001','FINANCEIRO_COMPRAS'),
  ('bbbbbbbb-0000-0000-0000-000000000005','aaaaaaaa-0000-0000-0000-000000000001','EXTERNO');

insert into fornecedor (id, nome) values ('cccccccc-0000-0000-0000-000000000001','Metalúrgica Teste');
update pessoa set fornecedor_id = 'cccccccc-0000-0000-0000-000000000001'
 where id = 'bbbbbbbb-0000-0000-0000-000000000005';

-- =============================================================================
-- 1 · Código do projeto
-- =============================================================================
insert into projeto (id, nome, tipo_projeto_id, fase_id, empresa_id, gerente_id, data_solicitacao)
select 'dddddddd-0000-0000-0000-000000000001', 'Ampliação do galpão',
       tp.id, f.id, 'aaaaaaaa-0000-0000-0000-000000000001',
       'bbbbbbbb-0000-0000-0000-000000000002', current_date
  from tipo_projeto tp
  join tipo_fase f on f.tipo_projeto_id = tp.id and f.inicial
 where tp.codigo = 'INVESTIMENTO';

insert into projeto (nome, tipo_projeto_id, fase_id, empresa_id)
select 'Segundo projeto', tp.id, f.id, 'aaaaaaaa-0000-0000-0000-000000000001'
  from tipo_projeto tp join tipo_fase f on f.tipo_projeto_id = tp.id and f.inicial
 where tp.codigo = 'OBRA';

insert into projeto (nome, tipo_projeto_id, fase_id, empresa_id)
select 'Projeto da Beta', tp.id, f.id, 'aaaaaaaa-0000-0000-0000-000000000002'
  from tipo_projeto tp join tipo_fase f on f.tipo_projeto_id = tp.id and f.inicial
 where tp.codigo = 'TI';

select teste('código gerado com prefixo, ano e sequencial',
  (select codigo from projeto where id='dddddddd-0000-0000-0000-000000000001')
  = 'ALF-' || extract(year from current_date)::text || '-001');

select teste('sequencial anda dentro da empresa',
  (select codigo from projeto where nome='Segundo projeto')
  = 'ALF-' || extract(year from current_date)::text || '-002');

select teste('cada empresa tem a sua contagem',
  (select codigo from projeto where nome='Projeto da Beta')
  = 'BET-' || extract(year from current_date)::text || '-001');

select teste('projeto_valor nasce junto com o projeto',
  exists (select 1 from projeto_valor where projeto_id='dddddddd-0000-0000-0000-000000000001'));

select teste('primeira fase entra no histórico',
  (select count(*) from projeto_fase_hist where projeto_id='dddddddd-0000-0000-0000-000000000001') = 1);

-- =============================================================================
-- 2 · Campos customizados
-- =============================================================================
update projeto set campos = '{"proposta_numero":"PROP-993","proposta_validade_dias":30}'::jsonb
 where id = 'dddddddd-0000-0000-0000-000000000001';
select teste('campo válido é aceito',
  (select campos->>'proposta_numero' from projeto where id='dddddddd-0000-0000-0000-000000000001') = 'PROP-993');

select teste_recusa('campo inexistente é recusado', $q$
  update projeto set campos = campos || '{"campo_que_nao_existe":1}'::jsonb
   where id = 'dddddddd-0000-0000-0000-000000000001' $q$);

select teste_recusa('número em campo de número', $q$
  update projeto set campos = campos || '{"proposta_validade_dias":"trinta"}'::jsonb
   where id = 'dddddddd-0000-0000-0000-000000000001' $q$);

select teste_recusa('opção fora da lista', $q$
  update projeto set campos = campos || '{"vi_recomendacao":"TALVEZ"}'::jsonb
   where id = 'dddddddd-0000-0000-0000-000000000001' $q$);

-- =============================================================================
-- 3 · Fluxo de fases
-- =============================================================================
select teste_recusa('pular fase é recusado', $q$
  update projeto set fase_id = (select f.id from tipo_fase f join tipo_projeto t
      on t.id=f.tipo_projeto_id where t.codigo='INVESTIMENTO' and f.codigo='EXECUCAO')
   where id = 'dddddddd-0000-0000-0000-000000000001' $q$);

select teste_recusa('fase de outro tipo é recusada', $q$
  update projeto set fase_id = (select f.id from tipo_fase f join tipo_projeto t
      on t.id=f.tipo_projeto_id where t.codigo='OBRA' and f.codigo='ENTREGA')
   where id = 'dddddddd-0000-0000-0000-000000000001' $q$);

-- Solicitação → Viabilidade: a fase Viabilidade exige orçamento para SAIR dela,
-- então entrar é livre.
update projeto set fase_id = (select f.id from tipo_fase f join tipo_projeto t
    on t.id=f.tipo_projeto_id where t.codigo='INVESTIMENTO' and f.codigo='VIABILIDADE')
 where id = 'dddddddd-0000-0000-0000-000000000001';
select teste('avançar uma fase por vez funciona',
  (select f.codigo from projeto p join tipo_fase f on f.id=p.fase_id
    where p.id='dddddddd-0000-0000-0000-000000000001') = 'VIABILIDADE');

select teste('transição entra no histórico',
  (select count(*) from projeto_fase_hist where projeto_id='dddddddd-0000-0000-0000-000000000001') = 2);

-- Sem orçamento e sem os campos obrigatórios da viabilidade, não sai.
select teste_recusa('sem orçamento não sai da viabilidade', $q$
  update projeto set fase_id = (select f.id from tipo_fase f join tipo_projeto t
      on t.id=f.tipo_projeto_id where t.codigo='INVESTIMENTO' and f.codigo='AVALIACAO')
   where id = 'dddddddd-0000-0000-0000-000000000001' $q$);

-- Com orçamento e campos, sai.
-- O dinheiro da etapa mora em etapa_valor desde a migração das três regras:
-- a estrutura entra primeiro, o trigger cria a linha de valor, e o preço vai
-- nela. É o mesmo desenho de projeto / projeto_valor.
insert into etapa (id, projeto_id, codigo, nome, peso_percentual) values
  ('88880000-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001','1','Estrutura metálica',60),
  ('88880000-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000001','2','Obra civil',40);

update etapa_valor set unidade='vb', quantidade=1, preco_unitario=180000,
       categoria_id=(select id from categoria_custo where codigo='EQUIP')
 where etapa_id='88880000-0000-0000-0000-000000000001';
update etapa_valor set unidade='vb', quantidade=1, preco_unitario=70000,
       categoria_id=(select id from categoria_custo where codigo='OBRA')
 where etapa_id='88880000-0000-0000-0000-000000000002';

update projeto set campos = campos || jsonb_build_object(
    'vi_situacao_atual','Galpão sem cobertura na expedição.',
    'vi_alternativas','Locar área externa; ampliar o galpão atual.',
    'vi_economia_mensal', 12000,
    'vi_conclusao','Ampliar é mais barato que locar em 14 meses.',
    'vi_recomendacao','APROVAR')
 where id = 'dddddddd-0000-0000-0000-000000000001';

update projeto set fase_id = (select f.id from tipo_fase f join tipo_projeto t
    on t.id=f.tipo_projeto_id where t.codigo='INVESTIMENTO' and f.codigo='AVALIACAO')
 where id = 'dddddddd-0000-0000-0000-000000000001';
select teste('com orçamento e campos, avança para avaliação',
  (select f.codigo from projeto p join tipo_fase f on f.id=p.fase_id
    where p.id='dddddddd-0000-0000-0000-000000000001') = 'AVALIACAO');

select teste('orçamento das etapas espelha em projeto_valor',
  (select valor_orcado from projeto_valor where projeto_id='dddddddd-0000-0000-0000-000000000001') = 250000);

-- =============================================================================
-- 4 · Avaliação: todo projeto passa, sem faixa de valor
-- =============================================================================
select teste_recusa('sem os quatro pareceres não sai da avaliação', $q$
  update projeto set fase_id = (select f.id from tipo_fase f join tipo_projeto t
      on t.id=f.tipo_projeto_id where t.codigo='INVESTIMENTO' and f.codigo='EXECUCAO')
   where id = 'dddddddd-0000-0000-0000-000000000001' $q$);

insert into aprovacao (projeto_id, fase_id, setor_codigo, pessoa_id, decisao)
select 'dddddddd-0000-0000-0000-000000000001',
       (select f.id from tipo_fase f join tipo_projeto t on t.id=f.tipo_projeto_id
         where t.codigo='INVESTIMENTO' and f.codigo='AVALIACAO'),
       s.codigo, 'bbbbbbbb-0000-0000-0000-000000000001', 'APROVADO'
  from setor s where s.codigo in ('PROJETOS','FINANCEIRO','COMPRAS');

select teste_recusa('faltando um setor, ainda não sai', $q$
  update projeto set fase_id = (select f.id from tipo_fase f join tipo_projeto t
      on t.id=f.tipo_projeto_id where t.codigo='INVESTIMENTO' and f.codigo='EXECUCAO')
   where id = 'dddddddd-0000-0000-0000-000000000001' $q$);

insert into aprovacao (projeto_id, fase_id, setor_codigo, pessoa_id, decisao)
select 'dddddddd-0000-0000-0000-000000000001',
       (select f.id from tipo_fase f join tipo_projeto t on t.id=f.tipo_projeto_id
         where t.codigo='INVESTIMENTO' and f.codigo='AVALIACAO'),
       'GESTAO', 'bbbbbbbb-0000-0000-0000-000000000001', 'APROVADO';

-- A fase Execução exige cronograma para sair dela, não para entrar.
update projeto set fase_id = (select f.id from tipo_fase f join tipo_projeto t
    on t.id=f.tipo_projeto_id where t.codigo='INVESTIMENTO' and f.codigo='EXECUCAO')
 where id = 'dddddddd-0000-0000-0000-000000000001';
select teste('com os quatro pareceres, avança para execução',
  (select f.codigo from projeto p join tipo_fase f on f.id=p.fase_id
    where p.id='dddddddd-0000-0000-0000-000000000001') = 'EXECUCAO');

-- =============================================================================
-- 5 · Pontuação ordena a fila
-- =============================================================================
insert into projeto_pontuacao (projeto_id, criterio_id, nota)
select 'dddddddd-0000-0000-0000-000000000001', c.id, 5
  from pontuacao_criterio c;
select teste('nota máxima em tudo vira URGENTE',
  (select prioridade from projeto where id='dddddddd-0000-0000-0000-000000000001') = 'URGENTE');

update projeto_pontuacao set nota = 1 where projeto_id='dddddddd-0000-0000-0000-000000000001';
select teste('nota baixa cai para PLANEJAMENTO',
  (select prioridade from projeto where id='dddddddd-0000-0000-0000-000000000001') = 'PLANEJAMENTO');

update projeto_pontuacao set nota = 3 where projeto_id='dddddddd-0000-0000-0000-000000000001';
select teste('nota média vira IMPORTANTE',
  (select prioridade from projeto where id='dddddddd-0000-0000-0000-000000000001') = 'IMPORTANTE');

select teste_recusa('nota fora da faixa do critério', $q$
  update projeto_pontuacao set nota = 9
   where projeto_id='dddddddd-0000-0000-0000-000000000001' $q$);

-- =============================================================================
-- 6 · Cronograma
-- =============================================================================
insert into tarefa (id, projeto_id, nome, data_inicio_prev, data_fim_prev, duracao_dias) values
  ('eeeeeeee-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001','Fundação',   current_date, current_date+10, 10),
  ('eeeeeeee-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000001','Montagem',   current_date+11, current_date+30, 19),
  ('eeeeeeee-0000-0000-0000-000000000003','dddddddd-0000-0000-0000-000000000001','Cobertura',  current_date+31, current_date+40, 9);

insert into tarefa_dependencia (tarefa_id, predecessora_id) values
  ('eeeeeeee-0000-0000-0000-000000000002','eeeeeeee-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-000000000003','eeeeeeee-0000-0000-0000-000000000002');

select teste_recusa('ciclo no cronograma é barrado', $q$
  insert into tarefa_dependencia (tarefa_id, predecessora_id)
  values ('eeeeeeee-0000-0000-0000-000000000001','eeeeeeee-0000-0000-0000-000000000003') $q$);

select teste_recusa('marco com duração é recusado', $q$
  insert into tarefa (projeto_id, nome, marco, duracao_dias)
  values ('dddddddd-0000-0000-0000-000000000001','Entrega', true, 5) $q$);

select teste_recusa('fim antes do início é recusado', $q$
  insert into tarefa (projeto_id, nome, data_inicio_prev, data_fim_prev)
  values ('dddddddd-0000-0000-0000-000000000001','Errada', current_date+10, current_date) $q$);

-- Calendário: dia útil e feriado
do $$
declare v_cal uuid; v_natal date;
begin
  select id into v_cal from calendario where padrao;
  v_natal := make_date(extract(year from current_date)::int, 12, 25);
  perform teste('Natal não é dia útil', not app.é_dia_util(v_cal, v_natal));
  perform teste('uma semana corrida tem 5 dias úteis (sem feriado)',
    app.dias_uteis_entre(v_cal, date '2026-06-08', date '2026-06-14') = 5);
  perform teste('somar 5 dias úteis a uma segunda cai na segunda seguinte',
    app.somar_dias_uteis(v_cal, date '2026-06-08', 5) = date '2026-06-15');
  perform teste('Páscoa de 2026 é 5 de abril', app.pascoa(2026) = date '2026-04-05');
  perform teste('Páscoa de 2027 é 28 de março', app.pascoa(2027) = date '2027-03-28');
end $$;

-- =============================================================================
-- 7 · Rateio entre empresas
-- =============================================================================
-- A conferência é constraint trigger adiada: só cobra no fim da transação, para
-- que dê tempo de inserir as duas linhas. `set constraints all immediate`
-- antecipa esse fim e é o que torna o caso testável.
select teste_recusa('rateio que não fecha 100% é recusado', $q$
  insert into projeto_empresa (projeto_id, empresa_id, percentual) values
    ('dddddddd-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',70);
  set constraints all immediate; $q$);

insert into projeto_empresa (projeto_id, empresa_id, percentual) values
  ('dddddddd-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',70),
  ('dddddddd-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002',30);
select teste('rateio 70/30 entre duas empresas é aceito',
  (select round(sum(percentual)) from projeto_empresa
    where projeto_id='dddddddd-0000-0000-0000-000000000001') = 100);

-- =============================================================================
-- 8 · Projeto em aguardo
-- =============================================================================
select teste_recusa('aguardo sem data de retorno é recusado', $q$
  update projeto set arquivado_em = now(), motivo_arquivo = 'EM_AGUARDO'
   where id = 'dddddddd-0000-0000-0000-000000000001' $q$);

-- As duas metades do arquivamento andam juntas — `arquivado_tem_motivo`.
select teste_recusa('data de arquivo sem motivo é recusada', $q$
  update projeto set arquivado_em = now()
   where id = 'dddddddd-0000-0000-0000-000000000001' $q$);

select teste_recusa('e motivo de arquivo sem data também', $q$
  update projeto set motivo_arquivo = 'CANCELADO'
   where id = 'dddddddd-0000-0000-0000-000000000001' $q$);

-- ESTA É A QUE FALTAVA. `motivo_arquivo` guarda um de quatro CÓDIGOS, e não a
-- frase que a pessoa escreveu — a frase vai para `projeto_fase_hist.motivo`.
-- A tela confundia os dois e escrevia o texto livre aqui, o que fazia o banco
-- recusar toda transição com motivo, arquivamento incluído.
select teste_recusa('motivo de arquivo em texto livre é recusado — a coluna guarda código', $q$
  update projeto set arquivado_em = now(), motivo_arquivo = 'Reprovado pela engenharia'
   where id = 'dddddddd-0000-0000-0000-000000000001' $q$);

-- =============================================================================
-- 9 · Dinheiro
-- =============================================================================
insert into custo (projeto_id, categoria_id, descricao, valor, status_pagamento, pago_em)
values ('dddddddd-0000-0000-0000-000000000001',
        (select id from categoria_custo where codigo='EQUIP'),
        'Entrada da estrutura', 90000, 'PAGO', current_date);
select teste('custo lançado espelha em valor_realizado',
  (select valor_realizado from projeto_valor where projeto_id='dddddddd-0000-0000-0000-000000000001') = 90000);
select teste('e em valor_pago',
  (select valor_pago from projeto_valor where projeto_id='dddddddd-0000-0000-0000-000000000001') = 90000);

insert into parcela (projeto_id, etapa_id, numero, valor, vencimento)
select 'dddddddd-0000-0000-0000-000000000001', e.id, 1, 90000, date '2026-09-10'
  from etapa e where e.projeto_id='dddddddd-0000-0000-0000-000000000001' and e.codigo='1';
select teste('competência sai do vencimento',
  (select competencia from parcela where projeto_id='dddddddd-0000-0000-0000-000000000001') = '2026-09');

insert into contrato (id, projeto_id, fornecedor_id, numero, objeto, valor)
values ('ffffffff-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001','CT-01','Fornecimento da estrutura',180000);
insert into contrato_aditivo (contrato_id, numero, tipo, valor)
values ('ffffffff-0000-0000-0000-000000000001','1','VALOR',20000);
select teste('aditivo soma no contrato',
  (select valor_aditivos from contrato where id='ffffffff-0000-0000-0000-000000000001') = 20000);

-- =============================================================================
-- 10 · Auditoria
-- =============================================================================
select teste('criação do projeto está na trilha',
  exists (select 1 from evento where tabela='projeto'
           and registro_id='dddddddd-0000-0000-0000-000000000001' and acao='INSERIU'));
select teste('mudança de fase está na trilha, com o campo que mudou',
  exists (select 1 from evento where tabela='projeto'
           and registro_id='dddddddd-0000-0000-0000-000000000001'
           and acao='ALTEROU' and 'fase_id' = any(campos)));

\echo ''
\echo '  --- regras de negócio: todos os testes passaram ---'
\echo ''
