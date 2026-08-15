import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const inputClass =
  'w-full bg-night-900 border border-night-750 rounded-lg px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:outline-none focus:border-pitch-500 transition-colors'

export default function Register() {
  const { register, verify, resend } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [needsVerify, setNeedsVerify] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    setError('')
    try {
      const user = await register(email, password)
      if (user.verified) {
        navigate('/account')
      } else {
        setNeedsVerify(true)
        setMessage('Check your inbox — a 6-digit verification code was sent.')
      }
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  async function onVerify(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = await verify(code)
      if (user.verified) navigate('/account')
    } catch (err) {
      setError(err.message || 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  async function onResend() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await resend()
      setMessage('A new code was sent.')
    } catch (err) {
      setError(err.message || 'Could not resend code')
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
        <h1 className="font-headline text-2xl font-bold text-ink-100">
          {needsVerify ? 'Verify your email' : 'Create your account'}
        </h1>
        <p className="text-ink-500 text-sm mt-1">
          {needsVerify
            ? `Enter the 6-digit code sent to ${email}`
            : 'Save your free football-data.org API key and use your own quota for lineups.'}
        </p>

        {!needsVerify ? (
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
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-400 mb-1" htmlFor="confirm">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
                placeholder="Repeat your password"
              />
            </div>

            {error && <p className="text-danger-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-pitch-500 hover:bg-pitch-400 disabled:opacity-50 text-night-950 font-semibold text-sm rounded-lg py-2.5 transition-colors"
            >
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-400 mb-1" htmlFor="code">
                Verification code
              </label>
              <input
                id="code"
                type="text"
                required
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${inputClass} text-center text-xl tracking-[0.5em]`}
                placeholder="••••••"
              />
            </div>

            {message && <p className="text-pitch-400 text-sm">{message}</p>}
            {error && <p className="text-danger-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-pitch-500 hover:bg-pitch-400 disabled:opacity-50 text-night-950 font-semibold text-sm rounded-lg py-2.5 transition-colors"
            >
              {busy ? 'Verifying…' : 'Verify email'}
            </button>
            <button
              type="button"
              onClick={onResend}
              disabled={busy}
              className="w-full text-ink-400 hover:text-ink-100 text-sm font-medium py-1 transition-colors"
            >
              Resend code
            </button>
          </form>
        )}

        {!needsVerify && (
          <p className="text-ink-500 text-sm mt-6 text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-pitch-400 hover:text-pitch-300 transition-colors">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}