import type { GamePhase } from './gameConfig'
import { PHASES } from './gameConfig'

/**
 * Anti-inflation targets:
 * - Raid win ≈ 4–5 min of phase-base passive $YEN (not 20–30 min)
 * - Skill tree ≈ 15–25% of next phase upgrade cost at that tier
 * - Phase upgrades remain the primary $YEN sink
 */

/** Raid loot scales from phase passive — win ≈ this many minutes of base passive */
export const RAID_YEN_PASSIVE_MINUTES = 4.5
export const RAID_CREDIT_DRIP_MINUTES = 3
export const RAID_LOOT_VARIANCE = 0.18

/** Skill costs scale with phase so mid/late upgrades stay meaningful */
export const SKILL_PHASE_COST_STEP = 0.14

/** Per-level stat gains (lower = less runaway stacking) */
export const SKILL_PASSIVE_PER_HW = 0.65
export const SKILL_PASSIVE_PER_DIST = 0.35
export const SKILL_ACTIVE_PER_SW = 2
export const SKILL_ACTIVE_PER_HW = 0.65
export const SKILL_CREDIT_HW = 1.1
export const SKILL_CREDIT_SW = 0.75
export const SKILL_CREDIT_DIST = 0.9

export function getSkillPhaseCostMultiplier(phase: GamePhase): number {
  return 1 + (phase - 1) * SKILL_PHASE_COST_STEP
}

export function getPhaseBasePassivePerMin(phase: GamePhase): number {
  return PHASES[phase].offlineRatePerMin
}

/** Baseline dirty-credit drip at phase with no skill investment */
export function getPhaseBaseCreditDripPerMin(phase: GamePhase): number {
  return phase * 1.6
}

export function rollRaidYenAmount(phase: GamePhase, multiplier = 1): number {
  const base = getPhaseBasePassivePerMin(phase) * RAID_YEN_PASSIVE_MINUTES
  const variance = 1 - RAID_LOOT_VARIANCE + Math.random() * RAID_LOOT_VARIANCE * 2
  return Math.max(1, Math.floor(base * variance * multiplier))
}

export function rollRaidCreditAmount(phase: GamePhase, multiplier = 1): number {
  const base = getPhaseBaseCreditDripPerMin(phase) * RAID_CREDIT_DRIP_MINUTES
  const variance = 1 - RAID_LOOT_VARIANCE + Math.random() * RAID_LOOT_VARIANCE * 2
  return Math.max(1, Math.floor(base * variance * multiplier))
}

export function getRaidYenRange(
  phase: GamePhase,
  multiplier = 1,
): { min: number; max: number } {
  const base = getPhaseBasePassivePerMin(phase) * RAID_YEN_PASSIVE_MINUTES * multiplier
  return {
    min: Math.floor(base * (1 - RAID_LOOT_VARIANCE)),
    max: Math.floor(base * (1 + RAID_LOOT_VARIANCE)),
  }
}

export function getRaidCreditRange(
  phase: GamePhase,
  multiplier = 1,
): { min: number; max: number } {
  const base = getPhaseBaseCreditDripPerMin(phase) * RAID_CREDIT_DRIP_MINUTES * multiplier
  return {
    min: Math.floor(base * (1 - RAID_LOOT_VARIANCE)),
    max: Math.floor(base * (1 + RAID_LOOT_VARIANCE)),
  }
}
