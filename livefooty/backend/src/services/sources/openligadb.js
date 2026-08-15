import axios from 'axios'
import { inWindow } from './util.js'

const BASE = 'https://api.openligadb.de'
const TIMEOUT = 12000

const BUNDESLIGA = 'bl1'

export async function fetchBundesligaFrom(fromKey) {
  const [lastSeasonRes, currentRes] = await Promise.allSettled([
    axios.get(`${BASE}/getmatchdata/${BUNDESLIGA}/2025`, { timeout: TIMEOUT }),
    axios.get(`${BASE}/getmatchdata/${BUNDESLIGA}`, { timeout: TIMEOUT }),
  ])

  const matches = []
  const seen = new Set()
  for (const res of [currentRes, lastSeasonRes]) {
    if (res.status !== 'fulfilled' || !Array.isArray(res.value.data)) continue
    for (const m of res.value.data) {
      if (m.matchID && !seen.has(m.matchID)) {
        seen.add(m.matchID)
        matches.push(m)
      }
    }
  }
  if (!matches.length) return []

  const fromMs = new Date(`${fromKey}T00:00:00Z`).getTime()
  const now = Date.now()
  const out = []

  for (const m of matches) {
    const kickoff = new Date(m.matchDateTime).getTime()
    if (isNaN(kickoff) || kickoff < fromMs) continue

    const home = (m.team1?.teamName || '').trim()
    const away = (m.team2?.teamName || '').trim()
    if (!home || !away) continue

    const finished = m.matchIsFinished === true
    const finalResult = (m.matchResults || []).find((r) => r.resultTypeId === 2)
    const score = finalResult
      ? { home: finalResult.pointsTeam1, away: finalResult.pointsTeam2 }
      : { home: m.goalsTeam1, away: m.goalsTeam2 }

    let status, time
    if (finished) {
      status = 'FT'
      time = 'FT'
    } else if (kickoff <= now) {
      status = 'LIVE'
      time = liveClock(kickoff)
    } else {
      status = 'UPCOMING'
      time = new Date(kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const hasScore = score.home != null || score.away != null

    out.push({
      id: `oldb-${m.matchID}`,
      oldbId: m.matchID,
      league: 'Bundesliga',
      home,
      away,
      status,
      homeBadge: m.team1?.teamIconUrl || null,
      awayBadge: m.team2?.teamIconUrl || null,
      homeScore: hasScore ? (score.home ?? null) : null,
      awayScore: hasScore ? (score.away ?? null) : null,
      time,
      date: new Date(kickoff).toISOString(),
      matchday: m.group?.groupOrderID ?? null,
    })
  }

  return out
}

export async function fetchBundesliga() {
  const { data: matches } = await axios.get(`${BASE}/getmatchdata/${BUNDESLIGA}`, {
    timeout: TIMEOUT,
  })
  if (!Array.isArray(matches) || !matches.length) return null

  const now = Date.now()
  const byLeague = { 'Bundesliga': [] }

  for (const m of matches) {
    if (!inWindow(m.matchDateTime)) continue

    const kickoff = new Date(m.matchDateTime).getTime()
    if (isNaN(kickoff)) continue

    const home = (m.team1?.teamName || '').trim()
    const away = (m.team2?.teamName || '').trim()
    if (!home || !away) continue

    const finished = m.matchIsFinished === true
    const finalResult = (m.matchResults || []).find((r) => r.resultTypeId === 2)
    const score = finalResult
      ? { home: finalResult.pointsTeam1, away: finalResult.pointsTeam2 }
      : { home: m.goalsTeam1, away: m.goalsTeam2 }

    let status, time
    if (finished) {
      status = 'FT'
      time = 'FT'
    } else if (kickoff <= now) {
      status = 'LIVE'
      time = liveClock(kickoff)
    } else {
      status = 'UPCOMING'
      time = new Date(kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const hasScore = score.home != null || score.away != null

    byLeague['Bundesliga'].push({
      id: `oldb-${m.matchID}`,
      league: 'Bundesliga',
      home,
      away,
      status,
      homeBadge: m.team1?.teamIconUrl || null,
      awayBadge: m.team2?.teamIconUrl || null,
      homeScore: hasScore ? (score.home ?? null) : null,
      awayScore: hasScore ? (score.away ?? null) : null,
      time,
      date: new Date(kickoff).toISOString(),
      matchday: m.group?.groupOrderID ?? null,
    })
  }

  return byLeague['Bundesliga'].length ? byLeague : null
}

function liveClock(kickoff) {
  const elapsed = Math.max(0, Math.floor((Date.now() - kickoff) / 60000))
  if (elapsed <= 45) return `${elapsed}'`
  if (elapsed <= 105) return `${elapsed - 45}'`
  return `${Math.min(elapsed - 60, 90)}'`
}