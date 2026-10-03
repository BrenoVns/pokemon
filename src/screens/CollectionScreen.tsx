import { useMemo, useRef, useState } from 'react'
import { ArrowDownUp, ChevronDown, LayoutGrid, LibraryBig, List, Search, Settings, SquareStack, X } from 'lucide-react'
import { GalleryGrid, GridSkeleton, GroupedList, ShowcaseGrid } from '../components/CardViews'
import { CollectionsSheet } from '../components/CollectionsSheet'
import { Button, EmptyState, IconButton, Pill, inputClass } from '../components/ui'
import { useAddSheet } from '../hooks/useAddSheet'
import { useCollection } from '../hooks/useCollection'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { navigate } from '../hooks/useRoute'
import { cx } from '../lib/cx'
import { collectionStats, normalize, sortCards, summarizeSets, type SortMode } from '../lib/stats'
import { setKeyOf } from '../lib/types'

const VIEWS = ['vitrine', 'galeria', 'lista'] as const
type View = (typeof VIEWS)[number]
const SORTS = ['recent', 'name', 'number'] as const
const SORT_LABELS: Record<SortMode, string> = { recent: 'Recentes', name: 'Nome', number: 'Número' }

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function CollectionScreen() {
  const { cards, collection, loading } = useCollection()
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const openAdd = useAddSheet()
  const [view, setView] = useLocalStorage<View>('fichario:view', 'vitrine', VIEWS)
  const [sort, setSort] = useLocalStorage<SortMode>('fichario:sort', 'recent', SORTS)
  const [setFilter, setSetFilter] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)

  const stats = useMemo(() => collectionStats(cards), [cards])
  const sets = useMemo(() => summarizeSets(cards), [cards])
  const activeSet = setFilter && sets.some((s) => s.key === setFilter) ? setFilter : null

  const visible = useMemo(() => {
    const q = normalize(query.trim())
    const filtered = cards.filter(
      (c) =>
        (!activeSet || setKeyOf(c) === activeSet) &&
        (!q || normalize(`${c.name} ${c.set_name ?? ''} ${c.card_number ?? ''}`).includes(q)),
    )
    return sortCards(filtered, sort)
  }, [cards, activeSet, query, sort])

  function toggleSearch() {
    if (searchOpen) {
      setQuery('')
      setSearchOpen(false)
    } else {
      setSearchOpen(true)
      requestAnimationFrame(() => searchInput.current?.focus())
    }
  }

  function cycleSort() {
    setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length])
  }

  return (
    <main className="pb-nav px-4 pt-[max(20px,env(safe-area-inset-top))] md:px-8">
      <header className="flex items-start gap-3 pt-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setCollectionsOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Coleção: ${collection?.name ?? ''}. Trocar ou criar coleção`}
            className="-ml-1 flex max-w-full items-center gap-1.5 rounded-xl px-1 text-left"
          >
            <h1 className="screen-title truncate whitespace-nowrap text-[clamp(28px,8.4vw,36px)]">
              {collection?.name ?? 'Minha Coleção'}
            </h1>
            <ChevronDown size={24} strokeWidth={2.4} className="mt-1 shrink-0 text-muted" aria-hidden />
          </button>
          <p className="mt-1.5 text-[15px] font-medium text-muted">
            {plural(stats.total, 'carta', 'cartas')} · {plural(stats.unique, 'única', 'únicas')} ·{' '}
            {plural(stats.sets, 'edição', 'edições')}
          </p>
        </div>
        <IconButton
          label={searchOpen ? 'Fechar busca' : 'Buscar na coleção'}
          onClick={toggleSearch}
          aria-expanded={searchOpen}
        >
          {searchOpen ? <X size={20} aria-hidden /> : <Search size={20} aria-hidden />}
        </IconButton>
        <IconButton label="Configurações" onClick={() => navigate({ name: 'settings' })}>
          <Settings size={20} aria-hidden />
        </IconButton>
      </header>

      {searchOpen && (
        <div className="fade-in relative mt-4">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            ref={searchInput}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, edição ou número"
            aria-label="Buscar na coleção"
            className={cx(inputClass, 'pl-11')}
          />
        </div>
      )}

      {sets.length > 0 && (
        <div
          className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 md:-mx-8 md:px-8"
          role="toolbar"
          aria-label="Filtrar por edição"
        >
          <Pill active={!activeSet} onClick={() => setSetFilter(null)}>
            Tudo
          </Pill>
          {sets.map((s) => (
            <Pill
              key={s.key}
              active={activeSet === s.key}
              onClick={() => setSetFilter(activeSet === s.key ? null : s.key)}
            >
              {s.name}
            </Pill>
          ))}
        </div>
      )}

      {cards.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div
            role="radiogroup"
            aria-label="Visualização"
            className="flex rounded-full border border-line bg-surface p-1"
          >
            {(
              [
                ['vitrine', 'Vitrine', LayoutGrid],
                ['galeria', 'Galeria', SquareStack],
                ['lista', 'Lista', List],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={view === key}
                aria-label={label}
                title={label}
                onClick={() => setView(key)}
                className={cx(
                  'flex h-9 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-bold transition',
                  view === key ? 'bg-fg text-ink' : 'text-muted hover:text-fg',
                )}
              >
                <Icon size={16} aria-hidden />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={cycleSort}
            aria-label={`Ordenar: ${SORT_LABELS[sort]}. Toque para mudar`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[13px] font-bold text-muted hover:text-fg"
          >
            <ArrowDownUp size={16} aria-hidden />
            {SORT_LABELS[sort]}
          </button>
        </div>
      )}

      <div className="mt-5">
        {loading && cards.length === 0 ? (
          <GridSkeleton />
        ) : cards.length === 0 ? (
          <EmptyState icon={<LibraryBig size={24} aria-hidden />} title="Seu fichário está vazio">
            <p>Adicione a primeira carta para começar a coleção.</p>
            <Button className="mt-5" onClick={() => openAdd()}>
              Adicionar carta
            </Button>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState icon={<Search size={24} aria-hidden />} title="Nada encontrado">
            Nenhuma carta corresponde à busca.
          </EmptyState>
        ) : view === 'vitrine' ? (
          <ShowcaseGrid cards={visible} />
        ) : view === 'galeria' ? (
          <GalleryGrid cards={visible} />
        ) : (
          <GroupedList cards={visible} sets={sets} />
        )}
      </div>
      {collectionsOpen && <CollectionsSheet onClose={() => setCollectionsOpen(false)} />}
    </main>
  )
}
