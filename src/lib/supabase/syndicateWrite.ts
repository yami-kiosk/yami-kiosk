import { getSupabase, isSupabaseConfigured } from './client'
import {
  buildPayoutMessage,
  buildRegisterMessage,
  buildRegisterPayoutMessage,
  buildSyncScoreMessage,
  signBurnerMessage,
} from '../wallet/syndicateMessages'

export type SyndicateWriteAction =
  | 'register'
  | 'set_payout'
  | 'sync_score'
  | 'register_payout'

async function invokeSyndicateWrite(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Syndicate network offline.' }
  }

  const supabase = getSupabase()
  if (!supabase) {
    return { success: false, message: 'Syndicate client offline.' }
  }

  const { data, error } = await supabase.functions.invoke('syndicate-write', {
    body,
  })

  if (error) {
    console.warn('[syndicate-write]', error.message)
    return { success: false, message: error.message, code: 'NETWORK' }
  }

  return (data ?? {}) as Record<string, unknown>
}

export async function signedRegisterOperator(
  handle: string,
  wallet: string,
): Promise<Record<string, unknown>> {
  const issuedAt = Date.now()
  const message = buildRegisterMessage(handle, wallet, issuedAt)
  const signature = signBurnerMessage(message, wallet)

  return invokeSyndicateWrite({
    action: 'register',
    wallet,
    handle,
    message,
    signature,
  })
}

export async function signedSetOperatorPayout(
  wallet: string,
  payoutPubkey: string | null,
): Promise<Record<string, unknown>> {
  const issuedAt = Date.now()
  const message = buildPayoutMessage(wallet, payoutPubkey, issuedAt)
  const signature = signBurnerMessage(message, wallet)

  return invokeSyndicateWrite({
    action: 'set_payout',
    wallet,
    payoutPubkey,
    message,
    signature,
  })
}

export async function signedSyncCycleScore(
  wallet: string,
  seasonId: number,
  yenEarned: number,
  phase: number,
): Promise<Record<string, unknown>> {
  const issuedAt = Date.now()
  const message = buildSyncScoreMessage(seasonId, wallet, yenEarned, phase, issuedAt)
  const signature = signBurnerMessage(message, wallet)

  return invokeSyndicateWrite({
    action: 'sync_score',
    wallet,
    seasonId,
    yenEarned,
    phase,
    message,
    signature,
  })
}

export async function signedRegisterSeasonPayout(
  wallet: string,
  seasonId: number,
): Promise<Record<string, unknown>> {
  const issuedAt = Date.now()
  const message = buildRegisterPayoutMessage(seasonId, wallet, issuedAt)
  const signature = signBurnerMessage(message, wallet)

  return invokeSyndicateWrite({
    action: 'register_payout',
    wallet,
    seasonId,
    message,
    signature,
  })
}
