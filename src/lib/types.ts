export const CONDITIONS = ['M', 'NM', 'SP', 'MP', 'HP', 'D'] as const
export const LANGUAGES = ['PT', 'EN', 'JP', 'Outro'] as const
export const VARIANTS = ['Normal', 'Foil', 'Reverse Foil', 'Pokeball Foil', 'Master Ball Foil', 'Outro'] as const

export type Condition = (typeof CONDITIONS)[number]
export type Language = (typeof LANGUAGES)[number]
export type Variant = (typeof VARIANTS)[number]

export const CONDITION_LABELS: Record<Condition, string> = {
  M: 'Mint',
  NM: 'Near Mint',
  SP: 'Slightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  D: 'Danificada',
}

export interface Collection {
  id: string
  name: string
  created_at: string
}

export interface Card {
  id: string
  collection_id: string
  /** Legado (versões antigas usavam o TCGdex); sempre null nas cartas novas */
  tcgdex_id: string | null
  name: string
  /** Nome em inglês, usado no link da LigaPokemon (null no cadastro manual) */
  name_en: string | null
  set_id: string | null
  set_name: string | null
  card_number: string | null
  set_total: string | null
  /** URL base do TCGdex (sem /low.webp ou /high.webp) */
  image_url: string | null
  /** Imagem da carta no repositório da LigaPokemon (versão em português) */
  liga_image?: string | null
  /** Chave da foto própria no armazenamento local (IndexedDB) */
  photo_path: string | null
  liga_url: string | null
  quantity: number
  condition: Condition
  language: Language
  variant: Variant
  notes: string | null
  created_at: string
  updated_at: string
}

/** Campos que identificam "a mesma carta" (independente de condição/idioma/variante). */
export type CardIdentity = Pick<
  Card,
  'tcgdex_id' | 'name' | 'name_en' | 'liga_image' | 'set_id' | 'set_name' | 'card_number' | 'set_total' | 'image_url'
>

/** Espelho da coluna gerada card_key do banco. */
export function cardKey(c: Pick<Card, 'tcgdex_id' | 'name' | 'set_name' | 'card_number'>): string {
  return c.tcgdex_id ?? `${c.name.toLowerCase()}|${c.set_name ?? ''}|${c.card_number ?? ''}`
}

/** Chave da combinação única carta + condição + idioma + variante. */
export function comboKey(c: Card): string {
  return [c.collection_id, cardKey(c), c.condition, c.language, c.variant].join('§')
}

/** Agrupamento por set: id do TCGdex ou, no cadastro manual, o nome digitado. */
export function setKeyOf(c: Pick<Card, 'set_id' | 'set_name'>): string {
  return c.set_id ? c.set_id : `manual:${c.set_name ?? 'Sem edição'}`
}
