import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Loader2, PenLine, Search } from 'lucide-react'
import { useCollection } from '../hooks/useCollection'
import { useToast } from '../hooks/useToast'
import type { AddSheetOptions } from '../hooks/useAddSheet'
import { cx } from '../lib/cx'
import { isValidUrl } from '../lib/liga'
import {
  getCard,
  getSets,
  searchCards,
  setIdFromCardId,
  type SearchResult,
  type TcgCardBrief,
  type TcgLang,
  type TcgSetBrief,
} from '../lib/tcgdex'
import {
  CONDITION_LABELS,
  CONDITIONS,
  LANGUAGES,
  VARIANTS,
  type CardIdentity,
  type Condition,
  type Language,
  type Variant,
} from '../lib/types'
import { CardArt } from './CardArt'
import { PhotoPicker } from './PhotoPicker'
import { Button, Field, PillChoice, Segmented, Sheet, Stepper, inputClass } from './ui'

const MAX_RESULTS = 90

type Step = 'search' | 'form'

export function AddCardSheet({ options, onClose }: { options: AddSheetOptions; onClose: () => void }) {
  const { addCard } = useCollection()
  const toast = useToast()

  const from = options.from
  const [step, setStep] = useState<Step>(options.tcgdexId || from ? 'form' : 'search')
  const [lang, setLang] = useState<TcgLang>('pt')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<(SearchResult & { query: string }) | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [setNames, setSetNames] = useState<Map<string, TcgSetBrief>>(new Map())

  const [selected, setSelected] = useState<CardIdentity | null>(from ?? null)
  const [selectingId, setSelectingId] = useState<string | null>(options.tcgdexId ?? null)
  const [manual, setManual] = useState(Boolean(from && !from.tcgdex_id))

  const [quantity, setQuantity] = useState(1)
  const [condition, setCondition] = useState<Condition>(from?.condition ?? 'NM')
  const [language, setLanguage] = useState<Language>(from?.language ?? 'PT')
  const [variant, setVariant] = useState<Variant>(from?.variant ?? 'Normal')
  const [ligaUrl, setLigaUrl] = useState(from?.liga_url ?? '')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [saving, setSaving] = useState(false)

  // Cadastro manual
  const [mName, setMName] = useState(from && !from.tcgdex_id ? from.name : '')
  const [mSet, setMSet] = useState(from && !from.tcgdex_id ? (from.set_name ?? '') : '')
  const [mNumber, setMNumber] = useState(from && !from.tcgdex_id ? (from.card_number ?? '') : '')
  const [mTotal, setMTotal] = useState(from && !from.tcgdex_id ? (from.set_total ?? '') : '')

  const searchInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'search') searchInput.current?.focus()
  }, [step])

  // Nomes dos sets para exibir nos resultados
  useEffect(() => {
    let active = true
    getSets(result?.lang ?? lang)
      .then((m) => active && setSetNames(m))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [lang, result?.lang])

  // Busca com debounce
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    let active = true
    const t = window.setTimeout(() => {
      setSearching(true)
      setSearchError(false)
      searchCards(q, lang)
        .then((r) => active && setResult({ ...r, query: q }))
        .catch(() => active && setSearchError(true))
        .finally(() => active && setSearching(false))
    }, 350)
    return () => {
      active = false
      window.clearTimeout(t)
    }
  }, [query, lang])

  // Carta pré-selecionada (ex.: "+" numa carta faltante do set)
  useEffect(() => {
    if (!options.tcgdexId) return
    void choose({ id: options.tcgdexId, localId: '', name: '', image: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na abertura
  }, [])

  async function choose(brief: TcgCardBrief) {
    setSelectingId(brief.id)
    try {
      const card = await getCard(brief.id, result?.lang ?? lang)
      if (!card) throw new Error('Carta não encontrada')
      setSelected({
        tcgdex_id: card.id,
        name: card.name,
        set_id: card.set.id,
        set_name: card.set.name,
        card_number: card.localId,
        set_total: card.set.official ? String(card.set.official) : null,
        image_url: card.image,
      })
    } catch {
      if (!brief.name) {
        toast.show('Não foi possível carregar a carta. Verifique a conexão.', 'error')
        setStep('search')
        setSelectingId(null)
        return
      }
      // Sem detalhe (offline): usa o que a busca já trouxe.
      const setId = setIdFromCardId(brief.id)
      const set = setNames.get(setId)
      setSelected({
        tcgdex_id: brief.id,
        name: brief.name,
        set_id: setId,
        set_name: set?.name ?? setId,
        card_number: brief.localId,
        set_total: set?.official ? String(set.official) : null,
        image_url: brief.image,
      })
    }
    setManual(false)
    setSelectingId(null)
    setStep('form')
  }

  const ligaInvalid = ligaUrl.trim() !== '' && !isValidUrl(ligaUrl)
  const identity: CardIdentity | null = manual
    ? mName.trim()
      ? {
          tcgdex_id: null,
          name: mName.trim(),
          set_id: null,
          set_name: mSet.trim() || null,
          card_number: mNumber.trim() || null,
          set_total: mTotal.trim() || null,
          image_url: null,
        }
      : null
    : selected
  const canSave = Boolean(identity) && !ligaInvalid && !saving && !selectingId

  async function save() {
    if (!identity || !canSave) return
    setSaving(true)
    try {
      const { merged } = await addCard(
        {
          ...identity,
          quantity,
          condition,
          language,
          variant,
          liga_url: ligaUrl.trim() || null,
          notes: notes.trim() || null,
        },
        photo,
      )
      toast.show(merged ? 'Já estava na coleção: quantidade somada' : 'Carta salva na coleção', 'success')
      onClose()
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Não foi possível salvar', 'error')
      setSaving(false)
    }
  }

  const shown = useMemo(
    () => (query.trim().length >= 2 ? (result?.cards.slice(0, MAX_RESULTS) ?? []) : []),
    [result, query],
  )

  const title = from ? 'Duplicar carta' : 'Adicionar carta'

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        step === 'form' ? (
          <Button className="w-full" disabled={!canSave} onClick={save}>
            {saving ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
            Salvar na coleção
          </Button>
        ) : undefined
      }
    >
      {step === 'search' ? (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                ref={searchInput}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome da carta (ex.: Gengar ex)"
                aria-label="Buscar carta por nome"
                className={cx(inputClass, 'pl-11')}
              />
            </div>
            <div className="w-[112px] shrink-0">
              <Segmented
                label="Idioma da busca"
                options={['PT', 'EN'] as const}
                value={lang === 'pt' ? 'PT' : 'EN'}
                onChange={(v) => setLang(v === 'PT' ? 'pt' : 'en')}
              />
            </div>
          </div>

          {result?.fellBack && query.trim() === result.query && (
            <p className="text-sm text-muted">Nada em português — mostrando resultados em inglês.</p>
          )}
          {searchError && <p className="text-sm text-danger">Não foi possível buscar. Verifique a conexão.</p>}

          {searching && shown.length === 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-busy="true" aria-label="Buscando">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="skeleton aspect-[63/88] rounded-[var(--radius-card)]" />
              ))}
            </div>
          ) : shown.length > 0 ? (
            <>
              <ul className={cx('grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4', searching && 'opacity-60')}>
                {shown.map((c) => {
                  const setId = setIdFromCardId(c.id)
                  const isSel = selectingId === c.id || selected?.tcgdex_id === c.id
                  return (
                    <li key={c.id} className="min-w-0">
                      <CardArt
                        name={c.name}
                        number={c.localId}
                        image={c.image}
                        onClick={() => void choose(c)}
                        hrefLabel={`Selecionar ${c.name} ${c.localId}`}
                        className={cx(isSel && 'ring-[3px] ring-accent ring-offset-2 ring-offset-bg')}
                      >
                        {selectingId === c.id && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <Loader2 size={22} className="animate-spin" aria-hidden />
                          </span>
                        )}
                      </CardArt>
                      <p className="mt-1.5 truncate text-xs font-semibold">{setNames.get(setId)?.name ?? setId}</p>
                      <p className="truncate text-xs tabular-nums text-muted">nº {c.localId}</p>
                    </li>
                  )
                })}
              </ul>
              {(result?.cards.length ?? 0) > MAX_RESULTS && (
                <p className="text-center text-xs text-muted">
                  Mostrando {MAX_RESULTS} de {result!.cards.length}. Refine a busca para encontrar mais rápido.
                </p>
              )}
            </>
          ) : query.trim().length >= 2 && result && !searching ? (
            <p className="py-6 text-center text-sm text-muted">Nenhuma carta encontrada com esse nome.</p>
          ) : (
            <p className="py-6 text-center text-sm text-muted">Digite pelo menos 2 letras do nome da carta.</p>
          )}

          <button
            type="button"
            onClick={() => {
              setManual(true)
              setMName(query.trim())
              setStep('form')
            }}
            className="mx-auto mt-2 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-accent hover:bg-surface"
          >
            <PenLine size={16} aria-hidden /> Carta não encontrada? Cadastrar manualmente
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {!from && (
            <button
              type="button"
              onClick={() => {
                setStep('search')
                setManual(false)
              }}
              className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-muted hover:text-fg"
            >
              <ArrowLeft size={16} aria-hidden /> Voltar à busca
            </button>
          )}

          {manual ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 flex flex-col gap-2">
                <span className="text-sm font-semibold text-muted">Nome *</span>
                <input
                  className={inputClass}
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  placeholder="Gengar ex"
                />
              </label>
              <label className="col-span-2 flex flex-col gap-2">
                <span className="text-sm font-semibold text-muted">Set</span>
                <input
                  className={inputClass}
                  value={mSet}
                  onChange={(e) => setMSet(e.target.value)}
                  placeholder="Destinos de Paldea"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-muted">Número</span>
                <input
                  className={inputClass}
                  value={mNumber}
                  onChange={(e) => setMNumber(e.target.value)}
                  placeholder="154"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-muted">Total do set</span>
                <input
                  className={inputClass}
                  value={mTotal}
                  inputMode="numeric"
                  onChange={(e) => setMTotal(e.target.value)}
                  placeholder="128"
                />
              </label>
            </div>
          ) : selected ? (
            <div className="flex items-center gap-4">
              <div className="w-24 shrink-0">
                <CardArt
                  name={selected.name}
                  number={selected.card_number}
                  total={selected.set_total}
                  image={selected.image_url}
                  className="ring-[3px] ring-accent ring-offset-2 ring-offset-bg"
                />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-extrabold leading-tight">{selected.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {[
                    selected.set_name,
                    selected.card_number &&
                      (selected.set_total ? `${selected.card_number}/${selected.set_total}` : selected.card_number),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4" aria-busy="true">
              <div className="skeleton aspect-[63/88] w-24 rounded-[var(--radius-card)]" />
              <div className="flex-1">
                <div className="skeleton h-5 w-2/3 rounded-full" />
                <div className="skeleton mt-2 h-4 w-1/2 rounded-full" />
              </div>
            </div>
          )}

          <Field label="Quantidade">
            <div>
              <Stepper value={quantity} onChange={setQuantity} />
            </div>
          </Field>
          <Field label="Condição" hint={CONDITION_LABELS[condition]}>
            <Segmented
              label="Condição"
              options={CONDITIONS}
              value={condition}
              onChange={setCondition}
              titles={CONDITION_LABELS}
            />
          </Field>
          <Field label="Idioma">
            <Segmented label="Idioma" options={LANGUAGES} value={language} onChange={setLanguage} />
          </Field>
          <Field label="Variante">
            <PillChoice label="Variante" options={VARIANTS} value={variant} onChange={setVariant} />
          </Field>
          <Field
            label="Link da LigaPokemon (opcional)"
            hint={
              ligaInvalid ? (
                <span className="text-danger">Cole um link completo, começando com https://</span>
              ) : (
                'Sem link, o app monta automaticamente o endereço da carta na Liga pelo nome e número.'
              )
            }
          >
            <input
              type="url"
              inputMode="url"
              value={ligaUrl}
              onChange={(e) => setLigaUrl(e.target.value)}
              placeholder="https://www.ligapokemon.com.br/?view=cards/card&card=…"
              className={inputClass}
              aria-invalid={ligaInvalid}
            />
          </Field>
          <Field label="Foto própria (opcional)">
            <PhotoPicker value={photo} onChange={setPhoto} />
          </Field>
          <Field label="Notas">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Onde comprei, troca, observações…"
              className={cx(inputClass, 'py-3')}
            />
          </Field>
        </div>
      )}
    </Sheet>
  )
}
