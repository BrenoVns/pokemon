import { useCallback, useState } from 'react'
import { CollectionProvider } from './components/CollectionProvider'
import { ToastProvider } from './components/ToastProvider'
import { BottomNav } from './components/BottomNav'
import { AddCardSheet } from './components/AddCardSheet'
import { AddSheetContext, type AddSheetOptions } from './hooks/useAddSheet'
import { navigate, useRoute } from './hooks/useRoute'
import { useCollection } from './hooks/useCollection'
import { useToast } from './hooks/useToast'
import { CollectionScreen } from './screens/CollectionScreen'
import { SetsScreen } from './screens/SetsScreen'
import { SetDetailScreen } from './screens/SetDetailScreen'
import { CardDetailScreen } from './screens/CardDetailScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export function App() {
  return (
    <ToastProvider>
      <CollectionProvider>
        <Shell />
      </CollectionProvider>
    </ToastProvider>
  )
}

function Shell() {
  const route = useRoute()
  const [addOpts, setAddOpts] = useState<AddSheetOptions | null>(null)
  const { collection, loading } = useCollection()
  const toast = useToast()
  const openAdd = useCallback(
    (opts?: AddSheetOptions) => {
      if (!loading && !collection) {
        toast.show('Crie uma coleção antes de adicionar cartas', 'info')
        navigate({ name: 'collection' }, true)
        return
      }
      setAddOpts(opts ?? {})
    },
    [collection, loading, toast],
  )
  const closeAdd = useCallback(() => setAddOpts(null), [])

  return (
    <AddSheetContext.Provider value={openAdd}>
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
