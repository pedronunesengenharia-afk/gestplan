# Importação do desktop para o GestPlan

Traz a carteira inteira do `gestao_projetos.db` — 29 projetos, 460 etapas,
147 tarefas, 171 custos, 401 parcelas, 92 assinaturas, 30 fornecedores,
16 fotos — para o GestPlan.

Já rodou de ponta a ponta contra um Postgres 16 limpo, duas vezes seguidas,
conferindo contagem e soma com a origem.

## Ordem

```powershell
cd C:\Users\pedro\GestPlan
copy ..\importacao\011_ajustes_para_importacao.sql supabase\migrations\20260827190000_ajustes_para_importacao.sql
copy ..\importacao\012_storage_anexos.sql          supabase\migrations\20260827190100_storage_anexos.sql

rodar_testes.bat          REM as 81 verificações continuam passando com as migrações novas
supabase db push          REM homologação primeiro
```

Depois, no **SQL Editor** do painel (o arquivo tem 1 MB — o editor aguenta,
mas cole em uma aba só e rode uma vez):

```
importacao.sql
```

E por fim os arquivos:

```powershell
set SUPABASE_URL=https://SEU_REF.supabase.co
set SUPABASE_SERVICE_KEY=eyJ...
python subir_anexos.py "%APPDATA%\br.eng.habitual.gestaoprojetos"
```

A `service_role` sai do painel em **Project Settings › API**. Ela escreve por
cima da RLS — por isso vai na linha de comando, no seu terminal, e **nunca** no
`.env` nem em arquivo do repositório.

## Pode rodar de novo à vontade

Cada registro recebe um UUID derivado da tabela e do id de origem. Rodar a
importação duas vezes atualiza, não duplica — testado. É o que permite ensaiar
em homologação quantas vezes quiser e rodar a definitiva no dia da virada com o
desktop fechado.

Se um número não bater com a origem, a transação inteira volta atrás e nada
entra pela metade.

## Sete decisões que a importação tomou

**1. O código do projeto foi preservado.** `2026-014` continua `2026-014` — está
em documento assinado, em e-mail e na cabeça das pessoas. Só os projetos NOVOS
receberão o prefixo da empresa (`CIM-2026-024`). O contador foi acertado para
continuar de onde a numeração parou, não do 1.

**2. `parcela` mudou de forma, e o desktop estava certo.** Eu tinha modelado
valor + vencimento. O desktop modela `40% na aprovação, 30 dias` — uma regra, de
que a data é consequência. Guardar só a data derivada perde o que permite
replanejar. `valor` e `vencimento` passaram a ser opcionais, e entraram
`percentual`, `evento` e `prazo_dias`. As 401 parcelas vieram como regra.

**3. Os nove critérios de pontuação entraram; cinco entraram desligados.**
O banco usa nove notas, em dois blocos criados em momentos diferentes. Os quatro
`pont_*` estão preenchidos em 28 dos 29 projetos; os cinco `imp_*`, em 12 a 23.
Ligar os nove não acrescenta informação — dilui a régua:

| critérios ativos | urgentes | importantes | planejamento |
|---|---|---|---|
| os 4 do desktop (**padrão**) | 10 | 18 | 1 |
| os 9 juntos | 1 | 25 | 3 |
| só os 5 novos | 0 | 19 | 10 |

Com os nove, 25 de 29 viram "importante" e a fila deixa de ordenar. Então o
padrão é a régua que você já usava. **Nenhuma nota se perdeu** — as do outro
bloco estão gravadas, só não contam. Para ligá-las, depois de pontuar os
projetos que faltam:

```sql
update pontuacao_criterio set ativo = true
 where codigo in ('ACIDENTE','MARGEM','IMP_FATURAMENTO','ORGANIZACAO','ARQUITETONICO');
select app.recalcular_prioridade(id) from projeto;
```

O peso 1,5 de "risco de acidente" continua registrado e passa a valer nesse dia.

**4. As 92 assinaturas entraram como CIENTE, não como aprovação.** No desktop
elas não têm data nem decisão — são ciência. E nenhum dos 29 projetos tem
`resultado` preenchido: marcar como aprovado seria inventar um ato que ninguém
praticou.

**5. `frente` e `seguranca` viraram coluna do núcleo.** Classificam qualquer
projeto de qualquer tipo, então não são campo customizado de um tipo. As oito
frentes em uso vieram inteiras.

**6. A validação de campo obrigatório saiu de cena durante a carga.** Os dados
são anteriores às regras e não têm por que satisfazê-las — `vi_recomendacao`
está vazio nos 29. O trigger volta no fim do arquivo; os outros (valor,
auditoria, fase) ficaram ligados o tempo todo.

**7. Um projeto em EXECUÇÃO não passaria pelas regras de hoje.** Não é problema
da importação: é o retrato de um sistema que ficou mais exigente. Quando esses
projetos forem avançar de fase, o banco vai pedir o que falta — e aí é hora de
preencher, não antes.

## Um achado de permissão que a importação revelou

`projeto.campos` guarda campos MOEDA — economia mensal, receita prevista — e a
carteira devolvia o jsonb inteiro a qualquer um que enxergasse o projeto. A
regra do dinheiro valia para as colunas e não valia para o jsonb.

A migração 011 corrige: `vw_projeto` remove as chaves de campo MOEDA quando quem
consulta não tem alcance financeiro.

**Resíduo conhecido:** quem consultar a tabela `projeto` direto, em vez da view,
ainda vê o jsonb inteiro. O front lê `vw_projeto`, então na prática está
coberto — fechar de vez pede tirar o SELECT direto em `projeto.campos`, e isso
é assunto da Fase 1.

## Para desfazer

Todo projeto importado tem `origem_legado` preenchido com o código do desktop.

```sql
delete from projeto where origem_legado is not null;   -- leva junto etapas,
                                                       -- tarefas, custos, tudo
```

Fornecedores, empresas e ideias não têm essa marca — se precisar limpar tudo,
o caminho é recriar o banco de homologação e aplicar as migrações de novo.

O `gestao_projetos.db` original continua intocado no `AppData`. Guarde uma cópia
dele fora do computador antes da virada.

## Arquivos

| | |
|---|---|
| `gerar_importacao.py` | lê o `.db` e escreve o `.sql`. Rode de novo se os dados mudarem |
| `importacao.sql` | o resultado — 17 mil linhas, gerado do banco de 27/08 |
| `011_ajustes_para_importacao.sql` | migração: o que os dados reais exigiram do modelo |
| `012_storage_anexos.sql` | bucket dos anexos e quem alcança cada arquivo |
| `subir_anexos.py` | manda as 16 fotos para o Storage e corrige o caminho |

---

## Correção aplicada em 27/08/2026, na primeira execução real

`subir_anexos.py` montava a URL do Storage com o nome do arquivo cru. Os anexos
vindos do WhatsApp têm espaço e parêntese no nome
(`WhatsApp Image 2026-08-18 at 13.38.07 (1).jpeg`) e o `urllib` recusa:

    http.client.InvalidURL: URL can't contain control characters

O caminho agora vai percent-encoded na URL (`urllib.parse.quote`), e cru no
banco — é o `storage_path` que a política de `storage.objects` compara. As 16
fotos subiram na segunda tentativa, 4841 kB, toda linha de `anexo` com objeto
correspondente.

O `importacao.sql` de 1 MB não está no repositório: é gerado. Para refazê-lo no
dia da virada, com o desktop fechado, rode o `gerar_importacao.py` contra o
`gestao_projetos.db` do AppData.
