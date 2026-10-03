import { ArrowUpRight } from 'lucide-react'
import { navigate } from '../hooks/useRoute'
import { cx } from '../lib/cx'
import { ligaUrlFor } from '../lib/liga'
import type { SetSummary } from '../lib/stats'
import { setKeyOf, type Card } from '../lib/types'
import { CardArt } from './CardArt'
import { ProgressBar } from './ui'

const openDetail = (c: Card) => navigate({ name: 'card', id: c.id })

function numberLabel(c: Card) {
  if (!c.card_number) return ''
  return c.set_total ? `${c.card_number}/${c.set_total}` : c.card_number
}

// ---------------------------------------------------------------------------
// A) Vitrine
// ---------------------------------------------------------------------------
export function ShowcaseGrid({ cards }: { cards: Card[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-[14px] gap-y-[22px] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {cards.map((c) => (
        <li key={c.id} className="min-w-0">
          <CardArt
            name={c.name}
            number={c.card_number}
            total={c.set_total}
            image={c.image_url}
            ligaImage={c.liga_image}
            photoPath={c.photo_path}
            href={ligaUrlFor(c)}
            onLongPress={() => openDetail(c)}
            shadow="color"
          >
            {c.quantity > 1 && (
              <span className="absolute right-2 top-2 rounded-full bg-[rgba(10,10,15,0.82)] px-2.5 py-1 text-xs font-bold tabular-nums text-fg backdrop-blur">
                ×{c.quantity}
              </span>
            )}
          </CardArt>
          <button
            type="button"
            onClick={() => openDetail(c)}
            className="mt-3 flex min-h-11 w-full flex-col items-start text-left"
          >
            <span className="w-full truncate text-[15px] font-bold leading-snug">{c.name}</span>
            <span className="w-full truncate text-[13px] text-muted">
              {[c.set_name, numberLabel(c)].filter(Boolean).join(' · ')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// B) Galeria
// ---------------------------------------------------------------------------
export function GalleryGrid({ cards }: { cards: Card[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {cards.map((c) => (
        <li key={c.id} className="min-w-0">
          <CardArt
            name={c.name}
            number={c.card_number}
            total={c.set_total}
            image={c.image_url}
            ligaImage={c.liga_image}
            photoPath={c.photo_path}
            href={ligaUrlFor(c)}
            onLongPress={() => openDetail(c)}
          >
            {c.quantity > 1 && (
              <span className="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-fg text-[11px] font-extrabold tabular-nums text-ink shadow">
                {c.quantity}
              </span>
            )}
          </CardArt>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// C) Lista agrupada por set
// ---------------------------------------------------------------------------
export function GroupedList({ cards, sets }: { cards: Card[]; sets: SetSummary[] }) {
  const groups = new Map<string, Card[]>()
  for (const c of cards) {
    const k = setKeyOf(c)
    groups.set(k, [...(groups.get(k) ?? []), c])
  }
  const order = sets.filter((s) => groups.has(s.key))

  return (
    <div className="flex flex-col gap-7">
      {order.map((s) => (
        <section key={s.key} aria-label={s.name}>
          <button
            type="button"
            onClick={() => navigate({ name: 'set', key: s.key })}
            className="flex w-full flex-col gap-2 py-1 text-left"
          >
            <h2 className="text-[15px] font-bold">
              {s.name}
              <span className="font-semibold text-muted">
                {' '}
                — {s.owned}
                {s.total ? ` de ${s.total}` : ''}
              </span>
            </h2>
            {s.total && <ProgressBar value={s.owned} max={s.total} label={`Progresso em ${s.name}`} />}
          </button>
          <ul className="mt-3 flex flex-col gap-2">
            {groups.get(s.key)!.map((c) => (
              <ListRow key={c.id} card={c} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ListRow({ card: c }: { card: Card }) {
  const liga = ligaUrlFor(c)
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2 pr-1">
      <div className="w-[54px] shrink-0">
        <CardArt
          name={c.name}
          number={c.card_number}
          total={c.set_total}
          image={c.image_url}
          ligaImage={c.liga_image}
          photoPath={c.photo_path}
          href={liga}
          className="rounded-md"
        />
      </div>
      <button type="button" onClick={() => openDetail(c)} className="flex min-h-11 min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-[15px] font-bold">{c.name}</span>
        <span className="truncate text-[13px] text-muted">
          {[c.card_number, c.condition, c.language].filter(Boolean).join(' · ')}
        </span>
      </button>
      <span
        className={cx(
          'min-w-8 text-right text-[15px] font-bold tabular-nums',
          c.quantity > 1 ? 'text-accent' : 'text-muted',
        )}
        aria-label={`Quantidade ${c.quantity}`}
      >
        ×{c.quantity}
      </span>
      <a
        href={liga}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ver ${c.name} na LigaPokemon`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg"
      >
        <ArrowUpRight size={20} aria-hidden />
      </a>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------
export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-x-[14px] gap-y-[22px] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      aria-busy="true"
      aria-label="Carregando"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[63/88] rounded-[var(--radius-card)]" />
          <div className="skeleton mt-3 h-4 w-3/4 rounded-full" />
          <div className="skeleton mt-2 h-3 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  )
}
