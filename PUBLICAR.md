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

| Onde | O que anotar |
|---|---|
| **Arquivos → Contas FTP** | Servidor (algo como `ftp.concrelab.net` ou um IP), usuário e senha. Se não houver conta, crie uma. |
| **Arquivos → Gerenciador de arquivos** | O caminho da pasta do site. Costuma ser `/public_html` no domínio principal e `/public_html/gestplan` ou `/domains/gestplan.concrelab.net/public_html` num subdomínio. |

Para descobrir a pasta certa sem adivinhar: abra o Gerenciador de arquivos,
entre na pasta onde está o `index.html` que hoje serve o site, e copie o
caminho que aparece na barra de cima. **É essa pasta.**

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
| `FTP_SERVIDOR` | o servidor FTP |
| `FTP_USUARIO` | o usuário FTP |
| `FTP_SENHA` | a senha FTP |

Na aba **Variables** (visíveis, porque não são segredo):

| Nome | Valor |
|---|---|
| `SUPABASE_PROJECT_REF` | `xsznzzvutdlulkhslcuz` |
| `VITE_SUPABASE_URL` | `https://xsznzzvutdlulkhslcuz.supabase.co` |
| `FTP_PASTA` | o caminho do passo 2, **com barra no fim** — ex.: `/public_html/` |

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
- **FTP recusa a conexão** — a Hostinger às vezes bloqueia FTP de fora por
  segurança. Em *Arquivos → Contas FTP*, confira se há restrição de IP.
- **O site sobe mas abre em branco** — a `FTP_PASTA` aponta para o lugar
  errado, ou faltou a barra no fim e os arquivos foram parar numa subpasta.
