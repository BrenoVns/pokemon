# Fichário Pokémon

Um fichário digital, pessoal, para organizar a sua coleção de cartas Pokémon. Você busca a carta, adiciona à coleção, vê a arte de cada uma numa grade e, ao tocar na arte, abre a página exata da carta na [LigaPokemon](https://www.ligapokemon.com.br) em nova aba para consultar o preço.

- **Cartas e imagens:** catálogo da LigaPokemon (todas as edições, com link exato e imagem de cada carta), gerado pelo script `npm run catalogo-liga` e publicado junto com o app.
- **Sem conta e sem servidor:** a coleção fica salva no próprio aparelho (IndexedDB do navegador).
- **App instalável (PWA):** abre e mostra a coleção mesmo offline.
- **Hospedagem:** GitHub Pages, publicado pelo GitHub Actions a cada push na `main`.

> O app não acessa a LigaPokemon nem busca preços: ele só lê o catálogo publicado e abre o link da carta.

---

## Como funciona

| Gesto                                                    | O que acontece                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Tocar na **arte**                                        | Abre a carta na LigaPokemon (nova aba)                                                 |
| Tocar no **nome** abaixo da carta, ou **segurar** a arte | Abre o detalhe para editar                                                             |
| Botão **+** na barra inferior                            | Adicionar carta (busca no catálogo da Liga ou cadastro manual)                         |
| **Edições**                                              | Progresso por edição; dentro dela, as cartas que faltam aparecem em cinza com um **+** |

- A busca usa os **nomes em inglês**, como na Liga ("Professor's Research"). Pokémon têm o mesmo nome nas duas línguas. Pontuação e "&"/"e" são ignorados: "pikachu e zekrom" acha "Pikachu & Zekrom-GX".
- Edições lançadas no Brasil aparecem primeiro; depois as estrangeiras (japonesas, chinesas, promos).
- Cada combinação de carta + condição + idioma + variante é um registro. Adicionar de novo a mesma combinação soma a quantidade.

---

## Catálogo da LigaPokemon

O arquivo `public/liga/catalog.json` tem todas as edições e cartas da Liga (nome, número, edição, link e imagem; sem preços). Ele é gerado por um script que precisa rodar numa **conexão residencial no Brasil**: a Liga bloqueia servidores de nuvem (por isso não roda no GitHub Actions).

```bash
npm run catalogo-liga                  # baixa edições novas ou recentes (uso normal, poucos minutos)
npm run catalogo-liga -- --ed=30C,DLR  # só estas edições (pelo código da Liga)
npm run catalogo-liga -- --continuar   # retoma um download interrompido
npm run catalogo-liga -- --full        # baixa tudo de novo (cerca de 1 hora)
npm run catalogo-liga -- --montar      # só remonta o arquivo com o que já está em cache
```

O script vai devagar de propósito (uma requisição por vez, com pausa que aumenta quando a Liga pede calma) e guarda o progresso em `scripts/.liga-cache/`. Depois de rodar, faça commit e push do `public/liga/catalog.json` para publicar.

Quando sair uma coleção nova, rode `npm run catalogo-liga` e publique.

---

## Onde ficam os dados

Tudo fica **só no aparelho** em que você cadastrou (não sincroniza entre celular e computador). Se apagar os dados do navegador ou desinstalar o app, a coleção some, então use **Configurações → Exportar backup** de vez em quando. O arquivo JSON também serve para levar a coleção para outro aparelho (Importar backup → mesclar ou substituir). Em **Configurações → Apagar todas as cartas** dá para recomeçar do zero.

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
  components/      UI (arte da carta, grades, bottom sheet, provider da coleção…)
  hooks/           estado da coleção, rotas, toque longo…
  lib/
    ligaCatalog.ts leitura e busca no catálogo da Liga
    liga.ts        links da LigaPokemon (cadastro manual)
  screens/         Minha Coleção, Edições, Edição, Detalhe, Configurações
scripts/
  liga-catalog.mjs gera public/liga/catalog.json
```

Notas técnicas:

- **Offline:** a coleção fica no IndexedDB; o catálogo da Liga fica em cache pelo service worker.
- **Várias coleções:** cada carta já aponta para uma coleção (`collection_id`); hoje a interface usa só "Minha Coleção".

## Endereço do app

**https://brenovns.github.io/pokemon/**
