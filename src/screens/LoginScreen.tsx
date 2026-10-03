import { useState, type FormEvent } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { Button, inputClass } from '../components/ui'
import { useToast } from '../hooks/useToast'
import { appUrl, supabase } from '../lib/supabase'

export function LoginScreen() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: appUrl(), shouldCreateUser: true },
    })
    setBusy(false)
    if (error)
      toast.show(
        error.message.includes('rate') ? 'Muitas tentativas. Aguarde um minuto.' : 'Não foi possível enviar o link',
        'error',
      )
    else setSent(true)
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) toast.show('Código inválido ou expirado', 'error')
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="mb-8 size-16 rounded-2xl" />
      <h1 className="screen-title">Fichário</h1>
      <p className="mt-2 text-muted">Sua coleção de cartas Pokémon, organizada e sempre à mão.</p>

      {!sent ? (
        <form onSubmit={sendLink} className="mt-10 flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-semibold text-muted">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <Button type="submit" disabled={busy} className="mt-2">
            <Mail size={18} aria-hidden />
            {busy ? 'Enviando…' : 'Entrar com link mágico'}
          </Button>
        </form>
      ) : (
        <div className="mt-10 flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed">
            Enviamos um link para <strong>{email}</strong>. Abra o e-mail neste aparelho e toque no link para entrar.
          </div>
          <form onSubmit={verifyCode} className="flex flex-col gap-3">
            <label htmlFor="code" className="text-sm font-semibold text-muted">
              Ou digite o código do e-mail (útil no app instalado no iPhone)
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className={`${inputClass} text-center text-xl font-bold tracking-[0.3em]`}
            />
            <Button type="submit" variant="surface" disabled={busy || code.length < 6}>
              Entrar com código
            </Button>
          </form>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-muted hover:text-fg"
          >
            <ArrowLeft size={16} aria-hidden /> Usar outro e-mail
          </button>
        </div>
      )}
    </main>
  )
}
