// Links para a LigaPokemon. Só montamos URLs — nada de buscar preços ou fazer scraping.
//
// Formato observado nos links da própria Liga:
//   ?view=cards/card&card=Pikachu (018/091)
//   ?view=cards/card&card=Professor's Research (Professor Turo) (241/198)
// - nome em INGLÊS (o nome em português só aparece no título da página);
// - número e total como impressos na carta, com zeros à esquerda quando houver.
import type { Card } from './types'

const BASE = 'https://www.ligapokemon.com.br/'

/** Codifica para query string mantendo "/", "(" e ")" legíveis, como nos links da Liga. */
function encodeLiga(value: string): string {
  return encodeURIComponent(value).replace(/%2F/gi, '/').replace(/%28/g, '(').replace(/%29/g, ')')
}

/**
 * Número/total como impressos. Em cadastros manuais o total pode vir sem zeros (91); quando o número
 * tem zeros à esquerda ("018"), o total é impresso com a mesma largura ("091").
 */
export function printedNumber(number?: string | null, total?: string | null): string {
  const n = number?.trim() ?? ''
  let t = total?.trim() ?? ''
  if (!n) return ''
  if (!t || t === '0') return n
  if (/^\d+$/.test(n) && /^\d+$/.test(t) && n.length > t.length) t = t.padStart(n.length, '0')
  return `${n}/${t}`
}

/** Ex.: Gengar ex (154/128) */
export function ligaCardLabel(name: string, number?: string | null, total?: string | null): string {
  const printed = printedNumber(number, total)
  return printed ? `${name.trim()} (${printed})` : name.trim()
}

/** https://www.ligapokemon.com.br/?view=cards/card&card=Gengar%20ex%20(154/128) */
export function ligaCardUrl(name: string, number?: string | null, total?: string | null): string {
  return `${BASE}?view=cards/card&card=${encodeLiga(ligaCardLabel(name, number, total))}`
}

/** https://www.ligapokemon.com.br/?view=cards/search&card=Gengar%20ex */
export function ligaSearchUrl(name: string): string {
  return `${BASE}?view=cards/search&card=${encodeLiga(name.trim())}`
}

type LigaFields = Pick<Card, 'liga_url' | 'name' | 'name_en' | 'card_number' | 'set_total'>

/** Nome que a Liga usa: o inglês quando conhecido. */
export function ligaName(card: Pick<Card, 'name' | 'name_en'>): string {
  return card.name_en?.trim() || card.name
}

/** Link usado ao tocar na arte: o colado pelo usuário ou o gerado automaticamente. */
export function ligaUrlFor(card: LigaFields): string {
  const custom = card.liga_url?.trim()
  if (custom) return custom
  return ligaCardUrl(ligaName(card), card.card_number, card.set_total)
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
