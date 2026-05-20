import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../utils/apiFetch'

/**
 * Loads /api/players/:id/summary for the active league (league_members source of truth).
 * Refetches when league changes and when the tab regains focus.
 */
export function useDbPlayerSummary(userId, leagueId, enabled = true) {
  const [summary, setSummary] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const uid = Number.parseInt(String(userId ?? ''), 10)
    if (!enabled || Number.isNaN(uid) || String(uid) !== String(userId ?? '')) {
      setSummary(null)
      setLoaded(true)
      return
    }

    const leagueQuery = /^\d+$/.test(String(leagueId || ''))
      ? `?leagueId=${Number.parseInt(String(leagueId), 10)}`
      : ''

    try {
      const result = await apiFetch(`/api/players/${uid}/summary${leagueQuery}`)
      setSummary(result?.data ?? null)
    } catch {
      setSummary(null)
    } finally {
      setLoaded(true)
    }
  }, [userId, leagueId, enabled])

  useEffect(() => {
    setLoaded(false)
    load()
  }, [load])

  useEffect(() => {
    const onFocus = () => load()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  return { summary, loaded, reload: load }
}
