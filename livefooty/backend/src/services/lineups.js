import axios from 'axios'

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'application/json',
}
const TIMEOUT = 12000

function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isEligible(match) {
  if (match.status === 'LIVE' || match.status === 'FT') return true
  if (match.status === 'UPCOMING') {
    const kickoff = new Date(match.date).getTime()
    if (!isNaN(kickoff)) {
      const now = Date.now()
      const margin = 3 * 60 * 60 * 1000
      if (kickoff - now > margin) return false
    }
  }
  return true
}

function emptyResult() {
  return { home: null, away: null, source: null }
}

/* ---------------- SofaScore adapter ---------------- */

async function fromSofaScore(match) {
  const search = await axios.get(
    `https://www.sofascore.com/api/v1/search/all?q=${encodeURIComponent(`${match.home} ${match.away}`)}`,
    { timeout: TIMEOUT, headers: UA }
  )

  const events = search.data?.events || []
  const nh = norm(match.home)
  const na = norm(match.away)
  const found = events.find((e) => {
    const n = norm(e.homeTeam?.name) + '|' + norm(e.awayTeam?.name)
    return n === `${nh}|${na}` || n === `${na}|${nh}`
  })
  if (!found) return null

  const { data } = await axios.get(
    `https://www.sofascore.com/api/v1/event/${found.id}/lineups`,
    { timeout: TIMEOUT, headers: UA }
  )

  const mapSide = (side) => {
    const raw = data?.[side]
    if (!raw) return null
    const players = raw.players || []
    return {
      team: raw.team?.name || match.home,
      formation: raw.formation || '--',
      starters: players
        .filter((p) => !p.substitute)
        .map((p) => ({
          name: p.player?.name || 'Unknown',
          position: p.position || '',
          shirtNumber: p.shirtNumber || null,
        })),
      subs: players
        .filter((p) => p.substitute)
        .map((p) => p.player?.name || 'Unknown'),
    }
  }

  return {
    home: mapSide('home'),
    away: mapSide('away'),
    source: 'SofaScore',
  }
}

/* ---------------- FotMob adapter ---------------- */

async function fromFotMob(match) {
  const day = new Date(match.date)
  if (isNaN(day.getTime())) return null
  const pad = (n) => String(n).padStart(2, '0')
  const dateKey = `${day.getFullYear()}${pad(day.getMonth() + 1)}${pad(day.getDate())}`

  const { data } = await axios.get(
    `https://www.fotmob.com/api/matches?date=${dateKey}`,
    { timeout: TIMEOUT, headers: UA }
  )

  const nh = norm(match.home)
  const na = norm(match.away)
  let matchId = null
  for (const league of data?.leagues || []) {
    const found = (league.matches || []).find((m) => {
      const n = norm(m.home?.name) + '|' + norm(m.away?.name)
      return n === `${nh}|${na}` || n === `${na}|${nh}`
    })
    if (found) { matchId = found.id; break }
  }
  if (!matchId) return null

  const details = await axios.get(
    `https://www.fotmob.com/api/matchDetails?matchId=${matchId}`,
    { timeout: TIMEOUT, headers: UA }
  )

  const lineup = details.data?.content?.lineup?.lineup || details.data?.lineup?.lineup || []
  const mapSide = (side) => ({
    team: side.teamName || (side.starting ? match.home : match.away),
    formation: side.formation || '--',
    starters: (side.starting || [])
      .sort((a, b) => (a.positionOrder || 0) - (b.positionOrder || 0))
      .map((p) => ({
        name: p.name || 'Unknown',
        position: p.position || '',
        shirtNumber: p.shirtNumber || null,
      })),
    subs: (side.bench || []).map((p) => p.name || 'Unknown'),
  })

  return {
    home: lineup[0] ? mapSide(lineup[0]) : null,
    away: lineup[1] ? mapSide(lineup[1]) : null,
    source: 'FotMob',
  }
}

/* ---------------- football-data adapter ---------------- */

async function fromFootballdata(match, apiKey) {
  const fdId = match.ids?.fd ?? String(match.id || '').match(/^fd-(\d+)$/)?.[1]
  if (!fdId) return null
  const key = apiKey || process.env.FOOTBALL_DATA_API_KEY
  if (!key) return null

  const { data } = await axios.get(
    `https://api.football-data.org/v4/matches/${fdId}/lineups`,
    { timeout: TIMEOUT, headers: { 'X-Auth-Token': key, ...UA } }
  )

  const lineups = data?.lineups
  if (!lineups || !lineups.length) return null

  const mapSide = (l, fallbackName) => ({
    team: l.team?.name || fallbackName,
    formation: l.formation || '--',
    starters: (l.startXI || []).map((p) => ({
      name: p.player?.name || 'Unknown',
      position: p.player?.position || '',
      shirtNumber: null,
    })),
    subs: (l.substitutes || []).map((p) => p.player?.name || 'Unknown'),
  })

  return {
    home: mapSide(lineups[0], match.home),
    away: lineups[1] ? mapSide(lineups[1], match.away) : null,
    source: 'football-data',
  }
}

/* ---------------- TheSportsDB adapter (fallback) ---------------- */

async function fromTheSportsDB(match) {
  const idMatch = String(match.id || '').match(/^r-(\d+)$/)
  const tsdbId = match.ids?.tsdb ?? idMatch?.[1]
  if (!tsdbId) return null

  const { data } = await axios.get(
    `https://www.thesportsdb.com/api/v1/json/3/eventslineups.php?id=${tsdbId}`,
    { timeout: TIMEOUT, headers: { 'User-Agent': UA['User-Agent'] } }
  )

  const lineups = data?.lineups
  if (!lineups || !lineups.length) return null

  const parseSide = (l, isHome) => {
    const key = isHome ? 'strLineupHome' : 'strLineupAway'
    let players = []
    try {
      players = JSON.parse(l[key] || '[]')
    } catch {
      players = []
    }
    const starters = players.filter((p) => !String(p.strSubstitute || '').startsWith('yes'))
    const subs = players.filter((p) => String(p.strSubstitute || '').startsWith('yes'))
    return {
      team: l.strTeam,
      formation: l.strFormation || '--',
      starters: starters.map((p) => ({
        name: p.strPlayer || 'Unknown',
        position: p.strPosition || '',
        shirtNumber: p.intSquadNumber ? Number(p.intSquadNumber) : null,
      })),
      subs: subs.map((p) => p.strPlayer || 'Unknown'),
    }
  }

  const homeLineup = lineups.find((l) => l.strHome === 'yes')
  const awayLineup = lineups.find((l) => l.strHome === 'no')

  return {
    home: homeLineup ? parseSide(homeLineup, true) : null,
    away: awayLineup ? parseSide(awayLineup, false) : null,
    source: 'TheSportsDB',
  }
}

/* ---------------- Public API ---------------- */

export async function getLineups(match, { apiKey } = {}) {
  if (!isEligible(match)) return { ...emptyResult(), reason: 'lineups-not-confirmed' }

  const adapters = [
    (m) => fromFootballdata(m, apiKey),
    fromSofaScore,
    fromFotMob,
    fromTheSportsDB,
  ]
  const results = await Promise.allSettled(
    adapters.map((fn) => fn(match))
  )

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && (r.value.home || r.value.away)) {
      return r.value
    }
  }

  return emptyResult()
}

export async function getArchivedLineups(match) {
  const adapters = [fromFootballdata, fromTheSportsDB]
  const results = await Promise.allSettled(
    adapters.map((fn) => fn(match))
  )

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && (r.value.home || r.value.away)) {
      return r.value
    }
  }

  return emptyResult()
}