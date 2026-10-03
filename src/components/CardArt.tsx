import { useState, type ReactNode } from 'react'
import { ImageOff } from 'lucide-react'
import { useLongPress } from '../hooks/useLongPress'
import { usePhotoUrl } from '../hooks/usePhotoUrl'
import { cx } from '../lib/cx'

interface CardArtProps {
  name: string
  number?: string | null
  total?: string | null
  /** Imagem da carta no repositório da LigaPokemon */
  ligaImage?: string | null
  /** Foto própria salva no aparelho (cartas antigas); usada quando não há imagem da Liga */
  photoPath?: string | null
  /** Link aberto ao tocar (nova aba) */
  href?: string
  hrefLabel?: string
  onLongPress?: () => void
  onClick?: () => void
  /** Sombra suave sob a carta */
  shadow?: 'soft' | 'none'
  missing?: boolean
  className?: string
  /** Imagem decorativa (o texto ao lado já descreve a carta) */
  decorative?: boolean
  children?: ReactNode
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
  ligaImage,
  photoPath,
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
  const src = ligaImage ?? photo.url
  const [loaded, setLoaded] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  // O repositório de imagens às vezes falha numa requisição: tenta mais uma vez.
  const [retried, setRetried] = useState<string | null>(null)
  const shownSrc = src && retried === src ? `${src}${src.includes('?') ? '&' : '?'}tentativa=2` : src
  const longPress = useLongPress(() => onLongPress?.())

  const isLoaded = src !== null && loaded === src
  const isFailed = src !== null && failed === src
  const waitingPhoto = !ligaImage && photo.loading

  const boxShadow =
    shadow === 'soft' && isLoaded && !missing
      ? '0 14px 28px -8px rgba(0,0,0,0.6), 0 4px 10px rgba(0,0,0,0.3)'
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
                if (retried !== src && !src.startsWith('blob:')) window.setTimeout(() => setRetried(src), 800)
                else setFailed(src)
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
