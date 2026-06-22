import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { solscanTxUrl } from '../lib/claim/config'
import type { SeasonPayoutRow } from '../lib/supabase/types'
import { truncatePublicKey } from '../lib/wallet'
import { useClaimablePayouts } from '../hooks/useClaimablePayouts'

interface ClaimRewardsSectionProps {
  compact?: boolean
}

function statusLabel(status: SeasonPayoutRow['status']): string {
  switch (status) {
    case 'pending':
      return 'CLAIMABLE'
    case 'failed':
      return 'RETRY'
    case 'claimed':
      return 'CLAIMED'
    case 'processing':
      return 'PROCESSING'
    default:
      return String(status).toUpperCase()
  }
}

export function ClaimRewardsSection({ compact = false }: ClaimRewardsSectionProps) {
  const {
    rows,
    pending,
    pendingTotal,
    isLoading,
    claimingSeasonId,
    claimEnabled,
    claim,
  } = useClaimablePayouts()

  const handleClaim = async (seasonId: number) => {
    const result = await claim(seasonId)
    if (result.success && result.tx_signature) {
      toast.success('Reward wired on-chain.', {
        className: 'yami-toast',
        description: `${result.amount_yami?.toLocaleString() ?? ''} $YAMI sent.`,
        action: {
          label: 'Solscan',
          onClick: () => window.open(solscanTxUrl(result.tx_signature!), '_blank'),
        },
      })
      return
    }

    if (result.success) {
      toast.success('Claim recorded.', { className: 'yami-toast' })
      return
    }

    toast.error(result.message ?? 'Claim failed.', { className: 'yami-toast' })
  }

  if (isLoading && rows.length === 0) {
    return (
      <p className="font-mono text-[9px] text-cyber-cyan/40">
        Loading season entitlements…
      </p>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="font-mono text-[9px] leading-relaxed text-cyber-cyan/40">
        No season rewards registered yet. Finish a cycle in the top {10} payout
        zone to unlock entitlements here.
      </p>
    )
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {pending.length > 0 ? (
        <p className="font-mono text-[9px] text-terminal-green">
          {pending.length} claimable · {pendingTotal.toLocaleString()} $YAMI total
        </p>
      ) : null}

      {!claimEnabled ? (
        <p className="font-mono text-[9px] leading-relaxed text-neon-pink/70">
          On-chain claim unlocks when token is live — set{' '}
          <span className="text-cyber-cyan">VITE_YAMI_MINT</span> + deploy treasury
          edge function. Entitlements are saved and ready.
        </p>
      ) : null}

      <ul className="space-y-2">
        {rows.map((row) => {
          const canClaim =
            claimEnabled &&
            (row.status === 'pending' || row.status === 'failed')
          const isClaiming = claimingSeasonId === row.season_id

          return (
            <li
              key={row.season_id}
              className="border border-cyber-cyan/20 bg-black/40 p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-cyber-cyan">
                    CYCLE {row.season_id} · RANK #{row.rank}
                  </p>
                  <p className="font-mono text-sm text-terminal-green">
                    {row.amount_yami.toLocaleString()} $YAMI
                  </p>
                  <p className="mt-0.5 font-mono text-[8px] text-cyber-cyan/40">
                    → {truncatePublicKey(row.destination_pubkey, 5)}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-mono text-[8px] ${
                    row.status === 'claimed'
                      ? 'text-terminal-green/70'
                      : row.status === 'failed'
                        ? 'text-red-400'
                        : 'text-neon-pink'
                  }`}
                >
                  {statusLabel(row.status)}
                </span>
              </div>

              {row.claim_error ? (
                <p className="mt-1 font-mono text-[8px] text-red-400/80">
                  {row.claim_error}
                </p>
              ) : null}

              {row.tx_signature ? (
                <a
                  href={solscanTxUrl(row.tx_signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 font-mono text-[8px] text-cyber-cyan hover:text-terminal-green"
                >
                  View tx <ExternalLink size={10} />
                </a>
              ) : null}

              {canClaim ? (
                <button
                  type="button"
                  onClick={() => void handleClaim(row.season_id)}
                  disabled={isClaiming}
                  className="terminal-btn glow-hover-pink mt-2 flex w-full items-center justify-center gap-2 border border-neon-pink/60 py-2 font-mono text-[10px] text-neon-pink disabled:opacity-50"
                >
                  {isClaiming ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      WIRING REWARD…
                    </>
                  ) : (
                    '[ CLAIM REWARD ]'
                  )}
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
