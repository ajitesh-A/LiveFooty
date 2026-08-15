import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import StreamPlayer from '../components/StreamPlayer'
import Lineups from '../components/Lineups'
import Commentary from '../components/Commentary'
import Crest from '../components/Crest'
import { fetchMatch } from '../services/api'
import { useNotifications } from '../notifications/NotificationContext'
import { kickoffLabel } from '../utils/date'

export default function MatchPage() {
  const { id } = useParams()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const { isSubscribed, subscribe, unsubscribe } = useNotifications()

  useEffect(() => {
    let cancelled = false
    fetchMatch(id)
      .then((data) => { if (!cancelled) setMatch(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="max-w-[1120px] mx-auto px-4 py-20 flex justify-center">
        <div className="w-8 h-8 border-2 border-pitch-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!match) {
    return (
      <div className="max-w-[1120px] mx-auto px-4 py-20 text-center">
        <p className="text-ink-500 mb-4">Match not found</p>
        <Link to="/" className="text-pitch-400 hover:underline text-sm">Back to matches</Link>
      </div>
    )
  }

  const showStream = match.status === 'LIVE' || match.status === 'UPCOMING'

  return (
    <div className="max-w-[1120px] mx-auto px-4 md:px-6 py-8 space-y-8">
      <div className="flex items-center">
        <Link
          to="/"
          className="flex items-center text-pitch-400 hover:text-pitch-300 transition-colors font-medium"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
      </div>

      {/* Match header card */}
      <section className="bg-night-800 rounded-lg p-6 md:p-8 shadow-lg border border-night-750">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="flex items-center gap-3">
            <span className="text-ink-500 text-sm font-medium tracking-wide uppercase">
              {match.league}
            </span>
            {match.status === 'LIVE' && (
              <div className="flex items-center px-2 py-0.5 bg-pitch-500/10 rounded-full border border-pitch-500/20">
                <span className="w-2 h-2 rounded-full bg-pitch-500 pulse-dot mr-1.5" />
                <span className="text-pitch-400 text-xs font-bold uppercase tracking-wider">Live</span>
              </div>
            )}
          </div>
          {match.status === 'UPCOMING' && (
            <div className="flex items-center gap-3">
              <span className="text-ink-600 text-sm font-medium">{kickoffLabel(match)}</span>
              <button
                onClick={() => (isSubscribed(match.id) ? unsubscribe(match.id) : subscribe(match))}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${
                  isSubscribed(match.id)
                    ? 'bg-pitch-500/15 text-pitch-400 border-pitch-500/30'
                    : 'bg-night-950 text-ink-500 border-night-600 hover:text-pitch-400 hover:border-pitch-500/40'
                }`}
              >
                {isSubscribed(match.id) ? '✓ Notify set' : '⏰ Get Notified'}
              </button>
            </div>
          )}

          <div className="flex items-center justify-center w-full space-x-8 md:space-x-16">
            <div className="flex flex-col items-center flex-1 space-y-3">
              <div className="w-20 h-20 rounded-full bg-night-950 flex items-center justify-center shadow-inner border border-night-700">
                <Crest name={match.home} badge={match.homeBadge} size="xl" />
              </div>
              <h2 className="font-headline font-bold text-xl md:text-3xl text-ink-100">
                {match.home}
              </h2>
            </div>

            <div className="flex items-center space-x-4">
              {match.status === 'LIVE' || match.status === 'FT' ? (
                <>
                  <span className="font-headline font-bold text-5xl md:text-7xl tabular-nums text-ink-100">
                    {match.homeScore ?? '-'}
                  </span>
                  <span className="font-headline text-3xl md:text-5xl text-ink-500">:</span>
                  <span className="font-headline font-bold text-5xl md:text-7xl tabular-nums text-ink-100">
                    {match.awayScore ?? '-'}
                  </span>
                </>
              ) : (
                <span className="font-headline text-3xl md:text-4xl font-semibold text-ink-600 tracking-[0.3em]">
                  VS
                </span>
              )}
            </div>

            <div className="flex flex-col items-center flex-1 space-y-3">
              <div className="w-20 h-20 rounded-full bg-night-950 flex items-center justify-center shadow-inner border border-night-700">
                <Crest name={match.away} badge={match.awayBadge} size="xl" />
              </div>
              <h2 className="font-headline font-bold text-xl md:text-3xl text-ink-100">
                {match.away}
              </h2>
            </div>
          </div>
        </div>
      </section>

      {showStream ? (
        <>
          <StreamPlayer matchId={id} />
          <Commentary matchId={id} status={match.status} />
          <Lineups matchId={id} />
        </>
      ) : (
        <>
          <div className="bg-night-800 rounded-lg border border-night-750 p-8 text-center">
            <p className="text-ink-500 text-sm">🏁 This match has ended</p>
          </div>
          <Commentary matchId={id} status={match.status} />
          <Lineups matchId={id} />
        </>
      )}
    </div>
  )
}