import { useCallback, useEffect, useState } from 'react'
import {
  getSupabaseConfigStatus,
  pingSupabase,
  type SupabaseHealthResult,
} from '../lib/supabase/health'

const RECHECK_MS = 60_000

export function useSupabaseStatus(enabled = true) {
  const [health, setHealth] = useState<SupabaseHealthResult>(() =>
    getSupabaseConfigStatus(),
  )

  const refresh = useCallback(async () => {
    const initial = getSupabaseConfigStatus()
    if (initial.status === 'unconfigured') {
      setHealth(initial)
      return initial
    }

    setHealth({ status: 'checking', message: null })
    const result = await pingSupabase()
    setHealth(result)
    return result
  }, [])

  useEffect(() => {
    if (!enabled) return

    void refresh()
    const id = window.setInterval(() => void refresh(), RECHECK_MS)
    return () => window.clearInterval(id)
  }, [enabled, refresh])

  return { ...health, refresh }
}
