/**
 * Local income ceiling — uses live player rates (skills/combo/phase).
 * Blocks sustained autoclick (15+ CPS) without punishing normal fast manual play.
 */

import type { GamePhase } from '../../store/gameConfig'
import { roundYen } from '../yen'

/** ~12 clicks/sec sustained with combo headroom — above this is autoclick territory. */
const MAX_SUSTAINED_CLICKS_PER_SEC = 12
const COMBO_HEADROOM = 1.4
const INCOME_SLACK = 1.35

const PHASE_PASSIVE_BASE: Record<GamePhase, number> = {
  1: 3.5,
  2: 9.0,
  3: 28.0,
  4: 80.0,
  5: 280.0,
  6: 1100.0,
}

export function maxRaidBurstYen(phase: GamePhase): number {
  return PHASE_PASSIVE_BASE[phase] * 4.5 * 2.0
}

export interface IncomeCapState {
  phase: GamePhase
  passiveRatePerMin: number
  activeRatePerMin: number
  incomeCapBaselineAt: number
  incomeCapBaselineSeason: number
  seasonYenEarned: number
}

/** Legitimate $YEN/min at current build — scales with skills, not just phase base. */
export function getLegitimateRatePerMin(state: Pick<
  IncomeCapState,
  'passiveRatePerMin' | 'activeRatePerMin'
>): number {
  const passive = Math.max(0, state.passiveRatePerMin)
  const active = Math.max(0, state.activeRatePerMin)
  const activeClickBudget =
    active * MAX_SUSTAINED_CLICKS_PER_SEC * COMBO_HEADROOM
  return passive + activeClickBudget
}

export function getMaxSeasonYenAllowed(
  state: IncomeCapState,
  now = Date.now(),
): number {
  const elapsedMinutes = Math.max(0, (now - state.incomeCapBaselineAt) / 60_000)
  const rate = getLegitimateRatePerMin(state)
  let maxGain = elapsedMinutes * rate * INCOME_SLACK

  if (elapsedMinutes >= 1) {
    maxGain += maxRaidBurstYen(state.phase)
  }

  return roundYen(state.incomeCapBaselineSeason + maxGain)
}

export function clampSeasonIncomeGrant(
  state: IncomeCapState,
  requested: number,
  now = Date.now(),
): number {
  if (requested <= 0) return 0

  const maxAllowed = getMaxSeasonYenAllowed(state, now)
  const headroom = roundYen(maxAllowed - state.seasonYenEarned)
  return roundYen(Math.max(0, Math.min(requested, headroom)))
}

export function createIncomeCapBaseline(
  seasonYenEarned: number,
  now = Date.now(),
): Pick<IncomeCapState, 'incomeCapBaselineAt' | 'incomeCapBaselineSeason'> {
  return {
    incomeCapBaselineAt: now,
    incomeCapBaselineSeason: roundYen(seasonYenEarned),
  }
}
