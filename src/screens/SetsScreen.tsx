import { useMemo } from 'react'
import { ChevronRight, Layers } from 'lucide-react'
import { CardArt } from '../components/CardArt'
import { EmptyState, ProgressBar } from '../components/ui'
import { useCollection } from '../hooks/useCollection'
import { navigate } from '../hooks/useRoute'
import { summarizeSets } from '../lib/stats'
import { setKeyOf } from '../lib/types'

export function SetsScreen() {
  const { cards, loading } = useCollection()
  const sets = useMemo(() => summarizeSets(cards), [cards])
  const cover = useMemo(() => {
    const m = new Map<string, (typeof cards)[number]>()
    for (const c of cards)
      if (!m.has(setKeyOf(c)) || (!m.get(setKeyOf(c))!.image_url && c.image_url)) m.set(setKeyOf(c), c)
    return m
  }, [cards])

  return (
    <main className="pb-nav px-4 pt-[max(20px,env(safe-area-inset-top))] md:px-8">
      <header className="pt-2">
        <h1 className="screen-title">Edições</h1>
        <p className="mt-1.5 text-[15px] font-medium text-muted">
          {sets.length === 1 ? '1 edição na coleção' : `${sets.length} edições na coleção`}
        </p>
      </header>

      {loading && cards.length === 0 ? (
        <div className="mt-6 flex flex-col gap-3" aria-busy="true" aria-label="Carregando">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-[84px] rounded-2xl" />
          ))}
        </div>
      ) : sets.length === 0 ? (
        <EmptyState icon={<Layers size={24} aria-hidden />} title="Nenhuma edição ainda">
          As edições aparecem aqui conforme você adiciona cartas.
        </EmptyState>
      ) : (
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {sets.map((s) => {
            const c = cover.get(s.key)
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'set', key: s.key })}
                  className="flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-3 text-left transition hover:bg-surface-strong active:scale-[0.99]"
                >
                  <div className="w-11 shrink-0">
                    {c && (
                      <CardArt
                        name={c.name}
                        image={c.image_url}
                        ligaImage={c.liga_image}
                        photoPath={c.photo_path}
                        className="rounded-md"
                        decorative
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[15px] font-bold">{s.name}</span>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-muted">
                        {s.owned}
                        {s.total ? ` de ${s.total}` : ''}
                      </span>
                    </div>
                    {s.total ? (
                      <ProgressBar value={s.owned} max={s.total} label={`Progresso em ${s.name}`} />
                    ) : (
                      <span className="text-xs text-muted">Cadastro manual</span>
                    )}
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
