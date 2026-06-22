import { signBurnerMessage } from '../wallet/syndicateMessages'

export function signClaimMessage(message: string, walletPublicKey?: string): string {
  return signBurnerMessage(message, walletPublicKey ?? null)
}
