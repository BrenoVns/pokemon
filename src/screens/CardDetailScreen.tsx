import { useState, type ReactNode } from 'react'
import { ArrowLeft, Copy, ExternalLink, Search, Trash2 } from 'lucide-react'
import { CardArt } from '../components/CardArt'
import { PhotoPicker } from '../components/PhotoPicker'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  PillChoice,
  Segmented,
  Stepper,
  inputClass,
} from '../components/ui'
import { useAddSheet } from '../hooks/useAddSheet'
import { useCollection } from '../hooks/useCollection'
import { usePhotoUrl } from '../hooks/usePhotoUrl'
import { goBack, navigate } from '../hooks/useRoute'
import { useToast } from '../hooks/useToast'
import { cx } from '../lib/cx'
import { isValidUrl, ligaCardUrl, ligaSearchUrl, ligaUrlFor } from '../lib/liga'
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
  const { updateCard, deleteCard, setPhoto } = useCollection()
  const openAdd = useAddSheet()
  const toast = useToast()
  const photo = usePhotoUrl(card.photo_path)
  const hasOfficial = Boolean(card.image_url)
  const [showPhoto, setShowPhoto] = useState(!hasOfficial)
  const [link, setLink] = useState(card.liga_url ?? '')
  const [notes, setNotes] = useState(card.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const liga = ligaUrlFor(card)
  const showToggle = hasOfficial && Boolean(card.photo_path)
  const linkInvalid = link.trim() !== '' && !isValidUrl(link)

  function update(patch: Parameters<typeof updateCard>[1]) {
    const finalId = updateCard(card.id, patch)
    if (finalId !== card.id) navigate({ name: 'card', id: finalId }, true)
  }

  function saveLink() {
    const v = link.trim()
    if (v === (card.liga_url ?? '')) return
    if (v && !isValidUrl(v)) {
      toast.show('Link inválido: use um endereço completo com https://', 'error')
      return
    }
    update({ liga_url: v || null })
    toast.show(v ? 'Link salvo' : 'Link removido — usando o link automático', 'success')
  }

  function saveNotes() {
    const v = notes.trim()
    if (v !== (card.notes ?? '')) update({ notes: v || null })
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
          image={card.image_url}
          photoPath={card.photo_path}
          prefer={showPhoto ? 'photo' : 'official'}
          quality="high"
          href={liga}
          shadow="color"
          className="rounded-[18px]"
        />
      </div>

      {showToggle && (
        <div className="mx-auto mt-5 w-full max-w-[300px]">
          <Segmented
            label="Imagem exibida"
            options={['Arte oficial', 'Minha foto'] as const}
            value={showPhoto ? 'Minha foto' : 'Arte oficial'}
            onChange={(v) => setShowPhoto(v === 'Minha foto')}
          />
        </div>
      )}

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
          href={ligaSearchUrl(card.name)}
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
        <Row label="Link da LigaPokemon" stacked>
          <input
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onBlur={saveLink}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            placeholder="Automático"
            aria-invalid={linkInvalid}
            className={inputClass}
          />
          <p className="break-all text-xs leading-relaxed text-muted">
            {card.liga_url
              ? 'Usando o link colado.'
              : `Automático: ${ligaCardUrl(card.name, card.card_number, card.set_total)}`}
          </p>
        </Row>
        <Row label="Notas" stacked>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={3}
            placeholder="Sem notas"
            className={cx(inputClass, 'py-3')}
          />
        </Row>
        <Row label="Minha foto" stacked>
          <PhotoPicker
            value={null}
            existingUrl={photo.url}
            onChange={(blob) => {
              if (!blob) return
              void setPhoto(card.id, blob).then(() => {
                setShowPhoto(true)
                toast.show('Foto salva', 'success')
              })
            }}
            onRemoveExisting={() => {
              void setPhoto(card.id, null)
              setShowPhoto(false)
            }}
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
