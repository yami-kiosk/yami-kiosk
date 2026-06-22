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
    passiveRatePerMin: state.passiveRatePerMin,
    activeRatePerMin: state.activeRatePerMin,
    incomeCapBaselineAt: state.incomeCapBaselineAt,
    incomeCapBaselineSeason: state.incomeCapBaselineSeason,
    seasonYenEarned: state.seasonYenEarned,
  }
}

/** Cap a $YEN income grant (inject, passive, raid) to block autoclick farms. */
export function grantCappedSeasonIncome(
  requested: number,
  now = Date.now(),
): number {
  const state = useGameStore.getState()
  return clampSeasonIncomeGrant(pickIncomeCapState(state), requested, now)
}

/**
 * Sync leaderboard score with server. Only reset income cap when server clamps down.
 */
export function reconcileEconomyFromServer(
  snapshot: ServerEconomySnapshot,
): boolean {
  const state = useGameStore.getState()
  const serverYen = roundYen(snapshot.seasonYenEarned)
  const localSeason = roundYen(state.seasonYenEarned)
  const now = Date.now()
  const patches: Record<string, unknown> = {}

  if (serverYen + 0.01 < localSeason) {
    const delta = roundYen(localSeason - serverYen)
    patches.seasonYenEarned = serverYen
    patches.yen = roundYen(Math.max(0, state.yen - delta))
    Object.assign(patches, createIncomeCapBaseline(serverYen, now))
  } else if (serverYen > localSeason + 0.01) {
    patches.seasonYenEarned = serverYen
  }

  if (Object.keys(patches).length > 0) {
    useGameStore.setState(patches)
    return true
  }

  return false
}
