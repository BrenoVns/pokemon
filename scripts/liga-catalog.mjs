// Monta o catálogo de cartas da LigaPokemon (link exato + imagem de cada carta).
//
// Precisa rodar numa conexão residencial no Brasil: a Liga bloqueia servidores de nuvem.
// Não coleta preços. Vai devagar de propósito (uma requisição por vez, com pausa adaptativa).
//
// Uso:
//   npm run catalogo-liga                 # baixa edições novas/recentes (incremental)
//   npm run catalogo-liga -- --full       # baixa tudo de novo
//   npm run catalogo-liga -- --continuar  # só o que ainda não foi baixado (retomar)
//   npm run catalogo-liga -- --ed=30C,DLR # só estas edições (pelo código)
//   npm run catalogo-liga -- --montar     # só monta o arquivo com o que já está em cache (sem acessar a Liga)
//
// Saída: public/liga/catalog.json (lido pelo app). Cache por edição em scripts/.liga-cache/.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const SITE = 'https://www.ligapokemon.com.br'
const IMG_PREFIX = '//repositorio.sbrauble.com/arquivos/in/pokemon_bkp/cd/'
const CACHE_DIR = new URL('./.liga-cache/', import.meta.url)
const OUT = new URL('../public/liga/catalog.json', import.meta.url)
const CONCURRENCY = 1
// Pausa entre requisições: aumenta quando a Liga pede calma (429) e volta a cair aos poucos.
let pauseMs = 600
const MIN_PAUSE = 350
const MAX_PAUSE = 6000
let throttled = 0
const RECENT_DAYS = 120

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&rsquo;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&eacute;/g, 'é')
    .replace(/&aacute;/g, 'á')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&atilde;/g, 'ã')
    .replace(/&otilde;/g, 'õ')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&acirc;/g, 'â')
    .replace(/&agrave;/g, 'à')
    .replace(/&uuml;/g, 'ü')
    .replace(/&[a-z]+;/g, '')
    .trim()
}

/** Valor vindo de uma URL da Liga: "+" é espaço e "%xx" é escape. */
function fromQuery(value) {
  const v = value.replace(/\+/g, ' ')
  try {
    return decode(decodeURIComponent(v))
  } catch {
    return decode(v)
  }
}

class Blocked extends Error {}

async function request(url, init, attempt = 1) {
  const res = await fetch(url, { ...init, headers: { ...HEADERS, ...init?.headers } })
  if (res.status === 403 || res.status === 429) {
    throttled++
    pauseMs = Math.min(MAX_PAUSE, Math.round(pauseMs * 1.5) + 200)
    if (attempt >= 6) throw new Blocked(`A Liga respondeu ${res.status}. Espere alguns minutos e rode de novo.`)
    // Esfria de uma vez em vez de insistir.
    await sleep(15000 * attempt)
    return request(url, init, attempt + 1)
  }
  pauseMs = Math.max(MIN_PAUSE, Math.round(pauseMs * 0.9))
  if (!res.ok) {
    if (attempt >= 4) throw new Error(`HTTP ${res.status} em ${url}`)
    await sleep(2000 * attempt)
    return request(url, init, attempt + 1)
  }
  return res
}

async function fetchEditions() {
  const html = await (await request(`${SITE}/?view=cards/edicoes`)).text()
  const m = html.match(/let jsonEditions = (\{[\s\S]*?\});\s*\n/)
  if (!m) throw new Error('Não achei a lista de edições na página da Liga (o site mudou?)')
  const data = JSON.parse(m[1])
  const list = [...data.main, ...Object.values(data.aux ?? {}).flat()]
  const seen = new Set()
  return list
    .filter((e) => !seen.has(e.id) && seen.add(e.id))
    .map((e) => ({
      id: Number(e.id),
      code: e.acronym,
      namePt: decode(e.namept || ''),
      nameEn: decode(e.nameen || e.name || ''),
      release: (e.dtrelease || '').slice(0, 10),
      group: Number(e.idgrouped) || 0,
    }))
}

/** Extrai as cartas do HTML da busca da Liga. */
function parseCards(html) {
  const cards = []
  for (const block of html.split('class="mtg-single"').slice(1)) {
    const link = block.match(
      /href="\/\?view=cards\/card&(?:amp;)?card=([^"&]+)&(?:amp;)?ed=([^"&]+)&(?:amp;)?num=([^"&]*)"/,
    )
    const img = block.match(/data-src="([^"]+)"/)
    const id = block.match(/edc\.zoom\(\w+,\s*(\d+),/)
    if (!link) continue
    cards.push({
      label: fromQuery(link[1]),
      code: fromQuery(link[2]),
      num: fromQuery(link[3]),
      img: img ? img[1] : '',
      id: id ? Number(id[1]) : 0,
    })
  }
  return cards
}

async function fetchEdition(ed) {
  const byKey = new Map()
  let key = 'init'
  for (let page = 1; page <= 100; page++) {
    const body = new URLSearchParams({
      opc: 'nextPage',
      page: String(page),
      totalReg: '0',
      tipo: '1',
      search: `edid=${ed.id} ed=${ed.code}`,
      orderBy: '',
      fav: '0',
      iTCG: '2',
      idPokemon: '0',
      key,
    })
    const res = await request(`${SITE}/ajax/cards/main.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
      body,
    })
    const json = await res.json()
    key = json.key ?? key
    const cards = parseCards(json.html ?? '')
    let added = 0
    for (const c of cards) {
      const k = `${c.code}|${c.num}|${c.label}`
      if (!byKey.has(k)) {
        byKey.set(k, c)
        added++
      }
    }
    if (!json.nextPage || json.nextPage === '0' || cards.length === 0 || added === 0) break
    await sleep(pauseMs)
  }
  return [...byKey.values()]
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true })
  await mkdir(new URL('./', OUT), { recursive: true })

  const editionsCache = new URL('_edicoes.json', CACHE_DIR)
  let editions
  if (args.montar) {
    editions = JSON.parse(await readFile(editionsCache, 'utf8'))
  } else {
    console.log('Lendo a lista de edições…')
    editions = await fetchEditions()
    await writeFile(editionsCache, JSON.stringify(editions))
    console.log(`${editions.length} edições na Liga.`)
  }

  const onlyCodes = typeof args.ed === 'string' ? new Set(args.ed.split(',').map((s) => s.trim().toLowerCase())) : null
  const recentLimit = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString().slice(0, 10)
  const cachePath = (ed) => new URL(`${ed.id}.json`, CACHE_DIR)

  const todo = editions.filter((ed) => {
    if (args.montar) return false
    if (onlyCodes) return onlyCodes.has(ed.code.toLowerCase())
    if (args.continuar) return !existsSync(cachePath(ed))
    if (args.full) return true
    return !existsSync(cachePath(ed)) || ed.release >= recentLimit
  })
  const mode = onlyCodes
    ? ' (filtradas)'
    : args.full
      ? ' (completo)'
      : args.continuar
        ? ' (retomando)'
        : ' (novas ou recentes)'
  if (!args.montar) console.log(`${todo.length} edições para baixar${mode}.`)

  let done = 0
  let totalCards = 0
  const started = Date.now()
  const queue = [...todo]
  async function worker() {
    while (queue.length) {
      const ed = queue.shift()
      const cards = await fetchEdition(ed)
      await writeFile(cachePath(ed), JSON.stringify(cards))
      done++
      totalCards += cards.length
      const secs = Math.round((Date.now() - started) / 1000)
      console.log(
        `[${done}/${todo.length}] ${ed.code.padEnd(8)} ${String(cards.length).padStart(4)} cartas  ${ed.namePt || ed.nameEn}  (${secs}s, pausa ${pauseMs}ms, limites ${throttled})`,
      )
      await sleep(pauseMs)
    }
  }
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  } catch (e) {
    console.error(`\nParou: ${e.message}\nO que já foi baixado está salvo; rode de novo para continuar.`)
  }

  // Junta tudo que está em cache num arquivo compacto para o app.
  const outEditions = []
  const outCards = []
  for (const ed of editions) {
    if (!existsSync(cachePath(ed))) continue
    const cards = JSON.parse(await readFile(cachePath(ed), 'utf8'))
    if (!cards.length) continue
    const idx = outEditions.length
    outEditions.push([ed.id, ed.code, decode(ed.namePt), decode(ed.nameEn), ed.release, ed.group])
    for (const c of cards) {
      c.label = fromQuery(c.label)
      c.num = fromQuery(c.num)
      const img = c.img.startsWith(IMG_PREFIX) ? c.img.slice(IMG_PREFIX.length) : c.img
      outCards.push([idx, c.label, c.num, img])
    }
  }
  const catalog = {
    v: 1,
    generated: new Date().toISOString(),
    imgPrefix: `https:${IMG_PREFIX}`,
    // [id, código, nome PT, nome EN, lançamento, grupo]
    editions: outEditions,
    // [índice da edição, "Nome (num/total)", num, imagem]
    cards: outCards,
  }
  await writeFile(OUT, JSON.stringify(catalog))
  console.log(
    `\nCatálogo: ${outEditions.length} edições, ${outCards.length} cartas → public/liga/catalog.json` +
      (todo.length ? ` (baixadas agora: ${totalCards} cartas)` : ''),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
