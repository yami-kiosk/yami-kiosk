/**
 * Client-side inject guard.
 *
 * Two cheap, robust checks — no cumulative $YEN math (that kept starving normal play):
 *  1. Frame dedupe: ignore sub-16ms double-fires (one physical click = one reward).
 *  2. Sustained-rate cap: full reward up to ~14 clicks/sec averaged over a short
 *     window. Faster than any human can sustain, so manual play is never throttled,
 *     but an autoclicker set to 20–50 cps earns no more than a very fast human.
 *
 * Leaderboard rank is additionally bounded server-side (sync_cycle_score).
 */

export const INJECT_MIN_INTERVAL_MS = 16

/** Rolling window for sustained-rate detection. */
export const INJECT_RATE_WINDOW_MS = 2_000
/** Max full-reward clicks within the window (~14 clicks/sec). */
export const INJECT_RATE_MAX_IN_WINDOW = 28

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
  const cutoff = now - INJECT_RATE_WINDOW_MS
  while (state.timestamps.length > 0 && state.timestamps[0] < cutoff) {
    state.timestamps.shift()
  }
}

export function evaluateInjectAttempt(now = Date.now()): InjectGuardResult {
  if (
    state.lastInjectAt > 0 &&
    now - state.lastInjectAt < INJECT_MIN_INTERVAL_MS
  ) {
    return {
      verdict: 'too_fast',
      rewardMultiplier: 0,
      allowCombo: false,
      message: null,
      shouldWarn: false,
    }
  }

  state.lastInjectAt = now
  pruneTimestamps(now)
  state.timestamps.push(now)

  if (state.timestamps.length > INJECT_RATE_MAX_IN_WINDOW) {
    // Over sustained human speed — no reward, but no penalty / no toast.
    return {
      verdict: 'rate_cap',
      rewardMultiplier: 0,
      allowCombo: true,
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
