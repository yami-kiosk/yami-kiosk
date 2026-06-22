import type { GamePhase } from '../store/gameConfig'
import {
  LEADERBOARD_TOP_N,
  getPayoutYamiForRank,
  isSeasonQualified,
} from '../store/seasonConfig'
import {
  buildLeaderboardOffline,
  getLocalLeaderboardStatsOffline,
  type LeaderboardEntry,
  type LocalLeaderboardPlayer,
} from './leaderboardOffline'
import { getOperatorDisplayName } from './operatorName'
import {
  fetchLeaderboardRemote,
  fetchWalletRankRemote,
  syncCycleScoreRemote,
} from './supabase/api'
import { isSupabaseConfigured } from './supabase/client'

function truncateWallet(pubkey: string | null): string | null {
  if (!pubkey) return null
  return `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`
}

function mapRemoteRows(
  rows: Awaited<ReturnType<typeof fetchLeaderboardRemote>>,
  localWallet: string | null,
): LeaderboardEntry[] {
  return rows.map((row) => ({
    rank: row.rank,
    handle: row.handle,
    seasonYen: row.season_yen,
    phase: row.phase,
    isLocal: Boolean(localWallet && row.wallet_pubkey === localWallet),
    walletHint: truncateWallet(row.wallet_pubkey),
    payoutYami:
      row.phase >= 2 && row.rank <= LEADERBOARD_TOP_N
        ? getPayoutYamiForRank(row.rank)
        : 0,
    qualified: row.phase >= 2,
  }))
}

export interface LoadedLeaderboard {
  entries: LeaderboardEntry[]
  localRank: number | null
  localYenEarned: number
  payoutYami: number
  qualified: boolean
  source: 'live' | 'offline'
}

export async function loadLeaderboard(
  seasonId: number,
  localPlayer: LocalLeaderboardPlayer,
): Promise<LoadedLeaderboard> {
  const qualified = isSeasonQualified(localPlayer.phase)
  const localHandle = getOperatorDisplayName(localPlayer.operatorName)

  if (isSupabaseConfigured()) {
    try {
      const wallet = localPlayer.walletPublicKey
      const hasOperator = Boolean(wallet && localPlayer.operatorName)

      if (hasOperator) {
        await syncCycleScoreRemote(
          wallet!,
          seasonId,
          localPlayer.seasonYenEarned,
          localPlayer.phase,
        )
      }

      const [rows, walletRank] = await Promise.all([
        fetchLeaderboardRemote(seasonId, LEADERBOARD_TOP_N),
        wallet
          ? fetchWalletRankRemote(wallet, seasonId)
          : Promise.resolve(null),
      ])

      const serverYen = walletRank?.yen_earned ?? localPlayer.seasonYenEarned
      const entries = mapRemoteRows(rows, wallet)

      const localInTop = entries.find((e) => e.isLocal)
      const localRank = walletRank?.rank ?? localInTop?.rank ?? null
      const payoutYami =
        localRank && localRank <= LEADERBOARD_TOP_N
          ? getPayoutYamiForRank(localRank)
          : 0

      if (
        hasOperator &&
        qualified &&
        !entries.some((e) => e.isLocal) &&
        serverYen > 0
      ) {
        entries.push({
          rank: localRank ?? entries.length + 1,
          handle: localHandle,
          seasonYen: serverYen,
          phase: localPlayer.phase,
          isLocal: true,
          walletHint: truncateWallet(wallet),
          payoutYami,
          qualified: true,
        })
        entries.sort((a, b) => b.seasonYen - a.seasonYen)
        entries.forEach((e, i) => {
          e.rank = i + 1
          e.payoutYami =
            e.qualified && e.rank <= LEADERBOARD_TOP_N
              ? getPayoutYamiForRank(e.rank)
              : 0
        })
      }

      return {
        entries: entries.slice(0, LEADERBOARD_TOP_N),
        localRank: hasOperator ? localRank : null,
        localYenEarned: hasOperator ? serverYen : localPlayer.seasonYenEarned,
        payoutYami: hasOperator ? payoutYami : 0,
        qualified,
        source: 'live',
      }
    } catch (err) {
      console.warn('[leaderboard] live sync failed, using offline board', err)
    }
  }

  const board = buildLeaderboardOffline(seasonId, localPlayer)
  const local = board.find((e) => e.isLocal)

  return {
    entries: board.slice(0, LEADERBOARD_TOP_N),
    localRank: local?.rank ?? null,
    localYenEarned: localPlayer.seasonYenEarned,
    payoutYami: local?.payoutYami ?? 0,
    qualified,
    source: 'offline',
  }
}

export async function computeSeasonPayoutRemote(params: {
  phase: GamePhase
  seasonYenEarned: number
  walletPublicKey: string | null
  operatorName: string
  seasonId: number
}): Promise<{
  payoutYami: number
  qualified: boolean
  rank: number | null
  seasonYenEarned: number
}> {
  if (
    isSupabaseConfigured() &&
    params.walletPublicKey &&
    params.operatorName
  ) {
    const sync = await syncCycleScoreRemote(
      params.walletPublicKey,
      params.seasonId,
      params.seasonYenEarned,
      params.phase,
    )

    const yenEarned = sync.yen_earned ?? params.seasonYenEarned
    const rankResult = await fetchWalletRankRemote(
      params.walletPublicKey,
      params.seasonId,
    )

    const qualified = isSeasonQualified(params.phase)
    const rank = rankResult?.rank ?? null
    const payoutYami =
      qualified && rank && rank <= LEADERBOARD_TOP_N
        ? getPayoutYamiForRank(rank)
        : 0

    return {
      payoutYami,
      qualified,
      rank,
      seasonYenEarned: yenEarned,
    }
  }

  const board = getLocalLeaderboardStatsOffline(params.seasonId, {
    seasonYenEarned: params.seasonYenEarned,
    phase: params.phase,
    walletPublicKey: params.walletPublicKey,
    operatorName: params.operatorName,
  })

  return {
    payoutYami: board.payoutYami,
    qualified: board.qualified,
    rank: board.rank,
    seasonYenEarned: params.seasonYenEarned,
  }
}
