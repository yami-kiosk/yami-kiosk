import type { OfflineProgressResult } from '../store/useGameStore'

function formatOfflineDuration(ticks: number): string {
  const mins = Math.floor(ticks / 60)
  const secs = ticks % 60
  if (mins <= 0) return `${secs}s`
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}

function formatYen(value: number): string {
  return Math.abs(value).toFixed(value < 10 ? 2 : 1)
}

export type OfflineToastPayload = {
  variant: 'success' | 'error'
  message: string
}

export function getOfflineReturnToast(
  result: OfflineProgressResult,
): OfflineToastPayload | null {
  if (result.ticksSimulated <= 0) return null

  const duration = formatOfflineDuration(result.ticksSimulated)

  if (result.wipedDuringOffline && result.yenGained < 0) {
    return {
      variant: 'error',
      message: `Grid collapsed offline (${duration}) — lost ${formatYen(result.yenGained)} $YEN`,
    }
  }

  if (result.yenGained > 0) {
    let message = `Welcome back (${duration}) — +${formatYen(result.yenGained)} $YEN`
    if (result.dirtyCreditsGained > 0) {
      message += `, +${Math.floor(result.dirtyCreditsGained)} credits`
    }
    if (result.wipedDuringOffline) {
      message += ' // grid died while away'
    }
    return { variant: 'success', message }
  }

  if (result.yenGained < 0) {
    return {
      variant: 'error',
      message: `Offline (${duration}) — lost ${formatYen(result.yenGained)} $YEN`,
    }
  }

  if (result.wipedDuringOffline && result.finalGridPower <= 0) {
    return {
      variant: 'error',
      message: `Grid dead on return (${duration}) — inject power to stop the bleed`,
    }
  }

  return null
}
