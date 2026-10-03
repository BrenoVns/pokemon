import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CloudOff, Plus } from 'lucide-react'
import { CardArt } from '../components/CardArt'
import { IconButton, Pill, ProgressBar } from '../components/ui'
import { useAddSheet } from '../hooks/useAddSheet'
import { useCollection } from '../hooks/useCollection'
import { goBack, navigate } from '../hooks/useRoute'
import { ligaCardUrl, ligaUrlFor } from '../lib/liga'
import { sortCards } from '../lib/stats'
import { getSet, type TcgSet } from '../lib/tcgdex'
import { cardKey, setKeyOf, type Card } from '../lib/types'

type Filter = 'all' | 'have' | 'missing'

interface Slot {
  id: string
  name: string
  number: string
  image: string | null
  owned: Card[]
  quantity: number
}

export function SetDetailScreen({ setKey }: { setKey: string }) {
  const { cards } = useCollection()
  const openAdd = useAddSheet()
  const [filter, setFilter] = useState<Filter>('all')
  const isManual = setKey.startsWith('manual:')
  const [remote, setRemote] = useState<{ key: string; set: TcgSet | null; error: boolean } | null>(null)

  useEffect(() => {
    if (isManual) return
    let active = true
    getSet(setKey)
      .then((set) => active && setRemote({ key: setKey, set, error: false }))
      .catch(() => active && setRemote({ key: setKey, set: null, error: true }))
    return () => {
      active = false
    }
  }, [setKey, isManual])

  const owned = useMemo(() => cards.filter((c) => setKeyOf(c) === setKey), [cards, setKey])
  const current = remote?.key === setKey ? remote : null
  const tcgSet = current?.set ?? null
  const loading = !isManual && !current

  const slots = useMemo<Slot[]>(() => {
    if (tcgSet) {
      const byId = new Map<string, Card[]>()
      const byNumber = new Map<string, Card[]>()
      for (const c of owned) {
        if (c.tcgdex_id) byId.set(c.tcgdex_id, [...(byId.get(c.tcgdex_id) ?? []), c])
        else if (c.card_number) byNumber.set(c.card_number, [...(byNumber.get(c.card_number) ?? []), c])
      }
      return tcgSet.cards.map((t) => {
        const mine = [...(byId.get(t.id) ?? []), ...(byNumber.get(t.localId) ?? [])]
        return {
          id: t.id,
          name: t.name,
          number: t.localId,
          image: t.image,
          owned: mine,
          quantity: mine.reduce((n, c) => n + c.quantity, 0),
        }
      })
    }
    // Set manual ou sem conexão: mostra só o que tenho.
    const groups = new Map<string, Card[]>()
    for (const c of sortCards(owned, 'number')) groups.set(cardKey(c), [...(groups.get(cardKey(c)) ?? []), c])
    return [...groups.entries()].map(([k, list]) => ({
      id: k,
      name: list[0].name,
      number: list[0].card_number ?? '',
      image: list[0].image_url,
      owned: list,
      quantity: list.reduce((n, c) => n + c.quantity, 0),
    }))
  }, [tcgSet, owned])

  const name = tcgSet?.name ?? owned[0]?.set_name ?? (isManual ? setKey.slice(7) : setKey)
  const official = tcgSet?.official ?? (parseInt(owned[0]?.set_total ?? '', 10) || null)
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
          {official ? ` de ${official}` : ''} {ownedCount === 1 ? 'carta' : 'cartas'}
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
          <CloudOff size={16} aria-hidden /> Sem conexão com o TCGdex: mostrando só as cartas que você tem.
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
                      number={s.number}
                      total={official ? String(official) : null}
                      image={s.image}
                      photoPath={first?.photo_path}
                      href={
                        first ? ligaUrlFor(first) : ligaCardUrl(s.name, s.number, official ? String(official) : null)
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
                      onClick={() => openAdd({ tcgdexId: s.id })}
                      aria-label={`Adicionar ${s.name} (${s.number})`}
                      className="absolute bottom-1 right-1 flex size-11 items-center justify-center"
                    >
                      <span className="flex size-8 items-center justify-center rounded-full bg-accent text-ink shadow-lg">
                        <Plus size={18} strokeWidth={2.6} aria-hidden />
                      </span>
                    </button>
                  )}
                </div>
                <p className="mt-1 truncate text-center text-[11px] font-semibold tabular-nums text-muted">
                  {s.number}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
