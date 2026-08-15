import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { fetchMatches } from '../services/api'

const SUBS_KEY = 'lf.subs'
const INBOX_KEY = 'lf.inbox'
const ALERTS_KEY = 'lf.alerts'
const CHECK_INTERVAL = 45000

const NotificationContext = createContext(null)

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full or unavailable — ignore
  }
}

export function NotificationProvider({ children }) {
  const [subs, setSubs] = useState(() => load(SUBS_KEY, []))
  const [inbox, setInbox] = useState(() => load(INBOX_KEY, []))
  const [desktopAlerts, setDesktopAlerts] = useState(() => load(ALERTS_KEY, false))

  const unreadCount = useMemo(() => inbox.filter((n) => !n.read).length, [inbox])

  const push = useCallback((notif) => {
    setInbox((prev) => {
      const deduped = prev.filter((n) => n.id !== notif.id)
      return [notif, ...deduped].slice(0, 50)
    })
  }, [])

  const notifyBrowser = useCallback((title, body) => {
    if (!desktopAlerts || !('Notification' in window)) return
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.svg' })
    }
  }, [desktopAlerts])

  const subscribe = useCallback((match) => {
    setSubs((prev) => {
      if (prev.some((s) => s.id === match.id)) return prev
      return [
        ...prev,
        {
          id: match.id,
          home: match.home,
          away: match.away,
          league: match.league,
          kickoff: match.date,
          status: 'UPCOMING',
        },
      ]
    })
  }, [])

  const unsubscribe = useCallback((id) => {
    setSubs((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const isSubscribed = useCallback((id) => subs.some((s) => s.id === id), [subs])

  const markAllRead = useCallback(() => {
    setInbox((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const clearInbox = useCallback(() => {
    setInbox([])
  }, [])

  const toggleDesktopAlerts = useCallback(async () => {
    const next = !desktopAlerts
    setDesktopAlerts(next)
    save(ALERTS_KEY, next)
    if (next && 'Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission()
      } catch {
        // denied or unavailable
      }
    }
  }, [desktopAlerts])

  useEffect(() => {
    save(SUBS_KEY, subs)
  }, [subs])

  useEffect(() => {
    save(INBOX_KEY, inbox)
  }, [inbox])

  useEffect(() => {
    if (!desktopAlerts || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [desktopAlerts])

  /* poller: watch subscribed matches for status changes */
  useEffect(() => {
    let active = true

    async function check() {
      let matches = []
      try {
        matches = await fetchMatches()
      } catch {
        return
      }
      if (!active) return

      const byId = new Map(matches.map((m) => [m.id, m]))

      setSubs((prevSubs) => {
        let changed = false
        const next = []
        for (const sub of prevSubs) {
          const m = byId.get(sub.id)
          if (!m) {
            const kickoffMs = sub.kickoff ? new Date(sub.kickoff).getTime() : NaN
            if (isNaN(kickoffMs) || Date.now() - kickoffMs > 2 * 3600000) {
              changed = true
              continue
            }
            next.push(sub)
            continue
          }

          if (m.status === 'LIVE' && sub.status !== 'LIVE') {
            const notif = {
              id: `live-${m.id}`,
              kind: 'live',
              title: 'Match is LIVE',
              text: `${m.home} vs ${m.away} has kicked off. Watch now.`,
              matchId: m.id,
              at: Date.now(),
              read: false,
            }
            push(notif)
            notifyBrowser(`${m.home} vs ${m.away} is LIVE`, 'The match has kicked off — watch now on LiveFooty.')
            next.push({ ...sub, status: 'LIVE' })
            changed = true
          } else if (m.status === 'FT' && sub.status === 'LIVE') {
            const notif = {
              id: `ft-${m.id}`,
              kind: 'result',
              title: 'Full time',
              text: `${m.home} ${m.homeScore ?? '-'} : ${m.awayScore ?? '-'} ${m.away} has finished.`,
              matchId: m.id,
              at: Date.now(),
              read: false,
            }
            push(notif)
            changed = true
          } else if (m.status === 'UPCOMING') {
            next.push(sub)
          } else if (m.status === 'FT' && sub.status !== 'LIVE') {
            changed = true
          }
        }
        return changed ? next : prevSubs
      })
    }

    check()
    const timer = setInterval(check, CHECK_INTERVAL)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [push, notifyBrowser])

  const value = useMemo(
    () => ({
      subs,
      inbox,
      unreadCount,
      isSubscribed,
      subscribe,
      unsubscribe,
      markAllRead,
      clearInbox,
      desktopAlerts,
      toggleDesktopAlerts,
    }),
    [subs, inbox, unreadCount, isSubscribed, subscribe, unsubscribe, markAllRead, clearInbox, desktopAlerts, toggleDesktopAlerts]
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}