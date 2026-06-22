import { useGameStore } from '../../store/useGameStore'
import { roundYen } from '../yen'

export interface ServerEconomySnapshot {
  seasonYenEarned: number
  phase?: number
}

/**
 * Sync the leaderboard score with the server-authoritative value.
 * Local wallet $YEN and phase are NOT touched — gameplay stays smooth.
 * Autoclick earning speed is bounded by the client inject rate limiter,
 * and leaderboard rank is bounded here + by server sync_cycle_score.
 */
export function reconcileEconomyFromServer(
  snapshot: ServerEconomySnapshot,
): boolean {
  const serverYen = roundYen(snapshot.seasonYenEarned)
  const localSeason = roundYen(useGameStore.getState().seasonYenEarned)

  if (Math.abs(serverYen - localSeason) <= 0.01) {
    return false
  }

  useGameStore.setState({ seasonYenEarned: serverYen })
  return true
}
