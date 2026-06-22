/** Round $YEN to 2 decimals — avoids float drift from passive ticks */
export function roundYen(value: number): number {
  return Math.round(value * 100) / 100
}

export function canAffordYen(balance: number, cost: number): boolean {
  return roundYen(balance) + 0.001 >= cost
}

export function formatYenBalance(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 100_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function formatYenShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`
  return formatYenBalance(value)
}
