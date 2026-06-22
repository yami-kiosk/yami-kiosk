import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  CREDIT_TO_YAMI_RATIO,
  HIJACK_COST_YAMI,
  HIJACK_PASSIVE_BONUS,
  HIJACK_SUCCESS_RATE,
  calculateRaidSuccessRate,
  getEffectiveRaidEntryFee,
  getEffectiveTraceFeeRate,
  getRaidCooldownRemaining,
  getRaidSuccessRateCap,
  rollRaidRewards,
  type HijackResult,
  type LaunderResult,
  type RaidResult,
} from './economyConfig'
import {
  GRID_POWER_MAX,
  PHASES,
  STORAGE_KEY,
  getGridCollapseYenDrainPerTick,
  type GamePhase,
  type PhaseDefinition,
} from './gameConfig'
import {
  pickSkillLevels,
  recalculateRates,
} from './rateCalculator'
import {
  SKILL_MAX_LEVEL,
  getSkillLevel,
  getSkillUpgradeCost,
  getSkillEffectLabel,
  type SkillPathId,
} from './skillConfig'
import {
  getInjectComboMultiplier,
  getLaunderOutputMultiplier,
  getMilestoneLabel,
  getRaidLootWinMultiplier,
  hasSkillMilestone,
  INJECT_COMBO_MAX,
  INJECT_COMBO_WINDOW_MS,
  OVERCLOCK_DURATION_MS,
  OVERCLOCK_INTERVAL_MS,
  type MilestoneTier,
} from './skillMilestones'
import {
  applyDoctrineActiveMultiplier,
  applyDoctrineLaunderMultiplier,
  applyDoctrinePassiveMultiplier,
  applyDoctrineRaidLootMultiplier,
  applyDoctrineRaidOddsBonus,
  applyDoctrineTraceFeeMultiplier,
  canChooseDoctrine,
  DOCTRINE_UNLOCK_TOTAL_LEVELS,
  getDoctrineLabel,
  getTotalSkillLevels,
  type SyndicateDoctrineId,
} from './syndicateDoctrine'
import {
  calculateGhostBonusYen,
  calculateGhostBreachOdds,
  GHOST_LOOT_MULTIPLIER,
  GHOST_RAID_MIN_NETWORK_LEVEL,
  type GhostTarget,
} from '../lib/ghostRaid'

import {
  getBurnerSecretKeyBase58,
  loadOrCreateBurnerKeypair,
} from './walletUtils'
import { getCurrentSeasonId, LEADERBOARD_TOP_N } from './seasonConfig'
import {
  buildSeasonEndModal,
  computeSeasonPayout,
  shouldRollSeason,
  type SeasonEndModalData,
  type SeasonSyncResult,
} from './seasonSettlement'
import {
  ensureOperatorSyncedToRemote,
  getRegisteredNameForWallet,
  registerOperatorAccount,
  resolveRegisteredNameForWallet,
  type RegisterOperatorResult,
} from '../lib/operatorRegistry'
import { fetchOperatorHandle, fetchOperatorPayoutRemote } from '../lib/supabase/api'
import { isSupabaseConfigured } from '../lib/supabase/client'
import { registerSeasonEntitlement } from '../lib/claim/claimService'
import { isClaimEnabled } from '../lib/claim/config'
import { canAffordYen, roundYen } from '../lib/yen'
import {
  evaluateInjectAttempt,
  type InjectVerdict,
} from '../lib/antiCheat/injectGuard'
import { clampSeasonIncomeGrant } from '../lib/antiCheat/incomeCap'

let syncSeasonInFlight: Promise<SeasonSyncResult> | null = null
let walletInitStarted = false

export interface InjectPowerResult {
  grantedYen: number
  verdict: InjectVerdict
  message: string | null
  shouldWarn: boolean
}

export interface SkillUpgradeResult {
  success: boolean
  message: string
  pathId?: SkillPathId
  newLevel?: number
  effectLabel?: string
  milestoneUnlocked?: string
}

export interface OfflineProgressResult {
  yenGained: number
  dirtyCreditsGained: number
  ticksSimulated: number
  wipedDuringOffline: boolean
  finalGridPower: number
}

interface GameState {
  yen: number
  dirtyCredits: number
  yamiBalance: number
  gridPower: number
  phase: GamePhase
  lastSavedTime: number
  isGameOver: boolean
  totalClicks: number
  isHydrated: boolean

  walletPublicKey: string | null
  isWalletReady: boolean

  operatorName: string
  payoutPubkey: string | null

  hardwareLevel: number
  softwareLevel: number
  networkLevel: number
  stealthLevel: number
  distributionLevel: number
  hijackScriptOwned: boolean
  hijackPassiveBonus: number

  hasBypassedMainframe: boolean
  totalRaidsAttempted: number
  totalRaidsWon: number
  lastRaidAt: number
  totalHijacksAttempted: number

  overclockBoostUntil: number
  overclockNextAt: number
  injectComboCount: number
  injectComboLastAt: number
  raidFailInsuranceUsed: boolean
  bulkLaunderBonusUsed: boolean

  syndicateDoctrine: SyndicateDoctrineId | null
  ghostTarget: GhostTarget | null
  totalGhostRaidsWon: number

  activeSeasonId: number
  seasonYenEarned: number
  /** Anchor for local income cap (mirrors server sync window). */
  incomeCapBaselineAt: number
  incomeCapBaselineSeason: number
  lastSeasonPayoutYami: number
  pendingSeasonEndModal: SeasonEndModalData | null

  passiveRatePerMin: number
  activeRatePerMin: number
  gridDrainPerTick: number
  powerRestoreOnClick: number
  dirtyCreditsPerMin: number

  getCurrentPhaseDefinition: () => PhaseDefinition
  getTraceFeeRate: () => number
  syncRatesFromPhase: () => void
  initWallet: () => void
  registerOperatorName: (name: string) => Promise<RegisterOperatorResult>
  syncOperatorFromRegistry: () => Promise<void>
  setPayoutPubkey: (pubkey: string | null) => void
  getBurnerSecretKey: () => string | null
  tick: () => void
  injectPower: () => InjectPowerResult
  calculateOfflineProgress: (now?: number) => OfflineProgressResult
  applyOfflineProgress: (now?: number) => OfflineProgressResult
  tryUpgradePhase: () => boolean
  upgradeSkill: (pathId: SkillPathId) => SkillUpgradeResult
  launderCreditsToYami: (creditAmount: number) => LaunderResult
  raidDataNode: () => RaidResult
  raidGhostNode: () => RaidResult
  chooseSyndicateDoctrine: (doctrine: SyndicateDoctrineId) => {
    success: boolean
    message: string
  }
  setGhostTarget: (target: GhostTarget | null) => void
  hijackScript: () => HijackResult
  triggerSystemWipe: () => void
  resetGame: () => void
  syncSeason: (now?: number) => Promise<SeasonSyncResult>
  dismissSeasonEndModal: () => void
  setHydrated: (value: boolean) => void
}

const INITIAL_PHASE: GamePhase = 1

function clampGridPower(value: number): number {
  return Math.max(0, Math.min(GRID_POWER_MAX, value))
}

function capIncomeGrant(
  state: Pick<
    GameState,
    | 'phase'
    | 'seasonYenEarned'
    | 'incomeCapBaselineAt'
    | 'incomeCapBaselineSeason'
  >,
  amount: number,
  now: number,
): number {
  return clampSeasonIncomeGrant(
    {
      phase: state.phase,
      seasonYenEarned: state.seasonYenEarned,
      incomeCapBaselineAt: state.incomeCapBaselineAt,
      incomeCapBaselineSeason: state.incomeCapBaselineSeason,
    },
    amount,
    now,
  )
}

function getCollapseDrain(
  phase: GamePhase,
  passiveRatePerMin: number,
  stealthLevel: number,
): number {
  let drain = getGridCollapseYenDrainPerTick(phase, passiveRatePerMin)
  if (hasSkillMilestone(stealthLevel, 6)) drain *= 0.5
  return drain
}

function getGrindResetState(hijackPassiveBonus = 0) {
  const rates = getPhaseRates(INITIAL_PHASE, hijackPassiveBonus)
  return {
    yen: 0,
    dirtyCredits: 0,
    gridPower: GRID_POWER_MAX,
    phase: INITIAL_PHASE,
    isGameOver: false,
    totalClicks: 0,
    hardwareLevel: 0,
    softwareLevel: 0,
    networkLevel: 0,
    stealthLevel: 0,
    distributionLevel: 0,
    hijackScriptOwned: false,
    hijackPassiveBonus: 0,
    hasBypassedMainframe: false,
    totalRaidsAttempted: 0,
    totalRaidsWon: 0,
    lastRaidAt: 0,
    totalHijacksAttempted: 0,
    overclockBoostUntil: 0,
    overclockNextAt: 0,
    injectComboCount: 0,
    injectComboLastAt: 0,
    raidFailInsuranceUsed: false,
    bulkLaunderBonusUsed: false,
    syndicateDoctrine: null,
    ghostTarget: null,
    totalGhostRaidsWon: 0,
    seasonYenEarned: 0,
    incomeCapBaselineAt: Date.now(),
    incomeCapBaselineSeason: 0,
    lastSavedTime: Date.now(),
    ...rates,
    dirtyCreditsPerMin: 0,
  }
}

function getPhaseRates(phase: GamePhase, hijackPassiveBonus: number) {
  return recalculateRates({
    phase,
    hardwareLevel: 0,
    softwareLevel: 0,
    networkLevel: 0,
    stealthLevel: 0,
    distributionLevel: 0,
    hijackPassiveBonus,
  })
}

const initialRates = getPhaseRates(INITIAL_PHASE, 0)

/** Prevents double-submit / rapid-fire raid exploits within one tick. */
let raidMutex = false

function resolveStandardBreachOdds(
  phase: GamePhase,
  networkLevel: number,
  doctrine: SyndicateDoctrineId | null,
): number {
  const base = calculateRaidSuccessRate(phase, networkLevel)
  const cap = getRaidSuccessRateCap(networkLevel)
  return Math.max(
    0.08,
    Math.min(cap, base + applyDoctrineRaidOddsBonus(doctrine)),
  )
}

function resolveRaidLootMultiplier(
  networkLevel: number,
  doctrine: SyndicateDoctrineId | null,
  ghost = false,
): number {
  let mult =
    getRaidLootWinMultiplier(networkLevel) *
    applyDoctrineRaidLootMultiplier(doctrine)
  if (ghost) mult *= GHOST_LOOT_MULTIPLIER
  return mult
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      yen: 0,
      dirtyCredits: 0,
      yamiBalance: 0,
      gridPower: GRID_POWER_MAX,
      phase: INITIAL_PHASE,
      lastSavedTime: Date.now(),
      isGameOver: false,
      totalClicks: 0,
      isHydrated: false,

      walletPublicKey: null,
      isWalletReady: false,
      operatorName: '',
      payoutPubkey: null,

      hardwareLevel: 0,
      softwareLevel: 0,
      networkLevel: 0,
      stealthLevel: 0,
      distributionLevel: 0,
      hijackScriptOwned: false,
      hijackPassiveBonus: 0,

      hasBypassedMainframe: false,
      totalRaidsAttempted: 0,
      totalRaidsWon: 0,
      lastRaidAt: 0,
      totalHijacksAttempted: 0,
      overclockBoostUntil: 0,
      overclockNextAt: 0,
      injectComboCount: 0,
      injectComboLastAt: 0,
      raidFailInsuranceUsed: false,
      bulkLaunderBonusUsed: false,
      syndicateDoctrine: null,
      ghostTarget: null,
      totalGhostRaidsWon: 0,

      activeSeasonId: getCurrentSeasonId(),
      seasonYenEarned: 0,
      incomeCapBaselineAt: Date.now(),
      incomeCapBaselineSeason: 0,
      lastSeasonPayoutYami: 0,
      pendingSeasonEndModal: null,

      ...initialRates,
      dirtyCreditsPerMin: 0,

      getCurrentPhaseDefinition: () => PHASES[get().phase],

      getTraceFeeRate: () =>
        getEffectiveTraceFeeRate(get().yamiBalance, get().stealthLevel),

      syncRatesFromPhase: () => {
        const state = get()
        set(recalculateRates(pickSkillLevels(state)))
      },

      initWallet: () => {
        if (get().isWalletReady) {
          void get().syncOperatorFromRegistry()
          return
        }
        if (walletInitStarted) return
        walletInitStarted = true

        const keypair = loadOrCreateBurnerKeypair()
        const walletPublicKey = keypair.publicKey.toBase58()
        const registeredName = getRegisteredNameForWallet(walletPublicKey)

        set({
          walletPublicKey,
          isWalletReady: true,
          operatorName: registeredName ?? get().operatorName,
        })

        void get().syncOperatorFromRegistry()
      },

      registerOperatorName: async (name: string) => {
        const state = get()
        if (!state.walletPublicKey) {
          return {
            success: false,
            code: 'INVALID',
            message: 'Burner node not ready.',
          } as RegisterOperatorResult
        }

        const result = await registerOperatorAccount(name, state.walletPublicKey)
        if (result.success) {
          set({ operatorName: result.name })
        }
        return result
      },

      syncOperatorFromRegistry: async () => {
        const state = get()
        if (!state.walletPublicKey) return

        if (isSupabaseConfigured()) {
          const sync = await ensureOperatorSyncedToRemote(state.walletPublicKey)
          if (sync?.success) {
            set({ operatorName: sync.name })
          } else {
            const remote = await fetchOperatorHandle(state.walletPublicKey)
            if (remote) {
              set({ operatorName: remote })
            }
          }
        } else {
          const registeredName = await resolveRegisteredNameForWallet(
            state.walletPublicKey,
          )
          if (registeredName) {
            set({ operatorName: registeredName })
          }
        }

        const payout = await fetchOperatorPayoutRemote(state.walletPublicKey)
        if (payout?.success) {
          set({ payoutPubkey: payout.payoutPubkey ?? null })
        }
      },

      setPayoutPubkey: (pubkey) => set({ payoutPubkey: pubkey }),

      getBurnerSecretKey: () => getBurnerSecretKeyBase58(),

      tick: () => {
        const state = get()
        const now = Date.now()

        let overclockBoostUntil = state.overclockBoostUntil
        let overclockNextAt = state.overclockNextAt

        if (hasSkillMilestone(state.hardwareLevel, 10)) {
          if (overclockNextAt === 0) {
            overclockNextAt = now + OVERCLOCK_INTERVAL_MS
          }
          if (now >= overclockNextAt && overclockBoostUntil <= now) {
            overclockBoostUntil = now + OVERCLOCK_DURATION_MS
            overclockNextAt = now + OVERCLOCK_INTERVAL_MS
          }
        }

        const overclockActive =
          hasSkillMilestone(state.hardwareLevel, 10) &&
          overclockBoostUntil > now
        const rates = recalculateRates(pickSkillLevels(state), {
          overclockActive,
        })
        const passivePerTick = applyDoctrinePassiveMultiplier(
          state.syndicateDoctrine,
          rates.passiveRatePerMin / 60,
        )
        const dirtyPerTick = rates.dirtyCreditsPerMin / 60
        const collapseDrain = getCollapseDrain(
          state.phase,
          state.passiveRatePerMin,
          state.stealthLevel,
        )

        const overclockPatch = {
          overclockBoostUntil,
          overclockNextAt,
        }

        if (state.gridPower <= 0) {
          set({
            ...overclockPatch,
            gridPower: 0,
            yen: roundYen(Math.max(0, state.yen - collapseDrain)),
            lastSavedTime: now,
          })
          return
        }

        let nextPower = state.gridPower - state.gridDrainPerTick
        if (hasSkillMilestone(state.hardwareLevel, 6) && nextPower > 0) {
          nextPower = clampGridPower(nextPower + GRID_POWER_MAX * 0.01)
        }

        if (nextPower <= 0) {
          set({
            ...overclockPatch,
            gridPower: 0,
            yen: roundYen(Math.max(0, state.yen - collapseDrain)),
            lastSavedTime: now,
          })
          return
        }

        const passiveGrant = capIncomeGrant(state, passivePerTick, now)
        set({
          ...overclockPatch,
          yen: roundYen(state.yen + passiveGrant),
          dirtyCredits: state.dirtyCredits + dirtyPerTick,
          seasonYenEarned: state.seasonYenEarned + passiveGrant,
          gridPower: clampGridPower(nextPower),
          lastSavedTime: now,
        })
      },

      injectPower: () => {
        const state = get()
        const now = Date.now()
        const guard = evaluateInjectAttempt(now)

        if (guard.verdict === 'too_fast') {
          return {
            grantedYen: 0,
            verdict: guard.verdict,
            message: guard.message,
            shouldWarn: guard.shouldWarn,
          }
        }

        let combo = state.injectComboCount
        if (guard.allowCombo && hasSkillMilestone(state.softwareLevel, 3)) {
          if (now - state.injectComboLastAt <= INJECT_COMBO_WINDOW_MS) {
            combo = Math.min(INJECT_COMBO_MAX, combo + 1)
          } else {
            combo = 1
          }
        } else if (guard.verdict === 'ok' || guard.verdict === 'rate_cap') {
          combo = 0
        }

        const comboMult = guard.allowCombo
          ? getInjectComboMultiplier(state.softwareLevel, combo)
          : 1
        const basePerClick = applyDoctrineActiveMultiplier(
          state.syndicateDoctrine,
          (state.activeRatePerMin / 60) * comboMult,
        )
        const activePerClick = roundYen(
          capIncomeGrant(state, basePerClick * guard.rewardMultiplier, now),
        )
        const nextPower = clampGridPower(
          state.gridPower + state.powerRestoreOnClick,
        )

        set({
          yen: roundYen(state.yen + activePerClick),
          seasonYenEarned: state.seasonYenEarned + activePerClick,
          gridPower: nextPower,
          totalClicks: state.totalClicks + 1,
          injectComboCount: combo,
          injectComboLastAt: guard.allowCombo ? now : state.injectComboLastAt,
          lastSavedTime: now,
        })

        return {
          grantedYen: activePerClick,
          verdict: guard.verdict,
          message: guard.message,
          shouldWarn: guard.shouldWarn,
        }
      },

      calculateOfflineProgress: (now = Date.now()) => {
        const state = get()
        const elapsedMs = Math.max(0, now - state.lastSavedTime)
        const totalTicks = Math.floor(elapsedMs / 1_000)

        if (totalTicks === 0) {
          return {
            yenGained: 0,
            dirtyCreditsGained: 0,
            ticksSimulated: 0,
            wipedDuringOffline: false,
            finalGridPower: state.gridPower,
          }
        }

        const passivePerTick = state.passiveRatePerMin / 60
        const dirtyPerTick = state.dirtyCreditsPerMin / 60
        const drainPerTick = state.gridDrainPerTick
        const collapseDrain = getCollapseDrain(
          state.phase,
          state.passiveRatePerMin,
          state.stealthLevel,
        )

        let simulatedPower = state.gridPower
        let yenDelta = 0
        let dirtyCreditsGained = 0
        let ticksSimulated = 0
        let gridCollapsedDuringOffline = state.gridPower <= 0

        for (let i = 0; i < totalTicks; i++) {
          ticksSimulated++

          if (simulatedPower <= 0) {
            gridCollapsedDuringOffline = true
            yenDelta -= collapseDrain
            continue
          }

          simulatedPower -= drainPerTick

          if (simulatedPower <= 0) {
            simulatedPower = 0
            gridCollapsedDuringOffline = true
            yenDelta -= collapseDrain
            continue
          }

          yenDelta += passivePerTick
          dirtyCreditsGained += dirtyPerTick
        }

        return {
          yenGained: yenDelta,
          dirtyCreditsGained,
          ticksSimulated,
          wipedDuringOffline: gridCollapsedDuringOffline,
          finalGridPower: clampGridPower(simulatedPower),
        }
      },

      applyOfflineProgress: (now = Date.now()) => {
        const state = get()
        const result = get().calculateOfflineProgress(now)

        if (result.ticksSimulated > 0) {
          const rawGain = Math.max(0, result.yenGained)
          const yenGain = capIncomeGrant(state, rawGain, now)
          set({
            yen: roundYen(Math.max(0, state.yen + yenGain)),
            dirtyCredits: state.dirtyCredits + result.dirtyCreditsGained,
            seasonYenEarned: state.seasonYenEarned + yenGain,
            gridPower: result.finalGridPower,
            lastSavedTime: now,
          })
        }

        return result
      },

      tryUpgradePhase: () => {
        const state = get()
        const current = PHASES[state.phase]
        const nextPhase = (state.phase + 1) as GamePhase

        if (nextPhase > 6 || !canAffordYen(state.yen, current.upgradeCost)) {
          return false
        }

        const reachedMainframe = nextPhase === 6
        const nextState = {
          ...state,
          phase: nextPhase,
          yen: roundYen(state.yen - current.upgradeCost),
        }

        set({
          ...nextState,
          ...recalculateRates(pickSkillLevels({ ...nextState, phase: nextPhase })),
          hasBypassedMainframe: reachedMainframe ? true : state.hasBypassedMainframe,
          lastSavedTime: Date.now(),
        })
        return true
      },

      upgradeSkill: (pathId: SkillPathId) => {
        const state = get()
        const currentLevel = getSkillLevel(pickSkillLevels(state), pathId)

        if (currentLevel >= SKILL_MAX_LEVEL) {
          return { success: false, message: 'Skill sudah MAX LEVEL.' }
        }

        const cost = getSkillUpgradeCost(currentLevel, state.phase)
        if (!canAffordYen(state.yen, cost)) {
          return {
            success: false,
            message: `Butuh ${cost.toLocaleString()} $YEN.`,
          }
        }

        const levelKey = `${pathId}Level` as
          | 'hardwareLevel'
          | 'softwareLevel'
          | 'networkLevel'
          | 'stealthLevel'
          | 'distributionLevel'

        const nextState = {
          ...state,
          yen: roundYen(state.yen - cost),
          [levelKey]: currentLevel + 1,
        }

        set({
          yen: nextState.yen,
          [levelKey]: currentLevel + 1,
          ...recalculateRates(pickSkillLevels(nextState)),
          lastSavedTime: Date.now(),
        })

        const newLevel = currentLevel + 1
        const milestoneTier = ([3, 6, 10] as MilestoneTier[]).find(
          (tier) => tier === newLevel,
        )
        const milestoneUnlocked = milestoneTier
          ? getMilestoneLabel(pathId, milestoneTier)
          : undefined

        return {
          success: true,
          message: milestoneUnlocked
            ? `${pathId.toUpperCase()} → Lv${newLevel} // MILESTONE UNLOCKED`
            : `${pathId.toUpperCase()} → Lv${newLevel}`,
          pathId,
          newLevel,
          effectLabel: getSkillEffectLabel(pathId),
          milestoneUnlocked,
        }
      },

      launderCreditsToYami: (creditAmount: number) => {
        const state = get()

        if (creditAmount <= 0) {
          return { success: false, message: 'Invalid credit amount.' }
        }

        if (state.dirtyCredits < creditAmount) {
          return {
            success: false,
            message: 'Insufficient dirty credits in stash.',
          }
        }

        const useBulkBonus =
          hasSkillMilestone(state.distributionLevel, 10) &&
          !state.bulkLaunderBonusUsed

        const traceFee = useBulkBonus
          ? 0
          : applyDoctrineTraceFeeMultiplier(
              state.syndicateDoctrine,
              getEffectiveTraceFeeRate(state.yamiBalance, state.stealthLevel),
            )
        const outputMult = applyDoctrineLaunderMultiplier(
          state.syndicateDoctrine,
          getLaunderOutputMultiplier(state.distributionLevel),
        )
        const grossYami = creditAmount * CREDIT_TO_YAMI_RATIO * outputMult
        const yamiReceived = grossYami * (1 - traceFee)

        set({
          dirtyCredits: state.dirtyCredits - creditAmount,
          yamiBalance: state.yamiBalance + yamiReceived,
          bulkLaunderBonusUsed: useBulkBonus
            ? true
            : state.bulkLaunderBonusUsed,
          lastSavedTime: Date.now(),
        })

        return {
          success: true,
          message: useBulkBonus
            ? `WHOLESALE DEAL — laundered ${creditAmount.toFixed(0)} credits → ${yamiReceived.toFixed(2)} $YAMI (0% trace)`
            : `Laundered ${creditAmount.toFixed(0)} credits → ${yamiReceived.toFixed(2)} $YAMI`,
          yamiReceived,
          traceFeePercent: traceFee * 100,
          creditsSpent: creditAmount,
        }
      },

      raidDataNode: () => {
        if (raidMutex) {
          return {
            success: false,
            message: 'Raid uplink busy — wait for current breach attempt.',
          }
        }

        raidMutex = true
        let result: RaidResult = {
          success: false,
          message: 'Raid failed.',
        }

        try {
          set((state) => {
            const now = Date.now()
            const cooldownRemaining = getRaidCooldownRemaining(
              state.lastRaidAt,
              state.softwareLevel,
              now,
            )

            if (cooldownRemaining > 0) {
              result = {
                success: false,
                message: `ICE SWEEP ACTIVE — retry in ${Math.ceil(cooldownRemaining / 1000)}s.`,
              }
              return state
            }

            const raidFee = getEffectiveRaidEntryFee(state.networkLevel)

            if (state.yamiBalance < raidFee) {
              result = {
                success: false,
                message: `Need ${raidFee} $YAMI entry fee.`,
              }
              return state
            }

            const successRate = resolveStandardBreachOdds(
              state.phase,
              state.networkLevel,
              state.syndicateDoctrine,
            )
            const won = Math.random() < successRate
            const lootMult = resolveRaidLootMultiplier(
              state.networkLevel,
              state.syndicateDoctrine,
            )

            if (won) {
              const rewards = rollRaidRewards(
                state.phase,
                state.softwareLevel,
                lootMult,
              )
              const cappedYen = capIncomeGrant(state, rewards.yen, now)
              result = {
                success: true,
                message: `NODE BREACHED — extracted ${rewards.dirtyCredits} credits + ${cappedYen.toLocaleString()} $YEN`,
                dirtyCreditsGained: rewards.dirtyCredits,
                yenGained: cappedYen,
              }
              return {
                ...state,
                yamiBalance: state.yamiBalance - raidFee,
                dirtyCredits: state.dirtyCredits + rewards.dirtyCredits,
                yen: roundYen(state.yen + cappedYen),
                seasonYenEarned: state.seasonYenEarned + cappedYen,
                totalRaidsAttempted: state.totalRaidsAttempted + 1,
                totalRaidsWon: state.totalRaidsWon + 1,
                lastRaidAt: now,
                lastSavedTime: now,
              }
            }

            const hasInsurance =
              hasSkillMilestone(state.stealthLevel, 10) &&
              !state.raidFailInsuranceUsed

            if (hasInsurance) {
              result = {
                success: false,
                message:
                  'TRACED BY ICE — ICE Immunity absorbed the entry fee.',
                yamiLost: 0,
              }
              return {
                ...state,
                totalRaidsAttempted: state.totalRaidsAttempted + 1,
                raidFailInsuranceUsed: true,
                lastRaidAt: now,
                lastSavedTime: now,
              }
            }

            result = {
              success: false,
              message: 'TRACED BY MEGACORP ICE — entry fee confiscated.',
              yamiLost: raidFee,
            }
            return {
              ...state,
              yamiBalance: state.yamiBalance - raidFee,
              totalRaidsAttempted: state.totalRaidsAttempted + 1,
              lastRaidAt: now,
              lastSavedTime: now,
            }
          })
        } finally {
          raidMutex = false
        }

        return result
      },

      raidGhostNode: () => {
        if (raidMutex) {
          return {
            success: false,
            message: 'Raid uplink busy — wait for current breach attempt.',
          }
        }

        const preState = get()
        if (preState.networkLevel < GHOST_RAID_MIN_NETWORK_LEVEL) {
          return {
            success: false,
            message: `Shadow Node requires Network Lv${GHOST_RAID_MIN_NETWORK_LEVEL}.`,
          }
        }

        if (!preState.ghostTarget) {
          return {
            success: false,
            message: 'Scan a ghost node from the leaderboard first.',
          }
        }

        raidMutex = true
        let result: RaidResult = {
          success: false,
          message: 'Ghost raid failed.',
        }

        const ghost = preState.ghostTarget

        try {
          set((state) => {
            const now = Date.now()
            const cooldownRemaining = getRaidCooldownRemaining(
              state.lastRaidAt,
              state.softwareLevel,
              now,
            )

            if (cooldownRemaining > 0) {
              result = {
                success: false,
                message: `ICE SWEEP ACTIVE — retry in ${Math.ceil(cooldownRemaining / 1000)}s.`,
              }
              return state
            }

            const raidFee = getEffectiveRaidEntryFee(state.networkLevel)
            if (state.yamiBalance < raidFee) {
              result = {
                success: false,
                message: `Need ${raidFee} $YAMI entry fee.`,
              }
              return state
            }

            const successRate = calculateGhostBreachOdds(
              state.phase,
              state.networkLevel,
              ghost,
              state.syndicateDoctrine,
            )
            const won = Math.random() < successRate
            const lootMult = resolveRaidLootMultiplier(
              state.networkLevel,
              state.syndicateDoctrine,
              true,
            )

            if (won) {
              const rewards = rollRaidRewards(
                state.phase,
                state.softwareLevel,
                lootMult,
              )
              const ghostBonus = calculateGhostBonusYen(ghost)
              const cappedYen = capIncomeGrant(
                state,
                rewards.yen + ghostBonus,
                now,
              )
              result = {
                success: true,
                message: `GHOST BREACHED @${ghost.handle} — +${cappedYen.toLocaleString()} $YEN`,
                dirtyCreditsGained: rewards.dirtyCredits,
                yenGained: cappedYen,
                isGhostRaid: true,
                ghostHandle: ghost.handle,
              }
              return {
                ...state,
                yamiBalance: state.yamiBalance - raidFee,
                dirtyCredits: state.dirtyCredits + rewards.dirtyCredits,
                yen: roundYen(state.yen + cappedYen),
                seasonYenEarned: state.seasonYenEarned + cappedYen,
                totalRaidsAttempted: state.totalRaidsAttempted + 1,
                totalRaidsWon: state.totalRaidsWon + 1,
                totalGhostRaidsWon: state.totalGhostRaidsWon + 1,
                ghostTarget: null,
                lastRaidAt: now,
                lastSavedTime: now,
              }
            }

            const hasInsurance =
              hasSkillMilestone(state.stealthLevel, 10) &&
              !state.raidFailInsuranceUsed

            if (hasInsurance) {
              result = {
                success: false,
                message: `GHOST TRACE @${ghost.handle} — ICE Immunity absorbed fee.`,
                yamiLost: 0,
                isGhostRaid: true,
                ghostHandle: ghost.handle,
              }
              return {
                ...state,
                totalRaidsAttempted: state.totalRaidsAttempted + 1,
                raidFailInsuranceUsed: true,
                ghostTarget: null,
                lastRaidAt: now,
                lastSavedTime: now,
              }
            }

            result = {
              success: false,
              message: `GHOST TRACE @${ghost.handle} — entry fee confiscated.`,
              yamiLost: raidFee,
              isGhostRaid: true,
              ghostHandle: ghost.handle,
            }
            return {
              ...state,
              yamiBalance: state.yamiBalance - raidFee,
              totalRaidsAttempted: state.totalRaidsAttempted + 1,
              ghostTarget: null,
              lastRaidAt: now,
              lastSavedTime: now,
            }
          })
        } finally {
          raidMutex = false
        }

        return result
      },

      chooseSyndicateDoctrine: (doctrine: SyndicateDoctrineId) => {
        const state = get()

        if (state.syndicateDoctrine) {
          return {
            success: false,
            message: 'Syndicate doctrine already locked for this cycle.',
          }
        }

        const total = getTotalSkillLevels(state)
        if (!canChooseDoctrine(total)) {
          return {
            success: false,
            message: `Need ${DOCTRINE_UNLOCK_TOTAL_LEVELS} total skill levels across all paths.`,
          }
        }

        set({
          syndicateDoctrine: doctrine,
          lastSavedTime: Date.now(),
        })

        return {
          success: true,
          message: `${getDoctrineLabel(doctrine)} doctrine locked for this cycle.`,
        }
      },

      setGhostTarget: (target: GhostTarget | null) => {
        set({ ghostTarget: target, lastSavedTime: Date.now() })
      },

      hijackScript: () => {
        const state = get()

        if (state.hijackScriptOwned) {
          return {
            success: false,
            message: 'Auto-injector script already installed.',
          }
        }

        if (state.yamiBalance < HIJACK_COST_YAMI) {
          return {
            success: false,
            message: `Need ${HIJACK_COST_YAMI} $YAMI to bribe the fixer.`,
          }
        }

        const won = Math.random() < HIJACK_SUCCESS_RATE

        if (won) {
          const bonus = HIJACK_PASSIVE_BONUS
          const nextState = {
            ...state,
            yamiBalance: state.yamiBalance - HIJACK_COST_YAMI,
            hijackScriptOwned: true,
            hijackPassiveBonus: bonus,
            totalHijacksAttempted: state.totalHijacksAttempted + 1,
          }
          set({
            ...nextState,
            ...recalculateRates(pickSkillLevels(nextState)),
            lastSavedTime: Date.now(),
          })
          return {
            success: true,
            message: `SCRIPT HIJACKED — +${bonus} $YEN/min passive boost installed.`,
            yamiSpent: HIJACK_COST_YAMI,
          }
        }

        set({
          yamiBalance: state.yamiBalance - HIJACK_COST_YAMI,
          totalHijacksAttempted: state.totalHijacksAttempted + 1,
          lastSavedTime: Date.now(),
        })
        return {
          success: false,
          message: 'FIXER DOUBLE-CROSSED YOU — bribe lost.',
          yamiSpent: HIJACK_COST_YAMI,
        }
      },

      triggerSystemWipe: () => {
        set({
          gridPower: 0,
          lastSavedTime: Date.now(),
        })
      },

      resetGame: () => {
        set({
          ...getGrindResetState(),
          yamiBalance: 0,
          activeSeasonId: getCurrentSeasonId(),
          lastSeasonPayoutYami: 0,
          pendingSeasonEndModal: null,
        })
      },

      syncSeason: async (now = Date.now()) => {
        if (syncSeasonInFlight) return syncSeasonInFlight

        syncSeasonInFlight = (async (): Promise<SeasonSyncResult> => {
          const state = get()
          if (!shouldRollSeason(state.activeSeasonId, now)) {
            return { rolledOver: false, modal: null }
          }

          const endedSeasonId = state.activeSeasonId
          const { payoutYami, qualified, rank, seasonYenEarned } =
            await computeSeasonPayout({
              phase: state.phase,
              seasonYenEarned: state.seasonYenEarned,
              walletPublicKey: state.walletPublicKey,
              operatorName: state.operatorName,
              seasonId: endedSeasonId,
              now,
            })

          const after = get()
          if (
            after.activeSeasonId !== endedSeasonId ||
            !shouldRollSeason(endedSeasonId, now)
          ) {
            return { rolledOver: false, modal: null }
          }

          const modal = buildSeasonEndModal(
            endedSeasonId,
            payoutYami,
            qualified,
            seasonYenEarned,
            rank,
            state.walletPublicKey,
          )

          let entitlementError: string | null = null

          if (
            state.walletPublicKey &&
            state.operatorName &&
            payoutYami > 0 &&
            qualified &&
            rank &&
            rank <= LEADERBOARD_TOP_N
          ) {
            const entitlement = await registerSeasonEntitlement(
              state.walletPublicKey,
              endedSeasonId,
            )
            if (!entitlement.success) {
              entitlementError =
                entitlement.message ?? 'Failed to register season payout.'
            }
          }

          const creditInGame = payoutYami > 0 && !isClaimEnabled()

          set({
            ...getGrindResetState(),
            yamiBalance: state.yamiBalance + (creditInGame ? payoutYami : 0),
            activeSeasonId: getCurrentSeasonId(now),
            lastSeasonPayoutYami: payoutYami,
            pendingSeasonEndModal: modal,
            walletPublicKey: state.walletPublicKey,
            isWalletReady: state.isWalletReady,
          })

          return { rolledOver: true, modal, entitlementError }
        })()

        try {
          return await syncSeasonInFlight
        } finally {
          syncSeasonInFlight = null
        }
      },

      dismissSeasonEndModal: () => set({ pendingSeasonEndModal: null }),

      setHydrated: (value: boolean) => set({ isHydrated: value }),
    }),
    {
      name: STORAGE_KEY,
      version: 10,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (
          typeof state.yamBalance === 'number' &&
          state.yamiBalance === undefined
        ) {
          state.yamiBalance = state.yamBalance
          delete state.yamBalance
        }
        if (version < 2) {
          state.isGameOver = false
        }
        if (version < 3) {
          state.activeSeasonId = getCurrentSeasonId()
          state.lastSeasonPayoutYami = 0
          state.pendingSeasonEndModal = null
        }
        if (version < 4) {
          state.seasonYenEarned = 0
        }
        if (version < 5) {
          state.operatorName = ''
        }
        if (version < 6) {
          state.overclockBoostUntil = 0
          state.overclockNextAt = 0
          state.injectComboCount = 0
          state.injectComboLastAt = 0
          state.raidFailInsuranceUsed = false
          state.bulkLaunderBonusUsed = false
          if (state.lastRaidAt === undefined) state.lastRaidAt = 0
        }
        if (version < 7) {
          state.syndicateDoctrine = null
          state.ghostTarget = null
          state.totalGhostRaidsWon = 0
        }
        if (version < 8) {
          state.payoutPubkey = null
        }
        if (version < 9) {
          state.pendingSeasonEndModal = null
        }
        if (version < 10) {
          const season =
            typeof state.seasonYenEarned === 'number' ? state.seasonYenEarned : 0
          const saved =
            typeof state.lastSavedTime === 'number'
              ? state.lastSavedTime
              : Date.now()
          state.incomeCapBaselineAt = saved
          state.incomeCapBaselineSeason = season
        }
        return state as typeof persisted
      },
      partialize: (state) => ({
        yen: state.yen,
        dirtyCredits: state.dirtyCredits,
        yamiBalance: state.yamiBalance,
        gridPower: state.gridPower,
        phase: state.phase,
        lastSavedTime: state.lastSavedTime,
        isGameOver: state.isGameOver,
        totalClicks: state.totalClicks,
        hardwareLevel: state.hardwareLevel,
        softwareLevel: state.softwareLevel,
        networkLevel: state.networkLevel,
        stealthLevel: state.stealthLevel,
        distributionLevel: state.distributionLevel,
        hijackScriptOwned: state.hijackScriptOwned,
        hijackPassiveBonus: state.hijackPassiveBonus,
        hasBypassedMainframe: state.hasBypassedMainframe,
        totalRaidsAttempted: state.totalRaidsAttempted,
        totalRaidsWon: state.totalRaidsWon,
        lastRaidAt: state.lastRaidAt,
        totalHijacksAttempted: state.totalHijacksAttempted,
        overclockBoostUntil: state.overclockBoostUntil,
        overclockNextAt: state.overclockNextAt,
        injectComboCount: state.injectComboCount,
        injectComboLastAt: state.injectComboLastAt,
        raidFailInsuranceUsed: state.raidFailInsuranceUsed,
        bulkLaunderBonusUsed: state.bulkLaunderBonusUsed,
        syndicateDoctrine: state.syndicateDoctrine,
        ghostTarget: state.ghostTarget,
        totalGhostRaidsWon: state.totalGhostRaidsWon,
        activeSeasonId: state.activeSeasonId,
        seasonYenEarned: state.seasonYenEarned,
        incomeCapBaselineAt: state.incomeCapBaselineAt,
        incomeCapBaselineSeason: state.incomeCapBaselineSeason,
        lastSeasonPayoutYami: state.lastSeasonPayoutYami,
        operatorName: state.operatorName,
        payoutPubkey: state.payoutPubkey,
        passiveRatePerMin: state.passiveRatePerMin,
        activeRatePerMin: state.activeRatePerMin,
        gridDrainPerTick: state.gridDrainPerTick,
        powerRestoreOnClick: state.powerRestoreOnClick,
        dirtyCreditsPerMin: state.dirtyCreditsPerMin,
      }),
      onRehydrateStorage: () => (state) => {
        state?.syncRatesFromPhase()
        void state?.syncOperatorFromRegistry()
        state?.setHydrated(true)
      },
    },
  ),
)
