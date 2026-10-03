import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Loader2, PenLine, Search } from 'lucide-react'
import { useCollection } from '../hooks/useCollection'
import { useToast } from '../hooks/useToast'
import type { AddSheetOptions } from '../hooks/useAddSheet'
import { cx } from '../lib/cx'
import { loadCatalog, searchCatalog, type Catalog, type LigaCard } from '../lib/ligaCatalog'
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
import { Button, Field, PillChoice, Segmented, Sheet, Stepper, inputClass } from './ui'

const MAX_RESULTS = 90

type Step = 'search' | 'form'

/** Identidade da carta a partir do catálogo da Liga. */
function ligaIdentity(card: LigaCard): CardIdentity {
  return {
    tcgdex_id: null,
    name: card.name,
    name_en: card.name,
    liga_image: card.image,
    set_id: `liga:${card.edition.id}`,
    set_name: card.edition.name,
    card_number: card.num,
    set_total: card.total,
    image_url: null,
  }
}

export function AddCardSheet({ options, onClose }: { options: AddSheetOptions; onClose: () => void }) {
  const { addCard } = useCollection()
  const toast = useToast()

  const from = options.from
  const [step, setStep] = useState<Step>(options.liga || from ? 'form' : 'search')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogState, setCatalogState] = useState<'loading' | 'ok' | 'none'>('loading')
  const [selected, setSelected] = useState<CardIdentity | null>(
    from ?? (options.liga ? ligaIdentity(options.liga) : null),
  )
  const fromManual = Boolean(from && !from.set_id?.startsWith('liga:'))
  const [manual, setManual] = useState(fromManual)

  const [quantity, setQuantity] = useState(1)
  const [condition, setCondition] = useState<Condition>(from?.condition ?? 'NM')
  const [language, setLanguage] = useState<Language>(from?.language ?? 'PT')
  const [variant, setVariant] = useState<Variant>(from?.variant ?? 'Normal')
  const [ligaUrl, setLigaUrl] = useState(from?.liga_url ?? options.liga?.url ?? '')
  const [saving, setSaving] = useState(false)

  // Cadastro manual
  const [mName, setMName] = useState(fromManual && from ? from.name : '')
  const [mSet, setMSet] = useState(fromManual && from ? (from.set_name ?? '') : '')
  const [mNumber, setMNumber] = useState(fromManual && from ? (from.card_number ?? '') : '')
  const [mTotal, setMTotal] = useState(fromManual && from ? (from.set_total ?? '') : '')

  const searchInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'search') searchInput.current?.focus()
  }, [step])

  useEffect(() => {
    let active = true
    loadCatalog().then((c) => {
      if (!active) return
      setCatalog(c)
      setCatalogState(c ? 'ok' : 'none')
    })
    return () => {
      active = false
    }
  }, [])

  function chooseLiga(card: LigaCard) {
    setSelected(ligaIdentity(card))
    setLigaUrl(card.url)
    setManual(false)
    setStep('form')
  }

  const identity: CardIdentity | null = manual
    ? mName.trim()
      ? {
          tcgdex_id: null,
          name: mName.trim(),
          name_en: null,
          set_id: null,
          set_name: mSet.trim() || null,
          card_number: mNumber.trim() || null,
          set_total: mTotal.trim() || null,
          image_url: null,
        }
      : null
    : selected
  const canSave = Boolean(identity) && !saving

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
          liga_url: manual ? null : ligaUrl.trim() || null,
          notes: from?.notes ?? null,
        },
        null,
      )
      toast.show(merged ? 'Já estava na coleção: quantidade somada' : 'Carta salva na coleção', 'success')
      onClose()
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Não foi possível salvar', 'error')
      setSaving(false)
    }
  }

  const { results, total } = useMemo(() => {
    if (!catalog || deferredQuery.trim().length < 2) return { results: [], total: 0 }
    const all = searchCatalog(catalog, deferredQuery)
    return { results: all.slice(0, MAX_RESULTS), total: all.length }
  }, [catalog, deferredQuery])
  const typed = query.trim().length >= 2

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
          <div className="relative">
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
          <p className="-mt-2 text-xs text-muted">
            A Liga usa os nomes em inglês. Para treinadores e itens, busque em inglês (ex.: Professor&apos;s Research).
          </p>

          {catalogState === 'none' ? (
            <p className="py-6 text-center text-sm text-danger">
              Não foi possível carregar o catálogo de cartas. Verifique a conexão e abra de novo.
            </p>
          ) : catalogState === 'loading' && typed ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-busy="true" aria-label="Carregando catálogo">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="skeleton aspect-[63/88] rounded-[var(--radius-card)]" />
              ))}
            </div>
          ) : results.length > 0 ? (
            <section aria-label="Resultados" className="flex flex-col gap-3">
              <ul
                className={cx(
                  'grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4',
                  query !== deferredQuery && 'opacity-60',
                )}
              >
                {results.map((card) => (
                  <li key={card.url} className="min-w-0">
                    <CardArt
                      name={card.name}
                      number={card.num}
                      total={card.total}
                      ligaImage={card.image}
                      onClick={() => chooseLiga(card)}
                      hrefLabel={`Selecionar ${card.label}, ${card.edition.name}`}
                    />
                    <p className="mt-1.5 truncate text-xs font-semibold">{card.edition.name}</p>
                    <p className="truncate text-xs tabular-nums text-muted">
                      {card.total ? `${card.num}/${card.total}` : `nº ${card.num}`}
                    </p>
                  </li>
                ))}
              </ul>
              {total > MAX_RESULTS && (
                <p className="text-center text-xs text-muted">
                  Mostrando {MAX_RESULTS} de {total}. Refine a busca (ex.: &quot;Pikachu ex&quot;).
                </p>
              )}
            </section>
          ) : typed ? (
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
                <span className="text-sm font-semibold text-muted">Edição</span>
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
                <span className="text-sm font-semibold text-muted">Total da edição</span>
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
                  ligaImage={selected.liga_image}
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
        </div>
      )}
    </Sheet>
  )
}
