import puppeteer from 'puppeteer'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--lang=en-US',
    '--disable-safebrowsing',
    '--disable-features=SafeBrowsing,OptimizationHints',
  ],
  defaultViewport: { width: 1366, height: 768 },
})
const page = await browser.newPage()
await page.setUserAgent(UA)
page.on('requestfailed', (r) => console.log('[reqfail]', r.url().slice(0, 140), r.failure()?.errorText))

await page.goto('https://thestreameast.to/search?s=Bayern', { waitUntil: 'domcontentloaded', timeout: 45000 })
await new Promise((r) => setTimeout(r, 2500))

const html = await page.content()
const m = html.match(/window\.location\.replace\('([^']+)'\)/)
console.log('redirect target:', m?.[1] ?? 'NONE')
console.log('current url:', page.url())

if (m) {
  const target = m[1]
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 })
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const st = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      anchors: [...document.querySelectorAll('a')].slice(0, 5).map((a) => a.href),
      anchorCount: document.querySelectorAll('a').length,
      body: (document.body.innerText || '').slice(0, 300),
    }))
    console.log(`t+${(i + 1) * 3}s`, JSON.stringify(st))
    if (st.anchorCount > 200) break
  }
}

await browser.close()
process.exit(0)