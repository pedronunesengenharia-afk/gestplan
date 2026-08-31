-- =============================================================================
-- GestPlan · afazer — a lista pessoal de cada um
--
-- POR QUE NÃO É `tarefa`. Tarefa pertence a um projeto: `projeto_id` é NOT
-- NULL, ela entra no cronograma, tem responsável, peso e avanço, e o que
-- acontece com ela mexe no percentual do projeto. "Ligar para o fornecedor" e
-- "revisar a ata antes da reunião" não são nada disso — são lembretes. Forçá-
-- los em `tarefa` sujaria o avanço de todo projeto com item que não é escopo,
-- e é exatamente assim que um cronograma deixa de significar alguma coisa.
--
-- PRIVADO DE VERDADE, inclusive do proprietário. A política é
-- `pessoa_id = app.pessoa_atual()`, sem exceção — igual à de `notificacao`. É
-- decisão de produto, não descuido: uma lista pessoal que o chefe lê deixa de
-- ser usada para o que ela serve e vira vitrine. Quem quiser acompanhar o
-- trabalho de alguém tem a tarefa de projeto, que é pública para a equipe do
-- projeto e é onde o combinado mora.
--
-- A LIGAÇÃO COM PROJETO É OPCIONAL e é só um ponteiro: o afazer não vira
-- tarefa, não conta avanço, não aparece para mais ninguém. Serve para a pessoa
-- achar o lembrete pelo projeto a que ele se refere.
-- =============================================================================

create table afazer (
  id         uuid primary key default gen_random_uuid(),
  pessoa_id  uuid not null references pessoa(id) on delete cascade,
  titulo     text not null check (btrim(titulo) <> ''),
  detalhe    text,

  -- `set null` e não `cascade`: se o projeto sumir, o lembrete continua
  -- valendo. "Cobrar a nota fiscal" não deixa de precisar ser feito porque
  -- alguém arquivou o projeto.
  projeto_id uuid references projeto(id) on delete set null,

  prazo      date,
  prioridade text not null default 'NORMAL'
             check (prioridade in ('ALTA','NORMAL','BAIXA')),

  -- Instante, não dia: serve para saber quando foi feito e para desfazer.
  feito_em   timestamptz,

  ordem      int not null default 0,
  criado_em  timestamptz not null default now()
);

comment on table afazer is
  'Lista pessoal de lembretes. NÃO é tarefa de projeto: não entra no '
  'cronograma nem no avanço. Privada de quem a escreveu, inclusive do '
  'proprietário.';

-- O índice que a tela usa: a lista de uma pessoa, pendentes primeiro.
create index afazer_da_pessoa_idx on afazer (pessoa_id, ordem, criado_em);
create index afazer_pendente_idx on afazer (pessoa_id, prazo) where feito_em is null;

alter table afazer enable row level security;
alter table afazer force row level security;

-- Uma política só, para tudo. O `with check` é o que impede escrever na lista
-- de outra pessoa: sem ele, um insert com `pessoa_id` alheio passaria.
create policy afazer_e_so_meu on afazer for all
  using (pessoa_id = app.pessoa_atual())
  with check (
    pessoa_id = app.pessoa_atual()
    -- Ligar a um projeto que não se alcança não vazaria nada — o id já é
    -- conhecido de quem o digitou — mas deixaria a tela mostrando um traço
    -- para sempre. Melhor recusar na hora.
    and (projeto_id is null or app.pode_ver_interno(projeto_id))
  );

comment on policy afazer_e_so_meu on afazer is
  'Cada um só alcança a própria lista, e não há exceção para o proprietário. '
  'Ver o comentário da tabela: é decisão de produto.';
