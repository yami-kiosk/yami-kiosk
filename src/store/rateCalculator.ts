import { PHASES, type GamePhase } from './gameConfig'
import { getDirtyCreditsPerMin } from './economyConfig'
import {
  SKILL_ACTIVE_PER_HW,
  SKILL_ACTIVE_PER_SW,
  SKILL_PASSIVE_PER_DIST,
  SKILL_PASSIVE_PER_HW,
} from './economyBalance'
import { getCreditDripMultiplier, getHardwarePassiveMultiplier } from './skillMilestones'
import type { SkillLevels } from './skillConfig'

export function recalculateRates(
  levels: SkillLevels,
  options?: { overclockActive?: boolean },
) {
  const phaseDef = PHASES[levels.phase]
  const passiveMult = getHardwarePassiveMultiplier(
    levels.hardwareLevel,
    options?.overclockActive ?? false,
  )
  const creditMult = getCreditDripMultiplier(levels.distributionLevel)

  const basePassive =
    phaseDef.offlineRatePerMin +
    levels.hijackPassiveBonus +
    levels.hardwareLevel * SKILL_PASSIVE_PER_HW +
    levels.distributionLevel * SKILL_PASSIVE_PER_DIST

  return {
    passiveRatePerMin: basePassive * passiveMult,
    activeRatePerMin:
      phaseDef.activeRatePerMin +
      levels.softwareLevel * SKILL_ACTIVE_PER_SW +
      levels.hardwareLevel * SKILL_ACTIVE_PER_HW,
    gridDrainPerTick: Math.max(
      0.15,
      phaseDef.gridDrainPerTick - levels.stealthLevel * 0.035,
    ),
    powerRestoreOnClick:
      phaseDef.powerRestoreOnClick + levels.stealthLevel * 0.4,
    dirtyCreditsPerMin:
      getDirtyCreditsPerMin(
        levels.phase,
        levels.hardwareLevel,
        levels.softwareLevel,
        levels.distributionLevel,
      ) * creditMult,
  }
}

export function pickSkillLevels(state: {
  phase: GamePhase
  hardwareLevel: number
  softwareLevel: number
  networkLevel: number
  stealthLevel: number
  distributionLevel: number
  hijackPassiveBonus: number
}): SkillLevels {
  return {
    phase: state.phase,
    hardwareLevel: state.hardwareLevel,
    softwareLevel: state.softwareLevel,
    networkLevel: state.networkLevel,
    stealthLevel: state.stealthLevel,
    distributionLevel: state.distributionLevel,
    hijackPassiveBonus: state.hijackPassiveBonus,
  }
}
