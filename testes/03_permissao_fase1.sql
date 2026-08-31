-- =============================================================================
-- GestPlan · testes/03_permissao_fase1.sql
-- Os casos que a Fase 1 acrescentou. Roda depois de 01 e 02, sobre o mesmo
-- cenário — as pessoas e o projeto já existem lá.
--
-- Cada um destes existe porque a regra correspondente JÁ FALHOU uma vez.
-- Teste que nasce de um buraco medido vale mais que teste escrito no vazio.
-- =============================================================================
\set ON_ERROR_STOP on

-- Um projeto com etapa valorada, comentário da estrutura e a fase de avaliação
-- à mão, montado como superusuário antes de trocar de papel.
reset role;
select set_config('app.usuario', '', false);

insert into etapa (id, projeto_id, codigo, nome, peso_percentual)
values ('77770000-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000001', '9', 'Etapa de teste', 10)
on conflict (id) do nothing;

update etapa_valor set quantidade = 2, preco_unitario = 12500
 where etapa_id = '77770000-0000-0000-0000-000000000001';

insert into comentario (id, projeto_id, pessoa_id, texto)
values ('77770000-0000-0000-0000-000000000002',
        'dddddddd-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000003',   -- Estrutura
        'Comentário escrito pela estrutura')
on conflict (id) do nothing;

-- Avaliador: papel que não existia no cenário de 02.
insert into auth.users (id, email) values
  ('66666666-6666-6666-6666-666666666666','avaliador@teste')
on conflict (id) do nothing;
insert into pessoa (id, nome, auth_user_id) values
  ('bbbbbbbb-0000-0000-0000-000000000006','Avaliador','66666666-6666-6666-6666-666666666666')
on conflict (id) do nothing;
insert into pessoa_papel (pessoa_id, empresa_id, papel) values
  ('bbbbbbbb-0000-0000-0000-000000000006','aaaaaaaa-0000-0000-0000-000000000001','AVALIADOR')
on conflict do nothing;

-- Desde 20260830160000 o papel diz o QUE se pode fazer, não ONDE. Para o
-- avaliador assinar este projeto, alguém tem de tê-lo posto nele. Os testes
-- abaixo continuam medindo o papel — com a pessoa lá dentro.
insert into alocacao (projeto_id, pessoa_id, papel, percentual_dedicacao)
values ('dddddddd-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000006', 'Avaliação', 10)
on conflict do nothing;

set role authenticated;

-- -----------------------------------------------------------------------------
-- 1 · O orçamento item a item tem porta de dinheiro
-- -----------------------------------------------------------------------------
select vestir('33333333-3333-3333-3333-333333333333');   -- ESTRUTURA
select teste('estrutura enxerga a estrutura da EAP',
  conta('select id from etapa') > 0);
select teste('estrutura NÃO enxerga o valor das etapas',
  conta('select etapa_id from etapa_valor') = 0);
select teste('na vw_etapa, a etapa aparece e o preço vem vazio',
  conta($$select id from vw_etapa where preco_unitario is null$$) > 0);
select teste('estrutura NÃO soma um centavo de orçamento',
  conta($$select 1 from vw_etapa where valor is not null$$) = 0);

select vestir('22222222-2222-2222-2222-222222222222');   -- GERENTE
select teste('gerente enxerga o valor das etapas',
  conta('select etapa_id from etapa_valor') > 0);
select teste('e a vw_etapa devolve o preço para ele',
  conta($$select id from vw_etapa where preco_unitario is not null$$) > 0);

-- -----------------------------------------------------------------------------
-- 2 · Parecer é de quem tem o papel de assinar
-- -----------------------------------------------------------------------------
do $$
declare v_fase uuid; n int;
begin
  select f.id into v_fase from tipo_fase f join tipo_projeto t on t.id = f.tipo_projeto_id
   where t.codigo = 'INVESTIMENTO' and f.codigo = 'AVALIACAO';

  perform vestir('22222222-2222-2222-2222-222222222222');   -- gerente, não avaliador
  begin
    insert into aprovacao (projeto_id, fase_id, setor_codigo, decisao)
    values ('dddddddd-0000-0000-0000-000000000001', v_fase, 'FINANCEIRO', 'APROVADO');
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FALHOU: gerente sem papel AVALIADOR assinou parecer'; end if;
    perform teste('gerente sem papel AVALIADOR NÃO assina parecer', true);
  exception
    when insufficient_privilege then perform teste('gerente sem papel AVALIADOR NÃO assina parecer', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('gerente sem papel AVALIADOR NÃO assina parecer', true);
  end;

  perform vestir('66666666-6666-6666-6666-666666666666');   -- avaliador
  insert into aprovacao (projeto_id, fase_id, setor_codigo, decisao)
  values ('dddddddd-0000-0000-0000-000000000001', v_fase, 'COMPRAS', 'APROVADO')
  on conflict (projeto_id, fase_id, setor_codigo) do update set decisao = 'APROVADO';
  perform teste('quem tem papel AVALIADOR assina', true);
end $$;

-- -----------------------------------------------------------------------------
-- 3 · Comentário é de quem escreveu
-- -----------------------------------------------------------------------------
do $$
declare n int;
begin
  perform vestir('22222222-2222-2222-2222-222222222222');   -- gerente

  update comentario set texto = 'TROCADO PELO GERENTE'
   where id = '77770000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FALHOU: gerente alterou comentário alheio'; end if;
  perform teste('gerente NÃO altera comentário alheio', true);

  delete from comentario where id = '77770000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FALHOU: gerente apagou comentário alheio'; end if;
  perform teste('gerente NÃO apaga comentário alheio', true);

  -- Comentar em nome de outra pessoa também não.
  begin
    insert into comentario (projeto_id, pessoa_id, texto)
    values ('dddddddd-0000-0000-0000-000000000001',
            'bbbbbbbb-0000-0000-0000-000000000003', 'em nome da estrutura');
    raise exception 'FALHOU: gerente comentou em nome de outra pessoa';
  exception
    when insufficient_privilege then perform teste('ninguém comenta em nome de outra pessoa', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('ninguém comenta em nome de outra pessoa', true);
  end;

  -- O autor edita o próprio.
  perform vestir('33333333-3333-3333-3333-333333333333');   -- estrutura, autora
  update comentario set texto = 'corrigido pela autora'
   where id = '77770000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: a autora não conseguiu editar o próprio comentário'; end if;
  perform teste('a autora edita o próprio comentário', true);
end $$;

-- -----------------------------------------------------------------------------
-- 4 · A tela consegue perguntar o que pode fazer
-- -----------------------------------------------------------------------------
select vestir('22222222-2222-2222-2222-222222222222');
select teste('gerente: posso_editar_projeto diz sim',
  public.posso_editar_projeto('dddddddd-0000-0000-0000-000000000001'));
select teste('gerente: posso_ver_valores diz sim',
  public.posso_ver_valores('dddddddd-0000-0000-0000-000000000001'));
select teste('gerente: posso_assinar diz não',
  not public.posso_assinar('dddddddd-0000-0000-0000-000000000001'));

select vestir('33333333-3333-3333-3333-333333333333');
select teste('estrutura: posso_editar_projeto diz não',
  not public.posso_editar_projeto('dddddddd-0000-0000-0000-000000000001'));
select teste('estrutura: posso_ver_valores diz não',
  not public.posso_ver_valores('dddddddd-0000-0000-0000-000000000001'));

select vestir('66666666-6666-6666-6666-666666666666');
select teste('avaliador: posso_assinar diz sim',
  public.posso_assinar('dddddddd-0000-0000-0000-000000000001'));

reset role;
select set_config('app.usuario', '', false);

\echo ''
\echo '  --- permissão da Fase 1: todos os testes passaram ---'
\echo ''
