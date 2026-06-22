import type { GamePhase } from './gameConfig'
import {
  getRaidCreditRange,
  getRaidYenRange,
  rollRaidCreditAmount,
  rollRaidYenAmount,
  SKILL_CREDIT_DIST,
  SKILL_CREDIT_HW,
  SKILL_CREDIT_SW,
} from './economyBalance'

export const RAID_ENTRY_FEE_YAMI = 75
export const RAID_COOLDOWN_MS = 90_000
export const RAID_MIN_SUCCESS_RATE = 0.12
export const RAID_MAX_SUCCESS_RATE = 0.48
export const HIJACK_COST_YAMI = 650
export const HIJACK_SUCCESS_RATE = 0.35
export const HIJACK_PASSIVE_BONUS = 10

export const CREDIT_TO_YAMI_RATIO = 1

export interface TraceFeeTier {
  traceFeePercent: number
  receivePercent: number
  label: string
}

export function getTraceFeeRate(yamiBalance: number): number {
  if (yamiBalance === 0) return 0.8
  if (yamiBalance <= 1_000) return 0.5
  if (yamiBalance <= 10_000) return 0.25
  return 0.1
}

export function getTraceFeeTier(yamiBalance: number): TraceFeeTier {
  const traceFeePercent = getTraceFeeRate(yamiBalance) * 100
  return {
    traceFeePercent,
    receivePercent: 100 - traceFeePercent,
    label:
      yamiBalance === 0
        ? 'NO HOLD — MAX TRACE'
        : yamiBalance <= 1_000
          ? 'LOW HOLD'
          : yamiBalance <= 10_000
            ? 'MID HOLD'
            : 'WHALE STEALTH',
  }
}

export function getDirtyCreditsPerMin(
  phase: GamePhase,
  hardwareLevel: number,
  softwareLevel: number,
  distributionLevel = 0,
): number {
  return (
    phase * 1.6 +
    hardwareLevel * SKILL_CREDIT_HW +
    softwareLevel * SKILL_CREDIT_SW +
    distributionLevel * SKILL_CREDIT_DIST
  )
}

/** Breach odds — Network path + phase only (Software affects loot, not win rate). */
export function getRaidSuccessRateCap(networkLevel: number): number {
  let cap = RAID_MAX_SUCCESS_RATE
  if (networkLevel >= 6) cap += 0.02
  return cap
}

export function calculateRaidSuccessRate(
  phase: GamePhase,
  networkLevel: number,
): number {
  const rate =
    RAID_MIN_SUCCESS_RATE +
    (phase - 1) * 0.028 +
    networkLevel * 0.018
  return Math.min(getRaidSuccessRateCap(networkLevel), rate)
}

export function getEffectiveRaidEntryFee(networkLevel: number): number {
  if (networkLevel >= 3) {
    return Math.floor(RAID_ENTRY_FEE_YAMI * 0.9)
  }
  return RAID_ENTRY_FEE_YAMI
}

export function getEffectiveRaidCooldownMs(softwareLevel: number): number {
  if (softwareLevel >= 10) {
    return RAID_COOLDOWN_MS - 12_000
  }
  return RAID_COOLDOWN_MS
}

export function getEffectiveTraceFeeRate(
  yamiBalance: number,
  stealthLevel: number,
): number {
  const base = getTraceFeeRate(yamiBalance)
  if (stealthLevel >= 3) return base * 0.85
  return base
}

/** Min/max loot range for Node Scanner milestone preview. */
export function getRaidLootRange(
  phase: GamePhase,
  softwareLevel: number,
): { minYen: number; maxYen: number; minCredits: number; maxCredits: number } {
  const accuracyMult = 1 + softwareLevel * 0.022
  const yen = getRaidYenRange(phase, accuracyMult)
  const credits = getRaidCreditRange(phase, accuracyMult)
  return {
    minYen: yen.min,
    maxYen: yen.max,
    minCredits: credits.min,
    maxCredits: credits.max,
  }
}

export function getRaidCooldownRemaining(
  lastRaidAt: number,
  softwareLevel: number,
  now = Date.now(),
): number {
  if (lastRaidAt <= 0) return 0
  const cooldownMs = getEffectiveRaidCooldownMs(softwareLevel)
  return Math.max(0, cooldownMs - (now - lastRaidAt))
}

/** Software accuracy boosts extraction on successful breaches. */
export function rollRaidRewards(
  phase: GamePhase,
  softwareLevel: number,
  lootMultiplier = 1,
): { dirtyCredits: number; yen: number } {
  const accuracyMult = 1 + softwareLevel * 0.022
  const totalMult = accuracyMult * lootMultiplier
  return {
    dirtyCredits: rollRaidCreditAmount(phase, totalMult),
    yen: rollRaidYenAmount(phase, totalMult),
  }
}

export interface LaunderResult {
  success: boolean
  message: string
  yamiReceived?: number
  traceFeePercent?: number
  creditsSpent?: number
}

export interface RaidResult {
  success: boolean
  message: string
  dirtyCreditsGained?: number
  yenGained?: number
  yamiLost?: number
  isGhostRaid?: boolean
  ghostHandle?: string
}

export interface HijackResult {
  success: boolean
  message: string
  yamiSpent?: number
}
