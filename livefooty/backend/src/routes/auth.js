import { Router } from 'express'
import {
  registerUser,
  loginUser,
  setUserFdKey,
  clearUserFdKey,
  sanitizeUser,
  verifyEmail,
  resendVerificationCode,
} from '../services/auth.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

authRouter.post('/register', async (req, res) => {
  try {
    res.status(201).json(await registerUser(req.body?.email, req.body?.password))
  } catch (e) {
    const status =
      e.message === 'EMAIL_TAKEN' ? 409 : e.message === 'BAD_EMAIL' || e.message === 'WEAK_PASSWORD' ? 422 : 500
    res.status(status).json({ error: e.message })
  }
})

authRouter.post('/login', (req, res) => {
  try {
    res.json(loginUser(req.body?.email, req.body?.password))
  } catch (e) {
    res.status(401).json({ error: 'Invalid email or password' })
  }
})

authRouter.post('/logout', (_req, res) => {
  res.status(204).end()
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.user) })
})

authRouter.post('/verify', requireAuth, async (req, res) => {
  try {
    res.json({ user: await verifyEmail(req.user.id, req.body?.code) })
  } catch (e) {
    const status =
      e.message === 'INVALID_CODE' || e.message === 'CODE_EXPIRED' ? 422 : e.message === 'NO_USER' ? 404 : 500
    res.status(status).json({ error: e.message })
  }
})

authRouter.post('/resend-verify', requireAuth, async (req, res) => {
  try {
    res.json({ user: await resendVerificationCode(req.user.id) })
  } catch (e) {
    const status = e.message === 'RESEND_COOLDOWN' ? 429 : e.message === 'NO_USER' ? 404 : 500
    res.status(status).json({ error: e.message })
  }
})

authRouter.put('/me/fd-key', requireAuth, async (req, res) => {
  try {
    const user = await setUserFdKey(req.user.id, req.body?.fdKey)
    res.json({ user })
  } catch (e) {
    const status =
      e.message === 'NO_USER' ? 404 : e.message === 'EMAIL_NOT_VERIFIED' ? 403 : 422
    res.status(status).json({
      error:
        e.message === 'INVALID_FD_KEY'
          ? 'Invalid football-data API key'
          : e.message === 'EMAIL_NOT_VERIFIED'
            ? 'Verify your email first'
            : e.message,
    })
  }
})

authRouter.delete('/me/fd-key', requireAuth, (req, res) => {
  try {
    res.json({ user: clearUserFdKey(req.user.id) })
  } catch (e) {
    res.status(e.message === 'NO_USER' ? 404 : e.message === 'EMAIL_NOT_VERIFIED' ? 403 : 500).json({
      error: e.message === 'EMAIL_NOT_VERIFIED' ? 'Verify your email first' : e.message,
    })
  }
})