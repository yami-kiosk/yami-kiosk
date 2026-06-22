export const OPERATOR_NAME_MIN = 3
export const OPERATOR_NAME_MAX = 16

export function sanitizeOperatorName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, OPERATOR_NAME_MAX)
}

export function isValidOperatorName(name: string): boolean {
  return (
    name.length >= OPERATOR_NAME_MIN && name.length <= OPERATOR_NAME_MAX
  )
}

export function getOperatorDisplayName(
  operatorName: string,
  fallback = 'YOU',
): string {
  const trimmed = operatorName.trim()
  return isValidOperatorName(trimmed) ? trimmed : fallback
}
