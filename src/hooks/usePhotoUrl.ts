import { useEffect, useState } from 'react'
import { getPhotoUrl } from '../lib/photos'

/** URL local (blob:) da foto própria, baixada do Storage privado e guardada offline. */
export function usePhotoUrl(path: string | null | undefined) {
  const [state, setState] = useState<{ path: string; url: string | null; failed: boolean } | null>(null)

  useEffect(() => {
    if (!path) return
    let active = true
    getPhotoUrl(path)
      .then((url) => active && setState({ path, url, failed: false }))
      .catch(() => active && setState({ path, url: null, failed: true }))
    return () => {
      active = false
    }
  }, [path])

  const current = path && state?.path === path ? state : null
  return { url: current?.url ?? null, loading: Boolean(path) && !current, failed: current?.failed ?? false }
}
