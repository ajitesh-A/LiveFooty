export function kickoffLabel(match) {
  const d = new Date(match.date)
  if (isNaN(d.getTime())) return match.time || '--:--'

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((day - today) / 86400000)

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ||
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (diff === 0) return `Today \u00b7 ${time}`
  if (diff === 1) return `Tomorrow \u00b7 ${time}`
  if (diff === -1) return `Yesterday \u00b7 ${time}`

  const label = d.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return `${label} \u00b7 ${time}`
}