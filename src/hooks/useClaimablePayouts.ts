import { useCallback, useEffect, useState } from 'react'
import {
  claimSeasonReward,
  getPendingPayouts,
  isClaimEnabled,
  loadClaimablePayouts,
} from '../lib/claim/claimService'
import type { SeasonPayoutRow } from '../lib/supabase/types'
import { useGameStore } from '../store/useGameStore'

export function useClaimablePayouts(enabled = true) {
  const walletPublicKey = useGameStore((s) => s.walletPublicKey)
  const [rows, setRows] = useState<SeasonPayoutRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [claimingSeasonId, setClaimingSeasonId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled || !walletPublicKey) {
      setRows([])
      return
    }

    setIsLoading(true)
    try {
      const next = await loadClaimablePayouts(walletPublicKey)
      setRows(next)
    } finally {
      setIsLoading(false)
    }
  }, [enabled, walletPublicKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const pending = getPendingPayouts(rows)
  const pendingTotal = pending.reduce((sum, row) => sum + row.amount_yami, 0)

  const claim = useCallback(
    async (seasonId: number) => {
      if (!walletPublicKey) {
        return {
          success: false,
          message: 'Burner node not ready.',
        } as const
      }

      setClaimingSeasonId(seasonId)
      try {
        const result = await claimSeasonReward(walletPublicKey, seasonId)
        await refresh()
        return result
      } finally {
        setClaimingSeasonId(null)
      }
    },
    [walletPublicKey, refresh],
  )

  return {
    rows,
    pending,
    pendingTotal,
    isLoading,
    claimingSeasonId,
    claimEnabled: isClaimEnabled(),
    refresh,
    claim,
  }
}
