-- =============================================================================
-- GestPlan · 010_seed.sql
-- Os cinco tipos de projeto, os setores, os critérios de pontuação e o
-- calendário brasileiro.
--
-- Nada aqui é código de aplicação: é o conteúdo da Camada 2. Um sexto tipo de
-- projeto se acrescenta escrevendo mais um bloco como estes — sem migração,
-- sem deploy.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Setores que emitem parecer
-- -----------------------------------------------------------------------------
insert into setor (codigo, nome, ordem) values
  ('PROJETOS',   'Projetos',   1),
  ('FINANCEIRO', 'Financeiro', 2),
  ('COMPRAS',    'Compras',    3),
  ('GESTAO',     'Gestão',     4)
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- Papéis de empresa — cadastro, não CHECK
-- -----------------------------------------------------------------------------
insert into empresa_papel (codigo, nome, ordem) values
  ('GESTORA',      'Gestora',      1),
  ('ADMINISTRADA', 'Administrada', 2),
  ('PARCEIRA',     'Parceira',     3)
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- Categorias de custo
-- -----------------------------------------------------------------------------
insert into categoria_custo (codigo, nome, tipo, ordem) values
  ('EQUIP', 'Equipamento',       'DIRETO',   1),
  ('MAT',   'Material',          'DIRETO',   2),
  ('SERV',  'Serviço',           'DIRETO',   3),
  ('MO',    'Mão de obra',       'DIRETO',   4),
  ('OBRA',  'Obra civil',        'DIRETO',   5),
  ('INST',  'Instalação',        'DIRETO',   6),
  ('FRETE', 'Frete e logística', 'INDIRETO', 7),
  ('PROJ',  'Projeto e consultoria', 'INDIRETO', 8),
  ('TAXA',  'Taxas e licenças',  'INDIRETO', 9),
  ('OUTRO', 'Outros',            'INDIRETO', 10)
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- Critérios de pontuação — o que ordena a fila
-- -----------------------------------------------------------------------------
insert into pontuacao_criterio (codigo, nome, descricao, minimo, maximo, peso, ordem) values
  ('REDUZ_CUSTOS', 'Reduz custos',
   'Quanto o projeto derruba custo recorrente da operação.', 0, 5, 1, 1),
  ('FATURAMENTO',  'Aumenta faturamento',
   'Quanto abre de receita ou de capacidade de venda.', 0, 5, 1, 2),
  ('RISCO',        'Resolve risco',
   'Risco operacional, ambiental ou legal que o projeto elimina.', 0, 5, 1, 3),
  ('OPERACAO',     'Impacta operação',
   'Ganho de produtividade, qualidade ou condição de trabalho.', 0, 5, 1, 4),
  ('ACIDENTE',     'Risco de acidente',
   'Exposição de pessoas que o projeto remove. Peso maior: segurança não entra na fila igual ao resto.',
   0, 5, 1.5, 5),
  ('MARGEM',       'Efeito na margem',
   'Impacto na margem do produto ou do serviço afetado.', 0, 5, 1, 6)
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- Calendário e feriados
-- -----------------------------------------------------------------------------
insert into calendario (nome, padrao)
select 'Padrão — segunda a sexta, 8h', true
 where not exists (select 1 from calendario where padrao);

-- Páscoa por Meeus/Jones/Butcher. É o que ancora carnaval, sexta-feira santa
-- e Corpus Christi — feriados que mudam de data todo ano e que, esquecidos,
-- fazem o cronograma prometer entrega em dia que ninguém trabalha.
create or replace function app.pascoa(p_ano int)
returns date
language plpgsql
immutable
as $$
declare
  a int; b int; c int; d int; e int; f int; g int;
  h int; i int; k int; l int; m int; mes int; dia int;
begin
  a := p_ano % 19;
  b := p_ano / 100;
  c := p_ano % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  mes := (h + l - 7 * m + 114) / 31;
  dia := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_ano, mes, dia);
end;
$$;

create or replace function app.semear_feriados(p_calendario uuid, p_de int, p_ate int)
returns int
language plpgsql
as $$
declare
  ano int;
  pas date;
  n   int := 0;
begin
  for ano in p_de..p_ate loop
    pas := app.pascoa(ano);
    insert into calendario_excecao (calendario_id, data, tipo, descricao) values
      (p_calendario, make_date(ano,  1,  1), 'FERIADO', 'Confraternização Universal'),
      (p_calendario, pas - 48,               'FERIADO', 'Carnaval (segunda)'),
      (p_calendario, pas - 47,               'FERIADO', 'Carnaval (terça)'),
      (p_calendario, pas - 2,                'FERIADO', 'Sexta-feira Santa'),
      (p_calendario, make_date(ano,  4, 21), 'FERIADO', 'Tiradentes'),
      (p_calendario, make_date(ano,  5,  1), 'FERIADO', 'Dia do Trabalho'),
      (p_calendario, pas + 60,               'FERIADO', 'Corpus Christi'),
      (p_calendario, make_date(ano,  9,  7), 'FERIADO', 'Independência'),
      (p_calendario, make_date(ano, 10, 12), 'FERIADO', 'Nossa Senhora Aparecida'),
      (p_calendario, make_date(ano, 11,  2), 'FERIADO', 'Finados'),
      (p_calendario, make_date(ano, 11, 15), 'FERIADO', 'Proclamação da República'),
      (p_calendario, make_date(ano, 11, 20), 'FERIADO', 'Consciência Negra'),
      (p_calendario, make_date(ano, 12, 25), 'FERIADO', 'Natal')
    on conflict (calendario_id, data) do nothing;
    n := n + 13;
  end loop;
  return n;
end;
$$;

comment on function app.semear_feriados(uuid, int, int) is
  'Feriados nacionais, inclusive os móveis. Os municipais e estaduais entram à mão em calendario_excecao.';

do $$
declare v_cal uuid;
begin
  select id into v_cal from calendario where padrao limit 1;
  perform app.semear_feriados(v_cal, extract(year from current_date)::int,
                                     extract(year from current_date)::int + 5);
end $$;

-- -----------------------------------------------------------------------------
-- Montador de fluxo — usado pelos cinco tipos abaixo, e pelo sexto que vier
-- -----------------------------------------------------------------------------
create or replace function app.semear_fluxo(p_tipo text, p_fases jsonb)
returns void
language plpgsql
as $$
declare
  v_tipo   uuid;
  f        jsonb;
  i        int := 0;
  v_ids    uuid[] := '{}';
  v_id     uuid;
  v_arq    uuid;
  j        int;
begin
  select id into v_tipo from tipo_projeto where codigo = p_tipo;
  if v_tipo is null then
    raise exception 'Tipo de projeto % não existe', p_tipo;
  end if;

  for f in select * from jsonb_array_elements(p_fases) loop
    i := i + 1;
    insert into tipo_fase (
      tipo_projeto_id, codigo, nome, ordem, categoria, cor,
      inicial, conclusiva, exige_setores, exige_orcamento, exige_cronograma)
    values (
      v_tipo,
      f->>'codigo',
      f->>'nome',
      i,
      f->>'categoria',
      coalesce(f->>'cor', '#647C85'),
      i = 1,
      coalesce((f->>'conclusiva')::boolean, false),
      coalesce(
        (select array_agg(x) from jsonb_array_elements_text(coalesce(f->'setores','[]'::jsonb)) x),
        '{}'),
      coalesce((f->>'orcamento')::boolean, false),
      coalesce((f->>'cronograma')::boolean, false))
    returning id into v_id;

    v_ids := v_ids || v_id;
  end loop;

  -- A fase de arquivo é a de categoria ARQUIVADO, se houver.
  select tf.id into v_arq
    from tipo_fase tf
   where tf.tipo_projeto_id = v_tipo and tf.categoria = 'ARQUIVADO'
   limit 1;

  -- Avançar e voltar, passo a passo.
  for j in 1..(array_length(v_ids, 1) - 1) loop
    if v_ids[j] is distinct from v_arq and v_ids[j+1] is distinct from v_arq then
      insert into tipo_transicao (de_fase_id, para_fase_id, rotulo, ordem)
      values (v_ids[j], v_ids[j+1], 'Avançar', 1)
      on conflict do nothing;

      insert into tipo_transicao (de_fase_id, para_fase_id, rotulo, ordem, exige_motivo)
      values (v_ids[j+1], v_ids[j], 'Voltar', 2, true)
      on conflict do nothing;
    end if;
  end loop;

  -- Arquivar de qualquer fase; retomar volta para a primeira.
  if v_arq is not null then
    for j in 1..array_length(v_ids, 1) loop
      if v_ids[j] is distinct from v_arq then
        insert into tipo_transicao (de_fase_id, para_fase_id, rotulo, ordem, exige_motivo)
        values (v_ids[j], v_arq, 'Arquivar', 9, true)
        on conflict do nothing;
      end if;
    end loop;
    insert into tipo_transicao (de_fase_id, para_fase_id, rotulo, ordem)
    values (v_arq, v_ids[1], 'Retomar', 1)
    on conflict do nothing;
  end if;
end;
$$;

comment on function app.semear_fluxo(text, jsonb) is
  'Monta fases e transições de um tipo: avançar, voltar, arquivar de qualquer ponto e retomar.';

-- =============================================================================
-- OS CINCO TIPOS
-- =============================================================================

-- 1 · Investimento — o rito que veio do desktop, agora sem faixa de alçada
insert into tipo_projeto (codigo, nome, descricao, cor, ordem,
  usa_etapas, usa_orcamento, usa_cronograma, usa_medicao, usa_recorrencia,
  usa_pontuacao, mede_avanco_por)
values ('INVESTIMENTO', 'Investimento',
  'Aquisição de equipamento, obra e instalação. Todo projeto passa por avaliação, qualquer que seja o valor.',
  '#F25C05', 1, true, true, true, false, false, true, 'DESEMBOLSO')
on conflict (codigo) do nothing;

select app.semear_fluxo('INVESTIMENTO', '[
  {"codigo":"SOLICITACAO","nome":"Solicitação","categoria":"PREPARACAO","cor":"#647C85"},
  {"codigo":"VIABILIDADE","nome":"Viabilidade","categoria":"PREPARACAO","cor":"#009DB0","orcamento":true},
  {"codigo":"AVALIACAO","nome":"Avaliação","categoria":"PREPARACAO","cor":"#F25C05",
   "setores":["PROJETOS","FINANCEIRO","COMPRAS","GESTAO"]},
  {"codigo":"EXECUCAO","nome":"Execução","categoria":"EXECUCAO","cor":"#08313D","cronograma":true},
  {"codigo":"FINALIZACAO","nome":"Finalização","categoria":"ENCERRAMENTO","cor":"#1F7A55","conclusiva":true},
  {"codigo":"ARQUIVADO","nome":"Arquivado","categoria":"ARQUIVADO","cor":"#84979F"}
]'::jsonb);

-- 2 · Obra / físico
insert into tipo_projeto (codigo, nome, descricao, cor, ordem,
  usa_etapas, usa_orcamento, usa_cronograma, usa_medicao, usa_recorrencia,
  usa_pontuacao, mede_avanco_por)
values ('OBRA', 'Obra / físico',
  'Execução física com EAP, quantitativos e medição por item.',
  '#08313D', 2, true, true, true, true, false, true, 'MEDICAO')
on conflict (codigo) do nothing;

select app.semear_fluxo('OBRA', '[
  {"codigo":"PLANEJAMENTO","nome":"Planejamento","categoria":"PREPARACAO","orcamento":true},
  {"codigo":"MOBILIZACAO","nome":"Mobilização","categoria":"EXECUCAO","cronograma":true},
  {"codigo":"EXECUCAO","nome":"Execução","categoria":"EXECUCAO","cor":"#08313D"},
  {"codigo":"COMISSIONAMENTO","nome":"Comissionamento","categoria":"EXECUCAO"},
  {"codigo":"ENTREGA","nome":"Entrega","categoria":"ENCERRAMENTO","cor":"#1F7A55",
   "conclusiva":true,"setores":["PROJETOS"]},
  {"codigo":"ARQUIVADO","nome":"Arquivado","categoria":"ARQUIVADO","cor":"#84979F"}
]'::jsonb);

-- 3 · TI & desenvolvimento
insert into tipo_projeto (codigo, nome, descricao, cor, ordem,
  usa_etapas, usa_orcamento, usa_cronograma, usa_medicao, usa_recorrencia,
  usa_pontuacao, mede_avanco_por)
values ('TI', 'TI & desenvolvimento',
  'Backlog, ciclos e entrega em produção. Sem EAP financeira.',
  '#009DB0', 3, true, false, true, false, false, true, 'TAREFAS')
on conflict (codigo) do nothing;

select app.semear_fluxo('TI', '[
  {"codigo":"BACKLOG","nome":"Backlog","categoria":"PREPARACAO"},
  {"codigo":"PRIORIZADO","nome":"Priorizado","categoria":"PREPARACAO"},
  {"codigo":"DESENVOLVIMENTO","nome":"Desenvolvimento","categoria":"EXECUCAO","cor":"#009DB0"},
  {"codigo":"HOMOLOGACAO","nome":"Homologação","categoria":"EXECUCAO","cor":"#F25C05"},
  {"codigo":"PRODUCAO","nome":"Produção","categoria":"ENCERRAMENTO","cor":"#1F7A55","conclusiva":true},
  {"codigo":"ARQUIVADO","nome":"Arquivado","categoria":"ARQUIVADO","cor":"#84979F"}
]'::jsonb);

-- 4 · Contrato de serviço (sempre de coisa contratada)
insert into tipo_projeto (codigo, nome, descricao, cor, ordem,
  usa_etapas, usa_orcamento, usa_cronograma, usa_medicao, usa_recorrencia,
  usa_pontuacao, mede_avanco_por)
values ('CONTRATO', 'Contrato de serviço',
  'Serviço contratado de terceiro: vigência, entregáveis, medição e aditivos.',
  '#6B4FA8', 4, true, true, true, true, false, true, 'MEDICAO')
on conflict (codigo) do nothing;

select app.semear_fluxo('CONTRATO', '[
  {"codigo":"NEGOCIACAO","nome":"Negociação","categoria":"PREPARACAO","orcamento":true},
  {"codigo":"ASSINATURA","nome":"Assinatura","categoria":"PREPARACAO",
   "setores":["COMPRAS","GESTAO"]},
  {"codigo":"VIGENCIA","nome":"Vigência","categoria":"EXECUCAO","cronograma":true},
  {"codigo":"MEDICAO","nome":"Medição","categoria":"EXECUCAO"},
  {"codigo":"ENCERRAMENTO","nome":"Encerramento","categoria":"ENCERRAMENTO",
   "cor":"#1F7A55","conclusiva":true,"setores":["FINANCEIRO"]},
  {"codigo":"ARQUIVADO","nome":"Arquivado","categoria":"ARQUIVADO","cor":"#84979F"}
]'::jsonb);

-- 5 · Manutenção recorrente
insert into tipo_projeto (codigo, nome, descricao, cor, ordem,
  usa_etapas, usa_orcamento, usa_cronograma, usa_medicao, usa_recorrencia,
  usa_pontuacao, mede_avanco_por)
values ('MANUTENCAO', 'Manutenção recorrente',
  'Ação periódica sobre um ativo, com checklist de inspeção.',
  '#1F7A55', 5, true, false, true, false, true, false, 'CHECKLIST')
on conflict (codigo) do nothing;

select app.semear_fluxo('MANUTENCAO', '[
  {"codigo":"ABERTA","nome":"Aberta","categoria":"PREPARACAO"},
  {"codigo":"PROGRAMADA","nome":"Programada","categoria":"PREPARACAO","cronograma":true},
  {"codigo":"EXECUCAO","nome":"Em execução","categoria":"EXECUCAO"},
  {"codigo":"VERIFICADA","nome":"Verificada","categoria":"ENCERRAMENTO",
   "cor":"#1F7A55","conclusiva":true},
  {"codigo":"ARQUIVADO","nome":"Arquivado","categoria":"ARQUIVADO","cor":"#84979F"}
]'::jsonb);

-- =============================================================================
-- CAMPOS PRÓPRIOS DE CADA TIPO
-- =============================================================================

-- Atalho para não repetir o join em toda linha.
create or replace function app.campo(
  p_tipo text, p_grupo text, p_codigo text, p_rotulo text, p_tipo_dado text,
  p_ordem int, p_exigido_para_sair_de text default null,
  p_opcoes jsonb default '[]'::jsonb, p_ajuda text default null)
returns void
language plpgsql
as $$
declare v_tipo uuid; v_fase uuid;
begin
  select id into v_tipo from tipo_projeto where codigo = p_tipo;
  if p_exigido_para_sair_de is not null then
    select id into v_fase from tipo_fase
     where tipo_projeto_id = v_tipo and codigo = p_exigido_para_sair_de;
  end if;
  insert into campo_definicao
    (tipo_projeto_id, grupo, codigo, rotulo, tipo_dado, ordem, exigido_para_sair_de, opcoes, ajuda)
  values (v_tipo, p_grupo, p_codigo, p_rotulo, p_tipo_dado, p_ordem, v_fase, p_opcoes, p_ajuda)
  on conflict (tipo_projeto_id, codigo) do nothing;
end;
$$;

-- --- Investimento -------------------------------------------------------------
select app.campo('INVESTIMENTO','Proposta','proposta_numero','Número da proposta','TEXTO',1);
select app.campo('INVESTIMENTO','Proposta','proposta_data','Data da proposta','DATA',2);
select app.campo('INVESTIMENTO','Proposta','proposta_validade_dias','Validade (dias)','NUMERO',3);
select app.campo('INVESTIMENTO','Proposta','condicoes_pagamento','Condições de pagamento','TEXTO',4);
select app.campo('INVESTIMENTO','Proposta','frete','Frete','TEXTO',5);
select app.campo('INVESTIMENTO','Proposta','prazo_entrega','Prazo de entrega','TEXTO',6);

select app.campo('INVESTIMENTO','Viabilidade','vi_situacao_atual','Situação atual','TEXTO_LONGO',10,'VIABILIDADE');
select app.campo('INVESTIMENTO','Viabilidade','vi_alternativas','Alternativas consideradas','TEXTO_LONGO',11,'VIABILIDADE');
select app.campo('INVESTIMENTO','Viabilidade','vi_premissas','Premissas','TEXTO_LONGO',12);
select app.campo('INVESTIMENTO','Viabilidade','vi_riscos','Riscos','TEXTO_LONGO',13);
select app.campo('INVESTIMENTO','Viabilidade','vi_economia_mensal','Economia mensal','MOEDA',14);
select app.campo('INVESTIMENTO','Viabilidade','vi_receita_mensal','Receita adicional mensal','MOEDA',15);
select app.campo('INVESTIMENTO','Viabilidade','vi_custo_operacional_mensal','Custo operacional mensal','MOEDA',16);
select app.campo('INVESTIMENTO','Viabilidade','vi_vida_util_anos','Vida útil (anos)','NUMERO',17);
select app.campo('INVESTIMENTO','Viabilidade','vi_conclusao','Conclusão','TEXTO_LONGO',18,'AVALIACAO');
select app.campo('INVESTIMENTO','Viabilidade','vi_recomendacao','Recomendação','SELECAO',19,'AVALIACAO',
  '["APROVAR","APROVAR_COM_RESSALVAS","NAO_APROVAR","POSTERGAR"]'::jsonb);

select app.campo('INVESTIMENTO','Análise financeira','fin_orcamento_disponivel','Há orçamento disponível?','TEXTO_LONGO',20);
select app.campo('INVESTIMENTO','Análise financeira','fin_impacto_caixa','Impacto no caixa','TEXTO_LONGO',21);
select app.campo('INVESTIMENTO','Análise financeira','fin_retorno_previsto','Retorno previsto','TEXTO_LONGO',22);
select app.campo('INVESTIMENTO','Análise financeira','fin_gasto_similar','Já houve gasto similar?','TEXTO_LONGO',23);
select app.campo('INVESTIMENTO','Análise financeira','fin_reaproveitamento','Cabe reaproveitar algo?','TEXTO_LONGO',24);

-- --- Obra ---------------------------------------------------------------------
select app.campo('OBRA','Técnico','art_numero','Número da ART','TEXTO',1,'MOBILIZACAO');
select app.campo('OBRA','Técnico','responsavel_tecnico','Responsável técnico','TEXTO',2,'MOBILIZACAO');
select app.campo('OBRA','Técnico','area_m2','Área (m²)','NUMERO',3);
select app.campo('OBRA','Segurança','normas','Normas aplicáveis','SELECAO_MULTIPLA',4,null,
  '["NR-10","NR-11","NR-12","NR-18","NR-33","NR-35"]'::jsonb,
  'Marque as NR que a execução precisa atender.');
select app.campo('OBRA','Segurança','exige_pt','Exige permissão de trabalho','BOOLEANO',5);

-- --- TI -----------------------------------------------------------------------
select app.campo('TI','Técnico','repositorio','Repositório','TEXTO',1);
select app.campo('TI','Técnico','ambiente','Ambiente de destino','SELECAO',2,'DESENVOLVIMENTO',
  '["LOCAL","HOMOLOGACAO","PRODUCAO"]'::jsonb);
select app.campo('TI','Técnico','versao_alvo','Versão alvo','TEXTO',3);
select app.campo('TI','Entrega','criterio_aceite','Critério de aceite','TEXTO_LONGO',4,'HOMOLOGACAO');

-- --- Contrato -----------------------------------------------------------------
select app.campo('CONTRATO','Contrato','numero_contrato','Número do contrato','TEXTO',1,'ASSINATURA');
select app.campo('CONTRATO','Contrato','vigencia_meses','Vigência (meses)','NUMERO',2,'ASSINATURA');
select app.campo('CONTRATO','Contrato','indice_reajuste','Índice de reajuste','SELECAO',3,null,
  '["IPCA","IGP-M","INCC","INPC","SEM_REAJUSTE"]'::jsonb);
select app.campo('CONTRATO','Contrato','garantia','Garantia contratual','TEXTO',4);
select app.campo('CONTRATO','Contrato','multa_rescisoria','Multa rescisória','TEXTO',5);

-- --- Manutenção ---------------------------------------------------------------
select app.campo('MANUTENCAO','Ativo','equipamento','Equipamento / ativo','TEXTO',1,'ABERTA');
select app.campo('MANUTENCAO','Ativo','tag','TAG do ativo','TEXTO',2);
select app.campo('MANUTENCAO','Programação','periodicidade','Periodicidade','SELECAO',3,'PROGRAMADA',
  '["DIARIA","SEMANAL","QUINZENAL","MENSAL","TRIMESTRAL","SEMESTRAL","ANUAL"]'::jsonb);
select app.campo('MANUTENCAO','Programação','criticidade','Criticidade','SELECAO',4,null,
  '["BAIXA","MEDIA","ALTA","PARADA_DE_LINHA"]'::jsonb);
select app.campo('MANUTENCAO','Programação','parada_necessaria','Exige parar a linha','BOOLEANO',5);
