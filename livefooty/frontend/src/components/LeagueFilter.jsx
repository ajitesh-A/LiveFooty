import { LEAGUES } from '../services/api'

export default function LeagueFilter({ active, onChange }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
      {LEAGUES.map((league) => {
        const isActive = (active === null && league.id === 'all') || active === league.id
        return (
          <button
            key={league.id}
            onClick={() => onChange(league.id === 'all' ? null : league.id)}
            className={`px-5 py-2.5 rounded-full text-label-caps whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-pitch-500 text-night-950'
                : 'card-surface text-ink-500 hover:text-ink-100'
            }`}
          >
            {league.name}
          </button>
        )
      })}
    </div>
  )
}