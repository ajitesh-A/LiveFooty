import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { matchesRouter } from './routes/matches.js'
import { streamRouter } from './routes/stream.js'
import { archiveRouter } from './routes/archive.js'
import { authRouter } from './routes/auth.js'
import { optionalAuth } from './middleware/auth.js'
import { syncArchive, backfillLineups } from './services/archive.js'

try {
  if (fs.existsSync(new URL('../.env', import.meta.url))) {
    process.loadEnvFile(new URL('../.env', import.meta.url))
  }
} catch {
  // no .env file - optional sources just stay disabled
}

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/matches', optionalAuth, matchesRouter)
app.use('/api/streams', streamRouter)
app.use('/api/proxy', streamRouter)
app.use('/api/archive', archiveRouter)
app.use('/api/auth', authRouter)

app.get('/api/health', (req, res) => {
  res.json({ ok: true, pid: process.pid, uptime: Math.round(process.uptime()) })
})

let lastExternal = Date.now()
app.use((req, res, next) => { lastExternal = Date.now(); next() })

function keepaliveTick() {
  const PUBLIC_URL = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || ''
  if (!PUBLIC_URL) return
  const idle = Date.now() - lastExternal
  if (idle > 15 * 60 * 1000) {
    console.warn('[keepalive] no external traffic for ' + Math.round(idle / 1000) + 's; waking')
  }
  fetch(PUBLIC_URL + '/api/health', { signal: AbortSignal.timeout(8000) })
    .then((r) => { if (!r.ok) throw new Error('status ' + r.status) })
    .then(() => console.log('[keepalive] self-check ok ' + new Date().toISOString()))
    .catch((e) => console.error('[keepalive] self-check failed: ' + e.message))
}
setInterval(keepaliveTick, 4 * 60 * 1000)

const DIST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../frontend/dist'
)
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(DIST, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`LiveFooty backend running on http://localhost:${PORT}`)

  ;(async () => {
    try {
      const synced = await syncArchive()
      if (synced) await backfillLineups(7)
    } catch (e) {
      console.error(`[archive] boot task failed: ${e.message}`)
    }
  })()
})
