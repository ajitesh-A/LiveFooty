import axios from 'axios'
import { inWindow } from './sources/util.js'

const API = 'https://www.thesportsdb.com/api/v1/json/3'
const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
}
const REQUEST_TIMEOUT = 12000
const TTL = 45_000

export const LEAGUE_IDS = {
  'Premier League': 4328,
  'La Liga': 4335,
  'Serie A': 4332,
  'Bundesliga': 4331,
  'Ligue 1': 4334,
  'UEFA Champions League': 4333,
}

let cache = null
let cacheAt = 0

function today() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseStatus(strStatus, hasScores) {
  const s = (strStatus || '').toLowerCase()
  if (/live|[12]h|ht|'/.test(s)) return 'LIVE'
  if (/ft|fin|aet|pen|full|done/.test(s)) return 'FT'
  if (/ns|not started|sched|pst|canc|delay|postp/.test(s)) return 'UPCOMING'
  return hasScores ? 'FT' : 'UPCOMING'
}

function clockText(strStatus) {
  const s = (strStatus || '').trim()
  if (/^\d+'/.test(s)) return s
  if (/^1h$/i.test(s)) return '1H'
  if (/^2h$/i.test(s)) return '2H'
  if (/^ht$/i.test(s)) return 'HT'
  return 'LIVE'
}

function kickoffTime(dateEvent, strTime) {
  try {
    const t = (strTime || '').slice(0, 5)
    const d = new Date(`${dateEvent}T${t || '12:00'}:00`)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return (strTime || '').slice(0, 5) || '--:--'
  }
}

function parseEvent(e) {
  const hasScores = e.intHomeScore != null && e.intAwayScore != null
  const status = parseStatus(e.strStatus, hasScores)

  const kickoffMs = e.dateEvent
    ? new Date(`${e.dateEvent}T${(e.strTime || '12:00:00').slice(0, 8)}`).getTime()
    : NaN
  if (isNaN(kickoffMs)) return null

  const now = Date.now()

  if (status === 'UPCOMING' && now - kickoffMs > 2 * 3600000) return null
  if (status === 'LIVE' && now - kickoffMs > 7 * 3600000) return null
  if (!inWindow(kickoffMs)) return null

  let time
  if (status === 'LIVE') time = clockText(e.strStatus)
  else if (status === 'UPCOMING') time = kickoffTime(e.dateEvent, e.strTime)
  else time = 'FT'

  const home = (e.strHomeTeam || '').trim()
  const away = (e.strAwayTeam || '').trim()
  if (!home || !away) return null

  return {
    id: `r-${e.idEvent}`,
    league: e.strLeague,
    home,
    away,
    status,
    homeBadge: e.strHomeTeamBadge || null,
    awayBadge: e.strAwayTeamBadge || null,
    homeScore: hasScores ? Number(e.intHomeScore) : null,
    awayScore: hasScores ? Number(e.intAwayScore) : null,
    time,
    date: new Date(kickoffMs).toISOString(),
  }
}

async function fetchLeague(league, id) {
  const [seasonRes, todayRes] = await Promise.allSettled([
    axios.get(`${API}/eventsseason.php?id=${id}`, { timeout: REQUEST_TIMEOUT, headers: UA }),
    axios.get(`${API}/eventsday.php?s=Soccer&d=${today()}`, { timeout: REQUEST_TIMEOUT, headers: UA }),
  ])

  const seen = new Set()
  const events = []

  const todayEvents = todayRes.status === 'fulfilled'
    ? (todayRes.value.data.events || []).filter((e) => String(e.idLeague) === String(id))
    : []
  const seasonEvents = seasonRes.status === 'fulfilled'
    ? seasonRes.value.data.events || []
    : []

  for (const e of [...todayEvents, ...seasonEvents]) {
    if (e && e.idEvent && !seen.has(e.idEvent)) {
      seen.add(e.idEvent)
      events.push(e)
    }
  }

  return events
    .map(parseEvent)
    .filter(Boolean)
    .map((m) => ({ ...m, league }))
}

export async function getLiveScores() {
  if (cache && Date.now() - cacheAt < TTL) return cache

  const entries = Object.entries(LEAGUE_IDS)
  const results = await Promise.allSettled(
    entries.map(([league, id]) => fetchLeague(league, id))
  )

  const byLeague = {}
  results.forEach((r, i) => {
    const [league] = entries[i]
    byLeague[league] = r.status === 'fulfilled' ? r.value : []
  })

  cache = byLeague
  cacheAt = Date.now()
  return byLeague
}