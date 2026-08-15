import { useState, useEffect } from 'react'

const COLOR = {
  goal: 'bg-pitch-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]',
  card: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  substitution: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]',
  redcard: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
  var: 'bg-violet-400',
  period: 'bg-ink-600',
  event: 'bg-ink-500',
  incident: 'bg-ink-500',
  penalty: 'bg-pitch-500',
}

const LABEL = {
  goal: 'Goal',
  penalty: 'Penalty',
  card: 'Card',
  redcard: 'Red card',
  substitution: 'Sub',
  var: 'VAR',
  period: '',
  event: '',
  incident: '',
}

export default function Commentary({ matchId, status }) {
  const live = status === 'LIVE'
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false

    const load = () => {
      setState((s) => (s === 'ready' ? s : 'loading'))
      fetch(`/api/matches/${matchId}/commentary`)
        .then((r) => { if (!r.ok) throw new Error('failed'); return r.json() })
        .then((d) => {
          if (cancelled) return
          setData(d)
          setState(d.items && d.items.length ? 'ready' : 'empty')
        })
        .catch(() => { if (!cancelled) setState('error') })
    }

    load()
    if (!live) return () => { cancelled = true }

    const timer = setInterval(load, 45000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [matchId, live])

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-3 text-ink-500 text-sm py-4">
        <div className="w-5 h-5 border-2 border-pitch-500 border-t-transparent rounded-full animate-spin" />
        {live ? 'Loading commentary...' : 'Loading match recap...'}
      </div>
    )
  }

  if (state === 'empty' || state === 'error') {
    if (!live && status === 'UPCOMING') return null
    return (
      <div className="bg-night-800 rounded-lg border border-night-750 p-8 text-center shadow-lg">
        <p className="font-headline text-2xl mb-2">{live ? '🎙️' : '📄'}</p>
        <p className="text-ink-500 text-sm">
          {state === 'error'
            ? "Couldn't load commentary at the moment."
            : live
              ? 'Commentary will appear here as the match unfolds.'
              : 'No commentary available for this match.'}
        </p>
      </div>
    )
  }

  return (
    <section className="bg-night-800 rounded-lg p-6 shadow-lg border border-night-750">
      <div className="flex justify-between items-end mb-6 border-b border-night-750 pb-4">
        <h3 className="font-headline font-bold text-2xl text-ink-100 tracking-tight flex items-center">
          {live ? (
            <>
              Live Commentary
              <span className="ml-3 flex items-center px-2 py-0.5 bg-pitch-500/10 rounded-full border border-pitch-500/20">
                <span className="w-2 h-2 rounded-full bg-pitch-500 pulse-dot mr-1.5" />
                <span className="text-pitch-400 text-xs font-bold uppercase tracking-wider">Live</span>
              </span>
            </>
          ) : (
            'Match Commentary'
          )}
        </h3>
        <span className="text-xs text-ink-600 font-medium flex items-center bg-night-950 px-2 py-1 rounded">
          via {data?.source}
        </span>
      </div>

      <ul className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
        {data.items.map((item, i) => {
          const dotColor = COLOR[item.type] || 'bg-ink-500'
          const sideDot = item.side === 'home' ? 'bg-red-600' : item.side === 'away' ? 'bg-sky-400' : null
          return (
            <li
              key={i}
              className="flex items-start gap-3 py-2.5 border-b-[1px] border-night-950/60 last:border-0 px-2 rounded hover:bg-night-950/30 transition-colors"
            >
              <span className="w-10 shrink-0 text-right text-xs text-ink-600 font-bold tabular-nums pt-1">
                {String(item.minute).padStart(2, '0')}&#39;
              </span>
              <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink-100 font-medium leading-relaxed">{item.text}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                {LABEL[item.type] && (
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-night-950 text-ink-500 ${
                    item.type === 'goal' ? 'text-pitch-400' : ''
                  }`}>
                    {LABEL[item.type]}
                  </span>
                )}
                {sideDot && <span className={`w-2 h-2 rounded-full ${sideDot}`} />}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}