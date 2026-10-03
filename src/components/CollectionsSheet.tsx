import { useMemo, useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCollection } from '../hooks/useCollection'
import { useToast } from '../hooks/useToast'
import { cx } from '../lib/cx'
import type { Collection } from '../lib/types'
import { Button, ConfirmDialog, IconButton, Sheet, inputClass } from './ui'

/** Lista das coleções (fichários): escolher, criar, renomear e excluir. */
export function CollectionsSheet({ onClose }: { onClose: () => void }) {
  const { collections, collection, allCards, createCollection, renameCollection, deleteCollection, selectCollection } =
    useCollection()
  const toast = useToast()
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [toDelete, setToDelete] = useState<Collection | null>(null)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of allCards) m.set(c.collection_id, (m.get(c.collection_id) ?? 0) + c.quantity)
    return m
  }, [allCards])

  const nameTaken = (value: string, exceptId?: string) =>
    collections.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === value.trim().toLowerCase())

  function create(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (nameTaken(trimmed)) {
      toast.show('Já existe uma coleção com esse nome', 'error')
      return
    }
    createCollection(trimmed)
    toast.show(`Coleção "${trimmed}" criada`, 'success')
    onClose()
  }

  function startEdit(c: Collection) {
    setEditingId(c.id)
    setEditName(c.name)
  }

  function saveEdit(e: FormEvent, c: Collection) {
    e.preventDefault()
    const trimmed = editName.trim()
    if (!trimmed) return
    if (nameTaken(trimmed, c.id)) {
      toast.show('Já existe uma coleção com esse nome', 'error')
      return
    }
    renameCollection(c.id, trimmed)
    setEditingId(null)
    if (trimmed !== c.name) toast.show('Nome atualizado', 'success')
  }

  function confirmDelete() {
    if (!toDelete) return
    deleteCollection(toDelete.id)
    toast.show(`Coleção "${toDelete.name}" excluída`, 'success')
    setToDelete(null)
    setEditingId(null)
  }

  const deleteCount = toDelete ? (counts.get(toDelete.id) ?? 0) : 0

  return (
    <Sheet open onClose={onClose} title="Coleções">
      {collections.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed text-muted">
          Você ainda não tem nenhuma coleção. Crie a primeira abaixo.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Suas coleções">
          {collections.map((c) => {
            const active = c.id === collection?.id
            const n = counts.get(c.id) ?? 0
            if (editingId === c.id) {
              return (
                <li key={c.id} className="rounded-2xl border border-accent/60 bg-surface p-3">
                  <form onSubmit={(e) => saveEdit(e, c)} className="flex flex-col gap-3">
                    <label htmlFor={`nome-${c.id}`} className="text-sm font-semibold text-muted">
                      Nome da coleção
                    </label>
                    <input
                      id={`nome-${c.id}`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={40}
                      autoFocus
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1" disabled={!editName.trim()}>
                        Salvar
                      </Button>
                      <Button variant="surface" className="flex-1" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </div>
                    <Button variant="danger" onClick={() => setToDelete(c)}>
                      <Trash2 size={18} aria-hidden /> Excluir coleção
                    </Button>
                  </form>
                </li>
              )
            }
            return (
              <li key={c.id} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => {
                    selectCollection(c.id)
                    onClose()
                  }}
                  className={cx(
                    'flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border px-4 text-left transition',
                    active ? 'border-accent/60 bg-accent/10' : 'border-line bg-surface hover:bg-surface-strong',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{c.name}</span>
                    <span className="block text-[13px] text-muted">{n === 1 ? '1 carta' : `${n} cartas`}</span>
                  </span>
                  {active && <Check size={20} className="shrink-0 text-accent" aria-label="Coleção atual" />}
                </button>
                <IconButton label={`Renomear ou excluir ${c.name}`} onClick={() => startEdit(c)}>
                  <Pencil size={18} aria-hidden />
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}

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

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        title={`Excluir "${toDelete?.name ?? ''}"?`}
        message={
          deleteCount > 0
            ? `A coleção e ${deleteCount === 1 ? 'a carta dela' : `as ${deleteCount} cartas dela`} serão apagadas deste aparelho. Se quiser guardar, exporte um backup antes. Não dá para desfazer.`
            : 'A coleção está vazia e será apagada.'
        }
        confirmLabel="Excluir"
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </Sheet>
  )
}
