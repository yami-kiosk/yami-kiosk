import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from 'npm:@solana/web3.js@1.98.4'
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from 'npm:@solana/spl-token@0.4.13'
import nacl from 'npm:tweetnacl@1.0.3'
import bs58 from 'npm:bs58@6.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const CLAIM_PREFIX = 'yami-claim:v1:'
const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000

interface ClaimRequest {
  wallet?: string
  seasonId?: number
  message?: string
  signature?: string
  issuedAt?: number
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function parseClaimMessage(message: string): {
  seasonId: number
  wallet: string
  issuedAt: number
} | null {
  if (!message.startsWith(CLAIM_PREFIX)) return null
  const parts = message.slice(CLAIM_PREFIX.length).split(':')
  if (parts.length !== 3) return null
  const seasonId = Number(parts[0])
  const wallet = parts[1]
  const issuedAt = Number(parts[2])
  if (!Number.isFinite(seasonId) || seasonId < 1) return null
  if (!wallet || wallet.length < 32) return null
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return null
  return { seasonId, wallet, issuedAt }
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, message: 'Method not allowed' }, 405)
  }

  const treasurySecret = Deno.env.get('TREASURY_SECRET_KEY')
  const mintAddress = Deno.env.get('YAMI_MINT')
  const rpcUrl =
    Deno.env.get('SOLANA_RPC_URL') ?? 'https://api.mainnet-beta.solana.com'
  const tokenDecimals = Number(Deno.env.get('YAMI_TOKEN_DECIMALS') ?? '6')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!treasurySecret || !mintAddress || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      {
        success: false,
        code: 'NOT_CONFIGURED',
        message:
          'Treasury not wired yet — set TREASURY_SECRET_KEY, YAMI_MINT, and Supabase secrets on the edge function.',
      },
      503,
    )
  }

  let body: ClaimRequest
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const wallet = body.wallet?.trim()
  const seasonId = body.seasonId
  const message = body.message?.trim()
  const signature = body.signature?.trim()

  if (!wallet || !seasonId || !message || !signature) {
    return jsonResponse(
      { success: false, message: 'Missing wallet, seasonId, message, or signature.' },
      400,
    )
  }

  const parsed = parseClaimMessage(message)
  if (!parsed) {
    return jsonResponse({ success: false, message: 'Invalid claim message format.' }, 400)
  }

  if (parsed.wallet !== wallet || parsed.seasonId !== seasonId) {
    return jsonResponse(
      { success: false, message: 'Claim message does not match request.' },
      400,
    )
  }

  const ageMs = Date.now() - parsed.issuedAt
  if (ageMs < 0 || ageMs > MAX_MESSAGE_AGE_MS) {
    return jsonResponse(
      { success: false, message: 'Claim message expired — retry claim.' },
      400,
    )
  }

  if (!verifySignature(message, signature, wallet)) {
    return jsonResponse(
      { success: false, message: 'Invalid burner signature.' },
      401,
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: beginData, error: beginError } = await admin.rpc(
    'begin_season_claim',
    { p_wallet: wallet, p_season_id: seasonId },
  )

  if (beginError) {
    return jsonResponse(
      { success: false, message: beginError.message },
      500,
    )
  }

  const begin = beginData as Record<string, unknown>
  if (!begin.success) {
    return jsonResponse(
      {
        success: false,
        code: begin.code ?? 'REJECTED',
        message: begin.message ?? 'Claim rejected.',
        tx_signature: begin.tx_signature ?? null,
      },
      409,
    )
  }

  const amountYami = Number(begin.amount_yami)
  const destination = String(begin.destination_pubkey)
  const rawAmount = BigInt(Math.round(amountYami * 10 ** tokenDecimals))

  if (!Number.isFinite(amountYami) || amountYami <= 0 || rawAmount <= 0n) {
    await admin.rpc('release_season_claim', {
      p_wallet: wallet,
      p_season_id: seasonId,
    })
    return jsonResponse({ success: false, message: 'Invalid payout amount.' }, 500)
  }

  try {
    const treasury = Keypair.fromSecretKey(bs58.decode(treasurySecret))
    const connection = new Connection(rpcUrl, 'confirmed')
    const mint = new PublicKey(mintAddress)
    const destinationOwner = new PublicKey(destination)

    const treasuryAta = getAssociatedTokenAddressSync(
      mint,
      treasury.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    const destinationAta = getAssociatedTokenAddressSync(
      mint,
      destinationOwner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )

    const tx = new Transaction()

    try {
      await getAccount(connection, destinationAta, 'confirmed', TOKEN_PROGRAM_ID)
    } catch {
      tx.add(
        createAssociatedTokenAccountInstruction(
          treasury.publicKey,
          destinationAta,
          destinationOwner,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      )
    }

    tx.add(
      createTransferInstruction(
        treasuryAta,
        destinationAta,
        treasury.publicKey,
        rawAmount,
        [],
        TOKEN_PROGRAM_ID,
      ),
    )

    const txSignature = await sendAndConfirmTransaction(connection, tx, [treasury], {
      commitment: 'confirmed',
    })

    const { data: finishData, error: finishError } = await admin.rpc(
      'finish_season_claim',
      {
        p_wallet: wallet,
        p_season_id: seasonId,
        p_tx_signature: txSignature,
        p_success: true,
        p_error: null,
      },
    )

    if (finishError) {
      return jsonResponse(
        {
          success: true,
          warning: 'Transfer sent but DB update failed — contact syndicate ops.',
          tx_signature: txSignature,
          finish_error: finishError.message,
        },
        200,
      )
    }

    return jsonResponse({
      success: true,
      tx_signature: txSignature,
      amount_yami: amountYami,
      destination_pubkey: destination,
      status: (finishData as Record<string, unknown>)?.status ?? 'claimed',
    })
  } catch (err) {
    const messageText =
      err instanceof Error ? err.message : 'SPL transfer failed.'

    await admin.rpc('finish_season_claim', {
      p_wallet: wallet,
      p_season_id: seasonId,
      p_tx_signature: null,
      p_success: false,
      p_error: messageText,
    })

    return jsonResponse(
      {
        success: false,
        code: 'TRANSFER_FAILED',
        message: messageText,
      },
      500,
    )
  }
})
