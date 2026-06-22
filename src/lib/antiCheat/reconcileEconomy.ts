import type { GamePhase } from '../../store/gameConfig'
import { pickSkillLevels, recalculateRates } from '../../store/rateCalculator'
import { useGameStore } from '../../store/useGameStore'
import { roundYen } from '../yen'

/** Mirrors server sync_cycle_score: client phase may lead by at most this much between syncs. */
const PHASE_SYNC_LEAD = 2

export interface ServerEconomySnapshot {
  seasonYenEarned: number
  phase?: number
}

/**
 * Align local wallet + progression with server-authoritative season stats.
 * Strips inflated $YEN from autoclick so upgrades / phase buys cannot stick.
 */
export function reconcileEconomyFromServer(
  snapshot: ServerEconomySnapshot,
): boolean {
  const state = useGameStore.getState()
  const patches: Record<string, unknown> = {}
  let changed = false

  const serverYen = roundYen(snapshot.seasonYenEarned)
  const localSeason = roundYen(state.seasonYenEarned)

  if (serverYen + 0.01 < localSeason) {
    const delta = roundYen(localSeason - serverYen)
    patches.seasonYenEarned = serverYen
    patches.yen = roundYen(Math.max(0, state.yen - delta))
    changed = true
  } else if (serverYen > localSeason + 0.01) {
    patches.seasonYenEarned = serverYen
    changed = true
  }

  if (snapshot.phase != null && Number.isFinite(snapshot.phase)) {
    const serverPhase = Math.min(
      6,
      Math.max(1, Math.round(snapshot.phase)),
    ) as GamePhase
    const maxAllowed = Math.min(
      6,
      serverPhase + PHASE_SYNC_LEAD,
    ) as GamePhase

    if (state.phase > maxAllowed) {
      const nextState = { ...state, phase: maxAllowed }
      Object.assign(patches, {
        phase: maxAllowed,
        ...recalculateRates(pickSkillLevels(nextState)),
      })
      changed = true
    }
  }

  if (changed) {
    useGameStore.setState(patches)
  }

  return changed
}
