import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const inputClass =
  'w-full bg-night-900 border border-night-750 rounded-lg px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:outline-none focus:border-pitch-500 transition-colors'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      navigate('/account')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse 420px 260px at 50% 35%, rgba(34,197,94,0.14), transparent 70%)' }}
      />
      <div className="card-surface rounded-card p-8">
        <h1 className="font-headline text-2xl font-bold text-ink-100">Welcome back</h1>
        <p className="text-ink-500 text-sm mt-1">Sign in to use your own football-data API key</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-400 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-400 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-danger-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-pitch-500 hover:bg-pitch-400 disabled:opacity-50 text-night-950 font-semibold text-sm rounded-lg py-2.5 transition-colors"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-ink-500 text-sm mt-6 text-center">
          No account yet?{' '}
          <Link to="/register" className="text-pitch-400 hover:text-pitch-300 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}