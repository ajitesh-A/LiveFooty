import axios from 'axios'
import { extractWithBrowser } from './browser.js'

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}
const TIMEOUT = 10000
const MAX_ATTEMPTS = 3
const BACKOFF = 800

/* ---------------- shared helpers ---------------- */

export function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function scoreTitle(title, match) {
  const t = norm(title)
  const h = norm(match.home)
  const a = norm(match.away)
  if (!t || !h || !a) return 0
  const hw = h.split(' ')
  const aw = a.split(' ')
  if (hw.every((w) => t.includes(w)) && aw.every((w) => t.includes(w))) return 2
  const firstOk = t.includes(hw[0]) && t.includes(aw[0])
  const lastOk = t.includes(hw[hw.length - 1]) && t.includes(aw[aw.length - 1])
  return firstOk || lastOk ? 1 : 0
}

async function get(url) {
  let lastErr = null
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const { data } = await axios.get(url, { timeout: TIMEOUT, headers: UA })
      return typeof data === 'string' ? data : ''
    } catch (err) {
      lastErr = err
      if (err.response && err.response.status < 500) break
    }
    if (i < MAX_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, BACKOFF))
  }
  throw lastErr || new Error(`GET failed: ${url}`)
}

const PERMALINK = /(?:^|\/)(20\d{2})\/\d{2}\/[a-z0-9-]+\.html$/i

function extractSourceUrls(html) {
  const urls = new Set()

  for (const m of html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)) {
    const u = m[1]
    if (/consentmind|googleads|doubleclick|googlesyndication/i.test(u)) continue
    urls.add(u)
  }

  for (const m of html.matchAll(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi)) {
    urls.add(m[0])
  }

  for (const m of html.matchAll(/<video[^>]+src=["']([^"']+)["']/gi)) {
    urls.add(m[1])
  }

  return [...urls]
}

/* ---------------- Blogger-network hunter (EpicSports/Koora/Footem) ---------------- */

const listCache = new Map()

function makeBloggerHunter({ slug, name, fronts }) {
  const root = fronts[0].split('/')[2] || fronts[0]
  const origin = `https://${root}`
  async function listMatches() {
    const fresh = listCache.get(slug)
    if (fresh && Date.now() - fresh.at < 3 * 60 * 1000) return fresh.matches

    const responses = await Promise.allSettled(fronts.map((f) => get(f)))
    const matches = []
    const seen = new Map()

    for (const r of responses) {
      if (r.status !== 'fulfilled') continue
      for (const m of r.value.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis)) {
        const href = m[1]
        const text = (m[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        if (!PERMALINK.test(href)) continue
        const url = href.startsWith('http') ? href : `https://${fronts[0].replace(/^https?:\/\//, '').split('/')[0]}${href.startsWith('/') ? href : '/' + href}`
        const existing = seen.get(url)
        if (existing) {
          if (!existing.title && text) existing.title = text
          continue
        }
        const entry = { url, title: text || '' }
        seen.set(url, entry)
        matches.push(entry)
      }
    }

    matches.sort((a, b) => (b.title || '').localeCompare(a.title || ''))
    listCache.set(slug, { at: Date.now(), matches })
    return matches
  }

  return {
    slug,
    name,
    origin,
    async findPage(match) {
      const list = await listMatches()
      let best = null
      let bestScore = 0
      for (const m of list) {
        const s = scoreTitle(m.title, match)
        if (s > bestScore) {
          bestScore = s
          best = m
        }
      }
      return best
    },
    async staticExtract(url) {
      const html = await get(url)
      return extractSourceUrls(html)
    },
    async hunt(match) {
      const page = await this.findPage(match)
      if (!page) return { page: null, streams: [] }
      let streams = []
      try {
        streams = await this.staticExtract(page.url)
      } catch {
        streams = []
      }
      return {
        page: { ...page, hunterName: this.name },
        streams: streams.map((url) => ({ url, label: this.name, quality: 'HD', type: inferType(url) })),
      }
    },
  }
}

function inferType(url) {
  if (/\.m3u8($|\?)/i.test(url)) return 'hls'
  if (/^(https?:)?\/\/(www\.)?(youtube|youtu\.be)/i.test(url)) return 'embed'
  return 'embed'
}

/* ---------------- hunters ---------------- */

export const BLOGGER_HUNTERS = [
  makeBloggerHunter({
    slug: 'epicsports',
    name: 'EpicSports',
    fronts: [
      'https://www.epicsports.in/',
      'https://www.epicsports.in/?view=tomo',
      'https://www.epicsports.in/?view=yest',
    ],
  }),
  makeBloggerHunter({
    slug: 'koora',
    name: 'Koora Live',
    fronts: ['https://koraonline.pro/'],
  }),
  makeBloggerHunter({
    slug: 'footem',
    name: 'Footem',
    fronts: ['https://www.footem.co.in/'],
  }),
  makeBloggerHunter({
    slug: 'sportstrack',
    name: 'SportsTrack',
    fronts: ['https://sportstrack.in/'],
  }),
]

const EXTRA_LINK_SOURCES = [
  { slug: 'livekoora', name: 'LiveKoora', base: 'https://livekoora.com/' },
]

export function linkOptionsFor(match, pagesBySlug) {
  const q = encodeURIComponent(`${match.home} ${match.away}`)
  const opts = []

  for (const h of BLOGGER_HUNTERS) {
    const page = pagesBySlug?.[h.slug]
    opts.push({
      url: page ? page.url : `${h.origin}/search?q=${q}`,
      label: h.name,
      quality: '—',
      type: 'link',
    })
  }

  for (const o of EXTRA_LINK_SOURCES) {
    opts.push({
      url: `${o.base}?s=${q}`,
      label: o.name,
      quality: '—',
      type: 'link',
    })
  }

  return opts
}

/* ---------------- orchestration ---------------- */

export async function huntAll(match) {
  const results = await Promise.allSettled(
    BLOGGER_HUNTERS.map((h) => h.hunt(match))
  )

  const streams = []
  const seen = new Set()
  const pagesBySlug = {}
  let browserCandidate = null

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status !== 'fulfilled') continue
    const hunter = BLOGGER_HUNTERS[i]
    const { page, streams: s } = r.value
    pagesBySlug[hunter.slug] = page || null
    for (const st of s) {
      if (seen.has(st.url)) continue
      seen.add(st.url)
      streams.push(st)
    }
    if (page && s.length === 0) {
      const sc = scoreTitle(page.title, match)
      if (!browserCandidate || sc > browserCandidate.score) {
        browserCandidate = { ...page, score: sc }
      }
    }
  }

  if (!streams.length && browserCandidate) {
    try {
      const hits = await extractWithBrowser(browserCandidate.url, browserCandidate.hunterName)
      for (const h of hits) {
        if (seen.has(h.url)) continue
        seen.add(h.url)
        streams.push(h)
      }
    } catch {
      // browser blocked or crashed — fall through to link options
    }
  }

  return { streams, pagesBySlug }
}