import { Router } from 'express'
import { getOfficialScores } from '../services/officialScores.js'
import { LEAGUE_IDS } from '../services/liveScores.js'
import { getLineups, getArchivedLineups } from '../services/lineups.js'
import { getCommentary } from '../services/commentary.js'
import { findArchivedMatch, getCachedArchivedLineups } from '../services/archive.js'
import { getUserFdKey } from '../services/auth.js'

export const matchesRouter = Router()

const MAX_PER_LEAGUE = 10

function statusRank(m) {
  return m.status === 'LIVE' ? 0 : m.status === 'UPCOMING' ? 1 : 2
}

export async function getSchedule() {
  const live = await getOfficialScores()

  const merged = []
  for (const league of Object.keys(LEAGUE_IDS)) {
    const real = (live[league] || []).slice(0, MAX_PER_LEAGUE)
    if (real.length) merged.push(...real)
  }

  merged.sort((a, b) => {
    const byStatus = statusRank(a) - statusRank(b)
    if (byStatus !== 0) return byStatus
    const ta = new Date(a.date).getTime()
    const tb = new Date(b.date).getTime()
    return a.status === 'FT' ? tb - ta : ta - tb
  })

  return merged
}

export async function findMatch(id) {
  const schedule = await getSchedule()
  const live = schedule.find((m) => m.id === id)
  if (live) return live
  return findArchivedMatch(id)
}

async function isLiveMatch(id) {
  const schedule = await getSchedule()
  return schedule.some((m) => m.id === id)
}

matchesRouter.get('/', async (req, res) => {
  const { league } = req.query
  const matches = await getSchedule()

  if (league) {
    return res.json(matches.filter((m) =>
      m.league.toLowerCase().includes(league.toLowerCase())
    ))
  }

  res.json(matches)
})

matchesRouter.get('/:id/lineups', async (req, res) => {
  const match = await findMatch(req.params.id)
  if (!match) return res.status(404).json({ error: 'Match not found' })

  const lineups = (await isLiveMatch(match.id))
    ? await getLineups(match, { apiKey: getUserFdKey(req.user) })
    : await getCachedArchivedLineups(match)
  res.json(lineups)
})

matchesRouter.get('/:id/commentary', async (req, res) => {
  const match = await findMatch(req.params.id)
  if (!match) return res.status(404).json({ error: 'Match not found' })

  const commentary = await getCommentary(match)
  res.json(commentary)
})

matchesRouter.get('/:id', async (req, res) => {
  const match = await findMatch(req.params.id)
  if (!match) return res.status(404).json({ error: 'Match not found' })
  res.json(match)
})

export async function getMatchById(id) {
  return findMatch(id)
}