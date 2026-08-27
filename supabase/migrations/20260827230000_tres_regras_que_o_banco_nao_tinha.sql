-- =============================================================================
-- GestPlan · três regras que a tela cumpria e o banco não
--
-- Achadas ao construir os itens 4, 9 e 10 — cada uma medida contra o banco,
-- não deduzida. As três têm a mesma forma: a tela faz o certo, e quem chamar
-- a API direto passa por cima. Tela é conveniência; a regra é a política.
--
--   1 · ESTRUTURA lia o orçamento item a item: 316 etapas, R$ 3.821.836,74,
--       enquanto projeto_valor corretamente devolvia zero linhas.
--   2 · Qualquer editor de projeto assinava parecer de qualquer setor.
--   3 · Gerente alterava e apagava comentário escrito por outra pessoa.
--
-- A terceira é a pior. Vazamento de número se corrige; palavra trocada na
-- boca de alguém, não.
-- =============================================================================


-- =============================================================================
-- 1 · O dinheiro da etapa vai para trás da mesma porta do resto
--
-- A política de `etapa` é pode_ver_interno, e tinha de ser: a estrutura da EAP
-- — código, nome, hierarquia, peso, avanço — é do projeto, e quem executa
-- precisa dela. Quantidade e preço não são.
--
-- RLS é por LINHA, não por coluna, então não há política que esconda só o
-- preço. Duas saídas existiam:
--
--   a) uma view que anula as colunas de dinheiro, com REVOKE na tabela. Mas
--      view com security_invoker precisa que o chamador tenha SELECT na
--      tabela — o REVOKE mataria a própria view. Só funcionaria abrindo mão
--      do security_invoker, que é justamente a regra que impede view de
--      vazar. Uma exceção à regra, e lista de exceção apodrece.
--
--   b) separar o dinheiro numa tabela própria, como projeto_valor já faz.
--      Mesmo desenho, mesma porta, nenhuma exceção.
--
-- É (b). `etapa` fica com a estrutura; `etapa_valor` fica com o dinheiro.
-- =============================================================================

create table if not exists etapa_valor (
  etapa_id       uuid primary key references etapa(id) on delete cascade,
  projeto_id     uuid not null references projeto(id) on delete cascade,
  unidade        text,
  quantidade     numeric(14,4) not null default 0,
  preco_unitario numeric(14,4) not null default 0,
  valor          numeric(16,4) generated always as (quantidade * preco_unitario) stored,
  categoria_id   uuid references categoria_custo(id) on delete set null,
  fornecedor_id  uuid references fornecedor(id)      on delete set null,
  a_confirmar    boolean not null default false,
  atualizado_em  timestamptz not null default now()
);

comment on table etapa_valor is
  'Dinheiro da etapa, isolado para a RLS poder negá-lo por inteiro — mesmo desenho de projeto_valor. projeto_id fica aqui denormalizado para a política não precisar de join.';

create index if not exists etapa_valor_projeto_idx on etapa_valor (projeto_id);

-- Muda o que já existe para a tabela nova.
insert into etapa_valor (etapa_id, projeto_id, unidade, quantidade, preco_unitario,
                         categoria_id, fornecedor_id, a_confirmar)
select e.id, e.projeto_id, e.unidade, e.quantidade, e.preco_unitario,
       e.categoria_id, e.fornecedor_id, e.a_confirmar
  from etapa e
on conflict (etapa_id) do nothing;

-- Os totais passam a somar da tabela nova.
create or replace function app.atualizar_valores_do_projeto(p_projeto uuid)
returns void
language sql
as $$
  update projeto_valor v
     set valor_orcado    = coalesce((select sum(ev.valor)
                                       from etapa_valor ev
                                       join etapa e on e.id = ev.etapa_id
                                      where ev.projeto_id = p_projeto and e.folha), 0),
         valor_realizado = coalesce((select sum(valor) from custo
                                      where projeto_id = p_projeto
                                        and status_pagamento <> 'CANCELADO'), 0),
         valor_pago      = coalesce((select sum(valor) from custo
                                      where projeto_id = p_projeto
                                        and status_pagamento = 'PAGO'), 0),
         atualizado_em   = now()
   where v.projeto_id = p_projeto;
$$;

-- Etapa nova nasce com a linha de valor, como projeto nasce com projeto_valor.
create or replace function app.criar_valor_da_etapa()
returns trigger language plpgsql as $$
begin
  insert into etapa_valor (etapa_id, projeto_id) values (new.id, new.projeto_id)
  on conflict (etapa_id) do nothing;
  return new;
end;
$$;

drop trigger if exists etapa_valor_inicial on etapa;
create trigger etapa_valor_inicial
  after insert on etapa
  for each row execute function app.criar_valor_da_etapa();

drop trigger if exists etapa_valor_totais on etapa_valor;
create trigger etapa_valor_totais
  after insert or update or delete on etapa_valor
  for each row execute function app.disparar_totais();

-- As colunas saem de `etapa`. É o passo que fecha o vazamento: enquanto elas
-- existirem ali, a política de linha continua entregando o preço.
-- `valor` é coluna gerada a partir das outras duas: sai primeiro, senão o
-- Postgres recusa o drop de quem ela depende.
alter table etapa drop column if exists valor;
alter table etapa drop column if exists quantidade;
alter table etapa drop column if exists preco_unitario;
alter table etapa drop column if exists categoria_id;
alter table etapa drop column if exists fornecedor_id;
alter table etapa drop column if exists a_confirmar;
alter table etapa drop column if exists unidade;

alter table etapa_valor enable row level security;
alter table etapa_valor force row level security;

create policy etapa_valor_le on etapa_valor for select
  using (app.pode_ver_valores(projeto_id));
create policy etapa_valor_escreve on etapa_valor for all
  using (app.pode_ver_valores(projeto_id))
  with check (app.pode_ver_valores(projeto_id));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on etapa_valor to authenticated';
  end if;
end $$;

-- A EAP com o dinheiro ao lado, para quem tem alcance. Quem não tem recebe a
-- linha com as colunas vazias — igual à carteira.
create or replace view vw_etapa with (security_invoker = true) as
select
  e.id, e.projeto_id, e.pai_id, e.codigo, e.nome, e.descricao,
  e.nivel, e.ordem, e.folha, e.peso_percentual, e.percentual_concluido,
  ev.unidade, ev.quantidade, ev.preco_unitario, ev.valor,
  ev.categoria_id, ev.fornecedor_id, ev.a_confirmar,
  e.criado_em, e.atualizado_em
from etapa e
left join etapa_valor ev on ev.etapa_id = e.id;

comment on view vw_etapa is
  'A EAP com o dinheiro ao lado. Colunas de valor vêm nulas para quem não tem alcance financeiro — a etapa aparece, o preço não.';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on vw_etapa to authenticated';
  end if;
end $$;


-- A regra "não sai da fase sem orçamento" olhava `etapa.valor`, que acabou de
-- mudar de casa. Sem isto, a fase Viabilidade passaria a liberar a saída de
-- qualquer projeto — uma trava que some sem ninguém perceber, que é a pior
-- forma de uma regra morrer.
create or replace function app.exigir_pareceres()
returns trigger
language plpgsql
as $$
declare
  f          record;
  v_faltando text[];
  v_reprovou text;
begin
  if new.fase_id is not distinct from old.fase_id then
    return new;
  end if;

  select * into f from tipo_fase where id = old.fase_id;

  if (select categoria from tipo_fase where id = new.fase_id) = 'ARQUIVADO' then
    return new;
  end if;

  if array_length(f.exige_setores, 1) > 0 then
    select array_agg(s) into v_faltando
      from unnest(f.exige_setores) s
     where not exists (
       select 1 from aprovacao a
        where a.projeto_id = new.id and a.fase_id = old.fase_id
          and a.setor_codigo = s and a.decisao in ('APROVADO','CIENTE'));

    if v_faltando is not null then
      raise exception 'Falta parecer de: % (fase %)',
        array_to_string(v_faltando, ', '), f.nome;
    end if;
  end if;

  select setor_codigo into v_reprovou
    from aprovacao
   where projeto_id = new.id and fase_id = old.fase_id and decisao = 'REPROVADO'
   limit 1;
  if v_reprovou is not null then
    raise exception 'Projeto reprovado por % — arquive em vez de avançar', v_reprovou;
  end if;

  if f.exige_orcamento and not exists (
       select 1 from etapa e
         join etapa_valor ev on ev.etapa_id = e.id
        where e.projeto_id = new.id and e.folha and ev.valor > 0) then
    raise exception 'A fase % exige orçamento com pelo menos um item valorado', f.nome;
  end if;

  if f.exige_cronograma and exists (
       select 1 from tarefa
        where projeto_id = new.id
          and status not in ('CANCELADA')
          and (data_inicio_prev is null or data_fim_prev is null)) then
    raise exception 'A fase % exige todas as tarefas com data prevista', f.nome;
  end if;

  return new;
end;
$$;


-- =============================================================================
-- 2 · Parecer é de quem tem o papel de assinar
--
-- `aprovacao_escreve` pedia pode_editar_projeto — quer dizer, o gerente que
-- escreveu o projeto assinava o parecer do Financeiro sobre o próprio projeto.
-- Medido: uma linha, sem reclamação.
--
-- Fica de pé uma limitação conhecida: não existe vínculo entre pessoa e setor,
-- então quem é AVALIADOR pode assinar por qualquer setor. Amarrar isso pede um
-- `pessoa_setor` — decisão de modelo, não de política, e por isso não entra
-- aqui. O que entra é a metade que não depende de decisão nenhuma: quem não é
-- avaliador não assina.
-- =============================================================================

create or replace function app.pode_assinar(p_projeto uuid)
returns boolean language sql stable security definer
set search_path = public, app as $$
  select app.é_proprietario()
      or exists (
           select 1
             from projeto p
             join pessoa_papel pp on pp.pessoa_id = app.pessoa_atual()
            where p.id = p_projeto
              and (pp.empresa_id = p.empresa_id
                or pp.empresa_id in (select empresa_id from projeto_empresa where projeto_id = p.id))
              and pp.papel = 'AVALIADOR');
$$;

comment on function app.pode_assinar(uuid) is
  'Quem pode registrar parecer num projeto. Limitação conhecida: não amarra o avaliador a um setor — falta um pessoa_setor no modelo.';

drop policy if exists aprovacao_escreve on aprovacao;
create policy aprovacao_escreve on aprovacao for all
  using (app.pode_assinar(projeto_id))
  with check (app.pode_assinar(projeto_id));


-- =============================================================================
-- 3 · Comentário é de quem escreveu
--
-- `comentario_escreve` era FOR ALL com pode_editar_projeto. Políticas
-- permissivas se SOMAM: a `comentario_edita_o_seu`, que parecia restringir,
-- só ampliava. Medido: o gerente alterou e apagou o comentário da ESTRUTURA.
--
-- Some a política larga. Ficam três, cada uma dizendo uma coisa só.
-- =============================================================================

drop policy if exists comentario_escreve       on comentario;
drop policy if exists comentario_proprio       on comentario;
drop policy if exists comentario_edita_o_seu   on comentario;

-- Escrever: qualquer um que alcance o projeto, e sempre em nome próprio.
create policy comentario_escreve on comentario for insert
  with check (pessoa_id = app.pessoa_atual() and app.pode_ver_interno(projeto_id));

-- Editar: só o autor. Nem o gerente, nem o proprietário.
create policy comentario_edita on comentario for update
  using (pessoa_id = app.pessoa_atual())
  with check (pessoa_id = app.pessoa_atual());

-- Apagar: o autor, ou o proprietário — que precisa poder remover algo
-- ofensivo. O proprietário apaga; alterar, ninguém altera.
create policy comentario_apaga on comentario for delete
  using (pessoa_id = app.pessoa_atual() or app.é_proprietario());


-- =============================================================================
-- 4 · A tela pergunta ao banco o que ela pode fazer
--
-- Sem isto, saber se o botão de editar aparece exigiria reescrever
-- app.pode_editar_projeto em TypeScript — e ela contém `tp.codigo = 'TI'`,
-- que é exatamente o `if` por nome de tipo que a regra de ouro proíbe.
--
-- Ficam em `public` porque o PostgREST só enxerga `public`, e existem para ser
-- chamadas pela tela. As de `app` continuam fora do alcance da API.
-- =============================================================================

create or replace function public.posso_editar_projeto(p_projeto uuid)
returns boolean language sql stable as $$ select app.pode_editar_projeto(p_projeto) $$;

create or replace function public.posso_ver_valores(p_projeto uuid)
returns boolean language sql stable as $$ select app.pode_ver_valores(p_projeto) $$;

create or replace function public.posso_assinar(p_projeto uuid)
returns boolean language sql stable as $$ select app.pode_assinar(p_projeto) $$;

comment on function public.posso_editar_projeto(uuid) is
  'Para a tela decidir o que oferecer, sem reescrever a regra em TypeScript.';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.posso_editar_projeto(uuid) to authenticated';
    execute 'grant execute on function public.posso_ver_valores(uuid)   to authenticated';
    execute 'grant execute on function public.posso_assinar(uuid)       to authenticated';
  end if;
end $$;
