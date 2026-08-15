# Account System with Per-User API Keys — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accounts so each user can save their own football-data.org key, which the backend uses for that user's lineups requests.

**Architecture:** JSON user store (`data/users.json`) + node:crypto scrypt password hashing + HMAC-signed session tokens (secret persisted in `data/secret.key`). Authenticated users' lineups calls use their own football-data key; guests and archive sync use the server `.env` key. Frontend gets AuthContext, Login/Register/Account pages.

**Tech Stack:** Node 22 ESM, Express 4, node:crypto (scrypt, HMAC, randomBytes), React 18 + react-router 6, Tailwind (existing card/ink/pitch theme).

## Global Constraints

- **Zero new npm dependencies** (design decision — everything from node:crypto).
- User data lives in `backend/data/` (already gitignored) — same atomic-write pattern as `archive.json`.
- The football-data key is stored but **never echoed** by any API response; `user` payload is `{id, email, createdAt, hasFdKey}`.
- Shared caches (official scores, archive) stay server-keyed; only lineups use the per-user key.
- No test framework exists in this repo — verification is done with `node -e` assertions and HTTP checks via PowerShell `Invoke-RestMethod`.
- Token: `Authorization: Bearer <token>`; 30-day expiry.

---

### Task 1: Auth service (store, hashing, sessions, key validation)

**Files:**
- Create: `backend/src/services/auth.js`
- Test/verify: inline `node -e` checks

**Interfaces:**
- Produces (consumed by Tasks 2–3):
  - `registerUser(email, password)` → `{ token, user }` | throws `Error('EMAIL_TAKEN')`
  - `loginUser(email, password)` → `{ token, user }` | throws `Error('BAD_LOGIN')`
  - `getUserByToken(token)` → `user` object (with `fdKey`) | `null`
  - `setUserFdKey(userId, fdKey)` → validates via live football-data call, persists; throws `Error('INVALID_FD_KEY')` on failure
  - `clearUserFdKey(userId)`
  - `sanitizeUser(u)` → `{id, email, createdAt, hasFdKey}`
  - `user` store shape: `{ id, email, passHash, fdKey: string|null, createdAt }`

- [ ] **Step 1: Write the service**

`backend/src/services/auth.js` (complete implementation):

```js
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import axios from 'axios'

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data')
const USERS_PATH = path.join(DATA_DIR, 'users.json')
const SECRET_PATH = path.join(DATA_DIR, 'secret.key')
const TOKEN_TTL = 30 * 24 * 3600 * 1000

fs.mkdirSync(DATA_DIR, { recursive: true })

let users = []
try { users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')) } catch { users = [] }

let SECRET
try { SECRET = fs.readFileSync(SECRET_PATH, 'utf8').trim() } catch {
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
  return { id: u.id, email: u.email, createdAt: u.createdAt, hasFdKey: Boolean(u.fdKey) }
}

export function registerUser(email, password) {
  const clean = String(email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error('BAD_EMAIL')
  if (!password || password.length < 6) throw new Error('WEAK_PASSWORD')
  if (users.some((u) => u.email === clean)) throw new Error('EMAIL_TAKEN')

  const user = {
    id: crypto.randomUUID(),
    email: clean,
    passHash: hashPassword(password),
    fdKey: null,
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  save()
  return { token: signToken(user.id), user: sanitizeUser(user) }
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
  const key = String(fdKey || '').trim()
  if (!key) throw new Error('INVALID_FD_KEY')
  const res = await axios.get('https://api.football-data.org/v4/matches?limit=1', {
    timeout: 12000,
    headers: { 'X-Auth-Token': key },
    validateStatus: () => true,
  })
  if (res.status !== 200) throw new Error('INVALID_FD_KEY')

  const user = users.find((u) => u.id === userId)
  if (!user) throw new Error('NO_USER')
  user.fdKey = key
  save()
  return sanitizeUser(user)
}

export function clearUserFdKey(userId) {
  const user = users.find((u) => u.id === userId)
  if (!user) throw new Error('NO_USER')
  user.fdKey = null
  save()
  return sanitizeUser(user)
}

export function getUserFdKey(user) {
  return user?.fdKey || null
}
```

- [ ] **Step 2: Verify service behavior**

Run:
```powershell
node -e "import('./src/services/auth.js').then(async (m) => { const r1 = m.registerUser('a@b.com', 'secret1'); const r2 = m.loginUser('a@b.com', 'secret1'); console.log('token roundtrip:', r1.token === r2.token); console.log('me:', JSON.stringify(m.getUserByToken(r2.token) ? m.sanitizeUser(m.getUserByToken(r2.token)) : null)); let dup = false; try { m.registerUser('a@b.com', 'xxxxxx') } catch (e) { dup = e.message === 'EMAIL_TAKEN' } console.log('dup rejected:', dup); let bad = false; try { m.loginUser('a@b.com', 'wrong') } catch (e) { bad = e.message === 'BAD_LOGIN' } console.log('bad login rejected:', bad); })"
```
Expected: `token roundtrip: true`, `me: {"id":"...","email":"a@b.com","createdAt":"...","hasFdKey":false}`, `dup rejected: true`, `bad login rejected: true`. Then **delete `backend/data/users.json` and `backend/data/secret.key`** to reset for real use.

- [ ] **Step 3: Commit** (only if user asked for commits — otherwise skip; repo has no commit workflow from prior tasks)

---

### Task 2: Auth routes + middleware, mounted in index.js

**Files:**
- Create: `backend/src/middleware/auth.js`
- Create: `backend/src/routes/auth.js`
- Modify: `backend/src/index.js` (mount router)

**Interfaces:**
- Consumes: Task 1 exports (`registerUser`, `loginUser`, `getUserByToken`, `setUserFdKey`, `clearUserFdKey`, `sanitizeUser`)
- Produces (consumed by Task 3):
  - `optionalAuth` middleware → sets `req.user` (full user incl. `fdKey`) or undefined
  - `requireAuth` middleware → 401 `{error}` if no valid token

- [ ] **Step 1: Create middleware**

`backend/src/middleware/auth.js`:
```js
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
```

- [ ] **Step 2: Create routes**

`backend/src/routes/auth.js`:
```js
import { Router } from 'express'
import { registerUser, loginUser, setUserFdKey, clearUserFdKey, sanitizeUser } from '../services/auth.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

authRouter.post('/register', (req, res) => {
  try {
    res.status(201).json(registerUser(req.body?.email, req.body?.password))
  } catch (e) {
    res.status(e.message === 'EMAIL_TAKEN' ? 409 : 422).json({ error: e.message })
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

authRouter.put('/me/fd-key', requireAuth, async (req, res) => {
  try {
    const user = await setUserFdKey(req.user.id, req.body?.fdKey)
    res.json({ user })
  } catch (e) {
    res.status(e.message === 'NO_USER' ? 404 : 422).json({ error: e.message === 'INVALID_FD_KEY' ? 'Invalid football-data API key' : e.message })
  }
})

authRouter.delete('/me/fd-key', requireAuth, (req, res) => {
  try {
    res.json({ user: clearUserFdKey(req.user.id) })
  } catch (e) {
    res.status(404).json({ error: e.message })
  }
})
```

- [ ] **Step 3: Mount in index.js**

In `backend/src/index.js` add imports and mount:
```js
import { authRouter } from './routes/auth.js'
```
and after `app.use('/api/archive', archiveRouter)`:
```js
app.use('/api/auth', authRouter)
```

- [ ] **Step 4: Verify end-to-end routes**

Restart backend (`Stop-Process` on port 3001 listener, then `Start-Process node src/index.js`), then:
```powershell
$r = Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/auth/register" -Body (@{email='tester@x.com'; password='secret1'} | ConvertTo-Json) -ContentType 'application/json'
Write-Output "register token: $($r.token.Length -gt 20)"
$h = @{ Authorization = "Bearer $($r.token)" }
$me = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/me" -Headers $h
Write-Output "me: $($me.user.email) hasFdKey=$($me.user.hasFdKey)"
$b = $null
try { Invoke-RestMethod -Method Put -Uri "http://localhost:3001/api/auth/me/fd-key" -Headers $h -Body (@{fdKey='definitely-not-a-key'} | ConvertTo-Json) -ContentType 'application/json' } catch { $b = $_.Exception.Response.StatusCode.value__ }
Write-Output "invalid key -> $b (expect 422)"
$u = $null
try { Invoke-RestMethod -Uri "http://localhost:3001/api/auth/me" } catch { $u = $_.Exception.Response.StatusCode.value__ }
Write-Output "no token -> $u (expect 401)"
```
Expected: `register token: True`, `me: tester@x.com hasFdKey=False`, `invalid key -> 422`, `no token -> 401`. Then `Invoke-RestMethod -Method Delete -Uri "http://localhost:3001/api/auth/me" ...` — not needed; leave tester account or delete `data/users.json` after.

---

### Task 3: Per-user key plumbing into lineups

**Files:**
- Modify: `backend/src/services/lineups.js` (`fromFootballdata`, `getLineups` signature)
- Modify: `backend/src/routes/matches.js` (lineups route passes user key)
- Modify: `backend/src/index.js` (apply `optionalAuth` to matches router)
- Modify: `backend/src/services/archive.js` (optional — nothing changes; `getCachedArchivedLineups` stays env-keyed since it's a shared cache)

**Interfaces:**
- Consumes: `optionalAuth` (Task 2), `getUserFdKey` (Task 1)
- Produces: `getLineups(match, { apiKey })` — apiKey param optional; falls back to env

- [ ] **Step 1: Thread apiKey through lineups.js**

In `backend/src/services/lineups.js` change `fromFootballdata` to accept a key:
```js
async function fromFootballdata(match, apiKey) {
  const fdId = match.ids?.fd ?? String(match.id || '').match(/^fd-(\d+)$/)?.[1]
  if (!fdId) return null
  const key = apiKey || process.env.FOOTBALL_DATA_API_KEY
  if (!key) return null
  ...
```
and `getLineups`:
```js
export async function getLineups(match, { apiKey } = {}) {
  if (!isEligible(match)) return { ...emptyResult(), reason: 'lineups-not-confirmed' }
  const adapters = [
    (m) => fromFootballdata(m, apiKey),
    fromSofaScore,
    fromFotMob,
    fromTheSportsDB,
  ]
  ...
```

- [ ] **Step 2: Pass user key in matches route**

In `backend/src/routes/matches.js` — add import `getUserFdKey` and change the lineups route:
```js
const lineups = (await isLiveMatch(match.id))
  ? await getLineups(match, { apiKey: getUserFdKey(req.user) })
  : await getCachedArchivedLineups(match)
```
`req.user` is undefined for guests → `getUserFdKey(undefined)` → `null` → env fallback. (The `fromFootballdata` `apiKey` param can also be a plain string, so `getUserFdKey(req.user)` returning null is fine.)

- [ ] **Step 3: Apply optionalAuth to matches router**

In `backend/src/index.js`:
```js
import { optionalAuth } from './middleware/auth.js'
...
app.use('/api/matches', optionalAuth, matchesRouter)
```

- [ ] **Step 4: Verify**

With the tester account from Task 2 (no valid fd key), an authed lineups request and a guest lineups request must BOTH still return 200 (fallback to env key when user has none):
```powershell
$mid = (Invoke-RestMethod -Uri "http://localhost:3001/api/matches" | Where-Object { $_.status -eq 'FT' } | Select-Object -First 1).id
$g = Invoke-RestMethod -Uri "http://localhost:3001/api/matches/$mid/lineups" -TimeoutSec 40
Write-Output "guest lineups ok: $($null -ne $g)"
```
Expected: `guest lineups ok: True` (source may be `football-data` via env key, or null result — must not 401).

---

### Task 4: Frontend auth

**Files:**
- Create: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/pages/Login.jsx`
- Create: `frontend/src/pages/Register.jsx`
- Create: `frontend/src/pages/Account.jsx`
- Create: `frontend/src/components/ProtectedRoute.jsx`
- Modify: `frontend/src/services/api.js` (auth fetch helpers + token header for matches lineups? — no: lineups use default fetch; only /auth endpoints need token unless we pass it; simplest: add `setAuthToken`/`getAuthToken` helpers used by AuthContext and a `fetchWithAuth` for auth routes)
- Modify: `frontend/src/main.jsx` (mount AuthProvider)
- Modify: `frontend/src/App.jsx` (routes)
- Modify: `frontend/src/components/Navbar.jsx` (sign-in / account menu)

**Interfaces:**
- Consumes: backend routes from Task 2 (`POST /api/auth/*`)
- Produces: `AuthContext` with `{ user, token, loading, login(), register(), logout(), saveFdKey(), removeFdKey() }`

- [ ] **Step 1: api.js auth helpers**

In `frontend/src/services/api.js` append:
```js
let authToken = null
export function setAuthToken(t) { authToken = t }
export function getAuthToken() { return authToken }

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  if (options.body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export function registerAccount(email, password) {
  return apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) })
}
export function loginAccount(email, password) {
  return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}
export function fetchMe() { return apiFetch('/auth/me') }
export function saveFdKey(fdKey) { return apiFetch('/auth/me/fd-key', { method: 'PUT', body: JSON.stringify({ fdKey }) }) }
export function removeFdKey() { return apiFetch('/auth/me/fd-key', { method: 'DELETE' }) }
```

- [ ] **Step 2: AuthContext**

`frontend/src/context/AuthContext.jsx`:
```jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { registerAccount, loginAccount, fetchMe, saveFdKey, removeFdKey, setAuthToken } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('lf_token')
    if (!token) { setLoading(false); return }
    setAuthToken(token)
    fetchMe()
      .then((d) => setUser(d.user))
      .catch(() => localStorage.removeItem('lf_token'))
      .finally(() => setLoading(false))
  }, [])

  const apply = useCallback((data) => {
    setAuthToken(data.token)
    localStorage.setItem('lf_token', data.token)
    setUser(data.user)
  }, [])

  const login = useCallback(async (email, password) => apply(await loginAccount(email, password)), [apply])
  const register = useCallback(async (email, password) => apply(await registerAccount(email, password)), [apply])
  const logout = useCallback(() => {
    setAuthToken(null)
    localStorage.removeItem('lf_token')
    setUser(null)
  }, [])
  const saveKey = useCallback(async (key) => setUser(await saveFdKey(key)), [])
  const removeKey = useCallback(async () => setUser(await removeFdKey()), [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, saveKey, removeKey }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 3: Login/Register pages**

`frontend/src/pages/Login.jsx`:
```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const input = 'card-surface rounded-lg px-4 py-2.5 w-full text-sm text-ink-100 outline-none border border-night-650 focus:border-pitch-500'

  return (
    <div className="flex-grow flex items-start justify-center pt-24 px-4">
      <form onSubmit={submit} className="card-surface rounded-card p-8 w-full max-w-md flex flex-col gap-4">
        <h1 className="font-headline text-2xl font-semibold text-ink-100">Sign in</h1>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button disabled={busy} className="bg-pitch-500 hover:bg-pitch-400 disabled:opacity-50 text-night-950 font-semibold rounded-lg py-2.5 text-sm transition-colors">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-xs text-ink-500 text-center">
          No account? <Link to="/register" className="text-pitch-400 hover:underline">Create one</Link>
        </p>
      </form>
    </div>
  )
}
```

`frontend/src/pages/Register.jsx` — identical structure with `register` and a password length `minLength={6}`; copy Login.jsx and swap `login` → `register`, title "Create account", link to `/login` ("Already have an account?").

- [ ] **Step 4: Account page**

`frontend/src/pages/Account.jsx`:
```jsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Account() {
  const { user, saveKey, removeKey, logout } = useAuth()
  const [fdKey, setFdKey] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveKey(fdKey)
      setFdKey('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const input = 'card-surface rounded-lg px-4 py-2.5 w-full text-sm text-ink-100 outline-none border border-night-650 focus:border-pitch-500'

  return (
    <div className="flex-grow flex items-start justify-center pt-24 px-4">
      <div className="card-surface rounded-card p-8 w-full max-w-md flex flex-col gap-5">
        <h1 className="font-headline text-2xl font-semibold text-ink-100">My account</h1>
        <p className="text-sm text-ink-400">Signed in as <span className="text-ink-100">{user.email}</span></p>

        <div className="flex flex-col gap-2">
          <h2 className="text-label-caps text-ink-500">Football-data API key</h2>
          {user.hasFdKey ? (
            <p className="text-sm text-pitch-400">✓ Saved — your lineups requests use your own key (10 req/min)</p>
          ) : (
            <p className="text-sm text-ink-500">No key yet — lineups fall back to the shared server key.</p>
          )}
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="password"
              placeholder="Paste your key from football-data.org"
              value={fdKey}
              onChange={(e) => setFdKey(e.target.value)}
              className={input}
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button disabled={!fdKey.trim() || busy} className="bg-pitch-500 hover:bg-pitch-400 disabled:opacity-50 text-night-950 font-semibold rounded-lg py-2.5 text-sm transition-colors flex-1">
                {busy ? 'Checking…' : 'Save key'}
              </button>
              {user.hasFdKey && (
                <button type="button" onClick={async () => { await removeKey(); setFdKey('') }} className="card-surface rounded-lg py-2.5 px-4 text-sm text-ink-400 hover:text-red-400 transition-colors">
                  Remove
                </button>
              )}
            </div>
          </form>
        </div>

        <button onClick={logout} className="card-surface rounded-lg py-2.5 text-sm text-ink-400 hover:text-red-400 transition-colors">
          Sign out
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: ProtectedRoute + wiring**

`frontend/src/components/ProtectedRoute.jsx`:
```jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex justify-center pt-24"><div className="w-8 h-8 border-2 border-pitch-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}
```

`frontend/src/main.jsx` — wrap `<App />` with `<AuthProvider>` (import `{ AuthProvider } from './context/AuthContext'`).

`frontend/src/App.jsx` — add routes:
```jsx
import Login from './pages/Login'
import Register from './pages/Register'
import Account from './pages/Account'
import ProtectedRoute from './components/ProtectedRoute'
```
and inside the existing `<Routes>`:
```jsx
<Route path="/login" element={<Login />} />
<Route path="/register" element={<Register />} />
<Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
```

`frontend/src/components/Navbar.jsx` — read the file first, then add: `const { user, logout } = useAuth()`; render a right-side item:
```jsx
{user ? (
  <Link to="/account" className="text-sm text-ink-300 hover:text-pitch-400 transition-colors">{user.email.split('@')[0]}</Link>
) : (
  <Link to="/login" className="text-sm text-ink-300 hover:text-pitch-400 transition-colors">Sign in</Link>
)}
```
Adapt to the Navbar's existing structure/classes.

- [ ] **Step 6: Build + verify UI**

Run `npm run build` in `frontend/` (must pass). Then full-stack manual check via browser or the webapp-testing skill (open `http://localhost:3001/` → Sign in → register/login → account → error on bad key vs. success on real key → sign out).

---

### Task 5: Env fallback + final verification sweep

**Files:**
- None new — verification only.

- [ ] **Step 1: Verify guest + authed + archive unaffected**

```powershell
# guests still see everything
Invoke-RestMethod -Uri "http://localhost:3001/api/matches" | Out-Null; Write-Output "matches ok"
Invoke-RestMethod -Uri "http://localhost:3001/api/archive/status" | Out-Null; Write-Output "archive ok"
# a lineups call with a fake-but-valid-format user key? No — skip; only real keys accepted.
```
- [ ] **Step 2: Restart persistence check**

Restart backend; stored token from Task 2 must still return a user (secret persisted in `data/secret.key`):
```powershell
# after restart:
Invoke-RestMethod -Uri "http://localhost:3001/api/auth/me" -Headers $h; Write-Output "session survived restart"
```
- [ ] **Step 3: Cleanup test account data**

Delete `backend/data/users.json` (keep `secret.key`) so the shipped data dir is clean — the user registers fresh accounts.