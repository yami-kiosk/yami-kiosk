/**
 * Local income ceiling — mirrors server sync_cycle_score (migration 2200).
 * Caps cumulative season $YEN so autoclick cannot rush phases; fast manual play stays within slack.
 */

import type { GamePhase } from '../../store/gameConfig'
import { roundYen } from '../yen'

/** Keep in sync with supabase/migrations/20260622220000_gameplay_click_fix.sql */
const ACTIVE_CLICKS_PER_MIN = 320
const PASSIVE_SKILL_SLACK = 1.134
const ACTIVE_SKILL_SLACK = 1.234
const INCOME_SLACK = 2.0
const RAID_BURST_MULT = 2.0

const PHASE_PASSIVE_BASE: Record<GamePhase, number> = {
  1: 3.5,
  2: 9.0,
  3: 28.0,
  4: 80.0,
  5: 280.0,
  6: 1100.0,
}

const PHASE_ACTIVE_BASE: Record<GamePhase, number> = {
  1: 14.0,
  2: 36.0,
  3: 110.0,
  4: 320.0,
  5: 1100.0,
  6: 4200.0,
}

export function maxPassiveYenPerMinute(phase: GamePhase): number {
  return (PHASE_PASSIVE_BASE[phase] + 20) * PASSIVE_SKILL_SLACK
}

export function maxActiveYenPerMinute(phase: GamePhase): number {
  return (
    ACTIVE_CLICKS_PER_MIN *
    ((PHASE_ACTIVE_BASE[phase] + 20) / 60) *
    ACTIVE_SKILL_SLACK
  )
}

export function maxYenPerMinute(phase: GamePhase): number {
  return maxPassiveYenPerMinute(phase) + maxActiveYenPerMinute(phase)
}

export function maxRaidBurstYen(phase: GamePhase): number {
  return PHASE_PASSIVE_BASE[phase] * 4.5 * RAID_BURST_MULT
}

export interface IncomeCapState {
  phase: GamePhase
  incomeCapBaselineAt: number
  incomeCapBaselineSeason: number
  seasonYenEarned: number
}

export function getMaxSeasonYenAllowed(
  state: IncomeCapState,
  now = Date.now(),
): number {
  const elapsedMinutes = Math.max(0, (now - state.incomeCapBaselineAt) / 60_000)
  const rate = maxYenPerMinute(state.phase)
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
