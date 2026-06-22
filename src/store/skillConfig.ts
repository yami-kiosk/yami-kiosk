import type { GamePhase } from './gameConfig'
import { getSkillPhaseCostMultiplier } from './economyBalance'

export type SkillPathId =
  | 'hardware'
  | 'software'
  | 'network'
  | 'stealth'
  | 'distribution'

export const SKILL_MAX_LEVEL = 10

/** Skill upgrade cost scales with path level and current phase */
export const SKILL_COST_BASE = 320
export const SKILL_COST_MULTIPLIER = 1.46

export function getSkillUpgradeCost(
  currentLevel: number,
  phase: GamePhase = 1,
): number {
  return Math.floor(
    SKILL_COST_BASE *
      Math.pow(SKILL_COST_MULTIPLIER, currentLevel) *
      getSkillPhaseCostMultiplier(phase),
  )
}

export function getSkillEffectLabel(pathId: SkillPathId): string {
  switch (pathId) {
    case 'hardware':
      return '+0.65 $YEN/min passive, +1.1 credits/min'
    case 'software':
      return '+2 $YEN/min active, +raid accuracy'
    case 'network':
      return '+1.8% breach odds / level'
    case 'stealth':
      return '-3.5% grid drain, +0.4% power restore'
    case 'distribution':
      return '+0.35 $YEN/min, +0.9 credits/min'
  }
}

export interface SkillLevels {
  phase: GamePhase
  hardwareLevel: number
  softwareLevel: number
  networkLevel: number
  stealthLevel: number
  distributionLevel: number
  hijackPassiveBonus: number
}

export function getSkillLevel(
  levels: SkillLevels,
  pathId: SkillPathId,
): number {
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
