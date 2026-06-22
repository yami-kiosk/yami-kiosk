import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { BURNER_SK_KEY } from './gameConfig'

export function loadOrCreateBurnerKeypair(): Keypair {
  const saved = localStorage.getItem(BURNER_SK_KEY)

  if (saved) {
    try {
      const secretKey = bs58.decode(saved)
      return Keypair.fromSecretKey(secretKey)
    } catch {
      localStorage.removeItem(BURNER_SK_KEY)
    }
  }

  const keypair = Keypair.generate()
  localStorage.setItem(BURNER_SK_KEY, bs58.encode(keypair.secretKey))
  return keypair
}

export function getBurnerSecretKeyBase58(): string | null {
  return localStorage.getItem(BURNER_SK_KEY)
}
