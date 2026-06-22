import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useLeaderboard } from '../hooks/useLeaderboard'
import {
  calculateGhostBreachOdds,
  calculateGhostBonusYen,
  formatGhostOddsLabel,
  GHOST_RAID_MIN_NETWORK_LEVEL,
  pickGhostTarget,
} from '../lib/ghostRaid'
import { getOperatorDisplayName } from '../lib/operatorName'
import {
  HIJACK_COST_YAMI,
  HIJACK_PASSIVE_BONUS,
  HIJACK_SUCCESS_RATE,
  getEffectiveRaidCooldownMs,
  getEffectiveRaidEntryFee,
  getEffectiveTraceFeeRate,
  calculateRaidSuccessRate,
  getRaidCooldownRemaining,
  getRaidSuccessRateCap,
} from '../store/economyConfig'
import { getRaidPreviewLines, getLaunderOutputMultiplier } from '../store/skillMilestones'
import {
  applyDoctrineLaunderMultiplier,
  applyDoctrineRaidOddsBonus,
  applyDoctrineTraceFeeMultiplier,
} from '../store/syndicateDoctrine'
import { getCurrentSeasonId } from '../store/seasonConfig'
import { useGameStore } from '../store/useGameStore'

function formatNum(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(value < 10 ? 2 : 0)
}

export function DarkWebPanel() {
  const [launderAmount, setLaunderAmount] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const dirtyCredits = useGameStore((s) => s.dirtyCredits)
  const yamiBalance = useGameStore((s) => s.yamiBalance)
  const phase = useGameStore((s) => s.phase)
  const softwareLevel = useGameStore((s) => s.softwareLevel)
  const networkLevel = useGameStore((s) => s.networkLevel)
  const stealthLevel = useGameStore((s) => s.stealthLevel)
  const distributionLevel = useGameStore((s) => s.distributionLevel)
  const bulkLaunderBonusUsed = useGameStore((s) => s.bulkLaunderBonusUsed)
  const raidFailInsuranceUsed = useGameStore((s) => s.raidFailInsuranceUsed)
  const hijackScriptOwned = useGameStore((s) => s.hijackScriptOwned)
  const dirtyCreditsPerMin = useGameStore((s) => s.dirtyCreditsPerMin)
  const lastRaidAt = useGameStore((s) => s.lastRaidAt)
  const totalRaidsAttempted = useGameStore((s) => s.totalRaidsAttempted)
  const totalRaidsWon = useGameStore((s) => s.totalRaidsWon)
  const totalGhostRaidsWon = useGameStore((s) => s.totalGhostRaidsWon)
  const syndicateDoctrine = useGameStore((s) => s.syndicateDoctrine)
  const ghostTarget = useGameStore((s) => s.ghostTarget)
  const operatorName = useGameStore((s) => s.operatorName)
  const seasonYenEarned = useGameStore((s) => s.seasonYenEarned)
  const walletPublicKey = useGameStore((s) => s.walletPublicKey)
  const activeSeasonId = useGameStore((s) => s.activeSeasonId)
  const launderCreditsToYami = useGameStore((s) => s.launderCreditsToYami)
  const raidDataNode = useGameStore((s) => s.raidDataNode)
  const raidGhostNode = useGameStore((s) => s.raidGhostNode)
  const setGhostTarget = useGameStore((s) => s.setGhostTarget)
  const hijackScript = useGameStore((s) => s.hijackScript)

  const seasonId = activeSeasonId || getCurrentSeasonId()
  const { entries, localRank, loading: leaderboardLoading } = useLeaderboard(
    seasonId,
    {
      seasonYenEarned,
      phase,
      walletPublicKey,
      operatorName,
    },
  )

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const traceFeeRate = applyDoctrineTraceFeeMultiplier(
    syndicateDoctrine,
    getEffectiveTraceFeeRate(yamiBalance, stealthLevel),
  )
  const traceFeePercent = traceFeeRate * 100
  const receivePercent = 100 - traceFeePercent
  const baseRaidRate = calculateRaidSuccessRate(phase, networkLevel)
  const cap = getRaidSuccessRateCap(networkLevel)
  const raidSuccessRate = Math.max(
    0.08,
    Math.min(cap, baseRaidRate + applyDoctrineRaidOddsBonus(syndicateDoctrine)),
  )
  const raidEntryFee = getEffectiveRaidEntryFee(networkLevel)
  const raidCooldownMs = getEffectiveRaidCooldownMs(softwareLevel)
  const raidCooldownRemaining = getRaidCooldownRemaining(
    lastRaidAt,
    softwareLevel,
    now,
  )
  const raidOnCooldown = raidCooldownRemaining > 0
  const raidLootPreview = getRaidPreviewLines(phase, softwareLevel)
  const parsedLaunder = Number(launderAmount)
  const launderOutputMult = applyDoctrineLaunderMultiplier(
    syndicateDoctrine,
    getLaunderOutputMultiplier(distributionLevel),
  )
  const previewYami =
    parsedLaunder > 0
      ? parsedLaunder * launderOutputMult * (receivePercent / 100)
      : 0

  const raidWinRateLabel =
    totalRaidsAttempted > 0
      ? `${Math.round((totalRaidsWon / totalRaidsAttempted) * 100)}% (${totalRaidsWon}/${totalRaidsAttempted})`
      : '—'

  const handleLaunder = () => {
    const amount = Number(launderAmount)
    const result = launderCreditsToYami(amount)
    if (result.success) {
      toast.success(result.message, { className: 'yami-toast' })
      setLaunderAmount('')
    } else {
      toast.error(result.message, { className: 'yami-toast' })
    }
  }

  const handleLaunderAll = () => {
    const result = launderCreditsToYami(Math.floor(dirtyCredits))
    if (result.success) {
      toast.success(result.message, { className: 'yami-toast' })
      setLaunderAmount('')
    } else {
      toast.error(result.message, { className: 'yami-toast' })
    }
  }

  const handleRaid = () => {
    const result = raidDataNode()
    if (result.success) {
      toast.success(result.message, { className: 'yami-toast' })
    } else {
      toast.error(result.message, { className: 'yami-toast' })
    }
  }

  const handleScanGhost = () => {
    const picked = pickGhostTarget(
      entries,
      getOperatorDisplayName(operatorName),
    )
    if (!picked) {
      toast.error('No ghost nodes on the wire — try again later.', {
        className: 'yami-toast',
      })
      return
    }
    setGhostTarget({ ...picked, localRankAtScan: localRank })
    toast.success(`Ghost locked: @${picked.handle} (#${picked.rank})`, {
      className: 'yami-toast',
    })
  }

  const handleGhostRaid = () => {
    const result = raidGhostNode()
    if (result.success) {
      toast.success(result.message, { className: 'yami-toast' })
    } else {
      toast.error(result.message, { className: 'yami-toast' })
    }
  }

  const ghostOdds =
    ghostTarget !== null
      ? calculateGhostBreachOdds(
          phase,
          networkLevel,
          ghostTarget,
          syndicateDoctrine,
        )
      : null
  const ghostBonusYen =
    ghostTarget !== null ? calculateGhostBonusYen(ghostTarget) : null

  const handleHijack = () => {
    const result = hijackScript()
    if (result.success) {
      toast.success(result.message, { className: 'yami-toast' })
    } else {
      toast.error(result.message, { className: 'yami-toast' })
    }
  }

  if (phase < 2) {
    return (
      <div className="space-y-3">
        <p className="font-mono text-[10px] text-cyber-cyan/50">
          // DARK WEB EXPLOITS — LOCKED
        </p>
        <div className="border border-lobster-red/30 bg-lobster-red/5 p-4 font-mono text-xs text-cyber-cyan/50">
          <p className="text-lobster-red font-bold">[ ACCESS DENIED ]</p>
          <p className="mt-2">
            Reach Phase 2 — Black Market Fixer to unlock data laundering, node
            raids, and script hijacking.
          </p>
          <p className="mt-2 text-[10px] text-terminal-green">
            Current: Phase {phase} // Required: Phase 2+
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px] text-terminal-green">
        {'>'} DARK WEB EXPLOITS // HIGH RISK ZONE
      </p>

      <div className="terminal-panel border border-cyber-cyan/20 p-3 font-mono text-[10px]">
        <div className="flex justify-between text-cyber-cyan/60">
          <span>DIRTY CREDITS</span>
          <span className="text-terminal-green">{formatNum(dirtyCredits)}</span>
        </div>
        <div className="mt-1 flex justify-between text-cyber-cyan/60">
          <span>$YAMI BALANCE</span>
          <span className="text-cyber-cyan">{formatNum(yamiBalance)}</span>
        </div>
        <div className="mt-1 flex justify-between text-cyber-cyan/60">
          <span>CREDIT DRIP</span>
          <span>{dirtyCreditsPerMin.toFixed(1)}/min</span>
        </div>
      </div>

      {/* Data Laundering */}
      <section className="terminal-panel border border-cyber-cyan/20 p-3">
        <p className="font-vt323 text-base text-cyber-cyan">DATA LAUNDERING</p>
        <p className="mt-1 font-mono text-[10px] text-cyber-cyan/50">
          Convert dirty credits → $YAMI via burner wallet
        </p>

        <div className="mt-3 border border-terminal-green/30 bg-terminal-green/5 p-2">
          <p className="font-mono text-[10px] text-terminal-green">
            MEGACORP TRACE FEE:{' '}
            <span className="text-lobster-red font-bold">
              {traceFeePercent.toFixed(0)}%
            </span>
          </p>
          <p className="font-mono text-[10px] text-cyber-cyan/60">
            YOU RECEIVE: {receivePercent.toFixed(0)}%
            {stealthLevel >= 3 && ' // VPN Mesh active'}
          </p>
          {distributionLevel >= 10 && !bulkLaunderBonusUsed && (
            <p className="mt-1 font-mono text-[9px] text-terminal-green">
              ★ Wholesale Deal available — 1 zero-fee launder this cycle
            </p>
          )}
          {distributionLevel >= 3 && (
            <p className="mt-1 font-mono text-[9px] text-cyber-cyan/40">
              Bulk Wash +10% output active
            </p>
          )}
          <p className="mt-1 font-mono text-[9px] text-cyber-cyan/40">
            Hold more $YAMI to reduce trace fee (10% min at 10,001+)
          </p>
        </div>

        <input
          type="number"
          min={0}
          value={launderAmount}
          onChange={(e) => setLaunderAmount(e.target.value)}
          placeholder="Credits to launder"
          className="mt-3 w-full border border-cyber-cyan/30 bg-black px-2 py-2 font-mono text-xs text-cyber-cyan outline-none focus:border-cyber-cyan"
        />
        {parsedLaunder > 0 && (
          <p className="mt-1 font-mono text-[10px] text-cyber-cyan/50">
            Est. output: ~{previewYami.toFixed(2)} $YAMI
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleLaunder}
            disabled={!parsedLaunder || parsedLaunder > dirtyCredits}
            className="risk-btn flex-1 py-2 font-mono text-[10px]"
          >
            LAUNDER
          </button>
          <button
            type="button"
            onClick={handleLaunderAll}
            disabled={dirtyCredits <= 0}
            className="risk-btn flex-1 py-2 font-mono text-[10px]"
          >
            LAUNDER ALL
          </button>
        </div>
      </section>

      {/* Node Raid */}
      <section className="terminal-panel border border-cyber-cyan/20 p-3">
        <p className="font-vt323 text-base text-cyber-cyan">NODE RAID</p>
        <p className="mt-1 font-mono text-[10px] text-cyber-cyan/50">
          Breach corp data nodes for massive extraction
        </p>
        <p className="mt-2 font-mono text-[10px] text-terminal-green">
          Entry: {raidEntryFee} $YAMI // Breach odds:{' '}
          {(raidSuccessRate * 100).toFixed(0)}% // Cooldown:{' '}
          {raidCooldownMs / 1000}s
        </p>
        <p className="font-mono text-[9px] text-cyber-cyan/40">
          Network Lv{networkLevel} sets breach odds · Software Lv{softwareLevel}{' '}
          boosts loot on success
        </p>
        {raidLootPreview && (
          <p className="font-mono text-[9px] text-terminal-green/80">
            NODE SCANNER — loot range: {raidLootPreview.minYen.toLocaleString()}–
            {raidLootPreview.maxYen.toLocaleString()} $YEN ·{' '}
            {raidLootPreview.minCredits}–{raidLootPreview.maxCredits} credits
          </p>
        )}
        {stealthLevel >= 10 && !raidFailInsuranceUsed && (
          <p className="font-mono text-[9px] text-terminal-green/80">
            ★ ICE Immunity — 1 free raid fail remaining this cycle
          </p>
        )}
        <p className="font-mono text-[9px] text-cyber-cyan/40">
          Your record: {raidWinRateLabel}
        </p>
        <button
          type="button"
          onClick={handleRaid}
          disabled={yamiBalance < raidEntryFee || raidOnCooldown}
          className="risk-btn mt-3 w-full py-2 font-mono text-xs"
        >
          {raidOnCooldown
            ? `ICE SWEEP — ${Math.ceil(raidCooldownRemaining / 1000)}s`
            : `RAID DATA NODE [-${raidEntryFee} $YAMI]`}
        </button>
      </section>

      {/* Ghost Raid */}
      {networkLevel >= GHOST_RAID_MIN_NETWORK_LEVEL && (
        <section className="terminal-panel border border-neon-pink/30 bg-neon-pink/5 p-3">
          <p className="font-vt323 text-base text-neon-pink">GHOST RAID</p>
          <p className="mt-1 font-mono text-[10px] text-cyber-cyan/50">
            Async PvP — breach a leaderboard operator&apos;s node
          </p>
          {ghostTarget ? (
            <>
              <p className="mt-2 font-mono text-[10px] text-terminal-green">
                TARGET: @{ghostTarget.handle} // RANK #{ghostTarget.rank}
              </p>
              {ghostOdds !== null && (
                <p className="font-mono text-[9px] text-cyber-cyan/70">
                  Breach odds: {(ghostOdds * 100).toFixed(0)}% //{' '}
                  {formatGhostOddsLabel(ghostTarget)}
                </p>
              )}
              {ghostBonusYen !== null && (
                <p className="font-mono text-[9px] text-terminal-green/80">
                  Ghost bonus: +{ghostBonusYen.toLocaleString()} $YEN on win ·
                  +20% loot
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleScanGhost}
                  disabled={leaderboardLoading}
                  className="risk-btn flex-1 py-2 font-mono text-[10px]"
                >
                  RE-SCAN
                </button>
                <button
                  type="button"
                  onClick={handleGhostRaid}
                  disabled={
                    yamiBalance < raidEntryFee || raidOnCooldown
                  }
                  className="risk-btn flex-1 py-2 font-mono text-[10px]"
                >
                  {raidOnCooldown
                    ? `COOLDOWN ${Math.ceil(raidCooldownRemaining / 1000)}s`
                    : `GHOST RAID [-${raidEntryFee} $YAMI]`}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 font-mono text-[9px] text-cyber-cyan/40">
                Scan the syndicate wire for a ghost target. Shares raid cooldown
                & entry fee.
              </p>
              {totalGhostRaidsWon > 0 && (
                <p className="font-mono text-[9px] text-terminal-green/70">
                  Ghost wins this cycle: {totalGhostRaidsWon}
                </p>
              )}
              <button
                type="button"
                onClick={handleScanGhost}
                disabled={leaderboardLoading}
                className="risk-btn mt-3 w-full py-2 font-mono text-xs"
              >
                {leaderboardLoading ? 'SCANNING WIRE…' : 'SCAN GHOST NODE'}
              </button>
            </>
          )}
        </section>
      )}

      {/* Script Hijack */}
      <section className="terminal-panel border border-cyber-cyan/20 p-3">
        <p className="font-vt323 text-base text-cyber-cyan">SCRIPT HIJACK</p>
        <p className="mt-1 font-mono text-[10px] text-cyber-cyan/50">
          Bribe a fixer for a tier-3 auto-injector script
        </p>
        <p className="mt-2 font-mono text-[10px] text-terminal-green">
          Cost: {HIJACK_COST_YAMI} $YAMI // Success:{' '}
          {(HIJACK_SUCCESS_RATE * 100).toFixed(0)}%
        </p>
        {hijackScriptOwned ? (
          <p className="mt-2 font-mono text-[10px] text-terminal-green animate-pulse">
            ✓ SCRIPT INSTALLED — +{HIJACK_PASSIVE_BONUS} $YEN/min
          </p>
        ) : (
          <button
            type="button"
            onClick={handleHijack}
            disabled={yamiBalance < HIJACK_COST_YAMI}
            className="risk-btn mt-3 w-full py-2 font-mono text-xs"
          >
            HIJACK SCRIPT [-{HIJACK_COST_YAMI} $YAMI]
          </button>
        )}
      </section>
    </div>
  )
}
