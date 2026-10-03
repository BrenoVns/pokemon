import { useCallback, useState } from 'react'
import { CollectionProvider } from './components/CollectionProvider'
import { ToastProvider } from './components/ToastProvider'
import { BottomNav } from './components/BottomNav'
import { AddCardSheet } from './components/AddCardSheet'
import { OfflineBanner } from './components/OfflineBanner'
import { AddSheetContext, type AddSheetOptions } from './hooks/useAddSheet'
import { useAuth } from './hooks/useAuth'
import { useRoute } from './hooks/useRoute'
import { isSupabaseConfigured } from './lib/supabase'
import { LoginScreen } from './screens/LoginScreen'
import { CollectionScreen } from './screens/CollectionScreen'
import { SetsScreen } from './screens/SetsScreen'
import { SetDetailScreen } from './screens/SetDetailScreen'
import { CardDetailScreen } from './screens/CardDetailScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export function App() {
  return (
    <ToastProvider>
      <AuthGate />
    </ToastProvider>
  )
}

function AuthGate() {
  const { session, ready } = useAuth()

  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6">
        <h1 className="screen-title">Quase lá</h1>
        <p className="text-muted">
          Configure as variáveis <code className="text-fg">VITE_SUPABASE_URL</code> e{' '}
          <code className="text-fg">VITE_SUPABASE_ANON_KEY</code> (veja o README) e gere o app novamente.
        </p>
      </main>
    )
  }
  if (!ready) return <div className="min-h-dvh bg-bg" aria-busy="true" />
  if (!session) return <LoginScreen />

  return (
    <CollectionProvider key={session.user.id} userId={session.user.id}>
      <Shell />
    </CollectionProvider>
  )
}

function Shell() {
  const route = useRoute()
  const [addOpts, setAddOpts] = useState<AddSheetOptions | null>(null)
  const openAdd = useCallback((opts?: AddSheetOptions) => setAddOpts(opts ?? {}), [])
  const closeAdd = useCallback(() => setAddOpts(null), [])

  return (
    <AddSheetContext.Provider value={openAdd}>
      <OfflineBanner />
      <div className="mx-auto w-full max-w-6xl">
        {route.name === 'collection' && <CollectionScreen />}
        {route.name === 'sets' && <SetsScreen />}
        {route.name === 'set' && <SetDetailScreen setKey={route.key} />}
        {route.name === 'card' && <CardDetailScreen id={route.id} />}
        {route.name === 'settings' && <SettingsScreen />}
      </div>
      {(route.name === 'collection' || route.name === 'sets' || route.name === 'set') && (
        <BottomNav active={route.name === 'collection' ? 'collection' : 'sets'} onAdd={() => openAdd()} />
      )}
      {addOpts && <AddCardSheet key={JSON.stringify(addOpts)} options={addOpts} onClose={closeAdd} />}
    </AddSheetContext.Provider>
  )
}
