import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { cx } from '../lib/cx'

export function IconButton({
  label,
  children,
  className,
  variant = 'surface',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: 'surface' | 'ghost' | 'accent' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40',
        variant === 'surface' && 'border border-line bg-surface text-fg hover:bg-surface-strong',
        variant === 'ghost' && 'text-fg hover:bg-surface',
        variant === 'accent' && 'bg-accent text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Button({
  children,
  className,
  variant = 'accent',
  ...props
}: ComponentProps<'button'> & { variant?: 'accent' | 'surface' | 'danger' | 'white' }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold transition active:scale-[0.98] disabled:opacity-50',
        variant === 'accent' && 'bg-accent text-ink',
        variant === 'white' && 'bg-fg text-ink',
        variant === 'surface' && 'border border-line bg-surface text-fg hover:bg-surface-strong',
        variant === 'danger' && 'border border-line bg-surface text-danger hover:bg-surface-strong',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Pill({
  active,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        'inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition active:scale-95',
        active ? 'bg-fg text-ink' : 'border border-line bg-surface text-fg hover:bg-surface-strong',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/** Controle segmentado (ex.: M NM SP MP HP D). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  titles,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  titles?: Partial<Record<T, string>>
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          title={titles?.[o]}
          onClick={() => onChange(o)}
          className={cx(
            'min-h-10 flex-1 rounded-full px-1 text-sm font-bold transition',
            value === o ? 'bg-accent text-ink' : 'text-muted hover:text-fg',
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

/** Pílulas de escolha única que quebram linha (ex.: variantes). */
export function PillChoice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cx(
            'min-h-11 rounded-full px-4 text-sm font-semibold transition active:scale-95',
            value === o ? 'bg-accent text-ink' : 'border border-line bg-surface text-fg hover:bg-surface-strong',
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, min = 1 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1">
      <IconButton
        label="Diminuir quantidade"
        variant="ghost"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={18} aria-hidden />
      </IconButton>
      <output aria-live="polite" className="min-w-8 text-center text-lg font-bold tabular-nums">
        {value}
      </output>
      <IconButton label="Aumentar quantidade" variant="ghost" onClick={() => onChange(value + 1)}>
        <Plus size={18} aria-hidden />
      </IconButton>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-muted">{label}</span>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  )
}

export const inputClass =
  'min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-fg placeholder:text-muted/70 outline-none transition focus:border-accent/60'

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className="h-1 w-full overflow-hidden rounded-full bg-surface"
    >
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Painel modal: tela cheia no celular, centralizado no desktop. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  headerExtra,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  headerExtra?: ReactNode
}) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center md:p-6">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="sheet-up flex h-[100dvh] w-full flex-col bg-bg outline-none md:h-[min(860px,92dvh)] md:max-w-xl md:rounded-3xl md:border md:border-line"
      >
        <header className="flex items-center gap-3 px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))]">
          <h2 id={titleId} className="flex-1 text-xl font-extrabold tracking-tight">
            {title}
          </h2>
          {headerExtra}
          <IconButton label="Fechar" onClick={onClose}>
            <X size={20} aria-hidden />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">{children}</div>
        {footer && (
          <div className="border-t border-line bg-bg px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 md:rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  danger,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])
  if (!open) return null
  return (
    <div className="fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-3xl border border-line bg-[#16161E] p-6"
      >
        <h2 id={titleId} className="text-lg font-extrabold">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-relaxed text-muted">{message}</div>
        <div className="mt-6 flex gap-3">
          <Button ref={cancelRef} variant="surface" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger' : 'accent'} className="flex-1" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border border-line bg-surface text-muted">
        {icon}
      </div>
      <p className="text-lg font-bold">{title}</p>
      {children && <div className="max-w-xs text-sm leading-relaxed text-muted">{children}</div>}
    </div>
  )
}
