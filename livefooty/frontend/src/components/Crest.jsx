import { useState } from 'react'

export default function Crest({ name, badge, size = 'lg' }) {
  const [failed, setFailed] = useState(false)
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  const dims = size === 'lg' ? 'w-12 h-12 text-lg' : size === 'xl' ? 'w-24 h-24 text-4xl' : 'w-16 h-16 text-2xl'

  if (badge && !failed) {
    return (
      <img
        src={badge}
        alt={`${name} crest`}
        width={size === 'lg' ? 48 : size === 'xl' ? 96 : 64}
        height={size === 'lg' ? 48 : size === 'xl' ? 96 : 64}
        className={`${dims} rounded-full object-contain`}
        onError={() => setFailed(true)}
        loading="lazy"
      />
    )
  }

  return (
    <div className={`${dims} rounded-full bg-night-650 border border-night-600 flex items-center justify-center font-headline font-bold text-ink-300/90 select-none`}>
      {initial}
    </div>
  )
}