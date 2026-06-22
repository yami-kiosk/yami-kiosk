import type { GamePhase } from '../store/gameConfig'
import { getOperatorDisplayName } from './operatorName'
import {
  LEADERBOARD_TOP_N,
  getPayoutYamiForRank,
  getSeasonWindow,
  isSeasonQualified,
} from '../store/seasonConfig'
import { SYNDICATE_NPC_HANDLES } from './reservedHandles'

export interface LeaderboardEntry {
  rank: number
  handle: string
  seasonYen: number
  phase: number
  isLocal: boolean
  walletHint: string | null
  payoutYami: number
  qualified: boolean
}

export interface LocalLeaderboardPlayer {
  seasonYenEarned: number
  phase: GamePhase
  walletPublicKey: string | null
  operatorName: string
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), state | 1)
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function truncateWallet(pubkey: string | null): string | null {
  if (!pubkey) return null
  return `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`
}

function generateMockEntries(
  seasonId: number,
  now: number,
): Omit<LeaderboardEntry, 'rank'>[] {
  const { startMs, endMs } = getSeasonWindow(seasonId, now)
  const progress = Math.min(1, Math.max(0, (now - startMs) / (endMs - startMs)))
  const rng = mulberry32(seasonId * 9973 + Math.floor(now / 3_600_000))
  const baseCeiling = 80_000 + progress * 4_500_000

  return SYNDICATE_NPC_HANDLES.map((handle, index) => {
    const roll = rng()
    const phase = (2 + Math.floor(rng() * 5)) as GamePhase
    const seasonYen = Math.floor(
      baseCeiling * (0.15 + roll * 0.85) * (1 - index * 0.012),
    )

    return {
      handle,
      seasonYen,
      phase,
      isLocal: false,
      walletHint: `${handle.slice(0, 3)}…${String(index).padStart(2, '0')}`,
      payoutYami: 0,
      qualified: true,
    }
  })
}

function rankEntries(
  entries: Omit<LeaderboardEntry, 'rank'>[],
): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => b.seasonYen - a.seasonYen)

  return sorted.map((entry, index) => {
    const rank = index + 1
    return {
      ...entry,
      rank,
      payoutYami:
        entry.qualified && rank <= LEADERBOARD_TOP_N
          ? getPayoutYamiForRank(rank)
          : 0,
    }
  })
}

export function buildLeaderboardOffline(
  seasonId: number,
  localPlayer: LocalLeaderboardPlayer,
  now = Date.now(),
): LeaderboardEntry[] {
  const mocks = generateMockEntries(seasonId, now)
  const qualified = isSeasonQualified(localPlayer.phase)
  const entries: Omit<LeaderboardEntry, 'rank'>[] = [...mocks]

  if (qualified) {
    entries.push({
      handle: getOperatorDisplayName(localPlayer.operatorName),
      seasonYen: localPlayer.seasonYenEarned,
      phase: localPlayer.phase,
      isLocal: true,
      walletHint: truncateWallet(localPlayer.walletPublicKey),
      payoutYami: 0,
      qualified: true,
    })
  }

  return rankEntries(entries)
}

export function getLocalLeaderboardStatsOffline(
  seasonId: number,
  localPlayer: LocalLeaderboardPlayer,
  now = Date.now(),
) {
  const qualified = isSeasonQualified(localPlayer.phase)

  if (!qualified) {
    return {
      qualified: false,
      rank: null,
      seasonYenEarned: localPlayer.seasonYenEarned,
      payoutYami: 0,
      topEntries: rankEntries(generateMockEntries(seasonId, now)).slice(
        0,
        LEADERBOARD_TOP_N,
      ),
    }
  }

  const board = buildLeaderboardOffline(seasonId, localPlayer, now)
  const local = board.find((e) => e.isLocal)

  return {
    qualified: true,
    rank: local?.rank ?? null,
    seasonYenEarned: localPlayer.seasonYenEarned,
    payoutYami: local?.payoutYami ?? 0,
    topEntries: board.slice(0, LEADERBOARD_TOP_N),
  }
}

export function formatSeasonCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'

  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function formatSeasonYen(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return Math.floor(value).toLocaleString()
}

export { LEADERBOARD_TOP_N }
export { SEASON_POOL_YAMI } from '../store/seasonConfig'
