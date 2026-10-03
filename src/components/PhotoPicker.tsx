import { useRef, useState } from 'react'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { resizeImage } from '../lib/image'

/** Escolhe/tira uma foto e devolve já redimensionada (máx. 1200px). */
export function PhotoPicker({
  value,
  onChange,
  existingUrl,
  onRemoveExisting,
}: {
  value: Blob | null
  onChange: (blob: Blob | null) => void
  existingUrl?: string | null
  onRemoveExisting?: () => void
}) {
  const toast = useToast()
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)

  async function handle(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const blob = await resizeImage(file)
      if (preview) URL.revokeObjectURL(preview.url)
      setPreview({ blob, url: URL.createObjectURL(blob) })
      onChange(blob)
    } catch {
      toast.show('Não foi possível ler a foto', 'error')
    } finally {
      setBusy(false)
    }
  }

  const shown = value ? (preview?.blob === value ? preview.url : null) : (existingUrl ?? null)

  return (
    <div className="flex items-center gap-3">
      {shown && (
        <img
          src={shown}
          alt="Minha foto da carta"
          className="h-24 w-[68px] shrink-0 rounded-lg border border-line object-cover"
        />
      )}
      <div className="flex flex-1 flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => camera.current?.click()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-strong disabled:opacity-50"
        >
          <Camera size={18} aria-hidden /> {shown ? 'Nova foto' : 'Tirar foto'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => gallery.current?.click()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-strong disabled:opacity-50"
        >
          <ImagePlus size={18} aria-hidden /> Galeria
        </button>
        {shown && (
          <button
            type="button"
            onClick={() => (value ? onChange(null) : onRemoveExisting?.())}
            aria-label="Remover foto"
            className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface text-danger hover:bg-surface-strong"
          >
            <Trash2 size={18} aria-hidden />
          </button>
        )}
        {busy && <span className="self-center text-xs text-muted">Processando…</span>}
      </div>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handle(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handle(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
