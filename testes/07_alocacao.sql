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

-- Medido pelo GERENTE de propósito. Até a migração 20260830120000 isto era
-- zero: `pessoa_le` deixava quem não é proprietário enxergando só a si mesmo,
-- e como `vw_capacidade` junta com `pessoa`, a view voltava vazia para ele.
-- Se a política regredir, é aqui que se descobre.

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
-- Quem muda e quem lê é o mesmo gerente: ele edita o projeto e enxerga a
-- equipe.
select vestir('22222222-2222-2222-2222-222222222222');

update alocacao set data_fim = current_date - 1
 where id = 'a10ca000-0000-0000-0000-000000000002';
select teste('alocação que já terminou não pesa mais na capacidade',
  medir_dedicacao() = 60);

update alocacao set data_inicio = current_date + 30, data_fim = null
 where id = 'a10ca000-0000-0000-0000-000000000002';
select teste('alocação que ainda não começou também não pesa',
  medir_dedicacao() = 60);

update alocacao set ativo = false where id = 'a10ca000-0000-0000-0000-000000000001';
select teste('alocação desligada sai da capacidade', medir_dedicacao() is null);

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
-- 8 · A equipe se enxerga, e o custo-hora não vem junto
-- -----------------------------------------------------------------------------
-- Estes nasceram de um defeito medido: `pessoa_le` prometia no comentário que
-- "o resto da equipe vê a lista interna" e entregava "cada um vê a si mesmo",
-- porque o exists dela lia `pessoa_papel` sob a RLS de `pessoa_papel`. Rodados
-- contra a política antiga, os quatro primeiros falham.
select vestir('22222222-2222-2222-2222-222222222222');   -- GERENTE
select teste('gerente enxerga a equipe interna, não só a si mesmo',
  conta('select id from pessoa') > 1);
select teste('gerente enxerga a Estrutura pelo nome',
  conta($$select id from pessoa where id='bbbbbbbb-0000-0000-0000-000000000003'$$) = 1);
select teste('gerente enxerga o proprietário, que não tem linha em pessoa_papel',
  conta($$select id from pessoa where proprietario$$) = 1);
select teste('mas NÃO enxerga o fornecedor externo na lista interna',
  conta($$select id from pessoa where id='bbbbbbbb-0000-0000-0000-000000000005'$$) = 0);

select teste('gerente NÃO enxerga o custo-hora de ninguém',
  conta('select pessoa_id from pessoa_custo') = 0);

do $$
begin
  begin
    insert into pessoa_custo (pessoa_id, custo_hora)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 200);
    raise exception 'FALHOU: gerente gravou o próprio custo-hora';
  exception
    when insufficient_privilege then
      perform teste('gerente NÃO grava custo-hora', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('gerente NÃO grava custo-hora', true);
  end;
end $$;

select vestir('33333333-3333-3333-3333-333333333333');   -- ESTRUTURA
select teste('estrutura também enxerga a equipe', conta('select id from pessoa') > 1);
select teste('estrutura NÃO enxerga custo-hora',  conta('select pessoa_id from pessoa_custo') = 0);

select vestir('55555555-5555-5555-5555-555555555555');   -- EXTERNO
select teste('externo continua enxergando só a si mesmo',
  conta('select id from pessoa') = 1);
select teste('externo NÃO enxerga custo-hora',
  conta('select pessoa_id from pessoa_custo') = 0);

select vestir('11111111-1111-1111-1111-111111111111');   -- DONO
-- Sem número mágico: o cenário cresce a cada suíte nova, e a afirmação que
-- importa é a comparação — o dono alcança o externo, o gerente não.
select teste('o dono enxerga o fornecedor externo, que o gerente não enxerga',
  conta($$select id from pessoa where id='bbbbbbbb-0000-0000-0000-000000000005'$$) = 1);
do $$
declare n int;
begin
  insert into pessoa_custo (pessoa_id, custo_hora)
  values ('bbbbbbbb-0000-0000-0000-000000000003', 85)
  on conflict (pessoa_id) do update set custo_hora = 85;
  get diagnostics n = row_count;
  perform teste('e é ele quem grava o custo-hora', n = 1);
end $$;

select vestir('22222222-2222-2222-2222-222222222222');
select teste('e nem depois de gravado o gerente alcança o valor',
  conta('select pessoa_id from pessoa_custo') = 0);

reset role;
select set_config('app.usuario', '', false);

\echo ''
\echo '  --- alocação e capacidade: todos os testes passaram ---'
\echo ''
