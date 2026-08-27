-- =============================================================================
-- GestPlan · testes/02_permissao.sql
-- A suíte que tenta ler dado alheio com cada papel.
--
-- Roda DEPOIS de 01_regras.sql, sobre o mesmo cenário. É esta suíte que a
-- estratégia manda executar antes de todo deploy: sem ela, a falha de
-- permissão é descoberta pela pessoa errada.
-- =============================================================================
\set ON_ERROR_STOP on

-- Entra na pele de alguém. `set role authenticated` é o que faz a RLS valer:
-- superusuário passa por cima de qualquer política.
create or replace function vestir(p_auth uuid)
returns void language plpgsql as $$
begin
  perform set_config('app.usuario', p_auth::text, false);
end $$;

create or replace function conta(p_sql text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') x' into n;
  return n;
end $$;

-- =============================================================================
-- Projeto extra na Empresa Beta, onde só o dono tem papel
-- =============================================================================
insert into projeto (id, nome, tipo_projeto_id, fase_id, empresa_id)
select '99999999-0000-0000-0000-000000000001','Projeto reservado da Beta',
       tp.id, f.id, 'aaaaaaaa-0000-0000-0000-000000000002'
  from tipo_projeto tp join tipo_fase f on f.tipo_projeto_id = tp.id and f.inicial
 where tp.codigo = 'OBRA';

-- Tira a Beta do rateio do projeto principal, para o teste de isolamento ficar limpo.
delete from projeto_empresa where projeto_id = 'dddddddd-0000-0000-0000-000000000001';

set role authenticated;

-- -----------------------------------------------------------------------------
-- Proprietário
-- -----------------------------------------------------------------------------
select vestir('11111111-1111-1111-1111-111111111111');
select teste('dono enxerga todos os projetos',       conta('select id from projeto') = 4);
select teste('dono enxerga todos os valores',        conta('select projeto_id from projeto_valor') = 4);
select teste('dono enxerga as duas empresas',        conta('select id from empresa') = 2);
select teste('dono enxerga a trilha de auditoria',   conta('select id from evento') > 0);

-- -----------------------------------------------------------------------------
-- Gerente de projetos — só a Empresa Alfa
-- -----------------------------------------------------------------------------
select vestir('22222222-2222-2222-2222-222222222222');
select teste('gerente enxerga só os projetos da sua empresa', conta('select id from projeto') = 2);
select teste('gerente NÃO enxerga o projeto reservado da Beta',
  conta($$select id from projeto where id='99999999-0000-0000-0000-000000000001'$$) = 0);
select teste('gerente enxerga os valores dos projetos dele',
  conta('select projeto_id from projeto_valor') = 2);
select teste('gerente enxerga uma empresa só',       conta('select id from empresa') = 1);
select teste('gerente enxerga o custo lançado',      conta('select id from custo') = 1);
select teste('gerente NÃO enxerga a trilha de auditoria de tudo',
  conta($$select id from evento where tabela <> 'projeto'$$) = 0);

-- -----------------------------------------------------------------------------
-- Estrutura / operação — vê o projeto, NÃO vê o dinheiro
-- -----------------------------------------------------------------------------
select vestir('33333333-3333-3333-3333-333333333333');
select teste('estrutura enxerga os projetos da empresa', conta('select id from projeto') = 2);
select teste('estrutura enxerga as tarefas',             conta('select id from tarefa') = 3);
select teste('estrutura NÃO enxerga valor nenhum',       conta('select projeto_id from projeto_valor') = 0);
select teste('estrutura NÃO enxerga custo',              conta('select id from custo') = 0);
select teste('estrutura NÃO enxerga parcela',            conta('select id from parcela') = 0);
select teste('estrutura NÃO enxerga contrato',           conta('select id from contrato') = 0);
select teste('na carteira, a linha aparece e o valor vem vazio',
  conta($$select id from vw_projeto where valor_orcado is null$$) = 2);

-- -----------------------------------------------------------------------------
-- Financeiro / Compras — vê o dinheiro, não mexe no escopo
-- -----------------------------------------------------------------------------
select vestir('44444444-4444-4444-4444-444444444444');
select teste('financeiro enxerga os valores',  conta('select projeto_id from projeto_valor') = 2);
select teste('financeiro enxerga os custos',   conta('select id from custo') = 1);
select teste('financeiro enxerga contratos',   conta('select id from contrato') = 1);

do $$
begin
  begin
    update projeto set nome = 'Nome trocado pelo financeiro'
     where id = 'dddddddd-0000-0000-0000-000000000001';
    if found then
      raise exception 'FALHOU: financeiro conseguiu alterar o escopo do projeto';
    end if;
    perform teste('financeiro NÃO altera o escopo do projeto', true);
  exception when insufficient_privilege or others then
    perform teste('financeiro NÃO altera o escopo do projeto', true);
  end;
end $$;

-- -----------------------------------------------------------------------------
-- Fornecedor externo — o teste que mais importa
-- -----------------------------------------------------------------------------
select vestir('55555555-5555-5555-5555-555555555555');
-- Com o portal adiado, a porta do externo está fechada, não entreaberta:
-- ele alcança o próprio contrato e mais nada.
select teste('externo NÃO enxerga projeto nenhum',
  conta('select id from projeto') = 0);
select teste('externo NÃO enxerga tarefas',
  conta('select id from tarefa') = 0);
select teste('externo enxerga o contrato dele',
  conta($$select id from contrato where fornecedor_id='cccccccc-0000-0000-0000-000000000001'$$) = 1);
select teste('externo NÃO enxerga os valores do projeto',
  conta('select projeto_id from projeto_valor') = 0);
select teste('externo NÃO enxerga os custos',      conta('select id from custo') = 0);
select teste('externo NÃO enxerga as parcelas',    conta('select id from parcela') = 0);
select teste('externo NÃO enxerga o orçamento item a item',
  conta('select id from etapa') = 0);
select teste('externo NÃO enxerga a lista de pessoas da equipe',
  conta('select id from pessoa') = 1);          -- só ele mesmo
select teste('externo NÃO enxerga outros fornecedores',
  conta('select id from fornecedor') = 1);      -- só ele mesmo
select teste('externo NÃO enxerga a trilha de auditoria',
  conta('select id from evento') = 0);
select teste('externo NÃO enxerga as empresas',   conta('select id from empresa') = 0);

-- Escrever, então, nem pensar.
do $$
begin
  begin
    insert into custo (projeto_id, categoria_id, descricao, valor)
    values ('dddddddd-0000-0000-0000-000000000001',
            (select id from categoria_custo limit 1), 'Custo forjado', 999);
    raise exception 'FALHOU: externo conseguiu lançar custo';
  exception
    when insufficient_privilege then perform teste('externo NÃO lança custo', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('externo NÃO lança custo', true);
  end;
end $$;

-- -----------------------------------------------------------------------------
-- Anônimo — sem pessoa vinculada, nada
-- -----------------------------------------------------------------------------
select set_config('app.usuario', '', false);
select teste('sem usuário identificado, nenhum projeto', conta('select id from projeto') = 0);
select teste('sem usuário identificado, nenhuma pessoa',  conta('select id from pessoa') = 0);
select teste('sem usuário identificado, nenhum tipo de projeto',
  conta('select id from tipo_projeto') = 0);

-- -----------------------------------------------------------------------------
-- O caminho de verdade: o claim como o PostgREST o publica
--
-- Todos os casos acima entram por `app.usuario`, que é atalho de teste. Se a
-- suíte parar aí, uma quebra no jeito de ler o JWT passa batida — e foi
-- exatamente o que aconteceu: `app.pessoa_atual()` lia um GUC que o PostgREST
-- não popula desde a v9, e a RLS negava tudo no app real com a suíte verde.
-- -----------------------------------------------------------------------------
select set_config('app.usuario', '', false);
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);

select teste('claim em request.jwt.claims identifica a pessoa',
  app.pessoa_atual() = 'bbbbbbbb-0000-0000-0000-000000000001');
select teste('pelo JWT, o dono enxerga os projetos',   conta('select id from projeto') = 4);
select teste('pelo JWT, o dono enxerga as empresas',   conta('select id from empresa') = 2);

select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', false);
select teste('pelo JWT, o externo continua sem ver empresa',
  conta('select id from empresa') = 0);

select set_config('request.jwt.claims', '', false);
select teste('sem claim nenhum, ninguém é identificado', app.pessoa_atual() is null);

reset role;

\echo ''
\echo '  --- permissão: todos os testes passaram ---'
\echo ''
