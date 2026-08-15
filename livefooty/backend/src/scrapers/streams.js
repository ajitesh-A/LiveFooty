import { huntAll, linkOptionsFor } from './hunters.js'

const CACHE_TTL = 5 * 60 * 1000
const cache = new Map()

function cacheGet(matchId) {
  const hit = cache.get(matchId)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.streams
  return null
}

function cacheSet(matchId, streams) {
  cache.set(matchId, { at: Date.now(), streams })
}

export async function findStreams(match) {
  if (!['LIVE', 'UPCOMING'].includes(match.status)) return []

  const cached = cacheGet(match.id)
  if (cached) return cached

  // 1. Hunt every source site (EpicSports, Koora, Footem) for this fixture.
  //    Blogger-network pages embed players via JS, so a headless-browser
  //    harvest kicks in when static extraction comes up empty.
  const { streams, pagesBySlug } = await huntAll(match)

  // 2. Always surface direct options. When a match page was found it is
  //    deep-linked; otherwise the source's search page for the fixture.
  const final = [...streams, ...linkOptionsFor(match, pagesBySlug)]
  cacheSet(match.id, final)
  return final
}