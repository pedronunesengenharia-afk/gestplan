-- =============================================================================
-- GestPlan · duas coisas que o item 3 destapou
--
-- Ambas foram levantadas na entrega do item 3, e ambas pararam no lugar certo:
-- uma pedia função no banco, a outra virou caminho de tela para uma pendência
-- que até então era teórica.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1 · Trocar o rateio numa transação só
--
-- Apagar e regravar em duas requisições do PostgREST são DUAS transações. Se a
-- segunda falha, o projeto fica sem rateio nenhum — que o modelo lê como 100%
-- da empresa principal. Ou seja: a falha não dá erro, dá um número errado. É a
-- pior espécie.
--
-- Aqui as duas metades ficam na mesma transação, e a conferência dos 100% é
-- antecipada para dentro dela: ou o rateio novo entra inteiro, ou o antigo
-- continua como estava.
--
-- Mora em `public` de propósito, contrariando a regra de que função fica em
-- `app`: o PostgREST só enxerga `public`, e esta função existe para ser
-- chamada pela tela. A regra continua valendo para as de autorização, que
-- ninguém de fora deve poder chamar.
-- -----------------------------------------------------------------------------
create or replace function public.definir_rateio(p_projeto uuid, p_linhas jsonb)
returns void
language plpgsql
as $$
declare
  v_total numeric;
begin
  if not app.pode_editar_projeto(p_projeto) then
    raise exception 'Sem permissão para alterar o rateio deste projeto';
  end if;

  if jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'O rateio precisa vir como lista';
  end if;

  -- Lista vazia é decisão válida: significa 100% da empresa principal.
  delete from projeto_empresa where projeto_id = p_projeto;

  if jsonb_array_length(p_linhas) > 0 then
    select round(sum((x->>'percentual')::numeric), 3) into v_total
      from jsonb_array_elements(p_linhas) x;

    if v_total <> 100 then
      raise exception 'O rateio soma %, e tem de fechar 100 por cento', v_total;
    end if;

    insert into projeto_empresa (projeto_id, empresa_id, percentual, observacao)
    select p_projeto,
           (x->>'empresa_id')::uuid,
           (x->>'percentual')::numeric,
           nullif(x->>'observacao', '')
      from jsonb_array_elements(p_linhas) x;
  end if;

  -- Antecipa a constraint adiada para dentro desta transação: assim o erro
  -- chega à tela como erro desta chamada, e não como falha de commit solta.
  set constraints all immediate;
end;
$$;

comment on function public.definir_rateio(uuid, jsonb) is
  'Troca o rateio inteiro de um projeto numa transação só. Lista vazia = 100% da empresa principal. Chamada pela tela via RPC.';

revoke all on function public.definir_rateio(uuid, jsonb) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.definir_rateio(uuid, jsonb) to authenticated';
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 2 · O formulário lê o projeto sem os campos de dinheiro
--
-- `vw_projeto` já removia as chaves MOEDA de `projeto.campos` para quem não
-- tem alcance financeiro. Mas o formulário de edição precisa de colunas que a
-- carteira não carrega — descrição, objetivo, problema, benefícios, local — e
-- por isso passou a ler a TABELA direto. Aí a proteção não vale.
--
-- Enquanto o front só lia a carteira, essa brecha era teórica. Agora ela tem
-- caminho de tela: quem só pode ver o projeto, e não o dinheiro dele, abriria
-- o formulário com a economia mensal e a receita prevista à vista.
--
-- Esta view dá ao formulário as colunas que faltavam, com o mesmo filtro da
-- carteira. O front passa a ler daqui; ninguém precisa mais ler `projeto`
-- direto. Fechar de vez a leitura da tabela continua na lista da Fase 1 — mas
-- o caminho que existe hoje deixa de vazar.
-- -----------------------------------------------------------------------------
create or replace view vw_projeto_edicao with (security_invoker = true) as
select
  p.id, p.codigo, p.origem_legado, p.numero, p.ano,
  p.nome, p.tipo_projeto_id, p.fase_id, p.empresa_id, p.projeto_pai_id,
  p.gerente_id, p.solicitante_id, p.setor, p.frente, p.seguranca,
  p.descricao, p.objetivo, p.problema, p.beneficios,
  p.local, p.cidade, p.uf,
  p.saude, p.pontuacao_total, p.prioridade,
  p.data_solicitacao, p.data_inicio_prev, p.data_fim_prev,
  p.data_inicio_real, p.data_fim_real, p.data_fase,
  p.arquivado_em, p.motivo_arquivo, p.retorno_em,
  p.observacao, p.criado_em, p.atualizado_em,
  case
    when app.pode_ver_valores(p.id) then p.campos
    else p.campos - coalesce(
      (select array_agg(cd.codigo)
         from campo_definicao cd
        where cd.tipo_projeto_id = p.tipo_projeto_id and cd.tipo_dado = 'MOEDA'),
      '{}'::text[])
  end as campos
from projeto p;

comment on view vw_projeto_edicao is
  'O projeto com as colunas que o formulário precisa e que a carteira não carrega. Campos MOEDA saem para quem não tem alcance financeiro, igual à vw_projeto.';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on vw_projeto_edicao to authenticated';
  end if;
end $$;
