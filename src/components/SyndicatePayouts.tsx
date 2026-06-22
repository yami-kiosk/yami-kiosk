import { useEffect, useState } from 'react'
import { useLeaderboard } from '../hooks/useLeaderboard'
import {
  formatSeasonCountdown,
  formatSeasonYen,
} from '../lib/leaderboard'
import {
  PAYOUT_WIRE_MC_THRESHOLD_USD,
  SEASON_MIN_PHASE,
  SEASON_POOL_YAMI,
  formatMcThreshold,
  getCurrentSeasonId,
  getSeasonTimeRemainingMs,
} from '../store/seasonConfig'
import { useGameStore } from '../store/useGameStore'

interface SyndicatePayoutsProps {
  onOpenLeaderboard?: () => void
}

export function SyndicatePayouts({ onOpenLeaderboard }: SyndicatePayoutsProps) {
  const phase = useGameStore((s) => s.phase)
  const seasonYenEarned = useGameStore((s) => s.seasonYenEarned)
  const walletPublicKey = useGameStore((s) => s.walletPublicKey)
  const operatorName = useGameStore((s) => s.operatorName)
  const activeSeasonId = useGameStore((s) => s.activeSeasonId)

  const [countdown, setCountdown] = useState(() =>
    formatSeasonCountdown(getSeasonTimeRemainingMs()),
  )

  const seasonId = getCurrentSeasonId()
  const { localRank, payoutYami, localYenEarned, loading, source } =
    useLeaderboard(seasonId, {
      seasonYenEarned,
      phase,
      walletPublicKey,
      operatorName,
    })

  const qualified = phase >= SEASON_MIN_PHASE
  const displayYen = source === 'live' ? localYenEarned : seasonYenEarned

  useEffect(() => {
    const tick = () => {
      setCountdown(formatSeasonCountdown(getSeasonTimeRemainingMs()))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeSeasonId])

  return (
    <div className="game-glass-light terminal-panel w-full border border-cyber-cyan/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[8px] text-terminal-green">
          {'>'} POOL // S{seasonId}
          {source === 'live' ? ' · LIVE' : ' · OFFLINE'}
        </p>
        <p className="font-mono text-[8px] text-neon-pink">T-{countdown}</p>
      </div>

      <div className="mt-1 grid grid-cols-4 gap-1 font-mono text-[8px] md:grid-cols-2 md:gap-1.5 md:text-[9px]">
        <div className="border border-cyber-cyan/15 p-1 md:p-1.5">
          <span className="text-cyber-cyan/50">QUAL</span>
          <p
            className={`mt-0.5 font-bold leading-tight ${
              qualified ? 'text-terminal-green' : 'text-cyber-cyan/40'
            }`}
          >
            {qualified ? `P${phase}+` : `P${SEASON_MIN_PHASE}`}
          </p>
        </div>
        <div className="border border-cyber-cyan/15 p-1 md:p-1.5">
          <span className="text-cyber-cyan/50">EARNED</span>
          <p className="mt-0.5 text-neon-pink leading-tight">
            {formatSeasonYen(displayYen)}
          </p>
        </div>
        <div className="border border-cyber-cyan/15 p-1 md:p-1.5">
          <span className="text-cyber-cyan/50">RANK</span>
          <p className="mt-0.5 text-cyber-cyan">
            {loading ? '…' : localRank ? `#${localRank}` : '—'}
          </p>
        </div>
        <div className="border border-cyber-cyan/15 p-1 md:p-1.5">
          <span className="text-cyber-cyan/50">EST. PAY</span>
          <p
            className={`mt-0.5 leading-tight ${
              payoutYami > 0 ? 'text-terminal-green' : 'text-cyber-cyan/40'
            }`}
          >
            {loading ? '…' : payoutYami > 0 ? payoutYami.toLocaleString() : '—'}
          </p>
        </div>
      </div>

      {onOpenLeaderboard ? (
        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="terminal-btn glow-hover-cyan mt-1.5 w-full border border-cyber-cyan/40 py-1 font-mono text-[8px] text-cyber-cyan md:text-[9px]"
        >
          [ LEADERBOARD ]
        </button>
      ) : null}

      <p className="mt-1 font-mono text-[7px] leading-snug text-cyber-cyan/35 md:text-[8px]">
        {SEASON_POOL_YAMI.toLocaleString()} $YAMI pool · wire @ MC{' '}
        {formatMcThreshold(PAYOUT_WIRE_MC_THRESHOLD_USD)}+
      </p>
    </div>
  )
}
