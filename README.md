# YAMI KIOSK ヤミキオスク

Cyberpunk idle clicker on Solana — grind $YEN, launder to $YAMI, compete on the syndicate leaderboard.

## Stack

- **Frontend:** React 19 + Vite + Zustand + Tailwind
- **Backend:** Supabase (operators, leaderboard, anti-cheat, season claims)
- **Wallet:** Burner keypair (local) — no Phantom connect required
- **Claims:** Supabase Edge Function `claim-reward` (SPL from treasury)

## Quick start

```bash
npm install
cp .env.example .env.local
# Fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY from Supabase Dashboard → Settings → API
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Supabase setup

1. Run migrations in order (SQL Editor or `npm run supabase:push`):
   - `supabase/migrations/20260622120000_yami_backend.sql`
   - `supabase/migrations/20260622130000_economy_rate_caps.sql`
   - `supabase/migrations/20260622140000_server_active_income_cap.sql`
   - `supabase/migrations/20260622150000_cheat_suspects_view.sql`
   - `supabase/migrations/20260622160000_payout_address.sql`
   - `supabase/migrations/20260622170000_season_claims.sql`
   - `supabase/migrations/20260622180000_security_balance.sql`
   - `supabase/migrations/20260622190000_relax_anticheat.sql`
   - `supabase/migrations/20260622200000_balance_autoclick_server.sql`

2. Deploy edge function `syndicate-write` (required for register/sync/payout writes):
   ```bash
   supabase functions deploy syndicate-write
   ```

3. Verify: `npm run supabase:check`

## Token launch (on-chain claim)

When $YAMI is live on pump.fun:

**Frontend** (`.env.local` + hosting env):

```env
VITE_YAMI_MINT=YourMintAddress
VITE_CLAIM_ENABLED=true
```

**Supabase secrets** (never commit):

```bash
npx supabase secrets set TREASURY_SECRET_KEY=base58_treasury_private_key
npx supabase secrets set YAMI_MINT=SameMintAsAbove
npx supabase secrets set SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
npx supabase secrets set YAMI_TOKEN_DECIMALS=6
npx supabase functions deploy syndicate-write
npx supabase functions deploy claim-reward
```

Update social links in `src/constants/contracts.ts`.

## Deploy (Vercel)

1. Push this repo to GitHub (already: `yami-kiosk/yami-kiosk`).
2. [vercel.com/new](https://vercel.com/new) → **Import** the private repo.
   - Framework: **Vite** (auto-detected via `vercel.json`)
   - Build: `npm run build` · Output: `dist`
3. **Environment Variables** (Production + Preview):

   | Name | Value |
   |------|--------|
   | `VITE_SUPABASE_URL` | `https://qetpaadmjgyscdzfojwz.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | anon key from Supabase → Settings → API |

   After token launch, also add `VITE_YAMI_MINT` and `VITE_CLAIM_ENABLED=true`.

4. **Deploy** → copy the `.vercel.app` URL.

CLI (optional):

```bash
npx vercel login
npx vercel link
npx vercel env add VITE_SUPABASE_URL
npx vercel env add VITE_SUPABASE_ANON_KEY
npx vercel --prod
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run supabase:check` | Test Supabase RPC + migrations |

## License

Private — all rights reserved.
