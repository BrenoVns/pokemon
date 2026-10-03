import { useCallback, useRef } from 'react'

/**
 * Pressionar e segurar (~450ms) dispara onLongPress e cancela o clique seguinte,
 * para que a arte abra a Liga no toque e o detalhe ao segurar.
 */
export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<number | null>(null)
  const fired = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }, [])

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      clear()
      timer.current = window.setTimeout(() => {
        fired.current = true
        navigator.vibrate?.(10)
        onLongPress()
      }, ms)
    },
    onPointerMove: (e: React.PointerEvent) => {
      // Rolar a tela não deve contar como "segurar".
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault()
        e.stopPropagation()
        fired.current = false
      }
    },
  }
}
