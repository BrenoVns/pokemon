import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'anon-key-ausente', {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const PHOTO_BUCKET = 'card-photos'

/** Endereço para onde o link mágico volta (raiz do app, com o base do Vite). */
export function appUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}
