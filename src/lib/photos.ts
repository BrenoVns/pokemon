// Fotos próprias guardadas no próprio aparelho (IndexedDB), com cache de URLs blob:.
import { idbDel, idbGet, idbSet } from './idb'

const urls = new Map<string, Promise<string | null>>()

const key = (path: string) => `photo:${path}`

export function getPhotoUrl(path: string): Promise<string | null> {
  let p = urls.get(path)
  if (!p) {
    p = idbGet<Blob>(key(path)).then((blob) => {
      if (!blob) throw new Error('Foto não encontrada')
      return URL.createObjectURL(blob)
    })
    urls.set(path, p)
    p.catch(() => urls.delete(path))
  }
  return p
}

export function getPhotoBlob(path: string): Promise<Blob | undefined> {
  return idbGet<Blob>(key(path))
}

export async function savePhoto(path: string, blob: Blob): Promise<void> {
  await idbSet(key(path), blob)
  urls.set(path, Promise.resolve(URL.createObjectURL(blob)))
}

export async function deletePhoto(path: string): Promise<void> {
  urls.delete(path)
  await idbDel(key(path))
}

export function newPhotoPath(cardId: string): string {
  return `${cardId}-${Date.now()}.jpg`
}
