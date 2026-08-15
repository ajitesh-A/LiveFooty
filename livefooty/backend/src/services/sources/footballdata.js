import axios from 'axios'
import { inWindow } from './util.js'

const BASE = 'https://api.football-data.org/v4'
const TIMEOUT = 12000

export const COMPETITIONS = {
  'Premier League': 'PL',
  'La Liga': 'PD',
  'Serie A': 'SA',
  'Bundesliga': 'BL1',
  'Ligue 1': 'FL1',
  'UEFA Champions League': 'CL',
}

function pad(n) {
  return String(n).padStart(2, '0')
}

export function dayKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function cleanTeam(name) {
  return (name || '')
    .replace(/\s*(FC|CF|AC|SC|AFC|AS)\s*$/i, '')
    .trim()
}

function statusOf(raw) {
  if (/IN_PLAY|LIVE|PAUSED/.test(raw)) return 'LIVE'
  if (/FINISHED|AWARDED/.test(raw)) return 'FT'
  return 'UPCOMING'
}

function timeOf(utcDate, status) {
  try {
    const d = new Date(utcDate)
    if (status === 'UPCOMING') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return 'LIVE'
  } catch {
    return '--:--'
  }
}

export async function fetchRange(fromKey, toKey) {
  const key = process.env.FOOTBALL_DATA_API_KEY
  if (!key) return []

  const codes = Object.values(COMPETITIONS).join(',')

  const { data } = await axios.get(`${BASE}/matches`, {
    timeout: TIMEOUT,
    headers: { 'X-Auth-Token': key },
    params: {
      competitions: codes,
      dateFrom: fromKey,
      dateTo: toKey,
    },
  })

  const out = []
  for (const m of data.matches || []) {
    const league = Object.keys(COMPETITIONS).find((l) =>
      COMPETITIONS[l] === m.competition?.code
    )
    if (!league) continue

    const status = statusOf(m.status)
    const home = cleanTeam(m.homeTeam?.name)
    const away = cleanTeam(m.awayTeam?.name)
    if (!home || !away) continue

    const score = m.score?.fullTime || m.score?.regularTime || {}
    const hasScore = score.home != null || score.away != null

    out.push({
      id: `fd-${m.id}`,
      fdId: m.id,
      league,
      home,
      away,
      status,
      homeBadge: m.homeTeam?.crest || null,
      awayBadge: m.awayTeam?.crest || null,
      homeScore: hasScore ? (score.home ?? null) : null,
      awayScore: hasScore ? (score.away ?? null) : null,
      time: status === 'LIVE' ? liveClock(m.utcDate) : timeOf(m.utcDate, status),
      date: m.utcDate ? new Date(m.utcDate).toISOString() : new Date().toISOString(),
    })
  }

  return out
}

export async function fetchAll() {
  const key = process.env.FOOTBALL_DATA_API_KEY
  if (!key) return null

  const now = new Date()
  const from = new Date(now.getTime() - 2 * 86400000)
  const to = new Date(now.getTime() + 8 * 86400000)

  const matches = await fetchRange(dayKey(from), dayKey(to))

  const byLeague = {}
  for (const m of matches) {
    if (!inWindow(m.date)) continue
    ;(byLeague[m.league] ||= []).push(m)
  }

  return byLeague
}

function liveClock(utcDate) {
  const start = new Date(utcDate).getTime()
  const elapsed = Math.max(0, Math.floor((Date.now() - start) / 60000))
  if (elapsed <= 45) return `${elapsed}'`
  if (elapsed <= 105) return `${elapsed - 45}'`
  return `${Math.min(elapsed - 60, 90)}'`
}