import { getSupabase, isSupabaseConfigured } from './client'
import {
  signedRegisterOperator,
  signedRegisterSeasonPayout,
  signedSetOperatorPayout,
  signedSyncCycleScore,
} from './syndicateWrite'
import type {
  ClaimRewardResult,
  LeaderboardRow,
  OperatorPayoutResult,
  RegisterOperatorResult,
  RegisterSeasonPayoutResult,
  RpcOperatorPayoutResponse,
  RpcSyncResponse,
  RpcWalletRankResponse,
  SeasonPayoutRow,
  SyncCycleScoreResult,
  WalletRankResult,
} from './types'

export async function fetchOperatorHandle(
  walletPublicKey: string,
): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_operator_handle', {
    p_wallet: walletPublicKey,
  })

  if (error) {
    console.warn('[supabase] get_operator_handle', error.message)
    return null
  }

  return typeof data === 'string' && data.length > 0 ? data : null
}

export async function registerOperatorRemote(
  handle: string,
  walletPublicKey: string,
): Promise<RegisterOperatorResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      code: 'NETWORK',
      message: 'Syndicate network offline — check Supabase config.',
    }
  }

  const payload = await signedRegisterOperator(handle, walletPublicKey)

  if (payload.success !== true) {
    const codeRaw = typeof payload.code === 'string' ? payload.code : 'NETWORK'
    const allowed = ['INVALID', 'TAKEN', 'RESERVED', 'WALLET_BOUND', 'NETWORK'] as const
    const code = (allowed as readonly string[]).includes(codeRaw)
      ? (codeRaw as (typeof allowed)[number])
      : 'NETWORK'
    return {
      success: false,
      code,
      message: String(payload.message ?? 'Registration failed.'),
    }
  }

  if (payload.handle) {
    const handleResult = String(payload.handle)
    const verified = await fetchOperatorHandle(walletPublicKey)
    if (verified && verified !== handleResult) {
      return { success: true, name: verified }
    }
    if (!verified) {
      return {
        success: false,
        code: 'NETWORK',
        message: 'Registration did not persist — deploy syndicate-write edge function.',
      }
    }
    return { success: true, name: handleResult }
  }

  return {
    success: false,
    code: 'NETWORK',
    message: String(payload.message ?? 'Registration failed.'),
  }
}

export async function syncCycleScoreRemote(
  walletPublicKey: string,
  seasonId: number,
  yenEarned: number,
  phase: number,
): Promise<SyncCycleScoreResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Offline' }
  }

  const payload = await signedSyncCycleScore(
    walletPublicKey,
    seasonId,
    yenEarned,
    phase,
  )

  if (payload.message && payload.success === false) {
    console.warn('[supabase] sync_cycle_score', payload.message)
    return { success: false, message: String(payload.message) }
  }

  const result = payload as unknown as RpcSyncResponse
  return {
    success: Boolean(result.success),
    yen_earned: result.yen_earned,
    clamped: result.clamped,
    clamp_reason: result.clamp_reason ?? null,
    server_rate_cap: result.server_rate_cap,
    message: result.message,
  }
}

export async function fetchLeaderboardRemote(
  seasonId: number,
  limit = 10,
): Promise<LeaderboardRow[]> {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Syndicate client offline.')
  }

  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_season_id: seasonId,
    p_limit: limit,
  })

  if (error) {
    console.warn('[supabase] get_leaderboard', error.message)
    throw new Error(error.message)
  }

  if (!Array.isArray(data)) return []

  return data.map((row) => ({
    rank: Number(row.rank),
    wallet_pubkey: String(row.wallet_pubkey),
    handle: String(row.handle),
    season_yen: Number(row.season_yen),
    phase: Number(row.phase),
  }))
}

export async function fetchWalletRankRemote(
  walletPublicKey: string,
  seasonId: number,
): Promise<WalletRankResult | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_wallet_rank', {
    p_wallet: walletPublicKey,
    p_season_id: seasonId,
  })

  if (error) {
    console.warn('[supabase] get_wallet_rank', error.message)
    return null
  }

  const payload = data as RpcWalletRankResponse
  return {
    rank: payload.rank,
    yen_earned: Number(payload.yen_earned ?? 0),
    phase: Number(payload.phase ?? 1),
    qualified: Boolean(payload.qualified),
  }
}

export async function fetchOperatorPayoutRemote(
  walletPublicKey: string,
): Promise<OperatorPayoutResult | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_operator_payout', {
    p_wallet: walletPublicKey,
  })

  if (error) {
    console.warn('[supabase] get_operator_payout', error.message)
    return null
  }

  const payload = data as RpcOperatorPayoutResponse
  if (!payload.success) {
    return {
      success: false,
      code: (payload.code ?? 'NETWORK') as OperatorPayoutResult['code'],
      message: payload.message,
    }
  }

  return {
    success: true,
    burnerPubkey: payload.burner_pubkey,
    payoutPubkey: payload.payout_pubkey ?? null,
    effectivePubkey: payload.effective_pubkey,
  }
}

export async function setOperatorPayoutRemote(
  walletPublicKey: string,
  payoutPubkey: string | null,
): Promise<OperatorPayoutResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      code: 'NETWORK',
      message: 'Syndicate network offline — check Supabase config.',
    }
  }

  const payload = await signedSetOperatorPayout(walletPublicKey, payoutPubkey)

  if (payload.message && payload.success === false) {
    console.warn('[supabase] set_operator_payout', payload.message)
    return {
      success: false,
      code: (payload.code as OperatorPayoutResult['code']) ?? 'NETWORK',
      message: String(payload.message),
    }
  }

  const result = payload as unknown as RpcOperatorPayoutResponse
  if (result.success) {
    return {
      success: true,
      payoutPubkey: result.payout_pubkey ?? null,
      effectivePubkey: result.effective_pubkey,
    }
  }

  return {
    success: false,
    code: (result.code ?? 'NETWORK') as OperatorPayoutResult['code'],
    message: result.message ?? 'Failed to save payout address.',
  }
}

export async function registerSeasonPayoutRemote(
  walletPublicKey: string,
  seasonId: number,
): Promise<RegisterSeasonPayoutResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Offline' }
  }

  const payload = await signedRegisterSeasonPayout(walletPublicKey, seasonId)

  if (payload.message && payload.success === false) {
    console.warn('[supabase] register_season_payout', payload.message)
    return { success: false, message: String(payload.message) }
  }

  const result = payload as unknown as RegisterSeasonPayoutResult
  return {
    success: Boolean(result.success),
    registered: result.registered,
    season_id: result.season_id,
    rank: result.rank,
    amount_yami: result.amount_yami,
    status: result.status,
    tx_signature: result.tx_signature ?? null,
    destination_pubkey: result.destination_pubkey,
    code: result.code,
    message: result.message,
  }
}

export async function fetchClaimablePayoutsRemote(
  walletPublicKey: string,
): Promise<SeasonPayoutRow[]> {
  const supabase = getSupabase()
  if (!supabase) return []

  const { data, error } = await supabase.rpc('get_claimable_payouts', {
    p_wallet: walletPublicKey,
  })

  if (error) {
    console.warn('[supabase] get_claimable_payouts', error.message)
    return []
  }

  if (!Array.isArray(data)) return []

  return data.map((row) => ({
    season_id: Number(row.season_id),
    rank: Number(row.rank),
    amount_yami: Number(row.amount_yami),
    season_yen: Number(row.season_yen),
    destination_pubkey: String(row.destination_pubkey),
    status: row.status as SeasonPayoutRow['status'],
    tx_signature: row.tx_signature ? String(row.tx_signature) : null,
    claim_error: row.claim_error ? String(row.claim_error) : null,
    claimed_at: row.claimed_at ? String(row.claimed_at) : null,
  }))
}

export async function claimSeasonRewardRemote(params: {
  wallet: string
  seasonId: number
  message: string
  signature: string
  issuedAt: number
}): Promise<ClaimRewardResult> {
  const supabase = getSupabase()
  if (!supabase) {
    return {
      success: false,
      code: 'NETWORK',
      message: 'Syndicate network offline.',
    }
  }

  const { data, error } = await supabase.functions.invoke('claim-reward', {
    body: {
      wallet: params.wallet,
      seasonId: params.seasonId,
      message: params.message,
      signature: params.signature,
      issuedAt: params.issuedAt,
    },
  })

  if (error) {
    console.warn('[supabase] claim-reward', error.message)
    return {
      success: false,
      code: 'NETWORK',
      message: error.message,
    }
  }

  const payload = (data ?? {}) as ClaimRewardResult
  return {
    success: Boolean(payload.success),
    tx_signature: payload.tx_signature ?? null,
    amount_yami: payload.amount_yami,
    destination_pubkey: payload.destination_pubkey,
    status: payload.status,
    code: payload.code,
    message: payload.message,
    warning: payload.warning,
  }
}
