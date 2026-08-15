import { useStream } from '../hooks/useStream'

function NetworkCheckIcon({ className = 'w-[18px] h-[18px]' }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3a10 10 0 016.09 2.07l-1.43 1.43a8 8 0 00-9.32 0L5.91 5.07A10 10 0 0112 3zM12 7a6 6 0 013.65 1.24L14.2 9.68a4 4 0 00-4.4 0L8.35 8.24A6 6 0 0112 7zm0 4a2 2 0 011.2.39l-1.2 2.07-1.2-2.07A2 2 0 0112 11zm-7-5.93l1.43 1.43A10 10 0 004 9v0h2V9a8 8 0 012.94-1.93L8 7l1.5-1.5A6 6 0 005.6 7.7L4.1 6.3l.9-.2z" />
    </svg>
  )
}

function PlayIcon({ className = 'w-9 h-9 ml-1' }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

export default function StreamPlayer({ matchId }) {
  const { videoRef, streams, activeIndex, setActiveIndex, loading, error } = useStream(matchId)
  const active = streams[activeIndex]

  if (loading) {
    return (
      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden border border-night-750 flex items-center justify-center shadow-xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-pitch-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-ink-500">Finding streams...</span>
        </div>
      </div>
    )
  }

  if (error || streams.length === 0) {
    return (
      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden border border-night-750 flex items-center justify-center shadow-xl">
        <div className="text-center px-6">
          <p className="text-red-400 text-sm mb-1">No streams available</p>
          <p className="text-ink-600 text-xs">Try again later or check back closer to kickoff</p>
        </div>
      </div>
    )
  }

  const isLink = active.type === 'link'

  return (
    <section className="space-y-4">
      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden relative group shadow-xl border border-night-750">
        {isLink ? (
          <>
            {/* Player chrome as designed: gradient overlay + LIVE pill + center play */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 flex flex-col justify-between">
              <div className="p-4 flex justify-between items-center">
                <div className="bg-black/50 backdrop-blur-sm px-3 py-1 rounded text-sm font-medium flex items-center text-ink-100">
                  <span className="w-2 h-2 rounded-full bg-pitch-500 pulse-dot mr-2" />
                  Live
                </div>
                <div className="text-xs text-ink-600 font-medium hidden sm:block">
                  Opens in a new tab
                </div>
              </div>
              <a
                href={active.url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center"
                aria-label={`Open ${active.label}`}
              >
                <span className="w-16 h-16 rounded-full bg-black/60 border-2 border-white/20 backdrop-blur-md flex items-center justify-center text-white hover:border-pitch-400 hover:text-pitch-400 transition-colors">
                  <PlayIcon />
                </span>
              </a>
              <div className="p-4 w-full">
                <div className="h-1.5 w-full bg-night-800/50 rounded-full overflow-hidden" />
                <div className="flex justify-between items-center mt-2 text-xs text-ink-500 font-medium tabular-nums">
                  <span>Ready</span>
                  <span className="flex items-center text-pitch-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-pitch-500 mr-1 pulse-dot" />
                    {active.label} · {active.quality}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : active.type === 'embed' ? (
          <iframe
            src={active.url}
            title={`${active.label} player`}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            referrerPolicy="origin"
            allowFullScreen
          />
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-contain relative z-10"
            controls
            playsInline
          />
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {streams.map((s, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`px-4 py-2 rounded-full font-medium text-sm transition-colors flex items-center ${
              i === activeIndex
                ? 'bg-pitch-500/20 text-pitch-400 border border-pitch-500/30'
                : 'bg-night-800 text-ink-500 hover:text-ink-100 hover:bg-night-800/80 border border-transparent'
            }`}
          >
            <NetworkCheckIcon />
            <span className="ml-1.5">{s.label}</span>
            {s.quality && s.quality !== '—' && (
              <span className={i === activeIndex ? 'opacity-80 ml-1' : 'text-ink-600 ml-1'}>
                ({s.quality})
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}