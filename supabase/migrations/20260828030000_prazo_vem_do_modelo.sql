-- =============================================================================
-- GestPlan · o projeto aprende o próprio prazo com as tarefas que ele gerou
--
-- O modelo criava quatro tarefas encadeadas de 01/09 a 24/09 e o projeto
-- continuava dizendo "sem data de fim prevista". A informação existia, ninguém
-- a subia um nível — e o indicador de prazo, que é a primeira coisa que se
-- olha, ficava mudo.
--
-- Agora, ao aplicar o modelo, o projeto recebe início e fim previstos da
-- primeira e da última tarefa geradas. Só quando estão vazios: data que
-- alguém digitou não é sobrescrita por conta automática.
-- =============================================================================

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
  v_ids       jsonb := '{}'::jsonb;
begin
  select tipo_projeto_id, coalesce(data_inicio_prev, current_date)
    into v_tipo, v_inicio
    from projeto where id = p_projeto;

  if v_tipo is null then
    return 0;
  end if;

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

    if v_pai is not null then
      update etapa set folha = false where id = v_pai;
    end if;

    if m.gera_tarefa and m.duracao_dias is not null then
      v_fim := app.mais_dias_uteis(v_cursor, m.duracao_dias - 1);
      insert into tarefa (projeto_id, etapa_id, codigo, nome, status, ordem,
                          duracao_dias, data_inicio_prev, data_fim_prev)
      values (p_projeto, v_etapa, m.codigo, m.nome, 'NAO_INICIADA', m.ordem,
              m.duracao_dias, v_cursor, v_fim);

      v_cursor := app.mais_dias_uteis(v_fim, 1);
    end if;
  end loop;

  -- O projeto aprende o próprio prazo com o cronograma que acabou de nascer.
  -- `coalesce` de propósito: data digitada por alguém manda mais que conta
  -- automática, e a segunda nunca apaga a primeira.
  update projeto p
     set data_inicio_prev = coalesce(p.data_inicio_prev,
                                     (select min(t.data_inicio_prev) from tarefa t
                                       where t.projeto_id = p_projeto)),
         data_fim_prev    = coalesce(p.data_fim_prev,
                                     (select max(t.data_fim_prev) from tarefa t
                                       where t.projeto_id = p_projeto))
   where p.id = p_projeto;

  return v_quantas;
end;
$$;

comment on function app.aplicar_modelo_de_etapas(uuid) is
  'Cria a EAP padrao do tipo, uma tarefa com prazo por etapa que declare duracao, e sobe o inicio e o fim previstos para o projeto. Nao faz nada se o projeto ja tiver etapa; nao sobrescreve data digitada.';


-- -----------------------------------------------------------------------------
-- Os projetos que ja nasceram do modelo e ficaram sem prazo
--
-- Um passo de correcao, uma vez so: quem tem tarefa com data e nao tem prazo
-- proprio recebe o que as tarefas dizem.
-- -----------------------------------------------------------------------------
update projeto p
   set data_inicio_prev = coalesce(p.data_inicio_prev, x.inicio),
       data_fim_prev    = coalesce(p.data_fim_prev, x.fim)
  from (select t.projeto_id,
               min(t.data_inicio_prev) as inicio,
               max(t.data_fim_prev)    as fim
          from tarefa t
         where t.data_inicio_prev is not null and t.data_fim_prev is not null
         group by t.projeto_id) x
 where x.projeto_id = p.id
   and (p.data_inicio_prev is null or p.data_fim_prev is null);
