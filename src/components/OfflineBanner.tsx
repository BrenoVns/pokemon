import { CloudOff, RefreshCw } from 'lucide-react'
import { useCollection } from '../hooks/useCollection'

export function OfflineBanner() {
  const { online, pending } = useCollection()
  if (online && pending === 0) return null
  return (
    <div className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-[#16161E] px-4 pb-2 pt-[max(8px,env(safe-area-inset-top))] text-xs font-semibold text-muted">
      {online ? (
        <>
          <RefreshCw size={14} className="animate-spin" aria-hidden /> Sincronizando {pending}{' '}
          {pending === 1 ? 'alteração' : 'alterações'}…
        </>
      ) : (
        <>
          <CloudOff size={14} aria-hidden /> Offline — mostrando a coleção salva
          {pending > 0 && ` · ${pending} ${pending === 1 ? 'alteração pendente' : 'alterações pendentes'}`}
        </>
      )}
    </div>
  )
}
