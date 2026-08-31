-- =============================================================================
-- GestPlan · o projeto é de quem foi posto nele
--
-- MUDANÇA NO NÚCLEO DE PERMISSÃO. Leia antes de mexer em qualquer coisa perto.
--
-- Até aqui, alcance de projeto era por EMPRESA: quem tivesse qualquer papel na
-- Cemare enxergava todos os projetos da Cemare. Fazia sentido enquanto o
-- sistema tinha um usuário. Com dez pessoas em três grupos, virou o contrário
-- do que se quer: a pessoa que cuida de um projeto de TI abria a carteira e
-- via a obra, o orçamento e o histórico de coisas que não são dela.
--
-- A regra passa a ser PERTENCIMENTO EXPLÍCITO:
--
--     você alcança um projeto se é o gerente dele, se foi alocado nele,
--     ou se foi você quem o pediu.
--
-- E só. Papel na empresa deixou de dar alcance a projeto — ele continua
-- dizendo O QUE você pode fazer (editar, ver dinheiro, assinar), mas não mais
-- EM QUE. As duas perguntas eram uma só e agora são duas.
--
-- O proprietário continua enxergando tudo; o fornecedor continua entrando pelo
-- contrato, e por nada mais.
--
-- CONSEQUÊNCIA QUE PRECISA SER DITA: depois desta migração, ninguém além do
-- proprietário enxerga projeto nenhum até ser alocado. Os 29 projetos
-- importados do desktop não têm alocação. Isso é o comportamento pedido, não
-- um defeito — mas quem for cadastrar a equipe precisa saber que alocar deixou
-- de ser opcional e virou o ato de dar acesso.
--
-- POR QUE A ALOCAÇÃO, E NÃO UMA TABELA NOVA: `alocacao` já existe, já diz quem
-- está no projeto e com quanto do tempo, e já tem tela. Uma `projeto_membro`
-- ao lado dela seriam duas listas da mesma coisa, que um dia divergiriam.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A pergunta nova
-- -----------------------------------------------------------------------------
-- Recebe a pessoa como parâmetro em vez de olhar só para `pessoa_atual()`
-- porque os gatilhos de aviso precisam perguntar POR OUTRA PESSOA: não adianta
-- avisar quem não vai conseguir abrir o projeto.
--
-- O SOLICITANTE ENTRA, e isso não é exceção à regra — é a regra. Chamado vira
-- projeto com `solicitante_id` de quem pediu; sem contá-lo, abrir um chamado
-- faria o chamado sumir da vista de quem o abriu, que é o oposto de tudo que
-- a tela pública promete quando devolve o código do pedido. A alternativa
-- seria `abrir_chamado` alocar o solicitante, e ela é pior: alocação carrega
-- percentual de dedicação e sujaria a conta de capacidade com gente que só
-- pediu uma coisa.
--
-- As datas da alocação NÃO entram aqui de propósito. `data_inicio` e
-- `data_fim` existem para a conta de capacidade — quanto do tempo de alguém
-- está comprometido hoje. Alcance é outra coisa: quem trabalhou num projeto em
-- março continua precisando abrir o que fez. Quem sai de vez sai por `ativo`.
create or replace function app.é_parte(p_projeto uuid, p_pessoa uuid)
returns boolean language sql stable security definer
set search_path = public, app as $$
  select p_pessoa is not null
     and (exists (select 1 from projeto p
                   where p.id = p_projeto
                     and (p.gerente_id = p_pessoa or p.solicitante_id = p_pessoa))
       or exists (select 1 from alocacao a
                   where a.projeto_id = p_projeto
                     and a.pessoa_id = p_pessoa
                     and a.ativo));
$$;

comment on function app.é_parte(uuid, uuid) is
  'Esta pessoa foi posta neste projeto? Gerente, solicitante ou alocação ativa. '
  'Recebe a pessoa por parâmetro porque os gatilhos de aviso precisam '
  'perguntar por outra pessoa que não a da sessão.';

create or replace function app.é_parte_do_projeto(p_projeto uuid)
returns boolean language sql stable security definer
set search_path = public, app as $$
  select app.é_parte(p_projeto, app.pessoa_atual());
$$;

-- -----------------------------------------------------------------------------
-- Alcance: some o ramo por empresa
-- -----------------------------------------------------------------------------
create or replace function app.pode_ver_projeto(p_projeto uuid)
returns boolean language sql stable security definer
set search_path = public, app as $$
  select app.é_proprietario()
      or app.é_parte_do_projeto(p_projeto)
      or (app.fornecedor_atual() is not null
          and exists (select 1 from contrato c
                       where c.projeto_id = p_projeto
                         and c.fornecedor_id = app.fornecedor_atual()));
$$;

comment on function app.pode_ver_projeto(uuid) is
  'Alcança o projeto: o proprietário, quem foi posto nele (gerente ou alocado), '
  'e o fornecedor pelo contrato. Papel na empresa NÃO dá alcance desde a '
  'migração 20260830160000 — ele diz o que a pessoa pode fazer, não onde.';

-- -----------------------------------------------------------------------------
-- Poder: continua vindo do papel, mas só dentro do que se alcança
-- -----------------------------------------------------------------------------
-- As duas perguntas ficam explícitas: `é_parte` diz ONDE, o papel diz O QUÊ.
-- Ser gerente de projetos da empresa não basta mais para editar um projeto em
-- que ninguém te pôs.
create or replace function app.pode_editar_projeto(p_projeto uuid)
returns boolean language sql stable security definer
set search_path = public, app as $$
  select app.é_proprietario()
      or (app.é_parte_do_projeto(p_projeto)
          and exists (
            select 1
              from projeto p
              join pessoa_papel pp on pp.pessoa_id = app.pessoa_atual()
              join tipo_projeto tp on tp.id = p.tipo_projeto_id
             where p.id = p_projeto
               and (pp.empresa_id = p.empresa_id
                 or pp.empresa_id in (select empresa_id from projeto_empresa
                                       where projeto_id = p.id))
               -- DÍVIDA CONHECIDA, herdada e preservada aqui sem mudança para
               -- esta migração tratar de uma coisa só: `tp.codigo = 'TI'` é
               -- nome de tipo dentro de código, exatamente o que a regra de
               -- ouro proíbe. O lugar disso é uma coluna em `tipo_projeto`
               -- dizendo que papéis editam. Está anotado no ROADMAP.
               and (pp.papel = 'GERENTE_PROJETOS'
                 or (pp.papel = 'TIME_TI' and tp.codigo = 'TI'))));
$$;

create or replace function app.pode_ver_valores(p_projeto uuid)
returns boolean language sql stable security definer
set search_path = public, app as $$
  select app.é_proprietario()
      or (app.é_parte_do_projeto(p_projeto)
          and exists (
            select 1
              from projeto p
              join pessoa_papel pp on pp.pessoa_id = app.pessoa_atual()
             where p.id = p_projeto
               and (pp.empresa_id = p.empresa_id
                 or pp.empresa_id in (select empresa_id from projeto_empresa
                                       where projeto_id = p.id))
               and pp.papel in ('GERENTE_PROJETOS','FINANCEIRO_COMPRAS')));
$$;

-- Assinar parecer num projeto que não se alcança seria assinar às cegas.
create or replace function app.pode_assinar(p_projeto uuid)
returns boolean language sql stable security definer
set search_path = public, app as $$
  select app.é_proprietario()
      or (app.é_parte_do_projeto(p_projeto)
          and exists (
               select 1
                 from projeto p
                 join pessoa_papel pp on pp.pessoa_id = app.pessoa_atual()
                where p.id = p_projeto
                  and (pp.empresa_id = p.empresa_id
                    or pp.empresa_id in (select empresa_id from projeto_empresa
                                          where projeto_id = p.id))
                  and pp.papel = 'AVALIADOR'));
$$;

comment on function app.pode_assinar(uuid) is
  'Quem pode registrar parecer: papel AVALIADOR E parte do projeto. Limitação '
  'conhecida, herdada: não amarra o avaliador a um setor — falta um '
  'pessoa_setor no modelo.';

-- -----------------------------------------------------------------------------
-- Responsável por tarefa tem de ser gente do projeto
-- -----------------------------------------------------------------------------
-- Sem isto, a regra nova cria um estado sem sentido: alguém responsável por uma
-- tarefa de um projeto que não consegue abrir. Pior, o gatilho de aviso mandaria
-- a essa pessoa um recado apontando para uma tela que a RLS nega — e aviso que
-- leva a lugar nenhum ensina a ignorar avisos.
--
-- O proprietário passa porque alcança tudo.
create or replace function app.responsavel_e_do_projeto()
returns trigger language plpgsql security definer
set search_path = public, app as $$
declare v_nome text;
begin
  if new.responsavel_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then
    return new;
  end if;
  if exists (select 1 from pessoa where id = new.responsavel_id and proprietario) then
    return new;
  end if;
  if app.é_parte(new.projeto_id, new.responsavel_id) then return new; end if;

  select nome into v_nome from pessoa where id = new.responsavel_id;
  raise exception
    '% não está neste projeto — aloque a pessoa na equipe do projeto antes de dar tarefa a ela',
    coalesce(v_nome, 'A pessoa');
end $$;

create trigger tarefa_responsavel_e_do_projeto
  before insert or update of responsavel_id on tarefa
  for each row execute function app.responsavel_e_do_projeto();

-- -----------------------------------------------------------------------------
-- O aviso de parecer só vai para quem consegue abrir o projeto
-- -----------------------------------------------------------------------------
-- Mesma razão: antes desta migração o gatilho avisava todo AVALIADOR da
-- empresa. Agora avisa os que foram postos no projeto.
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

  perform app.notificar(
    v_projeto.gerente_id, 'PROJETO_MUDOU_DE_FASE',
    v_projeto.codigo || ' entrou em ' || v_fase.nome,
    coalesce(v_projeto.nome, '')
      || coalesce(' · veio de ' || v_de, '')
      || coalesce(' · ' || new.motivo, ''),
    new.projeto_id, null);

  if array_length(v_fase.exige_setores, 1) > 0 then
    for v_quem in
      select distinct pp.pessoa_id
        from pessoa_papel pp
       where pp.papel = 'AVALIADOR'
         and app.é_parte(new.projeto_id, pp.pessoa_id)
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

-- -----------------------------------------------------------------------------
-- Uma pessoa entra uma vez em cada projeto
-- -----------------------------------------------------------------------------
-- Apareceu ao cruzar as suítes: duas alocações ATIVAS da mesma pessoa no mesmo
-- projeto somavam duas vezes em `vw_capacidade` — a pessoa aparecia com 110%
-- comprometidos sem estar em dois projetos. A tela já não deixava criar a
-- segunda; o banco deixava, e regra que só existe na tela é regra que uma
-- importação futura ignora.
--
-- Parcial em `ativo`: alocação encerrada pode repetir, e deve — é o histórico
-- de quem entrou e saiu do projeto.
create unique index if not exists alocacao_uma_por_pessoa_no_projeto
  on alocacao (projeto_id, pessoa_id) where ativo;
