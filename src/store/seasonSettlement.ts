import { computeSeasonPayoutRemote } from '../lib/leaderboardService'
import type { GamePhase } from './gameConfig'
import { getCurrentSeasonId } from './seasonConfig'

export interface SeasonEndModalData {
  seasonId: number
  payoutYami: number
  qualified: boolean
  seasonYenEarned: number
  rank: number | null
  walletPublicKey: string | null
}

export interface SeasonSyncResult {
  rolledOver: boolean
  modal: SeasonEndModalData | null
  entitlementError?: string | null
}

export function buildSeasonEndModal(
  seasonId: number,
  payoutYami: number,
  qualified: boolean,
  seasonYenEarned: number,
  rank: number | null,
  walletPublicKey: string | null,
): SeasonEndModalData {
  return {
    seasonId,
    payoutYami,
    qualified,
    seasonYenEarned,
    rank,
    walletPublicKey,
  }
}

export function shouldRollSeason(activeSeasonId: number, now = Date.now()): boolean {
  return getCurrentSeasonId(now) > activeSeasonId
}

export async function computeSeasonPayout(stats: {
  phase: GamePhase
  seasonYenEarned: number
  walletPublicKey: string | null
  operatorName: string
  seasonId: number
  now?: number
}): Promise<{
  payoutYami: number
  qualified: boolean
  rank: number | null
  seasonYenEarned: number
}> {
  return computeSeasonPayoutRemote({
    phase: stats.phase,
    seasonYenEarned: stats.seasonYenEarned,
    walletPublicKey: stats.walletPublicKey,
    operatorName: stats.operatorName,
    seasonId: stats.seasonId,
  })
}
