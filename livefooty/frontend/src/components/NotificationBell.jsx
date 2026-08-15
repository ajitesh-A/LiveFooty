import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../notifications/NotificationContext'

function BellIcon({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const { inbox, unreadCount, markAllRead, clearInbox, desktopAlerts, toggleDesktopAlerts } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative text-pitch-400 hover:text-pitch-300 transition-colors"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger-500 text-night-950 text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-night-800 rounded-lg border border-night-750 shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-night-750">
            <span className="font-headline font-bold text-ink-100 tracking-tight">Notifications</span>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 text-ink-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={desktopAlerts}
                  onChange={toggleDesktopAlerts}
                  className="accent-pitch-500 w-3.5 h-3.5"
                />
                Desktop alerts
              </label>
              {inbox.length > 0 && (
                <>
                  <button onClick={markAllRead} className="text-pitch-400 hover:text-pitch-300">Mark all read</button>
                  <button onClick={clearInbox} className="text-ink-600 hover:text-ink-300">Clear</button>
                </>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {inbox.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-ink-500 text-sm">No notifications yet</p>
                <p className="text-ink-600 text-xs mt-1">
                  Tap "Get Notified" on an upcoming match to be alerted when it goes live.
                </p>
              </div>
            ) : (
              inbox.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setOpen(false)
                    if (n.matchId) navigate(`/match/${n.matchId}`)
                  }}
                  className="w-full text-left px-4 py-3 border-b border-night-750 last:border-b-0 hover:bg-night-900/60 transition-colors flex gap-3"
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-night-600' : 'bg-pitch-500 pulse-dot'}`}
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-ink-100">{n.title}</span>
                    <span className="block text-xs text-ink-500 mt-0.5 leading-relaxed">{n.text}</span>
                    <span className="block text-[11px] text-ink-600 mt-1">{timeAgo(n.at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}