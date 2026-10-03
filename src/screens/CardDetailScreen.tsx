import { useState, type ReactNode } from 'react'
import { ArrowLeft, Copy, ExternalLink, Search, Trash2 } from 'lucide-react'
import { CardArt } from '../components/CardArt'
import { Button, ConfirmDialog, EmptyState, IconButton, PillChoice, Segmented, Stepper } from '../components/ui'
import { useAddSheet } from '../hooks/useAddSheet'
import { useCollection } from '../hooks/useCollection'
import { goBack, navigate } from '../hooks/useRoute'
import { useToast } from '../hooks/useToast'
import { cx } from '../lib/cx'
import { ligaName, ligaSearchUrl, ligaUrlFor } from '../lib/liga'
import { CONDITION_LABELS, CONDITIONS, LANGUAGES, VARIANTS, type Card } from '../lib/types'

export function CardDetailScreen({ id }: { id: string }) {
  const { cards, loading } = useCollection()
  const card = cards.find((c) => c.id === id)

  return (
    <main className="px-4 pb-16 pt-[max(16px,env(safe-area-inset-top))] md:px-8">
      <div className="flex items-center pt-1">
        <IconButton label="Voltar" variant="ghost" className="-ml-2" onClick={() => goBack({ name: 'collection' })}>
          <ArrowLeft size={22} aria-hidden />
        </IconButton>
      </div>
      {card ? (
        <Detail key={card.id} card={card} />
      ) : loading ? (
        <div className="mx-auto mt-4 max-w-[300px]" aria-busy="true" aria-label="Carregando">
          <div className="skeleton aspect-[63/88] rounded-[var(--radius-card)]" />
        </div>
      ) : (
        <EmptyState icon={<Search size={24} aria-hidden />} title="Carta não encontrada">
          Ela pode ter sido excluída.
        </EmptyState>
      )}
    </main>
  )
}

function Row({ label, children, stacked }: { label: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div
      className={cx(
        'flex gap-3 border-b border-line py-4 last:border-b-0',
        stacked ? 'flex-col' : 'items-center justify-between',
      )}
    >
      <span className="text-sm font-semibold text-muted">{label}</span>
      {children}
    </div>
  )
}

function Detail({ card }: { card: Card }) {
  const { updateCard, deleteCard } = useCollection()
  const openAdd = useAddSheet()
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const liga = ligaUrlFor(card)

  function update(patch: Parameters<typeof updateCard>[1]) {
    const finalId = updateCard(card.id, patch)
    if (finalId !== card.id) navigate({ name: 'card', id: finalId }, true)
  }

  function remove() {
    deleteCard(card.id)
    toast.show('Carta excluída', 'success')
    goBack({ name: 'collection' })
  }

  const added = new Date(card.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-xl">
      <div className="mx-auto mt-2 w-full max-w-[300px]">
        <CardArt
          name={card.name}
          number={card.card_number}
          total={card.set_total}
          ligaImage={card.liga_image}
          photoPath={card.photo_path}
          href={liga}
          shadow="soft"
          className="rounded-[18px]"
        />
      </div>

      <div className="mt-6 text-center">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em]">{card.name}</h1>
        <p className="mt-1 text-[15px] text-muted">
          {[
            card.set_name,
            card.card_number && (card.set_total ? `${card.card_number}/${card.set_total}` : card.card_number),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <a
          href={liga}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-full bg-accent px-6 text-[15px] font-bold text-ink transition active:scale-[0.98]"
        >
          Ver preço na LigaPokemon <ExternalLink size={18} aria-hidden />
        </a>
        <a
          href={ligaSearchUrl(ligaName(card))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted hover:text-fg"
        >
          <Search size={16} aria-hidden /> Buscar por nome na Liga
        </a>
      </div>

      <section aria-label="Atributos" className="mt-6 rounded-2xl border border-line bg-surface px-4">
        <Row label="Quantidade">
          <Stepper value={card.quantity} onChange={(q) => update({ quantity: q })} />
        </Row>
        <Row label={`Condição · ${CONDITION_LABELS[card.condition]}`} stacked>
          <Segmented
            label="Condição"
            options={CONDITIONS}
            value={card.condition}
            onChange={(v) => update({ condition: v })}
            titles={CONDITION_LABELS}
          />
        </Row>
        <Row label="Idioma" stacked>
          <Segmented
            label="Idioma"
            options={LANGUAGES}
            value={card.language}
            onChange={(v) => update({ language: v })}
          />
        </Row>
        <Row label="Variante" stacked>
          <PillChoice
            label="Variante"
            options={VARIANTS}
            value={card.variant}
            onChange={(v) => update({ variant: v })}
          />
        </Row>
        <Row label="Adicionada em">
          <span className="text-sm font-semibold">{added}</span>
        </Row>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="surface" onClick={() => openAdd({ from: card })}>
          <Copy size={18} aria-hidden /> Duplicar
        </Button>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={18} aria-hidden /> Excluir
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Excluir carta?"
        message={
          <>
            {card.name} ({card.condition} · {card.language} · {card.variant}, ×{card.quantity}) será removida da coleção
            {card.photo_path ? ', junto com a sua foto' : ''}. Não dá para desfazer.
          </>
        }
        confirmLabel="Excluir"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </div>
  )
}
