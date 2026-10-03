// Catálogo de cartas da LigaPokemon, gerado por scripts/liga-catalog.mjs e publicado com o app
// (public/liga/catalog.json). O app só lê este arquivo — nunca acessa a Liga diretamente.
import { normalize } from './stats'

export interface LigaEdition {
  id: number
  code: string
  namePt: string
  nameEn: string
  release: string
  group: number
  /** Nome para exibir (português quando houver) */
  name: string
}

export interface LigaCard {
  edition: LigaEdition
  /** Rótulo como na Liga: "Pikachu ex (054/128)" */
  label: string
  /** Nome em inglês, sem o número */
  name: string
  num: string
  total: string | null
  image: string | null
  url: string
}

interface RawCatalog {
  v: number
  generated: string
  imgPrefix: string
  editions: [number, string, string, string, string, number][]
  cards: [number, string, string, string][]
}

export interface Catalog {
  generated: string
  editions: LigaEdition[]
  cards: LigaCard[]
  byEdition: Map<number, LigaCard[]>
  editionById: Map<number, LigaEdition>
  /** nome normalizado de cada carta, na mesma ordem de cards */
  searchNames: string[]
}

const SITE = 'https://www.ligapokemon.com.br/'

function encodeLiga(value: string): string {
  return encodeURIComponent(value).replace(/%2F/gi, '/').replace(/%28/g, '(').replace(/%29/g, ')')
}

export function ligaCardPageUrl(label: string, code: string, num: string): string {
  return `${SITE}?view=cards/card&card=${encodeLiga(label)}&ed=${encodeURIComponent(code)}&num=${encodeURIComponent(num)}`
}

function splitLabel(label: string): { name: string; total: string | null } {
  const m = label.match(/^(.*?)\s*\(([^()]*)\)\s*$/)
  if (!m) return { name: label, total: null }
  const slash = m[2].split('/')
  return { name: m[1].trim(), total: slash.length > 1 ? slash[1].trim() : null }
}

function build(raw: RawCatalog): Catalog {
  const editions = raw.editions.map(([id, code, namePt, nameEn, release, group]) => ({
    id,
    code,
    namePt,
    nameEn,
    release,
    group,
    name: namePt || nameEn,
  }))
  const byEdition = new Map<number, LigaCard[]>()
  const cards: LigaCard[] = []
  const searchNames: string[] = []
  for (const [edIdx, label, num, img] of raw.cards) {
    const edition = editions[edIdx]
    const { name, total } = splitLabel(label)
    const card: LigaCard = {
      edition,
      label,
      name,
      num,
      total,
      image: img ? (img.startsWith('//') ? `https:${img}` : `${raw.imgPrefix}${img}`) : null,
      url: ligaCardPageUrl(label, edition.code, num),
    }
    cards.push(card)
    searchNames.push(normalize(name))
    const list = byEdition.get(edition.id)
    if (list) list.push(card)
    else byEdition.set(edition.id, [card])
  }
  return {
    generated: raw.generated,
    editions,
    cards,
    byEdition,
    editionById: new Map(editions.map((e) => [e.id, e])),
    searchNames,
  }
}

let loading: Promise<Catalog | null> | null = null

/** Carrega o catálogo uma vez (o service worker guarda para uso offline). */
export function loadCatalog(): Promise<Catalog | null> {
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}liga/catalog.json`)
      .then((r) => (r.ok ? (r.json() as Promise<RawCatalog>) : null))
      .then((raw) => (raw && raw.cards?.length ? build(raw) : null))
      .catch(() => null)
    loading.then((c) => {
      if (!c) loading = null // tenta de novo na próxima vez
    })
  }
  return loading
}

/** Número sem zeros à esquerda, para comparar "018" com "18". */
export function plainNumber(n: string | null | undefined): string {
  const v = (n ?? '').trim()
  return /^\d+$/.test(v) ? String(parseInt(v, 10)) : v.toUpperCase()
}

/** Edição lançada no Brasil (a Liga só dá nome em português para essas). */
export function isBrazilian(edition: LigaEdition): boolean {
  return Boolean(edition.namePt)
}

/** Brasileiras primeiro; dentro de cada grupo, as mais novas primeiro. */
function byRecent(a: LigaCard, b: LigaCard) {
  return (
    Number(isBrazilian(b.edition)) - Number(isBrazilian(a.edition)) ||
    b.edition.release.localeCompare(a.edition.release) ||
    a.num.localeCompare(b.num, undefined, { numeric: true })
  )
}

/**
 * Busca por nome. A Liga usa nomes em inglês; `alsoNames` permite incluir nomes vindos
 * de outra fonte (ex.: a tradução do TCGdex de uma busca em português).
 */
export function searchCatalog(catalog: Catalog, query: string, alsoNames: string[] = []): LigaCard[] {
  const q = normalize(query.trim())
  if (q.length < 2) return []
  const extra = new Set(alsoNames.map((n) => normalize(n)))
  const out: LigaCard[] = []
  for (let i = 0; i < catalog.cards.length; i++) {
    const n = catalog.searchNames[i]
    if (n.includes(q) || extra.has(n)) out.push(catalog.cards[i])
  }
  return out.sort(byRecent)
}

/** Acha a carta da Liga equivalente a uma carta salva/do TCGdex (nome em inglês + número + total). */
export function findLigaCard(
  catalog: Catalog,
  card: { name: string; name_en?: string | null; card_number: string | null; set_total: string | null },
): LigaCard | null {
  const num = plainNumber(card.card_number)
  if (!num) return null
  const names = new Set([normalize(card.name_en ?? ''), normalize(card.name)].filter(Boolean))
  const total = plainNumber(card.set_total)
  const matches: LigaCard[] = []
  for (let i = 0; i < catalog.cards.length; i++) {
    if (!names.has(catalog.searchNames[i])) continue
    const c = catalog.cards[i]
    if (plainNumber(c.num) === num && (!total || plainNumber(c.total) === total)) matches.push(c)
  }
  // Mais de uma (ex.: mesma carta em edição normal e variante): fica com a principal (sem grupo).
  matches.sort((a, b) => Number(a.edition.group !== 0) - Number(b.edition.group !== 0) || byRecent(a, b))
  return matches[0] ?? null
}
