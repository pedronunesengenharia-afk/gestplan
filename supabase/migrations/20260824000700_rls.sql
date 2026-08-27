-- =============================================================================
-- GestPlan · 008_rls.sql
-- Funções de autorização e política de acesso por tabela.
--
-- A regra vive no banco. Um bug no front não vaza dado porque o Postgres
-- simplesmente não devolve a linha. Nenhuma tela decide o que pode ser lido.
--
-- As funções são SECURITY DEFINER de propósito: elas leem pessoa_papel por
-- baixo da RLS. Sem isso, a política de pessoa_papel chamaria uma função que lê
-- pessoa_papel, e a consulta entraria em recursão.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Quem sou eu
-- -----------------------------------------------------------------------------
create or replace function app.é_proprietario()
returns boolean language sql stable security definer
set search_path = public, app as $$
  select coalesce((select proprietario from pessoa where id = app.pessoa_atual()), false);
$$;

create or replace function app.fornecedor_atual()
returns uuid language sql stable security definer
set search_path = public, app as $$
  select fornecedor_id from pessoa where id = app.pessoa_atual();
$$;

create or replace function app.é_externo()
returns boolean language sql stable security definer
set search_path = public, app as $$
  select exists (select 1 from pessoa_papel
                  where pessoa_id = app.pessoa_atual() and papel = 'EXTERNO');
$$;

-- EXTERNO fica de fora de propósito. O vínculo do fornecedor com a empresa é
-- administrativo — diz de quem ele é fornecedor, não que ele possa ver a
-- carteira dela. Sem este filtro, um papel EXTERNO em qualquer empresa abriria
-- todos os projetos daquela empresa: o fornecedor entra pelo contrato, e só
-- por ele (ver app.pode_ver_projeto).
create or replace function app.empresas_visiveis()
returns setof uuid language sql stable security definer
set search_path = public, app as $$
  select e.id from empresa e where app.é_proprietario()
  union
  select pp.empresa_id from pessoa_papel pp
   where pp.pessoa_id = app.pessoa_atual()
     and pp.papel <> 'EXTERNO';
$$;

create or replace function app.tem_papel(p_empresa uuid, variadic p_papeis text[])
returns boolean language sql stable security definer
set search_path = public, app as $$
  select app.é_proprietario()
      or exists (select 1 from pessoa_papel
                  where pessoa_id = app.pessoa_atual()
                    and empresa_id = p_empresa
                    and papel = any(p_papeis));
$$;

-- -----------------------------------------------------------------------------
-- Alcance sobre um projeto
-- -----------------------------------------------------------------------------

-- Enxerga: proprietário; quem tem papel numa das empresas do projeto (a
-- principal ou qualquer uma do rateio); e o fornecedor externo, apenas nos
-- projetos onde tem contrato.
create or replace function app.pode_ver_projeto(p_projeto uuid)
returns boolean language sql stable security definer
set search_path = public, app as $$
  select app.é_proprietario()
      or exists (
           select 1 from projeto p
            where p.id = p_projeto
              and (p.empresa_id in (select app.empresas_visiveis())
                or exists (select 1 from projeto_empresa pe
                            where pe.projeto_id = p.id
                              and pe.empresa_id in (select app.empresas_visiveis()))))
      or (app.fornecedor_atual() is not null
          and exists (select 1 from contrato c
                       where c.projeto_id = p_projeto
                         and c.fornecedor_id = app.fornecedor_atual()));
$$;

-- Edita: proprietário, gerente de projetos da empresa, e o time de TI nos
-- projetos do tipo TI. Externo nunca edita o projeto.
create or replace function app.pode_editar_projeto(p_projeto uuid)
returns boolean language sql stable security definer
set search_path = public, app as $$
  select app.é_proprietario()
      or exists (
           select 1
             from projeto p
             join pessoa_papel pp on pp.pessoa_id = app.pessoa_atual()
             join tipo_projeto tp on tp.id = p.tipo_projeto_id
            where p.id = p_projeto
              and (pp.empresa_id = p.empresa_id
                or pp.empresa_id in (select empresa_id from projeto_empresa where projeto_id = p.id))
              and (pp.papel = 'GERENTE_PROJETOS'
                or (pp.papel = 'TIME_TI' and tp.codigo = 'TI')));
$$;

-- Vê dinheiro: proprietário, gerente e financeiro/compras. Estrutura e TI não.
create or replace function app.pode_ver_valores(p_projeto uuid)
returns boolean language sql stable security definer
set search_path = public, app as $$
  select app.é_proprietario()
      or exists (
           select 1
             from projeto p
             join pessoa_papel pp on pp.pessoa_id = app.pessoa_atual()
            where p.id = p_projeto
              and (pp.empresa_id = p.empresa_id
                or pp.empresa_id in (select empresa_id from projeto_empresa where projeto_id = p.id))
              and pp.papel in ('GERENTE_PROJETOS','FINANCEIRO_COMPRAS'));
$$;

-- Alcance INTERNO: tudo que a equipe vê de um projeto. Exclui o fornecedor
-- externo de propósito.
--
-- app.pode_ver_projeto() acima já sabe alcançar o externo pelo contrato — essa
-- é a regra do portal do fornecedor, que a estratégia adiou para depois da
-- virada. Enquanto o portal não existe, a porta fica fechada em vez de
-- entreaberta: com pode_ver_projeto() nas tabelas filhas, o fornecedor
-- enxergaria a EAP inteira do projeto, com o preço de cada item — inclusive os
-- dos concorrentes dele. Quando o portal for construído, o caminho é uma view
-- própria, restrita ao contrato, e não afrouxar estas políticas.
create or replace function app.pode_ver_interno(p_projeto uuid)
returns boolean language sql stable security definer
set search_path = public, app as $$
  select app.pode_ver_projeto(p_projeto) and not app.é_externo();
$$;

comment on function app.pode_ver_valores(uuid) is
  'Porta única do dinheiro. Como os valores moram em projeto_valor e nas tabelas de custo, negar aqui basta — nenhum `select *` distraído devolve margem.';

-- -----------------------------------------------------------------------------
-- Liga a RLS em tudo
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'configuracao','evento','empresa_papel','empresa','pessoa','pessoa_papel','convite',
    'tipo_projeto','tipo_fase','tipo_transicao','campo_definicao',
    'projeto','projeto_valor','projeto_empresa','projeto_fase_hist','projeto_contador',
    'etapa','tarefa','tarefa_dependencia','tarefa_checklist',
    'alocacao','apontamento_hora','comentario','anexo','ocorrencia','ideia',
    'calendario','calendario_excecao','linha_base','linha_base_item',
    'categoria_custo','fornecedor','contrato','contrato_aditivo','parcela','custo',
    'medicao','medicao_item',
    'setor','pontuacao_criterio','projeto_pontuacao','aprovacao','notificacao'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Cadastros de apoio: todo mundo lê, só o proprietário escreve
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'empresa_papel','tipo_projeto','tipo_fase','tipo_transicao','campo_definicao',
    'setor','categoria_custo','pontuacao_criterio','configuracao',
    'calendario','calendario_excecao'
  ] loop
    execute format('create policy %I on %I for select using (app.pessoa_atual() is not null)',
                   t || '_le', t);
    execute format('create policy %I on %I for all using (app.é_proprietario()) with check (app.é_proprietario())',
                   t || '_escreve', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Empresa e pessoas
-- -----------------------------------------------------------------------------
create policy empresa_le on empresa for select
  using (id in (select app.empresas_visiveis()));
create policy empresa_escreve on empresa for all
  using (app.é_proprietario()) with check (app.é_proprietario());

-- Quem é externo só enxerga a si mesmo; o resto da equipe vê a lista interna.
create policy pessoa_le on pessoa for select
  using (
    id = app.pessoa_atual()
    or (not app.é_externo() and (
          app.é_proprietario()
          or exists (select 1 from pessoa_papel pp
                      where pp.pessoa_id = pessoa.id
                        and pp.empresa_id in (select app.empresas_visiveis()))))
  );
create policy pessoa_edita_a_si on pessoa for update
  using (id = app.pessoa_atual()) with check (id = app.pessoa_atual());
create policy pessoa_escreve on pessoa for all
  using (app.é_proprietario()) with check (app.é_proprietario());

create policy pessoa_papel_le on pessoa_papel for select
  using (pessoa_id = app.pessoa_atual() or app.é_proprietario());
create policy pessoa_papel_escreve on pessoa_papel for all
  using (app.é_proprietario()) with check (app.é_proprietario());

create policy convite_proprietario on convite for all
  using (app.é_proprietario()) with check (app.é_proprietario());

-- -----------------------------------------------------------------------------
-- Projeto
-- -----------------------------------------------------------------------------
create policy projeto_le on projeto for select
  using (app.pode_ver_interno(id));
create policy projeto_cria on projeto for insert
  with check (app.tem_papel(empresa_id, 'GERENTE_PROJETOS'));
create policy projeto_edita on projeto for update
  using (app.pode_editar_projeto(id)) with check (app.pode_editar_projeto(id));
create policy projeto_apaga on projeto for delete
  using (app.é_proprietario());

-- O dinheiro do projeto, atrás da sua própria porta.
create policy projeto_valor_le on projeto_valor for select
  using (app.pode_ver_valores(projeto_id));
create policy projeto_valor_escreve on projeto_valor for all
  using (app.pode_ver_valores(projeto_id)) with check (app.pode_ver_valores(projeto_id));

create policy projeto_contador_le on projeto_contador for select
  using (app.pessoa_atual() is not null);
create policy projeto_contador_escreve on projeto_contador for all
  using (app.pessoa_atual() is not null) with check (app.pessoa_atual() is not null);

-- Filhos que seguem a visibilidade do projeto.
do $$
declare t text;
begin
  foreach t in array array[
    'projeto_empresa','projeto_fase_hist','etapa','tarefa',
    'alocacao','apontamento_hora','comentario','anexo','ocorrencia',
    'linha_base','projeto_pontuacao','aprovacao'
  ] loop
    execute format(
      'create policy %I on %I for select using (app.pode_ver_interno(projeto_id))',
      t || '_le', t);
    execute format(
      'create policy %I on %I for all using (app.pode_editar_projeto(projeto_id))
        with check (app.pode_editar_projeto(projeto_id))',
      t || '_escreve', t);
  end loop;
end $$;

-- tarefa_checklist, tarefa_dependencia e linha_base_item não têm projeto_id:
-- a visibilidade vem do pai.
create policy tarefa_checklist_le on tarefa_checklist for select
  using (exists (select 1 from tarefa t where t.id = tarefa_id and app.pode_ver_interno(t.projeto_id)));
create policy tarefa_checklist_escreve on tarefa_checklist for all
  using (exists (select 1 from tarefa t where t.id = tarefa_id and app.pode_ver_interno(t.projeto_id)))
  with check (exists (select 1 from tarefa t where t.id = tarefa_id and app.pode_ver_interno(t.projeto_id)));

create policy linha_base_item_le on linha_base_item for select
  using (exists (select 1 from linha_base b where b.id = linha_base_id and app.pode_ver_interno(b.projeto_id)));
create policy linha_base_item_escreve on linha_base_item for all
  using (exists (select 1 from linha_base b where b.id = linha_base_id and app.pode_editar_projeto(b.projeto_id)))
  with check (exists (select 1 from linha_base b where b.id = linha_base_id and app.pode_editar_projeto(b.projeto_id)));

create policy tarefa_dependencia_le on tarefa_dependencia for select
  using (exists (select 1 from tarefa t where t.id = tarefa_id and app.pode_ver_interno(t.projeto_id)));
create policy tarefa_dependencia_escreve on tarefa_dependencia for all
  using (exists (select 1 from tarefa t where t.id = tarefa_id and app.pode_editar_projeto(t.projeto_id)))
  with check (exists (select 1 from tarefa t where t.id = tarefa_id and app.pode_editar_projeto(t.projeto_id)));

-- Quem executa precisa poder mexer na própria tarefa e apontar hora, mesmo sem
-- ser gerente. São as duas exceções à regra "só quem edita o projeto escreve".
create policy tarefa_responsavel_atualiza on tarefa for update
  using (responsavel_id = app.pessoa_atual())
  with check (responsavel_id = app.pessoa_atual());

create policy apontamento_proprio on apontamento_hora for all
  using (pessoa_id = app.pessoa_atual() and app.pode_ver_interno(projeto_id))
  with check (pessoa_id = app.pessoa_atual() and app.pode_ver_interno(projeto_id));

create policy comentario_proprio on comentario for insert
  with check (pessoa_id = app.pessoa_atual() and app.pode_ver_interno(projeto_id));
create policy comentario_edita_o_seu on comentario for update
  using (pessoa_id = app.pessoa_atual()) with check (pessoa_id = app.pessoa_atual());

create policy anexo_envia on anexo for insert
  with check (app.pode_ver_interno(projeto_id));

create policy ocorrencia_abre on ocorrencia for insert
  with check (app.pode_ver_interno(projeto_id));

-- Ideia é de todo mundo: qualquer um sugere, e vê as suas e as da sua empresa.
create policy ideia_le on ideia for select
  using (app.é_proprietario()
      or empresa_id is null
      or empresa_id in (select app.empresas_visiveis()));
create policy ideia_cria on ideia for insert
  with check (app.pessoa_atual() is not null);
create policy ideia_edita on ideia for update
  using (app.é_proprietario() or autor_id = app.pessoa_atual())
  with check (app.é_proprietario() or autor_id = app.pessoa_atual());

-- -----------------------------------------------------------------------------
-- Dinheiro — porta separada
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['parcela','custo','medicao'] loop
    execute format(
      'create policy %I on %I for select using (app.pode_ver_valores(projeto_id))',
      t || '_le', t);
    execute format(
      'create policy %I on %I for all using (app.pode_ver_valores(projeto_id))
        with check (app.pode_ver_valores(projeto_id))',
      t || '_escreve', t);
  end loop;
end $$;

-- Contrato: quem vê valores no projeto, e o fornecedor no contrato dele.
create policy contrato_le on contrato for select
  using (app.pode_ver_valores(projeto_id)
      or fornecedor_id = app.fornecedor_atual());
create policy contrato_escreve on contrato for all
  using (app.pode_ver_valores(projeto_id)) with check (app.pode_ver_valores(projeto_id));

create policy contrato_aditivo_le on contrato_aditivo for select
  using (exists (select 1 from contrato c where c.id = contrato_id
                  and (app.pode_ver_valores(c.projeto_id) or c.fornecedor_id = app.fornecedor_atual())));
create policy contrato_aditivo_escreve on contrato_aditivo for all
  using (exists (select 1 from contrato c where c.id = contrato_id and app.pode_ver_valores(c.projeto_id)))
  with check (exists (select 1 from contrato c where c.id = contrato_id and app.pode_ver_valores(c.projeto_id)));

create policy medicao_item_le on medicao_item for select
  using (exists (select 1 from medicao m where m.id = medicao_id and app.pode_ver_valores(m.projeto_id)));
create policy medicao_item_escreve on medicao_item for all
  using (exists (select 1 from medicao m where m.id = medicao_id and app.pode_ver_valores(m.projeto_id)))
  with check (exists (select 1 from medicao m where m.id = medicao_id and app.pode_ver_valores(m.projeto_id)));

-- Fornecedor: a equipe interna lê; o externo só a si.
create policy fornecedor_le on fornecedor for select
  using ((not app.é_externo() and app.pessoa_atual() is not null)
      or id = app.fornecedor_atual());
create policy fornecedor_escreve on fornecedor for all
  using (app.é_proprietario()
      or exists (select 1 from pessoa_papel where pessoa_id = app.pessoa_atual()
                  and papel in ('GERENTE_PROJETOS','FINANCEIRO_COMPRAS')))
  with check (app.é_proprietario()
      or exists (select 1 from pessoa_papel where pessoa_id = app.pessoa_atual()
                  and papel in ('GERENTE_PROJETOS','FINANCEIRO_COMPRAS')));

-- -----------------------------------------------------------------------------
-- Notificação e auditoria
-- -----------------------------------------------------------------------------
create policy notificacao_propria on notificacao for select
  using (pessoa_id = app.pessoa_atual());
create policy notificacao_marca_lida on notificacao for update
  using (pessoa_id = app.pessoa_atual()) with check (pessoa_id = app.pessoa_atual());

-- Só leitura, e só de quem tem alcance sobre o registro.
-- Não existe policy de INSERT, UPDATE nem DELETE: a trilha é intocável pela
-- aplicação. Quem escreve nela é o trigger de 001, que roda como dono da
-- função e por isso passa por cima da RLS.
create policy evento_le on evento for select
  using (app.é_proprietario()
      or (tabela = 'projeto' and app.pode_ver_interno(registro_id)));

-- -----------------------------------------------------------------------------
-- Os GRANT para o papel `authenticated` ficam no fim de 009, depois que as
-- views existirem: `grant on all tables` só alcança o que já foi criado, e a
-- view criada depois nasceria sem permissão nenhuma.
-- -----------------------------------------------------------------------------
