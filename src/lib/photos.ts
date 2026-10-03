// Fotos próprias: cache local (memória + IndexedDB) para funcionarem offline.
import { idbDel, idbGet, idbSet } from './idb'
import { PHOTO_BUCKET, supabase } from './supabase'

const urls = new Map<string, Promise<string | null>>()

const key = (path: string) => `photo:${path}`

export function getPhotoUrl(path: string): Promise<string | null> {
  let p = urls.get(path)
  if (!p) {
    p = (async () => {
      const cached = await idbGet<Blob>(key(path))
      if (cached) return URL.createObjectURL(cached)
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path)
      if (error || !data) throw error ?? new Error('Foto indisponível')
      void idbSet(key(path), data)
      return URL.createObjectURL(data)
    })()
    urls.set(path, p)
    p.catch(() => urls.delete(path))
  }
  return p
}

/** Guarda a foto localmente antes do envio, para aparecer na hora (inclusive offline). */
export async function cachePhoto(path: string, blob: Blob): Promise<void> {
  urls.set(path, Promise.resolve(URL.createObjectURL(blob)))
  await idbSet(key(path), blob)
}

export async function forgetPhoto(path: string): Promise<void> {
  urls.delete(path)
  await idbDel(key(path))
}

export function newPhotoPath(userId: string, cardId: string): string {
  return `${userId}/${cardId}-${Date.now()}.jpg`
}
