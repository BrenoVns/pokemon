// Gera os ícones PNG do PWA sem dependências (rasterização simples + zlib).
// Uso: npm run icons
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0x0a, 0x0a, 0x0f]
const ACCENT = [0xb9, 0xa6, 0xff]
const BACK = ACCENT.map((c, i) => Math.round(c * 0.55 + BG[i] * 0.45))

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  const S = 4 // supersampling
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size)
          r += pr * pa
          g += pg * pa
          b += pb * pa
          a += pa
        }
      const o = y * (size * 4 + 1) + 1 + x * 4
      const n = S * S
      raw[o] = a ? Math.round(r / a) : 0
      raw[o + 1] = a ? Math.round(g / a) : 0
      raw[o + 2] = a ? Math.round(b / a) : 0
      raw[o + 3] = Math.round((a / n) * 255)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Distância a um retângulo arredondado centrado em (cx, cy)
function roundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r
  const qy = Math.abs(py - cy) - hh + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

/** Marca: duas cartas sobrepostas (fichário), a da frente no destaque com um anel. */
function mark(scale, bgRadius) {
  return (u, v) => {
    // fundo
    if (bgRadius !== null && roundRect(u, v, 0.5, 0.5, 0.5, 0.5, bgRadius) > 0) return [0, 0, 0, 0]
    const x = (u - 0.5) / scale + 0.5
    const y = (v - 0.5) / scale + 0.5
    // carta da frente (destaque)
    const [fx, fy, hw, hh] = [0.56, 0.54, 0.2, 0.28]
    const front = roundRect(x, y, fx, fy, hw, hh, 0.045)
    if (front <= 0) {
      const d = Math.hypot(x - fx, y - fy)
      if (d > 0.085 && d < 0.125) return [...BG, 1]
      if (d <= 0.045) return [...BG, 1]
      return [...ACCENT, 1]
    }
    if (front < 0.025) return [...BG, 1]
    // carta de trás (contorno)
    const back = roundRect(x, y, fx - 0.13, fy - 0.1, hw, hh, 0.045)
    if (back <= 0 && back > -0.028) return [...BACK, 1]
    return [...BG, 1]
  }
}

const out = (name, size, pixel) => writeFileSync(new URL(`../public/${name}`, import.meta.url), png(size, pixel))
out('pwa-192.png', 192, mark(1, 0.22))
out('pwa-512.png', 512, mark(1, 0.22))
out('pwa-maskable-512.png', 512, mark(0.72, null))
out('apple-touch-icon.png', 180, mark(0.9, null))
console.log('Ícones gerados em public/')
