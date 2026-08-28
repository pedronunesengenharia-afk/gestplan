-- =============================================================================
-- GestPlan · o projeto que nasce com as etapas do seu tipo, e com prazo
--
-- Pedido: "no TI, ao gerar um projeto, criar etapa com tempo". A tentação era
-- escrever as quatro etapas de TI dentro de um `if`. Isso é exatamente o que a
-- regra de ouro proíbe — e, pior, seria inútil na primeira vez que a Obra ou a
-- Manutenção quisessem o mesmo.
--
-- Então o modelo vira DADO: `tipo_etapa` descreve a EAP padrão de cada tipo, e
-- todo projeto criado recebe a do seu. Trocar o processo de TI é editar linhas,
-- não código.
--
-- SOBRE O TEMPO. `etapa` não tem data e não vai ter: o modelo separou etapa
-- (a EAP e o orçamento) de tarefa (o cronograma), e duas tabelas com datas
-- seriam duas verdades sobre o mesmo prazo. Cada etapa do modelo pode gerar
-- UMA tarefa, e é ela que carrega duração e datas — que é onde o Gantt da
-- Fase 2 vai buscar, sem retrabalho.
--
-- As datas saem em dias ÚTEIS simples, de segunda a sexta. Já existem as
-- tabelas `calendario` e `calendario_excecao`, vazias: feriado e jornada são
-- Fase 2. Até lá, sexta + 1 dia útil é segunda, e é só isso que se promete.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- O modelo
-- -----------------------------------------------------------------------------
create table if not exists tipo_etapa (
  id              uuid primary key default gen_random_uuid(),
  tipo_projeto_id uuid not null references tipo_projeto(id) on delete cascade,
  codigo          text not null,
  nome            text not null,
  descricao       text,
  -- O pai é referenciado pelo CÓDIGO dentro do próprio modelo: assim o modelo
  -- é legível, e copiar um modelo para outro tipo não arrasta id nenhum.
  pai_codigo      text,
  ordem           int  not null default 0,
  peso_percentual numeric(7,4) not null default 0 check (peso_percentual >= 0),
  -- Nulo, ou gera_tarefa falso, quer dizer etapa sem cronograma próprio —
  -- serve para o agrupador que só soma os filhos.
  duracao_dias    int check (duracao_dias is null or duracao_dias > 0),
  gera_tarefa     boolean not null default true,
  ativo           boolean not null default true,
  unique (tipo_projeto_id, codigo)
);

comment on table tipo_etapa is
  'A EAP padrao de cada tipo de projeto. Todo projeto novo nasce com a do seu tipo. Configuracao: editar aqui muda o processo, sem tocar em codigo.';
comment on column tipo_etapa.duracao_dias is
  'Duracao da tarefa que esta etapa gera, em dias uteis. Nulo = etapa sem tarefa.';

create index if not exists tipo_etapa_idx on tipo_etapa (tipo_projeto_id, ordem);

alter table tipo_etapa enable row level security;
alter table tipo_etapa force row level security;

-- A mesma porta de tipo_fase e tipo_projeto: quem está dentro lê, o dono escreve.
drop policy if exists tipo_etapa_le on tipo_etapa;
create policy tipo_etapa_le on tipo_etapa for select
  using (app.pessoa_atual() is not null);

drop policy if exists tipo_etapa_escreve on tipo_etapa;
create policy tipo_etapa_escreve on tipo_etapa for all
  using (app."é_proprietario"()) with check (app."é_proprietario"());


-- -----------------------------------------------------------------------------
-- Somar dias úteis
--
-- Sem feriado e sem jornada: só pular sábado e domingo. É pouco, e é honesto —
-- o calendário de verdade é da Fase 2, e as tabelas dele já esperam vazias.
-- -----------------------------------------------------------------------------
create or replace function app.mais_dias_uteis(p_data date, p_dias int)
returns date
language plpgsql
immutable
as $$
declare
  v_data date := p_data;
  v_faltam int := greatest(p_dias, 0);
begin
  while v_faltam > 0 loop
    v_data := v_data + 1;
    if extract(isodow from v_data) < 6 then
      v_faltam := v_faltam - 1;
    end if;
  end loop;
  -- Se a data de partida cair no fim de semana, anda para a segunda.
  while extract(isodow from v_data) > 5 loop
    v_data := v_data + 1;
  end loop;
  return v_data;
end;
$$;


-- -----------------------------------------------------------------------------
-- Aplicar o modelo a um projeto
--
-- Idempotente por construção: se o projeto já tem etapa, não faz nada. Isso
-- protege a reimportação e qualquer chamada repetida.
-- -----------------------------------------------------------------------------
create or replace function app.aplicar_modelo_de_etapas(p_projeto uuid)
returns int
language plpgsql
security definer
set search_path = public, app
as $$
declare
  m           record;
  v_tipo      uuid;
  v_inicio    date;
  v_cursor    date;
  v_fim       date;
  v_etapa     uuid;
  v_pai       uuid;
  v_nivel     int;
  v_quantas   int := 0;
  v_ids       jsonb := '{}'::jsonb;   -- codigo do modelo -> id da etapa criada
begin
  select tipo_projeto_id, coalesce(data_inicio_prev, current_date)
    into v_tipo, v_inicio
    from projeto where id = p_projeto;

  if v_tipo is null then
    return 0;
  end if;

  -- Projeto que já tem EAP não recebe modelo por cima.
  if exists (select 1 from etapa where projeto_id = p_projeto) then
    return 0;
  end if;

  v_cursor := app.mais_dias_uteis(v_inicio, 0);

  for m in
    select * from tipo_etapa
     where tipo_projeto_id = v_tipo and ativo
     order by ordem, codigo
  loop
    v_pai := nullif(v_ids ->> coalesce(m.pai_codigo, ''), '')::uuid;
    v_nivel := case when v_pai is null then 1 else 2 end;

    insert into etapa (projeto_id, pai_id, codigo, nome, descricao, nivel, ordem,
                       folha, peso_percentual)
    values (p_projeto, v_pai, m.codigo, m.nome, m.descricao, v_nivel, m.ordem,
            true, m.peso_percentual)
    returning id into v_etapa;

    v_ids := v_ids || jsonb_build_object(m.codigo, v_etapa::text);
    v_quantas := v_quantas + 1;

    -- Quem virou pai deixa de ser folha: o total do projeto soma `where folha`.
    if v_pai is not null then
      update etapa set folha = false where id = v_pai;
    end if;

    -- O tempo vive na tarefa. Uma por etapa que declare duração.
    if m.gera_tarefa and m.duracao_dias is not null then
      v_fim := app.mais_dias_uteis(v_cursor, m.duracao_dias - 1);
      insert into tarefa (projeto_id, etapa_id, codigo, nome, status, ordem,
                          duracao_dias, data_inicio_prev, data_fim_prev)
      values (p_projeto, v_etapa, m.codigo, m.nome, 'NAO_INICIADA', m.ordem,
              m.duracao_dias, v_cursor, v_fim);

      -- A próxima começa no dia útil seguinte ao fim desta: as etapas do
      -- modelo são uma sequência, não um monte de coisas soltas no mesmo dia.
      v_cursor := app.mais_dias_uteis(v_fim, 1);
    end if;
  end loop;

  return v_quantas;
end;
$$;

comment on function app.aplicar_modelo_de_etapas(uuid) is
  'Cria a EAP padrao do tipo do projeto, e uma tarefa com prazo por etapa que declare duracao. Nao faz nada se o projeto ja tiver etapa.';


-- -----------------------------------------------------------------------------
-- O gatilho: todo projeto nasce com o modelo do seu tipo
--
-- Vale para qualquer tipo que tenha modelo — inclusive para o chamado, que é
-- projeto na fila de TI e passa a nascer com as mesmas etapas do processo.
-- Tipo sem modelo continua nascendo vazio, como antes.
-- -----------------------------------------------------------------------------
create or replace function app.semear_etapas()
returns trigger
language plpgsql
as $$
begin
  perform app.aplicar_modelo_de_etapas(new.id);
  return null;
end;
$$;

drop trigger if exists projeto_zz_modelo_etapas on projeto;
create trigger projeto_zz_modelo_etapas
  after insert on projeto
  for each row execute function app.semear_etapas();


-- -----------------------------------------------------------------------------
-- O modelo de TI
--
-- Semeado porque foi o pedido, e porque um modelo vazio não prova nada. São
-- quatro etapas e vinte dias úteis; os pesos somam 100. Edite à vontade: é
-- dado, e a próxima geração já sai diferente.
-- -----------------------------------------------------------------------------
insert into tipo_etapa (tipo_projeto_id, codigo, nome, descricao, ordem, peso_percentual, duracao_dias)
select tp.id, x.codigo, x.nome, x.descricao, x.ordem, x.peso, x.dias
  from tipo_projeto tp,
       (values
          ('1', 'Levantamento',  'Entender o pedido, falar com quem usa, escrever o que sera feito.', 1, 15, 3),
          ('2', 'Desenvolvimento','Construir. E onde mora a maior parte do prazo.',                    2, 55, 10),
          ('3', 'Homologação',   'Quem pediu confere se resolve o problema de verdade.',              3, 20, 3),
          ('4', 'Implantação',   'Colocar no ar, avisar quem usa, acompanhar os primeiros dias.',     4, 10, 2)
       ) as x(codigo, nome, descricao, ordem, peso, dias)
 where tp.codigo = 'TI'
on conflict (tipo_projeto_id, codigo) do nothing;
