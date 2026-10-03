import { useEffect, useState } from 'react'
import { dominantColor } from '../lib/image'

/** "r, g, b" da cor dominante, ou null (o chamador usa sombra neutra). */
export function useDominantColor(src: string | null | undefined, enabled = true) {
  const [result, setResult] = useState<{ src: string; color: string | null } | null>(null)
  useEffect(() => {
    if (!src || !enabled) return
    let active = true
    dominantColor(src).then((color) => active && setResult({ src, color }))
    return () => {
      active = false
    }
  }, [src, enabled])
  return result && result.src === src ? result.color : null
}
