// Utilidades de imagem: redimensionar fotos e extrair a cor dominante da arte.

const MAX_SIDE = 1200

/** Redimensiona para no máximo 1200px no maior lado e devolve JPEG. */
export async function resizeImage(file: File, maxSide = MAX_SIDE): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    source = await loadImage(URL.createObjectURL(file))
  }
  const w = source.width
  const h = source.height
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  if ('close' in source) source.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao comprimir a foto'))), 'image/jpeg', 0.85),
  )
}

function loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Falha ao carregar imagem'))
    img.src = src
  })
}

const colorCache = new Map<string, Promise<string | null>>()
const LS_KEY = 'fichario:colors'
let stored: Record<string, string> | null = null

function storedColors(): Record<string, string> {
  if (!stored) {
    try {
      stored = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as Record<string, string>
    } catch {
      stored = {}
    }
  }
  return stored
}

function rememberColor(src: string, color: string) {
  const all = storedColors()
  all[src] = color
  const keys = Object.keys(all)
  if (keys.length > 2000) delete all[keys[0]]
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(all))
  } catch {
    // armazenamento cheio: só perde o cache
  }
}

/**
 * Cor dominante "viva" da imagem (média ponderada pela saturação).
 * Retorna null em caso de erro (ex.: CORS), e o chamador usa uma sombra neutra.
 *
 * A arte exibida na tela é carregada sem CORS (algumas respostas do TCGdex trazem o
 * cabeçalho Access-Control-Allow-Origin duplicado e seriam bloqueadas). Aqui fazemos
 * uma carga separada, em modo CORS e com outra chave de cache, só para ler os pixels.
 */
export function dominantColor(src: string): Promise<string | null> {
  const known = storedColors()[src]
  if (known) return Promise.resolve(known === 'none' ? null : known)
  let p = colorCache.get(src)
  if (!p) {
    p = (async () => {
      try {
        const img = await loadImage(`${src}${src.includes('?') ? '&' : '?'}cors=1`, true)
        const size = 24
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return null
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        let r = 0
        let g = 0
        let b = 0
        let total = 0
        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i]
          const pg = data[i + 1]
          const pb = data[i + 2]
          const max = Math.max(pr, pg, pb)
          const min = Math.min(pr, pg, pb)
          const sat = max === 0 ? 0 : (max - min) / max
          const weight = 0.05 + sat * sat * (max / 255)
          r += pr * weight
          g += pg * weight
          b += pb * weight
          total += weight
        }
        if (!total) return null
        const color = `${Math.round(r / total)}, ${Math.round(g / total)}, ${Math.round(b / total)}`
        rememberColor(src, color)
        return color
      } catch {
        if (navigator.onLine) rememberColor(src, 'none')
        return null
      }
    })()
    colorCache.set(src, p)
  }
  return p
}
