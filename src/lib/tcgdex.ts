// Cliente da API pública do TCGdex (https://tcgdex.dev) com cache em memória + IndexedDB.
import { idbGet, idbSet } from './idb'

export type TcgLang = 'pt' | 'en'

const API = 'https://api.tcgdex.net/v2'
const TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 dias

export interface TcgCardBrief {
  id: string
  localId: string
  name: string
  image: string | null
}

export interface TcgSetBrief {
  id: string
  name: string
  official: number
  total: number
}

export interface TcgCard extends TcgCardBrief {
  lang: TcgLang
  set: TcgSetBrief
}

export interface TcgSet extends TcgSetBrief {
  lang: TcgLang
  cards: TcgCardBrief[]
}

export function imageUrl(base: string | null | undefined, quality: 'low' | 'high'): string | null {
  return base ? `${base}/${quality}.webp` : null
}

export function otherLang(lang: TcgLang): TcgLang {
  return lang === 'pt' ? 'en' : 'pt'
}

/** O id de uma carta é "<setId>-<número>" (ex.: sv03.5-094). */
export function setIdFromCardId(cardId: string): string {
  const i = cardId.lastIndexOf('-')
  return i > 0 ? cardId.slice(0, i) : cardId
}

// ---------------------------------------------------------------------------
// fetch com cache
// ---------------------------------------------------------------------------
const memory = new Map<string, Promise<unknown>>()

class NotFoundError extends Error {}

interface CachedEntry {
  at: number
  data: unknown
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const key = `tcgdex:${path}`
  const hit = memory.get(key)
  if (hit) return hit as Promise<T | null>

  const promise = (async () => {
    const cached = await idbGet<CachedEntry>(key)
    if (cached && Date.now() - cached.at < TTL_MS) return cached.data as T | null
    try {
      const res = await fetch(`${API}${path}`)
      if (res.status === 404) throw new NotFoundError()
      if (!res.ok) throw new Error(`TCGdex respondeu ${res.status}`)
      const data = (await res.json()) as T
      void idbSet(key, { at: Date.now(), data } satisfies CachedEntry)
      return data
    } catch (err) {
      if (err instanceof NotFoundError) {
        void idbSet(key, { at: Date.now(), data: null } satisfies CachedEntry)
        return null
      }
      // Offline ou erro de rede: usa o cache vencido, se existir.
      if (cached) return cached.data as T | null
      throw err
    }
  })()

  memory.set(key, promise)
  promise.catch(() => memory.delete(key))
  return promise
}

// ---------------------------------------------------------------------------
// Formatos crus da API
// ---------------------------------------------------------------------------
interface RawBrief {
  id: string
  localId: string | number
  name: string
  image?: string
}

interface RawCount {
  official?: number
  total?: number
}

interface RawSetBrief {
  id: string
  name: string
  cardCount?: RawCount
}

interface RawCard extends RawBrief {
  set: RawSetBrief
}

interface RawSet extends RawSetBrief {
  cards?: RawBrief[]
}

function toBrief(r: RawBrief): TcgCardBrief {
  return { id: r.id, localId: String(r.localId), name: r.name, image: r.image ?? null }
}

function toSetBrief(r: RawSetBrief): TcgSetBrief {
  const official = r.cardCount?.official ?? r.cardCount?.total ?? 0
  return { id: r.id, name: r.name, official, total: r.cardCount?.total ?? official }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------
export async function getSets(lang: TcgLang): Promise<Map<string, TcgSetBrief>> {
  const raw = (await fetchJson<RawSetBrief[]>(`/${lang}/sets`)) ?? []
  return new Map(raw.map((s) => [s.id, toSetBrief(s)]))
}

export interface SearchResult {
  lang: TcgLang
  cards: TcgCardBrief[]
  /** true quando a busca no idioma pedido veio vazia e usamos o outro idioma */
  fellBack: boolean
}

async function rawSearch(name: string, lang: TcgLang): Promise<TcgCardBrief[]> {
  const raw = (await fetchJson<RawBrief[]>(`/${lang}/cards?name=${encodeURIComponent(name)}`)) ?? []
  return raw.map(toBrief)
}

/** Preenche imagens ausentes com as do outro idioma (mesmo id de carta). */
async function fillImages(cards: TcgCardBrief[], fetchOther: () => Promise<TcgCardBrief[]>) {
  if (cards.every((c) => c.image)) return cards
  try {
    const other = new Map((await fetchOther()).map((c) => [c.id, c.image]))
    return cards.map((c) => (c.image ? c : { ...c, image: other.get(c.id) ?? null }))
  } catch {
    return cards
  }
}

export async function searchCards(query: string, lang: TcgLang): Promise<SearchResult> {
  const q = query.trim()
  if (q.length < 2) return { lang, cards: [], fellBack: false }
  let cards = await rawSearch(q, lang)
  if (cards.length === 0 && lang === 'pt') {
    return { lang: 'en', cards: await rawSearch(q, 'en'), fellBack: true }
  }
  if (lang === 'pt') cards = await fillImages(cards, () => rawSearch(q, 'en'))
  return { lang, cards, fellBack: false }
}

/** Detalhe da carta: tenta o idioma pedido e cai para o outro; completa a imagem se faltar. */
export async function getCard(id: string, lang: TcgLang = 'pt'): Promise<TcgCard | null> {
  const enc = encodeURIComponent(id)
  let usedLang = lang
  let raw = await fetchJson<RawCard>(`/${lang}/cards/${enc}`)
  if (!raw) {
    usedLang = otherLang(lang)
    raw = await fetchJson<RawCard>(`/${usedLang}/cards/${enc}`)
  }
  if (!raw) return null
  const card: TcgCard = { ...toBrief(raw), lang: usedLang, set: toSetBrief(raw.set) }
  if (!card.image) {
    try {
      const alt = await fetchJson<RawCard>(`/${otherLang(usedLang)}/cards/${enc}`)
      if (alt?.image) card.image = alt.image
    } catch {
      // sem imagem alternativa
    }
  }
  return card
}

/** Set completo, com todas as cartas. Prefere pt e completa imagens com en. */
export async function getSet(setId: string, lang: TcgLang = 'pt'): Promise<TcgSet | null> {
  const enc = encodeURIComponent(setId)
  let usedLang = lang
  let raw = await fetchJson<RawSet>(`/${lang}/sets/${enc}`)
  if (!raw) {
    usedLang = otherLang(lang)
    raw = await fetchJson<RawSet>(`/${usedLang}/sets/${enc}`)
  }
  if (!raw) return null
  const fetchOther = async () =>
    ((await fetchJson<RawSet>(`/${otherLang(usedLang)}/sets/${enc}`))?.cards ?? []).map(toBrief)
  const cards = await fillImages((raw.cards ?? []).map(toBrief), fetchOther)
  return { ...toSetBrief(raw), lang: usedLang, cards }
}
