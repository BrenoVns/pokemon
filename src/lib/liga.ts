// Links para a LigaPokemon. Só montamos URLs — nada de buscar preços ou fazer scraping.
import type { Card } from './types'

const BASE = 'https://www.ligapokemon.com.br/'

/** Codifica para query string mantendo "/", "(" e ")" legíveis, como nos links da Liga. */
function encodeLiga(value: string): string {
  return encodeURIComponent(value).replace(/%2F/gi, '/')
}

/** Ex.: Gengar ex(154/128) */
export function ligaCardLabel(name: string, number?: string | null, total?: string | null): string {
  const n = number?.trim()
  if (!n) return name.trim()
  const t = total?.trim()
  return `${name.trim()}(${t ? `${n}/${t}` : n})`
}

/** https://www.ligapokemon.com.br/?view=cards/card&card=Gengar%20ex(154/128) */
export function ligaCardUrl(name: string, number?: string | null, total?: string | null): string {
  return `${BASE}?view=cards/card&card=${encodeLiga(ligaCardLabel(name, number, total))}`
}

/** https://www.ligapokemon.com.br/?view=cards/search&card=Gengar%20ex */
export function ligaSearchUrl(name: string): string {
  return `${BASE}?view=cards/search&card=${encodeLiga(name.trim())}`
}

/** Link usado ao tocar na arte: o colado pelo usuário ou o gerado automaticamente. */
export function ligaUrlFor(card: Pick<Card, 'liga_url' | 'name' | 'card_number' | 'set_total'>): string {
  const custom = card.liga_url?.trim()
  if (custom) return custom
  return ligaCardUrl(card.name, card.card_number, card.set_total)
}

/** Aceita apenas http(s); evita salvar texto qualquer como link. */
export function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value.trim())
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}
