import { createContext, useContext } from 'react'
import type { LigaCard } from '../lib/ligaCatalog'
import type { Card } from '../lib/types'

export interface AddSheetOptions {
  /** Já abre com esta carta do TCGdex selecionada (ex.: "+" de uma carta faltante). */
  tcgdexId?: string
  /** Já abre com esta carta do catálogo da Liga selecionada. */
  liga?: LigaCard
  /** Duplicar: abre o formulário com os dados de um registro existente. */
  from?: Card
}

export const AddSheetContext = createContext<(opts?: AddSheetOptions) => void>(() => {})

export function useAddSheet() {
  return useContext(AddSheetContext)
}
