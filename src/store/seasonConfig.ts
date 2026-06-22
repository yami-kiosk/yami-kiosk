import type { GamePhase } from './gameConfig'

/** Global season anchor — all players share the same season windows */
export const SEASON_EPOCH_MS = Date.parse('2026-06-01T00:00:00.000Z')

/** 3-day pool cycles */
export const SEASON_DURATION_MS = 3 * 24 * 60 * 60 * 1000

/** Minimum phase to appear on leaderboard & receive payout */
export const SEASON_MIN_PHASE = 2 satisfies GamePhase

/** Total token supply (pump.fun standard) */
export const YAMI_TOTAL_SUPPLY = 1_000_000_000

/** Dev wallet allocation — 3% of supply */
export const DEV_WALLET_SUPPLY_SHARE = 0.03

/** Per 3-day cycle pool from dev reward vault (launch phase) */
export const SEASON_POOL_YAMI = 500_000

/** On-chain wire from dev wallet unlocks when MC reaches this USD threshold */
export const PAYOUT_WIRE_MC_THRESHOLD_USD = 50_000

export function formatMcThreshold(value = PAYOUT_WIRE_MC_THRESHOLD_USD): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${value.toLocaleString()}`
}

/** Top earners paid from pool each cycle */
export const LEADERBOARD_TOP_N = 10

/** Payout share by rank (1-indexed) — must sum to 1 */
export const LEADERBOARD_PAYOUT_SHARES = [
  0.3, 0.2, 0.15, 0.1, 0.08, 0.06, 0.04, 0.03, 0.02, 0.02,
] as const

export function isSeasonQualified(phase: GamePhase): boolean {
  return phase >= SEASON_MIN_PHASE
}

export function getCurrentSeasonId(now = Date.now()): number {
  if (now < SEASON_EPOCH_MS) return 1
  return Math.floor((now - SEASON_EPOCH_MS) / SEASON_DURATION_MS) + 1
}

export function getSeasonWindow(
  seasonId: number,
  now = Date.now(),
): { seasonId: number; startMs: number; endMs: number; isActive: boolean } {
  const effectiveId = seasonId > 0 ? seasonId : getCurrentSeasonId(now)
  const startMs = SEASON_EPOCH_MS + (effectiveId - 1) * SEASON_DURATION_MS
  const endMs = startMs + SEASON_DURATION_MS
  const currentId = getCurrentSeasonId(now)
  return {
    seasonId: effectiveId,
    startMs,
    endMs,
    isActive: effectiveId === currentId && now < endMs,
  }
}

export function getSeasonTimeRemainingMs(now = Date.now()): number {
  const { endMs } = getSeasonWindow(getCurrentSeasonId(now), now)
  return Math.max(0, endMs - now)
}

export function getPayoutShareForRank(rank: number): number {
  if (rank < 1 || rank > LEADERBOARD_TOP_N) return 0
  return LEADERBOARD_PAYOUT_SHARES[rank - 1] ?? 0
}

export function getPayoutYamiForRank(rank: number): number {
  return Math.round(SEASON_POOL_YAMI * getPayoutShareForRank(rank))
}
