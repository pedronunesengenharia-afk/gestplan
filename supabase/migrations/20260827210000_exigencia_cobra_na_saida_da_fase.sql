-- =============================================================================
-- GestPlan · exigência de campo cobra na SAÍDA da fase, não em todo salvamento
--
-- Bug meu, achado ao preparar o item 3 (editar projeto). A regra escrita é
-- "para SAIR desta fase o campo tem de estar preenchido" — foi assim que
-- documentei `exigido_para_sair_de`. O trigger fazia outra coisa: cobrava a
-- cada UPDATE de `campos`, mudasse a fase ou não.
--
-- O efeito, sobre os dados importados: os 5 projetos que já passaram de uma
-- fase com campo em branco — 2025-001, 2026-001, 2026-002, 2026-004 e
-- 2026-006 — ficaram CONGELADOS. Nenhuma alteração em campo nenhum passava.
--
--   corrigir "prazo de entrega" em 2026-004
--     → ERRO: Campo obrigatório para sair de Viabilidade: Situação atual
--
-- Um erro sobre um campo que a pessoa não tocou, ao salvar um campo que não
-- tem relação nenhuma. Era preciso preencher as quatro pendências numa
-- tacada só para conseguir salvar qualquer outra coisa. É assim que alguém
-- decide que "o sistema não deixa salvar" e volta para a planilha.
--
-- Agora a exigência é conferida quando a fase muda — que é quando ela vale — e
-- na inserção. Tipo, faixa, opção da lista e chave desconhecida continuam
-- conferidos em TODO salvamento: esses são sobre o dado estar certo, não sobre
-- o projeto estar pronto para avançar.
--
-- Consequência aceita: projeto pode ficar parado numa fase com campo exigido em
-- branco. É exatamente o estado em que os 5 importados estão — e o retrato é
-- verdadeiro. O banco cobra na hora de avançar; a tarja âmbar da tela mostra a
-- dívida antes disso.
-- =============================================================================

create or replace function app.validar_campos()
returns trigger
language plpgsql
as $$
declare
  d          record;
  v          jsonb;
  v_ordem    int;
  v_extras   text[];
  v_mudou_fase boolean;
begin
  select f.ordem into v_ordem from tipo_fase f where f.id = new.fase_id;
  v_ordem := coalesce(v_ordem, 0);

  -- A exigência de saída só se pergunta quando o projeto está de fato saindo.
  v_mudou_fase := (tg_op = 'INSERT') or (new.fase_id is distinct from old.fase_id);

  -- Chave desconhecida é erro de digitação, e erro de digitação silencioso em
  -- jsonb é dívida que aparece meses depois. Conferido sempre.
  select array_agg(k) into v_extras
    from jsonb_object_keys(new.campos) as k
   where not exists (
     select 1 from campo_definicao cd
      where cd.tipo_projeto_id = new.tipo_projeto_id and cd.codigo = k and cd.ativo);
  if v_extras is not null then
    raise exception 'Campo inexistente para este tipo de projeto: %', array_to_string(v_extras, ', ');
  end if;

  for d in
    select * from campo_definicao
     where tipo_projeto_id = new.tipo_projeto_id and ativo
  loop
    v := new.campos -> d.codigo;

    -- Obrigatoriedade: só na saída da fase.
    if v_mudou_fase and d.exigido_para_sair_de is not null then
      if v_ordem > (select ordem from tipo_fase where id = d.exigido_para_sair_de)
         and (v is null or v = 'null'::jsonb
              or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '')) then
        raise exception 'Campo obrigatório para sair de %: % (%)',
          (select nome from tipo_fase where id = d.exigido_para_sair_de), d.rotulo, d.codigo;
      end if;
    end if;

    if v is null or v = 'null'::jsonb then
      continue;
    end if;

    -- O dado estar certo é conferido sempre, mude a fase ou não.
    case d.tipo_dado
      when 'NUMERO','MOEDA','PERCENTUAL' then
        if jsonb_typeof(v) <> 'number' then
          raise exception 'Campo % espera número, recebeu %', d.codigo, jsonb_typeof(v);
        end if;
        if d.minimo is not null and (v #>> '{}')::numeric < d.minimo then
          raise exception 'Campo % abaixo do mínimo (%)', d.codigo, d.minimo;
        end if;
        if d.maximo is not null and (v #>> '{}')::numeric > d.maximo then
          raise exception 'Campo % acima do máximo (%)', d.codigo, d.maximo;
        end if;
      when 'BOOLEANO' then
        if jsonb_typeof(v) <> 'boolean' then
          raise exception 'Campo % espera verdadeiro/falso', d.codigo;
        end if;
      when 'DATA' then
        begin
          perform (v #>> '{}')::date;
        exception when others then
          raise exception 'Campo % espera data no formato AAAA-MM-DD', d.codigo;
        end;
      when 'SELECAO' then
        if not (d.opcoes @> jsonb_build_array(v #>> '{}')) then
          raise exception 'Campo %: opção inválida (%)', d.codigo, v #>> '{}';
        end if;
      when 'SELECAO_MULTIPLA' then
        if jsonb_typeof(v) <> 'array' then
          raise exception 'Campo % espera uma lista', d.codigo;
        end if;
        if exists (select 1 from jsonb_array_elements_text(v) e
                    where not (d.opcoes @> jsonb_build_array(e))) then
          raise exception 'Campo %: lista contém opção inválida', d.codigo;
        end if;
      else
        null;
    end case;
  end loop;

  return new;
end;
$$;

comment on function app.validar_campos() is
  'Confere projeto.campos contra campo_definicao. Tipo, faixa, opção e chave desconhecida em todo salvamento; obrigatoriedade só quando a fase muda, porque a regra é de saída de fase.';
