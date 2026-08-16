const API_BASE = '/api'

export async function fetchMatches(league) {
  const params = league ? `?league=${encodeURIComponent(league)}` : ''
  const res = await fetch(`${API_BASE}/matches${params}`)
  if (!res.ok) throw new Error('Failed to fetch matches')
  return res.json()
}

export async function fetchMatch(id) {
  const res = await fetch(`${API_BASE}/matches/${id}`)
  if (!res.ok) throw new Error('Match not found')
  return res.json()
}

export async function fetchStreams(matchId) {
  const res = await fetch(`${API_BASE}/streams/${matchId}`)
  if (!res.ok) throw new Error('No streams available')
  return res.json()
}

export async function fetchArchive(from, to) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const res = await fetch(`${API_BASE}/archive?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch archive')
  return res.json()
}

export function getProxyUrl(streamUrl) {
  return `${API_BASE}/proxy?url=${encodeURIComponent(streamUrl)}`
}

export const LEAGUES = [
  { id: 'all', name: 'All', emoji: '🏆' },
  { id: 'UEFA Champions League', name: 'UCL', emoji: '⭐' },
  { id: 'Premier League', name: 'Premier League', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'La Liga', name: 'La Liga', emoji: '🇪🇸' },
  { id: 'Serie A', name: 'Serie A', emoji: '🇮🇹' },
  { id: 'Bundesliga', name: 'Bundesliga', emoji: '🇩🇪' },
  { id: 'Ligue 1', name: 'Ligue 1', emoji: '🇫🇷' },
  { id: 'Championship', name: 'Championship', emoji: '🏴‍☠️' },
  { id: 'Eredivisie', name: 'Eredivisie', emoji: '🇳🇱' },
  { id: 'Primeira Liga', name: 'Primeira Liga', emoji: '🇵🇹' },
  { id: 'Brasileirão', name: 'Brasileirão', emoji: '🇧🇷' },
  { id: 'European Championship', name: 'Euro', emoji: '🏆' },
  { id: 'FIFA World Cup', name: 'World Cup', emoji: '🌍' },
]

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
export function verifyAccount(code) {
  return apiFetch('/auth/verify', { method: 'POST', body: JSON.stringify({ code }) })
}
export function resendVerification() {
  return apiFetch('/auth/resend-verify', { method: 'POST' })
}
export function saveFdKey(fdKey) { return apiFetch('/auth/me/fd-key', { method: 'PUT', body: JSON.stringify({ fdKey }) }) }
export function removeFdKey() { return apiFetch('/auth/me/fd-key', { method: 'DELETE' }) }
