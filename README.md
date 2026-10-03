# Fichário Pokémon

Um fichário digital, pessoal, para organizar a sua coleção de cartas Pokémon. Você cadastra as cartas, vê a arte de cada uma numa grade e, ao tocar na arte, abre a página da carta na [LigaPokemon](https://www.ligapokemon.com.br) em nova aba para consultar o preço.

- **Artes e dados das cartas:** [TCGdex](https://tcgdex.dev), API pública e gratuita (português primeiro, inglês quando faltar).
- **Sem conta e sem servidor:** cartas e fotos ficam salvas no próprio aparelho (IndexedDB do navegador).
- **App instalável (PWA):** abre e mostra a coleção mesmo offline.
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

## Onde ficam os dados

Tudo fica **só no aparelho** em que você cadastrou (não sincroniza entre celular e computador). Se apagar os dados do navegador ou desinstalar o app, a coleção some, então use **Configurações → Exportar backup** de vez em quando. O arquivo JSON inclui as fotos e também serve para levar a coleção para outro aparelho (Importar backup → mesclar ou substituir).

## Instalar como app no celular

**Android (Chrome):** abra o endereço do app → menu **⋮** → **Instalar app** (ou **Adicionar à tela inicial**).

**iPhone (Safari):** abra o endereço do app no **Safari** → botão **Compartilhar** → **Adicionar à Tela de Início** → **Adicionar**.

---

## Rodar localmente

Requer Node 22+.

```bash
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
    tcgdex.ts   busca e cache (memória + IndexedDB) da API do TCGdex
    liga.ts     montagem dos links da LigaPokemon
  screens/      Coleção, Sets, Set, Detalhe, Configurações
```

Notas técnicas:

- **Offline:** a coleção e as fotos ficam no IndexedDB; as artes e respostas do TCGdex ficam em cache.
- **Várias coleções:** cada carta já aponta para uma coleção (`collection_id`); hoje a interface usa só a "Coleção principal".
- **Sombra colorida:** a cor é extraída da arte via canvas. Algumas imagens do TCGdex vêm com cabeçalho CORS duplicado e não podem ser lidas; nesse caso a sombra fica neutra.

## Endereço do app

Depois do deploy, o app fica em:

**https://brenovns.github.io/pokemon/**
