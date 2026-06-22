export type RegisterOperatorCode =
  | 'INVALID'
  | 'TAKEN'
  | 'RESERVED'
  | 'WALLET_BOUND'
  | 'NETWORK'

export type RegisterOperatorResult =
  | { success: true; name: string }
  | { success: false; code: RegisterOperatorCode; message: string }

export interface LeaderboardRow {
  rank: number
  wallet_pubkey: string
  handle: string
  season_yen: number
  phase: number
}

export interface WalletRankResult {
  rank: number | null
  yen_earned: number
  phase: number
  qualified: boolean
}

export interface SyncCycleScoreResult {
  success: boolean
  yen_earned?: number
  clamped?: boolean
  clamp_reason?: 'initial_cap' | 'rate_cap' | null
  server_rate_cap?: number
  message?: string
}

export interface RpcRegisterResponse {
  success: boolean
  handle?: string
  code?: string
  message?: string
}

export interface RpcSyncResponse {
  success: boolean
  yen_earned?: number
  clamped?: boolean
  clamp_reason?: 'initial_cap' | 'rate_cap' | null
  server_rate_cap?: number
  message?: string
}

export interface RpcWalletRankResponse {
  rank: number | null
  yen_earned: number
  phase: number
  qualified: boolean
}

export type PayoutAddressCode =
  | 'INVALID'
  | 'NOT_REGISTERED'
  | 'NETWORK'

export interface OperatorPayoutResult {
  success: boolean
  burnerPubkey?: string
  payoutPubkey?: string | null
  effectivePubkey?: string
  code?: PayoutAddressCode
  message?: string
}

export interface RpcOperatorPayoutResponse {
  success: boolean
  burner_pubkey?: string
  payout_pubkey?: string | null
  effective_pubkey?: string
  code?: string
  message?: string
}

export type SeasonPayoutStatus = 'pending' | 'processing' | 'claimed' | 'failed'

export interface SeasonPayoutRow {
  season_id: number
  rank: number
  amount_yami: number
  season_yen: number
  destination_pubkey: string
  status: SeasonPayoutStatus
  tx_signature: string | null
  claim_error: string | null
  claimed_at: string | null
}

export interface RegisterSeasonPayoutResult {
  success: boolean
  registered?: boolean
  season_id?: number
  rank?: number
  amount_yami?: number
  status?: SeasonPayoutStatus
  tx_signature?: string | null
  destination_pubkey?: string
  code?: string
  message?: string
}

export type ClaimRewardCode =
  | 'NOT_CONFIGURED'
  | 'NOT_FOUND'
  | 'ALREADY_CLAIMED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'REJECTED'
  | 'TRANSFER_FAILED'
  | 'NETWORK'
  | 'INVALID'

export interface ClaimRewardResult {
  success: boolean
  tx_signature?: string | null
  amount_yami?: number
  destination_pubkey?: string
  status?: SeasonPayoutStatus
  code?: ClaimRewardCode
  message?: string
  warning?: string
}
