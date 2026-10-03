import { createContext, useContext } from 'react'
import type { Backup } from '../lib/backup'
import type { Card, CardIdentity, Collection, Condition, Language, Variant } from '../lib/types'

export interface NewCardInput extends CardIdentity {
  quantity: number
  condition: Condition
  language: Language
  variant: Variant
  liga_url: string | null
  notes: string | null
}

export type CardPatch = Partial<
  Pick<
    Card,
    | 'quantity'
    | 'condition'
    | 'language'
    | 'variant'
    | 'liga_url'
    | 'notes'
    | 'name'
    | 'set_name'
    | 'card_number'
    | 'set_total'
  >
>

export interface CollectionApi {
  /** Coleção ativa (a que está sendo vista e recebe as cartas novas) */
  collection: Collection | null
  collections: Collection[]
  /** Cartas da coleção ativa */
  cards: Card[]
  /** Cartas de todas as coleções (backup, detalhe por link) */
  allCards: Card[]
  /** true até ler os dados salvos no aparelho */
  loading: boolean
  /** Soma à quantidade se a combinação já existir. Retorna o id do registro final. */
  addCard: (input: NewCardInput, photo?: Blob | null) => Promise<{ id: string; merged: boolean }>
  /** Pode fundir com outro registro se a combinação passar a coincidir. Retorna o id final. */
  updateCard: (id: string, patch: CardPatch) => string
  deleteCard: (id: string) => void
  /** Apaga as cartas da coleção ativa. */
  clearAll: () => Promise<void>
  /** Cria uma coleção e já passa a usá-la. */
  createCollection: (name: string) => Collection
  renameCollection: (id: string, name: string) => void
  /** Exclui a coleção e as cartas dela. */
  deleteCollection: (id: string) => void
  selectCollection: (id: string) => void
  /** Importa um backup. Retorna quantos registros foram gravados. */
  importBackup: (backup: Backup, mode: 'merge' | 'replace') => Promise<number>
}

export const CollectionContext = createContext<CollectionApi | null>(null)

export function useCollection(): CollectionApi {
  const ctx = useContext(CollectionContext)
  if (!ctx) throw new Error('useCollection fora do CollectionProvider')
  return ctx
}
