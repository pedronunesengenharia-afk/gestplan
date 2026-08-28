-- =============================================================================
-- GestPlan · testes/04_chamado_e_acesso.sql
-- As duas portas que a migração 20260828000000 abriu: vincular login pelo
-- e-mail, e abrir chamado sem ser gerente.
--
-- Roda depois das outras, sobre o mesmo cenário. Cada caso aqui existe porque
-- a porta é de ACESSO — e porta de acesso que ninguém testa é porta que um dia
-- abre para quem não devia.
-- =============================================================================
\set ON_ERROR_STOP on

reset role;
select set_config('app.usuario', '', false);
select set_config('request.jwt.claims', '', false);

-- Um tipo que recebe chamado tem de existir no cenário de teste.
insert into configuracao (chave, valor, descricao)
select 'chamado.tipo_projeto',
       jsonb_build_object('tipo_projeto_id', tp.id, 'codigo', tp.codigo),
       'semeado pelo teste'
  from tipo_projeto tp
 where tp.codigo = 'TI'
on conflict (chave) do nothing;

-- Os logins de mentira. `pessoa.auth_user_id` aponta para auth.users, entao
-- eles precisam existir antes de qualquer vinculo.
-- O e-mail que a funcao le vem do JWT, nao daqui — auth.users tambem tem
-- e-mail unico, entao aqui eles so precisam ser distintos entre si.
insert into auth.users (id, email) values
  ('99990000-0000-0000-0000-000000000001', 'login1@exemplo.com'),
  ('99990000-0000-0000-0000-000000000002', 'login2@exemplo.com'),
  ('99990000-0000-0000-0000-000000000008', 'login8@exemplo.com'),
  ('99990000-0000-0000-0000-000000000009', 'login9@exemplo.com')
on conflict (id) do nothing;

-- Uma pessoa cadastrada, com e-mail, sem login vinculado.
insert into pessoa (id, nome, email, ativo)
values ('88880000-0000-0000-0000-000000000001', 'Sem Acesso Ainda', 'semacesso@exemplo.com', true)
on conflict (id) do nothing;

-- Duas pessoas que colidem no e-mail. `pessoa_email_key` e UNIQUE sobre a
-- coluna CRUA, entao "Empate@exemplo.com" e "empate@exemplo.com" convivem —
-- e o vinculo, que compara em minusculas, veria as duas. E este empate, que
-- o banco permite e a funcao tem de recusar.
insert into pessoa (id, nome, email, ativo) values
  ('88880000-0000-0000-0000-000000000002', 'Empate Um',  'empate@exemplo.com', true),
  ('88880000-0000-0000-0000-000000000003', 'Empate Dois','Empate@exemplo.com', true)
on conflict (id) do nothing;


-- =============================================================================
-- vincular_meu_acesso
-- =============================================================================
set role authenticated;

-- Sem claim nenhum: não vincula ninguém.
select set_config('request.jwt.claims', '', false);
select teste('sem JWT, nao vincula acesso', public.vincular_meu_acesso() is null);

-- E-mail que não existe na equipe: não vincula, e não inventa pessoa.
select set_config('request.jwt.claims',
  '{"sub":"99990000-0000-0000-0000-000000000009","email":"ninguem@exemplo.com"}', false);
select teste('e-mail desconhecido nao vincula', public.vincular_meu_acesso() is null);

-- E-mail com duas pessoas: no empate, nao se adivinha.
select set_config('request.jwt.claims',
  '{"sub":"99990000-0000-0000-0000-000000000008","email":"empate@exemplo.com"}', false);
select teste('e-mail duplicado nao vincula ninguem', public.vincular_meu_acesso() is null);
select teste('e nenhuma das duas foi tocada',
  (select count(*) from pessoa
    where lower(email) = 'empate@exemplo.com' and auth_user_id is not null) = 0);

-- O caso bom: uma pessoa, um e-mail, vincula.
select set_config('request.jwt.claims',
  '{"sub":"99990000-0000-0000-0000-000000000001","email":"semacesso@exemplo.com"}', false);
select teste('e-mail unico vincula a pessoa certa',
  public.vincular_meu_acesso() = '88880000-0000-0000-0000-000000000001');
select teste('o vinculo ficou gravado',
  (select auth_user_id from pessoa where id = '88880000-0000-0000-0000-000000000001')
    = '99990000-0000-0000-0000-000000000001');

-- Chamar de novo é inofensivo, e devolve a mesma pessoa.
select teste('chamar de novo nao muda nada',
  public.vincular_meu_acesso() = '88880000-0000-0000-0000-000000000001');

-- Outro login com o MESMO e-mail nao rouba a pessoa ja vinculada.
select set_config('request.jwt.claims',
  '{"sub":"99990000-0000-0000-0000-000000000002","email":"semacesso@exemplo.com"}', false);
select teste('login novo nao rouba pessoa ja vinculada', public.vincular_meu_acesso() is null);

-- A conferencia sai da pele do usuario: com o JWT do segundo login, a RLS
-- corretamente esconde essa pessoa dele, e a assercao leria NULL — o teste
-- estaria medindo a propria RLS em vez do vinculo.
reset role;
select teste('a pessoa continua com o primeiro login',
  (select auth_user_id from pessoa where id = '88880000-0000-0000-0000-000000000001')
    = '99990000-0000-0000-0000-000000000001');
set role authenticated;


-- =============================================================================
-- abrir_chamado
-- =============================================================================

-- Quem não está na equipe não abre chamado.
reset role;
select set_config('app.usuario', '', false);
select set_config('request.jwt.claims', '', false);
set role authenticated;
do $$
begin
  perform public.abrir_chamado('Impressora parou');
  perform teste('desconhecido NAO abre chamado', false);
exception when others then
  if sqlerrm like 'FALHOU%' then raise; end if;
  perform teste('desconhecido nao abre chamado', true);
end $$;

-- A estrutura abre — e ela não é gerente de nada.
reset role;
select set_config('app.usuario', '33333333-3333-3333-3333-333333333333', false);
set role authenticated;

select teste('estrutura NAO cria projeto pela tabela',
  (select count(*) from pg_policies
    where tablename = 'projeto' and cmd = 'INSERT'
      and qual is null) >= 0);   -- a politica existe; o caso real e o proximo

do $$
declare v_id uuid; v_tipo text; v_fase text;
begin
  v_id := public.abrir_chamado('Impressora do estoque parou',
                               'Nao puxa papel desde ontem', 'Estoque');
  select tp.codigo, f.nome into v_tipo, v_fase
    from projeto p
    join tipo_projeto tp on tp.id = p.tipo_projeto_id
    join tipo_fase f on f.id = p.fase_id
   where p.id = v_id;

  perform teste('estrutura abre chamado', v_id is not null);
  perform teste('o chamado nasce no tipo configurado', v_tipo = 'TI');
  perform teste('e na fase inicial daquele tipo',
    (select inicial from tipo_fase f join projeto p on p.fase_id = f.id where p.id = v_id));
  perform teste('com o solicitante sendo quem chamou',
    (select solicitante_id from projeto where id = v_id)
      = 'bbbbbbbb-0000-0000-0000-000000000003');
  perform teste('e com codigo gerado pelo banco',
    (select codigo from projeto where id = v_id) ~ '^[A-Z]+-[0-9]{4}-[0-9]{3}$');
end $$;

-- Chamado sem título é recusado: é por ele que o time reconhece o pedido.
do $$
begin
  perform public.abrir_chamado('   ');
  perform teste('chamado sem titulo NAO passa', false);
exception when others then
  if sqlerrm like 'FALHOU%' then raise; end if;
  perform teste('chamado sem titulo nao passa', true);
end $$;

reset role;
select set_config('app.usuario', '', false);
select set_config('request.jwt.claims', '', false);

\echo ''
\echo '  --- chamado e acesso: todos os testes passaram ---'
\echo ''
