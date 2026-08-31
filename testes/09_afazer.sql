-- =============================================================================
-- GestPlan · testes/09_afazer.sql
-- A lista pessoal, e a promessa de que ela é pessoal mesmo.
--
-- O teste que mais importa aqui é o que prova que NEM O PROPRIETÁRIO lê a
-- lista dos outros. É uma promessa feita à equipe, e promessa de privacidade
-- que não tem teste é promessa que uma política mal escrita quebra em
-- silêncio — ninguém reclama, porque ninguém vê.
--
-- Roda sobre o cenário de 01 e 02.
-- =============================================================================
\set ON_ERROR_STOP on

reset role;
select set_config('app.usuario', '', false);

-- Sem RLS, para conferir o que existe de verdade quando o papel da vez não
-- alcança a linha — e ele nunca alcança a de outro.
create or replace function afazeres_reais(p_pessoa uuid)
returns bigint language sql security definer as $fn$
  select count(*) from afazer where pessoa_id = p_pessoa;
$fn$;

set role authenticated;

-- -----------------------------------------------------------------------------
-- 1 · Cada um escreve na própria lista
-- -----------------------------------------------------------------------------
select vestir('33333333-3333-3333-3333-333333333333');   -- ESTRUTURA

insert into afazer (id, pessoa_id, titulo, prazo, prioridade)
values ('a4a2e000-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000003',
        'Cobrar a nota fiscal do guindaste', current_date + 2, 'ALTA');

select teste('a pessoa escreve na própria lista',
  conta('select id from afazer') = 1);
select teste('e o item nasce pendente',
  conta('select id from afazer where feito_em is null') = 1);

-- O afazer pode apontar para um projeto que a pessoa alcança.
insert into afazer (id, pessoa_id, titulo, projeto_id)
values ('a4a2e000-0000-0000-0000-000000000002',
        'bbbbbbbb-0000-0000-0000-000000000003',
        'Revisar a ata antes da reunião',
        'dddddddd-0000-0000-0000-000000000001');
select teste('e pode apontar para um projeto que ela alcança',
  conta($$select id from afazer where projeto_id is not null$$) = 1);

-- E pode dizer de que empresa e, com ou sem projeto.
insert into afazer (id, pessoa_id, titulo, empresa_id)
values ('a4a2e000-0000-0000-0000-000000000004',
        'bbbbbbbb-0000-0000-0000-000000000003',
        'Cobrar a nota da Alfa', 'aaaaaaaa-0000-0000-0000-000000000001');
select teste('e pode dizer de que empresa é, sem projeto nenhum',
  conta($$select id from afazer
           where empresa_id is not null and projeto_id is null$$) = 1);

do $$
begin
  begin
    insert into afazer (pessoa_id, titulo, empresa_id)
    values ('bbbbbbbb-0000-0000-0000-000000000003', 'Item de empresa alheia',
            'aaaaaaaa-0000-0000-0000-000000000002');
    raise exception 'FALHOU: ligaram afazer a empresa que a pessoa nao alcanca';
  exception
    when insufficient_privilege then
      perform teste('mas não a empresa que ela não alcança', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('mas não a empresa que ela não alcança', true);
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 2 · Ninguém escreve na lista de outro
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    insert into afazer (pessoa_id, titulo)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'Item posto na lista alheia');
    raise exception 'FALHOU: escreveram na lista de outra pessoa';
  exception
    when insufficient_privilege then
      perform teste('ninguém escreve na lista de outra pessoa', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('ninguém escreve na lista de outra pessoa', true);
  end;
end $$;

-- Nem apontando para projeto que não alcança.
do $$
begin
  begin
    insert into afazer (pessoa_id, titulo, projeto_id)
    values ('bbbbbbbb-0000-0000-0000-000000000003', 'Item de projeto alheio',
            '99999999-0000-0000-0000-000000000001');
    raise exception 'FALHOU: ligaram afazer a projeto que a pessoa não alcança';
  exception
    when insufficient_privilege then
      perform teste('nem liga afazer a projeto que não alcança', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('nem liga afazer a projeto que não alcança', true);
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 3 · A lista é privada — inclusive do proprietário
-- -----------------------------------------------------------------------------
-- É a promessa que a tabela faz no comentário dela. Se um dia alguém
-- "consertar" a política para o dono poder acompanhar, é aqui que aparece.
select vestir('22222222-2222-2222-2222-222222222222');   -- GERENTE
select teste('o gerente não enxerga a lista da estrutura',
  conta('select id from afazer') = 0);

select vestir('11111111-1111-1111-1111-111111111111');   -- DONO
select teste('NEM O PROPRIETÁRIO enxerga a lista de outra pessoa',
  conta('select id from afazer') = 0);
select teste('e ela continua lá, do lado de fora da RLS',
  afazeres_reais('bbbbbbbb-0000-0000-0000-000000000003') = 3);

do $$
declare n int;
begin
  update afazer set titulo = 'Trocado pelo dono';
  get diagnostics n = row_count;
  perform teste('nem o proprietário edita a lista de outra pessoa', n = 0);
end $$;

do $$
declare n int;
begin
  delete from afazer;
  get diagnostics n = row_count;
  perform teste('nem o proprietário apaga a lista de outra pessoa', n = 0);
end $$;

select vestir('55555555-5555-5555-5555-555555555555');   -- EXTERNO
select teste('o externo não enxerga afazer nenhum',
  conta('select id from afazer') = 0);

-- -----------------------------------------------------------------------------
-- 4 · Concluir, desfazer e apagar — tudo do dono da lista
-- -----------------------------------------------------------------------------
select vestir('33333333-3333-3333-3333-333333333333');

do $$
declare n int;
begin
  update afazer set feito_em = now()
   where id = 'a4a2e000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform teste('a pessoa conclui o próprio item', n = 1);
end $$;

-- Tres na lista: o do prazo, o do projeto e o da empresa. Concluido um,
-- sobram dois.
select teste('e o item some dos pendentes',
  conta('select id from afazer where feito_em is null') = 2);

do $$
declare n int;
begin
  update afazer set feito_em = null
   where id = 'a4a2e000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform teste('e pode desfazer — concluir por engano acontece', n = 1);
end $$;

do $$
declare n int;
begin
  delete from afazer where id = 'a4a2e000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform teste('a pessoa apaga o próprio item', n = 1);
end $$;

-- -----------------------------------------------------------------------------
-- 5 · O que o banco cobra sozinho
-- -----------------------------------------------------------------------------
select teste_recusa('afazer sem título é recusado',
  $$insert into afazer (pessoa_id, titulo)
    values ('bbbbbbbb-0000-0000-0000-000000000003', '   ')$$);

select teste_recusa('prioridade inventada é recusada',
  $$insert into afazer (pessoa_id, titulo, prioridade)
    values ('bbbbbbbb-0000-0000-0000-000000000003', 'Item', 'URGENTISSIMO')$$);

-- -----------------------------------------------------------------------------
-- 6 · O lembrete sobrevive ao projeto
-- -----------------------------------------------------------------------------
-- `on delete set null`, e não cascade: "cobrar a nota fiscal" não deixa de
-- precisar ser feito porque alguém arquivou o projeto.
select vestir('11111111-1111-1111-1111-111111111111');
insert into afazer (id, pessoa_id, titulo, projeto_id)
select 'a4a2e000-0000-0000-0000-000000000003',
       'bbbbbbbb-0000-0000-0000-000000000001',
       'Cobrar a nota fiscal', p.id
  from projeto p where p.nome = 'Projeto sem avaliador dentro';

delete from projeto where nome = 'Projeto sem avaliador dentro';

select teste('apagado o projeto, o lembrete continua',
  conta($$select id from afazer where id='a4a2e000-0000-0000-0000-000000000003'$$) = 1);
select teste('e a ligação com o projeto fica vazia, não quebrada',
  conta($$select id from afazer
           where id='a4a2e000-0000-0000-0000-000000000003' and projeto_id is null$$) = 1);

reset role;
select set_config('app.usuario', '', false);

\echo ''
\echo '  --- afazer: todos os testes passaram ---'
\echo ''
