#!/usr/bin/env node
/**
 * Verify Supabase env + RPC connectivity.
 * Usage: node scripts/check-supabase.mjs
 * Loads .env.local then .env if present (Vite-style).
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile(resolve(root, '.env.local'))
loadEnvFile(resolve(root, '.env'))

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  console.error('   Copy .env.example → .env.local and fill in Project Settings → API')
  process.exit(1)
}

const PLACEHOLDERS = ['YOUR_PROJECT_REF', 'your_anon_key_here']
if (
  PLACEHOLDERS.some((p) => url.includes(p) || key.includes(p))
) {
  console.error('❌ .env.local still has placeholder values')
  console.error('   Replace YOUR_PROJECT_REF and your_anon_key_here with real Supabase credentials')
  process.exit(1)
}

const normalizedUrl = url.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')
if (normalizedUrl !== url) {
  console.warn('⚠ URL should not include /rest/v1/ — using:', normalizedUrl)
}

console.log('✓ Env vars present')
console.log(`  URL: ${url}`)

const res = await fetch(`${normalizedUrl}/rest/v1/rpc/get_leaderboard`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ p_season_id: 1, p_limit: 1 }),
})

if (!res.ok) {
  const text = await res.text()
  console.error(`❌ RPC failed (${res.status})`)
  console.error(text.slice(0, 500))
  if (text.includes('does not exist') || res.status === 404) {
    console.error('\n→ Run migrations in Supabase SQL Editor:')
    console.error('  supabase/migrations/20260622120000_yami_backend.sql')
    console.error('  supabase/migrations/20260622130000_economy_rate_caps.sql')
    console.error('  supabase/migrations/20260622140000_server_active_income_cap.sql')
    console.error('  supabase/migrations/20260622150000_cheat_suspects_view.sql')
    console.error('  supabase/migrations/20260622160000_payout_address.sql')
    console.error('  supabase/migrations/20260622170000_season_claims.sql')
  }
  process.exit(1)
}

const data = await res.json()
console.log('✓ get_leaderboard RPC OK')
console.log(`  Rows returned: ${Array.isArray(data) ? data.length : 0}`)

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
}

const schemaCheck = await fetch(
  `${normalizedUrl}/rest/v1/cycle_scores?select=sync_clamp_count,last_clamped_at&limit=1`,
  { headers },
)

if (!schemaCheck.ok) {
  const text = await schemaCheck.text()
  console.error('\n❌ Anti-cheat migration NOT applied (cycle_scores missing audit columns)')
  console.error(text.slice(0, 300))
  console.error('\n→ Supabase Dashboard → SQL Editor → run ONLY this file:')
  console.error('  supabase/migrations/20260622140000_server_active_income_cap.sql')
  console.error('\n  (CLI push failed if migration 1 already ran — SQL Editor is the fix.)')
  process.exit(1)
}

console.log('✓ Anti-cheat columns OK (sync_clamp_count, last_clamped_at on cycle_scores)')

const rateCheck = await fetch(`${normalizedUrl}/rest/v1/rpc/max_yen_per_minute`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_phase: 3 }),
})

if (rateCheck.ok) {
  const rate = Number(await rateCheck.json())
  const expectedMin = 580
  const expectedMax = 820
  if (rate >= expectedMin && rate <= expectedMax) {
    console.log(`✓ max_yen_per_minute(P3) = ${rate} (balanced server cap — migration 1000 OK)`)
  } else if (rate > 900) {
    console.error(`\n⚠ max_yen_per_minute(P3) = ${rate} — too loose (migration 900). Autoclick can abuse leaderboard.`)
    console.error('\n→ Supabase Dashboard → SQL Editor → run:')
    console.error('  supabase/migrations/20260622200000_balance_autoclick_server.sql')
    process.exit(1)
  } else {
    console.error(`\n⚠ max_yen_per_minute(P3) = ${rate} — expected ~580–820 after migration 1000`)
    console.error('\n→ Supabase Dashboard → SQL Editor → run:')
    console.error('  supabase/migrations/20260622200000_balance_autoclick_server.sql')
    process.exit(1)
  }
} else {
  console.warn('⚠ max_yen_per_minute RPC missing — run migrations 400+1000')
  process.exit(1)
}

const suspectsCheck = await fetch(
  `${normalizedUrl}/rest/v1/rpc/get_cheat_suspects`,
  {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_limit: 5 }),
  },
)

if (suspectsCheck.status === 401 || suspectsCheck.status === 403) {
  console.log('✓ cheat_suspects locked down (admin/service_role only — migration 800 OK)')
} else if (suspectsCheck.ok) {
  console.warn('⚠ cheat_suspects still public — run migration 20260622180000_security_balance.sql')
} else {
  console.warn('⚠ cheat_suspects view missing — run migration 20260622150000')
}

const payoutCheck = await fetch(`${normalizedUrl}/rest/v1/rpc/get_operator_payout`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_wallet: '11111111111111111111111111111111' }),
})

if (payoutCheck.ok) {
  console.log('✓ get_operator_payout RPC OK (payout address migration 600 OK)')
} else {
  console.warn('⚠ payout address RPC missing — run migration 20260622160000')
}

const claimsCheck = await fetch(
  `${normalizedUrl}/rest/v1/rpc/get_claimable_payouts`,
  {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_wallet: '11111111111111111111111111111111' }),
  },
)

if (claimsCheck.ok) {
  console.log('✓ get_claimable_payouts RPC OK (season claims migration 700 OK)')
} else {
  console.warn('⚠ season claims RPC missing — run migration 20260622170000')
}

console.log('\nSyndicate network is ready. Restart dev server if .env.local was just added.')
