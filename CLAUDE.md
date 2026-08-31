# GestPlan

Plataforma de gestão de projetos da Habitual. Substitui o app desktop
`Gestao-projetos` (Tauri + SQLite), que continua sendo a ferramenta de trabalho
até a virada.

> Este arquivo é lido pelo Claude Code a cada sessão. Mantenha-o curto e
> verdadeiro: o que estiver errado aqui vira erro no código.

## O que é

Sistema online, multiusuário, para conduzir **qualquer tipo de projeto** —
investimento, obra, TI, contrato, manutenção — com as mesmas etapas, o mesmo
cronograma e o mesmo calendário.

Equipe de até 10 pessoas em três grupos: gerência de projetos, time de TI e
estrutura/operação. Fornecedor externo tem papel e política prontos, mas o
portal fica para depois da virada.

## Stack

- React 19 + Vite + TypeScript (sem framework de rotas por enquanto)
- Supabase — Postgres 16, Auth, Storage, RLS, Edge Functions — região São Paulo
- Hostinger para o front estático
- Sem biblioteca de UI: CSS próprio com tokens em `src/estilos/tokens.css`
- Sem biblioteca de Gantt: motor de CPM próprio, em TypeScript puro

Antes de acrescentar dependência, pergunte. Cada uma é dívida que uma pessoa só
vai pagar.

## A arquitetura em três camadas

Isto não é organização de pastas — é a regra que sustenta o produto.

**Camada 1 — núcleo invariante.** `projeto`, `etapa`, `tarefa`, `pessoa`,
`custo`, `contrato`… O que é verdade em qualquer projeto de qualquer tipo.

**Camada 2 — tipos de projeto.** Tudo que varia entre tipos vive como **dado**,
nas tabelas `tipo_projeto`, `tipo_fase`, `tipo_transicao` e `campo_definicao`.

**Camada 3 — visões.** Kanban, Gantt, calendário, lista, carteira. Consomem as
views `vw_*`; nenhuma guarda estado próprio.

### Regra de ouro

> **Nunca escreva `if (tipo === 'INVESTIMENTO')`.**

Se aparecer a vontade, aquilo é configuração de template e o lugar dela é uma
linha de `tipo_fase` ou `campo_definicao`. Vale para SQL e para TypeScript. É a
única disciplina que impede o sistema de virar um emaranhado em dois anos.

Consequência prática: a tela lê `tipo_projeto.usa_orcamento`,
`tipo_fase.exige_setores`, `campo_definicao.tipo_dado` e se monta a partir
disso. Ela não sabe o nome de nenhum tipo.

## Banco de dados

Vinte e quatro migrações em `supabase/migrations/`. Leia o cabeçalho de cada arquivo
antes de mexer — todos explicam as decisões que carregam.

### Regras inegociáveis

1. **Migração aplicada nunca é editada.** Toda mudança de estrutura é arquivo
   novo, com carimbo de hora à frente. Editar uma antiga faz o banco de quem já
   a aplicou divergir do de quem não aplicou.

2. **Toda view leva `with (security_invoker = true)`.** Sem isso a view roda com
   os direitos de quem a criou e devolve linhas que a RLS negaria na tabela. A
   política fica certa e a view vaza — é a pegadinha clássica de RLS no
   Postgres.

3. **Toda tabela nova nasce com RLS ligada**, `force row level security`, e uma
   política escrita no mesmo commit. Tabela sem política é tabela sem acesso —
   e é assim que tem de ser até alguém escrever a regra.

4. **Nada de `service_role` no navegador.** Operação privilegiada vai por Edge
   Function.

5. **Dinheiro tem porta própria.** Valores de projeto moram em `projeto_valor`,
   os da EAP em `etapa_valor`; custo, parcela, contrato e medição têm política
   de `app.pode_ver_valores()`. Não mova coluna de valor para dentro de
   `projeto` nem de `etapa` — foi exatamente assim que o orçamento item a item
   ficou legível para quem não alcança dinheiro, até a migração 230000.

6. **Exigência é sempre de SAÍDA de fase, nunca de entrada.** Vale para
   `tipo_fase.exige_setores` e para `campo_definicao.exigido_para_sair_de`.
   Entra-se na Viabilidade justamente para preenchê-la.

### Funções de permissão (schema `app`)

| Função | Responde |
|---|---|
| `app.pessoa_atual()` | quem é o usuário da vez |
| `app.é_proprietario()` | é o dono? |
| `app.empresas_visiveis()` | quais empresas ele alcança (EXTERNO fica de fora) |
| `app.é_parte(p, pessoa)` | **esta pessoa foi posta no projeto?** gerente, solicitante ou alocação ativa |
| `app.pode_ver_projeto(p)` | alcança o projeto — **inclui o fornecedor pelo contrato** |
| `app.pode_ver_interno(p)` | alcança o projeto **e não é externo** ← use esta nas tabelas |
| `app.pode_editar_projeto(p)` | pode alterar escopo e cronograma |
| `app.pode_ver_valores(p)` | pode ver dinheiro |

| `app.pode_assinar(p)` | pode dar parecer de setor (papel AVALIADOR) |

`pode_ver_projeto` guarda a regra do portal do fornecedor, que ainda não existe.
Política de tabela usa `pode_ver_interno`. Trocar uma pela outra reabre um
vazamento que já foi pego uma vez.

### Alcance é pertencimento, não empresa

Desde a migração `20260830160000`, **papel na empresa não dá alcance a
projeto**. As duas perguntas são separadas:

- **onde** — `app.é_parte()`: você é o gerente, o solicitante, ou foi alocado;
- **o quê** — o papel: editar, ver dinheiro, assinar parecer.

Ter papel de gerente de projetos na Cemare não faz ninguém enxergar todos os
projetos da Cemare. **Alocar deixou de ser opcional: é o ato de dar acesso.**
Consequências que a tela já respeita: o seletor de responsável e a lista de
menção só oferecem quem está no projeto, e um trigger recusa responsável de
fora.

**Para a tela perguntar**, três dessas estão espelhadas em `public`, que é o
único schema que o PostgREST enxerga: `posso_editar_projeto`, `posso_ver_valores`
e `posso_assinar`. A tela pergunta; não reescreve a regra em TypeScript.

## Testes

```
rodar_testes.bat
```

Apaga o banco de teste, aplica as migrações e roda as oito suítes — 229
verificações:

- `testes/01_regras.sql` — 40 de regra de negócio
- `testes/02_permissao.sql` — 41 de permissão, uma por papel
- `testes/03_permissao_fase1.sql` — 18 das regras que a Fase 1 destapou
  (dinheiro da EAP, quem assina parecer, quem edita comentário alheio)
- `testes/04_chamado_e_acesso.sql` — 17 do chamado e do vínculo por e-mail
- `testes/05_chamado_publico.sql` — 23 da porta sem login
- `testes/06_modelo_de_etapas.sql` — 22 do modelo de etapas e do prazo em dias úteis
- `testes/07_alocacao.sql` — 35 de alocação, capacidade e de quem enxerga a equipe
- `testes/08_notificacao.sql` — 31 dos quatro gatilhos de aviso, e da porta fechada
  que obriga eles a existirem

**A suíte de permissão roda antes de todo deploy.** Ela já pegou dois
vazamentos que nenhum teste de tela pegaria. Ao acrescentar tabela, papel ou
política, acrescente o caso correspondente nela — no mesmo commit.

Mudou o schema? `supabase gen types typescript --local > src/lib/banco.types.ts`.

## Convenções

- **Português** em nomes de tabela, coluna, função, componente e variável.
  `criado_em`, não `createdAt`. É o idioma do domínio e de quem lê os relatórios.
- **snake_case** no banco, **camelCase** no TypeScript, **PascalCase** em
  componente React.
- Datas em `date` quando é dia (prazo, vencimento) e `timestamptz` quando é
  instante (criação, alteração).
- Dinheiro em `numeric`, nunca `float`.
- Arquivo de página em `src/paginas/`, componente reaproveitável em
  `src/componentes/`, acesso a dado em `src/lib/`.
- Nada de `localStorage` para dado de negócio — ele é do banco.

## Ambientes

| | Onde | Para quê |
|---|---|---|
| local | Postgres via `supabase start` | desenvolver e rodar teste |
| homologação | projeto Supabase separado | conferir antes de subir |
| produção | projeto Supabase em São Paulo | o que a equipe usa |

**Não desenvolva direto em produção.** Funcionou enquanto o único prejudicado
por um erro era você; com dez pessoas dentro, virou risco operacional.

**Teste de tela e agente de navegador rodam em `npm run dev:homolog`, nunca em
`npm run dev`.** O `dev` aponta para produção e escreve nos projetos reais —
um agente de navegador já alterou um preço de R$ 17.200 para R$ 17.300 num
projeto de verdade, testando. Produção é para usar, não para experimentar.

Fora de produção o app mostra uma tarja laranja no topo com o nome do
ambiente. Se ela não estiver lá, você está em produção.

## Onde estamos

Fase 1 entregue: carteira com filtros, kanban, detalhe de projeto, formulário
que se monta lendo `campo_definicao`, EAP e orçamento, tarefas e checklist,
pontuação, avaliação, comentários e anexos. A carteira do desktop está
importada — 29 projetos, 460 etapas, R$ 4.478.846,25 orçados.

Falta o painel com os gráficos, que consome as seis views já construídas
(`vw_curva_s`, `vw_fluxo_mensal`, `vw_avanco`, `vw_capacidade`,
`vw_tarefa_atrasada`, `vw_retomada`).

**Depois:** Fase 2 — tempo. Calendário de trabalho, motor de CPM, Gantt,
marcos, linha de base, agenda por pessoa, iCal.

## O que NÃO construir

Chat próprio · ERP ou contabilidade · contrato de venda e faturamento (não há
receita neste modelo) · folha e ponto · CRM · app nativo · BI genérico · portal
do fornecedor (é pós-virada).

Se uma ideia boa aparecer fora do escopo da fase, anote na lista de "depois da
virada" e siga. São quatro meses até a troca; escopo é o que descarrilha.
