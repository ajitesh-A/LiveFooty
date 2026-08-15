import { Router } from 'express'
import axios from 'axios'
import { getMatchById } from './matches.js'
import { findStreams } from '../scrapers/streams.js'

export const streamRouter = Router()

streamRouter.get('/:matchId', async (req, res) => {
  const { matchId } = req.params

  const match = await getMatchById(matchId)
  if (!match) return res.status(404).json({ error: 'Match not found' })

  try {
    const streams = await findStreams(match)
    res.json(streams)
  } catch (err) {
    res.status(500).json({ error: 'Failed to find streams' })
  }
})

streamRouter.get('/', async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'Missing url parameter' })

  try {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://livefooty.app/',
      },
    })

    const contentType = response.headers['content-type']
    if (contentType) res.setHeader('Content-Type', contentType)

    response.data.pipe(res)
  } catch {
    res.status(502).json({ error: 'Failed to proxy stream' })
  }
})
