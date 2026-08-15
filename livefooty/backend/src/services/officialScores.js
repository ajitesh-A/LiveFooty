import { fetchAll as fetchFootballdata } from './sources/footballdata.js'
import { fetchBundesliga } from './sources/openligadb.js'
import { getLiveScores } from './liveScores.js'
import { LEAGUE_IDS } from './liveScores.js'
import { enrichBadges } from './badges.js'

const TTL = 60_000

let cache = null
let cacheAt = 0

export async function getOfficialScores() {
  if (cache && Date.now() - cacheAt < TTL) return cache

  const [fd, ob, tsdbResult] = await Promise.allSettled([
    fetchFootballdata(),
    fetchBundesliga(),
    getLiveScores(),
  ])

  const footballData = fd.status === 'fulfilled' ? fd.value : null
  const openLigaDb = ob.status === 'fulfilled' ? ob.value : null
  const theSportsDb = tsdbResult.status === 'fulfilled' ? tsdbResult.value : null

  const byLeague = {}
  for (const league of Object.keys(LEAGUE_IDS)) {
    if (footballData && footballData[league] && footballData[league].length) {
      byLeague[league] = footballData[league]
      continue
    }
    if (league === 'Bundesliga' && openLigaDb && openLigaDb['Bundesliga']?.length) {
      byLeague[league] = openLigaDb['Bundesliga']
      continue
    }
    if (theSportsDb && theSportsDb[league] && theSportsDb[league].length) {
      byLeague[league] = theSportsDb[league]
    } else {
      byLeague[league] = []
    }
  }

  cache = byLeague
  cacheAt = Date.now()

  try {
    await enrichBadges(cache)
  } catch {
    // badge enrichment is best-effort
  }

  return cache
}