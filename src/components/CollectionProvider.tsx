import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CollectionContext, type CardPatch, type CollectionApi } from '../hooks/useCollection'
import { useToast } from '../hooks/useToast'
import { dataUrlToBlob } from '../lib/backup'
import { idbGet, idbSet } from '../lib/idb'
import { deletePhoto, newPhotoPath, savePhoto } from '../lib/photos'
import { findLigaCard, loadCatalog } from '../lib/ligaCatalog'
import { comboKey, type Card, type Collection } from '../lib/types'

// Tudo fica no próprio aparelho (IndexedDB). Cada carta aponta para uma coleção (collection_id).
const CARDS_KEY = 'cards'
const COLLECTIONS_KEY = 'collections'
/** Formato antigo, de quando só havia uma coleção */
const LEGACY_COLLECTION_KEY = 'collection'
const ACTIVE_KEY = 'fichario:colecaoAtiva'
const DEFAULT_NAME = 'Minha Coleção'
const LIGA_BACKFILL_KEY = 'fichario:ligaBackfill'
// Aumente quando a regra de associação com a Liga mudar, para reprocessar as cartas salvas.
const LIGA_BACKFILL_VERSION = 2

function byNewest(a: Card, b: Card) {
  return b.created_at.localeCompare(a.created_at)
}

function newCollection(name: string): Collection {
  return { id: crypto.randomUUID(), name, created_at: new Date().toISOString() }
}

function readActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

function writeActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // indisponível: volta para a primeira coleção na próxima abertura
  }
}

export function CollectionProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [collections, setCollections] = useState<Collection[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [allCards, setAllCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  /** Todas as cartas, de todas as coleções */
  const cardsRef = useRef<Card[]>([])
  const collectionsRef = useRef<Collection[]>([])
  const activeIdRef = useRef<string | null>(null)

  const commitCards = useCallback(
    (next: Card[]) => {
      cardsRef.current = next
      setAllCards(next)
      idbSet(CARDS_KEY, next).catch(() => toast.show('Não foi possível salvar no aparelho', 'error'))
    },
    [toast],
  )

  const commitCollections = useCallback(
    (next: Collection[]) => {
      collectionsRef.current = next
      setCollections(next)
      idbSet(COLLECTIONS_KEY, next).catch(() => toast.show('Não foi possível salvar no aparelho', 'error'))
    },
    [toast],
  )

  const activate = useCallback((id: string | null) => {
    activeIdRef.current = id
    setActiveId(id)
    writeActiveId(id)
  }, [])

  // Carga inicial; cria a "Minha Coleção" no primeiro uso.
  useEffect(() => {
    let active = true
    ;(async () => {
      // Pede ao navegador para não apagar os dados quando faltar espaço.
      void navigator.storage?.persist?.()
      const [savedCards, savedList, legacy] = await Promise.all([
        idbGet<Card[]>(CARDS_KEY),
        idbGet<Collection[]>(COLLECTIONS_KEY),
        idbGet<Collection>(LEGACY_COLLECTION_KEY),
      ])
      if (!active) return
      // Lista vazia é válida (a pessoa excluiu todas); só cria a primeira quando nunca houve lista.
      let list = savedList ?? []
      if (!savedList) {
        // Primeiro uso, ou migração da versão com uma só coleção.
        const first = legacy ?? newCollection(DEFAULT_NAME)
        list = [{ ...first, name: first.name === 'Coleção principal' ? DEFAULT_NAME : first.name }]
        await idbSet(COLLECTIONS_KEY, list)
      }
      collectionsRef.current = list
      setCollections(list)
      const saved = readActiveId()
      const activeCol = list.find((c) => c.id === saved) ?? list[0] ?? null
      activeIdRef.current = activeCol?.id ?? null
      setActiveId(activeCol?.id ?? null)
      cardsRef.current = savedCards ?? []
      setAllCards(cardsRef.current)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

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
    const stamp = `${catalog.generated}|${LIGA_BACKFILL_VERSION}`
    if (done === stamp) return
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
      localStorage.setItem(LIGA_BACKFILL_KEY, stamp)
    } catch {
      // indisponível
    }
  }, [commitCards])

  useEffect(() => {
    if (!loading) void fillFromLiga()
  }, [loading, fillFromLiga])

  const attachPhoto = useCallback(async (card: Card, blob: Blob): Promise<Card> => {
    const path = newPhotoPath(card.id)
    await savePhoto(path, blob)
    if (card.photo_path) void deletePhoto(card.photo_path)
    return { ...card, photo_path: path }
  }, [])

  const addCard = useCallback<CollectionApi['addCard']>(
    async (input, photo) => {
      const colId = activeIdRef.current
      if (!colId) throw new Error('Crie uma coleção antes de adicionar cartas.')
      const now = new Date().toISOString()
      const candidate: Card = {
        ...input,
        id: crypto.randomUUID(),
        collection_id: colId,
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

  const importBackup = useCallback<CollectionApi['importBackup']>(
    async (backup, mode) => {
      // Coleções: backups novos trazem a lista; os antigos vão para a coleção ativa.
      const hasCollections = backup.collections.length > 0
      let nextCollections = collectionsRef.current
      if (!hasCollections && nextCollections.length === 0) {
        // Backup antigo e nenhuma coleção aqui: cria uma para receber as cartas.
        const col = newCollection(DEFAULT_NAME)
        nextCollections = [col]
        activeIdRef.current = col.id
      }
      // Coleção do backup com o mesmo nome de uma daqui: junta as duas (id daqui).
      const remap = new Map<string, string>()
      if (hasCollections) {
        if (mode === 'replace') nextCollections = backup.collections
        else {
          const byId = new Set(nextCollections.map((c) => c.id))
          const byName = new Map(nextCollections.map((c) => [c.name.trim().toLowerCase(), c.id]))
          const added: Collection[] = []
          for (const c of backup.collections) {
            if (byId.has(c.id)) continue
            const same = byName.get(c.name.trim().toLowerCase())
            if (same) remap.set(c.id, same)
            else added.push(c)
          }
          nextCollections = [...nextCollections, ...added]
        }
      }
      const validIds = new Set(nextCollections.map((c) => c.id))
      const colId =
        activeIdRef.current && validIds.has(activeIdRef.current) ? activeIdRef.current : nextCollections[0].id
      const targetOf = (raw: Card) => {
        const id = remap.get(raw.collection_id) ?? raw.collection_id
        return hasCollections && validIds.has(id) ? id : colId
      }

      // Junta combinações repetidas do próprio arquivo.
      const incoming = new Map<string, Card>()
      for (const raw of backup.cards) {
        const card: Card = {
          ...raw,
          collection_id: targetOf(raw),
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
        // Com lista de coleções, substitui tudo; backup antigo substitui só a coleção ativa.
        const kept = hasCollections ? [] : cardsRef.current.filter((c) => c.collection_id !== colId)
        const keep = new Set([...written, ...kept].map((c) => c.photo_path))
        for (const c of cardsRef.current) if (c.photo_path && !keep.has(c.photo_path)) void deletePhoto(c.photo_path)
        result = [...kept, ...written]
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
      if (nextCollections !== collectionsRef.current) commitCollections(nextCollections)
      if (activeIdRef.current !== colId || activeId !== colId) activate(colId)
      commitCards(result.sort(byNewest))
      return written.length
    },
    [activate, activeId, commitCards, commitCollections],
  )

  /** Apaga as cartas da coleção ativa. */
  const clearAll = useCallback<CollectionApi['clearAll']>(async () => {
    const colId = activeIdRef.current
    const removed = cardsRef.current.filter((c) => c.collection_id === colId)
    commitCards(cardsRef.current.filter((c) => c.collection_id !== colId))
    await Promise.all(removed.map((c) => c.photo_path && deletePhoto(c.photo_path)))
  }, [commitCards])

  const createCollection = useCallback<CollectionApi['createCollection']>(
    (name) => {
      const col = newCollection(name.trim() || 'Nova coleção')
      commitCollections([...collectionsRef.current, col])
      activate(col.id)
      return col
    },
    [activate, commitCollections],
  )

  const renameCollection = useCallback<CollectionApi['renameCollection']>(
    (id, name) => {
      const trimmed = name.trim()
      if (!trimmed) return
      commitCollections(collectionsRef.current.map((c) => (c.id === id ? { ...c, name: trimmed } : c)))
    },
    [commitCollections],
  )

  /** Exclui a coleção e as cartas dela. */
  const deleteCollection = useCallback<CollectionApi['deleteCollection']>(
    (id) => {
      const removed = cardsRef.current.filter((c) => c.collection_id === id)
      commitCards(cardsRef.current.filter((c) => c.collection_id !== id))
      for (const c of removed) if (c.photo_path) void deletePhoto(c.photo_path)
      const rest = collectionsRef.current.filter((c) => c.id !== id)
      commitCollections(rest)
      if (activeIdRef.current === id) activate(rest[0]?.id ?? null)
    },
    [activate, commitCards, commitCollections],
  )

  const selectCollection = useCallback<CollectionApi['selectCollection']>(
    (id) => {
      if (collectionsRef.current.some((c) => c.id === id)) activate(id)
    },
    [activate],
  )

  const collection = useMemo(() => collections.find((c) => c.id === activeId) ?? null, [collections, activeId])
  const cards = useMemo(() => allCards.filter((c) => c.collection_id === activeId), [allCards, activeId])

  const api = useMemo<CollectionApi>(
    () => ({
      collection,
      collections,
      cards,
      allCards,
      loading,
      addCard,
      updateCard,
      deleteCard,
      importBackup,
      clearAll,
      createCollection,
      renameCollection,
      deleteCollection,
      selectCollection,
    }),
    [
      collection,
      collections,
      cards,
      allCards,
      loading,
      addCard,
      updateCard,
      deleteCard,
      importBackup,
      clearAll,
      createCollection,
      renameCollection,
      deleteCollection,
      selectCollection,
    ],
  )

  return <CollectionContext.Provider value={api}>{children}</CollectionContext.Provider>
}
