import { getPhotoBlob } from './photos'
import { CONDITIONS, LANGUAGES, VARIANTS, type Card, type Collection } from './types'

export interface Backup {
  app: 'fichario-pokemon'
  version: 2
  exported_at: string
  collection: Collection | null
  cards: Card[]
  /** Fotos próprias em data URL, indexadas pelo photo_path da carta */
  photos: Record<string, string>
}

const LAST_BACKUP_KEY = 'fichario:lastBackup'

export function lastBackupAt(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY)
  } catch {
    return null
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

export async function makeBackup(collection: Collection | null, cards: Card[]): Promise<Backup> {
  const photos: Record<string, string> = {}
  for (const c of cards) {
    if (!c.photo_path) continue
    const blob = await getPhotoBlob(c.photo_path)
    if (blob) photos[c.photo_path] = await blobToDataUrl(blob)
  }
  return { app: 'fichario-pokemon', version: 2, exported_at: new Date().toISOString(), collection, cards, photos }
}

/** Salva o arquivo: no celular usa o compartilhamento (Salvar em Arquivos, Drive…), senão baixa. */
export async function saveBackupFile(backup: Backup): Promise<void> {
  const filename = `fichario-pokemon-${backup.exported_at.slice(0, 10)}.json`
  const file = new File([JSON.stringify(backup)], filename, { type: 'application/json' })
  let shared = false
  if (navigator.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: 'Backup do Fichário Pokémon' })
      shared = true
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
    }
  }
  if (!shared) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  try {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString())
  } catch {
    // indisponível
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : null

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}

/** Lê e valida um backup (aceita também versões antigas e uma lista de cartas pura). */
export function parseBackup(text: string): Backup {
  const data = JSON.parse(text) as unknown
  const obj = (Array.isArray(data) ? { cards: data } : data) as { cards?: unknown; photos?: unknown }
  if (!Array.isArray(obj?.cards)) throw new Error('Arquivo sem a lista de cartas')
  const now = new Date().toISOString()
  const cards: Card[] = obj.cards
    .filter(
      (r): r is Record<string, unknown> =>
        typeof r === 'object' && r !== null && Boolean(str((r as Record<string, unknown>).name)),
    )
    .map((r) => ({
      id: UUID.test(str(r.id) ?? '') ? str(r.id)! : crypto.randomUUID(),
      collection_id: str(r.collection_id) ?? '',
      tcgdex_id: str(r.tcgdex_id),
      name: str(r.name)!,
      name_en: str(r.name_en),
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
  const photos: Record<string, string> = {}
  if (obj.photos && typeof obj.photos === 'object') {
    for (const [k, v] of Object.entries(obj.photos as Record<string, unknown>)) {
      if (typeof v === 'string' && v.startsWith('data:image/')) photos[k] = v
    }
  }
  return { app: 'fichario-pokemon', version: 2, exported_at: now, collection: null, cards, photos }
}
