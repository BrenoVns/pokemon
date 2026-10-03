import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CollectionContext, type CardPatch, type CollectionApi } from '../hooks/useCollection'
import { useToast } from '../hooks/useToast'
import { dataUrlToBlob } from '../lib/backup'
import { idbGet, idbSet } from '../lib/idb'
import { deletePhoto, newPhotoPath, savePhoto } from '../lib/photos'
import { findLigaCard, loadCatalog } from '../lib/ligaCatalog'
import { getCard } from '../lib/tcgdex'
import { comboKey, type Card, type Collection } from '../lib/types'

// Tudo fica no próprio aparelho (IndexedDB). O formato já prevê várias coleções.
const CARDS_KEY = 'cards'
const COLLECTION_KEY = 'collection'
const LIGA_BACKFILL_KEY = 'fichario:ligaBackfill'

function byNewest(a: Card, b: Card) {
  return b.created_at.localeCompare(a.created_at)
}

export function CollectionProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [collection, setCollection] = useState<Collection | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  const cardsRef = useRef<Card[]>([])
  const collectionRef = useRef<Collection | null>(null)

  const commitCards = useCallback(
    (next: Card[]) => {
      cardsRef.current = next
      setCards(next)
      idbSet(CARDS_KEY, next).catch(() => toast.show('Não foi possível salvar no aparelho', 'error'))
    },
    [toast],
  )

  // Carga inicial; cria a "Coleção principal" no primeiro uso.
  useEffect(() => {
    let active = true
    ;(async () => {
      // Pede ao navegador para não apagar os dados quando faltar espaço.
      void navigator.storage?.persist?.()
      const [savedCards, savedCol] = await Promise.all([idbGet<Card[]>(CARDS_KEY), idbGet<Collection>(COLLECTION_KEY)])
      if (!active) return
      let col = savedCol
      if (!col) {
        col = { id: crypto.randomUUID(), name: 'Coleção principal', created_at: new Date().toISOString() }
        await idbSet(COLLECTION_KEY, col)
      }
      collectionRef.current = col
      setCollection(col)
      cardsRef.current = savedCards ?? []
      setCards(cardsRef.current)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  /** Cartas salvas antes de guardarmos o nome em inglês: busca no TCGdex (usado no link da Liga). */
  const fillEnglishNames = useCallback(async () => {
    const missing = cardsRef.current.filter((c) => c.tcgdex_id && c.name_en === undefined)
    for (const c of missing) {
      try {
        const en = await getCard(c.tcgdex_id!, 'en')
        if (!en) continue
        const name_en = en.lang === 'en' ? en.name : null
        cardsRef.current = cardsRef.current.map((x) => (x.id === c.id ? { ...x, name_en } : x))
      } catch {
        return // offline: tenta na próxima abertura
      }
    }
    if (missing.length) commitCards(cardsRef.current)
  }, [commitCards])

  /**
   * Completa as cartas salvas com o link exato e a imagem do catálogo da Liga.
   * Roda de novo sempre que sai um catálogo novo (ele pode trazer cartas que faltavam).
   */
  const fillFromLiga = useCallback(async () => {
    const catalog = await loadCatalog()
    if (!catalog) return
    let done: string | null = null
    try {
      done = localStorage.getItem(LIGA_BACKFILL_KEY)
    } catch {
      // indisponível
    }
    if (done === catalog.generated) return
    let changed = false
    cardsRef.current = cardsRef.current.map((c) => {
      if (c.liga_image || !c.card_number) return c
      const liga = findLigaCard(catalog, c)
      if (!liga) return c
      changed = true
      return { ...c, liga_image: liga.image, liga_url: c.liga_url || liga.url }
    })
    if (changed) commitCards(cardsRef.current)
    try {
      localStorage.setItem(LIGA_BACKFILL_KEY, catalog.generated)
    } catch {
      // indisponível
    }
  }, [commitCards])

  useEffect(() => {
    if (!loading) void fillEnglishNames().then(fillFromLiga)
  }, [loading, fillEnglishNames, fillFromLiga])

  const attachPhoto = useCallback(async (card: Card, blob: Blob): Promise<Card> => {
    const path = newPhotoPath(card.id)
    await savePhoto(path, blob)
    if (card.photo_path) void deletePhoto(card.photo_path)
    return { ...card, photo_path: path }
  }, [])

  const addCard = useCallback<CollectionApi['addCard']>(
    async (input, photo) => {
      const col = collectionRef.current
      if (!col) throw new Error('A coleção ainda está carregando. Tente de novo.')
      const now = new Date().toISOString()
      const candidate: Card = {
        ...input,
        id: crypto.randomUUID(),
        collection_id: col.id,
        photo_path: null,
        created_at: now,
        updated_at: now,
      }
      const existing = cardsRef.current.find((c) => comboKey(c) === comboKey(candidate))
      let target: Card = existing
        ? {
            ...existing,
            quantity: existing.quantity + input.quantity,
            liga_url: existing.liga_url || input.liga_url,
            notes: existing.notes || input.notes,
            image_url: existing.image_url ?? input.image_url,
            updated_at: now,
          }
        : candidate
      if (photo) target = await attachPhoto(target, photo)
      commitCards(
        existing ? cardsRef.current.map((c) => (c.id === target.id ? target : c)) : [target, ...cardsRef.current],
      )
      return { id: target.id, merged: Boolean(existing) }
    },
    [attachPhoto, commitCards],
  )

  const updateCard = useCallback<CollectionApi['updateCard']>(
    (id, patch: CardPatch) => {
      const card = cardsRef.current.find((c) => c.id === id)
      if (!card) return id
      const now = new Date().toISOString()
      const updated: Card = { ...card, ...patch, updated_at: now }
      const other = cardsRef.current.find((c) => c.id !== id && comboKey(c) === comboKey(updated))
      if (other) {
        // A combinação passou a coincidir com outro registro: junta os dois.
        const merged: Card = {
          ...other,
          quantity: other.quantity + updated.quantity,
          photo_path: other.photo_path ?? updated.photo_path,
          liga_url: other.liga_url || updated.liga_url,
          notes: other.notes || updated.notes,
          updated_at: now,
        }
        if (other.photo_path && updated.photo_path) void deletePhoto(updated.photo_path)
        commitCards(cardsRef.current.filter((c) => c.id !== id).map((c) => (c.id === other.id ? merged : c)))
        toast.show('Essa combinação já existia: as quantidades foram somadas', 'info')
        return other.id
      }
      commitCards(cardsRef.current.map((c) => (c.id === id ? updated : c)))
      return id
    },
    [commitCards, toast],
  )

  const deleteCard = useCallback<CollectionApi['deleteCard']>(
    (id) => {
      const card = cardsRef.current.find((c) => c.id === id)
      if (!card) return
      commitCards(cardsRef.current.filter((c) => c.id !== id))
      if (card.photo_path) void deletePhoto(card.photo_path)
    },
    [commitCards],
  )

  const setPhoto = useCallback<CollectionApi['setPhoto']>(
    async (id, photo) => {
      const card = cardsRef.current.find((c) => c.id === id)
      if (!card) return
      let updated: Card
      if (photo) {
        updated = await attachPhoto(card, photo)
      } else {
        if (card.photo_path) void deletePhoto(card.photo_path)
        updated = { ...card, photo_path: null }
      }
      updated.updated_at = new Date().toISOString()
      commitCards(cardsRef.current.map((c) => (c.id === id ? updated : c)))
    },
    [attachPhoto, commitCards],
  )

  const importBackup = useCallback<CollectionApi['importBackup']>(
    async (backup, mode) => {
      const col = collectionRef.current
      if (!col) throw new Error('A coleção ainda está carregando. Tente de novo.')

      // Normaliza para a coleção atual e junta combinações repetidas do próprio arquivo.
      const incoming = new Map<string, Card>()
      for (const raw of backup.cards) {
        const card: Card = {
          ...raw,
          collection_id: col.id,
          photo_path: raw.photo_path && backup.photos[raw.photo_path] ? raw.photo_path : null,
        }
        const k = comboKey(card)
        const prev = incoming.get(k)
        incoming.set(k, prev ? { ...prev, quantity: prev.quantity + card.quantity } : card)
      }

      let result: Card[]
      let written: Card[]
      if (mode === 'replace') {
        written = [...incoming.values()]
        const keep = new Set(written.map((c) => c.photo_path))
        for (const c of cardsRef.current) if (c.photo_path && !keep.has(c.photo_path)) void deletePhoto(c.photo_path)
        result = written
      } else {
        const byId = new Map(cardsRef.current.map((c) => [c.id, c]))
        const byCombo = new Map(cardsRef.current.map((c) => [comboKey(c), c]))
        const next = new Map(cardsRef.current.map((c) => [c.id, c]))
        written = []
        for (const card of incoming.values()) {
          const existing = byId.get(card.id) ?? byCombo.get(comboKey(card))
          if (!existing) {
            next.set(card.id, card)
            written.push(card)
          } else if (card.updated_at > existing.updated_at) {
            // Fica a versão alterada por último.
            const merged = { ...card, id: existing.id, photo_path: card.photo_path ?? existing.photo_path }
            if (existing.photo_path && card.photo_path && existing.photo_path !== card.photo_path) {
              void deletePhoto(existing.photo_path)
            }
            next.set(existing.id, merged)
            written.push(merged)
          }
        }
        result = [...next.values()]
      }

      for (const c of written) {
        if (c.photo_path) await savePhoto(c.photo_path, await dataUrlToBlob(backup.photos[c.photo_path]))
      }
      commitCards(result.sort(byNewest))
      return written.length
    },
    [commitCards],
  )

  const clearAll = useCallback<CollectionApi['clearAll']>(async () => {
    const photos = cardsRef.current.map((c) => c.photo_path).filter((p): p is string => Boolean(p))
    commitCards([])
    await Promise.all(photos.map((p) => deletePhoto(p)))
    try {
      localStorage.removeItem(LIGA_BACKFILL_KEY)
    } catch {
      // indisponível
    }
  }, [commitCards])

  const api = useMemo<CollectionApi>(
    () => ({ collection, cards, loading, addCard, updateCard, deleteCard, setPhoto, importBackup, clearAll }),
    [collection, cards, loading, addCard, updateCard, deleteCard, setPhoto, importBackup, clearAll],
  )

  return <CollectionContext.Provider value={api}>{children}</CollectionContext.Provider>
}
