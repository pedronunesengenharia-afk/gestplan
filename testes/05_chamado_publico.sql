-- =============================================================================
-- GestPlan · testes/05_chamado_publico.sql
-- A porta anônima: o que ela deixa passar, e principalmente o que não deixa.
--
-- Esta é a única porta do sistema que se abre sem login. Cada caso aqui existe
-- porque, numa porta dessas, o que não está testado é o que um dia passa.
-- =============================================================================
\set ON_ERROR_STOP on

reset role;
select set_config('app.usuario', '', false);
select set_config('request.jwt.claims', '', false);

-- A fila precisa estar configurada (a suíte 04 já semeia; aqui é garantia).
insert into configuracao (chave, valor, descricao)
select 'chamado.tipo_projeto',
       jsonb_build_object('tipo_projeto_id', tp.id, 'codigo', tp.codigo),
       'semeado pelo teste'
  from tipo_projeto tp where tp.codigo = 'TI'
on conflict (chave) do nothing;


-- =============================================================================
-- O que o anônimo NÃO alcança
--
-- Vem primeiro de propósito: antes de conferir que a porta abre, conferir que
-- a parede é parede.
-- =============================================================================
set role anon;

-- O anonimo e barrado por dois mecanismos diferentes, e o teste tem de valer
-- nos dois. Aqui no stub nao ha GRANT nenhum para ele, entao a consulta e
-- RECUSADA. No Supabase de verdade o GRANT existe por padrao e quem esvazia a
-- resposta e a RLS — medido em producao: `[]` em todas.
--
-- O que importa nos dois mundos e a mesma coisa: o anonimo nao VE linha. Um
-- teste que so aceitasse a recusa passaria aqui e nao pegaria vazamento la.
do $$
declare t text; n bigint;
begin
  foreach t in array array['projeto','pessoa','empresa','chamado_avulso','etapa','custo'] loop
    begin
      execute format('select count(*) from %I', t) into n;
      perform teste('anonimo nao ve nada em ' || t, n = 0);
    exception when insufficient_privilege then
      perform teste('anonimo nao alcanca ' || t, true);
    when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform teste('anonimo nao alcanca ' || t, true);
    end;
  end loop;
end $$;

-- Mas enxerga as empresas pela função, que é o mínimo para o formulário.
select teste('anonimo ve as empresas pela funcao',
  (select count(*) from public.empresas_para_chamado()) = 2);


-- =============================================================================
-- O que a porta recusa
-- =============================================================================
do $$
declare v_e uuid;
begin
  select id into v_e from public.empresas_para_chamado() limit 1;

  begin
    perform public.abrir_chamado_publico('Jo', 'jo@exemplo.com', v_e, 'Impressora parou de vez');
    perform teste('nome curto NAO passa', false);
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform teste('nome curto nao passa', true);
  end;

  begin
    perform public.abrir_chamado_publico('Joana da Silva', 'nao-e-email', v_e, 'Impressora parou de vez');
    perform teste('e-mail invalido NAO passa', false);
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform teste('e-mail invalido nao passa', true);
  end;

  begin
    perform public.abrir_chamado_publico('Joana da Silva', 'joana@exemplo.com', null, 'Impressora parou de vez');
    perform teste('sem empresa NAO passa', false);
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform teste('sem empresa nao passa', true);
  end;

  begin
    perform public.abrir_chamado_publico('Joana da Silva', 'joana@exemplo.com',
                                         '00000000-0000-0000-0000-000000000000', 'Impressora parou');
    perform teste('empresa inexistente NAO passa', false);
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform teste('empresa inexistente nao passa', true);
  end;

  begin
    perform public.abrir_chamado_publico('Joana da Silva', 'joana@exemplo.com', v_e, 'oi');
    perform teste('titulo curto NAO passa', false);
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform teste('titulo curto nao passa', true);
  end;

  begin
    perform public.abrir_chamado_publico('Joana da Silva', 'joana@exemplo.com', v_e,
                                         'Impressora parou', repeat('x', 4001));
    perform teste('descricao gigante NAO passa', false);
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform teste('descricao gigante nao passa', true);
  end;
end $$;


-- =============================================================================
-- O que a porta deixa passar
-- =============================================================================
do $$
declare v_e uuid; v_codigo text; v_projeto uuid;
begin
  select id into v_e from public.empresas_para_chamado() limit 1;

  v_codigo := public.abrir_chamado_publico(
    'Joana da Silva', 'Joana@Exemplo.com', v_e,
    'Impressora do estoque parou de puxar papel',
    'Desde ontem de manha. Ja tentei desligar e ligar.', 'Estoque', '15 99999-0000');

  perform teste('anonimo abre chamado', v_codigo is not null);
  perform teste('e recebe um codigo para cobrar depois', v_codigo ~ '^[A-Z]+-[0-9]{4}-[0-9]{3}$');

  -- Daqui em diante e o banco olhando por dentro: o anonimo nao le nada disso.
  reset role;
  select id into v_projeto from projeto where codigo = v_codigo;

  perform teste('o chamado nasceu na fila configurada',
    (select tp.codigo from tipo_projeto tp
      join projeto p on p.tipo_projeto_id = tp.id where p.id = v_projeto) = 'TI');
  perform teste('e na fase inicial dela',
    (select f.inicial from tipo_fase f join projeto p on p.fase_id = f.id where p.id = v_projeto));
  perform teste('sem solicitante, porque quem abriu nao e pessoa do sistema',
    (select solicitante_id from projeto where id = v_projeto) is null);
  perform teste('quem abriu ficou guardado em chamado_avulso',
    (select nome from chamado_avulso where projeto_id = v_projeto) = 'Joana da Silva');
  perform teste('com o e-mail em minusculas, para o limite por e-mail funcionar',
    (select email from chamado_avulso where projeto_id = v_projeto) = 'joana@exemplo.com');
  perform teste('na empresa escolhida',
    (select empresa_id from projeto where id = v_projeto) = v_e);
end $$;


-- =============================================================================
-- O limite por e-mail
-- =============================================================================
set role anon;
do $$
declare v_e uuid;
begin
  select id into v_e from public.empresas_para_chamado() limit 1;

  -- Ja houve um acima; mais dois chegam ao teto de tres.
  perform public.abrir_chamado_publico('Joana da Silva', 'joana@exemplo.com', v_e, 'Segundo problema do dia');
  perform public.abrir_chamado_publico('Joana da Silva', 'joana@exemplo.com', v_e, 'Terceiro problema do dia');

  begin
    perform public.abrir_chamado_publico('Joana da Silva', 'joana@exemplo.com', v_e, 'Quarto problema do dia');
    perform teste('o quarto chamado da mesma pessoa NAO passa', false);
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform teste('o quarto chamado da mesma pessoa nao passa', true);
  end;

  -- Outra pessoa nao e afetada pelo limite da primeira.
  perform public.abrir_chamado_publico('Carlos Alberto', 'carlos@exemplo.com', v_e, 'Meu computador nao liga');
  perform teste('outra pessoa continua conseguindo abrir', true);
end $$;

reset role;
select set_config('app.usuario', '', false);

\echo ''
\echo '  --- chamado publico: todos os testes passaram ---'
\echo ''
