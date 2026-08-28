# GestPlan — roteiro de apresentação

## Antes de começar

```powershell
cd C:\Users\pedro\GestPlan
npm run build
npm run preview
```

Abra **http://localhost:4173** — não o 5173.

A diferença importa: o `dev` mostra uma tarja vermelha no topo dizendo que o
`.env` pode ser o de produção. O `preview` serve o build de produção, sem
tarja e mais rápido. É o mesmo banco nos dois.

Entre com o seu e-mail, clique no link que chegar, e deixe a aba aberta.

> Se a apresentação for numa tela de 1440px ou menos, a tabela da carteira
> rola de lado nas duas últimas colunas de dinheiro. Em 1600 ou mais, cabe
> inteira.

---

## O roteiro, em sete minutos

### 1 · Painel — "onde estamos"

A primeira tela responde a pergunta do diretor antes de ele perguntar:

| | |
|---|---|
| 31 projetos ativos | 10 urgentes |
| R$ 4,48 mi orçados | R$ 343 mil desembolsados (7,7%) |
| 5 tarefas atrasadas | a pior com 14 dias |
| 151 tarefas | 132 não iniciadas, 11 em andamento, 8 concluídas |

Role até os gráficos: **carteira por frente** (Melhoria Predial 14,
Equipamentos 6), **por empresa** (Cemare e Cimentpav), **custo por categoria**.

**O que dizer sobre os gráficos vazios.** A curva S tem só a linha do
realizado, e o fluxo mensal está vazio — e os dois dizem por quê, na própria
tela. Não é falha: as 401 parcelas importadas são *regra* ("40% na aprovação,
30 dias"), não data. Elas entram no fluxo quando o evento acontecer. Isso é
uma boa história para contar: o sistema preferiu guardar a regra a inventar
uma data.

### 2 · O painel muda com o tipo

Clique em **Investimento**, depois em **TI & desenvolvimento**.

O painel se remonta: Investimento mede avanço por **desembolso** e mostra
dinheiro; TI mede por **tarefas** e não mostra dinheiro nenhum — porque o tipo
declara que não usa orçamento. Nada disso está escrito no código: sai de
`tipo_projeto` e `tipo_fase`.

O **farol de fases** acende por fase, com o número de projetos parados em cada
uma. Investimento: 24 em Viabilidade, 4 em Execução, 1 em Finalização.
TI: as fases dele — Backlog, Priorizado, Desenvolvimento, Homologação,
Produção.

### 3 · Carteira — lista, filtro e kanban

- Filtre por frente **Melhoria Predial** → 14 de 31. Repare que a URL muda:
  esse link pode ser mandado para outra pessoa e abre igual.
- Botão **Kanban**, tipo Investimento → seis colunas, 24 cartões em
  Viabilidade.
- Tente arrastar um cartão de Viabilidade para **Execução**: a coluna recusa.
  Só Avaliação, Solicitação e Arquivado aceitam, porque só essas transições
  existem em `tipo_transicao`.
- Arraste o **2026-003** para Avaliação: antes de mandar, a tela lista o que o
  banco vai cobrar — *Situação atual* e *Alternativas consideradas*.

### 4 · Um projeto de verdade — 2026-007

O maior orçamento da carteira. Abra e mostre:

- **Etapas**: 17 linhas, R$ 1.139.100,00, e **R$ 287.000 ainda é palpite** —
  sete itens marcados "a confirmar". O sistema separa o que está cotado do que
  é estimativa.
- **Pontuação**: quatro critérios ativos e cinco desligados, com as notas
  guardadas. A régua vem do banco, não do código.
- Os campos próprios do tipo, com a tarja **"falta para sair de Viabilidade"**
  em vermelho no que trava a fase.

### 5 · O projeto de TI que nasce pronto — CIM-2026-025

Este é o que responde "e o TI?".

Ele nasceu com quatro etapas e quatro tarefas, sozinho:

```
Levantamento     3d   01/09 → 03/09
Desenvolvimento 10d   04/09 → 17/09
Homologação      3d   18/09 → 22/09
Implantação      2d   23/09 → 24/09
```

Dez dias úteis de desenvolvimento pulam dois fins de semana. A seção
**Acompanhamento** mostra prazo, avanço ponderado, a linha do tempo e o avanço
por etapa.

O modelo é configuração: está em `tipo_etapa`, e mudar o processo de TI é
editar linhas — não código. Um tipo sem modelo continua nascendo vazio.

### 6 · Chamado sem login — o momento mais forte

Abra **http://localhost:4173/?chamado** em outra aba (ou no celular, se a rede
permitir).

Sem senha, sem cadastro: nome, e-mail, empresa, problema. Envie. A tela
devolve o **código do chamado** — e é esse número que a pessoa guarda.

Volte para o sistema, menu **Chamados**: o pedido está lá, na fila do TI, com o
farol mostrando que está no Backlog.

Repare no código: `CIM-2026-024`. Continua a numeração dos projetos reais
importados do desktop. Chamado não é uma coisa à parte — é um projeto na fila
do TI.

### 7 · Equipe e permissão

Menu **Equipe**: cadastre alguém com nome e e-mail, e dê um papel por empresa.
A coluna **acesso** mostra quem já entra e quem só existe no cadastro.

Vale dizer em voz alta: quem for cadastrado com um e-mail entra sozinho no
primeiro link que pedir — o sistema liga o login à pessoa pelo e-mail.

---

## Se perguntarem

**"E a segurança?"** Toda regra está no banco, não na tela. São 94 políticas de
RLS e 161 verificações automáticas que rodam antes de cada mudança. Três buracos
foram achados e fechados durante a construção — dinheiro da EAP visível para
quem não tem alcance financeiro, qualquer editor assinando parecer, e gerente
editando comentário alheio.

**"Dá para tirar relatório?"** Todo gráfico tem "ver tabela" — os mesmos
números em texto, para copiar ou imprimir. PDF é a Fase 4.

**"E o cronograma completo, Gantt?"** A linha do tempo já existe por projeto. O
Gantt com caminho crítico, calendário e feriados é a Fase 2 — as tabelas
`calendario` e `linha_base` já estão no banco, esperando.

**"Quanto disso é o sistema antigo?"** A carteira inteira: 29 projetos, 460
etapas, 401 parcelas, 171 custos, 92 assinaturas e 16 fotos vieram do desktop.
A importação é repetível — roda de novo sem duplicar.

---

## O que NÃO mostrar

- **Capacidade da equipe** e **Avanço × desembolso** estão vazios: ninguém foi
  alocado e nenhuma etapa tem percentual lançado. Os dois dizem o motivo, mas
  não rendem numa apresentação.
- **Obra, Contrato e Manutenção** não têm projeto nenhum — os painéis deles
  estão corretos e vazios.

## Dois projetos de teste que eu criei

`CIM-2026-024` (o chamado de teste) e `CIM-2026-025` (o projeto de TI). O
segundo é útil na apresentação. Para apagar depois:

```sql
delete from projeto where codigo in ('CIM-2026-024', 'CIM-2026-025');
```
