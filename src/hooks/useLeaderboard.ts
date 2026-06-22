import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { LeaderboardEntry, LocalLeaderboardPlayer } from '../lib/leaderboardOffline'
import { loadLeaderboard, type LoadedLeaderboard } from '../lib/leaderboardService'

const REFRESH_MS = 45_000

export function useLeaderboard(
  seasonId: number,
  localPlayer: LocalLeaderboardPlayer,
) {
  const [data, setData] = useState<LoadedLeaderboard | null>(null)
  const [loading, setLoading] = useState(true)
  const offlineWarned = useRef(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await loadLeaderboard(seasonId, localPlayer)
      setData(result)
      if (result.source === 'offline' && !offlineWarned.current) {
        offlineWarned.current = true
        toast.warning('Leaderboard offline — showing local syndicate mock data.', {
          className: 'yami-toast',
          id: 'leaderboard-offline',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [
    seasonId,
    localPlayer.seasonYenEarned,
    localPlayer.phase,
    localPlayer.walletPublicKey,
    localPlayer.operatorName,
  ])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  return {
    entries: (data?.entries ?? []) as LeaderboardEntry[],
    localRank: data?.localRank ?? null,
    localYenEarned: data?.localYenEarned ?? localPlayer.seasonYenEarned,
    payoutYami: data?.payoutYami ?? 0,
    qualified: data?.qualified ?? false,
    source: data?.source ?? 'offline',
    loading,
    refresh,
  }
}
