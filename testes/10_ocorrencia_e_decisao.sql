-- =============================================================================
-- GestPlan · testes/10_ocorrencia_e_decisao.sql
-- Os dois registros do histórico do projeto, e a fronteira entre eles.
--
-- Roda sobre o cenário de 01 e 02. A suíte 08 repõe as alocações que a 07
-- limpa, então aqui a Estrutura já é parte do projeto principal.
-- =============================================================================
\set ON_ERROR_STOP on

reset role;
select set_config('app.usuario', '', false);
set role authenticated;

-- -----------------------------------------------------------------------------
-- 1 · Ocorrência: quem edita o projeto abre e trata
-- -----------------------------------------------------------------------------
select vestir('22222222-2222-2222-2222-222222222222');   -- GERENTE

insert into ocorrencia (id, projeto_id, tipo, titulo, descricao, impacto, probabilidade)
values ('0c04e000-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000001', 'PROBLEMA',
        'Guindaste não chegou na data', 'Fornecedor remarcou sem avisar',
        'ALTO', 'ALTA');

select teste('o gerente abre uma ocorrência',
  conta('select id from ocorrencia') = 1);
select teste('e ela nasce ABERTA — registro que nasce fechado não cobra nada',
  conta($$select id from ocorrencia where status = 'ABERTA'$$) = 1);

-- A politica de UPDATE nao existia: dava para abrir e nunca mais mexer.
do $$
declare n int;
begin
  update ocorrencia set status = 'RESOLVIDA', resolvido_em = current_date
   where id = '0c04e000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform teste('e o gerente consegue tratá-la até fechar', n = 1);
end $$;

-- DECISAO saiu da lista de tipos: ela tem tabela propria agora.
select teste_recusa('ocorrência do tipo DECISAO é recusada — decisão não mora aqui',
  $$insert into ocorrencia (projeto_id, tipo, titulo)
    values ('dddddddd-0000-0000-0000-000000000001', 'DECISAO', 'Isto é decisão')$$);

-- -----------------------------------------------------------------------------
-- 2 · Quem só alcança o projeto lê a ocorrência, e não a trata
-- -----------------------------------------------------------------------------
select vestir('33333333-3333-3333-3333-333333333333');   -- ESTRUTURA
select teste('a estrutura enxerga a ocorrência do projeto que alcança',
  conta('select id from ocorrencia') = 1);

do $$
declare n int;
begin
  update ocorrencia set titulo = 'Trocado por quem não edita';
  get diagnostics n = row_count;
  perform teste('mas NÃO altera a ocorrência', n = 0);
end $$;

do $$
declare n int;
begin
  delete from ocorrencia;
  get diagnostics n = row_count;
  perform teste('nem apaga', n = 0);
end $$;

select vestir('55555555-5555-5555-5555-555555555555');   -- EXTERNO
select teste('o externo não enxerga ocorrência nenhuma',
  conta('select id from ocorrencia') = 0);

-- -----------------------------------------------------------------------------
-- 3 · Decisão
-- -----------------------------------------------------------------------------
select vestir('22222222-2222-2222-2222-222222222222');   -- GERENTE

insert into decisao (id, projeto_id, titulo, decisao, contexto, alternativas, decidido_por)
values ('dec12a00-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000001',
        'Trocar o fornecedor do guindaste',
        'Fica com a Cyborg, mesmo custando 8% a mais',
        'O primeiro remarcou duas vezes e travou a montagem',
        'Manter o atual (descartado: sem data firme); alugar (descartado: sai mais caro em 90 dias)',
        'bbbbbbbb-0000-0000-0000-000000000002');

select teste('o gerente registra uma decisão',
  conta('select id from decisao') = 1);
select teste('e ela guarda o que foi DESCARTADO, que é a razão da tabela existir',
  conta($$select id from decisao where btrim(coalesce(alternativas,'')) <> ''$$) = 1);

-- Decisao nao tem situacao: nao existe coluna de status para ficar pendente.
select teste('decisão não tem situação — não há coluna de status para ficar pendente',
  conta($$select column_name from information_schema.columns
           where table_name = 'decisao' and column_name in ('status','resolvido_em')$$) = 0);

-- Quem decidiu e obrigatorio, de um jeito ou de outro.
select teste_recusa('decisão sem quem decidiu é recusada',
  $$insert into decisao (projeto_id, titulo, decisao)
    values ('dddddddd-0000-0000-0000-000000000001', 'Sem dono', 'Alguma coisa')$$);

-- Quem decide nem sempre tem cadastro: diretor, cliente, fornecedor.
insert into decisao (projeto_id, titulo, decisao, quem_avulso)
values ('dddddddd-0000-0000-0000-000000000001',
        'Adiar a montagem para depois da parada',
        'Fica para janeiro', 'Diretoria da Cimentpav');
select teste('quem decidiu pode não ter cadastro',
  conta($$select id from decisao where quem_avulso is not null$$) = 1);

select teste_recusa('decisão sem título é recusada',
  $$insert into decisao (projeto_id, titulo, decisao, quem_avulso)
    values ('dddddddd-0000-0000-0000-000000000001', '  ', 'algo', 'Fulano')$$);

select teste_recusa('decisão vazia é recusada — o registro é o que ficou combinado',
  $$insert into decisao (projeto_id, titulo, decisao, quem_avulso)
    values ('dddddddd-0000-0000-0000-000000000001', 'Um título', '   ', 'Fulano')$$);

-- -----------------------------------------------------------------------------
-- 4 · A decisão segue o alcance do projeto
-- -----------------------------------------------------------------------------
select vestir('33333333-3333-3333-3333-333333333333');   -- ESTRUTURA
select teste('a estrutura lê as decisões do projeto que alcança',
  conta('select id from decisao') = 2);

do $$
declare n int;
begin
  update decisao set decisao = 'Reescrito por quem não edita';
  get diagnostics n = row_count;
  perform teste('mas não reescreve decisão nenhuma', n = 0);
end $$;

do $$
begin
  begin
    insert into decisao (projeto_id, titulo, decisao, quem_avulso)
    values ('dddddddd-0000-0000-0000-000000000001', 'Decidido por quem não edita',
            'algo', 'Fulano');
    raise exception 'FALHOU: quem não edita o projeto registrou decisão';
  exception
    when insufficient_privilege then
      perform teste('nem registra decisão nova', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('nem registra decisão nova', true);
  end;
end $$;

select vestir('55555555-5555-5555-5555-555555555555');   -- EXTERNO
select teste('o externo não enxerga decisão nenhuma',
  conta('select id from decisao') = 0);

-- Projeto que o gerente nao alcanca continua fora do alcance dele.
select vestir('22222222-2222-2222-2222-222222222222');
do $$
begin
  begin
    insert into decisao (projeto_id, titulo, decisao, quem_avulso)
    values ('99999999-0000-0000-0000-000000000001', 'Decisão em projeto alheio',
            'algo', 'Fulano');
    raise exception 'FALHOU: registraram decisão em projeto que não alcançam';
  exception
    when insufficient_privilege then
      perform teste('ninguém decide em projeto que não alcança', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('ninguém decide em projeto que não alcança', true);
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 5 · Os dois somem com o projeto
-- -----------------------------------------------------------------------------
-- `on delete cascade` nos dois: histórico de projeto que não existe mais não é
-- histórico de nada. Diferente do afazer, que sobrevive porque é lembrete de
-- alguém — estes são do projeto.
reset role;
select set_config('app.usuario', '', false);

create temporary table antes as
select (select count(*) from ocorrencia) o, (select count(*) from decisao) d;

delete from projeto where id = 'dddddddd-0000-0000-0000-000000000001';

select teste('apagado o projeto, as ocorrências dele vão junto',
  (select count(*) from ocorrencia) = 0);
select teste('e as decisões também',
  (select count(*) from decisao) = 0);
select teste('e havia o que apagar — senão o teste acima não prova nada',
  (select o + d from antes) = 3);

select set_config('app.usuario', '', false);

\echo ''
\echo '  --- ocorrência e decisão: todos os testes passaram ---'
\echo ''
