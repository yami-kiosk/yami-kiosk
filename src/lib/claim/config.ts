import { PLACEHOLDER_CA } from '../../constants/contracts'

/** On-chain SPL claim is enabled when mint CA is configured and not explicitly disabled. */
export function isClaimEnabled(): boolean {
  if (import.meta.env.VITE_CLAIM_ENABLED === 'false') return false
  const mint = import.meta.env.VITE_YAMI_MINT?.trim()
  if (!mint || mint === PLACEHOLDER_CA) return false
  return true
}

export function getYamiMintAddress(): string | null {
  const mint = import.meta.env.VITE_YAMI_MINT?.trim()
  if (!mint || mint === PLACEHOLDER_CA) return null
  return mint
}

export function buildClaimMessage(
  seasonId: number,
  walletPubkey: string,
  issuedAtMs: number,
): string {
  return `yami-claim:v1:${seasonId}:${walletPubkey}:${issuedAtMs}`
}

export const CLAIM_MESSAGE_MAX_AGE_MS = 5 * 60 * 1000

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`
}
