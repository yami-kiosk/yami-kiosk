import type { SkillPathId } from './skillConfig'

export type SyndicateDoctrineId = 'extractor' | 'operator' | 'fixer'

export const DOCTRINE_UNLOCK_TOTAL_LEVELS = 15

export interface DoctrineDefinition {
  id: SyndicateDoctrineId
  name: string
  tagline: string
  bonus: string
  tradeoff: string
}

export const SYNDICATE_DOCTRINES: DoctrineDefinition[] = [
  {
    id: 'extractor',
    name: 'EXTRACTOR',
    tagline: 'Breach-first syndicate cell',
    bonus: '+3% breach odds · +8% raid loot',
    tradeoff: '−4% passive $YEN',
  },
  {
    id: 'operator',
    name: 'OPERATOR',
    tagline: 'Grid-dominant vending syndicate',
    bonus: '+8% passive · +5% active click $YEN',
    tradeoff: '−2% breach odds',
  },
  {
    id: 'fixer',
    name: 'FIXER',
    tagline: 'Burner-wallet laundering cartel',
    bonus: '+10% launder output · −8% trace fee',
    tradeoff: '−4% raid loot',
  },
]

export function getTotalSkillLevels(levels: {
  hardwareLevel: number
  softwareLevel: number
  networkLevel: number
  stealthLevel: number
  distributionLevel: number
}): number {
  return (
    levels.hardwareLevel +
    levels.softwareLevel +
    levels.networkLevel +
    levels.stealthLevel +
    levels.distributionLevel
  )
}

export function canChooseDoctrine(totalLevels: number): boolean {
  return totalLevels >= DOCTRINE_UNLOCK_TOTAL_LEVELS
}

export function applyDoctrinePassiveMultiplier(
  doctrine: SyndicateDoctrineId | null,
  value: number,
): number {
  if (doctrine === 'operator') return value * 1.08
  if (doctrine === 'extractor') return value * 0.96
  return value
}

export function applyDoctrineActiveMultiplier(
  doctrine: SyndicateDoctrineId | null,
  value: number,
): number {
  if (doctrine === 'operator') return value * 1.05
  return value
}

export function applyDoctrineRaidOddsBonus(
  doctrine: SyndicateDoctrineId | null,
): number {
  if (doctrine === 'extractor') return 0.03
  if (doctrine === 'operator') return -0.02
  return 0
}

export function applyDoctrineRaidLootMultiplier(
  doctrine: SyndicateDoctrineId | null,
): number {
  if (doctrine === 'extractor') return 1.08
  if (doctrine === 'fixer') return 0.96
  return 1
}

export function applyDoctrineLaunderMultiplier(
  doctrine: SyndicateDoctrineId | null,
  value: number,
): number {
  if (doctrine === 'fixer') return value * 1.1
  return value
}

export function applyDoctrineTraceFeeMultiplier(
  doctrine: SyndicateDoctrineId | null,
  traceFee: number,
): number {
  if (doctrine === 'fixer') return traceFee * 0.92
  return traceFee
}

export function getDoctrineLabel(
  doctrine: SyndicateDoctrineId | null,
): string | null {
  if (!doctrine) return null
  return SYNDICATE_DOCTRINES.find((d) => d.id === doctrine)?.name ?? null
}

export function getDominantSkillPath(levels: {
  hardwareLevel: number
  softwareLevel: number
  networkLevel: number
  stealthLevel: number
  distributionLevel: number
}): SkillPathId {
  const entries: [SkillPathId, number][] = [
    ['hardware', levels.hardwareLevel],
    ['software', levels.softwareLevel],
    ['network', levels.networkLevel],
    ['stealth', levels.stealthLevel],
    ['distribution', levels.distributionLevel],
  ]
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}
