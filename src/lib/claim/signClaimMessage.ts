import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { loadOrCreateBurnerKeypair } from '../../store/walletUtils'

export function signClaimMessage(message: string): string {
  const keypair = loadOrCreateBurnerKeypair()
  const encoded = new TextEncoder().encode(message)
  const signature = nacl.sign.detached(encoded, keypair.secretKey)
  return bs58.encode(signature)
}

export function getBurnerPublicKeyForClaim(): string {
  return loadOrCreateBurnerKeypair().publicKey.toBase58()
}
