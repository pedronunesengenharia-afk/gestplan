-- =============================================================================
-- GestPlan · o chamado que se abre sem entrar no sistema
--
-- Quem tem a impressora parada não tem login, e não deveria precisar de um
-- para pedir socorro. A tela pública pede três coisas — quem é, de qual
-- empresa, e qual o problema — e o pedido cai na mesma fila que o time de TI
-- já acompanha.
--
-- ISTO ABRE UMA PORTA ANÔNIMA DE ESCRITA. A chave `anon` do Supabase é pública
-- por natureza: está no JavaScript que qualquer um baixa. Então a porta precisa
-- ser estreita, e ela é:
--
--   · a ÚNICA coisa que o anônimo pode fazer é chamar duas funções. Nenhuma
--     política nova dá a ele leitura ou escrita em tabela alguma — ele não lê
--     projeto, não lê pessoa, não lê os chamados dos outros;
--   · a função cria projeto só no tipo configurado e só na fase inicial dele;
--   · há limite por e-mail (3 por hora) e limite geral (30 por hora);
--   · campo obrigatório e tamanho máximo são conferidos aqui, não na tela.
--
-- O que estes limites NÃO cobrem: alguém decidido, variando o e-mail, ainda
-- abre 30 chamados por hora. Fechar isso pede captcha (Turnstile na frente do
-- formulário) ou limite por IP numa Edge Function — e os dois são trabalho de
-- outra natureza. Está anotado, e o limite geral existe justamente para que o
-- estrago de um dia ruim caiba numa manhã de limpeza.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Quem abriu, quando não há pessoa para apontar
--
-- Tabela própria, e não colunas em `projeto`, pelo mesmo motivo que
-- `projeto_valor` e `etapa_valor` existem: o que é de um caso não engorda o
-- núcleo. Aqui há ainda outro motivo — é dado pessoal vindo de fora, e dado
-- de fora fica na sua própria caixa, com a sua própria porta.
-- -----------------------------------------------------------------------------
create table if not exists chamado_avulso (
  projeto_id uuid primary key references projeto(id) on delete cascade,
  nome       text not null check (btrim(nome) <> ''),
  email      text not null check (position('@' in email) > 1),
  fone       text,
  origem     text not null default 'FORMULARIO_PUBLICO',
  criado_em  timestamptz not null default now()
);

comment on table chamado_avulso is
  'Quem abriu um chamado sem ter login. Uma linha por projeto aberto pelo formulário público.';

create index if not exists chamado_avulso_email_idx on chamado_avulso (lower(email), criado_em desc);
create index if not exists chamado_avulso_criado_idx on chamado_avulso (criado_em desc);

alter table chamado_avulso enable row level security;
alter table chamado_avulso force row level security;

-- Lê quem alcança o projeto por dentro. Escrita não tem política nenhuma: a
-- única forma de gravar aqui é pela função abaixo, que roda com os direitos do
-- banco. Tabela sem política de escrita é tabela que ninguém escreve — e é
-- assim que tem de ser.
drop policy if exists chamado_avulso_le on chamado_avulso;
create policy chamado_avulso_le on chamado_avulso for select
  using (app.pode_ver_interno(projeto_id));


-- -----------------------------------------------------------------------------
-- As empresas que o formulário público oferece
--
-- O anônimo não lê a tabela `empresa` — ele recebe só id e nome das ativas,
-- por uma função. Nome de empresa não é segredo; CNPJ, cidade e o resto do
-- cadastro continuam do lado de dentro.
-- -----------------------------------------------------------------------------
create or replace function public.empresas_para_chamado()
returns table (id uuid, nome text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.nome from empresa e where e.ativo order by e.nome
$$;

comment on function public.empresas_para_chamado() is
  'Id e nome das empresas ativas, para o formulario publico de chamado. Nao expoe o resto do cadastro.';


-- -----------------------------------------------------------------------------
-- Abrir chamado sem login
-- -----------------------------------------------------------------------------
create or replace function public.abrir_chamado_publico(
  p_nome      text,
  p_email     text,
  p_empresa   uuid,
  p_titulo    text,
  p_descricao text default null,
  p_setor     text default null,
  p_fone      text default null
)
returns text
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_tipo    uuid;
  v_fase    uuid;
  v_projeto uuid;
  v_codigo  text;
  v_nome    text := btrim(coalesce(p_nome, ''));
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_titulo  text := btrim(coalesce(p_titulo, ''));
begin
  -- --- quem é -------------------------------------------------------------
  if length(v_nome) < 3 or length(v_nome) > 120 then
    raise exception 'Diga o seu nome, para o time saber com quem falar';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' or length(v_email) > 160 then
    raise exception 'Preciso de um e-mail válido para responder o chamado';
  end if;

  -- --- de qual empresa ----------------------------------------------------
  if p_empresa is null or not exists (select 1 from empresa where id = p_empresa and ativo) then
    raise exception 'Escolha a empresa onde o problema está acontecendo';
  end if;

  -- --- qual o problema ----------------------------------------------------
  if length(v_titulo) < 5 or length(v_titulo) > 200 then
    raise exception 'Descreva o problema numa frase — entre 5 e 200 caracteres';
  end if;

  if length(coalesce(p_descricao, '')) > 4000 then
    raise exception 'Os detalhes passaram de 4000 caracteres';
  end if;

  -- --- os limites ---------------------------------------------------------
  if (select count(*) from chamado_avulso
       where lower(email) = v_email and criado_em > now() - interval '1 hour') >= 3 then
    raise exception 'Você já abriu três chamados na última hora. Espere um pouco, ou responda no chamado que já está aberto.';
  end if;

  if (select count(*) from chamado_avulso
       where criado_em > now() - interval '1 hour') >= 30 then
    raise exception 'Muitos chamados abertos agora. Tente de novo em alguns minutos.';
  end if;

  -- --- para qual fila -----------------------------------------------------
  select (valor ->> 'tipo_projeto_id')::uuid into v_tipo
    from configuracao where chave = 'chamado.tipo_projeto';
  if v_tipo is null then
    raise exception 'Nenhuma fila configurada para receber chamado';
  end if;

  select id into v_fase from tipo_fase where tipo_projeto_id = v_tipo and inicial;
  if v_fase is null then
    raise exception 'A fila configurada não tem fase inicial';
  end if;

  -- O solicitante fica NULO de propósito: quem abriu não é pessoa do sistema.
  -- Quem é está em chamado_avulso, e é lá que o time olha para responder.
  insert into projeto (nome, descricao, setor, tipo_projeto_id, fase_id, empresa_id)
  values (v_titulo,
          nullif(btrim(coalesce(p_descricao, '')), ''),
          nullif(btrim(coalesce(p_setor, '')), ''),
          v_tipo, v_fase, p_empresa)
  returning id, codigo into v_projeto, v_codigo;

  insert into chamado_avulso (projeto_id, nome, email, fone)
  values (v_projeto, v_nome, v_email, nullif(btrim(coalesce(p_fone, '')), ''));

  -- Devolve o código, e só ele: é o que a pessoa guarda para cobrar depois, e
  -- é tudo que ela precisa saber. O id interno não sai daqui.
  return v_codigo;
end;
$$;

comment on function public.abrir_chamado_publico(text, text, uuid, text, text, text, text) is
  'Abre chamado sem login. Cria projeto na fila configurada e guarda quem pediu em chamado_avulso. Limite: 3 por e-mail por hora, 30 no total por hora.';


-- -----------------------------------------------------------------------------
-- As permissões: só as duas funções, e nada mais
-- -----------------------------------------------------------------------------
revoke all on function public.empresas_para_chamado() from public;
revoke all on function public.abrir_chamado_publico(text, text, uuid, text, text, text, text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.empresas_para_chamado() to anon';
    execute 'grant execute on function public.abrir_chamado_publico(text, text, uuid, text, text, text, text) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.empresas_para_chamado() to authenticated';
    execute 'grant execute on function public.abrir_chamado_publico(text, text, uuid, text, text, text, text) to authenticated';
    execute 'grant select on chamado_avulso to authenticated';
  end if;
end $$;
