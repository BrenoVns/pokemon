import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Check, Info } from 'lucide-react'
import { ToastContext, type ToastKind } from '../hooks/useToast'

interface Toast {
  id: number
  message: string
  kind: ToastKind
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++
    setToasts((t) => [...t.filter((x) => x.message !== message), { id, message, kind }].slice(-3))
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 3000)
  }, [])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))]"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-in pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl border border-line bg-[rgba(30,30,40,0.96)] px-4 py-3 text-sm font-semibold shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur"
          >
            {t.kind === 'error' ? (
              <AlertCircle size={18} className="shrink-0 text-[#FF8A8A]" aria-hidden />
            ) : t.kind === 'success' ? (
              <Check size={18} className="shrink-0 text-accent" aria-hidden />
            ) : (
              <Info size={18} className="shrink-0 text-muted" aria-hidden />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
