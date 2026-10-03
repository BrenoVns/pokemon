import { useMemo, useState, type FormEvent } from 'react'
import { Check, Plus } from 'lucide-react'
import { useCollection } from '../hooks/useCollection'
import { useToast } from '../hooks/useToast'
import { cx } from '../lib/cx'
import { Button, Sheet, inputClass } from './ui'

/** Lista das coleções (fichários): escolher qual ver e criar uma nova. */
export function CollectionsSheet({ onClose }: { onClose: () => void }) {
  const { collections, collection, allCards, createCollection, selectCollection } = useCollection()
  const toast = useToast()
  const [name, setName] = useState('')

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of allCards) m.set(c.collection_id, (m.get(c.collection_id) ?? 0) + c.quantity)
    return m
  }, [allCards])

  function create(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (collections.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.show('Já existe uma coleção com esse nome', 'error')
      return
    }
    createCollection(trimmed)
    toast.show(`Coleção "${trimmed}" criada`, 'success')
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title="Coleções">
      <ul className="flex flex-col gap-2" aria-label="Suas coleções">
        {collections.map((c) => {
          const active = c.id === collection?.id
          const n = counts.get(c.id) ?? 0
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  selectCollection(c.id)
                  onClose()
                }}
                className={cx(
                  'flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left transition',
                  active ? 'border-accent/60 bg-accent/10' : 'border-line bg-surface hover:bg-surface-strong',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{c.name}</span>
                  <span className="block text-[13px] text-muted">{n === 1 ? '1 carta' : `${n} cartas`}</span>
                </span>
                {active && <Check size={20} className="shrink-0 text-accent" aria-label="Coleção atual" />}
              </button>
            </li>
          )
        })}
      </ul>

      <form onSubmit={create} className="mt-8 flex flex-col gap-3">
        <label htmlFor="nova-colecao" className="text-sm font-semibold text-muted">
          Nova coleção
        </label>
        <input
          id="nova-colecao"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Ex.: Fichário azul, Trocas, Deck"
          className={inputClass}
        />
        <Button type="submit" disabled={!name.trim()}>
          <Plus size={18} aria-hidden /> Criar coleção
        </Button>
      </form>
    </Sheet>
  )
}
