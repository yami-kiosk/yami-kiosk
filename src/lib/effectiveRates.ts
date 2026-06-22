import {
  INJECT_COMBO_MAX,
  INJECT_COMBO_WINDOW_MS,
  getInjectComboMultiplier,
  hasSkillMilestone,
} from '../store/skillMilestones'
import { pickSkillLevels, recalculateRates } from '../store/rateCalculator'
import {
  applyDoctrineActiveMultiplier,
  applyDoctrinePassiveMultiplier,
} from '../store/syndicateDoctrine'
import type { SyndicateDoctrineId } from '../store/syndicateDoctrine'
import type { GamePhase } from '../store/gameConfig'
import { useGameStore } from '../store/useGameStore'
import { useShallow } from 'zustand/react/shallow'

export interface RateStateSlice {
  phase: GamePhase
  hardwareLevel: number
  softwareLevel: number
  networkLevel: number
  stealthLevel: number
  distributionLevel: number
  hijackPassiveBonus: number
  syndicateDoctrine: SyndicateDoctrineId | null
  overclockBoostUntil: number
  injectComboCount: number
  injectComboLastAt: number
  activeRatePerMin: number
}

export function isOverclockActive(
  state: Pick<RateStateSlice, 'hardwareLevel' | 'overclockBoostUntil'>,
  now = Date.now(),
): boolean {
  return (
    hasSkillMilestone(state.hardwareLevel, 10) &&
    state.overclockBoostUntil > now
  )
}

export function getLiveComboCount(
  state: Pick<
    RateStateSlice,
    'softwareLevel' | 'injectComboCount' | 'injectComboLastAt'
  >,
  now = Date.now(),
): number {
  if (!hasSkillMilestone(state.softwareLevel, 3)) return 0
  if (now - state.injectComboLastAt > INJECT_COMBO_WINDOW_MS) return 0
  return state.injectComboCount
}

export function getNextComboCount(
  state: Pick<
    RateStateSlice,
    'softwareLevel' | 'injectComboCount' | 'injectComboLastAt'
  >,
  now = Date.now(),
): number {
  if (!hasSkillMilestone(state.softwareLevel, 3)) return 0
  if (now - state.injectComboLastAt <= INJECT_COMBO_WINDOW_MS) {
    return Math.min(INJECT_COMBO_MAX, state.injectComboCount + 1)
  }
  return 1
}

export function getEffectivePassiveRatePerMin(
  state: RateStateSlice,
  now = Date.now(),
): number {
  const overclockActive = isOverclockActive(state, now)
  const rates = recalculateRates(pickSkillLevels(state), { overclockActive })
  return applyDoctrinePassiveMultiplier(
    state.syndicateDoctrine,
    rates.passiveRatePerMin,
  )
}

export function getNextClickYen(
  state: RateStateSlice,
  now = Date.now(),
): number {
  const nextCombo = getNextComboCount(state, now)
  const comboMult = getInjectComboMultiplier(state.softwareLevel, nextCombo)
  const base = state.activeRatePerMin / 60
  return applyDoctrineActiveMultiplier(
    state.syndicateDoctrine,
    base * comboMult,
  )
}

export function formatRateShort(value: number): string {
  if (value >= 1_000) return value.toFixed(0)
  if (value >= 100) return value.toFixed(1)
  if (value >= 1) return value.toFixed(2)
  return value.toFixed(3)
}

export function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}s`
}

export function useRateState(): RateStateSlice {
  return useGameStore(
    useShallow((s) => ({
      phase: s.phase,
      hardwareLevel: s.hardwareLevel,
      softwareLevel: s.softwareLevel,
      networkLevel: s.networkLevel,
      stealthLevel: s.stealthLevel,
      distributionLevel: s.distributionLevel,
      hijackPassiveBonus: s.hijackPassiveBonus,
      syndicateDoctrine: s.syndicateDoctrine,
      overclockBoostUntil: s.overclockBoostUntil,
      injectComboCount: s.injectComboCount,
      injectComboLastAt: s.injectComboLastAt,
      activeRatePerMin: s.activeRatePerMin,
    })),
  )
}
