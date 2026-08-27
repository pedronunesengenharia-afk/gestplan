# Fase 1 — os comandos que faltam

Itens 4 a 10, prontos para colar no Claude Code. **Um por sessão.**

Depois de cada um:

```powershell
npm run dev
rodar_testes.bat              # se mexeu no banco
git add . && git commit -m "..."
npm run tipos:remoto          # se mexeu no schema
```

Os itens 1, 2 e 3 já estão feitos. As conferências de tela usam os dados
reais importados — os números entre parênteses são o que você deve ver.

---

## 4 · Etapas: a EAP e o orçamento

```
Item 4 da Fase 1: a tela de etapas do projeto.

Leia antes: CLAUDE.md, src/lib/banco.ts, src/paginas/Projeto.tsx e a tabela
`etapa` na migração 20260824000300_projeto.sql.

O QUE FAZER

1. `src/paginas/Etapas.tsx`: a árvore de etapas de um projeto, com criar,
   editar, excluir e reordenar. Um nível pode ter filhos; a profundidade
   aparece pelo recuo, como já está na tela de detalhe.

2. Orçamento só quando o tipo pede. Unidade, quantidade, preço unitário,
   peso e "a confirmar" só aparecem se `tipo_projeto.usa_orcamento`. Num
   projeto de TI a mesma tela mostra só código, nome, ordem e percentual.

3. Somatórios. Subtotal por grupo (etapa não-folha soma os filhos) e total do
   projeto. `etapa.valor` é coluna gerada — nunca escreva nela; some no
   cliente para exibir e deixe o banco calcular.

4. O peso e o avanço. `peso_percentual` pondera o avanço físico; mostre
   quanto os pesos somam e avise quando não fecharem 100 dentro do mesmo pai.
   Não bloqueie — o banco não exige, e projeto em rascunho tem peso solto.

5. Excluir etapa com filhos leva os filhos junto (é `on delete cascade`).
   Diga isso na confirmação, com quantos descendentes vão junto.

REGRAS

- Nada de `if` por código de tipo: quem decide o que aparece é
  `usa_orcamento`, lido do banco.
- Reordenar grava `ordem`; não invente uma ordem implícita por código.
- Preço de item marcado `a_confirmar` aparece com a marca em toda parte onde
  o valor aparece — inclusive no total, que deve dizer quanto do total ainda
  é palpite.

CONFERIR NA TELA

- 2026-007 (Cimentpav, R$ 1.139.100,00 orçado, o maior da carteira)
- um projeto de tipo TI criado à mão: a mesma tela sem coluna de dinheiro
- criar etapa filha e ver o total do pai subir
- ESTRUTURA não vê valor: entre com um usuário desse papel e confira que as
  colunas de dinheiro somem, em vez de mostrarem traço
```

---

## 5 · Tarefas e checklist

```
Item 5 da Fase 1: a tela de tarefas.

Leia antes: CLAUDE.md, src/lib/banco.ts e as tabelas `tarefa`,
`tarefa_dependencia` e `tarefa_checklist` na migração 20260824000300.

O QUE FAZER

1. `src/paginas/Tarefas.tsx`: lista hierárquica das tarefas do projeto, com
   criar, editar, excluir e reordenar. Campos: nome, descrição, responsável,
   etapa vinculada, status, percentual, datas prevista e real, marco.

2. Checklist dentro da tarefa: itens, marcar, desmarcar, reordenar. Quem
   marca fica em `concluido_por` e `concluido_em` — preencha os dois.

3. Dependências: acrescentar e remover predecessora, com tipo (TI, II, TT,
   IT) e folga em dias. O banco recusa ciclo; mostre a mensagem dele.
   Não calcule datas ainda — o motor de CPM é a Fase 2.

4. Quem só é responsável pode editar a própria tarefa, e nada mais. A RLS já
   garante; a tela não deve oferecer o que vai ser negado — esconda o que a
   pessoa não pode mexer em vez de deixar o erro aparecer no save.

5. Marco não tem duração: quando marcar "é marco", zere e trave a duração.
   O banco tem um CHECK para isso, mas o usuário não deve chegar nele.

REGRAS

- Cronograma só aparece se `tipo_projeto.usa_cronograma`.
- Status vem do CHECK da coluna, não de uma lista escrita no código: leia os
  valores possíveis de `banco.types.ts`.
- Tarefa sem data é normal — 130 das 147 importadas estão assim. Não force
  data no formulário.

CONFERIR NA TELA

- 2026-004 (Execução, 8 tarefas importadas)
- criar dependência circular entre duas tarefas → a mensagem do banco aparece
- marcar tarefa como marco → duração some
- entrar como um usuário que é só responsável de uma tarefa e ver que as
  outras ficam em leitura
```

---

## 6 · Kanban por fase

```
Item 6 da Fase 1: a visão kanban da carteira.

Leia antes: CLAUDE.md, src/paginas/Carteira.tsx, src/paginas/EditarProjeto.tsx
(o pré-voo de mudança de fase já está lá) e as tabelas `tipo_fase` e
`tipo_transicao`.

O QUE FAZER

1. Alternar entre lista e kanban na carteira, guardando a escolha na URL.

2. O kanban precisa de um tipo de projeto selecionado — as colunas são as
   fases DAQUELE tipo, porque tipos diferentes têm fases diferentes. Deixe
   isso explícito na tela, não implícito.

3. Uma coluna por `tipo_fase`, na `ordem`, com a `cor` da fase. Cartão de
   projeto com código, nome, prioridade, pontuação e responsável.

4. Arrastar move de fase. Só ofereça soltar nas colunas que existem em
   `tipo_transicao` a partir da fase de origem — as demais recusam o drop
   visualmente, antes de qualquer requisição.

5. Reaproveite o pré-voo do item 3: antes de mandar a mudança, se houver
   campo pendente, parecer faltando, orçamento ou cronograma exigido, mostre
   a lista e peça confirmação. Se o banco recusar mesmo assim, devolva o
   cartão para a coluna de origem e mostre a mensagem.

REGRAS

- Nenhum nome de fase escrito no código. Coluna, cor, ordem e o que é
  permitido vêm todos do banco.
- Transição com `exige_motivo` pede o motivo antes de mandar.
- A coluna de fase ARQUIVADO aparece recolhida por padrão: ela junta o
  histórico e encheria a tela.

CONFERIR NA TELA

- tipo Investimento: seis colunas (Solicitação, Viabilidade, Avaliação,
  Execução, Finalização, Arquivado); 24 cartões em Viabilidade
- arrastar 2026-003 de Viabilidade para Avaliação → a lista de pendências
  aparece antes de mandar
- tentar arrastar de Viabilidade direto para Execução → a coluna não aceita
```

---

## 7 · Filtros da carteira

```
Item 7 da Fase 1: filtros e busca na carteira.

O QUE FAZER

1. Filtrar por empresa, tipo, fase, prioridade, frente e a marca de
   segurança. Mais busca por código e por nome.

2. Guardar a seleção na URL — o filtro tem de sobreviver ao recarregar e
   poder ser mandado por link para outra pessoa.

3. Mostrar o que está filtrado como fichas removíveis, com um "limpar tudo".
   O contador do cabeçalho diz "12 de 29 projetos" quando há filtro.

4. As opções vêm do banco: empresas de `empresa`, tipos de `tipo_projeto`,
   fases de `tipo_fase`, frentes dos valores distintos de `projeto.frente`.
   Nenhuma lista escrita no código.

5. Por padrão, esconder os arquivados — com uma ficha dizendo isso, para não
   ser um sumiço silencioso.

REGRAS

- Filtrar é responsabilidade do banco: monte a consulta com `.eq()`,
  `.in()`, `.ilike()`, não traga tudo para filtrar no cliente.
- Fase depende de tipo: ao escolher um tipo, as fases oferecidas são as
  dele. Sem tipo escolhido, o filtro de fase fica indisponível e explica
  por quê.

CONFERIR NA TELA

- frente "Melhoria Predial" → 14 projetos
- marca de segurança → 5 projetos
- empresa Cemare + prioridade URGENTE
- copiar a URL filtrada, abrir em outra aba e cair no mesmo resultado
```

---

## 8 · Pontuação editável

```
Item 8 da Fase 1: editar a pontuação que ordena a fila.

Leia antes: a view `vw_pontuacao` na migração
20260827200000_pontuacao_mostra_o_que_conta.sql — ela já traz `ativo`,
`pontos` (a contribuição real) e `pontos_se_ligado`.

O QUE FAZER

1. Editar a nota de cada critério ativo, 0 a 5, com a justificativa ao lado.
   Os limites vêm de `pontuacao_criterio.minimo` e `.maximo`, não do código.

2. Mostrar, enquanto se digita: total, máximo possível, a fração, e a
   prioridade que vai resultar. Os cortes estão em `configuracao`, na chave
   `prioridade.cortes` — leia de lá, não repita os números na tela.

3. Critério desligado continua aparecendo, esmaecido, com a nota guardada e
   quanto ela valeria se fosse ligado. Editável? Sim: pontuar hoje é o que
   permite ligar o bloco depois.

4. Depois de salvar, releia o projeto: `pontuacao_total` e `prioridade` são
   calculados por trigger, não pelo que a tela mandou.

5. Na carteira, deixe visível por que um projeto está onde está: um resumo
   da pontuação no cartão ou no tooltip.

REGRAS

- Nunca escreva `pontuacao_total` nem `prioridade` — são derivados.
- Nada de lista de critérios no código: são nove hoje, podem ser dez amanhã.

CONFERIR NA TELA

- 2026-010 (19 pontos, URGENTE, o topo da fila) — quatro critérios ativos e
  quatro desligados com nota guardada
- baixar uma nota e ver a prioridade mudar depois de salvar
- tentar nota 9 → o banco recusa, a mensagem aparece no critério certo
```

---

## 9 · Avaliação e pareceres

```
Item 9 da Fase 1: a tela de avaliação.

Leia antes: as tabelas `aprovacao`, `setor` e a coluna
`tipo_fase.exige_setores`; e `app.exigir_pareceres()` na migração
20260824000600_avaliacao.sql.

O QUE FAZER

1. `src/paginas/Avaliacao.tsx`: para a fase atual do projeto, os setores que
   `exige_setores` pede, quem já assinou, quando, e com que decisão.

2. Registrar parecer: decisão (APROVADO, REPROVADO, POSTERGADO, CIENTE),
   texto, e data de retorno quando for POSTERGADO. O banco exige parecer
   escrito em REPROVADO e data em POSTERGADO — não deixe chegar lá.

3. Só quem tem o papel AVALIADOR pode assinar. A RLS decide; a tela não
   oferece o botão a quem não pode.

4. Um painel de "o que falta para avançar": setores sem parecer, campos
   pendentes, orçamento e cronograma exigidos. É o mesmo pré-voo do item 3 —
   extraia para um componente e use nos dois lugares, e no kanban do item 6.

5. Parecer REPROVADO trava a fase por completo: mostre isso com clareza e
   ofereça arquivar, que é a saída que o modelo prevê.

REGRAS

- Setores vêm de `setor` e de `exige_setores`; nada escrito no código.
- As 92 assinaturas importadas são CIENTE sem data — trate data nula sem
  quebrar, e não as apresente como aprovação.

CONFERIR NA TELA

- 2026-003: quatro setores pendentes na fase Avaliação
- um projeto importado: as quatro assinaturas CIENTE aparecem, sem data
- registrar REPROVADO sem texto → o banco recusa, o erro cai no campo certo
```

---

## 10 · Comentários e anexos

```
Item 10 da Fase 1: conversa e arquivos no projeto.

Leia antes: as tabelas `comentario` e `anexo`, e a migração
20260827190100_storage_anexos.sql — a política do Storage depende do caminho
`projeto/<id do projeto>/<arquivo>`.

O QUE FAZER

1. Comentários na tela do projeto: escrever, editar o próprio, responder a
   outro. Mostrar autor e quando. Menções ficam em `comentario.mencionados`
   como lista de pessoa_id — grave, e deixe a notificação para depois.

2. Anexos: enviar, listar, baixar, excluir. O caminho no bucket `anexos`
   tem de ser `projeto/<id>/<arquivo>` — a política do Storage lê o segundo
   pedaço do caminho para saber de quem é o arquivo. Fora dessa convenção o
   upload é recusado.

3. Grave `mime` e `bytes` no momento do envio; o tipo vem do arquivo.

4. As 16 fotos importadas do desktop estão com `secao = 'SITUACAO'`. Agrupe
   os anexos por seção e mostre as imagens como galeria, não como lista de
   nomes.

5. Excluir anexo apaga o arquivo no Storage e a linha, nessa ordem — e se o
   arquivo não estiver mais lá, apague a linha assim mesmo.

REGRAS

- Nada de `service_role` no navegador: o upload vai pela sessão do usuário,
  e a política do Storage decide. Se ela recusar, mostre a mensagem.
- Comentário nunca é apagado por outra pessoa; editar é só do autor.

CONFERIR NA TELA

- 2026-026 e 2026-027: as fotos importadas aparecem como galeria
- enviar uma foto nova e vê-la ao lado das antigas
- entrar como ESTRUTURA e confirmar que dá para comentar e anexar, mas não
  aparece valor nenhum na tela
```

---

## Quando os dez estiverem feitos

A Fase 1 acaba. O que vem:

**Fase 2 — tempo:** calendário de trabalho, motor de CPM em TypeScript, Gantt,
marcos, linha de base, agenda por pessoa, exportação iCal.

**Fase 3 — dinheiro:** custos, contratos, parcelas viram data quando o evento
acontece, curva S, medições.

**Fase 4 — documentos:** os PDFs da Solicitação, da Viabilidade, do
acompanhamento e da carteira.

## Pendências abertas

- Leitura direta da tabela `projeto` ainda entrega o jsonb com as chaves
  MOEDA. A `vw_projeto_edicao` fechou o caminho de tela; fechar de vez pede
  tirar o SELECT direto em `projeto`.
- `app.pessoa_atual()` é chamada por linha nas políticas. Quando as tabelas
  crescerem, envolver em `(select app.pessoa_atual())` nas políticas para o
  Postgres avaliar uma vez por consulta.
- Os cinco critérios do bloco de importância seguem desligados até serem
  pontuados nos projetos que faltam.
- 21 projetos em Viabilidade estão sem *Situação atual* e *Alternativas
  consideradas*. Ou preencher, ou soltar a exigência — decisão sua.
