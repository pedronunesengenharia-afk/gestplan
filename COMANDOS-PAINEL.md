# Painel, gráficos e o passe visual

Três comandos, nesta ordem. **O primeiro não é opcional** — ele existe porque
um teste de navegador escreveu num preço real de produção e quase ficou lá.

---

## A · Ambiente de homologação

Hoje existe **um `.env` só**, apontando para o Supabase de produção. Todo
`npm run dev`, todo agente de navegador, todo teste de tela escreve nos seus
29 projetos reais. O agente que alterou R$ 17.200 para 17.300 fez o que o
ambiente permitiu.

```
Preciso separar homologação de produção. Hoje há um .env só, apontando para
produção, e qualquer teste de tela escreve em dado real.

O QUE FAZER

1. Crie `.env.homolog.example` com as mesmas chaves do `.env.example`, e
   `.env.homolog` no `.gitignore`.

2. No package.json, acrescente os scripts que usam o modo do Vite:
     "dev:homolog":   "vite --mode homolog"
     "build:homolog": "vite build --mode homolog"
     "tipos:homolog": "supabase gen types typescript --project-id SEU_REF_HOMOLOG > src/lib/banco.types.ts"

3. Em `src/lib/supabase.ts`, exporte também qual ambiente está ativo, lendo
   `import.meta.env.MODE`.

4. Na casca do app, quando o ambiente NÃO for produção, mostre uma tarja fixa
   no topo: "HOMOLOGAÇÃO — os dados aqui são descartáveis". Precisa ser
   impossível de confundir com a tela real; use o laranja de sinal e ocupe a
   largura toda.

5. No CLAUDE.md, na seção de ambientes, escreva: teste de tela e agente de
   navegador rodam em `npm run dev:homolog`, nunca em `npm run dev`. Produção
   é para usar, não para experimentar.

Não invente o project-ref de homologação — deixe o lugar marcado que eu
preencho.
```

Depois, no painel do Supabase: **New project → `gestplan-homolog`**, região São
Paulo. Nele:

```powershell
supabase link --project-ref REF_DO_HOMOLOG
supabase db push
```

E carregue os dados de mentira usando a importação, que é repetível — foi para
isso que ela foi feita. Cole `importacao.sql` no SQL Editor do homolog.

> A partir daí, teste de navegador é `npm run dev:homolog`. Se algo for
> escrito errado, o conserto é rodar a importação de novo.

---

## B · O painel, com os gráficos

Seis views foram construídas, testadas e **nenhuma tela consome**: `vw_curva_s`,
`vw_fluxo_mensal`, `vw_avanco`, `vw_capacidade`, `vw_tarefa_atrasada` e
`vw_retomada`. É o que faltou do plano original — e é onde os gráficos moram.

```
Item novo: a tela de Painel, primeira do menu.

Leia antes: CLAUDE.md, src/estilos/graficos.css (os tokens de gráfico, já no
repositório) e as views vw_curva_s, vw_fluxo_mensal, vw_avanco, vw_capacidade,
vw_tarefa_atrasada e vw_retomada, na migração 20260824000800_visoes.sql.

Use Recharts (`npm i recharts`). É a única dependência nova que estou
autorizando: já foi usada no sistema desktop, e desenhar seis gráficos com
dica e cruzeta à mão é superfície demais para uma pessoa manter.

O QUE FAZER

`src/paginas/Painel.tsx`, em quatro faixas.

FAIXA 1 — números, não gráficos. Quando a resposta é um número, ficha de
número (.ficha-numero), nunca uma rosca de uma fatia:
  · projetos ativos e valor orçado da carteira
  · desembolsado, com o percentual do orçado ao lado
  · urgentes
  · tarefas atrasadas (vw_tarefa_atrasada)
  · projetos a retomar (vw_retomada), com o mais vencido em destaque
Quem não tem alcance financeiro não vê as fichas de dinheiro — pergunte com
`posso_ver_valores`, não deduza de valor nulo.

FAIXA 2 — dois gráficos, lado a lado, cada um ocupando a largura toda em
telas estreitas:

  · CURVA S da carteira (vw_curva_s, somando os projetos): linha, três séries
    acumuladas — base, previsto, realizado. Eixo x = competência.
  · FLUXO MENSAL (vw_fluxo_mensal): barras empilhadas por competência —
    pago (--st-bom), em aberto no prazo (--g1), vencido (--st-critico).
    Cor de estado anda com rótulo, nunca sozinha.

FAIXA 3 — duas magnitudes, barras horizontais, cor sequencial (--seq1..5),
ordenadas por valor:
  · carteira por FRENTE (agrupando projeto.frente)
  · custo por CATEGORIA (custo + categoria_custo)

FAIXA 4 — AVANÇO x DESEMBOLSO: dispersão, um ponto por projeto.
  x = % desembolsado (valor_realizado / valor_orcado)
  y = % de avanço físico (vw_avanco.avanco_fisico)
  Uma diagonal tênue marca o equilíbrio: acima dela o projeto entrega mais do
  que gasta; abaixo, gasta mais do que entrega. Rotule direto só os pontos
  que saem da faixa; o resto fica na dica.

REGRAS DE GRÁFICO — não negociáveis

- Nenhum hexadecimal no código: tudo sai de graficos.css. A paleta passou nos
  seis checks do validador nos dois temas; cor inventada quebra isso.
- NUNCA dois eixos y no mesmo gráfico. Duas medidas de escala diferente são
  dois gráficos, ou indexadas a uma base comum.
- Cor categórica em ordem FIXA (--g1, --g2, --g3…), nunca ciclada. Filtrar
  série não pode repintar as que sobraram — a cor segue a entidade, não a
  posição.
- Legenda sempre que houver duas séries ou mais; com até quatro, rótulo direto
  também. Uma série só dispensa legenda: o título já a nomeia.
- Dica ao passar o mouse em todos: cruzeta nos de linha e área, por marca nos
  de barra e ponto. Alvo maior que a marca.
- Marcas finas, linha de 2px, ponto de no mínimo 8px, 2px de folga entre
  fatias empilhadas. Grade e eixos recessivos.
- Números em `font-variant-numeric: tabular-nums`, sempre.
- Todo gráfico tem um "ver tabela" que mostra os mesmos números em texto —
  quem lê por leitor de tela ou imprime em preto e branco precisa deles.
- Tema escuro tem passos próprios, já em graficos.css. Não inverta o claro.
- Gráfico sem dado mostra o motivo, não um quadro vazio: "sem alocação ativa"
  vale mais que um retângulo em branco.

CONFERIR NA TELA (em npm run dev:homolog)

- carteira: 28 ativos, R$ 4,48 mi orçado, R$ 343 mil desembolsado (7,7%)
- curva S: realizado só nos quatro projetos que têm custo — a linha fica
  colada no zero na maior parte, e está certo
- fluxo mensal: as 401 parcelas são REGRA, não data; competência só existe
  onde há vencimento. Diga isso no gráfico em vez de deixar meses sumirem
- frente: "Melhoria Predial" 14, "Equipamentos" 6, "Segurança do trabalho" 4
- capacidade: alocacao está vazia hoje — mostre o motivo, não um quadro vazio
- entre como ESTRUTURA: as fichas e os gráficos de dinheiro somem; os de
  avanço e atraso continuam
```

---

## C · O passe visual

```
Passe de acabamento nas telas que já existem. Sem função nova.

Leia antes: src/estilos/tokens.css e app.css.

O QUE ARRUMAR

1. Densidade. A carteira com 29 linhas e a EAP com 17 estão espaçadas demais
   para uma ferramenta de trabalho — quem usa isso o dia todo quer ver mais
   linhas sem rolar. Reduza a altura de linha das tabelas, mantendo o alvo de
   clique confortável.

2. Hierarquia. Hoje quase todo texto tem o mesmo peso. Código do projeto e
   valores são o que o olho procura: dê a eles a fonte de dado, tabular, e
   deixe o resto recuar.

3. Alinhamento de número. Toda coluna de dinheiro, percentual e data alinhada
   à direita, com tabular-nums. Traço quando for nulo, nunca R$ 0,00 — zero e
   "não sei" são coisas diferentes.

4. Estados vazios. Toda lista vazia diz o que fazer, não só "nenhum
   resultado": "Nenhuma etapa cadastrada. Comece pelo orçamento."

5. Carregando. Hoje some tudo e aparece "Carregando…". Troque por esqueleto
   com a forma da tabela — a tela não deve pular quando o dado chega.

6. Foco visível em tudo que recebe teclado, com o laranja de sinal. Hoje
   alguns controles não mostram foco, e quem navega por Tab se perde.

7. As três correções que o navegador pegou já estão feitas; confira que não
   voltaram: célula de tabela com display:flex, coluna de kanban sem rolagem
   própria, e o × da ficha de filtro quebrando de linha.

8. Erro do banco aparece PERTO do que o causou. Se o campo culpado estiver
   fora da tela, o aviso também vai ao lado do botão que disparou. Feedback
   que ninguém vê é feedback que não existe.

REGRAS

- Nenhum hexadecimal fora de tokens.css e graficos.css.
- Nada de biblioteca de UI. O sistema tem tokens; use-os.
- Cada mudança tem de sobreviver aos dois temas — confira no escuro também.
```

---

## Duas coisas de hábito

**`git add -A` levou meus arquivos duas vezes.** Use `git add` com os caminhos
que você mexeu, ou `git status` antes de todo commit. Arquivo que chega de
fora merece commit próprio, com a mensagem dizendo de onde veio.

**A skill de login por magic link vale virar skill do repositório.** Você montou
o mesmo aparato duas vezes. `/run-skill-generator` nela — a próxima sessão não
deveria redescobrir como autenticar um teste.

## Depois disto

Fase 2 — tempo: calendário de trabalho, motor de CPM, Gantt, marcos, linha de
base, agenda por pessoa, iCal. É a maior peça que falta, e a que você pediu
desde o começo: "ter etapas e gerar calendários e cronogramas".
