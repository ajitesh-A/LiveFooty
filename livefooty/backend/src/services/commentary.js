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

function emptyResult() {
  return { items: [], source: null }
}

function sideOf(teamName, match) {
  if (!teamName) return null
  const n = norm(teamName)
  if (n === norm(match.home)) return 'home'
  if (n === norm(match.away)) return 'away'
  return null
}

function sortItems(items) {
  return items
    .filter((i) => i.minute != null)
    .sort((a, b) => a.minute - b.minute || (a.second || 0) - (b.second || 0))
}

/* ---------------- SofaScore adapter (incidents feed) ---------------- */

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
    `https://www.sofascore.com/api/v1/event/${found.id}/incidents`,
    { timeout: TIMEOUT, headers: UA }
  )

  const items = (data?.incidents || []).map((inc) => {
    const type = String(inc.type || '').toLowerCase()
    const minute = inc.minute != null ? inc.minute : inc.time
    const player =
      inc.player?.name ||
      inc.playerIn?.name ||
      inc.playerOut?.name ||
      ''

    let text = ''
    if (type === 'goal') text = `Goal — ${player || ''}`.trim()
    else if (type === 'penalty' || type === 'pen') text = `Penalty — ${player || ''}`.trim()
    else if (type === 'own goal' || type === 'own_goal') text = `Own goal — ${player || ''}`.trim()
    else if (type === 'card' || type === 'yellowcard' || type === 'redcard') {
      const card = String(inc.cardType || (type === 'redcard' ? 'red' : 'yellow'))
      text = `${card} card — ${player || ''}`.trim()
    } else if (type === 'substitution') {
      const pin = inc.playerIn?.name || ''
      const pout = inc.playerOut?.name || ''
      text = `Substitution — ${pin || '?'}` + (pout ? ` for ${pout}` : '')
    } else if (type === 'period') {
      text = inc.text || inc.reason || ''
    } else if (type === 'var') {
      text = inc.text || `VAR review${player ? ` — ${player}` : ''}`
    } else {
      text = inc.text || ''
    }
    if (!text) return null

    return {
      minute,
      second: inc.second || 0,
      type: type === 'card' || type === 'yellowcard' || type === 'redcard'
        ? 'card'
        : type === 'goal' || type === 'penalty' || type === 'own goal' || type === 'own_goal'
          ? 'goal'
          : type === 'substitution' ? 'substitution' : type,
      label: type === 'period' ? inc.text || inc.reason || 'period' : undefined,
      side: sideOf(inc.team?.name, match),
      player,
      text,
    }
  }).filter(Boolean)

  return {
    items: sortItems(items),
    source: 'SofaScore',
  }
}

/* ---------------- FotMob adapter (incidents feed) ---------------- */

const FOTMOB_INCIDENT = {
  1: 'Goal',
  2: 'Own goal',
  3: 'Penalty goal',
  4: 'Missed penalty',
  5: 'Shot on target',
  6: 'Blocked shot',
  7: 'Yellow card',
  8: 'Red card',
  9: 'Yellow-red card',
  12: 'Substitution',
  13: 'Substitution',
  66: 'Save',
  120: 'VAR',
}

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

  const incidents =
    details.data?.content?.incidents ||
    details.data?.incidents ||
    []

  const items = incidents.map((inc) => {
    const key = inc.type
    const minute = inc.minute != null ? inc.minute : inc.time
    if (minute == null) return null
    const player = inc.playerName || ''
    let type
    let text = ''

    if (inc.incidentClass) {
      type = 'event'
      text = inc.incidentClass
      if (player) text += ` — ${player}`
    } else {
      type = FOTMOB_INCIDENT[key] ? 'incident' : 'event'
      if (FOTMOB_INCIDENT[key]) {
        if (key === 12 || key === 13) {
          text = `Substitution — ${inc.inPlayerName || '?'}` +
            (inc.outPlayerName ? ` for ${inc.outPlayerName}` : '')
        } else {
          text = `${FOTMOB_INCIDENT[key]} — ${player || '?'}`.trim()
        }
      } else if (player) {
        text = player
      }
    }
    if (!text) return null

    return {
      minute,
      second: inc.second || 0,
      type: key === 7 || key === 8 || key === 9 ? 'card' : type,
      side: inc.teamName ? sideOf(inc.teamName, match) : null,
      player,
      text,
    }
  }).filter(Boolean)

  return {
    items: sortItems(items),
    source: 'FotMob',
  }
}

/* ---------------- TheSportsDB adapter (goals/cards/substitutions) ---------------- */

async function fromTheSportsDB(match) {
  const idMatch = String(match.id || '').match(/^r-(\d+)$/)
  if (!idMatch) return null

  const { data } = await axios.get(
    `https://www.thesportsdb.com/api/v1/json/3/lookupevent.php?id=${idMatch[1]}`,
    { timeout: TIMEOUT, headers: { 'User-Agent': UA['User-Agent'] } }
  )

  const event = data?.events?.[0]
  if (!event) return null

  const items = []

  const pushList = (list, type, makeText) => {
    for (const it of list || []) {
      const minute = it.strTime != null ? Number(String(it.strTime).replace(/[^0-9]/g, '')) : null
      if (minute == null) continue
      items.push({
        minute,
        second: 0,
        type,
        side: sideOf(it.strTeam, match),
        player: it.strPlayer || '',
        text: makeText(it),
      })
    }
  }

  pushList(event.goals, 'goal', (g) => `Goal — ${g.strPlayer || ''}`.replace(/ — $/, ''))
  pushList(event.cards, 'card', (c) => `${c.strCard || 'card'} card — ${c.strPlayer || ''}`.replace(/ — $/, ''))
  pushList(event.substitutions, 'substitution', (s) =>
    `Substitution — ${s.strPlayerIn || '?'} for ${s.strPlayerOut || '?'}`
  )

  return {
    items: sortItems(items),
    source: 'TheSportsDB',
  }
}

/* ---------------- Public API ---------------- */

export async function getCommentary(match) {
  if (match.status !== 'LIVE' && match.status !== 'FT') {
    return { ...emptyResult(), reason: 'commentary-not-started' }
  }

  const adapters = [fromSofaScore, fromFotMob, fromTheSportsDB]
  const results = await Promise.allSettled(adapters.map((fn) => fn(match)))

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && r.value.items.length) {
      return r.value
    }
  }

  return emptyResult()
}