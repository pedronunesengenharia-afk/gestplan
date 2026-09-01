-- =============================================================================
-- GestPlan · o quadro de afazeres: seções dentro de cada lista
--
-- O afazer já sabia de quem é (`pessoa_id`), de que empresa é (`empresa_id`) e
-- a que projeto se refere (`projeto_id`). Faltava ONDE ELE FICA no quadro —
-- "Produção", "Qualidade", "Estratégia e Projetos".
--
-- POR QUE UMA TABELA, E NÃO UMA COLUNA DE TEXTO. Um `afazer.secao text` seria
-- menor e resolveria quase tudo, menos a coisa mais importante de um quadro:
-- **a coluna vazia**. Com texto, "Qualidade" só existiria enquanto houvesse
-- algo dentro; esvaziar a coluna a apagaria, e o quadro perderia a estrutura
-- que a pessoa montou justamente para saber o que ainda está sem nada.
--
-- POR QUE NÃO REUSAR `setor`. `setor` é o cadastro de quem assina parecer —
-- Projetos, Financeiro, Compras, Gestão — e é comum às empresas todas. As
-- colunas do quadro são de cada pessoa e de cada lista: a minha Cimentpav não
-- precisa ter as mesmas divisões da sua. Amarrar as duas coisas faria a
-- avaliação de projeto depender de como alguém organiza a lista dele.
--
-- PRIVADA, como o resto da lista: `pessoa_id = app.pessoa_atual()`, sem
-- exceção nem para o proprietário.
-- =============================================================================

create table afazer_secao (
  id         uuid primary key default gen_random_uuid(),
  pessoa_id  uuid not null references pessoa(id) on delete cascade,

  -- Nulo = a lista "Pessoal", a dos afazeres que não são de empresa nenhuma.
  -- É a mesma chave que o afazer usa, então a coluna e o cartão pertencem à
  -- mesma lista sem precisar de uma terceira tabela dizendo isso.
  empresa_id uuid references empresa(id) on delete cascade,

  nome       text not null check (btrim(nome) <> ''),
  ordem      int  not null default 0,
  criado_em  timestamptz not null default now(),

  -- Duas colunas com o mesmo nome na mesma lista seriam indistinguíveis na
  -- tela. `nulls not distinct` porque a lista Pessoal tem `empresa_id` nulo e,
  -- sem isso, nulo nunca colidiria com nulo e ela aceitaria repetidas.
  unique nulls not distinct (pessoa_id, empresa_id, nome)
);

comment on table afazer_secao is
  'Colunas do quadro de afazeres, por pessoa e por lista. Existem mesmo '
  'vazias — é o que separa um quadro de um agrupamento por texto.';

create index afazer_secao_da_lista_idx on afazer_secao (pessoa_id, empresa_id, ordem);

alter table afazer_secao enable row level security;
alter table afazer_secao force row level security;

create policy afazer_secao_e_so_minha on afazer_secao for all
  using (pessoa_id = app.pessoa_atual())
  with check (
    pessoa_id = app.pessoa_atual()
    and (empresa_id is null or empresa_id in (select app.empresas_visiveis()))
  );

-- -----------------------------------------------------------------------------
-- O afazer passa a saber em que coluna está
-- -----------------------------------------------------------------------------
-- `set null` e não `cascade`: apagar a coluna "Qualidade" não pode apagar o
-- que estava dentro dela. O item volta para a faixa sem seção, que a tela
-- mostra em primeiro lugar — some a gaveta, não o que estava guardado.
alter table afazer
  add column if not exists secao_id uuid references afazer_secao(id) on delete set null;

comment on column afazer.secao_id is
  'Coluna do quadro. Nulo = ainda sem coluna, que a tela mostra como a '
  'primeira faixa. Apagar a seção não apaga o afazer.';

-- A política de `afazer` é `for all` com o `with check` inteiro, então
-- acrescentar uma condição obriga a reescrevê-la. O resto continua igual.
drop policy if exists afazer_e_so_meu on afazer;

create policy afazer_e_so_meu on afazer for all
  using (pessoa_id = app.pessoa_atual())
  with check (
    pessoa_id = app.pessoa_atual()
    and (projeto_id is null or app.pode_ver_interno(projeto_id))
    and (empresa_id is null or empresa_id in (select app.empresas_visiveis()))
    -- Pôr o próprio afazer numa coluna de outra pessoa seria adivinhar um id;
    -- não vaza nada, mas deixaria o item numa gaveta que a tela nunca mostra.
    and (secao_id is null or secao_id in (select id from afazer_secao))
  );

comment on policy afazer_e_so_meu on afazer is
  'Cada um só alcança a própria lista, e não há exceção para o proprietário. '
  'Ver o comentário da tabela: é decisão de produto.';
