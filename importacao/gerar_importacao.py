#!/usr/bin/env python3
"""
GestPlan · gerador da importação do sistema desktop

Lê o `gestao_projetos.db` do app Tauri e escreve UM arquivo .sql que, rodado
contra o GestPlan, traz a carteira inteira.

Duas propriedades que valem mais que a elegância do código:

1. É REPETÍVEL. Cada registro recebe um UUID derivado da tabela e do id de
   origem (uuid5, namespace fixo). Rodar duas vezes não duplica nada: o segundo
   `on conflict do update` só reescreve o que mudou na origem. Isso é o que
   permite ensaiar a importação dezenas de vezes em homologação e rodar a
   definitiva no dia da virada sem medo.

2. É CONFERÍVEL. O arquivo termina com um bloco que compara contagens e somas
   com os números da origem, gravados aqui na geração. Se algo não bater, a
   transação aborta e nada entra pela metade.

Uso:
    python gerar_importacao.py origem.db > importacao.sql
"""

import sqlite3
import sys
import uuid
from datetime import date

# Namespace fixo: o mesmo id de origem tem de gerar sempre o mesmo UUID, hoje
# e daqui a três meses. Trocar esta constante quebra a repetibilidade.
NS = uuid.UUID("6e8bc430-9c3a-11d9-9669-0800200c9a66")

MAPA_FASE = {
    "VIABILIDADE": "VIABILIDADE",
    "EXECUCAO": "EXECUCAO",
    "FINALIZACAO": "FINALIZACAO",
    "FINALIZADO": "FINALIZACAO",   # o desktop separou as duas; aqui é uma só
    "ARQUIVADO": "ARQUIVADO",
}

# Categorias com o mesmo sentido e código diferente. ADM entra pela migração 011.
MAPA_CATEGORIA = {
    "MAT": "MAT", "MO": "MO", "EQP": "EQUIP", "SUB": "SERV",
    "TRP": "FRETE", "ADM": "ADM", "TAX": "TAXA", "OUT": "OUTRO",
}

# projeto.<coluna> → chave em projeto.campos, para o tipo Investimento.
# numero_contrato e valor_entrada ficam de fora de propósito: o primeiro está
# vazio na origem, o segundo é dinheiro e vai para projeto_valor (decisão 04).
CAMPOS_TEXTO = [
    "proposta_numero", "condicoes_pagamento", "frete", "prazo_entrega",
    "vi_situacao_atual", "vi_alternativas", "vi_premissas", "vi_riscos",
    "vi_conclusao", "vi_recomendacao",
    "fin_orcamento_disponivel", "fin_impacto_caixa", "fin_retorno_previsto",
    "fin_gasto_similar", "fin_reaproveitamento",
]
CAMPOS_DATA = ["proposta_data", "vi_data"]
CAMPOS_NUMERO = [
    "proposta_validade_dias", "vi_economia_mensal", "vi_receita_mensal",
    "vi_custo_operacional_mensal", "vi_vida_util_anos",
]

# coluna de origem → (código do critério, coluna de justificativa)
CRITERIOS = [
    ("pont_reduz_custos",  "REDUZ_CUSTOS",    "just_reduz_custos"),
    ("pont_faturamento",   "FATURAMENTO",     "just_faturamento"),
    ("pont_risco",         "RISCO",           "just_risco"),
    ("pont_operacao",      "OPERACAO",        "just_operacao"),
    ("imp_risco_acidente", "ACIDENTE",        None),
    ("imp_margem",         "MARGEM",          None),
    ("imp_faturamento",    "IMP_FATURAMENTO", None),
    ("imp_organizacao",    "ORGANIZACAO",     None),
    ("imp_arquitetonico",  "ARQUITETONICO",   None),
]


def uid(tabela: str, ident) -> str:
    return str(uuid.uuid5(NS, f"{tabela}:{ident}"))


def lit(v) -> str:
    """Literal SQL. Nunca interpola sem escapar — a origem tem aspas em texto."""
    if v is None or v == "":
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def data_lit(v) -> str:
    if not v:
        return "null"
    return lit(str(v)[:10])


def prefixo(nome: str) -> str:
    letras = [c for c in nome.upper() if c.isalpha()]
    return "".join(letras[:3]) or "EMP"


def json_campos(p) -> str:
    itens = []
    for c in CAMPOS_TEXTO:
        if p[c]:
            itens.append(f"{lit(c)}, {lit(p[c])}")
    for c in CAMPOS_DATA:
        if p[c]:
            itens.append(f"{lit(c)}, to_jsonb({data_lit(p[c])}::text)")
    for c in CAMPOS_NUMERO:
        if p[c] not in (None, 0, ""):
            itens.append(f"{lit(c)}, to_jsonb({p[c]}::numeric)")
    if not itens:
        return "'{}'::jsonb"
    return "jsonb_build_object(" + ", ".join(itens) + ")"


def main(caminho: str) -> None:
    con = sqlite3.connect(caminho)
    con.row_factory = sqlite3.Row
    q = lambda s: list(con.execute(s))
    w = sys.stdout.write

    empresas = q("select * from empresa")
    fornecedores = q("select * from fornecedor")
    projetos = q("select * from projeto")
    proj_emp = q("select * from projeto_empresa")
    eaps = q("select * from eap order by nivel, ordem, id")
    parcelas = q("select p.*, e.projeto_id from parcela_pagamento p join eap e on e.id = p.eap_id")
    tarefas = q("select * from tarefa order by id")
    custos = q("select * from custo_realizado")
    assin = q("select * from projeto_assinatura")
    docs = q("select * from documento")
    ideias = q("select * from ideia")
    hist = q("select * from projeto_fase_hist order by data, id")
    categorias = {r["id"]: r["codigo"] for r in q("select * from categoria_custo")}

    principal = {r["projeto_id"]: r["empresa_id"] for r in proj_emp if r["principal"]}

    w(f"""-- =============================================================================
-- GestPlan · importação do sistema desktop
-- Gerado por gerar_importacao.py a partir de {caminho}
-- Origem: {len(projetos)} projetos, {len(eaps)} etapas, {len(tarefas)} tarefas,
--         {len(custos)} custos, {len(parcelas)} parcelas.
--
-- Repetível: rodar de novo atualiza, não duplica.
-- Confere no fim: se um número não bater, a transação inteira volta atrás.
--
-- Exige a migração 011_ajustes_para_importacao.sql aplicada antes.
-- =============================================================================

begin;

-- Os dados são anteriores às regras de campo obrigatório do GestPlan, e não
-- têm por que satisfazê-las: `vi_recomendacao`, por exemplo, está vazio em
-- todos os 29 projetos. O trigger sai de cena durante a carga e volta no fim.
-- Os demais continuam ligados — o de valor, o de auditoria e o de fase.
alter table projeto disable trigger projeto_validacao_campos;

""")

    # ---------- empresa ----------
    w("-- ---------- empresas ----------\n")
    for e in empresas:
        w(f"""insert into empresa (id, nome, prefixo, razao_social, cnpj, cidade, uf,
       endereco, papel_id, ativo)
values ({lit(uid('empresa', e['id']))}, {lit(e['nome'])}, {lit(prefixo(e['nome']))},
        {lit(e['razao_social'])}, {lit(e['cnpj'])}, {lit(e['cidade'])}, {lit(e['uf'])},
        {lit(e['endereco'])},
        (select id from empresa_papel where codigo = {lit(e['tipo'] or 'ADMINISTRADA')}),
        {lit(bool(e['ativo']))})
on conflict (id) do update set
  nome = excluded.nome, razao_social = excluded.razao_social, cnpj = excluded.cnpj,
  cidade = excluded.cidade, uf = excluded.uf, ativo = excluded.ativo;
""")

    # ---------- fornecedor ----------
    w("\n-- ---------- fornecedores ----------\n")
    for f in fornecedores:
        w(f"""insert into fornecedor (id, nome, razao_social, cnpj_cpf, tipo, contato_nome,
       contato_email, contato_fone, cidade, uf, observacao, ativo)
values ({lit(uid('fornecedor', f['id']))}, {lit(f['nome'])}, {lit(f['razao_social'])},
        {lit(f['cnpj_cpf'])}, {lit(f['tipo'])}, {lit(f['contato_nome'])},
        {lit(f['contato_email'])}, {lit(f['contato_fone'])}, {lit(f['cidade'])},
        {lit(f['uf'])}, {lit(f['observacao'])}, {lit(bool(f['ativo']))})
on conflict (id) do update set
  nome = excluded.nome, cnpj_cpf = excluded.cnpj_cpf, tipo = excluded.tipo,
  contato_nome = excluded.contato_nome, contato_fone = excluded.contato_fone,
  ativo = excluded.ativo;
""")

    # ---------- projeto ----------
    w("\n-- ---------- projetos ----------\n")
    w("""-- O código de origem (2026-014) é preservado: ele está em documento assinado,
-- em e-mail e na cabeça das pessoas. O gerador do GestPlan respeita código
-- informado; só os projetos NOVOS receberão o prefixo da empresa.
""")
    for p in projetos:
        emp = principal.get(p["id"])
        if emp is None:
            continue
        cod = p["codigo"] or ""
        try:
            ano, num = cod.split("-")[0], int(cod.split("-")[1])
        except (ValueError, IndexError):
            ano, num = str(date.today().year), p["id"]
        fase = MAPA_FASE.get(p["fase"] or "VIABILIDADE", "VIABILIDADE")
        w(f"""insert into projeto (id, codigo, origem_legado, numero, ano, nome, tipo_projeto_id, fase_id,
       empresa_id, projeto_pai_id, setor, frente, seguranca, descricao, objetivo, problema,
       beneficios, local, cidade, uf, campos, data_solicitacao, data_inicio_prev,
       data_fim_prev, data_inicio_real, data_fim_real, observacao, criado_em)
values ({lit(uid('projeto', p['id']))}, {lit(cod)}, {lit(cod)}, {num}, {int(ano)}, {lit(p['nome'])},
        (select id from tipo_projeto where codigo = 'INVESTIMENTO'),
        (select f.id from tipo_fase f join tipo_projeto t on t.id = f.tipo_projeto_id
          where t.codigo = 'INVESTIMENTO' and f.codigo = {lit(fase)}),
        {lit(uid('empresa', emp))},
        {lit(uid('projeto', p['projeto_pai_id'])) if p['projeto_pai_id'] else 'null'},
        {lit(p['setor'])}, {lit(p['frente'])}, {lit(bool(p['seguranca']))},
        {lit(p['descricao'])}, {lit(p['objetivo'])}, {lit(p['problema'])},
        {lit(p['beneficios'])}, {lit(p['local_obra'])}, {lit(p['cidade'])}, {lit(p['uf'])},
        {json_campos(p)},
        {data_lit(p['data_solicitacao'])}, {data_lit(p['data_inicio_prev'])},
        {data_lit(p['data_fim_prev'])}, {data_lit(p['data_inicio_real'])},
        {data_lit(p['data_fim_real'])}, {lit(p['observacao'])},
        coalesce({lit(p['criado_em'])}::timestamptz, now()))
on conflict (id) do update set
  nome = excluded.nome, setor = excluded.setor, frente = excluded.frente,
  seguranca = excluded.seguranca, descricao = excluded.descricao,
  objetivo = excluded.objetivo, problema = excluded.problema,
  beneficios = excluded.beneficios, local = excluded.local,
  campos = excluded.campos, fase_id = excluded.fase_id,
  data_solicitacao = excluded.data_solicitacao,
  data_inicio_prev = excluded.data_inicio_prev, data_fim_prev = excluded.data_fim_prev;

update projeto_valor set
  valor_estimado = {p['valor_estimado'] or 0},
  valor_aprovado = {p['valor_aprovado'] or 0},
  valor_revisoes = {p['valor_revisoes'] or 0},
  valor_entrada  = {p['valor_entrada'] if p['valor_entrada'] else 'null'}
 where projeto_id = {lit(uid('projeto', p['id']))};
""")

    # ---------- rateio ----------
    w("\n-- ---------- rateio entre empresas ----------\n")
    for r in proj_emp:
        w(f"""insert into projeto_empresa (id, projeto_id, empresa_id, percentual, observacao)
values ({lit(uid('projeto_empresa', r['id']))}, {lit(uid('projeto', r['projeto_id']))},
        {lit(uid('empresa', r['empresa_id']))}, {r['percentual']}, {lit(r['observacao'])})
on conflict (id) do update set percentual = excluded.percentual;
""")

    # ---------- etapas ----------
    w("\n-- ---------- etapas (EAP e orçamento, agora uma coisa só) ----------\n")
    for e in eaps:
        w(f"""insert into etapa (id, projeto_id, pai_id, codigo, nome, nivel, ordem, folha,
       unidade, quantidade, preco_unitario, peso_percentual, a_confirmar)
values ({lit(uid('eap', e['id']))}, {lit(uid('projeto', e['projeto_id']))},
        {lit(uid('eap', e['pai_id'])) if e['pai_id'] else 'null'},
        {lit(e['codigo'])}, {lit(e['descricao'])}, {e['nivel']}, {e['ordem']},
        {lit(bool(e['is_folha']))}, {lit(e['unidade'])}, {e['quantidade']},
        {e['preco_unitario']}, {e['peso_percentual']}, {lit(bool(e['a_confirmar']))})
on conflict (id) do update set
  nome = excluded.nome, quantidade = excluded.quantidade,
  preco_unitario = excluded.preco_unitario, peso_percentual = excluded.peso_percentual,
  a_confirmar = excluded.a_confirmar;
""")

    # ---------- parcelas ----------
    w("\n-- ---------- parcelas (regra de pagamento, não data) ----------\n")
    for r in parcelas:
        w(f"""insert into parcela (id, projeto_id, etapa_id, numero, descricao,
       percentual, evento, prazo_dias)
values ({lit(uid('parcela', r['id']))}, {lit(uid('projeto', r['projeto_id']))},
        {lit(uid('eap', r['eap_id']))}, {r['ordem']}, {lit(r['descricao'])},
        {r['percentual']}, {lit(r['evento'])}, {r['prazo_dias'] or 0})
on conflict (id) do update set
  percentual = excluded.percentual, evento = excluded.evento,
  prazo_dias = excluded.prazo_dias, descricao = excluded.descricao;
""")

    # ---------- tarefas ----------
    w("\n-- ---------- tarefas ----------\n")
    for t in tarefas:
        w(f"""insert into tarefa (id, projeto_id, etapa_id, pai_id, codigo, nome, marco,
       caminho_critico, data_inicio_prev, data_fim_prev, data_inicio_real,
       data_fim_real, duracao_dias, percentual_concluido, status, ordem, observacao)
values ({lit(uid('tarefa', t['id']))}, {lit(uid('projeto', t['projeto_id']))},
        {lit(uid('eap', t['eap_id'])) if t['eap_id'] else 'null'},
        {lit(uid('tarefa', t['pai_id'])) if t['pai_id'] else 'null'},
        {lit(t['codigo'])}, {lit(t['nome'])}, {lit(bool(t['is_marco']))},
        {lit(bool(t['is_caminho_critico']))},
        {data_lit(t['data_inicio_prev'])}, {data_lit(t['data_fim_prev'])},
        {data_lit(t['data_inicio_real'])}, {data_lit(t['data_fim_real'])},
        {t['duracao_dias'] if t['duracao_dias'] else 'null'},
        {t['percentual_concluido'] or 0}, {lit(t['status'])}, {t['ordem'] or 0},
        {lit(t['observacao'])})
on conflict (id) do update set
  nome = excluded.nome, status = excluded.status,
  percentual_concluido = excluded.percentual_concluido,
  data_inicio_prev = excluded.data_inicio_prev, data_fim_prev = excluded.data_fim_prev;
""")

    # ---------- custos ----------
    w("\n-- ---------- custos realizados ----------\n")
    for c in custos:
        cat = MAPA_CATEGORIA.get(categorias.get(c["categoria_id"], "OUT"), "OUTRO")
        w(f"""insert into custo (id, projeto_id, categoria_id, fornecedor_id, origem, data,
       documento, descricao, quantidade, unidade, preco_unitario, valor,
       status_pagamento, vencimento, pago_em, observacao)
values ({lit(uid('custo', c['id']))}, {lit(uid('projeto', c['projeto_id']))},
        (select id from categoria_custo where codigo = {lit(cat)}),
        {lit(uid('fornecedor', c['fornecedor_id'])) if c['fornecedor_id'] else 'null'},
        {lit(c['origem'] or 'IMPORTACAO')}, {data_lit(c['data'])}, {lit(c['documento'])},
        {lit(c['descricao'])}, {c['quantidade'] or 0}, {lit(c['unidade'])},
        {c['preco_unitario'] or 0}, {c['valor']}, {lit(c['status_pagamento'])},
        {data_lit(c['data_vencimento'])}, {data_lit(c['data_pagamento'])},
        {lit(c['observacao'])})
on conflict (id) do update set
  valor = excluded.valor, status_pagamento = excluded.status_pagamento,
  pago_em = excluded.pago_em, descricao = excluded.descricao;
""")

    # ---------- pareceres ----------
    w("""
-- ---------- assinaturas de ciência ----------
-- O desktop guarda quatro assinaturas por projeto, sem data e sem decisão: são
-- ciência, não aprovação. Entram como CIENTE na fase de Avaliação, que é a que
-- elas destravam no GestPlan. Marcá-las como APROVADO seria inventar um ato que
-- ninguém praticou — e nenhum dos 29 projetos tem `resultado` preenchido.
""")
    crit_proj = {p["id"]: p for p in projetos}
    for a in assin:
        p = crit_proj.get(a["projeto_id"])
        if not p:
            continue
        w(f"""insert into aprovacao (id, projeto_id, fase_id, setor_codigo, nome_avulso, decisao, em)
values ({lit(uid('assinatura', a['id']))}, {lit(uid('projeto', a['projeto_id']))},
        (select f.id from tipo_fase f join tipo_projeto t on t.id = f.tipo_projeto_id
          where t.codigo = 'INVESTIMENTO' and f.codigo = 'AVALIACAO'),
        {lit(a['setor'])}, {lit(a['nome'])}, 'CIENTE',
        coalesce({data_lit(a['data'])}::timestamptz, {lit(p['criado_em'])}::timestamptz, now()))
on conflict (id) do update set nome_avulso = excluded.nome_avulso;
""")

    # ---------- pontuação ----------
    w("\n-- ---------- pontuação (nove critérios, os que a origem usa) ----------\n")
    for p in projetos:
        for col, codigo, just in CRITERIOS:
            nota = p[col] or 0
            if nota <= 0:
                continue
            w(f"""insert into projeto_pontuacao (id, projeto_id, criterio_id, nota, justificativa)
values ({lit(uid('pontuacao', f"{p['id']}:{codigo}"))}, {lit(uid('projeto', p['id']))},
        (select id from pontuacao_criterio where codigo = {lit(codigo)}),
        {nota}, {lit(p[just]) if just else 'null'})
on conflict (id) do update set nota = excluded.nota, justificativa = excluded.justificativa;
""")

    # ---------- anexos ----------
    w("""
-- ---------- anexos ----------
-- O caminho preservado é o do disco do desktop. Os arquivos em si sobem para o
-- Storage num passo à parte (subir_anexos.py) — a linha entra agora para o
-- vínculo com o projeto não se perder, que é o que mais some em migração.
""")
    for d in docs:
        w(f"""insert into anexo (id, projeto_id, tipo, titulo, storage_path, data_documento,
       autor, secao, ordem, observacao)
values ({lit(uid('documento', d['id']))}, {lit(uid('projeto', d['projeto_id']))},
        {lit(d['tipo'])}, {lit(d['titulo'])}, {lit(d['caminho_arquivo'])},
        {data_lit(d['data_documento'])}, {lit(d['autor'])}, {lit(d['secao'])},
        {d['ordem'] or 0}, {lit(d['observacao'])})
on conflict (id) do update set titulo = excluded.titulo, secao = excluded.secao;
""")

    # ---------- ideias ----------
    w("\n-- ---------- banco de ideias ----------\n")
    for i in ideias:
        w(f"""insert into ideia (id, titulo, descricao, local, empresa_id, autor_nome,
       valor_estimado, situacao, motivo, projeto_id, data)
values ({lit(uid('ideia', i['id']))}, {lit(i['titulo'])}, {lit(i['descricao'])},
        {lit(i['local'])},
        {lit(uid('empresa', i['empresa_id'])) if i['empresa_id'] else 'null'},
        {lit(i['autor'])}, {i['valor_estimado'] or 'null'}, {lit(i['situacao'])},
        {lit(i['motivo'])},
        {lit(uid('projeto', i['projeto_id'])) if i['projeto_id'] else 'null'},
        {data_lit(i['data'])})
on conflict (id) do update set situacao = excluded.situacao, motivo = excluded.motivo;
""")

    # ---------- histórico de fases ----------
    w("\n-- ---------- histórico de fases ----------\n")
    for h in hist:
        de = MAPA_FASE.get(h["fase_de"]) if h["fase_de"] else None
        para = MAPA_FASE.get(h["fase_para"], "VIABILIDADE")
        w(f"""insert into projeto_fase_hist (id, projeto_id, de_fase_id, para_fase_id, motivo, observacao, em)
values ({lit(uid('fase_hist', h['id']))}, {lit(uid('projeto', h['projeto_id']))},
        {"(select f.id from tipo_fase f join tipo_projeto t on t.id=f.tipo_projeto_id where t.codigo='INVESTIMENTO' and f.codigo=" + lit(de) + ")" if de else "null"},
        (select f.id from tipo_fase f join tipo_projeto t on t.id=f.tipo_projeto_id
          where t.codigo='INVESTIMENTO' and f.codigo={lit(para)}),
        {lit(h['motivo'])}, {lit(h['observacao'])}, {lit(h['data'])}::timestamptz)
on conflict (id) do nothing;
""")

    # ---------- histórico automático ----------
    w("""
-- Inserir projeto dispara `app.registrar_fase`, que grava "entrou na fase X"
-- com a data de hoje. É verdade — o projeto entrou no GestPlan hoje —, mas não
-- é a história dele. Fica marcado como IMPORTACAO para não se confundir com as
-- transições reais, que vieram do desktop logo acima.
update projeto_fase_hist h
   set motivo = 'IMPORTACAO'
  from projeto p
 where p.id = h.projeto_id
   and p.origem_legado is not null
   and h.motivo is null
   and h.de_fase_id is null;
""")

    # ---------- contador ----------
    w("""
-- ---------- contador de código ----------
-- Os projetos novos precisam continuar de onde a numeração parou, e não do 1.
insert into projeto_contador (empresa_id, ano, ultimo)
select p.empresa_id, p.ano, max(p.numero) from projeto p
 where p.origem_legado is not null group by 1, 2
on conflict (empresa_id, ano) do update
   set ultimo = greatest(projeto_contador.ultimo, excluded.ultimo);

alter table projeto enable trigger projeto_validacao_campos;
""")

    # ---------- conferência ----------
    soma_est = sum(p["valor_estimado"] or 0 for p in projetos)
    soma_orc = sum(
        (e["quantidade"] or 0) * (e["preco_unitario"] or 0) for e in eaps if e["is_folha"]
    )
    soma_cus = sum(c["valor"] or 0 for c in custos)
    n_pont = sum(1 for p in projetos for col, _, _ in CRITERIOS if (p[col] or 0) > 0)
    ids_hist = ", ".join(lit(uid("fase_hist", h["id"])) for h in hist) or "null"

    w(f"""
-- =============================================================================
-- Conferência — números da ORIGEM, gravados na geração deste arquivo.
-- Não bateu, nada entra: a transação inteira volta atrás.
-- =============================================================================
do $$
declare
  d record;
  falhas text[] := '{{}}';
begin
  for d in
    select * from (values
      ('empresas',      {len(empresas)}::bigint, (select count(*) from empresa)),
      ('fornecedores',  {len(fornecedores)},     (select count(*) from fornecedor)),
      ('projetos',      {len(projetos)},         (select count(*) from projeto where origem_legado is not null)),
      ('rateios',       {len(proj_emp)},         (select count(*) from projeto_empresa)),
      ('etapas',        {len(eaps)},             (select count(*) from etapa)),
      ('parcelas',      {len(parcelas)},         (select count(*) from parcela)),
      ('tarefas',       {len(tarefas)},          (select count(*) from tarefa)),
      ('custos',        {len(custos)},           (select count(*) from custo)),
      ('assinaturas',   {len(assin)},            (select count(*) from aprovacao)),
      ('anexos',        {len(docs)},             (select count(*) from anexo)),
      ('ideias',        {len(ideias)},           (select count(*) from ideia)),
      ('hist. de fase', {len(hist)},             (select count(*) from projeto_fase_hist
                                                   where id in ({ids_hist}))),
      ('pontuações',    {n_pont},                (select count(*) from projeto_pontuacao))
    ) as t(o_que, na_origem, no_destino)
  loop
    if d.na_origem <> d.no_destino then
      falhas := falhas || format('%s: origem %s, destino %s', d.o_que, d.na_origem, d.no_destino);
    else
      raise notice '  ok  % — % registros', d.o_que, d.no_destino;
    end if;
  end loop;

  -- Somas: contagem igual com soma diferente é o erro que passa despercebido.
  for d in
    select * from (values
      ('valor estimado',  {soma_est:.2f}::numeric, (select coalesce(sum(valor_estimado),0) from projeto_valor)),
      ('orçamento',       {soma_orc:.2f},          (select coalesce(sum(valor),0) from etapa where folha)),
      ('custo realizado', {soma_cus:.2f},          (select coalesce(sum(valor),0) from custo))
    ) as t(o_que, na_origem, no_destino)
  loop
    if round(d.na_origem, 2) <> round(d.no_destino, 2) then
      falhas := falhas || format('%s: origem %s, destino %s', d.o_que, d.na_origem, d.no_destino);
    else
      raise notice '  ok  % — R$ %', d.o_que, to_char(d.no_destino, 'FM999G999G999D00');
    end if;
  end loop;

  if array_length(falhas, 1) > 0 then
    raise exception E'A importação não fecha com a origem:\\n  %',
      array_to_string(falhas, E'\\n  ');
  end if;

  raise notice '';
  raise notice '  Importação conferida. % projetos.', {len(projetos)};
end $$;

commit;
""")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "origem.db")
