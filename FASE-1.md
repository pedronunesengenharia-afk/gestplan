# Fase 1 — do esqueleto ao sistema que se usa

A Fase 0 entregou a casca: login, carteira, empresas, equipe. Tudo leitura.
A Fase 1 é o que transforma isso em ferramenta de trabalho.

**Não existe um comando que gere o resto.** O que existe é uma sequência de
pedidos do tamanho de um commit. Este arquivo é essa sequência, na ordem que
rende mais — cada item destrava o seguinte.

## Como rodar cada pedido

No terminal do VS Code, dentro da pasta do projeto:

```powershell
claude
```

Ou o painel da extensão Claude Code. Cole um item por vez. Depois de cada um:

```powershell
npm run dev            # olhar na tela
rodar_testes.bat       # se mexeu no banco
git add . && git commit -m "..."
npm run tipos:remoto   # se mexeu no schema
```

**Um item por sessão.** Se ele entregar dois de uma vez, você perdeu a chance de
revisar o primeiro.

---

## A ordem

### 1 · Detalhe do projeto (leitura)

O maior salto imediato: você tem 29 projetos e só consegue ver a lista.

> Leia `CLAUDE.md` e `src/lib/banco.ts`. Crie `src/paginas/Projeto.tsx`: a tela
> de um projeto, aberta ao clicar numa linha da carteira. Mostre cabeçalho
> (código, nome, tipo, fase, empresa, prioridade), os campos próprios agrupados
> por `campo_definicao.grupo`, a árvore de etapas com valores, as tarefas e a
> pontuação aberta por critério. Só leitura por enquanto.
>
> Os campos e seus rótulos vêm de `campo_definicao` — a tela não pode saber o
> nome de nenhum campo nem de nenhum tipo de projeto. Acrescente em `banco.ts`
> as funções de consulta que faltarem, seguindo o estilo das que já existem.

### 2 · O formulário que se monta sozinho

O componente mais importante do sistema. Escrito bem uma vez, dispensa cinco
formulários.

> Crie `src/componentes/CamposDoTipo.tsx`: recebe um `tipo_projeto_id` e o
> `campos` de um projeto, lê `campo_definicao` e renderiza o formulário —
> agrupado por `grupo`, na `ordem`, com o controle certo para cada `tipo_dado`
> (TEXTO, TEXTO_LONGO, NUMERO, MOEDA, PERCENTUAL, DATA, BOOLEANO, SELECAO,
> SELECAO_MULTIPLA). Marque visualmente os campos que `exigido_para_sair_de`
> vai cobrar na próxima fase, mostrando de qual fase se trata.
>
> Nenhum `if` por código de campo ou de tipo.

### 3 · Criar e editar projeto

> Usando `CamposDoTipo`, faça criar e editar projeto. Ao escolher o tipo, as
> fases e os campos vêm de `tipo_projeto`, `tipo_fase` e `campo_definicao`.
> Trate os erros que o banco devolve — campo obrigatório, opção inválida —
> mostrando a mensagem ao lado do campo, não num alerta genérico.

### 4 · Etapas: a EAP e o orçamento

> Faça a tela de etapas do projeto: árvore hierárquica, criar, editar, excluir,
> reordenar. Quantidade, unidade, preço unitário, peso e "a confirmar" só
> aparecem quando `tipo_projeto.usa_orcamento` for verdadeiro. Mostre os
> subtotais por nível e o total, e a marca de "a confirmar" onde o preço é
> palpite.

### 5 · Tarefas e checklist

> Faça a tela de tarefas: lista hierárquica, criar, editar, responsável,
> status, percentual, datas, vínculo com etapa. Checklist dentro de cada
> tarefa. Um membro só edita a tarefa de que é responsável — a RLS já garante,
> mas a tela não deve oferecer o que vai ser negado.

### 6 · Kanban por fase

> Crie a visão kanban da carteira: uma coluna por `tipo_fase` do tipo
> selecionado, cartões de projeto, arrastar para mudar de fase. As transições
> possíveis vêm de `tipo_transicao` — só ofereça as que existem. Quando o banco
> recusar a mudança (falta parecer, falta orçamento), mostre a mensagem dele e
> devolva o cartão para a coluna de origem.

### 7 · Filtros da carteira

> Acrescente filtros à carteira: empresa, tipo, fase, prioridade, frente e a
> marca de segurança. Mais busca por código e nome. Guarde a seleção na URL,
> para o filtro sobreviver ao recarregar e poder ser mandado por link.

### 8 · Pontuação editável

Hoje a fila está com a régua de quatro critérios. Isto é o que permite mudar.

> Faça a tela de pontuação do projeto: um controle 0–5 por critério ativo, com
> a justificativa ao lado. Mostre o total, o máximo possível e a prioridade que
> resulta. Os critérios vêm de `pontuacao_criterio` — inclusive os desligados,
> que devem aparecer marcados como inativos, e não sumir.

### 9 · Avaliação e pareceres

> Faça a tela de avaliação: os setores que `tipo_fase.exige_setores` pede,
> quem já assinou, e o formulário de parecer (decisão, texto, data). Só quem
> tem o papel AVALIADOR no setor pode assinar. Mostre com clareza o que ainda
> falta para o projeto poder avançar de fase.

### 10 · Comentários e anexos

> Acrescente comentários e anexos à tela de projeto. Anexo sobe para o bucket
> `anexos` no caminho `projeto/<id do projeto>/<arquivo>` — a política do
> Storage depende dessa convenção. Mostre as fotos importadas do desktop,
> agrupadas por `secao`.

---

## Depois da Fase 1

**Fase 2 — tempo:** calendário de trabalho, motor de CPM, Gantt, marcos, linha
de base, agenda por pessoa, iCal.

**Fase 3 — dinheiro:** custos, contratos, parcelas viram datas quando o evento
acontece, curva S, medições.

**Fase 4 — documentos:** os PDFs da Solicitação, da Viabilidade, do
acompanhamento e da carteira.

---

## O que cobrar em toda entrega

- **Nenhum `if` por nome de tipo ou de campo.** Se aparecer, mande refazer
  lendo a configuração. É a disciplina que segura o produto.
- **Tabela nova? Política de RLS no mesmo commit**, e caso novo em
  `testes/02_permissao.sql`.
- **View nova? `with (security_invoker = true)`.** Sem exceção.
- **Erro do banco chega ao usuário legível**, ao lado do campo que o causou.
- **Commit pequeno.** Se o diff não cabe numa revisão de dez minutos, era para
  ser dois commits.

## Pendências anotadas

- `projeto.campos` ainda expõe campo MOEDA em leitura direta da tabela (a view
  já filtra). Fechar quando mexer nas políticas de `projeto`.
- `app.pessoa_atual()` é chamada por linha nas políticas. Quando as tabelas
  crescerem, envolver as chamadas em `(select app.pessoa_atual())` para o
  Postgres avaliar uma vez por consulta.
- Os cinco critérios do bloco de importância estão desligados até serem
  pontuados nos projetos que faltam.
