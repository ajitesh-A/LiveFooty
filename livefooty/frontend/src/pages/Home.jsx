import { useState, useEffect, useCallback } from 'react'
import MatchCard from '../components/MatchCard'
import LeagueFilter from '../components/LeagueFilter'
import { useMatches } from '../hooks/useMatches'
import { fetchArchive } from '../services/api'

const ARCHIVE_MIN = '2026-05-15'

function dayKey(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function todayKey() {
  return dayKey(new Date())
}

function yesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return dayKey(d)
}

function shiftKey(key, delta) {
  const d = new Date(`${key}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return dayKey(d)
}

function SectionHeader({ children, pulse = false }) {
  return (
    <div className="flex items-center gap-2.5">
      {pulse && <span className="w-3 h-3 rounded-full bg-danger-500 pulse-live" />}
      <h2 className="font-headline text-xl md:text-2xl font-semibold text-ink-100 tracking-tight">
        {children}
      </h2>
    </div>
  )
}

export default function Home() {
  const [activeLeague, setActiveLeague] = useState(null)
  const { matches, loading, error, load } = useMatches()

  const [archDay, setArchDay] = useState(yesterdayKey())
  const [archive, setArchive] = useState({ matches: [], loading: false, error: null })

  useEffect(() => {
    load(activeLeague)
  }, [activeLeague, load])

  const loadArchive = useCallback(async (day) => {
    try {
      setArchive({ matches: [], loading: true, error: null })
      const data = await fetchArchive(day, day)
      setArchive({ matches: data.matches, loading: false, error: null })
    } catch (e) {
      setArchive({ matches: [], loading: false, error: e.message })
    }
  }, [])

  useEffect(() => {
    loadArchive(archDay)
  }, [archDay, loadArchive])

  const live = matches.filter((m) => m.status === 'LIVE')
  const upcoming = matches.filter((m) => m.status === 'UPCOMING')
  const finished = matches.filter((m) => m.status === 'FT')

  const archiveMatches = archive.matches.filter(
    (m) => !activeLeague || m.league === activeLeague
  )

  return (
    <div className="flex-grow pb-20">
      <div className="max-w-[1120px] mx-auto px-4 md:px-6 flex flex-col gap-16">
        {/* Hero */}
        <section className="relative flex flex-col items-center justify-center text-center pt-20 pb-6 gap-5">
          <div
            className="absolute inset-0 z-[-1] opacity-20 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle at center, #22c55e 0%, transparent 50%)' }}
          />
          <h1 className="font-headline text-4xl md:text-6xl font-bold text-ink-100 tracking-tight leading-tight">
            Live Football
          </h1>
          <p className="text-lg text-ink-500 max-w-2xl">
            Free streaming, minimal lag. Don't miss a single moment of the action.
          </p>
        </section>

        {/* League filters */}
        <section>
          <LeagueFilter active={activeLeague} onChange={setActiveLeague} />
        </section>

        {error && (
          <div className="bg-red-950/40 border border-red-900 rounded-card p-4 text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => load(activeLeague)}
              className="mt-2 text-xs text-red-300 underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-24">
            <div className="w-9 h-9 border-2 border-pitch-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && !error && (
          <>
            {live.length > 0 && (
              <section className="flex flex-col gap-5">
                <SectionHeader pulse>Live Now</SectionHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {live.map((m) => <MatchCard key={m.id} match={m} />)}
                </div>
              </section>
            )}

            {upcoming.length > 0 && (
              <section className="flex flex-col gap-5">
                <SectionHeader>Upcoming Matches</SectionHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {upcoming.map((m) => <MatchCard key={m.id} match={m} />)}
                </div>
              </section>
            )}

            {finished.length > 0 && (
              <section className="flex flex-col gap-5">
                <SectionHeader>Recent Results</SectionHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {finished.map((m) => <MatchCard key={m.id} match={m} />)}
                </div>
              </section>
            )}

            {/* Archive */}
            <section className="flex flex-col gap-5">
              <SectionHeader>Past Matches</SectionHeader>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setArchDay((d) => shiftKey(d, -1))}
                  disabled={archDay <= ARCHIVE_MIN}
                  className="card-surface rounded-lg px-4 py-2 text-sm text-ink-300 hover:text-pitch-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  ◀ Previous
                </button>
                <input
                  type="date"
                  value={archDay}
                  min={ARCHIVE_MIN}
                  max={todayKey()}
                  onChange={(e) => e.target.value && setArchDay(e.target.value)}
                  className="card-surface rounded-lg px-3 py-2 text-sm text-ink-100 tabular-nums"
                />
                <button
                  onClick={() => setArchDay((d) => shiftKey(d, 1))}
                  disabled={archDay >= todayKey()}
                  className="card-surface rounded-lg px-4 py-2 text-sm text-ink-300 hover:text-pitch-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  Next ▶
                </button>
              </div>

              {archive.error && (
                <div className="bg-red-950/40 border border-red-900 rounded-card p-4 text-center">
                  <p className="text-red-400 text-sm">{archive.error}</p>
                </div>
              )}

              {archive.loading && (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-pitch-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!archive.loading && !archive.error && (
                archiveMatches.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {archiveMatches.map((m) => <MatchCard key={m.id} match={m} />)}
                  </div>
                ) : (
                  <div className="card-surface rounded-card p-8 text-center">
                    <p className="text-ink-500 text-sm">No matches recorded on {archDay}</p>
                    <p className="text-ink-600 text-xs mt-1">
                      Archive covers {ARCHIVE_MIN} — {todayKey()}
                    </p>
                  </div>
                )
              )}
            </section>

            {matches.length === 0 && (
              <div className="text-center py-24">
                <p className="font-headline text-4xl mb-3">⚽</p>
                <p className="text-ink-500 text-sm">No matches found</p>
                <p className="text-ink-600 text-xs mt-1">Check back closer to the next matchday</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}