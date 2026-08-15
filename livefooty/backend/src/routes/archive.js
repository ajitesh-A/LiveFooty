import { Router } from 'express'
import { getArchive, getArchiveStatus, syncArchive } from '../services/archive.js'

export const archiveRouter = Router()

archiveRouter.get('/', (req, res) => {
  const { from, to } = req.query
  const matches = getArchive({ from, to })
  res.json({ from: from || null, to: to || null, count: matches.length, matches })
})

archiveRouter.get('/status', (_, res) => {
  res.json(getArchiveStatus())
})

archiveRouter.post('/sync', async (_, res) => {
  const started = await syncArchive()
  res.status(started ? 202 : 409).json({
    started,
    message: started ? 'Archive sync started' : 'Archive sync already in progress',
  })
})