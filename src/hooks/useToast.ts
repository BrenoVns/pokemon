import { createContext, useContext } from 'react'

export type ToastKind = 'error' | 'success' | 'info'

export interface ToastApi {
  show: (message: string, kind?: ToastKind) => void
}

export const ToastContext = createContext<ToastApi>({ show: () => {} })

export function useToast(): ToastApi {
  return useContext(ToastContext)
}
