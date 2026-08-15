import axios from 'axios'

const API = 'https://www.thesportsdb.com/api/v1/json/3'
const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
}
const TIMEOUT = 10000
const TTL = 7 * 24 * 3600000

const badgeCache = new Map()

export function resetBadgeCache() {
  badgeCache.clear()
}

async function resolveOne(teamName) {
  const key = teamName.toLowerCase()
  const hit = badgeCache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.url

  try {
    const { data } = await axios.get(`${API}/searchteams.php?t=${encodeURIComponent(teamName)}`, {
      timeout: TIMEOUT,
      headers: UA,
    })
    const team = (data.teams || []).find((t) => t.strTeamBadge)
    const url = team?.strTeamBadge || null
    badgeCache.set(key, { at: Date.now(), url })
    return url
  } catch {
    badgeCache.set(key, { at: Date.now(), url: null })
    return null
  }
}

async function resolvePooled(names) {
  const results = new Map()
  const queue = [...names]
  async function worker() {
    while (queue.length) {
      const name = queue.shift()
      results.set(name.toLowerCase(), await resolveOne(name))
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return results
}

export async function enrichBadges(byLeague) {
  const missing = new Set()
  for (const league of Object.values(byLeague)) {
    for (const m of league || []) {
      if (!m.homeBadge) missing.add(m.home)
      if (!m.awayBadge) missing.add(m.away)
    }
  }
  if (missing.size === 0) return byLeague

  const resolved = await resolvePooled([...missing])

  for (const league of Object.values(byLeague)) {
    for (const m of league || []) {
      if (!m.homeBadge) m.homeBadge = resolved.get(m.home.toLowerCase()) || null
      if (!m.awayBadge) m.awayBadge = resolved.get(m.away.toLowerCase()) || null
    }
  }
  return byLeague
}