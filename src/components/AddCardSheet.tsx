import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Loader2, PenLine, Search } from 'lucide-react'
import { useCollection } from '../hooks/useCollection'
import { useToast } from '../hooks/useToast'
import type { AddSheetOptions } from '../hooks/useAddSheet'
import { cx } from '../lib/cx'
import { isValidUrl } from '../lib/liga'
import { findLigaCard, loadCatalog, plainNumber, searchCatalog, type Catalog, type LigaCard } from '../lib/ligaCatalog'
import { normalize } from '../lib/stats'
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

/** Identidade da carta a partir do catálogo da Liga (com a carta do TCGdex equivalente, se houver). */
function ligaIdentity(card: LigaCard, tcg: TcgCardBrief | null): CardIdentity {
  return {
    tcgdex_id: tcg?.id ?? null,
    name: tcg?.name ?? card.name,
    name_en: card.name,
    liga_image: card.image,
    set_id: `liga:${card.edition.id}`,
    set_name: card.edition.name,
    card_number: card.num,
    set_total: card.total,
    image_url: tcg?.image ?? null,
  }
}

const matchKey = (name: string, num: string | null | undefined) => `${normalize(name)}|${plainNumber(num)}`

export function AddCardSheet({ options, onClose }: { options: AddSheetOptions; onClose: () => void }) {
  const { addCard } = useCollection()
  const toast = useToast()

  const from = options.from
  const [step, setStep] = useState<Step>(options.tcgdexId || options.liga || from ? 'form' : 'search')
  const [lang, setLang] = useState<TcgLang>('pt')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<(SearchResult & { query: string }) | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [setNames, setSetNames] = useState<Map<string, TcgSetBrief>>(new Map())

  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogState, setCatalogState] = useState<'loading' | 'ok' | 'none'>('loading')
  const [selected, setSelected] = useState<CardIdentity | null>(
    from ?? (options.liga ? ligaIdentity(options.liga, null) : null),
  )
  const [selectingId, setSelectingId] = useState<string | null>(options.tcgdexId ?? null)
  const fromManual = Boolean(from && !from.tcgdex_id && !from.set_id?.startsWith('liga:'))
  const [manual, setManual] = useState(fromManual)

  const [quantity, setQuantity] = useState(1)
  const [condition, setCondition] = useState<Condition>(from?.condition ?? 'NM')
  const [language, setLanguage] = useState<Language>(from?.language ?? 'PT')
  const [variant, setVariant] = useState<Variant>(from?.variant ?? 'Normal')
  const [ligaUrl, setLigaUrl] = useState(from?.liga_url ?? options.liga?.url ?? '')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
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

  // Catálogo da Liga (fonte principal da busca)
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
      const identity: CardIdentity = {
        tcgdex_id: card.id,
        name: card.name,
        name_en: card.nameEn ?? brief.nameEn ?? null,
        set_id: card.set.id,
        set_name: card.set.name,
        card_number: card.localId,
        set_total: card.set.official ? String(card.set.official) : null,
        image_url: card.image,
      }
      // Achou a mesma carta no catálogo da Liga: usa a imagem e o link exato de lá.
      const liga = catalog ? findLigaCard(catalog, identity) : null
      if (liga) {
        identity.liga_image = liga.image
        setLigaUrl((v) => v || liga.url)
      }
      setSelected(identity)
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
        name_en: brief.nameEn ?? null,
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

  function chooseLiga(card: LigaCard, tcg: TcgCardBrief | null) {
    setSelected(ligaIdentity(card, tcg))
    setLigaUrl(card.url)
    setManual(false)
    setStep('form')
  }

  const ligaInvalid = ligaUrl.trim() !== '' && !isValidUrl(ligaUrl)
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

  // Resultados: catálogo da Liga primeiro; TCGdex só com o que a Liga não tem.
  const { ligaResults, tcgResults, ligaTotal } = useMemo(() => {
    const q = query.trim()
    if (q.length < 2) return { ligaResults: [], tcgResults: [], ligaTotal: 0 }
    const tcgCards = result && result.query === q ? result.cards : []
    // Busca em português: o TCGdex traduz para o nome em inglês usado pela Liga.
    const englishNames = tcgCards.map((c) => c.nameEn ?? '').filter(Boolean)
    const liga = catalog ? searchCatalog(catalog, q, englishNames) : []
    const tcgByKey = new Map<string, TcgCardBrief>()
    for (const c of tcgCards) {
      const total = setNames.get(setIdFromCardId(c.id))?.official
      tcgByKey.set(`${matchKey(c.nameEn ?? c.name, c.localId)}|${total ?? ''}`, c)
    }
    const used = new Set<TcgCardBrief>()
    const ligaResults = liga.slice(0, MAX_RESULTS).map((card) => {
      const tcg = tcgByKey.get(`${matchKey(card.name, card.num)}|${plainNumber(card.total)}`) ?? null
      if (tcg) used.add(tcg)
      return { card, tcg }
    })
    const ligaKeys = new Set(liga.map((c) => matchKey(c.name, c.num)))
    const tcgResults = tcgCards
      .filter((c) => !used.has(c) && !(catalog && ligaKeys.has(matchKey(c.nameEn ?? c.name, c.localId))))
      .slice(0, MAX_RESULTS)
    return { ligaResults, tcgResults, ligaTotal: liga.length }
  }, [query, result, catalog, setNames])
  const nothingYet = ligaResults.length === 0 && tcgResults.length === 0

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

          {searchError && <p className="text-sm text-danger">Não foi possível buscar. Verifique a conexão.</p>}

          {catalogState === 'none' && query.trim().length >= 2 && (
            <p className="text-xs text-muted">Catálogo da Liga indisponível agora — mostrando só o TCGdex.</p>
          )}

          {(searching || catalogState === 'loading') && nothingYet && query.trim().length >= 2 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-busy="true" aria-label="Buscando">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="skeleton aspect-[63/88] rounded-[var(--radius-card)]" />
              ))}
            </div>
          ) : !nothingYet ? (
            <>
              {ligaResults.length > 0 && (
                <section aria-label="Resultados da LigaPokemon" className="flex flex-col gap-3">
                  <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
                    {ligaResults.map(({ card, tcg }) => (
                      <li key={card.url} className="min-w-0">
                        <CardArt
                          name={card.name}
                          number={card.num}
                          total={card.total}
                          ligaImage={card.image}
                          image={tcg?.image}
                          onClick={() => chooseLiga(card, tcg)}
                          hrefLabel={`Selecionar ${card.label}, ${card.edition.name}`}
                        />
                        <p className="mt-1.5 truncate text-xs font-semibold">{card.edition.name}</p>
                        <p className="truncate text-xs tabular-nums text-muted">
                          {card.total ? `${card.num}/${card.total}` : `nº ${card.num}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                  {ligaTotal > MAX_RESULTS && (
                    <p className="text-center text-xs text-muted">
                      Mostrando {MAX_RESULTS} de {ligaTotal}. Refine a busca (ex.: "Pikachu ex").
                    </p>
                  )}
                </section>
              )}

              {tcgResults.length > 0 && (
                <section aria-label="Outras fontes" className={cx('flex flex-col gap-3', searching && 'opacity-60')}>
                  {ligaResults.length > 0 && (
                    <h3 className="mt-2 text-sm font-bold text-muted">Outras fontes (TCGdex)</h3>
                  )}
                  <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
                    {tcgResults.map((c) => {
                      const setId = setIdFromCardId(c.id)
                      const isSel = selectingId === c.id
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
                            {isSel && (
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
                </section>
              )}
            </>
          ) : query.trim().length >= 2 && !searching ? (
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
