import { cardKey, setKeyOf, type Card } from './types'

export interface SetSummary {
  key: string
  setId: string | null
  name: string
  /** Total oficial impresso (ex.: 128), se conhecido */
  total: number | null
  /** Cartas diferentes que tenho neste set */
  owned: number
  quantity: number
  lastAdded: string
}

export function collectionStats(cards: Card[]) {
  return {
    total: cards.reduce((n, c) => n + c.quantity, 0),
    unique: new Set(cards.map(cardKey)).size,
    sets: new Set(cards.map(setKeyOf)).size,
  }
}

export function summarizeSets(cards: Card[]): SetSummary[] {
  const map = new Map<string, SetSummary & { keys: Set<string> }>()
  for (const c of cards) {
    const key = setKeyOf(c)
    let s = map.get(key)
    if (!s) {
      s = {
        key,
        setId: c.set_id,
        name: c.set_name || 'Sem edição',
        total: null,
        owned: 0,
        quantity: 0,
        lastAdded: c.created_at,
        keys: new Set(),
      }
      map.set(key, s)
    }
    const t = parseInt(c.set_total ?? '', 10)
    if (Number.isFinite(t) && t > 0) s.total = Math.max(s.total ?? 0, t)
    s.keys.add(cardKey(c))
    s.quantity += c.quantity
    if (c.created_at > s.lastAdded) s.lastAdded = c.created_at
  }
  return [...map.values()]
    .map(({ keys, ...s }) => ({ ...s, owned: keys.size }))
    .sort((a, b) => b.lastAdded.localeCompare(a.lastAdded))
}

/** "154" → 154; "TG05" → 5; usado para ordenar por número. */
export function numberValue(n: string | null | undefined): number {
  const m = n?.match(/\d+/)
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER
}

export type SortMode = 'recent' | 'name' | 'number'

export function sortCards(cards: Card[], mode: SortMode): Card[] {
  const list = [...cards]
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
  if (mode === 'recent') list.sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (mode === 'name')
    list.sort((a, b) => collator.compare(a.name, b.name) || numberValue(a.card_number) - numberValue(b.card_number))
  if (mode === 'number')
    list.sort(
      (a, b) =>
        collator.compare(a.set_name ?? '', b.set_name ?? '') ||
        numberValue(a.card_number) - numberValue(b.card_number) ||
        collator.compare(a.card_number ?? '', b.card_number ?? ''),
    )
  return list
}

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
