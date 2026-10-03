import { CONDITIONS, LANGUAGES, VARIANTS, type Card, type Collection } from './types'

export interface Backup {
  app: 'fichario-pokemon'
  version: 1
  exported_at: string
  collection: Collection | null
  cards: Card[]
}

export function makeBackup(collection: Collection | null, cards: Card[]): Backup {
  return { app: 'fichario-pokemon', version: 1, exported_at: new Date().toISOString(), collection, cards }
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : null

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}

/** Lê e valida um backup (aceita também uma lista de cartas pura). */
export function parseBackup(text: string): Card[] {
  const data = JSON.parse(text) as unknown
  const list = Array.isArray(data) ? data : (data as { cards?: unknown })?.cards
  if (!Array.isArray(list)) throw new Error('Arquivo sem a lista de cartas')
  const now = new Date().toISOString()
  return list
    .filter(
      (r): r is Record<string, unknown> =>
        typeof r === 'object' && r !== null && Boolean(str((r as Record<string, unknown>).name)),
    )
    .map((r) => ({
      id: UUID.test(str(r.id) ?? '') ? str(r.id)! : '',
      user_id: str(r.user_id) ?? '',
      collection_id: str(r.collection_id) ?? '',
      tcgdex_id: str(r.tcgdex_id),
      name: str(r.name)!,
      set_id: str(r.set_id),
      set_name: str(r.set_name),
      card_number: str(r.card_number),
      set_total: str(r.set_total),
      image_url: str(r.image_url),
      photo_path: str(r.photo_path),
      liga_url: str(r.liga_url),
      quantity: Math.max(1, Math.round(Number(r.quantity) || 1)),
      condition: pick(r.condition, CONDITIONS, 'NM'),
      language: pick(r.language, LANGUAGES, 'PT'),
      variant: pick(r.variant, VARIANTS, 'Normal'),
      notes: str(r.notes),
      created_at: str(r.created_at) ?? now,
      updated_at: str(r.updated_at) ?? now,
    }))
}
