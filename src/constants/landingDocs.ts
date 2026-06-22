import { PHASES, SKILL_PATHS } from '../store/gameConfig'
import {
  HIJACK_COST_YAMI,
  HIJACK_PASSIVE_BONUS,
  HIJACK_SUCCESS_RATE,
  RAID_ENTRY_FEE_YAMI,
} from '../store/economyConfig'
import {
  SKILL_COST_BASE,
  SKILL_COST_MULTIPLIER,
  SKILL_MAX_LEVEL,
} from '../store/skillConfig'
import {
  DEV_WALLET_SUPPLY_SHARE,
  LEADERBOARD_TOP_N,
  PAYOUT_WIRE_MC_THRESHOLD_USD,
  SEASON_DURATION_MS,
  SEASON_MIN_PHASE,
  SEASON_POOL_YAMI,
  YAMI_TOTAL_SUPPLY,
  formatMcThreshold,
} from '../store/seasonConfig'

export type LandingDocId = 'gameplay' | 'wiki' | 'faq'

export interface LandingDocSection {
  heading: string
  lines: string[]
}

export interface LandingDoc {
  id: LandingDocId
  title: string
  subtitle: string
  sections: LandingDocSection[]
}

const phaseLines = Object.values(PHASES).map(
  (p) =>
    `P${p.id} ${p.name} (${p.nameJa}) — ${p.offlineRatePerMin}/min offline · ${p.activeRatePerMin}/min active · upgrade ${p.upgradeCost === Infinity ? 'MAX' : p.upgradeCost.toLocaleString()} $YEN · drain ${p.gridDrainPerTick}%/s — ${p.description}`,
)

const skillLines = SKILL_PATHS.map((path) => `${path.label}: ${path.range}`)

export const LANDING_DOCS: Record<LandingDocId, LandingDoc> = {
  gameplay: {
    id: 'gameplay',
    title: 'GAMEPLAY',
    subtitle: '// PLAY-TO-EARN IDLE LOOP // ヤミキオスク',
    sections: [
      {
        heading: 'THE SETUP',
        lines: [
          'Survive the claustrophobic Japanese Cyberpunk underworld by running an illegal, hacked vending machine.',
          'Start as a desperate Alley Operator. Climb through 6 phases until you become a Neon God — a major black market syndicate supplier.',
          'No wallet pop-ups. A silent burner wallet is generated on entry and saved to your browser.',
        ],
      },
      {
        heading: 'CORE LOOP (1 TICK / SEC)',
        lines: [
          'Black Market $YEN — mined data generated passively every second and on active clicks.',
          'INJECT POWER [BYPASS] — central action button. Generates $YEN and restores Grid Power per click.',
          'Grid Power — hijacked electricity. Drains every tick. At 0% the node stops earning and bleeds $YEN until you inject power.',
          'Offline Progress — $YEN accrues while away, but only if Grid Power would not have hit 0% during downtime.',
        ],
      },
      {
        heading: 'PLAY-TO-EARN ECONOMY',
        lines: [
          'Dirty Credits — stolen corporate funds. Separate from $YEN. Passively generated from Phase 1 based on phase + skill upgrades.',
          'Data Laundering — convert Dirty Credits → $YAMI on the Dark Web tab. Trace Fee depends on your $YAMI hold (Hold Multiplier).',
          'Node Raid — spend $YAMI entry fee. ~90s cooldown. Loot tied to phase passive rate (~4.5 min worth).',
          `Script Hijack — spend ${HIJACK_COST_YAMI} $YAMI. ${Math.round(HIJACK_SUCCESS_RATE * 100)}% success. Win = permanent +${HIJACK_PASSIVE_BONUS} $YEN/min passive.`,
          `Season Pool — 3-day cycles. Top $YEN earners (Phase 2+) split ${SEASON_POOL_YAMI.toLocaleString()} $YAMI from dev wallet.`,
        ],
      },
      {
        heading: 'PROGRESSION',
        lines: [
          'Advance phases by hitting upgrade cost thresholds in the Phases tab.',
          'Skill Tree (5 paths) and Dark Web unlock from Phase 1 — upgrade early to accelerate the grind.',
          ...skillLines,
        ],
      },
    ],
  },

  wiki: {
    id: 'wiki',
    title: 'WIKI',
    subtitle: '// CLASSIFIED DOSSIER // YAMI KIOSK v0.1',
    sections: [
      {
        heading: 'CURRENCIES',
        lines: [
          '$YEN — in-game mined data. Primary idle currency for phase upgrades.',
          'Dirty Credits (CR) — virtual stolen corp funds. Laundered into $YAMI.',
          '$YAMI — on-chain token (Solana). Simulated in burner wallet. Used for raids, hijacks, and season qualification weight.',
        ],
      },
      {
        heading: 'PHASES (6)',
        lines: phaseLines,
      },
      {
        heading: 'SKILL TREE',
        lines: [
          `Max level per path: ${SKILL_MAX_LEVEL}. Costs scale exponentially (${SKILL_COST_BASE} × ${SKILL_COST_MULTIPLIER}^level $YEN).`,
          'Skill Tree — 5 paths, max Lv10. Milestones at Lv3 / Lv6 / Lv10. Syndicate Doctrine unlocks at 15 total skill levels.',
          'Hardware — +passive $YEN/min, +credits/min. Milestones: Overdrive, Capacitor, Overclock.',
          'Software — +active $YEN/min, +raid loot accuracy. Milestones: Combo Inject, Node Scanner, Breach Script.',
          'Network — +breach odds. Milestones: Ghost Route (−10% fee), Deep Cover, Shadow Node (+25% loot).',
          'Stealth — reduced grid drain, improved power restore. Milestones: VPN Mesh, Bleed Shield, ICE Immunity.',
          'Distribution — +passive $YEN/min, +credits/min. Milestones: Bulk Wash, Credit Pipeline, Wholesale Deal.',
          ...skillLines,
        ],
      },
      {
        heading: 'DARK WEB — TRACE FEE (HOLD MULTIPLIER)',
        lines: [
          'Laundering applies a Trace Fee based on current $YAMI balance:',
          '0 $YAMI → 80% fee (receive 20%)',
          '1 – 1,000 $YAMI → 50% fee (receive 50%)',
          '1,001 – 10,000 $YAMI → 25% fee (receive 75%)',
          '10,001+ $YAMI → 10% fee (receive 90%) — WHALE STEALTH tier',
          'Hold $YAMI to reduce trace exposure when laundering credits.',
        ],
      },
      {
        heading: 'RAID & HIJACK',
        lines: [
          `Raid entry fee: ${RAID_ENTRY_FEE_YAMI} $YAMI (Network Lv3+: −10%). Cooldown 90s (Software Lv10: 78s).`,
          'Raid loot ≈ 4.5 min of phase-base passive $YEN — not a primary income faucet.',
          'Breach odds scale with phase + Network level (cap ~54% with Deep Cover milestone).',
          'Software Lv3+ unlocks Node Scanner loot preview. Network Lv10 unlocks Ghost Raid vs leaderboard operators.',
          'Syndicate Doctrine (15 total skill Lv) — pick Extractor, Operator, or Fixer for cycle-long bonuses & tradeoffs.',
          'Rewards on success: random $YEN + Dirty Credits scaled to phase.',
          `Hijack cost: ${HIJACK_COST_YAMI} $YAMI. One-time script unlock on success (+${HIJACK_PASSIVE_BONUS} $YEN/min permanent).`,
        ],
      },
      {
        heading: 'BURNER WALLET',
        lines: [
          'Auto-generated Solana Keypair on first kiosk entry.',
          'Secret key stored in localStorage (yami_sk). Export via [ BACKUP ] in-game header.',
          'No Phantom / Solflare required for core gameplay.',
          'Game save (yami-kiosk-save) persists separately from wallet key.',
        ],
      },
      {
        heading: 'SEASON POOL & LEADERBOARD',
        lines: [
          `Pool cycles every ${SEASON_DURATION_MS / (24 * 60 * 60 * 1000)} days. Countdown: T- in pool panel.`,
          `Total supply: ${YAMI_TOTAL_SUPPLY.toLocaleString()} $YAMI. Dev wallet: ${DEV_WALLET_SUPPLY_SHARE * 100}% (${Math.round(YAMI_TOTAL_SUPPLY * DEV_WALLET_SUPPLY_SHARE).toLocaleString()} tokens).`,
          `Pool: ${SEASON_POOL_YAMI.toLocaleString()} $YAMI per cycle from dev reward vault.`,
          `On-chain wire from dev wallet unlocks when MC ≥ ${formatMcThreshold(PAYOUT_WIRE_MC_THRESHOLD_USD)}. Below threshold: rewards accrue in-game only.`,
          `Qualification: Phase ${SEASON_MIN_PHASE}+ (Black Market Fixer).`,
          'Ranking metric: total $YEN earned this cycle (passive + active + raid loot). Spending on upgrades does not reduce earned score.',
          `Top ${LEADERBOARD_TOP_N} nodes paid each cycle: 30% / 20% / 15% / 10% / 8% / 6% / 4% / 3% / 2% / 2%.`,
          '[ LEADERBOARD ] button in header & pool panel — live rank + payout preview.',
          'At cycle end: grind resets ($YEN, phase, skills). $YAMI + burner wallet persist. Payout credited if ranked top 10.',
        ],
      },
    ],
  },

  faq: {
    id: 'faq',
    title: 'FAQ',
    subtitle: '// FREQUENTLY ASKED // TERMINAL SUPPORT',
    sections: [
      {
        heading: 'WHAT IS YAMI KIOSK?',
        lines: [
          'A retro-terminal styled idle/incremental Play-to-Earn game on Solana.',
          'Theme: illegal hacked vending node in a Japanese Cyberpunk black market.',
          'Ticker: $YAMI / $YEN.',
        ],
      },
      {
        heading: 'DO I NEED TO CONNECT A WALLET?',
        lines: [
          'No external wallet required.',
          'The game silently creates a burner wallet in your browser on first entry.',
          'Use [ TERMINAL BACKUP ] in-game to export your private key if you want to recover $YAMI later.',
        ],
      },
      {
        heading: 'WHAT IS THE DIFFERENCE BETWEEN $YEN, CREDITS, AND $YAMI?',
        lines: [
          '$YEN — earned by running the vending machine. Used for phase upgrades and skill tree.',
          'Dirty Credits — stolen corp data. Earned passively. Laundered into $YAMI on Dark Web.',
          '$YAMI — the token. Needed for raids/hijacks. Holding more $YAMI lowers laundering trace fees.',
        ],
      },
      {
        heading: 'HOW DO I EARN $YAMI (PLAY-TO-EARN)?',
        lines: [
          '1. Farm Dirty Credits passively while playing.',
          '2. Open Dark Web tab → Launder credits into $YAMI (watch the Trace Fee tier).',
          '3. Win Node Raids for bonus $YEN + credits (costs $YAMI entry).',
          '4. Reach Phase 2+ and climb the $YEN leaderboard before the 3-day timer (T-) ends.',
        ],
      },
      {
        heading: 'WHAT HAPPENS IF GRID POWER HITS 0%?',
        lines: [
          'No more game over / SYSTEM WIPE.',
          'Grid stays at 0% — passive $YEN and credits stop.',
          '$YEN drains every second (2× your passive rate, minimum scales with phase).',
          'Inject power to restore the grid and stop the bleed.',
          'Upgrade Stealth path to slow grid drain.',
        ],
      },
      {
        heading: 'IS MY PROGRESS SAVED?',
        lines: [
          'Yes. Zustand persists game state to localStorage automatically.',
          'Burner wallet key (yami_sk) persists separately.',
          'Clearing browser data removes both — back up your key first.',
        ],
      },
      {
        heading: 'WHEN CAN I USE SKILL TREE & DARK WEB?',
        lines: [
          'Both unlock from Phase 1 (Alley Operator).',
          'Upgrade skills early — waiting for Phase 2 slows progression significantly.',
        ],
      },
      {
        heading: 'IS THIS ON-CHAIN YET?',
        lines: [
          'v0.1.0 — $YAMI balance and economy are simulated in-game.',
          'Burner wallet is a real Solana keypair ready for future on-chain integration.',
          'Contract address on landing page — verify on Dexscreener / Pump.fun.',
        ],
      },
    ],
  },
}
