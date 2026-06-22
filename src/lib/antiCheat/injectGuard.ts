/** Client-side inject guard — minimal sanity checks only; server sync_cycle_score is authoritative. */

/** Block only same-frame / double-fire (< ~1 frame at 60fps). */
export const INJECT_MIN_INTERVAL_MS = 16

export type InjectVerdict = 'ok' | 'too_fast'

export interface InjectGuardResult {
  verdict: InjectVerdict
  rewardMultiplier: number
  allowCombo: boolean
  message: string | null
  shouldWarn: boolean
}

interface GuardState {
  lastInjectAt: number
}

const state: GuardState = {
  lastInjectAt: 0,
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

  state.lastInjectAt = now

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
}

export function getInjectGuardStatus(_now = Date.now()): {
  botPenaltyRemainingMs: number
  recentClickCount: number
} {
  return {
    botPenaltyRemainingMs: 0,
    recentClickCount: 0,
  }
}
