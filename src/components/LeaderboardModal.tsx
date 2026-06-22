import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useLeaderboard } from '../hooks/useLeaderboard'
import {
  LEADERBOARD_TOP_N,
  SEASON_POOL_YAMI,
  formatSeasonCountdown,
  formatSeasonYen,
} from '../lib/leaderboard'
import { isSupabaseConfigured } from '../lib/supabase/client'
import {
  PAYOUT_WIRE_MC_THRESHOLD_USD,
  SEASON_MIN_PHASE,
  formatMcThreshold,
  getCurrentSeasonId,
  getSeasonTimeRemainingMs,
} from '../store/seasonConfig'
import { useGameStore } from '../store/useGameStore'

interface LeaderboardModalProps {
  onClose: () => void
}

export function LeaderboardModal({ onClose }: LeaderboardModalProps) {
  const phase = useGameStore((s) => s.phase)
  const seasonYenEarned = useGameStore((s) => s.seasonYenEarned)
  const walletPublicKey = useGameStore((s) => s.walletPublicKey)
  const operatorName = useGameStore((s) => s.operatorName)
  const activeSeasonId = useGameStore((s) => s.activeSeasonId)

  const [countdown, setCountdown] = useState(() =>
    formatSeasonCountdown(getSeasonTimeRemainingMs()),
  )

  const seasonId = getCurrentSeasonId()
  const { entries, localRank, loading, source } = useLeaderboard(seasonId, {
    seasonYenEarned,
    phase,
    walletPublicKey,
    operatorName,
  })

  const qualified = phase >= SEASON_MIN_PHASE

  useEffect(() => {
    const tick = () => {
      setCountdown(formatSeasonCountdown(getSeasonTimeRemainingMs()))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeSeasonId])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm md:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="game-glass terminal-panel flex max-h-[88vh] w-full max-w-md flex-col border border-neon-pink/40"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
      >
        <div className="relative shrink-0 border-b border-cyber-cyan/20 p-3 md:p-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 text-cyber-cyan/50 transition-colors hover:text-neon-pink"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <p className="font-mono text-[9px] text-terminal-green">
            {'>'} SYNDICATE LEADERBOARD // S{seasonId}
            {source === 'live' ? ' · LIVE' : ' · OFFLINE'}
          </p>
          <h2
            id="leaderboard-title"
            className="mt-1 font-vt323 text-2xl tracking-wider text-neon-pink md:text-3xl"
          >
            TOP $YEN EARNERS
          </h2>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[8px] text-cyber-cyan/60 md:text-[9px]">
            <span>POOL {SEASON_POOL_YAMI.toLocaleString()} $YAMI</span>
            <span className="text-neon-pink">T-{countdown}</span>
            <span>REQ P{SEASON_MIN_PHASE}+</span>
          </div>
          <p className="mt-1.5 font-mono text-[8px] leading-snug text-cyber-cyan/40">
            Top {LEADERBOARD_TOP_N} paid each 3-day cycle · wire @ MC{' '}
            {formatMcThreshold(PAYOUT_WIRE_MC_THRESHOLD_USD)}+
            {!isSupabaseConfigured() ? ' · configure Supabase for live board' : ''}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
          {loading ? (
            <p className="py-8 text-center font-mono text-[9px] text-cyber-cyan/50 animate-pulse">
              SYNCING SYNDICATE NODES...
            </p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center font-mono text-[9px] text-cyber-cyan/50">
              No ranked operators yet this cycle.
            </p>
          ) : (
            <div className="space-y-1">
              {entries.map((entry) => (
                <div
                  key={`${entry.handle}-${entry.rank}`}
                  className={`flex items-center gap-2 border px-2 py-1.5 font-mono text-[8px] md:text-[9px] ${
                    entry.isLocal
                      ? 'border-terminal-green/50 bg-terminal-green/10'
                      : 'border-cyber-cyan/15 bg-cyber-cyan/5'
                  }`}
                >
                  <span
                    className={`w-6 shrink-0 font-bold ${
                      entry.rank <= 3 ? 'text-neon-pink' : 'text-cyber-cyan/50'
                    }`}
                  >
                    #{entry.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate font-bold ${
                        entry.isLocal
                          ? 'text-terminal-green'
                          : 'text-cyber-cyan'
                      }`}
                    >
                      {entry.handle}
                      {entry.isLocal ? ' ◀' : ''}
                    </p>
                    <p className="text-cyber-cyan/40">
                      P{entry.phase}
                      {entry.walletHint ? ` · ${entry.walletHint}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-neon-pink">
                      {formatSeasonYen(entry.seasonYen)} $YEN
                    </p>
                    {entry.payoutYami > 0 ? (
                      <p className="text-terminal-green">
                        +{entry.payoutYami.toLocaleString()} $YAMI
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!qualified ? (
            <p className="mt-3 border border-cyber-cyan/20 p-2 font-mono text-[8px] text-cyber-cyan/50 md:text-[9px]">
              Reach Phase {SEASON_MIN_PHASE} to enter. Earned:{' '}
              <span className="text-cyber-cyan">
                {formatSeasonYen(seasonYenEarned)} $YEN
              </span>
            </p>
          ) : localRank && localRank > LEADERBOARD_TOP_N ? (
            <p className="mt-3 border border-cyber-cyan/20 p-2 font-mono text-[8px] text-cyber-cyan/50 md:text-[9px]">
              Your rank:{' '}
              <span className="text-neon-pink">#{localRank}</span> — outside top{' '}
              {LEADERBOARD_TOP_N}.
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-cyber-cyan/20 p-3 md:p-4">
          <button
            type="button"
            onClick={onClose}
            className="terminal-btn w-full border border-cyber-cyan/40 py-2 font-mono text-[10px] text-cyber-cyan transition hover:border-terminal-green hover:text-terminal-green"
          >
            [ CLOSE ]
          </button>
        </div>
      </div>
    </div>
  )
}
