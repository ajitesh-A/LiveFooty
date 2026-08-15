import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import axios from 'axios'
import { sendVerificationCode } from './mailer.js'

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data')
const USERS_PATH = path.join(DATA_DIR, 'users.json')
const SECRET_PATH = path.join(DATA_DIR, 'secret.key')
const TOKEN_TTL = 30 * 24 * 3600 * 1000
const CODE_TTL = 10 * 60 * 1000
const RESEND_COOLDOWN = 60 * 1000

fs.mkdirSync(DATA_DIR, { recursive: true })

let users = []
try {
  users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'))
} catch {
  users = []
}

let SECRET
try {
  SECRET = fs.readFileSync(SECRET_PATH, 'utf8').trim()
} catch {
  SECRET = crypto.randomBytes(32).toString('hex')
  fs.writeFileSync(SECRET_PATH, SECRET, { mode: 0o600 })
}

function save() {
  const tmp = `${USERS_PATH}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(users))
  fs.renameSync(tmp, USERS_PATH)
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false
  const check = crypto.scryptSync(password, salt, 64)
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), check)
}

function signToken(userId) {
  const payload = `${userId}:${Date.now() + TOKEN_TTL}`
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
  return `${payload}:${sig}`
}

function verifyToken(token) {
  const parts = String(token || '').split(':')
  if (parts.length !== 3) return null
  const [userId, exp, sig] = parts
  if (Number(exp) < Date.now()) return null
  const expected = crypto.createHmac('sha256', SECRET).update(`${userId}:${exp}`).digest('base64url')
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  return users.find((u) => u.id === userId) || null
}

export function sanitizeUser(u) {
  return {
    id: u.id,
    email: u.email,
    createdAt: u.createdAt,
    verified: Boolean(u.verified),
    hasFdKey: Boolean(u.fdKey),
  }
}

function genCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0')
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function registerUser(email, password) {
  const clean = String(email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error('BAD_EMAIL')
  if (!password || password.length < 6) throw new Error('WEAK_PASSWORD')
  if (users.some((u) => u.email === clean)) throw new Error('EMAIL_TAKEN')

  const user = {
    id: crypto.randomUUID(),
    email: clean,
    passHash: hashPassword(password),
    fdKey: null,
    verified: false,
    createdAt: new Date().toISOString(),
  }
  await issueCode(user)
  users.push(user)
  save()
  return { token: signToken(user.id), user: sanitizeUser(user) }
}

async function issueCode(user) {
  const now = Date.now()
  if (user.verifySentAt && now - user.verifySentAt < RESEND_COOLDOWN) {
    throw new Error('RESEND_COOLDOWN')
  }
  const code = genCode()
  user.verifyCodeHash = hashCode(code)
  user.verifyExpires = now + CODE_TTL
  user.verifySentAt = now
  await sendVerificationCode(user.email, code)
}

export async function verifyEmail(userId, code) {
  const clean = String(code || '').trim()
  if (!/^\d{6}$/.test(clean)) throw new Error('INVALID_CODE')
  const user = users.find((u) => u.id === userId)
  if (!user) throw new Error('NO_USER')
  if (user.verified) return sanitizeUser(user)
  if (Date.now() > (user.verifyExpires || 0)) throw new Error('CODE_EXPIRED')
  if (user.verifyCodeHash !== hashCode(clean)) throw new Error('INVALID_CODE')
  user.verified = true
  user.verifyCodeHash = undefined
  user.verifyExpires = undefined
  user.verifySentAt = undefined
  save()
  return sanitizeUser(user)
}

export async function resendVerificationCode(userId) {
  const user = users.find((u) => u.id === userId)
  if (!user) throw new Error('NO_USER')
  if (user.verified) return sanitizeUser(user)
  await issueCode(user)
  save()
  return sanitizeUser(user)
}

export function loginUser(email, password) {
  const clean = String(email || '').trim().toLowerCase()
  const user = users.find((u) => u.email === clean)
  if (!user || !verifyPassword(String(password), user.passHash)) throw new Error('BAD_LOGIN')
  return { token: signToken(user.id), user: sanitizeUser(user) }
}

export function getUserByToken(token) {
  return verifyToken(token)
}

export async function setUserFdKey(userId, fdKey) {
  const user = users.find((u) => u.id === userId)
  if (!user) throw new Error('NO_USER')
  if (!user.verified) throw new Error('EMAIL_NOT_VERIFIED')

  const key = String(fdKey || '').trim()
  if (!key) throw new Error('INVALID_FD_KEY')

  const res = await axios.get('https://api.football-data.org/v4/matches?limit=1', {
    timeout: 12000,
    headers: { 'X-Auth-Token': key },
    validateStatus: () => true,
  })
  if (res.status !== 200) throw new Error('INVALID_FD_KEY')

  user.fdKey = key
  save()
  return sanitizeUser(user)
}

export function clearUserFdKey(userId) {
  const user = users.find((u) => u.id === userId)
  if (!user) throw new Error('NO_USER')
  if (!user.verified) throw new Error('EMAIL_NOT_VERIFIED')
  user.fdKey = null
  save()
  return sanitizeUser(user)
}

export function getUserFdKey(user) {
  return user?.fdKey || null
}