import { getSupabase, isSupabaseConfigured } from './client'
import type {
  ClaimRewardResult,
  LeaderboardRow,
  OperatorPayoutResult,
  RegisterOperatorResult,
  RegisterSeasonPayoutResult,
  RpcOperatorPayoutResponse,
  RpcRegisterResponse,
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

  const supabase = getSupabase()
  if (!supabase) {
    return {
      success: false,
      code: 'NETWORK',
      message: 'Syndicate network offline.',
    }
  }

  const { data, error } = await supabase.rpc('register_operator', {
    p_handle: handle,
    p_wallet: walletPublicKey,
  })

  if (error) {
    console.warn('[supabase] register_operator', error.message)
    return {
      success: false,
      code: 'NETWORK',
      message: error.message,
    }
  }

  const payload = data as RpcRegisterResponse
  if (payload.success && payload.handle) {
    return { success: true, name: payload.handle }
  }

  return {
    success: false,
    code: (payload.code ?? 'NETWORK') as 'INVALID' | 'TAKEN' | 'RESERVED' | 'WALLET_BOUND' | 'NETWORK',
    message: payload.message ?? 'Registration failed.',
  }
}

export async function syncCycleScoreRemote(
  walletPublicKey: string,
  seasonId: number,
  yenEarned: number,
  phase: number,
): Promise<SyncCycleScoreResult> {
  const supabase = getSupabase()
  if (!supabase) {
    return { success: false, message: 'Offline' }
  }

  const { data, error } = await supabase.rpc('sync_cycle_score', {
    p_wallet: walletPublicKey,
    p_season_id: seasonId,
    p_yen_earned: yenEarned,
    p_phase: phase,
  })

  if (error) {
    console.warn('[supabase] sync_cycle_score', error.message)
    return { success: false, message: error.message }
  }

  const payload = data as RpcSyncResponse
  return {
    success: Boolean(payload.success),
    yen_earned: payload.yen_earned,
    clamped: payload.clamped,
    clamp_reason: payload.clamp_reason ?? null,
    server_rate_cap: payload.server_rate_cap,
    message: payload.message,
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

  const supabase = getSupabase()
  if (!supabase) {
    return {
      success: false,
      code: 'NETWORK',
      message: 'Syndicate network offline.',
    }
  }

  const { data, error } = await supabase.rpc('set_operator_payout', {
    p_wallet: walletPublicKey,
    p_payout_pubkey: payoutPubkey ?? '',
  })

  if (error) {
    console.warn('[supabase] set_operator_payout', error.message)
    return {
      success: false,
      code: 'NETWORK',
      message: error.message,
    }
  }

  const payload = data as RpcOperatorPayoutResponse
  if (payload.success) {
    return {
      success: true,
      payoutPubkey: payload.payout_pubkey ?? null,
      effectivePubkey: payload.effective_pubkey,
    }
  }

  return {
    success: false,
    code: (payload.code ?? 'NETWORK') as OperatorPayoutResult['code'],
    message: payload.message ?? 'Failed to save payout address.',
  }
}

export async function registerSeasonPayoutRemote(
  walletPublicKey: string,
  seasonId: number,
): Promise<RegisterSeasonPayoutResult> {
  const supabase = getSupabase()
  if (!supabase) {
    return { success: false, message: 'Offline' }
  }

  const { data, error } = await supabase.rpc('register_season_payout', {
    p_wallet: walletPublicKey,
    p_season_id: seasonId,
  })

  if (error) {
    console.warn('[supabase] register_season_payout', error.message)
    return { success: false, message: error.message }
  }

  const payload = data as RegisterSeasonPayoutResult
  return {
    success: Boolean(payload.success),
    registered: payload.registered,
    season_id: payload.season_id,
    rank: payload.rank,
    amount_yami: payload.amount_yami,
    status: payload.status,
    tx_signature: payload.tx_signature ?? null,
    destination_pubkey: payload.destination_pubkey,
    code: payload.code,
    message: payload.message,
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
