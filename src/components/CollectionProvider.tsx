import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CollectionContext, type CardPatch, type CollectionApi } from '../hooks/useCollection'
import { useToast } from '../hooks/useToast'
import { idbGet, idbSet } from '../lib/idb'
import { cachePhoto, forgetPhoto, newPhotoPath } from '../lib/photos'
import { PHOTO_BUCKET, supabase } from '../lib/supabase'
import { cardKey, comboKey, type Card, type Collection } from '../lib/types'

/** Fila de alterações locais ainda não enviadas (persistida para sobreviver offline). */
type Op =
  | { kind: 'upsert'; card: Card }
  | { kind: 'delete'; id: string }
  | { kind: 'upload'; path: string; blob: Blob }
  | { kind: 'removePhoto'; path: string }

const ROW_FIELDS = [
  'id',
  'user_id',
  'collection_id',
  'tcgdex_id',
  'name',
  'set_id',
  'set_name',
  'card_number',
  'set_total',
  'image_url',
  'photo_path',
  'liga_url',
  'quantity',
  'condition',
  'language',
  'variant',
  'notes',
  'created_at',
] as const satisfies readonly (keyof Card)[]

/** Só as colunas graváveis (card_key é gerada pelo banco e updated_at pelo trigger). */
function toRow(card: Card) {
  const row: Record<string, unknown> = {}
  for (const f of ROW_FIELDS) row[f] = card[f]
  return row
}

function fromRow(row: Record<string, unknown>): Card {
  const card = { ...row } as unknown as Card & { card_key?: string }
  delete card.card_key
  return card
}

function errorText(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

function isRetryable(e: unknown): boolean {
  if (!navigator.onLine) return true
  return /fetch|network|load failed|timeout|jwt|offline|ECONN|503|502|504/i.test(errorText(e))
}

function byNewest(a: Card, b: Card) {
  return b.created_at.localeCompare(a.created_at)
}

function applyOps(base: Card[], ops: Op[]): Card[] {
  const map = new Map(base.map((c) => [c.id, c]))
  for (const op of ops) {
    if (op.kind === 'upsert') map.set(op.card.id, op.card)
    else if (op.kind === 'delete') map.delete(op.id)
  }
  return [...map.values()].sort(byNewest)
}

export function CollectionProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const toast = useToast()
  const [collection, setCollection] = useState<Collection | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [pending, setPending] = useState(0)

  const cardsRef = useRef<Card[]>([])
  const collectionRef = useRef<Collection | null>(null)
  const outbox = useRef<Op[]>([])
  const flushing = useRef(false)

  const keys = useMemo(
    () => ({ cards: `cards:${userId}`, collection: `collection:${userId}`, outbox: `outbox:${userId}` }),
    [userId],
  )

  const commitCards = useCallback(
    (next: Card[]) => {
      cardsRef.current = next
      setCards(next)
      void idbSet(keys.cards, next)
    },
    [keys],
  )

  const commitCollection = useCallback(
    (col: Collection) => {
      collectionRef.current = col
      setCollection(col)
      void idbSet(keys.collection, col)
    },
    [keys],
  )

  const saveOutbox = useCallback(() => {
    setPending(outbox.current.length)
    void idbSet(keys.outbox, outbox.current)
  }, [keys])

  const enqueue = useCallback(
    (op: Op) => {
      let q = outbox.current
      // Mantém só a última versão de cada carta na fila.
      if (op.kind === 'upsert') q = q.filter((o) => !(o.kind === 'upsert' && o.card.id === op.card.id))
      if (op.kind === 'delete') q = q.filter((o) => !(o.kind === 'upsert' && o.card.id === op.id))
      outbox.current = [...q, op]
      saveOutbox()
    },
    [saveOutbox],
  )

  // -------------------------------------------------------------------------
  // Servidor
  // -------------------------------------------------------------------------
  const ensureCollection = useCallback(async (): Promise<Collection> => {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
    if (error) throw error
    if (data && data.length > 0) return data[0] as Collection
    const created = await supabase
      .from('collections')
      .insert({ user_id: userId, name: 'Coleção principal' })
      .select()
      .single()
    if (created.error) throw created.error
    return created.data as Collection
  }, [userId])

  const fetchAllCards = useCallback(async (collectionId: string): Promise<Card[]> => {
    const all: Card[] = []
    const page = 1000
    for (let from = 0; ; from += page) {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('collection_id', collectionId)
        .order('created_at', { ascending: false })
        .range(from, from + page - 1)
      if (error) throw error
      all.push(...(data ?? []).map(fromRow))
      if (!data || data.length < page) break
    }
    return all
  }, [])

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return
    try {
      const col = await ensureCollection()
      commitCollection(col)
      const server = await fetchAllCards(col.id)
      commitCards(applyOps(server, outbox.current))
    } catch (e) {
      if (!isRetryable(e)) toast.show('Não foi possível carregar a coleção do servidor', 'error')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [ensureCollection, fetchAllCards, commitCards, commitCollection, toast])

  /** Mesma combinação já existe no servidor (ex.: cadastrada em outro aparelho): soma as quantidades. */
  const resolveConflict = useCallback(async (card: Card) => {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('collection_id', card.collection_id)
      .eq('card_key', cardKey(card))
      .eq('condition', card.condition)
      .eq('language', card.language)
      .eq('variant', card.variant)
      .neq('id', card.id)
      .limit(1)
    if (error) throw error
    const other = data?.[0] as Card | undefined
    if (!other) throw new Error('Conflito de combinação não encontrado')
    await supabase.from('cards').delete().eq('id', card.id)
    const upd = await supabase
      .from('cards')
      .update({ quantity: other.quantity + card.quantity, photo_path: other.photo_path ?? card.photo_path })
      .eq('id', other.id)
    if (upd.error) throw upd.error
  }, [])

  const execute = useCallback(
    async (op: Op): Promise<boolean> => {
      switch (op.kind) {
        case 'upsert': {
          const { data, error } = await supabase.from('cards').upsert(toRow(op.card)).select().single()
          if (error) {
            if (error.code === '23505') {
              await resolveConflict(op.card)
              return true // precisa recarregar
            }
            throw error
          }
          const stillPending = outbox.current.some(
            (o) =>
              o !== op &&
              ((o.kind === 'upsert' && o.card.id === op.card.id) || (o.kind === 'delete' && o.id === op.card.id)),
          )
          if (data && !stillPending && cardsRef.current.some((c) => c.id === op.card.id)) {
            const server = fromRow(data as Record<string, unknown>)
            commitCards(cardsRef.current.map((c) => (c.id === server.id ? server : c)))
          }
          return false
        }
        case 'delete': {
          const { error } = await supabase.from('cards').delete().eq('id', op.id)
          if (error) throw error
          return false
        }
        case 'upload': {
          const { error } = await supabase.storage
            .from(PHOTO_BUCKET)
            .upload(op.path, op.blob, { upsert: true, contentType: op.blob.type || 'image/jpeg' })
          if (error) throw error
          return false
        }
        case 'removePhoto': {
          await supabase.storage.from(PHOTO_BUCKET).remove([op.path])
          return false
        }
      }
    },
    [commitCards, resolveConflict],
  )

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return
    flushing.current = true
    let needsRefresh = false
    try {
      while (outbox.current.length > 0) {
        const op = outbox.current[0]
        try {
          if (await execute(op)) needsRefresh = true
        } catch (e) {
          if (isRetryable(e)) break
          console.error(e)
          needsRefresh = true
          toast.show(
            op.kind === 'upload'
              ? 'Não foi possível enviar a foto'
              : op.kind === 'delete'
                ? 'Não foi possível excluir a carta'
                : 'Não foi possível salvar a alteração',
            'error',
          )
        }
        outbox.current = outbox.current.filter((o) => o !== op)
        saveOutbox()
      }
    } finally {
      flushing.current = false
    }
    // Se algo falhou, desfaz a atualização otimista recarregando do servidor.
    if (needsRefresh) await refresh()
  }, [execute, refresh, saveOutbox, toast])

  // -------------------------------------------------------------------------
  // Carga inicial (cache primeiro) e sincronização ao voltar a conexão
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [cachedCards, cachedCol, cachedOutbox] = await Promise.all([
        idbGet<Card[]>(keys.cards),
        idbGet<Collection>(keys.collection),
        idbGet<Op[]>(keys.outbox),
      ])
      if (cancelled) return
      outbox.current = cachedOutbox ?? []
      setPending(outbox.current.length)
      if (cachedCol) {
        collectionRef.current = cachedCol
        setCollection(cachedCol)
      }
      if (cachedCards) {
        cardsRef.current = cachedCards
        setCards(cachedCards)
        setLoading(false)
      }
      if (navigator.onLine) {
        await flush()
        await refresh()
      } else {
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [keys, flush, refresh])

  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      void flush().then(refresh)
    }
    const goOffline = () => setOnline(false)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void flush().then(refresh)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [flush, refresh])

  // -------------------------------------------------------------------------
  // Mutações (otimistas)
  // -------------------------------------------------------------------------
  const removePhotoFile = useCallback(
    (path: string) => {
      void forgetPhoto(path)
      enqueue({ kind: 'removePhoto', path })
    },
    [enqueue],
  )

  const attachPhoto = useCallback(
    async (card: Card, blob: Blob): Promise<Card> => {
      const path = newPhotoPath(userId, card.id)
      await cachePhoto(path, blob)
      if (card.photo_path) removePhotoFile(card.photo_path)
      enqueue({ kind: 'upload', path, blob })
      return { ...card, photo_path: path }
    },
    [enqueue, removePhotoFile, userId],
  )

  const addCard = useCallback<CollectionApi['addCard']>(
    async (input, photo) => {
      const col = collectionRef.current
      if (!col) throw new Error('A coleção ainda não foi carregada. Conecte-se à internet e tente de novo.')
      const now = new Date().toISOString()
      const candidate: Card = {
        ...input,
        id: crypto.randomUUID(),
        user_id: userId,
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
      enqueue({ kind: 'upsert', card: target })
      void flush()
      return { id: target.id, merged: Boolean(existing) }
    },
    [attachPhoto, commitCards, enqueue, flush, userId],
  )

  const updateCard = useCallback<CollectionApi['updateCard']>(
    (id, patch: CardPatch) => {
      const card = cardsRef.current.find((c) => c.id === id)
      if (!card) return id
      const now = new Date().toISOString()
      const updated: Card = { ...card, ...patch, updated_at: now }
      const other = cardsRef.current.find((c) => c.id !== id && comboKey(c) === comboKey(updated))
      if (other) {
        const merged: Card = {
          ...other,
          quantity: other.quantity + updated.quantity,
          photo_path: other.photo_path ?? updated.photo_path,
          liga_url: other.liga_url || updated.liga_url,
          notes: other.notes || updated.notes,
          updated_at: now,
        }
        if (other.photo_path && updated.photo_path) removePhotoFile(updated.photo_path)
        commitCards(cardsRef.current.filter((c) => c.id !== id).map((c) => (c.id === other.id ? merged : c)))
        enqueue({ kind: 'delete', id })
        enqueue({ kind: 'upsert', card: merged })
        toast.show('Essa combinação já existia: as quantidades foram somadas', 'info')
        void flush()
        return other.id
      }
      commitCards(cardsRef.current.map((c) => (c.id === id ? updated : c)))
      enqueue({ kind: 'upsert', card: updated })
      void flush()
      return id
    },
    [commitCards, enqueue, flush, removePhotoFile, toast],
  )

  const deleteCard = useCallback<CollectionApi['deleteCard']>(
    (id) => {
      const card = cardsRef.current.find((c) => c.id === id)
      if (!card) return
      commitCards(cardsRef.current.filter((c) => c.id !== id))
      enqueue({ kind: 'delete', id })
      if (card.photo_path) removePhotoFile(card.photo_path)
      void flush()
    },
    [commitCards, enqueue, flush, removePhotoFile],
  )

  const setPhoto = useCallback<CollectionApi['setPhoto']>(
    async (id, photo) => {
      const card = cardsRef.current.find((c) => c.id === id)
      if (!card) return
      let updated: Card
      if (photo) {
        updated = await attachPhoto(card, photo)
      } else {
        if (card.photo_path) removePhotoFile(card.photo_path)
        updated = { ...card, photo_path: null }
      }
      updated.updated_at = new Date().toISOString()
      commitCards(cardsRef.current.map((c) => (c.id === id ? updated : c)))
      enqueue({ kind: 'upsert', card: updated })
      void flush()
    },
    [attachPhoto, commitCards, enqueue, flush, removePhotoFile],
  )

  const importCards = useCallback<CollectionApi['importCards']>(
    async (incoming, mode) => {
      if (!navigator.onLine) throw new Error('Conecte-se à internet para importar o backup.')
      await flush()
      const col = collectionRef.current ?? (await ensureCollection())
      const ownPrefix = `${userId}/`

      // Normaliza para esta conta/coleção e junta combinações repetidas do próprio arquivo.
      const normalized = new Map<string, Card>()
      for (const raw of incoming) {
        const foreign = raw.user_id !== userId
        const card: Card = {
          ...raw,
          id: foreign || !raw.id ? crypto.randomUUID() : raw.id,
          user_id: userId,
          collection_id: col.id,
          photo_path: raw.photo_path?.startsWith(ownPrefix) ? raw.photo_path : null,
          quantity: Math.max(1, Math.round(Number(raw.quantity) || 1)),
        }
        const k = comboKey(card)
        const prev = normalized.get(k)
        normalized.set(k, prev ? { ...prev, quantity: prev.quantity + card.quantity } : card)
      }
      let rows = [...normalized.values()]

      if (mode === 'replace') {
        const keep = new Set(rows.map((c) => c.photo_path).filter(Boolean))
        const orphanPhotos = cardsRef.current.map((c) => c.photo_path).filter((p): p is string => !!p && !keep.has(p))
        const del = await supabase.from('cards').delete().eq('collection_id', col.id)
        if (del.error) throw del.error
        if (orphanPhotos.length) await supabase.storage.from(PHOTO_BUCKET).remove(orphanPhotos)
      } else {
        const byId = new Map(cardsRef.current.map((c) => [c.id, c]))
        const byCombo = new Map(cardsRef.current.map((c) => [comboKey(c), c]))
        rows = rows.flatMap((card) => {
          const existing = byId.get(card.id) ?? byCombo.get(comboKey(card))
          if (!existing) return [card]
          // Fica a versão alterada por último.
          if ((card.updated_at ?? '') <= existing.updated_at) return []
          return [{ ...card, id: existing.id, photo_path: card.photo_path ?? existing.photo_path }]
        })
      }

      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from('cards').upsert(rows.slice(i, i + 500).map(toRow))
        if (error) throw error
      }
      await refresh()
      return rows.length
    },
    [ensureCollection, flush, refresh, userId],
  )

  const api = useMemo<CollectionApi>(
    () => ({
      userId,
      collection,
      cards,
      loading,
      online,
      pending,
      addCard,
      updateCard,
      deleteCard,
      setPhoto,
      refresh,
      importCards,
    }),
    [
      userId,
      collection,
      cards,
      loading,
      online,
      pending,
      addCard,
      updateCard,
      deleteCard,
      setPhoto,
      refresh,
      importCards,
    ],
  )

  return <CollectionContext.Provider value={api}>{children}</CollectionContext.Provider>
}
