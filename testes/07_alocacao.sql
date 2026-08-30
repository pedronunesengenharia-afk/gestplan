-- =============================================================================
-- GestPlan · testes/07_alocacao.sql
-- Alocação de pessoas em projeto, e a capacidade que sai dela.
--
-- A tabela `alocacao` nasceu na primeira migração com política escrita e ficou
-- dois meses sem nenhuma tela que escrevesse nela. Política que nunca foi
-- exercida é política que ninguém sabe se funciona — e foi assim que os três
-- vazamentos da Fase 1 chegaram até serem achados. Agora que a tela alcança a
-- tabela, a regra passa a ser cobrada aqui.
--
-- Roda sobre o mesmo cenário de 01 e 02.
-- =============================================================================
\set ON_ERROR_STOP on

reset role;
select set_config('app.usuario', '', false);

-- Criada como superusuário, executada como quem vestir mandar: sem SECURITY
-- DEFINER, ela enxerga o que o chamador enxerga — que é o ponto.
create or replace function medir_dedicacao() returns numeric language sql as $fn$
  select dedicacao_total from vw_capacidade
   where pessoa_id = 'bbbbbbbb-0000-0000-0000-000000000003';
$fn$;

set role authenticated;

-- -----------------------------------------------------------------------------
-- 1 · Quem edita o projeto é quem aloca
-- -----------------------------------------------------------------------------
select vestir('22222222-2222-2222-2222-222222222222');   -- GERENTE

insert into alocacao (id, projeto_id, pessoa_id, papel, percentual_dedicacao)
values ('a10ca000-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000003', 'Executor', 60);

select teste('gerente aloca alguém no projeto dele',
  conta($$select id from alocacao where id='a10ca000-0000-0000-0000-000000000001'$$) = 1);

-- O projeto reservado da Beta está fora do alcance dele. A política de escrita
-- é `pode_editar_projeto`, então o WITH CHECK recusa antes de gravar.
do $$
begin
  begin
    insert into alocacao (projeto_id, pessoa_id, percentual_dedicacao)
    values ('99999999-0000-0000-0000-000000000001',
            'bbbbbbbb-0000-0000-0000-000000000002', 50);
    raise exception 'FALHOU: gerente alocou em projeto que não alcança';
  exception
    when insufficient_privilege then
      perform teste('gerente NÃO aloca em projeto de outra empresa', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('gerente NÃO aloca em projeto de outra empresa', true);
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 2 · Quem só enxerga o projeto, enxerga a equipe — e não a muda
-- -----------------------------------------------------------------------------
select vestir('33333333-3333-3333-3333-333333333333');   -- ESTRUTURA

select teste('estrutura enxerga a alocação do projeto que alcança',
  conta($$select id from alocacao where id='a10ca000-0000-0000-0000-000000000001'$$) = 1);

do $$
declare n int;
begin
  begin
    update alocacao set percentual_dedicacao = 5
     where id = 'a10ca000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    -- A RLS de UPDATE recusa em silêncio: nenhuma linha muda, sem erro.
    perform teste('estrutura NÃO altera a dedicação de ninguém', n = 0);
  exception when insufficient_privilege then
    perform teste('estrutura NÃO altera a dedicação de ninguém', true);
  end;
end $$;

do $$
declare n int;
begin
  begin
    delete from alocacao where id = 'a10ca000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    perform teste('estrutura NÃO tira ninguém do projeto', n = 0);
  exception when insufficient_privilege then
    perform teste('estrutura NÃO tira ninguém do projeto', true);
  end;
end $$;

do $$
begin
  begin
    insert into alocacao (projeto_id, pessoa_id, percentual_dedicacao)
    values ('dddddddd-0000-0000-0000-000000000001',
            'bbbbbbbb-0000-0000-0000-000000000003', 50);
    raise exception 'FALHOU: estrutura conseguiu se alocar sozinha';
  exception
    when insufficient_privilege then
      perform teste('estrutura NÃO se aloca sozinha', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('estrutura NÃO se aloca sozinha', true);
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 3 · Financeiro vê o dinheiro, não o escopo — e equipe é escopo
-- -----------------------------------------------------------------------------
select vestir('44444444-4444-4444-4444-444444444444');   -- FINANCEIRO
select teste('financeiro enxerga a equipe do projeto',
  conta($$select id from alocacao where id='a10ca000-0000-0000-0000-000000000001'$$) = 1);

do $$
declare n int;
begin
  begin
    update alocacao set percentual_dedicacao = 5
     where id = 'a10ca000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    perform teste('financeiro NÃO mexe na equipe', n = 0);
  exception when insufficient_privilege then
    perform teste('financeiro NÃO mexe na equipe', true);
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 4 · O externo não alcança nada disto
-- -----------------------------------------------------------------------------
select vestir('55555555-5555-5555-5555-555555555555');   -- FORNECEDOR
select teste('externo NÃO enxerga alocação nenhuma',
  conta('select id from alocacao') = 0);
select teste('externo NÃO enxerga a capacidade de ninguém',
  conta('select pessoa_id from vw_capacidade') = 0);

-- -----------------------------------------------------------------------------
-- 5 · A capacidade soma entre projetos, e a view respeita quem pergunta
-- -----------------------------------------------------------------------------
select vestir('22222222-2222-2222-2222-222222222222');   -- GERENTE

-- O segundo projeto da Alfa, que o gerente alcança pela própria RLS: nada de
-- tabela temporária, que pertenceria ao superusuário e ele não leria.
insert into alocacao (id, projeto_id, pessoa_id, percentual_dedicacao)
select 'a10ca000-0000-0000-0000-000000000002', p.id,
       'bbbbbbbb-0000-0000-0000-000000000003', 60
  from projeto p where p.nome = 'Segundo projeto';

-- A soma é medida pelo DONO, e há um motivo que não é conveniência: hoje a
-- política `pessoa_le` deixa quem não é proprietário enxergando apenas a si
-- mesmo, porque o EXISTS dela consulta `pessoa_papel`, que tem RLS própria
-- restrita à própria linha. Como `vw_capacidade` junta com `pessoa`, ela volta
-- vazia para um gerente. Está registrado no ROADMAP como defeito a corrigir;
-- enquanto não for, medir a aritmética da view pelo dono é o que se pode
-- afirmar com verdade.
select vestir('11111111-1111-1111-1111-111111111111');   -- DONO

select teste('capacidade soma a dedicação da mesma pessoa em dois projetos',
  (select dedicacao_total from vw_capacidade
    where pessoa_id = 'bbbbbbbb-0000-0000-0000-000000000003') = 120);
select teste('capacidade conta os dois projetos',
  (select projetos from vw_capacidade
    where pessoa_id = 'bbbbbbbb-0000-0000-0000-000000000003') = 2);
select teste('acima de 100% a pessoa é marcada sobrealocada',
  (select sobrealocada from vw_capacidade
    where pessoa_id = 'bbbbbbbb-0000-0000-0000-000000000003'));

-- A view é security_invoker: a mesma pergunta, de outra pessoa, dá outro
-- número. Sem isso ela devolveria a soma da empresa inteira para qualquer um.
select vestir('55555555-5555-5555-5555-555555555555');
select teste('a capacidade é security_invoker, não a soma de todo mundo',
  conta($$select pessoa_id from vw_capacidade
           where pessoa_id='bbbbbbbb-0000-0000-0000-000000000003'$$) = 0);

-- -----------------------------------------------------------------------------
-- 6 · Alocação encerrada e alocação futura ficam fora da conta de hoje
-- -----------------------------------------------------------------------------
-- Quem MUDA é o gerente, porque ele edita o projeto. Quem LÊ a capacidade é o
-- dono, pelo motivo explicado acima.
select vestir('22222222-2222-2222-2222-222222222222');
update alocacao set data_fim = current_date - 1
 where id = 'a10ca000-0000-0000-0000-000000000002';
select vestir('11111111-1111-1111-1111-111111111111');
select teste('alocação que já terminou não pesa mais na capacidade',
  medir_dedicacao() = 60);

select vestir('22222222-2222-2222-2222-222222222222');
update alocacao set data_inicio = current_date + 30, data_fim = null
 where id = 'a10ca000-0000-0000-0000-000000000002';
select vestir('11111111-1111-1111-1111-111111111111');
select teste('alocação que ainda não começou também não pesa',
  medir_dedicacao() = 60);

select vestir('22222222-2222-2222-2222-222222222222');
update alocacao set ativo = false where id = 'a10ca000-0000-0000-0000-000000000001';
select vestir('11111111-1111-1111-1111-111111111111');
select teste('alocação desligada sai da capacidade', medir_dedicacao() is null);

select vestir('22222222-2222-2222-2222-222222222222');
update alocacao set ativo = true where id = 'a10ca000-0000-0000-0000-000000000001';

-- -----------------------------------------------------------------------------
-- 7 · Os limites que o banco cobra sozinho
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    insert into alocacao (projeto_id, pessoa_id, percentual_dedicacao)
    values ('dddddddd-0000-0000-0000-000000000001',
            'bbbbbbbb-0000-0000-0000-000000000002', 0);
    raise exception 'FALHOU: dedicação de zero por cento foi aceita';
  exception
    when check_violation then perform teste('dedicação de 0% é recusada', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('dedicação de 0% é recusada', true);
  end;
end $$;

do $$
begin
  begin
    insert into alocacao (projeto_id, pessoa_id, percentual_dedicacao)
    values ('dddddddd-0000-0000-0000-000000000001',
            'bbbbbbbb-0000-0000-0000-000000000002', 101);
    raise exception 'FALHOU: dedicação acima de 100%% numa linha foi aceita';
  exception
    when check_violation then perform teste('dedicação acima de 100% numa linha é recusada', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('dedicação acima de 100% numa linha é recusada', true);
  end;
end $$;

do $$
begin
  begin
    insert into alocacao (projeto_id, pessoa_id, percentual_dedicacao, data_inicio, data_fim)
    values ('dddddddd-0000-0000-0000-000000000001',
            'bbbbbbbb-0000-0000-0000-000000000002', 50,
            current_date, current_date - 10);
    raise exception 'FALHOU: período com fim antes do início foi aceito';
  exception
    when check_violation then perform teste('período com fim antes do início é recusado', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('período com fim antes do início é recusado', true);
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 8 · O custo-hora ainda NÃO tem porta de dinheiro
-- -----------------------------------------------------------------------------
-- Este não é um teste de regra cumprida: é um teste que registra uma regra que
-- FALTA. `alocacao.custo_hora` está atrás de `pode_ver_interno`, não de
-- `pode_ver_valores` — quem alcança o projeto lê o custo-hora de quem está
-- nele. Por isso a tela não grava esse campo, e ele fica em zero.
--
-- Quando a política mudar, este teste passa a falhar, e é exatamente o que se
-- quer: ele obriga a trocar a asserção junto, de propósito, e não por acaso.
select vestir('33333333-3333-3333-3333-333333333333');   -- ESTRUTURA, sem dinheiro
select teste('hoje o custo-hora da alocação NÃO está atrás de pode_ver_valores',
  conta($$select id from alocacao where custo_hora is not null$$) > 0);
select teste('e por isso a tela o mantém em zero',
  conta($$select id from alocacao where custo_hora <> 0$$) = 0);

reset role;
select set_config('app.usuario', '', false);

\echo ''
\echo '  --- alocação e capacidade: todos os testes passaram ---'
\echo ''
