-- =============================================================================
-- GestPlan · notificação: o sistema passa a procurar a pessoa
--
-- Até aqui o GestPlan só respondia quando era aberto. Sistema que só responde
-- quando aberto é consultado uma vez, na semana da implantação, e esquecido —
-- e com dez pessoas esse é o maior risco de adoção que existe, maior que
-- qualquer funcionalidade que falte.
--
-- A tabela `notificacao` está no banco desde a migração 000600 e nunca recebeu
-- uma linha. E não recebeu por decisão, não por esquecimento: ela **não tem
-- política de INSERT**, do mesmo jeito que `evento`. Quem escreve nela tem de
-- ser trigger `security definer`, para que ninguém possa forjar um aviso em
-- nome de outra pessoa a partir do navegador. Esta migração escreve esses
-- gatilhos.
--
-- QUATRO EVENTOS, todos tirados de dado que já existe:
--
--   1 · uma tarefa ficou sua              → trigger em `tarefa`
--   2 · mencionaram ou responderam você   → trigger em `comentario`
--   3 · um parecer ficou pendente         → trigger em `projeto_fase_hist`
--   4 · seu projeto mudou de fase         → trigger em `projeto_fase_hist`
--
-- Nenhum deles conhece o nome de um tipo de projeto. O parecer sai de
-- `tipo_fase.exige_setores`; a fase sai de `projeto.gerente_id`. Um tipo novo
-- que exija parecer passa a notificar sozinho, sem uma linha de código.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A porta única de escrita
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER porque `notificacao` não tem policy de INSERT: a única forma
-- de uma linha nascer é por aqui, chamada de dentro de um gatilho. Ninguém
-- alcança esta função pelo PostgREST — ela vive no schema `app`, que o
-- PostgREST não enxerga.
create or replace function app.notificar(
  p_pessoa  uuid,
  p_tipo    text,
  p_titulo  text,
  p_corpo   text default null,
  p_projeto uuid default null,
  p_tarefa  uuid default null
) returns void language plpgsql security definer
set search_path = public, app as $$
begin
  -- Três silêncios de propósito:
  --   · sem destinatário não há aviso;
  --   · ninguém é avisado do que ele mesmo acabou de fazer — é a diferença
  --     entre um sistema que informa e um que tagarela;
  --   · pessoa inativa não recebe. Ela saiu; a caixa dela não deve crescer.
  if p_pessoa is null then return; end if;
  if p_pessoa = app.pessoa_atual() then return; end if;
  if not exists (select 1 from pessoa where id = p_pessoa and ativo) then return; end if;

  insert into notificacao (pessoa_id, tipo, titulo, corpo, projeto_id, tarefa_id)
  values (p_pessoa, p_tipo, p_titulo, p_corpo, p_projeto, p_tarefa);
end $$;

comment on function app.notificar(uuid, text, text, text, uuid, uuid) is
  'Única escrita possível em `notificacao`. SECURITY DEFINER porque a tabela '
  'não tem policy de INSERT — ninguém forja aviso em nome de outro a partir '
  'do navegador. Não avisa quem causou o evento, nem quem está inativo.';

-- -----------------------------------------------------------------------------
-- 1 · Uma tarefa ficou sua
-- -----------------------------------------------------------------------------
-- Hoje ninguém fica sabendo que ganhou uma tarefa a não ser abrindo o projeto
-- certo por acaso. É o evento de maior sinal do sistema inteiro.
create or replace function app.avisa_tarefa_atribuida()
returns trigger language plpgsql security definer
set search_path = public, app as $$
declare v_projeto record;
begin
  if new.responsavel_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then
    return new;
  end if;

  select p.codigo, p.nome into v_projeto from projeto p where p.id = new.projeto_id;

  perform app.notificar(
    new.responsavel_id,
    'TAREFA_ATRIBUIDA',
    'Uma tarefa ficou sua: ' || new.nome,
    v_projeto.codigo || ' · ' || v_projeto.nome
      || coalesce(' · prazo ' || to_char(new.data_fim_prev, 'DD/MM/YYYY'), ' · sem prazo'),
    new.projeto_id,
    new.id);
  return new;
end $$;

create trigger tarefa_avisa_responsavel
  after insert or update of responsavel_id on tarefa
  for each row execute function app.avisa_tarefa_atribuida();

-- -----------------------------------------------------------------------------
-- 2 · Mencionaram ou responderam você
-- -----------------------------------------------------------------------------
-- `comentario.mencionados` existe desde 000600, a tela já grava nele, e nada
-- lia. Uma menção que ninguém recebe é pior que menção nenhuma: quem escreveu
-- acredita ter avisado.
create or replace function app.avisa_comentario()
returns trigger language plpgsql security definer
set search_path = public, app as $$
declare
  v_projeto record;
  v_autor   text;
  v_pai     uuid;
  v_quem    uuid;
  v_trecho  text;
begin
  select p.codigo, p.nome into v_projeto from projeto p where p.id = new.projeto_id;
  select nome into v_autor from pessoa where id = new.pessoa_id;
  v_trecho := left(btrim(new.texto), 140);

  -- Quem responde ao comentário de alguém está falando com essa pessoa.
  select pessoa_id into v_pai from comentario where id = new.responde_id;

  if v_pai is not null and not (v_pai = any(new.mencionados)) then
    perform app.notificar(
      v_pai, 'COMENTARIO_RESPOSTA',
      coalesce(v_autor, 'Alguém') || ' respondeu você',
      v_projeto.codigo || ' · ' || v_trecho,
      new.projeto_id, new.tarefa_id);
  end if;

  foreach v_quem in array new.mencionados loop
    perform app.notificar(
      v_quem, 'COMENTARIO_MENCAO',
      coalesce(v_autor, 'Alguém') || ' mencionou você',
      v_projeto.codigo || ' · ' || v_trecho,
      new.projeto_id, new.tarefa_id);
  end loop;

  return new;
end $$;

create trigger comentario_avisa_citados
  after insert on comentario
  for each row execute function app.avisa_comentario();

-- -----------------------------------------------------------------------------
-- 3 e 4 · A fase mudou: o gerente fica sabendo, e o parecer é cobrado
-- -----------------------------------------------------------------------------
-- ATENÇÃO A QUEM VIER DEPOIS: isto avisa na ENTRADA da fase, e continua
-- obedecendo a regra de que exigência é de SAÍDA. Não é contradição — é o
-- contrário. `exige_setores` diz o que trava a saída DESTA fase; entrar nela é
-- exatamente o momento em que esse requisito passa a valer, e portanto o
-- momento certo de avisar quem vai ter de assinar. Avisar na saída seria
-- avisar tarde: a fase já teria travado.
create or replace function app.avisa_mudanca_de_fase()
returns trigger language plpgsql security definer
set search_path = public, app as $$
declare
  v_projeto record;
  v_fase    record;
  v_de      text;
  v_quem    uuid;
begin
  select p.codigo, p.nome, p.gerente_id, p.empresa_id
    into v_projeto from projeto p where p.id = new.projeto_id;

  select f.nome, f.exige_setores into v_fase
    from tipo_fase f where f.id = new.para_fase_id;

  select f.nome into v_de from tipo_fase f where f.id = new.de_fase_id;

  -- 4 · o gerente do projeto
  perform app.notificar(
    v_projeto.gerente_id, 'PROJETO_MUDOU_DE_FASE',
    v_projeto.codigo || ' entrou em ' || v_fase.nome,
    coalesce(v_projeto.nome, '')
      || coalesce(' · veio de ' || v_de, '')
      || coalesce(' · ' || new.motivo, ''),
    new.projeto_id, null);

  -- 3 · quem vai ter de assinar para o projeto sair daqui
  if array_length(v_fase.exige_setores, 1) > 0 then
    for v_quem in
      select distinct pp.pessoa_id
        from pessoa_papel pp
       where pp.papel = 'AVALIADOR'
         and (pp.empresa_id = v_projeto.empresa_id
              or pp.empresa_id in (select empresa_id from projeto_empresa
                                    where projeto_id = new.projeto_id))
         -- Reentrada na mesma fase não cobra de novo quem já assinou.
         and not exists (select 1 from aprovacao a
                          where a.projeto_id = new.projeto_id
                            and a.fase_id = new.para_fase_id
                            and a.pessoa_id = pp.pessoa_id)
    loop
      perform app.notificar(
        v_quem, 'PARECER_PENDENTE',
        'Parecer pendente em ' || v_projeto.codigo,
        v_projeto.nome || ' entrou em ' || v_fase.nome
          || ' e só sai com o parecer de: '
          || array_to_string(v_fase.exige_setores, ', '),
        new.projeto_id, null);
    end loop;
  end if;

  return new;
end $$;

create trigger fase_avisa_interessados
  after insert on projeto_fase_hist
  for each row execute function app.avisa_mudanca_de_fase();

-- -----------------------------------------------------------------------------
-- A pessoa pode apagar o que já leu
-- -----------------------------------------------------------------------------
-- `notificacao` já tinha SELECT e UPDATE da própria pessoa (marcar lida).
-- Faltava poder limpar a caixa — sem isso ela só cresce, e uma caixa que só
-- cresce é uma caixa que se aprende a ignorar.
--
-- Não há trigger prendendo o UPDATE à coluna `lida_em`: a política já limita a
-- linha à própria pessoa, e reescrever o texto do próprio aviso não prejudica
-- ninguém além de quem reescreveu.
create policy notificacao_apaga_a_propria on notificacao for delete
  using (pessoa_id = app.pessoa_atual());
