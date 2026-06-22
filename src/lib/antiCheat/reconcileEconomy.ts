import {
  clampSeasonIncomeGrant,
  createIncomeCapBaseline,
  type IncomeCapState,
} from './incomeCap'
import { useGameStore } from '../../store/useGameStore'
import { roundYen } from '../yen'

export interface ServerEconomySnapshot {
  seasonYenEarned: number
  phase?: number
}

function pickIncomeCapState(
  state: ReturnType<typeof useGameStore.getState>,
): IncomeCapState {
  return {
    phase: state.phase,
    incomeCapBaselineAt: state.incomeCapBaselineAt,
    incomeCapBaselineSeason: state.incomeCapBaselineSeason,
    seasonYenEarned: state.seasonYenEarned,
  }
}

/** Cap a $YEN income grant (inject, passive, raid) to match server rate limits. */
export function grantCappedSeasonIncome(
  requested: number,
  now = Date.now(),
): number {
  const state = useGameStore.getState()
  return clampSeasonIncomeGrant(pickIncomeCapState(state), requested, now)
}

/**
 * Align season score + income cap anchor with server. Trim wallet if local ran ahead.
 */
export function reconcileEconomyFromServer(
  snapshot: ServerEconomySnapshot,
): boolean {
  const state = useGameStore.getState()
  const serverYen = roundYen(snapshot.seasonYenEarned)
  const localSeason = roundYen(state.seasonYenEarned)
  const now = Date.now()
  const patches: Record<string, unknown> = createIncomeCapBaseline(serverYen, now)

  if (serverYen + 0.01 < localSeason) {
    const delta = roundYen(localSeason - serverYen)
    patches.seasonYenEarned = serverYen
    patches.yen = roundYen(Math.max(0, state.yen - delta))
  } else if (Math.abs(serverYen - localSeason) > 0.01) {
    patches.seasonYenEarned = serverYen
  }

  useGameStore.setState(patches)
  return true
}
