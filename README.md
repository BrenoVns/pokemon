# Fichário Pokémon

Um fichário digital, pessoal, para organizar a sua coleção de cartas Pokémon. Você cadastra as cartas, vê a arte de cada uma numa grade e, ao tocar na arte, abre a página da carta na [LigaPokemon](https://www.ligapokemon.com.br) em nova aba para consultar o preço.

- **Artes e dados das cartas:** [TCGdex](https://tcgdex.dev), API pública e gratuita (português primeiro, inglês quando faltar).
- **Login, banco e fotos:** [Supabase](https://supabase.com) (link mágico por e-mail, Postgres com RLS, Storage privado).
- **App instalável (PWA):** funciona offline com a coleção salva e sincroniza quando a conexão volta.
- **Hospedagem:** GitHub Pages, publicado pelo GitHub Actions a cada push na `main`.

> O app **não** busca preços nem faz scraping da LigaPokemon. Ele só monta o link da carta (ou usa o link que você colar).

---

## Como funciona

| Gesto | O que acontece |
| --- | --- |
| Tocar na **arte** | Abre a carta na LigaPokemon (nova aba) |
| Tocar no **nome** abaixo da carta, ou **segurar** a arte | Abre o detalhe para editar |
| Botão **+** na barra inferior | Adicionar carta (busca no TCGdex ou cadastro manual) |
| **Sets** | Progresso por set; dentro do set, as cartas que faltam aparecem em cinza com um **+** |

Cada combinação de carta + condição + idioma + variante é um registro. Se você adicionar de novo a mesma combinação, a quantidade é somada.

Link automático da Liga, quando você não cola um:

```
https://www.ligapokemon.com.br/?view=cards/card&card=Gengar%20ex(154/128)
```

---

## Passo a passo de configuração

### 1. Criar o projeto no Supabase e rodar a migração

1. Crie uma conta em [supabase.com](https://supabase.com) e clique em **New project**. Escolha a região **South America (São Paulo)**.
2. Quando o projeto terminar de subir, abra **SQL Editor → New query**.
3. Copie todo o conteúdo de [`supabase/migrations/20261003000000_init.sql`](supabase/migrations/20261003000000_init.sql), cole e clique em **Run**.

A migração cria as tabelas `collections` e `cards`, liga a RLS (cada usuário só vê as próprias linhas), cria o bucket `card-photos` e as políticas de acesso dele.

> Usa a Supabase CLI? `supabase link --project-ref <ref>` e depois `supabase db push` fazem o mesmo.

### 2. Conferir o bucket de fotos

A migração já cria o bucket. Para conferir, vá em **Storage**: deve existir o bucket **`card-photos`**, **privado** (sem o selo "Public").

Se ele não aparecer, crie manualmente: **New bucket** → nome `card-photos` → deixe **Public bucket desligado** → **Save**. Depois rode de novo só a parte "Storage" do SQL da migração para criar as políticas. As fotos ficam numa pasta por usuário (`<user_id>/arquivo.jpg`), e cada usuário só acessa a própria pasta.

### 3. Configurar o login (Auth)

Em **Authentication → URL Configuration**:

- **Site URL:** `https://<seu-usuario>.github.io/pokemon/`
- **Redirect URLs** (adicione as duas):
  - `https://<seu-usuario>.github.io/pokemon/**`
  - `http://localhost:5173/**`

Em **Authentication → Sign In / Providers**, confirme que **Email** está ativo.

**Recomendado para o iPhone:** o app instalado na tela inicial do iPhone não recebe o link mágico (o link abre no Safari, não no app). Por isso a tela de login também aceita o **código** do e-mail. Para o código aparecer, vá em **Authentication → Emails → Magic Link** e inclua `{{ .Token }}` no corpo, por exemplo:

```html
<h2>Entrar no Fichário</h2>
<p><a href="{{ .ConfirmationURL }}">Toque aqui para entrar</a></p>
<p>Ou digite este código no app: <strong>{{ .Token }}</strong></p>
```

> O e-mail padrão do Supabase tem limite baixo de envios por hora. Para uso pessoal costuma bastar; se precisar de mais, configure um SMTP próprio em **Project Settings → Authentication → SMTP**.

### 4. Pegar as chaves do Supabase

Em **Project Settings → API** (ou **Data API**), copie:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key (ou *publishable key*) → `VITE_SUPABASE_ANON_KEY`

A chave anon é pública por natureza (vai no JavaScript do site); quem protege os dados é a RLS. **Nunca** use a chave `service_role` no app.

### 5. Adicionar os Secrets no GitHub

No repositório: **Settings → Secrets and variables → Actions → New repository secret**. Crie dois:

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | a Project URL |
| `VITE_SUPABASE_ANON_KEY` | a chave anon |

### 6. Ativar o GitHub Pages

Em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions**.

Depois, vá em **Actions → Deploy no GitHub Pages → Run workflow** (ou faça qualquer push na `main`). Em um ou dois minutos o app estará no ar.

### 7. Instalar como app no celular

**Android (Chrome):** abra o endereço do app → menu **⋮** → **Instalar app** (ou **Adicionar à tela inicial**).

**iPhone (Safari):** abra o endereço do app no **Safari** → botão **Compartilhar** → **Adicionar à Tela de Início** → **Adicionar**. Ao entrar pela primeira vez no app instalado, use o **código** do e-mail (passo 3).

---

## Rodar localmente

Requer Node 22+.

```bash
cp .env.example .env.local   # preencha com a URL e a chave anon
npm install
npm run dev                  # http://localhost:5173/pokemon/
```

Outros comandos:

```bash
npm run build      # typecheck + build de produção em dist/
npm run lint       # ESLint
npm run typecheck  # só o TypeScript
npm run icons      # regenera os ícones PNG do PWA
```

## Estrutura

```
src/
  components/   UI (arte da carta, grades, bottom sheet, provider da coleção…)
  hooks/        estado da coleção, rotas, toque longo, cor dominante…
  lib/
    supabase.ts cliente do Supabase
    tcgdex.ts   busca e cache (memória + IndexedDB) da API do TCGdex
    liga.ts     montagem dos links da LigaPokemon
  screens/      Coleção, Sets, Set, Detalhe, Configurações, Login
supabase/migrations/   esquema do banco, RLS e Storage
```

Notas técnicas:

- **Offline:** a coleção fica em cache no IndexedDB. Alterações feitas sem internet entram numa fila local e são enviadas quando a conexão volta. As artes do TCGdex e as fotos próprias também ficam em cache.
- **Várias coleções:** o banco já tem a tabela `collections` e cada carta aponta para uma coleção. Hoje a interface usa só a "Coleção principal", criada no primeiro login.
- **Sombra colorida:** a cor é extraída da arte via canvas. Algumas imagens do TCGdex vêm com cabeçalho CORS duplicado e não podem ser lidas; nesse caso a sombra fica neutra.
- **Backup:** em Configurações dá para exportar e importar um JSON (mesclar ou substituir). As fotos próprias continuam no Storage e não entram no arquivo.

## Endereço do app

Depois do deploy, o app fica em:

**https://&lt;seu-usuario&gt;.github.io/pokemon/**
