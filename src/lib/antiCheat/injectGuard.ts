/** Client-side inject guard — soft click cap; server sync_cycle_score is authoritative. */

/** Block same-frame double-fire only. */
export const INJECT_MIN_INTERVAL_MS = 16

/** Rolling window — ~4 clicks/sec sustained; bursts OK, autoclick farm not. */
export const INJECT_WINDOW_MS = 60_000
export const INJECT_MAX_CLICKS_PER_WINDOW = 240

export type InjectVerdict = 'ok' | 'too_fast' | 'rate_cap'

export interface InjectGuardResult {
  verdict: InjectVerdict
  rewardMultiplier: number
  allowCombo: boolean
  message: string | null
  shouldWarn: boolean
}

interface GuardState {
  lastInjectAt: number
  timestamps: number[]
}

const state: GuardState = {
  lastInjectAt: 0,
  timestamps: [],
}

function pruneTimestamps(now: number): void {
  state.timestamps = state.timestamps.filter(
    (t) => now - t <= INJECT_WINDOW_MS,
  )
}

export function evaluateInjectAttempt(now = Date.now()): InjectGuardResult {
  if (state.lastInjectAt > 0 && now - state.lastInjectAt < INJECT_MIN_INTERVAL_MS) {
    return {
      verdict: 'too_fast',
      rewardMultiplier: 0,
      allowCombo: false,
      message: null,
      shouldWarn: false,
    }
  }

  pruneTimestamps(now)
  state.timestamps.push(now)
  state.lastInjectAt = now

  if (state.timestamps.length > INJECT_MAX_CLICKS_PER_WINDOW) {
    return {
      verdict: 'rate_cap',
      rewardMultiplier: 0,
      allowCombo: false,
      message: null,
      shouldWarn: false,
    }
  }

  return {
    verdict: 'ok',
    rewardMultiplier: 1,
    allowCombo: true,
    message: null,
    shouldWarn: false,
  }
}

/** Dev / testing only */
export function resetInjectGuard(): void {
  state.lastInjectAt = 0
  state.timestamps = []
}

export function getInjectGuardStatus(now = Date.now()): {
  botPenaltyRemainingMs: number
  recentClickCount: number
} {
  pruneTimestamps(now)
  return {
    botPenaltyRemainingMs: 0,
    recentClickCount: state.timestamps.length,
  }
}
