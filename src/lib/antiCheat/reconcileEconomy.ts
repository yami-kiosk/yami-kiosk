import { useGameStore } from '../../store/useGameStore'
import { roundYen } from '../yen'

export interface ServerEconomySnapshot {
  seasonYenEarned: number
  phase?: number
}

/**
 * Leaderboard score only — local $YEN wallet and phase stay untouched for gameplay.
 * Server sync_cycle_score caps seasonYenEarned; autoclick cannot inflate rank.
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
