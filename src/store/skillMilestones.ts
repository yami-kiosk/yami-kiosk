import type { GamePhase } from './gameConfig'
import { recalculateRates } from './rateCalculator'
import {
  calculateRaidSuccessRate,
  getRaidLootRange,
} from './economyConfig'
import type { SkillLevels, SkillPathId } from './skillConfig'

export const MILESTONE_TIERS = [3, 6, 10] as const
export type MilestoneTier = (typeof MILESTONE_TIERS)[number]

export const SKILL_MILESTONES: Record<
  SkillPathId,
  Record<MilestoneTier, string>
> = {
  hardware: {
    3: 'Overdrive — +3% passive $YEN',
    6: 'Capacitor — +1% grid restore/tick',
    10: 'Overclock — 1.45× passive for 25s every 6min',
  },
  software: {
    3: 'Combo Inject — +2.5% per click streak (max 7)',
    6: 'Node Scanner — preview raid loot range',
    10: 'Breach Script — −12s raid cooldown',
  },
  network: {
    3: 'Ghost Route — −10% raid entry fee',
    6: 'Deep Cover — +2% breach odds cap',
    10: 'Shadow Node — +12% raid loot on win',
  },
  stealth: {
    3: 'VPN Mesh — −15% trace fee on launder',
    6: 'Bleed Shield — −50% grid collapse drain',
    10: 'ICE Immunity — 1 free raid fail per cycle',
  },
  distribution: {
    3: 'Bulk Wash — +10% launder output',
    6: 'Credit Pipeline — +12% credit drip',
    10: 'Wholesale Deal — 1 zero-fee launder per cycle',
  },
}

export function hasSkillMilestone(level: number, tier: MilestoneTier): boolean {
  return level >= tier
}

export function getNextMilestoneTier(level: number): MilestoneTier | null {
  for (const tier of MILESTONE_TIERS) {
    if (level < tier) return tier
  }
  return null
}

export function getUnlockedMilestones(
  pathId: SkillPathId,
  level: number,
): { tier: MilestoneTier; label: string }[] {
  return MILESTONE_TIERS.filter((tier) => level >= tier).map((tier) => ({
    tier,
    label: SKILL_MILESTONES[pathId][tier],
  }))
}

export function getMilestoneLabel(
  pathId: SkillPathId,
  tier: MilestoneTier,
): string {
  return SKILL_MILESTONES[pathId][tier]
}

export interface SkillUpgradePreview {
  perLevelEffect: string
  statDelta: string | null
  nextMilestone: { tier: MilestoneTier; label: string } | null
  unlockedMilestones: { tier: MilestoneTier; label: string }[]
}

function getLevelFromPath(levels: SkillLevels, pathId: SkillPathId): number {
  switch (pathId) {
    case 'hardware':
      return levels.hardwareLevel
    case 'software':
      return levels.softwareLevel
    case 'network':
      return levels.networkLevel
    case 'stealth':
      return levels.stealthLevel
    case 'distribution':
      return levels.distributionLevel
  }
}

function withPathLevel(
  levels: SkillLevels,
  pathId: SkillPathId,
  level: number,
): SkillLevels {
  switch (pathId) {
    case 'hardware':
      return { ...levels, hardwareLevel: level }
    case 'software':
      return { ...levels, softwareLevel: level }
    case 'network':
      return { ...levels, networkLevel: level }
    case 'stealth':
      return { ...levels, stealthLevel: level }
    case 'distribution':
      return { ...levels, distributionLevel: level }
  }
}

function formatRate(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1)
}

function buildStatDelta(
  pathId: SkillPathId,
  levels: SkillLevels,
  nextLevel: number,
): string | null {
  const current = recalculateRates(levels)
  const next = recalculateRates(withPathLevel(levels, pathId, nextLevel))

  switch (pathId) {
    case 'hardware':
      return `Passive: ${formatRate(current.passiveRatePerMin)} → ${formatRate(next.passiveRatePerMin)}/min`
    case 'software':
      return `Active: ${formatRate(current.activeRatePerMin)} → ${formatRate(next.activeRatePerMin)}/min`
    case 'network': {
      const curOdds = calculateRaidSuccessRate(
        levels.phase,
        levels.networkLevel,
      )
      const nextOdds = calculateRaidSuccessRate(levels.phase, nextLevel)
      return `Breach odds: ${(curOdds * 100).toFixed(0)}% → ${(nextOdds * 100).toFixed(0)}%`
    }
    case 'stealth':
      return `Grid drain: ${current.gridDrainPerTick.toFixed(2)} → ${next.gridDrainPerTick.toFixed(2)}/tick`
    case 'distribution':
      return `Credit drip: ${formatRate(current.dirtyCreditsPerMin)} → ${formatRate(next.dirtyCreditsPerMin)}/min`
  }
}

export function getSkillUpgradePreview(
  pathId: SkillPathId,
  levels: SkillLevels,
  perLevelEffect: string,
): SkillUpgradePreview {
  const level = getLevelFromPath(levels, pathId)
  const nextTier = getNextMilestoneTier(level)

  return {
    perLevelEffect,
    statDelta: level < 10 ? buildStatDelta(pathId, levels, level + 1) : null,
    nextMilestone:
      nextTier !== null
        ? { tier: nextTier, label: SKILL_MILESTONES[pathId][nextTier] }
        : null,
    unlockedMilestones: getUnlockedMilestones(pathId, level),
  }
}

export function getRaidPreviewLines(
  phase: GamePhase,
  softwareLevel: number,
): { minYen: number; maxYen: number; minCredits: number; maxCredits: number } | null {
  if (!hasSkillMilestone(softwareLevel, 3)) return null
  return getRaidLootRange(phase, softwareLevel)
}

export const INJECT_COMBO_WINDOW_MS = 3_000
export const INJECT_COMBO_MAX = 7
export const INJECT_COMBO_BONUS_PER_STACK = 0.025

export function getInjectComboBonusPercent(comboCount: number): number {
  return comboCount * INJECT_COMBO_BONUS_PER_STACK * 100
}

export function getInjectComboMultiplier(
  softwareLevel: number,
  comboCount: number,
): number {
  if (!hasSkillMilestone(softwareLevel, 3) || comboCount <= 0) return 1
  return 1 + comboCount * INJECT_COMBO_BONUS_PER_STACK
}

export const OVERCLOCK_DURATION_MS = 25_000
export const OVERCLOCK_INTERVAL_MS = 360_000
export const OVERCLOCK_MULTIPLIER = 1.45

export function getHardwarePassiveMultiplier(
  hardwareLevel: number,
  overclockActive: boolean,
): number {
  let mult = 1
  if (hasSkillMilestone(hardwareLevel, 3)) mult *= 1.03
  if (hasSkillMilestone(hardwareLevel, 10) && overclockActive) mult *= OVERCLOCK_MULTIPLIER
  return mult
}

export function getCreditDripMultiplier(distributionLevel: number): number {
  return hasSkillMilestone(distributionLevel, 6) ? 1.12 : 1
}

export function getLaunderOutputMultiplier(distributionLevel: number): number {
  return hasSkillMilestone(distributionLevel, 3) ? 1.1 : 1
}

export function getRaidLootWinMultiplier(networkLevel: number): number {
  return hasSkillMilestone(networkLevel, 10) ? 1.12 : 1
}
