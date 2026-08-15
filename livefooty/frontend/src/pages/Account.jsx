import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const inputClass =
  'w-full bg-night-900 border border-night-750 rounded-lg px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:outline-none focus:border-pitch-500 transition-colors'

export default function Account() {
  const { user, logout, setKey, clearKey, verify, resend } = useAuth()
  const navigate = useNavigate()
  const [fdKey, setFdKey] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onVerify(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const u = await verify(code)
      if (u.verified) setMessage('Email verified — you can now save a key.')
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

  async function onSave(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await setKey(fdKey)
      setFdKey('')
      setMessage('Key saved — lineups now use your quota.')
    } catch (err) {
      setError(err.message || 'Could not save key')
    } finally {
      setBusy(false)
    }
  }

  async function onRemove() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await clearKey()
      setMessage('Key removed.')
    } catch (err) {
      setError(err.message || 'Could not remove key')
    } finally {
      setBusy(false)
    }
  }

  function onLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card-surface rounded-card p-8">
        <h1 className="font-headline text-2xl font-bold text-ink-100">Your account</h1>
        <p className="text-ink-500 text-sm mt-1">{user?.email}</p>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between bg-night-900 border border-night-750 rounded-lg px-4 py-3">
            <span className="text-sm text-ink-300">Email verification</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                user?.verified
                  ? 'bg-pitch-500/15 text-pitch-400 border border-pitch-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}
            >
              {user?.verified ? 'VERIFIED' : 'PENDING'}
            </span>
          </div>

          {!user?.verified && (
            <form onSubmit={onVerify} className="space-y-3">
              <input
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
              <p className="text-ink-600 text-xs">
                A 6-digit code was sent to your email. Verify your address before adding an API key.
              </p>
            </form>
          )}

          {user?.verified && (
            <>
              <div className="flex items-center justify-between bg-night-900 border border-night-750 rounded-lg px-4 py-3">
                <span className="text-sm text-ink-300">Football-data API key</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    user?.hasFdKey
                      ? 'bg-pitch-500/15 text-pitch-400 border border-pitch-500/30'
                      : 'bg-ink-700/40 text-ink-500 border border-ink-700'
                  }`}
                >
                  {user?.hasFdKey ? 'SAVED' : 'NONE'}
                </span>
              </div>

              {user?.hasFdKey ? (
                <button
                  onClick={onRemove}
                  disabled={busy}
                  className="w-full bg-danger-500/10 hover:bg-danger-500/20 border border-danger-500/40 text-danger-500 font-semibold text-sm rounded-lg py-2.5 transition-colors"
                >
                  Remove key
                </button>
              ) : (
                <form onSubmit={onSave} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={fdKey}
                    onChange={(e) => setFdKey(e.target.value)}
                    className={inputClass}
                    placeholder="Paste your football-data.org API key"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full bg-pitch-500 hover:bg-pitch-400 disabled:opacity-50 text-night-950 font-semibold text-sm rounded-lg py-2.5 transition-colors"
                  >
                    {busy ? 'Saving…' : 'Save key'}
                  </button>
                </form>
              )}

              <p className="text-ink-600 text-xs">
                Get a free key at football-data.org — your key is validated live and used only for
                lineups requests under your own quota.
              </p>
            </>
          )}

          {message && <p className="text-pitch-400 text-sm">{message}</p>}
          {error && <p className="text-danger-500 text-sm">{error}</p>}

          <button
            onClick={onLogout}
            className="w-full text-ink-400 hover:text-ink-100 border border-night-750 hover:border-ink-600 font-medium text-sm rounded-lg py-2.5 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}