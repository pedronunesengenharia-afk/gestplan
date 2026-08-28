-- =============================================================================
-- GestPlan · o chamado de manutenção, e o acesso que faltava
--
-- Duas peças que a tela de Equipe destapou ao ganhar formulário:
--
--   1 · Cadastrar pessoa não dava acesso. Nada ligava o login de alguém à
--       pessoa cadastrada — só o `primeiro_acesso.sql`, um a um, na mão. Com
--       dez pessoas isso trava toda vez que entra gente nova.
--
--   2 · Ninguém abre chamado. A política de INSERT em `projeto` exige
--       GERENTE_PROJETOS na empresa, e chamado é projeto neste modelo. Quem
--       precisa de manutenção não é gerente — é justamente quem não é.
--
-- As duas são de acesso, e por isso vêm juntas: uma abre a porta certa, a
-- outra deixa passar por ela o que deve passar, e só isso.
-- =============================================================================


-- =============================================================================
-- 1 · O login encontra a pessoa pelo e-mail
--
-- Quando alguém entra por magic link, o Supabase prova que aquele e-mail é
-- dela — é o que o link faz. Então, se existe pessoa ATIVA com aquele e-mail e
-- ainda sem login vinculado, vincular é seguro: quem controla o e-mail já
-- controlaria o acesso de qualquer jeito.
--
-- Não é gatilho em `auth.users` de propósito. Gatilho ali só pega quem entra
-- pela primeira vez, e o caso comum é o contrário — a pessoa já entrou uma
-- vez, viu "login não vinculado", e o cadastro dela é feito depois. A função é
-- chamada pela tela a cada entrada, e é idempotente.
--
-- Duas pessoas com o mesmo e-mail NÃO vinculam nada: no empate, o certo é não
-- adivinhar. O proprietário resolve o duplicado e a pessoa entra na próxima.
-- =============================================================================
create or replace function public.vincular_meu_acesso()
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_claims jsonb;
  v_auth   uuid;
  v_email  text;
  v_pessoa uuid;
  v_quantas int;
begin
  v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  if v_claims is null then
    return null;
  end if;

  v_auth  := (v_claims ->> 'sub')::uuid;
  v_email := lower(nullif(btrim(v_claims ->> 'email'), ''));
  if v_auth is null then
    return null;
  end if;

  -- Já vinculado: nada a fazer, devolve quem é.
  select id into v_pessoa from pessoa where auth_user_id = v_auth;
  if v_pessoa is not null then
    return v_pessoa;
  end if;

  if v_email is null then
    return null;
  end if;

  select count(*) into v_quantas
    from pessoa
   where lower(email) = v_email and auth_user_id is null and ativo;

  if v_quantas <> 1 then
    -- Zero: ninguém cadastrado com esse e-mail — o proprietário cadastra.
    -- Mais de um: empate, e no empate não se adivinha.
    return null;
  end if;

  update pessoa
     set auth_user_id = v_auth
   where lower(email) = v_email and auth_user_id is null and ativo
  returning id into v_pessoa;

  return v_pessoa;
end;
$$;

comment on function public.vincular_meu_acesso() is
  'Liga o login à pessoa cadastrada com o mesmo e-mail, se houver exatamente uma sem vínculo. Chamada pela tela a cada entrada; idempotente.';

revoke all on function public.vincular_meu_acesso() from public;


-- =============================================================================
-- 2 · Qual tipo de projeto recebe chamado — configuração, não código
--
-- A tela não pode saber que "chamado vai para TI": amanhã pode haver uma fila
-- de manutenção predial com o mesmo desenho. Quem recebe está numa linha de
-- `configuracao`, e trocar de fila é trocar essa linha.
--
-- O valor semeado aqui é o tipo TI porque é o que existe hoje e é o que foi
-- pedido. Semear não é fixar: a linha é dado, e dado se edita.
-- =============================================================================
insert into configuracao (chave, valor, descricao)
select 'chamado.tipo_projeto',
       jsonb_build_object('tipo_projeto_id', tp.id, 'codigo', tp.codigo),
       'Tipo de projeto em que um chamado nasce. Trocar aqui muda a fila que recebe.'
  from tipo_projeto tp
 where tp.codigo = 'TI'
on conflict (chave) do nothing;


-- =============================================================================
-- 3 · Abrir chamado
--
-- Cria o projeto no tipo configurado, na fase INICIAL dele, com o solicitante
-- sendo quem chamou. É `security definer` para não precisar afrouxar a política
-- de INSERT de `projeto` — quem abre chamado ganha exatamente isto, e não o
-- direito de criar projeto de qualquer tipo em qualquer empresa.
--
-- A empresa: a que veio no argumento; senão a primeira em que a pessoa tem
-- papel; senão, se a instalação só tem uma empresa ativa, essa. Nada de
-- escolher a esmo entre duas.
--
-- Quem abre precisa ter papel na empresa para DEPOIS enxergar o chamado —
-- `pode_ver_interno` passa por `empresas_visiveis`, que sai de pessoa_papel. A
-- função avisa em vez de criar um chamado que o autor não veria.
-- =============================================================================
create or replace function public.abrir_chamado(
  p_titulo    text,
  p_descricao text default null,
  p_setor     text default null,
  p_empresa   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_pessoa  uuid;
  v_tipo    uuid;
  v_fase    uuid;
  v_empresa uuid;
  v_projeto uuid;
begin
  v_pessoa := app.pessoa_atual();
  if v_pessoa is null then
    raise exception 'Só quem está cadastrado na equipe abre chamado';
  end if;

  if coalesce(btrim(p_titulo), '') = '' then
    raise exception 'O chamado precisa de um título — é por ele que o time de TI reconhece o pedido';
  end if;

  select (valor ->> 'tipo_projeto_id')::uuid into v_tipo
    from configuracao where chave = 'chamado.tipo_projeto';
  if v_tipo is null then
    raise exception 'Nenhum tipo de projeto está configurado para receber chamado (configuracao.chamado.tipo_projeto)';
  end if;

  select id into v_fase from tipo_fase where tipo_projeto_id = v_tipo and inicial;
  if v_fase is null then
    raise exception 'O tipo configurado para chamado não tem fase inicial';
  end if;

  v_empresa := p_empresa;

  if v_empresa is null then
    select pp.empresa_id into v_empresa
      from pessoa_papel pp
     where pp.pessoa_id = v_pessoa
     order by pp.criado_em
     limit 1;
  end if;

  if v_empresa is null then
    select e.id into v_empresa
      from empresa e
     where e.ativo
     limit 2;
    if (select count(*) from empresa where ativo) <> 1 then
      v_empresa := null;
    end if;
  end if;

  if v_empresa is null then
    raise exception 'Não sei em qual empresa abrir o chamado: você não tem papel em nenhuma, e há mais de uma cadastrada';
  end if;

  insert into projeto (nome, descricao, setor, tipo_projeto_id, fase_id, empresa_id, solicitante_id)
  values (btrim(p_titulo), nullif(btrim(coalesce(p_descricao, '')), ''),
          nullif(btrim(coalesce(p_setor, '')), ''), v_tipo, v_fase, v_empresa, v_pessoa)
  returning id into v_projeto;

  return v_projeto;
end;
$$;

comment on function public.abrir_chamado(text, text, text, uuid) is
  'Abre um chamado: cria projeto no tipo de configuracao.chamado.tipo_projeto, na fase inicial, com solicitante = quem chamou. Existe para nao afrouxar a politica de INSERT de projeto.';

revoke all on function public.abrir_chamado(text, text, text, uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.vincular_meu_acesso() to authenticated';
    execute 'grant execute on function public.abrir_chamado(text, text, text, uuid) to authenticated';
  end if;
end $$;
