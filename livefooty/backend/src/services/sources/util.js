export function inWindow(dateIso, { pastDays = 7, futureDays = 21 } = {}) {
  const t = new Date(dateIso).getTime()
  if (isNaN(t)) return false
  const now = Date.now()
  const past = now - pastDays * 86400000
  const future = now + (futureDays + 1) * 86400000
  return t >= past && t <= future
}

export function cleanTeam(name) {
  return (name || '')
    .replace(/\s*(FC|CF|AC|SC|AFC|AS|Club Deportivo)\s*$/i, '')
    .trim()
}

export function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}