const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
const AD_RE = /consentmanager|googleads|doubleclick|googlesyndication|googleadservices|safeframe|privacy|googletagmanager/i
const IDLE = 5 * 60 * 1000

let browser = null
let idleTimer = null

async function getBrowser() {
  let puppeteer
  try {
    ;({ default: puppeteer } = await import('puppeteer'))
  } catch { return null }
  if (!puppeteer) return null
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--lang=en-US',
      ],
      defaultViewport: { width: 1366, height: 768 },
    })
  }
  resetIdle()
  return browser
}

function resetIdle() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(async () => {
    if (browser && browser.connected) {
      await browser.close().catch(() => {})
      browser = null
    }
  }, IDLE)
}

async function dismissOverlays(page) {
  try {
    await page.evaluate(() => {
      const candidates = [...document.querySelectorAll('button, [role="button"], a')]
      const el = candidates.find((c) => {
        const t = (c.textContent || '').trim()
        return t.length < 30 && /accept|agree|consent|dismiss|close|i agree/i.test(t)
      })
      if (el) el.click()
    })
    await new Promise((r) => setTimeout(r, 500))
  } catch {
    // page may be navigating — ignore
  }
}

function collectHits(page, hits, m3u8s, label) {
  for (const u of m3u8s) {
    if (!hits.some((h) => h.url === u)) {
      hits.push({
        url: u,
        type: 'hls',
        label,
        quality: /720/.test(u) ? '720p' : /1080/.test(u) ? '1080p' : 'HD',
      })
    }
  }
}

// Opens a match page in a real browser and harvests the player once the
// site's JS has injected it (Blogger loads players client-side).
export async function extractWithBrowser(url, label = 'EpicSports') {
  const b = await getBrowser()
  if (!b) return []
  const page = await b.newPage()
  await page.setUserAgent(UA)
  const hits = []
  const m3u8s = new Set()

  page.on('response', (r) => {
    const u = r.url()
    if (/\.m3u8(\?|$)/i.test(u)) m3u8s.add(u)
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await dismissOverlays(page)
    await new Promise((r) => setTimeout(r, 6000))

    let iframes = []
    try {
      iframes = await page.$$eval('iframe', (els) =>
        els
          .map((e) => e.src || '')
          .filter((s) => s && !s.startsWith('about:') && !/consentmanager|googleads|doubleclick|googlesyndication|googleadservices|safeframe|privacy|googletagmanager/i.test(s))
      )
    } catch {
      iframes = []
    }

    if (iframes.length === 0) {
      await new Promise((r) => setTimeout(r, 6000))
      try {
        iframes = await page.$$eval('iframe', (els) =>
          els
            .map((e) => e.src || '')
            .filter((s) => s && !s.startsWith('about:') && !/consentmanager|googleads|doubleclick|googlesyndication|googleadservices|safeframe|privacy|googletagmanager/i.test(s))
        )
      } catch {
        iframes = []
      }
    }

    const media = await page.$$eval('video, video source', (els) =>
      els.map((e) => e.src || e.currentSrc || '').filter(Boolean)
    )

    const seen = new Set()
    for (const src of [...iframes, ...media]) {
      const key = src.split('?')[0]
      if (seen.has(key)) continue
      seen.add(key)
      hits.push({
        url: src,
        type: /\.(m3u8|mp4)(\?|$)/i.test(key) ? 'hls' : 'embed',
        label,
        quality: /720/.test(src) ? '720p' : /1080/.test(src) ? '1080p' : 'HD',
      })
    }
  } catch {
    // browser extraction failure is not fatal
  } finally {
    collectHits(page, hits, m3u8s, label)
    await page.close().catch(() => {})
  }

  return hits.slice(0, 3)
}

export async function findStreamsWithBrowser() {
  // Reserved for future browser-based sources.
  return []
}