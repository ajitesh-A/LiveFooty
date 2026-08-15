import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchMatches } from '../services/api'

export function useMatches() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const leagueRef = useRef(null)

  const load = useCallback(async (league, silent = false) => {
    leagueRef.current = league ?? leagueRef.current
    try {
      if (!silent) setLoading(true)
      setError(null)
      const data = await fetchMatches(leagueRef.current)
      setMatches(data)
    } catch (e) {
      if (!silent) setError(e.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const id = setInterval(() => load(undefined, true), 25000)
    return () => clearInterval(id)
  }, [load])

  return { matches, loading, error, load, refetch: load }
}