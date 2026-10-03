import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CloudOff, Plus } from 'lucide-react'
import { CardArt } from '../components/CardArt'
import { IconButton, Pill, ProgressBar } from '../components/ui'
import { useAddSheet } from '../hooks/useAddSheet'
import { useCollection } from '../hooks/useCollection'
import { goBack, navigate } from '../hooks/useRoute'
import { ligaCardUrl, ligaUrlFor } from '../lib/liga'
import { normalize, sortCards } from '../lib/stats'
import { loadCatalog, plainNumber, type LigaCard } from '../lib/ligaCatalog'
import { getSet, type TcgSet } from '../lib/tcgdex'
import { cardKey, setKeyOf, type Card } from '../lib/types'

type Filter = 'all' | 'have' | 'missing'

/** Carta de um set completo, venha do TCGdex ou do catálogo da Liga. */
interface RemoteCard {
  id: string
  localId: string
  name: string
  nameEn: string
  image: string | null
  ligaImage: string | null
  liga: LigaCard | null
}

interface RemoteSet {
  name: string
  official: number | null
  cards: RemoteCard[]
}

interface Slot extends RemoteCard {
  owned: Card[]
  quantity: number
}

function fromTcgdex(set: TcgSet): RemoteSet {
  return {
    name: set.name,
    official: set.official || null,
    cards: set.cards.map((t) => ({
      id: t.id,
      localId: t.localId,
      name: t.name,
      nameEn: t.nameEn ?? t.name,
      image: t.image,
      ligaImage: null,
      liga: null,
    })),
  }
}

async function fromLiga(editionId: number): Promise<RemoteSet | null> {
  const catalog = await loadCatalog()
  const edition = catalog?.editionById.get(editionId)
  if (!catalog || !edition) return null
  const cards = (catalog.byEdition.get(editionId) ?? [])
    .slice()
    .sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }))
  const totals = cards.map((c) => parseInt(c.total ?? '', 10)).filter((n) => n > 0)
  return {
    name: edition.name,
    official: totals.length ? Math.min(...totals) : null,
    cards: cards.map((c) => ({
      id: c.url,
      localId: c.num,
      name: c.name,
      nameEn: c.name,
      image: null,
      ligaImage: c.image,
      liga: c,
    })),
  }
}

export function SetDetailScreen({ setKey }: { setKey: string }) {
  const { cards } = useCollection()
  const openAdd = useAddSheet()
  const [filter, setFilter] = useState<Filter>('all')
  const isManual = setKey.startsWith('manual:')
  const [remote, setRemote] = useState<{ key: string; set: RemoteSet | null; error: boolean } | null>(null)

  useEffect(() => {
    if (isManual) return
    let active = true
    const load = setKey.startsWith('liga:')
      ? fromLiga(Number(setKey.slice(5)))
      : getSet(setKey).then((set) => (set ? fromTcgdex(set) : null))
    load
      .then((set) => active && setRemote({ key: setKey, set, error: !set }))
      .catch(() => active && setRemote({ key: setKey, set: null, error: true }))
    return () => {
      active = false
    }
  }, [setKey, isManual])

  const owned = useMemo(() => cards.filter((c) => setKeyOf(c) === setKey), [cards, setKey])
  const current = remote?.key === setKey ? remote : null
  const remoteSet = current?.set ?? null
  const loading = !isManual && !current

  const slots = useMemo<Slot[]>(() => {
    if (remoteSet) {
      const byId = new Map<string, Card[]>()
      const byNumber = new Map<string, Card[]>()
      for (const c of owned) {
        if (c.tcgdex_id && !c.set_id?.startsWith('liga:')) byId.set(c.tcgdex_id, [...(byId.get(c.tcgdex_id) ?? []), c])
        else if (c.card_number) {
          const k = plainNumber(c.card_number)
          byNumber.set(k, [...(byNumber.get(k) ?? []), c])
        }
      }
      return remoteSet.cards.map((t) => {
        // Na Liga o número pode se repetir entre versões da mesma edição: confere o nome também.
        const mine = [...(byId.get(t.id) ?? []), ...(byNumber.get(plainNumber(t.localId)) ?? [])].filter(
          (c) => !t.liga || normalize(c.name_en ?? c.name) === normalize(t.name),
        )
        return { ...t, owned: mine, quantity: mine.reduce((n, c) => n + c.quantity, 0) }
      })
    }
    // Set manual ou sem conexão: mostra só o que tenho.
    const groups = new Map<string, Card[]>()
    for (const c of sortCards(owned, 'number')) groups.set(cardKey(c), [...(groups.get(cardKey(c)) ?? []), c])
    return [...groups.entries()].map(([k, list]) => ({
      id: k,
      localId: list[0].card_number ?? '',
      name: list[0].name,
      nameEn: list[0].name_en ?? list[0].name,
      image: list[0].image_url,
      ligaImage: list[0].liga_image ?? null,
      liga: null,
      owned: list,
      quantity: list.reduce((n, c) => n + c.quantity, 0),
    }))
  }, [remoteSet, owned])

  const name = remoteSet?.name ?? owned[0]?.set_name ?? (isManual ? setKey.slice(7) : setKey)
  const official = remoteSet?.official ?? (parseInt(owned[0]?.set_total ?? '', 10) || null)
  const ownedCount = new Set(owned.map(cardKey)).size
  const visible = slots.filter((s) => (filter === 'all' ? true : filter === 'have' ? s.quantity > 0 : s.quantity === 0))

  return (
    <main className="pb-nav px-4 pt-[max(16px,env(safe-area-inset-top))] md:px-8">
      <div className="flex items-center gap-2 pt-1">
        <IconButton label="Voltar" variant="ghost" className="-ml-2" onClick={() => goBack({ name: 'sets' })}>
          <ArrowLeft size={22} aria-hidden />
        </IconButton>
      </div>
      <header className="mt-1">
        <h1 className="screen-title">{name}</h1>
        <p className="mt-1.5 text-[15px] font-medium text-muted">
          {ownedCount}
          {official ? ` de ${official}` : ''} {ownedCount === 1 && !official ? 'carta' : 'cartas'}
        </p>
        {official ? (
          <div className="mt-3">
            <ProgressBar value={ownedCount} max={official} label={`Progresso em ${name}`} />
          </div>
        ) : null}
      </header>

      {!isManual && (
        <div className="mt-5 flex gap-2" role="toolbar" aria-label="Filtrar cartas do set">
          <Pill active={filter === 'all'} onClick={() => setFilter('all')}>
            Todas
          </Pill>
          <Pill active={filter === 'have'} onClick={() => setFilter('have')}>
            Tenho
          </Pill>
          <Pill active={filter === 'missing'} onClick={() => setFilter('missing')}>
            Faltam
          </Pill>
        </div>
      )}

      {current?.error && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-sm text-muted">
          <CloudOff size={16} aria-hidden /> Não consegui carregar o set completo: mostrando só as cartas que você tem.
        </p>
      )}

      {loading ? (
        <div
          className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
          aria-busy="true"
          aria-label="Carregando"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="skeleton aspect-[63/88] rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {visible.map((s) => {
            const have = s.quantity > 0
            const first = s.owned[0]
            return (
              <li key={s.id} className="min-w-0">
                <div className="relative">
                  <div className={have ? '' : 'opacity-35 grayscale'}>
                    <CardArt
                      name={s.name}
                      number={s.localId}
                      total={official ? String(official) : null}
                      image={s.image ?? first?.image_url}
                      ligaImage={s.ligaImage ?? first?.liga_image}
                      photoPath={first?.photo_path}
                      href={
                        first
                          ? ligaUrlFor(first)
                          : (s.liga?.url ?? ligaCardUrl(s.nameEn, s.localId, official ? String(official) : null))
                      }
                      onLongPress={first ? () => navigate({ name: 'card', id: first.id }) : undefined}
                      missing={!have}
                    >
                      {have && (
                        <span className="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-fg text-[11px] font-extrabold tabular-nums text-ink shadow">
                          {s.quantity}
                        </span>
                      )}
                    </CardArt>
                  </div>
                  {!have && (
                    <button
                      type="button"
                      onClick={() => openAdd(s.liga ? { liga: s.liga } : { tcgdexId: s.id })}
                      aria-label={`Adicionar ${s.name} (${s.localId})`}
                      className="absolute bottom-1 right-1 flex size-11 items-center justify-center"
                    >
                      <span className="flex size-8 items-center justify-center rounded-full bg-accent text-ink shadow-lg">
                        <Plus size={18} strokeWidth={2.6} aria-hidden />
                      </span>
                    </button>
                  )}
                </div>
                <p className="mt-1 truncate text-center text-[11px] font-semibold tabular-nums text-muted">
                  {s.localId}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
