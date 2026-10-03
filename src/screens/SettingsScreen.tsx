import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, LogOut, Upload } from 'lucide-react'
import { Button, ConfirmDialog, IconButton } from '../components/ui'
import { useCollection } from '../hooks/useCollection'
import { goBack } from '../hooks/useRoute'
import { useToast } from '../hooks/useToast'
import { downloadJson, makeBackup, parseBackup } from '../lib/backup'
import { cx } from '../lib/cx'
import { supabase } from '../lib/supabase'
import type { Card } from '../lib/types'

export function SettingsScreen() {
  const { cards, collection, importCards, online } = useCollection()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<{ cards: Card[]; file: string } | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [busy, setBusy] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => active && setEmail(data.session?.user.email ?? null))
    return () => {
      active = false
    }
  }, [])

  function exportBackup() {
    const date = new Date().toISOString().slice(0, 10)
    downloadJson(makeBackup(collection, cards), `fichario-pokemon-${date}.json`)
    toast.show('Backup exportado', 'success')
  }

  async function readFile(file: File | undefined) {
    if (!file) return
    try {
      const parsed = parseBackup(await file.text())
      if (parsed.length === 0) throw new Error('vazio')
      setMode('merge')
      setPendingImport({ cards: parsed, file: file.name })
    } catch {
      toast.show('Arquivo de backup inválido', 'error')
    }
  }

  async function runImport() {
    if (!pendingImport) return
    setBusy(true)
    try {
      const n = await importCards(pendingImport.cards, mode)
      toast.show(
        mode === 'replace'
          ? `Coleção substituída (${n} registros)`
          : `${n} ${n === 1 ? 'registro importado' : 'registros importados'}`,
        'success',
      )
      setPendingImport(null)
    } catch (e) {
      console.error(e)
      toast.show(e instanceof Error ? e.message : 'Falha ao importar o backup', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-[max(16px,env(safe-area-inset-top))] md:px-8">
      <div className="flex items-center pt-1">
        <IconButton label="Voltar" variant="ghost" className="-ml-2" onClick={() => goBack({ name: 'collection' })}>
          <ArrowLeft size={22} aria-hidden />
        </IconButton>
      </div>
      <h1 className="screen-title mt-1">Configurações</h1>
      {email && <p className="mt-1.5 text-[15px] text-muted">Conectado como {email}</p>}

      <section className="mt-8 flex flex-col gap-3" aria-labelledby="backup-title">
        <h2 id="backup-title" className="text-sm font-bold uppercase tracking-wider text-muted">
          Backup
        </h2>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm leading-relaxed text-muted">
            O backup é um arquivo JSON com todos os dados das cartas. As fotos próprias continuam no Supabase e não
            entram no arquivo.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={exportBackup} disabled={cards.length === 0}>
              <Download size={18} aria-hidden /> Exportar backup
            </Button>
            <Button variant="surface" className="flex-1" onClick={() => fileInput.current?.click()} disabled={!online}>
              <Upload size={18} aria-hidden /> Importar backup
            </Button>
          </div>
          {!online && <p className="mt-2 text-xs text-muted">Importar exige conexão com a internet.</p>}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void readFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-3" aria-labelledby="account-title">
        <h2 id="account-title" className="text-sm font-bold uppercase tracking-wider text-muted">
          Conta
        </h2>
        <Button variant="danger" onClick={() => setConfirmLogout(true)}>
          <LogOut size={18} aria-hidden /> Sair
        </Button>
      </section>

      <p className="mt-10 text-center text-xs leading-relaxed text-muted">
        Artes e dados das cartas: TCGdex. Preços: LigaPokemon (abre no site deles).
      </p>

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="Importar backup"
        confirmLabel={busy ? 'Importando…' : 'Importar'}
        danger={mode === 'replace'}
        onCancel={() => !busy && setPendingImport(null)}
        onConfirm={() => void runImport()}
        message={
          <div className="flex flex-col gap-3">
            <p>
              {pendingImport?.file}: {pendingImport?.cards.length} registros.
            </p>
            <div role="radiogroup" aria-label="Modo de importação" className="flex flex-col gap-2">
              {(
                [
                  ['merge', 'Mesclar', 'Adiciona o que falta e atualiza com a versão mais recente.'],
                  ['replace', 'Substituir', 'Apaga a coleção atual e usa só o backup.'],
                ] as const
              ).map(([key, label, desc]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={mode === key}
                  onClick={() => setMode(key)}
                  className={cx(
                    'rounded-2xl border p-3 text-left transition',
                    mode === key ? 'border-accent bg-accent/10' : 'border-line bg-surface',
                  )}
                >
                  <span className="block font-bold text-fg">{label}</span>
                  <span className="block text-xs">{desc}</span>
                </button>
              ))}
            </div>
          </div>
        }
      />

      <ConfirmDialog
        open={confirmLogout}
        title="Sair da conta?"
        message="A coleção salva neste aparelho continua guardada para quando você entrar de novo."
        confirmLabel="Sair"
        danger
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false)
          void supabase.auth.signOut()
        }}
      />
    </main>
  )
}
