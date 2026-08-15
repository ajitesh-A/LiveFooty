import { getUserByToken } from '../services/auth.js'

export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  req.user = token ? await getUserByToken(token) : undefined
  next()
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const user = token ? await getUserByToken(token) : null
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  next()
}