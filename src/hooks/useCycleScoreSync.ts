import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { syncCycleScoreRemote } from '../lib/supabase/api'
import { isSupabaseConfigured } from '../lib/supabase/client'
import { getCurrentSeasonId } from '../store/seasonConfig'
import { useGameStore } from '../store/useGameStore'

const SYNC_INTERVAL_MS = 30_000

export function useCycleScoreSync(enabled: boolean) {
  const walletPublicKey = useGameStore((s) => s.walletPublicKey)
  const operatorName = useGameStore((s) => s.operatorName)
  const syncing = useRef(false)
  const clampWarned = useRef(false)

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return
    if (!walletPublicKey || !operatorName) return

    clampWarned.current = false

    const sync = async () => {
      if (syncing.current) return
      syncing.current = true
      try {
        const state = useGameStore.getState()
        const seasonId = state.activeSeasonId || getCurrentSeasonId()
        const result = await syncCycleScoreRemote(
          walletPublicKey,
          seasonId,
          state.seasonYenEarned,
          state.phase,
        )
        if (result.success && result.yen_earned != null) {
          useGameStore.setState({ seasonYenEarned: result.yen_earned })

          if (result.clamped && !clampWarned.current) {
            clampWarned.current = true
            toast.error(
              'ICE AUDIT — season score clamped to legitimate income rate.',
              { className: 'yami-toast', id: 'sync-clamp' },
            )
          }
        }
      } catch (err) {
        console.warn('[sync] cycle score failed', err)
      } finally {
        syncing.current = false
      }
    }

    void sync()
    const id = window.setInterval(() => void sync(), SYNC_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [enabled, walletPublicKey, operatorName])
}
