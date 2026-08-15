import { Link } from 'react-router-dom'
import Crest from './Crest'
import { useNotifications } from '../notifications/NotificationContext'
import { kickoffLabel } from '../utils/date'

export default function MatchCard({ match }) {
  const { isSubscribed, subscribe, unsubscribe } = useNotifications()
  const isLive = match.status === 'LIVE'
  const isFinished = match.status === 'FT'
  const hasScore = isLive || isFinished
  const subscribed = isSubscribed(match.id)

  return (
    <Link
      to={`/match/${match.id}`}
      className="card-surface rounded-lg p-5 flex flex-col gap-4 relative group"
    >
      <div className="flex justify-between items-center">
        <span className="text-label-caps text-ink-600">{match.league}</span>
        {isLive && (
          <div className="bg-pitch-500/15 text-pitch-400 px-2 py-0.5 rounded text-label-caps flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pitch-500 pulse-live" />
            LIVE
          </div>
        )}
        {isFinished && (
          <span className="text-label-caps text-ink-600">FT</span>
        )}
        {!hasScore && (
          <span className="bg-night-650 text-ink-100 px-3 py-1.5 rounded border border-night-600 text-label-caps tabular-nums">
            {kickoffLabel(match)}
          </span>
        )}
      </div>

      <div className="flex justify-between items-center py-2">
        <div className="flex flex-col items-center gap-2 w-1/3">
          <Crest name={match.home} badge={match.homeBadge} />
          <span className="text-sm text-ink-100 text-center leading-tight">{match.home}</span>
        </div>
        <div className="w-1/3 text-center">
          {hasScore ? (
            <span className="font-headline text-2xl font-bold text-pitch-400 tracking-widest tabular-nums">
              {match.homeScore ?? '-'} : {match.awayScore ?? '-'}
            </span>
          ) : (
            <span className="text-label-caps text-ink-600 tracking-[0.3em]">VS</span>
          )}
        </div>
        <div className="flex flex-col items-center gap-2 w-1/3">
          <Crest name={match.away} badge={match.awayBadge} />
          <span className="text-sm text-ink-100 text-center leading-tight">{match.away}</span>
        </div>
      </div>

      <div className="flex justify-center border-t border-night-750 pt-4 mt-auto">
        {!hasScore ? (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              subscribed ? unsubscribe(match.id) : subscribe(match)
            }}
            className={`flex items-center gap-1.5 text-label-caps transition-colors ${
              subscribed ? 'text-pitch-400' : 'text-ink-500 group-hover:text-pitch-400'
            }`}
          >
            <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {subscribed ? 'Notified' : 'Get Notified'}
          </button>
        ) : (
          <span className="flex items-center gap-1.5 text-ink-500 group-hover:text-pitch-400 transition-colors text-label-caps">
            {isLive && (
              <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            {isLive ? 'Watch Live' : 'Match Details'}
          </span>
        )}
      </div>
    </Link>
  )
}