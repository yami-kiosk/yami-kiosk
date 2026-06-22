import { getSupabase, isSupabaseConfigured } from './client'
import {
  buildPayoutMessage,
  buildRegisterMessage,
  buildRegisterPayoutMessage,
  buildSyncScoreMessage,
  signBurnerMessage,
} from '../wallet/syndicateMessages'

function isEdgeFunctionInvokeFailure(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('edge function') ||
    lower.includes('functionsfetcherror') ||
    lower.includes('failed to send a request') ||
    lower.includes('function not found') ||
    lower.includes('404')
  )
}

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
    return {
      success: false,
      message: error.message,
      code: 'NETWORK',
      edgeUnavailable: isEdgeFunctionInvokeFailure(error.message),
    }
  }

  return (data ?? {}) as Record<string, unknown>
}

async function rpcFallback(
  edgeResult: Record<string, unknown>,
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Record<string, unknown>> {
  if (edgeResult.success === true) return edgeResult
  if (edgeResult.edgeUnavailable !== true) return edgeResult

  const supabase = getSupabase()
  if (!supabase) return edgeResult

  console.warn('[syndicate-write] edge offline — falling back to direct RPC')
  const { data, error } = await run()

  if (error) {
    const needsDeploy = error.message.toLowerCase().includes('permission')
    return {
      success: false,
      code: 'NETWORK',
      message: needsDeploy
        ? 'Edge function not deployed. Run: supabase functions deploy syndicate-write'
        : error.message,
    }
  }

  if (data == null) {
    return { success: false, message: 'Empty RPC response.' }
  }

  return typeof data === 'object' && data !== null
    ? (data as Record<string, unknown>)
    : { success: false, message: 'Invalid RPC response.' }
}

export async function signedRegisterOperator(
  handle: string,
  wallet: string,
): Promise<Record<string, unknown>> {
  const issuedAt = Date.now()
  const message = buildRegisterMessage(handle, wallet, issuedAt)
  const signature = signBurnerMessage(message, wallet)

  const edge = await invokeSyndicateWrite({
    action: 'register',
    wallet,
    handle,
    message,
    signature,
  })

  return rpcFallback(edge, async () =>
    getSupabase()!.rpc('register_operator', {
      p_handle: handle,
      p_wallet: wallet,
    }),
  )
}

export async function signedSetOperatorPayout(
  wallet: string,
  payoutPubkey: string | null,
): Promise<Record<string, unknown>> {
  const issuedAt = Date.now()
  const message = buildPayoutMessage(wallet, payoutPubkey, issuedAt)
  const signature = signBurnerMessage(message, wallet)

  const edge = await invokeSyndicateWrite({
    action: 'set_payout',
    wallet,
    payoutPubkey,
    message,
    signature,
  })

  return rpcFallback(edge, async () =>
    getSupabase()!.rpc('set_operator_payout', {
      p_wallet: wallet,
      p_payout_pubkey: payoutPubkey ?? '',
    }),
  )
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

  const edge = await invokeSyndicateWrite({
    action: 'sync_score',
    wallet,
    seasonId,
    yenEarned,
    phase,
    message,
    signature,
  })

  return rpcFallback(edge, async () =>
    getSupabase()!.rpc('sync_cycle_score', {
      p_wallet: wallet,
      p_season_id: seasonId,
      p_yen_earned: yenEarned,
      p_phase: phase,
    }),
  )
}

export async function signedRegisterSeasonPayout(
  wallet: string,
  seasonId: number,
): Promise<Record<string, unknown>> {
  const issuedAt = Date.now()
  const message = buildRegisterPayoutMessage(seasonId, wallet, issuedAt)
  const signature = signBurnerMessage(message, wallet)

  const edge = await invokeSyndicateWrite({
    action: 'register_payout',
    wallet,
    seasonId,
    message,
    signature,
  })

  return rpcFallback(edge, async () =>
    getSupabase()!.rpc('register_season_payout', {
      p_wallet: wallet,
      p_season_id: seasonId,
    }),
  )
}
