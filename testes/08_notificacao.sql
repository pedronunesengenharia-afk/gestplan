-- =============================================================================
-- GestPlan · testes/08_notificacao.sql
-- Os quatro gatilhos, e a porta fechada que os obriga a existir.
--
-- O que mais importa aqui não é que o aviso chegue: é que ele NÃO possa ser
-- forjado. `notificacao` não tem policy de INSERT de propósito, e a tentação de
-- abrir uma "só para o front conseguir escrever" vai aparecer. Os testes de
-- forja existem para essa hora.
--
-- Roda sobre o cenário de 01 e 02.
-- =============================================================================
\set ON_ERROR_STOP on

reset role;
select set_config('app.usuario', '', false);

-- Quantos avisos não lidos tem uma pessoa. Sem SECURITY DEFINER: quem chama é
-- quem enxerga, que é metade do que se quer medir.
create or replace function avisos(p_pessoa uuid) returns bigint language sql as $fn$
  select count(*) from notificacao where pessoa_id = p_pessoa;
$fn$;

-- Medida sem RLS, para conferir o que o gatilho gravou mesmo quando o papel da
-- vez não alcança a linha — e ele nunca alcança: caixa de aviso é privada até
-- do proprietário.
-- O filtro por projeto não é luxo: as suítes 01 a 07 mexem em fase e em
-- responsável, e com os gatilhos ligados elas já geram avisos. Contar sem
-- ancorar no projeto é contar o que as outras suítes fizeram.
create or replace function avisos_reais(
  p_pessoa uuid, p_tipo text default null, p_projeto uuid default null)
returns bigint language sql security definer as $fn$
  select count(*) from notificacao
   where pessoa_id = p_pessoa
     and (p_tipo is null or tipo = p_tipo)
     and (p_projeto is null or projeto_id = p_projeto);
$fn$;

-- Título e corpo juntos, sem RLS, para afirmar o que o aviso DIZ.
create or replace function texto_do_aviso(
  p_pessoa uuid, p_tipo text, p_projeto uuid default null)
returns text language sql security definer as $fn$
  select titulo || ' ~ ' || coalesce(corpo, '')
    from notificacao
   where pessoa_id = p_pessoa and tipo = p_tipo
     and (p_projeto is null or projeto_id = p_projeto)
   order by criado_em desc limit 1;
$fn$;

set role authenticated;

-- -----------------------------------------------------------------------------
-- 1 · Uma tarefa ficou sua
-- -----------------------------------------------------------------------------
select vestir('22222222-2222-2222-2222-222222222222');   -- GERENTE

insert into tarefa (id, projeto_id, nome, responsavel_id, data_fim_prev)
values ('7a7efa00-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000001', 'Levantar as medidas',
        'bbbbbbbb-0000-0000-0000-000000000003', current_date + 5);
-- Com as duas datas: `exige_cronograma` cobra início E fim, e uma tarefa pela
-- metade travaria a saída de fase para as suítes seguintes.
update tarefa set data_inicio_prev = current_date
 where id = '7a7efa00-0000-0000-0000-000000000001';

select teste('atribuir tarefa avisa quem recebeu',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000003', 'TAREFA_ATRIBUIDA') = 1);

select teste('o aviso carrega o código do projeto e o prazo',
  texto_do_aviso('bbbbbbbb-0000-0000-0000-000000000003', 'TAREFA_ATRIBUIDA')
    like '%prazo ' || to_char(current_date + 5, 'DD/MM/YYYY'));

-- Salvar a tarefa de novo sem mexer no responsável não pode avisar outra vez.
-- Aviso repetido é o começo do fim de qualquer sistema de notificação.
update tarefa set nome = 'Levantar as medidas do galpão'
 where id = '7a7efa00-0000-0000-0000-000000000001';
select teste('editar a tarefa sem trocar o responsável NÃO avisa de novo',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000003', 'TAREFA_ATRIBUIDA') = 1);

update tarefa set responsavel_id = 'bbbbbbbb-0000-0000-0000-000000000004'
 where id = '7a7efa00-0000-0000-0000-000000000001';
select teste('trocar o responsável avisa o novo',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000004', 'TAREFA_ATRIBUIDA') = 1);
select teste('e não avisa o antigo outra vez',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000003', 'TAREFA_ATRIBUIDA') = 1);

-- Ninguém é avisado do que ele mesmo fez.
update tarefa set responsavel_id = 'bbbbbbbb-0000-0000-0000-000000000002'
 where id = '7a7efa00-0000-0000-0000-000000000001';
select teste('o gerente NÃO é avisado de tarefa que ele mesmo se deu',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000002', 'TAREFA_ATRIBUIDA') = 0);

-- -----------------------------------------------------------------------------
-- 2 · Mencionaram ou responderam você
-- -----------------------------------------------------------------------------
insert into comentario (id, projeto_id, pessoa_id, texto, mencionados)
values ('c0e0e000-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000002',
        'Preciso da medição até sexta',
        array['bbbbbbbb-0000-0000-0000-000000000003']::uuid[]);

select teste('menção em comentário avisa quem foi citado',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000003', 'COMENTARIO_MENCAO') = 1);
select teste('o aviso diz quem mencionou',
  texto_do_aviso('bbbbbbbb-0000-0000-0000-000000000003', 'COMENTARIO_MENCAO')
    like 'Gerente mencionou você ~ %');

select vestir('33333333-3333-3333-3333-333333333333');   -- ESTRUTURA responde
insert into comentario (projeto_id, pessoa_id, texto, responde_id)
values ('dddddddd-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000003',
        'Sai quinta', 'c0e0e000-0000-0000-0000-000000000001');

select teste('responder um comentário avisa quem escreveu o original',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000002', 'COMENTARIO_RESPOSTA') = 1);

-- Responder e mencionar a mesma pessoa manda UM aviso, não dois.
select vestir('22222222-2222-2222-2222-222222222222');
insert into comentario (projeto_id, pessoa_id, texto, responde_id, mencionados)
values ('dddddddd-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000002',
        'Combinado', 'c0e0e000-0000-0000-0000-000000000001',
        array['bbbbbbbb-0000-0000-0000-000000000002']::uuid[]);
select teste('responder a si mesmo mencionando a si mesmo não gera aviso nenhum',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000002', 'COMENTARIO_RESPOSTA') = 1);

-- -----------------------------------------------------------------------------
-- 3 e 4 · A fase mudou
-- -----------------------------------------------------------------------------
-- PROJETO PRÓPRIO, e a razão é uma falha medida: a primeira versão destes
-- testes movia o projeto do cenário e batia em "a fase Execução exige todas as
-- tarefas com data prevista" — porque uma suíte anterior o havia deixado lá.
-- Suíte que depende de onde a anterior parou é suíte que quebra sozinha.
--
-- O gatilho de `projeto_fase_hist` dispara também na CRIAÇÃO do projeto, que é
-- a primeira entrada em fase que existe. Então nascer na fase já basta, e
-- nenhuma regra de saída entra no caminho.
select vestir('11111111-1111-1111-1111-111111111111');

-- Nascer direto em Avaliação exige o que Viabilidade cobra para ser deixada —
-- `campo_definicao.exigido_para_sair_de`. O banco cobra do projeto novo o
-- mesmo que cobraria de um que passasse por lá, e está certo.
insert into projeto (id, nome, tipo_projeto_id, fase_id, empresa_id, gerente_id, campos)
select '9a150000-0000-0000-0000-000000000001', 'Projeto que avisa',
       tp.id, f.id, 'aaaaaaaa-0000-0000-0000-000000000001',
       'bbbbbbbb-0000-0000-0000-000000000002',
       jsonb_build_object('vi_situacao_atual', 'Galpão sem cobertura',
                          'vi_alternativas',  'Reformar ou construir novo')
  from tipo_projeto tp
  join tipo_fase f on f.tipo_projeto_id = tp.id
 where tp.codigo = 'INVESTIMENTO' and f.codigo = 'AVALIACAO';

select teste('o gerente do projeto é avisado da entrada em fase',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000002', 'PROJETO_MUDOU_DE_FASE', '9a150000-0000-0000-0000-000000000001') = 1);

select teste('o avaliador é cobrado do parecer na fase que o exige',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000006', 'PARECER_PENDENTE', '9a150000-0000-0000-0000-000000000001') = 1);

select teste('o aviso de parecer nomeia os setores que travam a saída',
  texto_do_aviso('bbbbbbbb-0000-0000-0000-000000000006', 'PARECER_PENDENTE', '9a150000-0000-0000-0000-000000000001')
    like '%FINANCEIRO%');

select teste('quem não é avaliador NÃO é cobrado de parecer',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000003', 'PARECER_PENDENTE', '9a150000-0000-0000-0000-000000000001') = 0);

-- Descoberto escrevendo estes testes: as asserções de texto liam a caixa de
-- outra pessoa e voltavam nulas, porque `notificacao_propria` não abre exceção
-- nem para o dono. Está certo assim, e por isso virou afirmação.
select teste('nem o proprietário enxerga a caixa de aviso alheia',
  conta($$select id from notificacao
           where pessoa_id <> 'bbbbbbbb-0000-0000-0000-000000000001'$$) = 0);

-- Uma fase sem exigência de setor avisa o gerente e não cobra parecer.
insert into projeto (id, nome, tipo_projeto_id, fase_id, empresa_id, gerente_id)
select '9a150000-0000-0000-0000-000000000002', 'Projeto sem parecer devido',
       tp.id, f.id, 'aaaaaaaa-0000-0000-0000-000000000001',
       'bbbbbbbb-0000-0000-0000-000000000002'
  from tipo_projeto tp
  join tipo_fase f on f.tipo_projeto_id = tp.id
 where tp.codigo = 'INVESTIMENTO' and f.codigo = 'SOLICITACAO';

select teste('fase sem exige_setores não cobra parecer de ninguém',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000006', 'PARECER_PENDENTE', '9a150000-0000-0000-0000-000000000002') = 0);
select teste('mas o gerente é avisado dessa entrada também',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000002', 'PROJETO_MUDOU_DE_FASE', '9a150000-0000-0000-0000-000000000002') = 1);

-- -----------------------------------------------------------------------------
-- 5 · Cada um só enxerga a própria caixa
-- -----------------------------------------------------------------------------
select vestir('33333333-3333-3333-3333-333333333333');   -- ESTRUTURA
select teste('a estrutura enxerga os avisos dela',
  avisos('bbbbbbbb-0000-0000-0000-000000000003') > 0);
select teste('e NÃO enxerga os avisos do gerente',
  avisos('bbbbbbbb-0000-0000-0000-000000000002') = 0);
select teste('nem os do avaliador',
  avisos('bbbbbbbb-0000-0000-0000-000000000006') = 0);

select vestir('55555555-5555-5555-5555-555555555555');   -- EXTERNO
select teste('o externo não enxerga aviso nenhum',
  conta('select id from notificacao') = 0);

-- -----------------------------------------------------------------------------
-- 6 · Ninguém forja aviso — é o que justifica os gatilhos existirem
-- -----------------------------------------------------------------------------
select vestir('33333333-3333-3333-3333-333333333333');

do $$
begin
  begin
    insert into notificacao (pessoa_id, tipo, titulo)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'FORJADO', 'Aprove o projeto');
    raise exception 'FALHOU: forjaram aviso em nome de outra pessoa';
  exception
    when insufficient_privilege then
      perform teste('ninguém insere aviso em nome de outro', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('ninguém insere aviso em nome de outro', true);
  end;
end $$;

do $$
begin
  begin
    insert into notificacao (pessoa_id, tipo, titulo)
    values ('bbbbbbbb-0000-0000-0000-000000000003', 'FORJADO', 'Aviso meu mesmo');
    raise exception 'FALHOU: inseriram aviso até para si mesmo';
  exception
    when insufficient_privilege then
      perform teste('nem para si mesmo — a tabela não tem policy de INSERT', true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('nem para si mesmo — a tabela não tem policy de INSERT', true);
  end;
end $$;

do $$
declare n int;
begin
  update notificacao set lida_em = null
   where pessoa_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform teste('ninguém mexe na caixa alheia', n = 0);
end $$;

-- -----------------------------------------------------------------------------
-- 7 · Marcar lida e limpar a própria caixa
-- -----------------------------------------------------------------------------
do $$
declare n int;
begin
  update notificacao set lida_em = now()
   where pessoa_id = 'bbbbbbbb-0000-0000-0000-000000000003' and lida_em is null;
  get diagnostics n = row_count;
  perform teste('a pessoa marca os próprios avisos como lidos', n > 0);
end $$;

select teste('e depois de lidos eles continuam lá',
  avisos('bbbbbbbb-0000-0000-0000-000000000003') > 0);

do $$
declare n int;
begin
  delete from notificacao where pessoa_id = 'bbbbbbbb-0000-0000-0000-000000000003';
  get diagnostics n = row_count;
  perform teste('a pessoa limpa a própria caixa', n > 0);
end $$;

select teste('a caixa dela ficou vazia',
  avisos('bbbbbbbb-0000-0000-0000-000000000003') = 0);
select teste('e a do gerente continua intacta',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000002') > 0);

-- -----------------------------------------------------------------------------
-- 8 · Pessoa inativa não recebe
-- -----------------------------------------------------------------------------
reset role;
update pessoa set ativo = false where id = 'bbbbbbbb-0000-0000-0000-000000000004';
set role authenticated;

select vestir('22222222-2222-2222-2222-222222222222');
update tarefa set responsavel_id = 'bbbbbbbb-0000-0000-0000-000000000004'
 where id = '7a7efa00-0000-0000-0000-000000000001';
select teste('quem está inativo não recebe aviso novo',
  avisos_reais('bbbbbbbb-0000-0000-0000-000000000004', 'TAREFA_ATRIBUIDA') = 1);

reset role;
update pessoa set ativo = true where id = 'bbbbbbbb-0000-0000-0000-000000000004';
select set_config('app.usuario', '', false);

\echo ''
\echo '  --- notificação: todos os testes passaram ---'
\echo ''
