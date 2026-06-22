import { createClient } from 'npm:@supabase/supabase-js@2'
import { PublicKey } from 'npm:@solana/web3.js@1.98.4'
import nacl from 'npm:tweetnacl@1.0.3'
import bs58 from 'npm:bs58@6.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000

type SyndicateAction = 'register' | 'set_payout' | 'sync_score' | 'register_payout'

interface SyndicateWriteRequest {
  action?: SyndicateAction
  wallet?: string
  message?: string
  signature?: string
  handle?: string
  payoutPubkey?: string | null
  seasonId?: number
  yenEarned?: number
  phase?: number
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function verifySignature(
  message: string,
  signatureB58: string,
  walletPubkey: string,
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message)
    const signature = bs58.decode(signatureB58)
    const pubkeyBytes = new PublicKey(walletPubkey).toBytes()
    return nacl.sign.detached.verify(messageBytes, signature, pubkeyBytes)
  } catch {
    return false
  }
}

function parseIssuedAt(message: string): number | null {
  const parts = message.split(':')
  const issuedAt = Number(parts[parts.length - 1])
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return null
  return issuedAt
}

function assertFreshMessage(message: string): string | null {
  const issuedAt = parseIssuedAt(message)
  if (issuedAt == null) return 'Invalid message timestamp.'
  const ageMs = Date.now() - issuedAt
  if (ageMs < 0 || ageMs > MAX_MESSAGE_AGE_MS) {
    return 'Signed message expired — retry.'
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, message: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { success: false, code: 'NOT_CONFIGURED', message: 'Syndicate write gateway offline.' },
      503,
    )
  }

  let body: SyndicateWriteRequest
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const action = body.action
  const wallet = body.wallet?.trim()
  const message = body.message?.trim()
  const signature = body.signature?.trim()

  if (!action || !wallet || !message || !signature) {
    return jsonResponse(
      { success: false, message: 'Missing action, wallet, message, or signature.' },
      400,
    )
  }

  const freshnessError = assertFreshMessage(message)
  if (freshnessError) {
    return jsonResponse({ success: false, message: freshnessError }, 400)
  }

  if (!verifySignature(message, signature, wallet)) {
    return jsonResponse({ success: false, message: 'Invalid burner signature.' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  if (action === 'register') {
    const handle = body.handle?.trim().toUpperCase()
    const expected = `yami-register:v1:${handle}:${wallet}:${parseIssuedAt(message)}`
    if (message !== expected || !handle) {
      return jsonResponse({ success: false, message: 'Register message mismatch.' }, 400)
    }

    const { data, error } = await admin.rpc('register_operator', {
      p_handle: handle,
      p_wallet: wallet,
    })
    if (error) {
      return jsonResponse({ success: false, message: error.message }, 500)
    }
    return jsonResponse(data as Record<string, unknown>)
  }

  if (action === 'set_payout') {
    const payout = body.payoutPubkey?.trim() ?? ''
    const expected = `yami-payout:v1:${wallet}:${payout}:${parseIssuedAt(message)}`
    if (message !== expected) {
      return jsonResponse({ success: false, message: 'Payout message mismatch.' }, 400)
    }

    const { data, error } = await admin.rpc('set_operator_payout', {
      p_wallet: wallet,
      p_payout_pubkey: payout,
    })
    if (error) {
      return jsonResponse({ success: false, message: error.message }, 500)
    }
    return jsonResponse(data as Record<string, unknown>)
  }

  if (action === 'sync_score') {
    const seasonId = body.seasonId
    const yenEarned = body.yenEarned
    const phase = body.phase
    if (seasonId == null || yenEarned == null || phase == null) {
      return jsonResponse({ success: false, message: 'Missing sync fields.' }, 400)
    }

    const yenInt = Math.floor(Number(yenEarned))
    const phaseInt = Math.floor(Number(phase))
    const expected = `yami-sync:v1:${seasonId}:${wallet}:${yenInt}:${phaseInt}:${parseIssuedAt(message)}`
    if (message !== expected) {
      return jsonResponse({ success: false, message: 'Sync message mismatch.' }, 400)
    }

    const { data, error } = await admin.rpc('sync_cycle_score', {
      p_wallet: wallet,
      p_season_id: seasonId,
      p_yen_earned: yenEarned,
      p_phase: phaseInt,
    })
    if (error) {
      return jsonResponse({ success: false, message: error.message }, 500)
    }
    return jsonResponse(data as Record<string, unknown>)
  }

  if (action === 'register_payout') {
    const seasonId = body.seasonId
    if (seasonId == null) {
      return jsonResponse({ success: false, message: 'Missing seasonId.' }, 400)
    }

    const expected = `yami-payout-reg:v1:${seasonId}:${wallet}:${parseIssuedAt(message)}`
    if (message !== expected) {
      return jsonResponse({ success: false, message: 'Payout register message mismatch.' }, 400)
    }

    const { data, error } = await admin.rpc('register_season_payout', {
      p_wallet: wallet,
      p_season_id: seasonId,
    })
    if (error) {
      return jsonResponse({ success: false, message: error.message }, 500)
    }
    return jsonResponse(data as Record<string, unknown>)
  }

  return jsonResponse({ success: false, message: 'Unknown action.' }, 400)
})
