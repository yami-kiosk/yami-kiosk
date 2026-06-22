import type { LeaderboardEntry } from './leaderboardOffline'
import type { GamePhase } from '../store/gameConfig'
import {
  applyDoctrineRaidOddsBonus,
  type SyndicateDoctrineId,
} from '../store/syndicateDoctrine'
import {
  calculateRaidSuccessRate,
  getRaidSuccessRateCap,
} from '../store/economyConfig'

export interface GhostTarget {
  handle: string
  rank: number
  seasonYen: number
  phase: number
  localRankAtScan: number | null
}

export const GHOST_RAID_MIN_NETWORK_LEVEL = 10
export const GHOST_LOOT_MULTIPLIER = 1.08
export const GHOST_RANK_ODDS_STEP = 0.003

export function pickGhostTarget(
  entries: LeaderboardEntry[],
  localHandle: string,
): GhostTarget | null {
  const candidates = entries.filter(
    (e) => !e.isLocal && e.handle.toLowerCase() !== localHandle.toLowerCase(),
  )
  if (candidates.length === 0) return null

  const pool = candidates.slice(0, Math.min(20, candidates.length))
  const picked = pool[Math.floor(Math.random() * pool.length)]
  return {
    handle: picked.handle,
    rank: picked.rank,
    seasonYen: picked.seasonYen,
    phase: picked.phase,
    localRankAtScan: null,
  }
}

export function calculateGhostBreachOdds(
  phase: GamePhase,
  networkLevel: number,
  target: GhostTarget,
  doctrine: SyndicateDoctrineId | null,
): number {
  const base = calculateRaidSuccessRate(phase, networkLevel)
  const rankGap =
    target.localRankAtScan !== null
      ? target.rank - target.localRankAtScan
      : target.rank - 10
  const rankModifier = -rankGap * GHOST_RANK_ODDS_STEP
  const doctrineBonus = applyDoctrineRaidOddsBonus(doctrine)
  const cap = getRaidSuccessRateCap(networkLevel) + 0.04

  return Math.max(0.08, Math.min(cap, base + rankModifier + doctrineBonus))
}

export function formatGhostOddsLabel(target: GhostTarget): string {
  const rankGap =
    target.localRankAtScan !== null
      ? target.rank - target.localRankAtScan
      : target.rank - 10
  if (rankGap > 5) return `HARD TARGET (+${rankGap} ranks above you)`
  if (rankGap < -5) return `SOFT TARGET (${Math.abs(rankGap)} ranks below)`
  return 'EVEN MATCH'
}

export function calculateGhostBonusYen(target: GhostTarget): number {
  const fromTarget = Math.floor(target.seasonYen * 0.0005)
  const floor = 80
  const ceiling = 2_500
  return Math.min(ceiling, Math.max(floor, fromTarget))
}
