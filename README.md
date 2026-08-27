# GestPlan

Plataforma de gestão de projetos da Habitual. React 19 + Vite + TypeScript sobre
Supabase.

O modelo de dados está pronto e testado. O que falta é a casca do app — é aqui
que você continua, no VS Code, com o Claude Code.

**Leia o `CLAUDE.md` antes de começar.** Ele é lido pelo Claude Code a cada
sessão e é onde estão as regras que não podem ser quebradas.

---

## Fase 0 — do zero ao primeiro login

Onze passos. Faça na ordem; cada um depende do anterior.

### 1. Instale o que falta

| | Como conferir | Onde pegar |
|---|---|---|
| Node 20+ | `node -v` | nodejs.org |
| Git | `git --version` | git-scm.com |
| VS Code | — | code.visualstudio.com |
| Supabase CLI | `supabase --version` | `npm i -g supabase` |
| psql (opcional) | `psql --version` | vem com o Postgres |

O `psql` só é preciso para rodar as suítes de teste localmente. Vale a pena.

### 2. Abra a pasta no VS Code e ligue o Claude Code

```powershell
cd C:\Users\pedro\GestPlan
code .
```

Instale a extensão **Claude Code** (o VS Code vai sugerir — está em
`.vscode/extensions.json`). Abra o painel dela e confirme que ele leu o
`CLAUDE.md`: peça *"me resuma as regras deste projeto"*. Se a resposta não
mencionar a regra de ouro e a RLS, algo não carregou.

### 3. Coloque sob controle de versão — antes de qualquer outra coisa

```powershell
git init
git add .
git commit -m "GestPlan: modelo de dados e esqueleto do app"
```

Depois crie o repositório privado no GitHub e empurre. Isto é o passo que o
desktop nunca teve, e é o que permite voltar atrás.

### 4. Crie o projeto no Supabase

No painel do Supabase, **New project**:

- Nome: `gestplan`
- Região: **South America (São Paulo)** — resolve LGPD sem discussão
- Guarde a senha do banco num gerenciador de senhas, não num arquivo

Crie um segundo projeto, `gestplan-homolog`, para homologação. Custa pouco e é
o que separa você de desenvolver direto em produção.

### 5. Ligue o CLI ao projeto

```powershell
supabase login
supabase init          # cria supabase/config.toml (fica fora do Git)
supabase link --project-ref SEU_REF
```

O `--project-ref` está na URL do painel: `supabase.com/dashboard/project/<ref>`.

### 6. Aplique as migrações

```powershell
supabase db push
```

Dez arquivos, na ordem do nome. Ao final o banco tem 43 tabelas, 9 views e 94
políticas de RLS.

Se preferir conferir antes de subir, rode local:

```powershell
supabase start         # sobe um Postgres em Docker
supabase db reset      # aplica todas as migrações do zero
```

### 7. Rode os testes

```powershell
rodar_testes.bat
```

76 verificações num banco descartável. **Se falhar, pare e conserte antes de
seguir** — é o contrato do modelo com você.

### 8. Configure o front

```powershell
copy .env.example .env
```

Preencha com **Project Settings > API** do painel:

- `VITE_SUPABASE_URL` — Project URL
- `VITE_SUPABASE_ANON_KEY` — a chave `anon` / `public`

A chave `anon` é pública por natureza: quem protege o dado é a RLS, não ela. A
`service_role` **nunca** entra no `.env` do front nem em nenhum arquivo daqui.

### 9. Suba o app

```powershell
npm install
npm run dev
```

Abra `http://localhost:5173`, digite seu e-mail e peça o link de acesso.

Se o e-mail não chegar: no painel, **Authentication > URL Configuration**,
ponha `http://localhost:5173` em *Site URL* e em *Redirect URLs*.

### 10. Vincule o seu login à sua pessoa

Depois de pedir o link (é isso que cria a linha em `auth.users`), abra o **SQL
Editor** do painel e rode `supabase/primeiro_acesso.sql`, trocando o e-mail e o
nome no topo.

Sem esse passo a RLS nega tudo — corretamente: o banco não sabe quem você é. O
app mostra um aviso explicando isso em vez de uma lista vazia sem explicação.

### 11. Gere os tipos do banco

```powershell
npm run tipos:remoto     # ou npm run tipos, se estiver usando o local
```

Escreve `src/lib/banco.types.ts` a partir do schema. **Rode de novo toda vez que
mudar o banco** — é o que faz o TypeScript avisar quando uma coluna some.

---

## Pronto quando

> Você entra no sistema, cadastra uma empresa e convida alguém.

Cadastre uma empresa na tela **Empresas** e confirme que ela aparece. É o fim da
Fase 0.

---

## O dia a dia daqui em diante

```powershell
npm run dev                    # desenvolver
rodar_testes.bat               # antes de todo commit que toca o banco
supabase migration new nome    # mudança de estrutura = arquivo NOVO
supabase db push               # aplicar em homologação, depois em produção
npm run tipos:remoto           # sempre que o schema mudar
npm run build                  # gerar o dist/ para o Hostinger
```

### Nunca

- Editar migração já aplicada — sempre arquivo novo
- Criar view sem `with (security_invoker = true)`
- Criar tabela sem RLS e sem política no mesmo commit
- Escrever `if (tipo === 'INVESTIMENTO')` — isso é dado, não código
- Subir para produção sem passar por homologação

---

## Como trabalhar com o Claude Code aqui

O `CLAUDE.md` já dá o contexto. O que rende, na prática:

- **Peça uma coisa por vez, do tamanho de um commit.** "Faça a tela de cadastro
  de projeto lendo os campos de `campo_definicao`" rende; "faça o sistema" não.
- **Mande ele ler antes de escrever.** "Leia `supabase/migrations/*_tipos.sql` e
  me diga como a tela deve montar o formulário" evita metade dos erros.
- **Cobre a regra de ouro.** Se aparecer condicional por nome de tipo, mande
  refazer lendo a configuração. É a disciplina que segura o produto.
- **Teste junto.** Toda tabela, papel ou política nova pede um caso novo em
  `testes/02_permissao.sql`, no mesmo commit.
- **Commits pequenos e frequentes.** Agora dá para voltar atrás — use isso.

---

## Mapa da pasta

```
CLAUDE.md                 regras do projeto, lidas pelo Claude Code
supabase/
  migrations/             as 10 migrações, na ordem do nome
  primeiro_acesso.sql     vincula o seu login à sua pessoa (rodar uma vez)
testes/
  00_stub_supabase.sql    auth.users e papéis, só para rodar fora do Supabase
  01_regras.sql           40 verificações de regra de negócio
  02_permissao.sql        36 verificações de permissão, uma por papel
src/
  estilos/tokens.css      identidade: cores, tipografia, peças
  lib/supabase.ts         o cliente
  lib/banco.ts            todo acesso a dado passa por aqui
  lib/formato.ts          moeda, data, competência em pt-BR
  paginas/                Entrar, Carteira, Empresas, Equipe
  App.tsx                 casca: barra lateral e troca de página
rodar_testes.bat          apaga o banco de teste, aplica tudo, roda as suítes
```

## O que vem depois da Fase 0

Fase 1 — núcleo de projeto: criar projeto de qualquer tipo, etapas, tarefas,
anexos, kanban. É onde o motor de campos customizados encontra a tela: o
formulário se monta lendo `campo_definicao`, sem saber o nome de nenhum tipo.
