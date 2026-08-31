# GestPlan — o que falta para gerenciar todo tipo de projeto

> Levantado em 30/08/2026, lendo o banco contra a tela. Os números aqui foram
> conferidos, não estimados. Quando um item for entregue, marque e diga em que
> commit — este arquivo só serve enquanto for verdade.

## O diagnóstico

O sistema está **completo para um tipo** e honesto sobre os outros quatro.

`tipo_projeto` tem sete chaves de configuração. A tela obedece a quatro:

| chave | a tela obedece? |
|---|---|
| `usa_orcamento` | sim |
| `usa_cronograma` | sim |
| `usa_pontuacao` | sim |
| `mede_avanco_por` | sim |
| `usa_etapas` | não — nem é lida |
| `usa_medicao` | não — só existe como campo no tipo TypeScript |
| `usa_recorrencia` | não — nem é lida |

E a configuração é desigual: Investimento tem 21 campos próprios; TI tem 4 mais
o modelo de etapas; Obra, Contrato e Manutenção têm 5 campos cada e nada além.
**Três tipos estão declarados e não equipados.** Um projeto de "Contrato de
serviço" hoje é um projeto com cinco campos e nenhum contrato. Uma "Manutenção
recorrente" não recorre.

### Os três gráficos vazios do painel têm a mesma causa

Não é falha de gráfico. São tabelas em que nenhuma tela escreve:

| gráfico vazio | tabela sem porta |
|---|---|
| Curva S sem a linha do planejado | `linha_base`, `linha_base_item` |
| Fluxo mensal | `parcela` — as 401 linhas são regra, não data |
| Capacidade da equipe | `alocacao` |

Ao todo são cerca de vinte tabelas que nenhuma tela escreve: `alocacao`,
`apontamento_hora`, `linha_base`, `medicao`, `contrato`, `contrato_aditivo`,
`fornecedor`, `calendario`, `ocorrencia`, `evento`, `notificacao`, `ideia`,
`convite`, `projeto_fase_hist`. O banco foi desenhado para o sistema inteiro; a
tela cobriu a Fase 1.

## A ordem

### 1 · Alocação e agenda por pessoa — **feito**

Pessoa alocada no projeto, com papel e percentual de dedicação; e a tela
"Meu trabalho", que responde *o que é meu hoje* atravessando todos os projetos.

Destrava o gráfico de capacidade, que estava vazio por falta de dado — não de
código. Não precisou de migração: `alocacao` já existia com a RLS certa
(leitura por `pode_ver_interno`, escrita por `pode_editar_projeto`).

> A tela de alocação **não grava nem mostra `custo_hora`**: a coluna de
> `alocacao` continua atrás de `pode_ver_interno`. Veja 1b.

### 1b · `pessoa_le` não fazia o que prometia — **corrigido**

A política diz, no próprio comentário, *"o resto da equipe vê a lista
interna"*. Ela não faz isso. O `exists` dela consulta `pessoa_papel`, que tem
RLS própria (`pessoa_id = app.pessoa_atual() or é_proprietario()`), então para
quem não é proprietário o `exists` só pode ser verdadeiro para si mesmo — e a
política inteira desaba para `id = app.pessoa_atual()`.

Medido em `gestplan_teste`: o gerente enxerga **uma** pessoa, ele mesmo. Sem
RLS, o mesmo `exists` dá verdadeiro.

Passou despercebido porque só existe um usuário, e ele é o proprietário, para
quem `é_proprietario()` atalha a condição. Com dez pessoas dentro, quem não for
o dono vai ver:

- **Equipe** — só a si mesmo;
- **Tarefas** — a coluna Responsável em branco, e o seletor oferecendo só ele;
- **Comentários** — nenhuma pessoa para mencionar;
- **Equipe do projeto** — só ele na lista de alocáveis;
- **Painel** — capacidade sempre vazia, porque `vw_capacidade` junta com
  `pessoa`.

Corrigido pela migração `20260830120000`, com `app.é_da_minha_equipe()` —
`security definer`, nos moldes de `app.empresas_visiveis()`. Onze verificações
novas em `07_alocacao.sql`, que falham contra a política antiga.

Junto veio o que a correção obrigava: **`custo_hora` saiu de `pessoa`** e foi
para `pessoa_custo`, só do proprietário. Enquanto cada um só se enxergava, o
custo-hora estava protegido por acidente; abrir a lista sem mover a coluna
entregaria o custo-hora da equipe inteira para a equipe inteira. RLS é por
linha, não por coluna, e view aqui não amplia acesso — então a coluna muda de
casa, como `projeto_valor` e `etapa_valor` já fazem.

**Falta ainda:** `alocacao.custo_hora` e `apontamento_hora.custo_hora`/`valor`
seguem atrás de `pode_ver_interno`. Hoje estão todos em zero e nenhuma tela os
escreve, então não vazam nada — mas a porta é a mesma, e antes de qualquer
apontamento de hora existir eles precisam do mesmo tratamento.

### 2 · Notificação — **dentro do sistema, feito**

Quatro gatilhos, todos tirados de dado que já existe e nenhum deles conhecendo
o nome de um tipo de projeto:

| evento | de onde sai |
|---|---|
| uma tarefa ficou sua | `tarefa.responsavel_id` |
| mencionaram ou responderam você | `comentario.mencionados`, `responde_id` |
| um parecer ficou pendente com você | `tipo_fase.exige_setores` + papel AVALIADOR |
| seu projeto mudou de fase | `projeto.gerente_id` |

`notificacao` continua **sem política de INSERT**, e é o que mais importa aqui:
a única escrita possível é `app.notificar()`, `security definer`, chamada de
dentro dos gatilhos. Ninguém forja aviso em nome de outra pessoa a partir do
navegador. A caixa é privada até do proprietário.

Tela **Avisos** no menu, com contador de não lidos que reconfere de minuto em
minuto — quem escreve é um gatilho no banco, disparado por outra pessoa, e não
há nada nesta sessão para observar.

**Falta o e-mail.** Aviso dentro do sistema ainda exige abrir o sistema. O
envio precisa de Edge Function (a chave de serviço não desce para o navegador),
de um provedor de e-mail e de uma preferência por pessoa — quem quer receber o
quê. É o próximo passo deste item, e o que fecha a frase "o sistema procura a
pessoa".

**Falta também o prazo virando.** Esse não sai de gatilho: nada acontece no
banco quando um prazo vence sozinho. Precisa de `pg_cron` ou de um disparo
externo diário. Enquanto não existir, quem cobre esse buraco é a tela
**Meu trabalho**, que separa atrasadas de para hoje.

### 3 · Fase 2 — tempo

Calendário de trabalho, motor de CPM, Gantt, marcos e linha de base. Já
planejado. `calendario`, `calendario_excecao`, `linha_base` e
`tarefa_dependencia` estão no banco; os feriados já são semeados por
`app.semear_feriados`. **A linha de base é o que enche a curva S.**

`vw_agenda` também espera aqui: ela é a fonte do calendário e do iCal.

### 4 · Parcela: regra vira data

As 401 parcelas importadas são regra ("40% na aprovação, 30 dias"). Falta a
tela que, quando o evento acontece, grava o vencimento. **É o que enche o
fluxo mensal** — e é o que transforma o sistema em previsão de caixa.

### 5 · Medição → equipa o tipo Obra

`usa_medicao` já é `true` em Obra e `mede_avanco_por` já é `'MEDICAO'`. Sem as
telas de `medicao` e `medicao_item`, o avanço de uma obra não tem de onde sair.

### 6 · Recorrência → equipa o tipo Manutenção

`usa_recorrencia` já é `true`. Falta o que gera a próxima ocorrência quando a
anterior fecha.

### 7 · Contrato e fornecedor → equipa o tipo Contrato

`contrato`, `contrato_aditivo` e `fornecedor` existem e não têm tela. É também
a base do portal do fornecedor, que é pós-virada.

### 8 · Ocorrência e risco

A tabela existe. É o que separa acompanhar de gerenciar: o que pode dar errado,
quem cuida, o que foi feito.

### 9 · Tempo de fase

O dado já está sendo gravado em `projeto_fase_hist` desde o primeiro dia e
nunca foi mostrado. "Viabilidade leva em média 40 dias" é o número que muda
decisão, e custa uma view e um gráfico — nenhuma coluna nova.

### 10 · Relatório em PDF

Fase 4. Todo gráfico já tem "ver tabela"; o PDF é a mesma tabela impressa.

## Duas dívidas que não são funcionalidade

- **`gestplan-homolog` não existe.** Tudo foi testado contra produção,
  inclusive por agente de navegador — o que já custou um preço trocado uma vez.
  Enquanto for assim, todo teste é risco.
- **A porta do chamado anônimo aceita cerca de 30 pedidos por hora** variando o
  e-mail. Antes de divulgar o endereço para fora da empresa: captcha ou limite
  por IP.

## A regra que segura tudo isto

Nada aqui pode virar `if (tipo === 'OBRA')`. Medição é `usa_medicao`,
recorrência é `usa_recorrencia`, e as chaves já estão gravadas com o valor
certo em cada tipo. O que falta é a tela obedecer.
