import {
  buildClaimMessage,
  CLAIM_MESSAGE_MAX_AGE_MS,
  isClaimEnabled,
} from './config'
import { signClaimMessage } from './signClaimMessage'
import {
  claimSeasonRewardRemote,
  fetchClaimablePayoutsRemote,
  registerSeasonPayoutRemote,
} from '../supabase/api'
import { isSupabaseConfigured } from '../supabase/client'
import type { ClaimRewardResult, SeasonPayoutRow, RegisterSeasonPayoutResult } from '../supabase/types'

export { isClaimEnabled }

export async function registerSeasonEntitlement(
  walletPublicKey: string,
  seasonId: number,
): Promise<RegisterSeasonPayoutResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Syndicate offline.' }
  }
  return registerSeasonPayoutRemote(walletPublicKey, seasonId)
}

export async function loadClaimablePayouts(
  walletPublicKey: string,
): Promise<SeasonPayoutRow[]> {
  if (!isSupabaseConfigured()) return []
  return fetchClaimablePayoutsRemote(walletPublicKey)
}

export async function claimSeasonReward(
  walletPublicKey: string,
  seasonId: number,
): Promise<ClaimRewardResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      code: 'NETWORK',
      message: 'Syndicate network offline.',
    }
  }

  if (!isClaimEnabled()) {
    return {
      success: false,
      code: 'NOT_CONFIGURED',
      message: 'On-chain claim not live yet — set VITE_YAMI_MINT when token launches.',
    }
  }

  const issuedAt = Date.now()
  const message = buildClaimMessage(seasonId, walletPublicKey, issuedAt)
  const signature = signClaimMessage(message, walletPublicKey)

  return claimSeasonRewardRemote({
    wallet: walletPublicKey,
    seasonId,
    message,
    signature,
    issuedAt,
  })
}

export function getPendingPayouts(rows: SeasonPayoutRow[]): SeasonPayoutRow[] {
  return rows.filter((row) => row.status === 'pending' || row.status === 'failed')
}

export { CLAIM_MESSAGE_MAX_AGE_MS }
