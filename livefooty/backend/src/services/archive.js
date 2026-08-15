import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import axios from 'axios'
import { fetchRange, dayKey } from './sources/footballdata.js'
import { fetchBundesligaFrom } from './sources/openligadb.js'
import { getArchivedLineups } from './lineups.js'
import { norm } from './sources/util.js'

const ARCHIVE_FROM = '2026-05-15'
const FUTURE_DAYS = 14
const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data')
const ARCHIVE_PATH = path.join(DATA_DIR, 'archive.json')
const LINEUPS_PATH = path.join(DATA_DIR, 'lineups.json')

const TSDB_API = 'https://www.thesportsdb.com/api/v1/json/3'
const TSDB_UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
}
const TIMEOUT = 12000

const LEAGUE_IDS = {
  'Premier League': 4328,
  'La Liga': 4335,
  'Serie A': 4332,
  'Bundesliga': 4331,
  'Ligue 1': 4334,
  'UEFA Champions League': 4333,
}

let store = { version: 1, updatedAt: null, matches: {} }
let lineupsCache = {}
let syncing = false
let saveTimer = null

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

fs.mkdirSync(DATA_DIR, { recursive: true })

function load() {
  try {
    store = JSON.parse(fs.readFileSync(ARCHIVE_PATH, 'utf8'))
    if (!store.matches) store.matches = {}
  } catch {
    store = { version: 1, updatedAt: null, matches: {} }
  }
  try {
    lineupsCache = JSON.parse(fs.readFileSync(LINEUPS_PATH, 'utf8'))
  } catch {
    lineupsCache = {}
  }
}

function atomicWrite(file, obj) {
  const tmp = `${file}.tmp`
  try {
    fs.writeFileSync(tmp, JSON.stringify(obj))
    fs.renameSync(tmp, file)
  } catch (e) {
    console.error(`[archive] failed to write ${file}: ${e.message}`)
  }
}

function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    atomicWrite(ARCHIVE_PATH, store)
  }, 500)
}

function saveLineupsNow() {
  atomicWrite(LINEUPS_PATH, lineupsCache)
}

/* ---------------- date helpers ---------------- */

function utcDayKey(dateIso) {
  try {
    const d = new Date(dateIso)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  } catch {
    return null
  }
}

function todayKey() {
  return dayKey(new Date())
}

function shiftKey(key, days) {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return dayKey(d)
}

/* ---------------- TheSportsDB season fetch (archive scope) ---------------- */

function tsdbStatus(strStatus, hasScores) {
  const s = (strStatus || '').toLowerCase()
  if (/live|[12]h|ht|'/.test(s)) return 'LIVE'
  if (/ft|fin|aet|pen|full|done/.test(s)) return 'FT'
  return hasScores ? 'FT' : 'UPCOMING'
}

async function fetchTsdbSeason(league, id) {
  const [curRes, lastRes] = await Promise.allSettled([
    axios.get(`${TSDB_API}/eventsseason.php?id=${id}`, { timeout: TIMEOUT, headers: TSDB_UA }),
    axios.get(`${TSDB_API}/eventsseason.php?id=${id}&s=2025-2026`, { timeout: TIMEOUT, headers: TSDB_UA }),
  ])

  const events = []
  const seen = new Set()
  for (const res of [curRes, lastRes]) {
    if (res.status !== 'fulfilled') continue
    for (const e of res.value.data?.events || []) {
      if (e.idEvent && !seen.has(e.idEvent)) {
        seen.add(e.idEvent)
        events.push(e)
      }
    }
  }

  const out = []
  for (const e of events) {
    const home = (e.strHomeTeam || '').trim()
    const away = (e.strAwayTeam || '').trim()
    if (!home || !away || !e.idEvent) continue

    const kickoffMs = e.dateEvent
      ? new Date(`${e.dateEvent}T${(e.strTime || '19:00:00').slice(0, 8)}`).getTime()
      : NaN
    if (isNaN(kickoffMs)) continue

    const hasScores = e.intHomeScore != null && e.intAwayScore != null
    const status = tsdbStatus(e.strStatus, hasScores)

    out.push({
      id: `r-${e.idEvent}`,
      tsdbId: e.idEvent,
      league,
      home,
      away,
      status,
      homeBadge: e.strHomeTeamBadge || null,
      awayBadge: e.strAwayTeamBadge || null,
      homeScore: hasScores ? Number(e.intHomeScore) : null,
      awayScore: hasScores ? Number(e.intAwayScore) : null,
      time: status === 'FT' ? 'FT' : '--:--',
      date: new Date(kickoffMs).toISOString(),
    })
  }
  return out
}

/* ---------------- merge ---------------- */

function natKey(r) {
  return `${r.league}|${norm(r.home)}|${norm(r.away)}|${utcDayKey(r.date)}`
}

function mergeRow(map, r) {
  const key = natKey(r)
  const ex = map.get(key)
  if (!ex) {
    map.set(key, r)
    return
  }

  ex.ids ||= {}
  if (r.ids) {
    if (r.ids.fd != null && ex.ids.fd == null) {
      ex.ids.fd = r.ids.fd
      if (!String(ex.id).startsWith('fd-')) ex.id = r.id
    }
    if (r.ids.tsdb != null) ex.ids.tsdb = r.ids.tsdb
    if (r.ids.oldb != null) ex.ids.oldb = r.ids.oldb
  }
  if (!ex.homeBadge && r.homeBadge) ex.homeBadge = r.homeBadge
  if (!ex.awayBadge && r.awayBadge) ex.awayBadge = r.awayBadge
  if (ex.matchday == null && r.matchday != null) ex.matchday = r.matchday

  if (r.status === 'FT') {
    if (ex.status !== 'FT') {
      ex.status = 'FT'
      ex.time = 'FT'
    }
    if (ex.homeScore == null && r.homeScore != null) ex.homeScore = r.homeScore
    if (ex.awayScore == null && r.awayScore != null) ex.awayScore = r.awayScore
  } else if (r.status === 'LIVE' && ex.status !== 'FT' && ex.status !== 'LIVE') {
    ex.status = 'LIVE'
    ex.time = r.time
  } else if (r.status === 'UPCOMING' && ex.status === 'UPCOMING' && !ex.time) {
    ex.time = r.time
  }
}

/* ---------------- sync ---------------- */

export async function syncArchive() {
  if (syncing) return false
  syncing = true
  const startedAt = Date.now()
  try {
    const today = todayKey()
    const pastTo = shiftKey(today, -1)
    const futureTo = shiftKey(today, FUTURE_DAYS)
    const futureFrom = today

    const fdChunks = [
      ['2026-05-15', '2026-05-31'],
      ['2026-06-01', '2026-06-30'],
      ['2026-07-01', '2026-07-31'],
      ['2026-08-01', pastTo],
      [futureFrom, futureTo],
    ].filter(([a, b]) => a <= b)

    const [fdResults, blResult, tsdbResults] = await Promise.all([
      Promise.allSettled(fdChunks.map(([a, b]) => fetchRange(a, b))),
      Promise.allSettled([fetchBundesligaFrom(ARCHIVE_FROM)]),
      Promise.allSettled(Object.entries(LEAGUE_IDS).map(([l, id]) => fetchTsdbSeason(l, id))),
    ])

    const rows = []
    for (const r of fdResults) {
      if (r.status === 'fulfilled') rows.push(...r.value)
    }
    if (blResult[0]?.status === 'fulfilled') rows.push(...blResult[0].value)
    for (const r of tsdbResults) {
      if (r.status === 'fulfilled') rows.push(...r.value)
    }

    const futureEndMs = new Date(`${futureTo}T23:59:59Z`).getTime()
    const map = new Map()
    for (const row of rows) {
      const kickoff = new Date(row.date).getTime()
      if (isNaN(kickoff)) continue
      if (kickoff < new Date(`${ARCHIVE_FROM}T00:00:00Z`).getTime()) continue
      if (kickoff > futureEndMs) continue

      const ids = {}
      if (row.fdId != null) ids.fd = row.fdId
      if (row.tsdbId != null) ids.tsdb = row.tsdbId
      if (row.oldbId != null) ids.oldb = row.oldbId
      delete row.fdId
      delete row.tsdbId
      delete row.oldbId
      row.ids = ids

      mergeRow(map, row)
    }

    const byDate = {}
    for (const r of map.values()) {
      const dk = utcDayKey(r.date)
      if (!dk) continue
      ;(byDate[dk] ||= []).push(r)
    }
    for (const list of Object.values(byDate)) {
      list.sort((a, b) => new Date(a.date) - new Date(b.date))
    }

    store.matches = byDate
    store.updatedAt = new Date().toISOString()
    save()

    const counts = { matches: map.size, days: Object.keys(byDate).length }
    console.log(`[archive] sync done in ${Math.round((Date.now() - startedAt) / 1000)}s: ${counts.matches} matches across ${counts.days} days (${ARCHIVE_FROM} → ${futureTo})`)
    return true
  } catch (e) {
    console.error(`[archive] sync failed: ${e.message}`)
    return false
  } finally {
    syncing = false
  }
}

/* ---------------- reads ---------------- */

export function getArchive({ from, to } = {}) {
  const days = Object.keys(store.matches).sort()
  const list = []
  for (const dk of days) {
    if (from && dk < from) continue
    if (to && dk > to) continue
    list.push(...store.matches[dk])
  }
  return list
}

export function getArchiveStatus() {
  const today = todayKey()
  const matches = getArchive({ from: ARCHIVE_FROM, to: shiftKey(today, FUTURE_DAYS) })
  return {
    from: ARCHIVE_FROM,
    to: shiftKey(today, FUTURE_DAYS),
    lastSync: store.updatedAt,
    dayCount: Object.keys(store.matches).length,
    matchCount: matches.length,
    ftCount: matches.filter((m) => m.status === 'FT').length,
    liveCount: matches.filter((m) => m.status === 'LIVE').length,
    upcomingCount: matches.filter((m) => m.status === 'UPCOMING').length,
    lineupsCached: Object.keys(lineupsCache).length,
  }
}

export function findArchivedMatch(id) {
  const days = Object.keys(store.matches)
  for (const dk of days) {
    const m = store.matches[dk].find((x) => x.id === id)
    if (m) return m
  }
  return null
}

/* ---------------- lineups ---------------- */

export async function getCachedArchivedLineups(match) {
  const cached = lineupsCache[match.id]
  if (cached) return { home: cached.home, away: cached.away, source: cached.source }

  const result = await getArchivedLineups(match)
  lineupsCache[match.id] = {
    fetchedAt: new Date().toISOString(),
    source: result.source,
    home: result.home,
    away: result.away,
  }
  saveLineupsNow()
  return result
}

export async function backfillLineups(days = 7) {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - days)
  const cutoffMs = cutoff.getTime()

  const targets = getArchive()
    .filter(
      (m) =>
        m.status === 'FT' &&
        new Date(m.date).getTime() >= cutoffMs &&
        !lineupsCache[m.id] &&
        (m.ids?.fd != null || m.ids?.tsdb != null)
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  if (!targets.length) {
    console.log('[archive] lineups backfill: nothing to do')
    return
  }
  console.log(`[archive] lineups backfill: ${targets.length} matches to process`)

  let done = 0
  for (const m of targets) {
    try {
      const result = await getCachedArchivedLineups(m)
      if (result.home || result.away) done++
    } catch {
      lineupsCache[m.id] = { fetchedAt: new Date().toISOString(), source: null, home: null, away: null }
      saveLineupsNow()
    }
    // football-data free tier: 10 req/min -> stay at ~8/min
    await sleep(7500)
  }
  console.log(`[archive] lineups backfill complete: ${done}/${targets.length} matches with lineups`)
}

load()