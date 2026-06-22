import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { solscanTxUrl } from '../lib/claim/config'
import { useClaimablePayouts } from '../hooks/useClaimablePayouts'
import { formatSeasonYen } from '../lib/leaderboard'
import type { SeasonEndModalData } from '../store/seasonSettlement'
import {
  LEADERBOARD_TOP_N,
  PAYOUT_WIRE_MC_THRESHOLD_USD,
  formatMcThreshold,
} from '../store/seasonConfig'

interface SeasonEndModalProps {
  data: SeasonEndModalData
  onDismiss: () => void
}

function truncateWallet(pubkey: string | null): string {
  if (!pubkey) return 'NO NODE'
  return `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`
}

export function SeasonEndModal({ data, onDismiss }: SeasonEndModalProps) {
  const [visible, setVisible] = useState(false)
  const { claim, claimEnabled, claimingSeasonId, refresh } = useClaimablePayouts()

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, data.seasonId])

  const inPayoutZone =
    data.qualified && data.rank !== null && data.rank <= LEADERBOARD_TOP_N

  const isClaiming = claimingSeasonId === data.seasonId

  const handleClaim = async () => {
    const result = await claim(data.seasonId)
    if (result.success && result.tx_signature) {
      toast.success('Season reward wired on-chain.', {
        className: 'yami-toast',
        action: {
          label: 'Solscan',
          onClick: () => window.open(solscanTxUrl(result.tx_signature!), '_blank'),
        },
      })
      return
    }
    if (!result.success) {
      toast.error(result.message ?? 'Claim failed.', { className: 'yami-toast' })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-end-title"
    >
      <div
        className={`game-glass terminal-panel w-full max-w-sm border border-neon-pink/50 p-4 transition-all duration-300 ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <p
          id="season-end-title"
          className="font-mono text-[10px] text-neon-pink"
        >
          {'>'} CYCLE {data.seasonId} SETTLED // DEV WALLET WIRE
        </p>

        {inPayoutZone ? (
          <>
            <p className="mt-3 font-mono text-[9px] leading-relaxed text-cyber-cyan/80">
              Rank{' '}
              <span className="text-terminal-green">#{data.rank}</span> ·{' '}
              {formatSeasonYen(data.seasonYenEarned)} $YEN earned → payout
              credited to burner node.
            </p>
            <p className="mt-2 font-mono text-lg font-bold text-terminal-green">
              +{data.payoutYami.toLocaleString()} $YAMI
            </p>
            {claimEnabled ? (
              <p className="mt-1 font-mono text-[8px] text-neon-pink/70">
                Claim on-chain to your payout wallet — not auto-credited locally.
              </p>
            ) : null}
          </>
        ) : data.qualified ? (
          <p className="mt-3 font-mono text-[9px] leading-relaxed text-cyber-cyan/60">
            Rank #{data.rank ?? '—'} — outside top {LEADERBOARD_TOP_N}.{' '}
            {formatSeasonYen(data.seasonYenEarned)} $YEN earned. Grind reset for
            next 3-day cycle.
          </p>
        ) : (
          <p className="mt-3 font-mono text-[9px] leading-relaxed text-cyber-cyan/60">
            Did not reach Phase 2 this cycle. Grind reset — hit Black Market
            Fixer to qualify for the next pool.
          </p>
        )}

        <p className="mt-3 font-mono text-[8px] text-cyber-cyan/40">
          PAYOUT NODE: {truncateWallet(data.walletPublicKey)}
        </p>
        <p className="mt-1 font-mono text-[8px] text-cyber-cyan/30">
          {claimEnabled
            ? 'Wire from treasury when you claim · SPL transfer to payout node'
            : `Accrued to burner balance · on-chain wire @ MC ${formatMcThreshold(PAYOUT_WIRE_MC_THRESHOLD_USD)}+`}
        </p>

        {inPayoutZone && data.payoutYami > 0 && claimEnabled ? (
          <button
            type="button"
            onClick={() => void handleClaim()}
            disabled={isClaiming}
            className="terminal-btn glow-hover-pink mt-4 flex w-full items-center justify-center gap-2 border-2 border-neon-pink py-2.5 font-vt323 text-lg text-neon-pink disabled:opacity-50"
          >
            {isClaiming ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                WIRING REWARD…
              </>
            ) : (
              '[ CLAIM REWARD ]'
            )}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onDismiss}
          className={`${inPayoutZone && claimEnabled ? 'mt-2' : 'mt-4'} w-full border border-cyber-cyan/40 bg-cyber-cyan/10 px-3 py-2 font-mono text-[10px] text-cyber-cyan transition hover:border-terminal-green hover:text-terminal-green`}
        >
          [ ENTER CYCLE {data.seasonId + 1} ]
        </button>
      </div>
    </div>
  )
}
