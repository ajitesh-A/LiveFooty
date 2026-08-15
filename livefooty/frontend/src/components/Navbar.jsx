import { Link } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import { useAuth } from '../context/AuthContext'

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  )
}

export default function Navbar() {
  const { user } = useAuth()
  return (
    <nav className="sticky top-0 z-50 bg-night-950/95 backdrop-blur-md border-b border-night-750 shadow-md">
      <div className="max-w-[1120px] mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="font-headline text-2xl font-bold text-pitch-500 italic tracking-tighter">
            LiveFooty
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2 bg-danger-500/10 px-3 py-1 rounded-full border border-danger-500/30">
              <span className="w-2 h-2 rounded-full bg-danger-500 pulse-live" />
              <span className="text-label-caps text-danger-500">LIVE</span>
            </div>
            <span className="text-sm font-medium text-ink-500 hover:text-pitch-400 transition-colors duration-200 cursor-pointer">Leagues</span>
            <span className="text-sm font-medium text-ink-500 hover:text-pitch-400 transition-colors duration-200 cursor-pointer">Schedule</span>
            <span className="text-sm font-medium text-ink-500 hover:text-pitch-400 transition-colors duration-200 cursor-pointer">Results</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button aria-label="Search" className="text-pitch-400 hover:text-pitch-300 transition-colors">
            <Icon d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" className="w-6 h-6" />
          </button>
          {user ? (
            <Link
              to="/account"
              className="text-sm font-medium text-pitch-400 hover:text-pitch-300 transition-colors px-2"
            >
              Account
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-sm font-medium text-ink-300 hover:text-pitch-400 transition-colors px-2"
            >
              Sign in
            </Link>
          )}
          <NotificationBell />
        </div>
      </div>
    </nav>
  )
}