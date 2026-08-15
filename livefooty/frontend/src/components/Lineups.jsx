import { useState, useEffect } from 'react'

function TeamColumn({ side, align, colorClass, glowClass }) {
  if (!side) return null
  const reversed = align === 'right'

  return (
    <div>
      <div className={`flex justify-between items-center mb-4 ${reversed ? 'flex-row-reverse' : ''}`}>
        <h4 className="font-bold text-lg text-ink-100 flex items-center">
          <span className={`w-4 h-4 rounded-full ${colorClass} mr-2 ${reversed ? 'ml-2 mr-0' : ''} ${glowClass}`} />
          {side.team || (reversed ? 'AWAY' : 'HOME')}
        </h4>
        {side.formation && side.formation !== '--' && (
          <span className="text-pitch-400 font-bold tabular-nums bg-pitch-500/10 px-2 py-0.5 rounded text-sm">
            {side.formation}
          </span>
        )}
      </div>
      <ul className="space-y-1">
        {side.starters.map((p, i) => (
          <li
            key={i}
            className={`flex justify-between items-center py-2 border-b-[1px] border-night-950/60 hover:bg-night-950/30 px-2 rounded transition-colors`}
          >
            <div className={`flex items-center space-x-3 ${reversed ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <span className="w-6 text-xs text-ink-600 font-bold tabular-nums text-right group-hover:text-pitch-400 transition-colors">
                {p.shirtNumber ?? ''}
              </span>
              <span className="font-medium text-ink-100 text-sm">{p.name}</span>
            </div>
            {p.position && (
              <span className="text-xs text-ink-600 font-medium w-6 text-center">{p.position}</span>
            )}
          </li>
        ))}
      </ul>
      {side.subs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-night-750">
          <span className={`text-xs uppercase font-bold tracking-wider text-ink-600 block mb-2 ${reversed ? 'text-right' : ''}`}>
            Substitutes
          </span>
          <p className={`text-sm text-ink-500 leading-relaxed ${reversed ? 'text-right' : ''}`}>
            {side.subs.join(', ')}
          </p>
        </div>
      )}
    </div>
  )
}

export default function Lineups({ matchId }) {
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')

    fetch(`/api/matches/${matchId}/lineups`)
      .then((r) => { if (!r.ok) throw new Error('failed'); return r.json() })
      .then((d) => {
        if (cancelled) return
        setData(d)
        setState(d.home || d.away ? 'ready' : 'empty')
      })
      .catch(() => { if (!cancelled) setState('error') })

    return () => { cancelled = true }
  }, [matchId])

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-3 text-ink-500 text-sm py-4">
        <div className="w-5 h-5 border-2 border-pitch-500 border-t-transparent rounded-full animate-spin" />
        Loading lineups...
      </div>
    )
  }

  if (state === 'empty') {
    return (
      <div className="bg-night-800 rounded-lg border border-night-750 p-8 text-center shadow-lg">
        <p className="font-headline text-2xl mb-2">📋</p>
        <p className="text-ink-500 text-sm">
          {data?.reason === 'lineups-not-confirmed'
            ? 'Lineups are confirmed about an hour before kickoff. Check back closer to the match.'
            : 'Lineups not available yet for this match.'}
        </p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="bg-night-800 rounded-lg border border-night-750 p-8 text-center shadow-lg">
        <p className="text-ink-500 text-sm">Couldn't load lineups at the moment.</p>
      </div>
    )
  }

  return (
    <section className="bg-night-800 rounded-lg p-6 shadow-lg border border-night-750">
      <div className="flex justify-between items-end mb-6 border-b border-night-750 pb-4">
        <h3 className="font-headline font-bold text-2xl text-ink-100 tracking-tight">
          Confirmed Lineups
        </h3>
        <span className="text-xs text-ink-600 font-medium flex items-center bg-night-950 px-2 py-1 rounded">
          via {data?.source}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        <TeamColumn side={data.home} align="left" colorClass="bg-red-600" glowClass="shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
        <TeamColumn side={data.away} align="right" colorClass="bg-sky-400" glowClass="shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
      </div>
    </section>
  )
}