import { createContext, useContext, useEffect, useState } from 'react'
import {
  setAuthToken,
  fetchMe,
  loginAccount,
  registerAccount,
  verifyAccount,
  resendVerification,
  saveFdKey,
  removeFdKey,
} from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('lf_token')
    if (!token) {
      setLoading(false)
      return
    }
    setAuthToken(token)
    fetchMe()
      .then((d) => setUser(d.user))
      .catch(() => {
        localStorage.removeItem('lf_token')
        setAuthToken(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const d = await loginAccount(email, password)
    localStorage.setItem('lf_token', d.token)
    setAuthToken(d.token)
    setUser(d.user)
    return d.user
  }

  async function register(email, password) {
    const d = await registerAccount(email, password)
    localStorage.setItem('lf_token', d.token)
    setAuthToken(d.token)
    setUser(d.user)
    return d.user
  }

  function logout() {
    localStorage.removeItem('lf_token')
    setAuthToken(null)
    setUser(null)
  }

  async function setKey(fdKey) {
    const d = await saveFdKey(fdKey)
    setUser(d.user)
    return d.user
  }

  async function clearKey() {
    const d = await removeFdKey()
    setUser(d.user)
    return d.user
  }

  async function verify(code) {
    const d = await verifyAccount(code)
    setUser(d.user)
    return d.user
  }

  async function resend() {
    const d = await resendVerification()
    setUser(d.user)
    return d.user
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setKey, clearKey, verify, resend }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}