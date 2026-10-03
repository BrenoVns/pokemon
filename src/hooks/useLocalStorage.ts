import { useCallback, useState } from 'react'

/** Estado simples persistido no localStorage (só para valores de texto). */
export function useLocalStorage<T extends string>(key: string, initial: T, allowed?: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(key) as T | null
      if (v !== null && (!allowed || allowed.includes(v))) return v
    } catch {
      // indisponível
    }
    return initial
  })
  const update = useCallback(
    (v: T) => {
      setValue(v)
      try {
        localStorage.setItem(key, v)
      } catch {
        // indisponível
      }
    },
    [key],
  )
  return [value, update] as const
}
