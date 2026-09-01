# Publicar o GestPlan automaticamente

Depois disto, publicar vira um `git push`: o GitHub confere, aplica as
migrações e sobe o site na Hostinger — nessa ordem, que é a que não quebra.

São quatro passos, uma vez só. Leva uns quinze minutos.

---

## 1 · Criar o repositório, e ele precisa ser PRIVADO

Hoje o GestPlan existe **só no seu disco**. Vinte e sete migrações, 250
verificações, quatro meses de trabalho: um HD com defeito e acabou. O
repositório resolve a publicação, mas o que ele resolve de mais importante é
isso.

1. Em <https://github.com/new>, crie um repositório chamado `gestplan`.
2. Marque **Private**. Não é preguiça de decidir: o `.env` está fora do Git,
   mas o repositório carrega a estrutura do banco, as políticas de permissão e
   o roteiro da apresentação. Nada disso precisa estar aberto.
3. **Não** marque "Add a README" nem `.gitignore` — o projeto já tem os dois.

Depois, aqui:

```powershell
cd C:\Users\pedro\GestPlan
git remote add origin https://github.com/SEU-USUARIO/gestplan.git
git push -u origin main
```

Ele vai pedir usuário e senha: a senha é um **token**, não a sua senha do
GitHub. Crie um em *Settings → Developer settings → Personal access tokens →
Tokens (classic)*, com a permissão `repo`.

---

## 2 · Achar os dados da Hostinger

No **hPanel**, no site `gestplan.concrelab.net`:

Os valores desta conta, tirados do hPanel em 01/09/2026:

| Segredo | Valor |
|---|---|
| `FTP_SERVIDOR` | `46.17.175.131` — **sem o `ftp://`**. O prefixo é como o hPanel escreve para humano; a ferramenta espera só o endereço, e com ele na frente a conexão falha. |
| `FTP_USUARIO` | `u308383962.gestplan.concrelab.net` |
| `FTP_SENHA` | a senha da conta. Se não souber, *Alterar senha FTP* no hPanel. |
| `FTP_PASTA` | `/public_html/` — **com barra no começo e no fim** |

A porta 21 e o FTPS já estão fixos no fluxo; não precisam de segredo.

**Se o site subir e abrir em branco, é a pasta.** A conta FTP é a do subdomínio,
então a raiz dela já é a pasta do site e o `public_html` fica logo dentro — daí
`/public_html/`. Para confirmar sem adivinhar: conecte com o FileZilla e veja
onde está o `index.html` que hoje serve o site. É essa pasta, com barra no fim.

---

## 3 · Achar os dados do Supabase

| O que | Onde |
|---|---|
| **Access token** | <https://supabase.com/dashboard/account/tokens> → *Generate new token*. É o que deixa o GitHub aplicar migrações no seu lugar. |
| **Senha do banco** | A que você definiu ao criar o projeto. Se não lembrar: *Project Settings → Database → Reset database password*. |
| **URL e chave anônima** | *Project Settings → API*. São os mesmos dois valores do seu `.env`. |

A chave anônima **não é segredo** — ela vai dentro do arquivo que o navegador
baixa, e a proteção de verdade é a RLS. Mesmo assim ela entra como segredo
aqui, porque é o padrão e não custa nada.

---

## 4 · Guardar tudo no GitHub

No repositório: **Settings → Secrets and variables → Actions**.

Na aba **Secrets** (escondidos até de você, depois de salvos):

| Nome | Valor |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | o token do passo 3 |
| `SUPABASE_DB_PASSWORD` | a senha do banco |
| `VITE_SUPABASE_ANON_KEY` | a chave anônima |
| `FTP_SERVIDOR` | `46.17.175.131` (sem `ftp://`) |
| `FTP_USUARIO` | `u308383962.gestplan.concrelab.net` |
| `FTP_SENHA` | a senha da conta FTP |

**E só.** A aba *Variables* pode ficar vazia: o ref do projeto, a URL do
Supabase e a pasta do site não são segredo e já estão escritos no
`publicar.yml` como padrão.

Se um dia você quiser publicar noutro lugar — homologação, outro domínio —
crie a variável correspondente e ela ganha do padrão, sem mexer no fluxo:

| Nome | Padrão de hoje |
|---|---|
| `SUPABASE_PROJECT_REF` | `xsznzzvutdlulkhslcuz` |
| `VITE_SUPABASE_URL` | `https://xsznzzvutdlulkhslcuz.supabase.co` |
| `FTP_PASTA` | `/public_html/` |

---

## Pronto. Como fica o dia a dia

```powershell
git add <os arquivos que você mexeu>
git commit -m "o que mudou"
git push
```

E acabou. Em uns três minutos o site está no ar.

Acompanhe pela aba **Actions** do repositório. São dois passos:

1. **Conferir** — tipos, paleta de gráfico e as nove suítes, 250 verificações.
2. **Publicar** — migrações primeiro, `dist` depois.

**Se a conferência falhar, nada sobe.** É de propósito: a suíte de permissão já
pegou três vazamentos que nenhum teste de tela pegaria, e até agora dependia de
alguém lembrar de rodá-la.

### Para publicar sem commit

Aba **Actions → Publicar → Run workflow**. Útil quando você mudou algo só no
Supabase e quer reaplicar.

### Quando algo falhar

O log de cada passo fica na aba Actions. Os tropeços prováveis, na ordem:

- **`supabase link` recusa** — o `SUPABASE_ACCESS_TOKEN` expirou ou a senha do
  banco está errada.
- **FTP recusa a conexão** — primeiro tente `protocol: ftps-legacy` e
  `port: 990` no `publicar.yml`. Se ainda recusar, veja em *Arquivos → Contas
  FTP* se há restrição de IP: o GitHub sai de um endereço diferente a cada
  execução, então uma lista de IPs permitidos bloqueia a publicação.
- **O site sobe mas abre em branco** — a `FTP_PASTA` aponta para o lugar
  errado, ou faltou a barra no fim e os arquivos foram parar numa subpasta.
