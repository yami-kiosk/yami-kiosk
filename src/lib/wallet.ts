import { PublicKey } from '@solana/web3.js'

export function truncatePublicKey(publicKey: string, chars = 4): string {
  if (publicKey.length <= chars * 2 + 3) return publicKey
  return `${publicKey.slice(0, chars)}...${publicKey.slice(-chars)}`
}

export function isValidSolanaAddress(address: string): boolean {
  const trimmed = address.trim()
  if (trimmed.length < 32 || trimmed.length > 44) return false
  try {
    // Throws on invalid base58 / wrong length for a Solana pubkey.
    // eslint-disable-next-line no-new
    new PublicKey(trimmed)
    return true
  } catch {
    return false
  }
}

/** Custom payout address, or burner when unset / same as burner. */
export function effectivePayoutAddress(
  burnerPubkey: string | null,
  payoutPubkey: string | null,
): string | null {
  if (!burnerPubkey) return null
  if (payoutPubkey && payoutPubkey !== burnerPubkey) return payoutPubkey
  return burnerPubkey
}
