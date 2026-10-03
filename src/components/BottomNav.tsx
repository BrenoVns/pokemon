import { Layers, LibraryBig, Plus } from 'lucide-react'
import { navigate } from '../hooks/useRoute'
import { cx } from '../lib/cx'

export function BottomNav({ active, onAdd }: { active: 'collection' | 'sets'; onAdd: () => void }) {
  const item = (key: 'collection' | 'sets', label: string, Icon: typeof Layers) => (
    <button
      type="button"
      onClick={() => navigate(key === 'collection' ? { name: 'collection' } : { name: 'sets' }, true)}
      aria-current={active === key ? 'page' : undefined}
      className={cx(
        'flex h-full min-w-11 flex-1 flex-col items-center justify-center gap-1 text-xs font-bold transition',
        active === key ? 'text-fg' : 'text-muted hover:text-fg',
      )}
    >
      <Icon size={22} strokeWidth={active === key ? 2.2 : 1.8} aria-hidden />
      {label}
    </button>
  )

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-[18px] pb-[calc(18px+env(safe-area-inset-bottom))]"
    >
      <div className="flex h-[70px] items-center rounded-[var(--radius-nav)] border border-line bg-nav px-4 shadow-[0_20px_50px_rgba(0,0,0,0.65),0_4px_14px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {item('collection', 'Minha Coleção', LibraryBig)}
        <button
          type="button"
          onClick={onAdd}
          aria-label="Adicionar carta"
          className="mx-2 flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-ink shadow-[0_8px_24px_rgba(185,166,255,0.35)] transition active:scale-95"
        >
          <Plus size={26} strokeWidth={2.4} aria-hidden />
        </button>
        {item('sets', 'Edições', Layers)}
      </div>
    </nav>
  )
}
