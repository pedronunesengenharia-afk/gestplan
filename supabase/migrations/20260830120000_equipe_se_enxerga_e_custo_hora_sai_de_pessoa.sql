-- =============================================================================
-- GestPlan · a equipe volta a se enxergar, e o custo-hora ganha porta própria
--
-- DUAS MUDANÇAS QUE PRECISAM ANDAR JUNTAS. Separá-las abriria um vazamento
-- entre uma migração e a outra.
--
-- 1 · `pessoa_le` não fazia o que o próprio comentário dela prometia
--
--     A política dizia "o resto da equipe vê a lista interna" e entregava
--     "cada um vê a si mesmo". O motivo é a RLS se aplicando dentro da RLS:
--
--       or exists (select 1 from pessoa_papel pp
--                   where pp.pessoa_id = pessoa.id
--                     and pp.empresa_id in (select app.empresas_visiveis()))
--
--     esse `exists` lê `pessoa_papel`, que tem política própria —
--     `pessoa_id = app.pessoa_atual() or app.é_proprietario()`. Para quem não
--     é proprietário, o subselect só pode devolver a linha dele mesmo, e a
--     condição inteira desaba para `id = app.pessoa_atual()`.
--
--     Medido em banco de teste: o gerente enxergava UMA pessoa. Passou dois
--     meses despercebido porque só existe um usuário, e ele é o proprietário
--     — para quem `app.é_proprietario()` atalha antes do `exists`.
--
--     Com dez pessoas dentro isso apareceria em cinco telas de uma vez:
--     Equipe com uma linha, coluna Responsável em branco, ninguém para
--     mencionar em comentário, nenhum alocável na equipe do projeto, e a
--     capacidade do painel sempre vazia — porque `vw_capacidade` junta com
--     `pessoa`.
--
--     A correção segue o padrão que o schema já usa para sair desse laço:
--     uma função `security definer`, como `app.empresas_visiveis()` e
--     `app.tem_papel()`, que responde a pergunta sem passar pela RLS.
--
-- 2 · `pessoa.custo_hora` tinha de sair de `pessoa` ANTES de a lista abrir
--
--     Enquanto cada um só se enxergava, o custo-hora de todo mundo estava
--     protegido por acidente. Abrir a lista sem mover a coluna entregaria o
--     custo-hora da equipe inteira para a equipe inteira — consertar um
--     defeito criando um vazamento.
--
--     RLS é por linha, não por coluna, e uma view não amplia acesso (toda view
--     aqui é `security_invoker`). Então a saída é a que o projeto já usa duas
--     vezes: dinheiro em tabela separada, com política própria. `projeto_valor`
--     para o projeto, `etapa_valor` para a EAP, `pessoa_custo` para a pessoa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · O custo-hora muda de casa
-- -----------------------------------------------------------------------------
create table if not exists pessoa_custo (
  pessoa_id     uuid primary key references pessoa(id) on delete cascade,
  custo_hora    numeric(12,2) not null default 0 check (custo_hora >= 0),
  atualizado_em timestamptz not null default now()
);

comment on table pessoa_custo is
  'Custo-hora da pessoa. Fica fora de `pessoa` porque a lista de pessoas é '
  'visível para a equipe interna e o custo-hora não é. Linha ausente vale zero.';

-- Leva o que já existe. Só o que não é zero: linha ausente vale zero, e uma
-- tabela esparsa diz mais do que uma cheia de zeros.
insert into pessoa_custo (pessoa_id, custo_hora)
select id, custo_hora from pessoa where custo_hora <> 0
on conflict (pessoa_id) do nothing;

alter table pessoa drop column if exists custo_hora;

alter table pessoa_custo enable row level security;
alter table pessoa_custo force row level security;

-- Quem define quanto alguém custa é quem cadastra a pessoa. Não há papel
-- intermediário aqui de propósito: `pode_ver_valores` é do dinheiro DO
-- PROJETO, e custo de pessoa não é projeto — é folha, que este sistema
-- deliberadamente não gerencia.
create policy pessoa_custo_proprietario on pessoa_custo for all
  using (app.é_proprietario()) with check (app.é_proprietario());

-- -----------------------------------------------------------------------------
-- 2 · A pergunta que a política precisava fazer sem esbarrar na RLS
-- -----------------------------------------------------------------------------
-- EXTERNO fica de fora pelo mesmo motivo de `app.empresas_visiveis()`: o papel
-- do fornecedor é administrativo, diz de quem ele é fornecedor. Ele não é
-- equipe, não aparece como responsável e não deve entrar na lista interna.
create or replace function app.é_da_minha_equipe(p_pessoa uuid)
returns boolean language sql stable security definer
set search_path = public, app as $$
  select
    -- Sem ninguém identificado não existe "minha equipe". A guarda vem antes de
    -- tudo porque o ramo do proprietário, sozinho, responderia verdadeiro para
    -- uma chamada anônima e entregaria a linha do dono para quem não entrou.
    app.pessoa_atual() is not null
    and (
    -- O proprietário é equipe mesmo sem linha em pessoa_papel: ele é quem
    -- cadastra os papéis, e costuma ser gerente de projeto.
    exists (select 1 from pessoa where id = p_pessoa and proprietario)
    or exists (
      select 1 from pessoa_papel pp
       where pp.pessoa_id = p_pessoa
         and pp.papel <> 'EXTERNO'
         and pp.empresa_id in (select app.empresas_visiveis())));
$$;

comment on function app.é_da_minha_equipe(uuid) is
  'Esta pessoa é da equipe interna que eu alcanço? SECURITY DEFINER de '
  'propósito: consultada de dentro da política de `pessoa`, uma leitura comum '
  'de `pessoa_papel` traria só a própria linha e a política se anularia.';

drop policy if exists pessoa_le on pessoa;

create policy pessoa_le on pessoa for select
  using (
    id = app.pessoa_atual()
    or (not app.é_externo() and app.é_da_minha_equipe(id))
  );

comment on policy pessoa_le on pessoa is
  'Cada um se enxerga sempre. Quem é interno enxerga a equipe interna das '
  'empresas que alcança — e o custo-hora não mora mais aqui, mora em '
  'pessoa_custo.';
