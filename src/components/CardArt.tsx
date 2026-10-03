import { useState, type ReactNode } from 'react'
import { ImageOff } from 'lucide-react'
import { useDominantColor } from '../hooks/useDominantColor'
import { useLongPress } from '../hooks/useLongPress'
import { usePhotoUrl } from '../hooks/usePhotoUrl'
import { cx } from '../lib/cx'
import { imageUrl } from '../lib/tcgdex'

interface CardArtProps {
  name: string
  number?: string | null
  total?: string | null
  /** URL base do TCGdex */
  image?: string | null
  /** Imagem da LigaPokemon (tem prioridade; o TCGdex fica de reserva) */
  ligaImage?: string | null
  /** Caminho da foto própria no Storage */
  photoPath?: string | null
  /** 'official' prefere a arte do TCGdex; 'photo' prefere a foto própria */
  prefer?: 'official' | 'photo'
  quality?: 'low' | 'high'
  /** Link aberto ao tocar (nova aba) */
  href?: string
  hrefLabel?: string
  onLongPress?: () => void
  onClick?: () => void
  shadow?: 'color' | 'none'
  missing?: boolean
  className?: string
  /** Imagem decorativa (o texto ao lado já descreve a carta) */
  decorative?: boolean
  children?: ReactNode
}

/** URLs para tentar em ordem: original, nova tentativa, e a mesma arte no outro idioma. */
function imageCandidates(src: string): string[] {
  if (!src.startsWith('https://assets.tcgdex.net/')) return [src]
  const alt = src.replace(
    /^(https:\/\/assets\.tcgdex\.net\/)(pt|en)\//,
    (_, host: string, lang: string) => `${host}${lang === 'pt' ? 'en' : 'pt'}/`,
  )
  const list = [src, `${src}?tentativa=2`]
  if (alt !== src) list.push(alt, `${alt}?tentativa=2`)
  return list
}

function Placeholder({ name, number, total }: { name: string; number?: string | null; total?: string | null }) {
  return (
    <div className="@container flex h-full w-full flex-col items-center justify-center gap-2 rounded-[inherit] border border-line bg-[#15151D] p-3 text-center">
      <ImageOff size={20} className="shrink-0 text-muted/70" aria-hidden />
      <span className="hidden text-[13px] font-bold leading-tight @[90px]:line-clamp-3">{name}</span>
      {number && (
        <span className="hidden text-xs font-semibold tabular-nums text-muted @[90px]:block">
          {total ? `${number}/${total}` : number}
        </span>
      )}
    </div>
  )
}

export function CardArt({
  name,
  number,
  total,
  image,
  ligaImage,
  photoPath,
  prefer = 'official',
  quality = 'low',
  href,
  hrefLabel,
  onLongPress,
  onClick,
  shadow = 'none',
  missing,
  className,
  decorative,
  children,
}: CardArtProps) {
  const photo = usePhotoUrl(photoPath)
  const tcgdex = imageUrl(image, quality)
  const official = ligaImage ?? tcgdex
  const src = prefer === 'photo' ? (photo.url ?? official) : (official ?? photo.url)
  const [loaded, setLoaded] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  // O servidor de imagens do TCGdex às vezes responde 503: tentamos de novo e,
  // se continuar falhando, usamos a mesma arte no outro idioma.
  const [attempt, setAttempt] = useState<{ src: string; index: number } | null>(null)
  // Liga primeiro; se falhar, as artes do TCGdex.
  const candidates =
    src === official && official
      ? [...(ligaImage ? [ligaImage] : []), ...(tcgdex ? imageCandidates(tcgdex) : [])]
      : src
        ? [src]
        : []
  const attemptIndex = attempt && attempt.src === src ? attempt.index : 0
  const shownSrc = candidates[attemptIndex] ?? src
  // A cor sai sempre da versão leve (já em cache pela grade).
  const color = useDominantColor(imageUrl(image, 'low'), shadow === 'color' && !missing)
  const longPress = useLongPress(() => onLongPress?.())

  const isLoaded = src !== null && loaded === src
  const isFailed = src !== null && failed === src
  const waitingPhoto = !official && photo.loading

  const boxShadow =
    shadow === 'color' && isLoaded && !missing
      ? color
        ? `0 14px 28px -8px rgba(${color}, 0.55), 0 4px 10px rgba(0,0,0,0.35)`
        : '0 14px 28px -8px rgba(0,0,0,0.6)'
      : undefined

  const content = (
    <>
      {(!src || isFailed) && !waitingPhoto ? (
        <Placeholder name={name} number={number} total={total} />
      ) : (
        <>
          {!isLoaded && <div className="skeleton absolute inset-0" aria-hidden />}
          {src && (
            <img
              key={shownSrc}
              src={shownSrc ?? undefined}
              alt={decorative ? '' : name}
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={() => setLoaded(src)}
              onError={() => {
                if (attemptIndex + 1 < candidates.length) {
                  window.setTimeout(() => setAttempt({ src, index: attemptIndex + 1 }), 700 * (attemptIndex + 1))
                } else setFailed(src)
              }}
              className={cx(
                'h-full w-full object-cover transition-opacity duration-300',
                isLoaded ? 'opacity-100' : 'opacity-0',
                missing && 'grayscale',
              )}
            />
          )}
        </>
      )}
      {children}
    </>
  )

  const base = cx(
    'no-callout relative block aspect-[63/88] w-full overflow-hidden rounded-[var(--radius-card)] bg-surface transition-transform',
    (href || onClick) && 'active:scale-[0.97]',
    className,
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={hrefLabel ?? `Ver ${name} na LigaPokemon`}
        className={base}
        style={{ boxShadow }}
        {...(onLongPress ? longPress : {})}
      >
        {content}
      </a>
    )
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={hrefLabel ?? name}
        className={cx(base, 'text-left')}
        style={{ boxShadow }}
      >
        {content}
      </button>
    )
  }
  return (
    <div className={base} style={{ boxShadow }}>
      {content}
    </div>
  )
}
