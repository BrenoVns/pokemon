import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, HardDrive, Trash2, Upload } from 'lucide-react'
import { Button, ConfirmDialog, IconButton } from '../components/ui'
import { useCollection } from '../hooks/useCollection'
import { goBack } from '../hooks/useRoute'
import { useToast } from '../hooks/useToast'
import { lastBackupAt, makeBackup, parseBackup, saveBackupFile, type Backup } from '../lib/backup'
import { cx } from '../lib/cx'

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function SettingsScreen() {
  const { cards, collection, importBackup, clearAll } = useCollection()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<{ backup: Backup; file: string } | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [busy, setBusy] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [lastBackup, setLastBackup] = useState(lastBackupAt)
  const [storage, setStorage] = useState<{ usage: number; persisted: boolean } | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      const est = await navigator.storage?.estimate?.()
      const persisted = (await navigator.storage?.persisted?.()) ?? false
      if (active && est) setStorage({ usage: est.usage ?? 0, persisted })
    })()
    return () => {
      active = false
    }
  }, [cards])

  async function exportBackup() {
    setBusy(true)
    try {
      await saveBackupFile(await makeBackup(collection, cards))
      setLastBackup(lastBackupAt())
      toast.show('Backup exportado', 'success')
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) toast.show('Não foi possível exportar', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return
    try {
      const backup = parseBackup(await file.text())
      if (backup.cards.length === 0) throw new Error('vazio')
      setMode('merge')
      setPendingImport({ backup, file: file.name })
    } catch {
      toast.show('Arquivo de backup inválido', 'error')
    }
  }

  async function runImport() {
    if (!pendingImport) return
    setBusy(true)
    try {
      const n = await importBackup(pendingImport.backup, mode)
      toast.show(
        mode === 'replace'
          ? `Coleção substituída (${n} registros)`
          : n === 0
            ? 'Nada novo: a coleção já estava atualizada'
            : `${n} ${n === 1 ? 'registro importado' : 'registros importados'}`,
        'success',
      )
      setPendingImport(null)
    } catch (e) {
      console.error(e)
      toast.show('Falha ao importar o backup', 'error')
    } finally {
      setBusy(false)
    }
  }

  const lastLabel = lastBackup
    ? new Date(lastBackup).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'nunca'

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-[max(16px,env(safe-area-inset-top))] md:px-8">
      <div className="flex items-center pt-1">
        <IconButton label="Voltar" variant="ghost" className="-ml-2" onClick={() => goBack({ name: 'collection' })}>
          <ArrowLeft size={22} aria-hidden />
        </IconButton>
      </div>
      <h1 className="screen-title mt-1">Configurações</h1>

      <section className="mt-8 flex flex-col gap-3" aria-labelledby="backup-title">
        <h2 id="backup-title" className="text-sm font-bold uppercase tracking-wider text-muted">
          Backup
        </h2>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm leading-relaxed text-muted">
            Sua coleção fica guardada só neste aparelho. Exporte um backup de vez em quando e guarde o arquivo (Drive,
            iCloud, e-mail). Ele inclui as fotos e serve também para levar a coleção para outro aparelho.
          </p>
          <p className="mt-3 text-sm font-semibold">Último backup: {lastLabel}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => void exportBackup()} disabled={cards.length === 0 || busy}>
              <Download size={18} aria-hidden /> Exportar backup
            </Button>
            <Button variant="surface" className="flex-1" onClick={() => fileInput.current?.click()} disabled={busy}>
              <Upload size={18} aria-hidden /> Importar backup
            </Button>
          </div>
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

      {storage && (
        <section className="mt-8 flex flex-col gap-3" aria-labelledby="storage-title">
          <h2 id="storage-title" className="text-sm font-bold uppercase tracking-wider text-muted">
            Armazenamento
          </h2>
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
            <HardDrive size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
            <div className="leading-relaxed">
              <p className="font-semibold">{formatBytes(storage.usage)} usados neste aparelho</p>
              <p className="text-muted">
                {storage.persisted
                  ? 'Armazenamento protegido: o navegador não apaga os dados sozinho.'
                  : 'O navegador pode limpar os dados se faltar espaço. Instale o app na tela inicial e mantenha backups.'}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="mt-8 flex flex-col gap-3" aria-labelledby="reset-title">
        <h2 id="reset-title" className="text-sm font-bold uppercase tracking-wider text-muted">
          Recomeçar
        </h2>
        <Button variant="danger" onClick={() => setConfirmClear(true)} disabled={cards.length === 0 || busy}>
          <Trash2 size={18} aria-hidden /> Apagar todas as cartas
        </Button>
      </section>

      <ConfirmDialog
        open={confirmClear}
        danger
        title="Apagar todas as cartas?"
        message={`As ${cards.length} cartas e as suas fotos serão apagadas deste aparelho. Se quiser guardar, exporte um backup antes. Não dá para desfazer.`}
        confirmLabel="Apagar tudo"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false)
          void clearAll().then(() => toast.show('Coleção apagada. Pode começar de novo!', 'success'))
        }}
      />

      <p className="mt-10 text-center text-xs leading-relaxed text-muted">
        Cartas, imagens e preços: LigaPokemon (o preço abre no site deles).
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
              {pendingImport?.file}: {pendingImport?.backup.cards.length} registros
              {pendingImport && Object.keys(pendingImport.backup.photos).length > 0
                ? `, ${Object.keys(pendingImport.backup.photos).length} fotos`
                : ''}
              .
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
    </main>
  )
}
