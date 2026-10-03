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
  collection: Collection | null
  cards: Card[]
  /** true até ler os dados salvos no aparelho */
  loading: boolean
  /** Soma à quantidade se a combinação já existir. Retorna o id do registro final. */
  addCard: (input: NewCardInput, photo?: Blob | null) => Promise<{ id: string; merged: boolean }>
  /** Pode fundir com outro registro se a combinação passar a coincidir. Retorna o id final. */
  updateCard: (id: string, patch: CardPatch) => string
  deleteCard: (id: string) => void
  setPhoto: (id: string, photo: Blob | null) => Promise<void>
  /** Importa um backup. Retorna quantos registros foram gravados. */
  importBackup: (backup: Backup, mode: 'merge' | 'replace') => Promise<number>
}

export const CollectionContext = createContext<CollectionApi | null>(null)

export function useCollection(): CollectionApi {
  const ctx = useContext(CollectionContext)
  if (!ctx) throw new Error('useCollection fora do CollectionProvider')
  return ctx
}
