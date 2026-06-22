/** Client-side inject anti-cheat — complements server sync_cycle_score rate caps. */

export const INJECT_MIN_INTERVAL_MS = 95
export const INJECT_WINDOW_MS = 10_000
/** ~7.5 clicks/sec sustained — above typical human spam, below most autoclickers. */
export const INJECT_MAX_PER_WINDOW = 75

export const BOT_SAMPLE_SIZE = 24
export const BOT_MIN_SAMPLES = 16
/** Inter-click timing too uniform → likely script (coefficient of variation). */
export const BOT_MAX_CV = 0.075

export const BOT_PENALTY_MS = 45_000
export const WARNING_COOLDOWN_MS = 8_000

export type InjectVerdict = 'ok' | 'too_fast' | 'rate_cap' | 'bot'

export interface InjectGuardResult {
  verdict: InjectVerdict
  rewardMultiplier: number
  allowCombo: boolean
  message: string | null
  shouldWarn: boolean
}

interface GuardState {
  timestamps: number[]
  intervals: number[]
  lastInjectAt: number
  botFlaggedUntil: number
  lastWarningAt: number
}

const state: GuardState = {
  timestamps: [],
  intervals: [],
  lastInjectAt: 0,
  botFlaggedUntil: 0,
  lastWarningAt: 0,
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 1
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean <= 0) return 1
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance) / mean
}

function pruneTimestamps(now: number): void {
  state.timestamps = state.timestamps.filter((t) => now - t <= INJECT_WINDOW_MS)
}

function detectBotPattern(): boolean {
  if (state.intervals.length < BOT_MIN_SAMPLES) return false
  const sample = state.intervals.slice(-BOT_SAMPLE_SIZE)
  return coefficientOfVariation(sample) <= BOT_MAX_CV
}

function pushWarning(message: string, now: number): InjectGuardResult {
  const shouldWarn = now - state.lastWarningAt >= WARNING_COOLDOWN_MS
  if (shouldWarn) state.lastWarningAt = now
  return {
    verdict: 'bot',
    rewardMultiplier: 0,
    allowCombo: false,
    message,
    shouldWarn,
  }
}

export function evaluateInjectAttempt(now = Date.now()): InjectGuardResult {
  if (now < state.botFlaggedUntil) {
    return pushWarning(
      'ICE TRACE — autoclick pattern flagged. Inject rewards suspended.',
      now,
    )
  }

  if (state.lastInjectAt > 0) {
    const delta = now - state.lastInjectAt
    if (delta < INJECT_MIN_INTERVAL_MS) {
      const shouldWarn = now - state.lastWarningAt >= WARNING_COOLDOWN_MS
      if (shouldWarn) state.lastWarningAt = now
      return {
        verdict: 'too_fast',
        rewardMultiplier: 0,
        allowCombo: false,
        message: 'INPUT FLOOD — inject throttled.',
        shouldWarn,
      }
    }

    state.intervals.push(delta)
    if (state.intervals.length > BOT_SAMPLE_SIZE) {
      state.intervals = state.intervals.slice(-BOT_SAMPLE_SIZE)
    }
  }

  pruneTimestamps(now)
  state.timestamps.push(now)
  state.lastInjectAt = now

  if (state.timestamps.length > INJECT_MAX_PER_WINDOW) {
    if (detectBotPattern()) {
      state.botFlaggedUntil = now + BOT_PENALTY_MS
      state.timestamps = []
      state.intervals = []
      return pushWarning(
        'SYNTHETIC INPUT DETECTED — syndicate ICE locked inject payouts.',
        now,
      )
    }

    const shouldWarn = now - state.lastWarningAt >= WARNING_COOLDOWN_MS
    if (shouldWarn) state.lastWarningAt = now
    return {
      verdict: 'rate_cap',
      rewardMultiplier: 0.35,
      allowCombo: true,
      message: 'RATE LIMIT — excess injects yield reduced $YEN.',
      shouldWarn,
    }
  }

  if (detectBotPattern()) {
    state.botFlaggedUntil = now + BOT_PENALTY_MS
    return pushWarning(
      'AUTOMATION SIGNATURE — inject script blocked by ICE.',
      now,
    )
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
  state.timestamps = []
  state.intervals = []
  state.lastInjectAt = 0
  state.botFlaggedUntil = 0
  state.lastWarningAt = 0
}

export function getInjectGuardStatus(now = Date.now()): {
  botPenaltyRemainingMs: number
  recentClickCount: number
} {
  pruneTimestamps(now)
  return {
    botPenaltyRemainingMs: Math.max(0, state.botFlaggedUntil - now),
    recentClickCount: state.timestamps.length,
  }
}
