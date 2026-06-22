import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { loadOrCreateBurnerKeypair } from '../../store/walletUtils'

export const SYNDICATE_MESSAGE_MAX_AGE_MS = 5 * 60 * 1000

export function signBurnerMessage(
  message: string,
  expectedWallet?: string | null,
): string {
  const keypair = loadOrCreateBurnerKeypair()
  const pubkey = keypair.publicKey.toBase58()

  if (expectedWallet && expectedWallet !== pubkey) {
    throw new Error('Burner key mismatch — refresh or reset local identity.')
  }

  const encoded = new TextEncoder().encode(message)
  const signature = nacl.sign.detached(encoded, keypair.secretKey)
  return bs58.encode(signature)
}

export function buildRegisterMessage(
  handle: string,
  wallet: string,
  issuedAt = Date.now(),
): string {
  return `yami-register:v1:${handle.toUpperCase()}:${wallet}:${issuedAt}`
}

export function buildPayoutMessage(
  wallet: string,
  payoutPubkey: string | null,
  issuedAt = Date.now(),
): string {
  return `yami-payout:v1:${wallet}:${payoutPubkey ?? ''}:${issuedAt}`
}

export function buildSyncScoreMessage(
  seasonId: number,
  wallet: string,
  yenEarned: number,
  phase: number,
  issuedAt = Date.now(),
): string {
  return `yami-sync:v1:${seasonId}:${wallet}:${Math.floor(yenEarned)}:${phase}:${issuedAt}`
}

export function buildRegisterPayoutMessage(
  seasonId: number,
  wallet: string,
  issuedAt = Date.now(),
): string {
  return `yami-payout-reg:v1:${seasonId}:${wallet}:${issuedAt}`
}
