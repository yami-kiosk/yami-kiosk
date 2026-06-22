import { useEffect, useState } from 'react'
import { ChevronDown, Copy, X } from 'lucide-react'
import { toast } from 'sonner'
import { copyToClipboard } from '../lib/clipboard'
import {
  fetchOperatorPayoutRemote,
  setOperatorPayoutRemote,
} from '../lib/supabase/api'
import { isSupabaseConfigured } from '../lib/supabase/client'
import {
  effectivePayoutAddress,
  isValidSolanaAddress,
  truncatePublicKey,
} from '../lib/wallet'
import { useGameStore } from '../store/useGameStore'
import { ClaimRewardsSection } from './ClaimRewardsSection'

interface BurnerWalletModalProps {
  onClose: () => void
}

export function BurnerWalletModal({ onClose }: BurnerWalletModalProps) {
  const walletPublicKey = useGameStore((s) => s.walletPublicKey)
  const operatorName = useGameStore((s) => s.operatorName)
  const payoutPubkey = useGameStore((s) => s.payoutPubkey)
  const setPayoutPubkey = useGameStore((s) => s.setPayoutPubkey)
  const getBurnerSecretKey = useGameStore((s) => s.getBurnerSecretKey)

  const [payoutInput, setPayoutInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showBackup, setShowBackup] = useState(false)

  const secretKey = showBackup ? getBurnerSecretKey() : null
  const effective = effectivePayoutAddress(walletPublicKey, payoutPubkey)
  const hasCustomPayout = Boolean(
    payoutPubkey && walletPublicKey && payoutPubkey !== walletPublicKey,
  )

  useEffect(() => {
    if (!walletPublicKey) {
      setIsLoading(false)
      return
    }

    const burner: string = walletPublicKey
    let cancelled = false

    async function loadPayout() {
      setIsLoading(true)
      if (isSupabaseConfigured()) {
        const remote = await fetchOperatorPayoutRemote(burner)
        if (cancelled) return
        if (remote?.success) {
          setPayoutPubkey(remote.payoutPubkey ?? null)
          setPayoutInput(remote.payoutPubkey ?? '')
        } else {
          const local = useGameStore.getState().payoutPubkey
          setPayoutInput(local ?? '')
        }
      } else {
        const local = useGameStore.getState().payoutPubkey
        setPayoutInput(local ?? '')
      }
      if (!cancelled) setIsLoading(false)
    }

    void loadPayout()
    return () => {
      cancelled = true
    }
  }, [walletPublicKey, setPayoutPubkey])

  const handleCopy = async (text: string, label: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      toast.success(`${label} copied`, { className: 'yami-toast' })
    } else {
      toast.error('Copy failed — terminal buffer unreachable.')
    }
  }

  const handleSavePayout = async () => {
    if (!walletPublicKey) return

    const trimmed = payoutInput.trim()
    const nextPayout = trimmed.length === 0 ? null : trimmed

    if (nextPayout && !isValidSolanaAddress(nextPayout)) {
      toast.error('Invalid Solana address — paste a valid base58 pubkey.')
      return
    }

    if (nextPayout === walletPublicKey) {
      toast.message('Using burner address — custom payout cleared.')
    }

    setIsSaving(true)
    try {
      if (isSupabaseConfigured()) {
        const result = await setOperatorPayoutRemote(walletPublicKey, nextPayout)
        if (!result.success) {
          toast.error(result.message ?? 'Failed to save payout address.')
          return
        }
        setPayoutPubkey(result.payoutPubkey ?? null)
        setPayoutInput(result.payoutPubkey ?? '')
        toast.success('Season payout address saved to syndicate network.')
        return
      }

      setPayoutPubkey(nextPayout === walletPublicKey ? null : nextPayout)
      toast.success('Payout address saved locally (network offline).')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClearPayout = async () => {
    setPayoutInput('')
    if (!walletPublicKey) return

    setIsSaving(true)
    try {
      if (isSupabaseConfigured()) {
        const result = await setOperatorPayoutRemote(walletPublicKey, null)
        if (!result.success) {
          toast.error(result.message ?? 'Failed to clear payout address.')
          return
        }
      }
      setPayoutPubkey(null)
      toast.success('Payout reset — rewards go to your burner wallet.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!walletPublicKey) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="backup-modal relative max-h-[90vh] w-full max-w-lg overflow-y-auto border border-cyber-cyan bg-black p-6 shadow-[0_0_40px_rgba(0,255,255,0.2)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="wallet-modal-title"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-cyber-cyan/50 transition-colors hover:text-neon-pink"
          aria-label="Close wallet modal"
        >
          <X size={18} />
        </button>

        <p className="font-mono text-[10px] tracking-[0.3em] text-terminal-green">
          {'>'} BURNER NODE // WALLET TERMINAL
        </p>
        <h2
          id="wallet-modal-title"
          className="mt-2 font-vt323 text-2xl text-cyber-cyan"
        >
          OPERATOR WALLET
        </h2>
        {operatorName ? (
          <p className="mt-1 font-mono text-[10px] text-neon-pink/80">
            HANDLE: {operatorName}
          </p>
        ) : null}

        <section className="mt-5 border border-cyber-cyan/25 bg-cyber-cyan/5 p-4">
          <p className="font-mono text-[10px] text-cyber-cyan/60">
            BURNER PUBLIC ADDRESS // YOUR NODE ID
          </p>
          <p className="mt-2 break-all font-mono text-xs text-terminal-green">
            {walletPublicKey}
          </p>
          <button
            type="button"
            onClick={() => void handleCopy(walletPublicKey, 'Burner address')}
            className="terminal-btn glow-hover-cyan mt-3 flex w-full items-center justify-center gap-2 border border-cyber-cyan/50 py-2 font-mono text-xs text-cyber-cyan"
          >
            <Copy size={14} />
            COPY BURNER ADDRESS
          </button>
          <p className="mt-3 font-mono text-[9px] leading-relaxed text-cyber-cyan/40">
            This address is your in-game identity on the syndicate network. It
            is generated locally in your browser — no Phantom connect required.
          </p>
        </section>

        <section className="mt-4 border border-neon-pink/30 bg-neon-pink/5 p-4">
          <p className="font-mono text-[10px] text-neon-pink/70">
            SEASON PAYOUT ADDRESS // OPTIONAL
          </p>
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-cyber-cyan/50">
            Paste a Solana wallet where you want $YAMI season rewards sent. Leave
            blank to receive on your burner. No wallet connect — paste only.
          </p>

          {isLoading ? (
            <p className="mt-3 font-mono text-[10px] text-cyber-cyan/40">
              Syncing from syndicate network…
            </p>
          ) : (
            <>
              <input
                type="text"
                value={payoutInput}
                onChange={(e) => setPayoutInput(e.target.value)}
                placeholder="Paste Solana address (e.g. Phantom main wallet)"
                spellCheck={false}
                className="mt-3 w-full border border-neon-pink/30 bg-black/60 px-3 py-2 font-mono text-xs text-neon-pink placeholder:text-neon-pink/25 focus:border-neon-pink focus:outline-none"
              />

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSavePayout()}
                  disabled={isSaving || !operatorName}
                  className="terminal-btn glow-hover-pink flex-1 border border-neon-pink/60 py-2 font-mono text-[10px] text-neon-pink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSaving ? 'SAVING…' : 'SAVE PAYOUT ADDRESS'}
                </button>
                {hasCustomPayout ? (
                  <button
                    type="button"
                    onClick={() => void handleClearPayout()}
                    disabled={isSaving}
                    className="terminal-btn shrink-0 border border-cyber-cyan/30 px-3 py-2 font-mono text-[10px] text-cyber-cyan/70 disabled:opacity-40"
                  >
                    RESET
                  </button>
                ) : null}
              </div>

              {!operatorName ? (
                <p className="mt-2 font-mono text-[9px] text-red-400/80">
                  Register an operator handle first (onboarding) before saving
                  payout to the network.
                </p>
              ) : null}

              <div className="mt-3 border-t border-neon-pink/15 pt-3">
                <p className="font-mono text-[9px] text-cyber-cyan/40">
                  EFFECTIVE PAYOUT TARGET
                </p>
                <p className="mt-1 font-mono text-[10px] text-terminal-green">
                  {effective
                    ? truncatePublicKey(effective, 6)
                    : '—'}
                  {hasCustomPayout ? (
                    <span className="ml-2 text-neon-pink/60">(custom)</span>
                  ) : (
                    <span className="ml-2 text-cyber-cyan/40">(burner)</span>
                  )}
                </p>
              </div>
            </>
          )}
        </section>

        <section className="mt-4 border border-terminal-green/30 bg-terminal-green/5 p-4">
          <p className="font-mono text-[10px] text-terminal-green/80">
            SEASON REWARDS // CLAIM
          </p>
          <div className="mt-3">
            <ClaimRewardsSection compact />
          </div>
        </section>

        <section className="mt-4 border border-red-600/30">
          <button
            type="button"
            onClick={() => setShowBackup((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 font-mono text-[10px] text-red-400/90 hover:bg-red-950/20"
          >
            <span>ADVANCED // EXPORT PRIVATE KEY</span>
            <ChevronDown
              size={14}
              className={`transition-transform ${showBackup ? 'rotate-180' : ''}`}
            />
          </button>

          {showBackup && secretKey ? (
            <div className="border-t border-red-600/30 p-4">
              <div className="border border-red-600/60 bg-red-950/20 p-3">
                <p className="font-mono text-[10px] leading-relaxed text-red-400">
                  CRITICAL: Never share this key. Anyone with it controls your
                  burner wallet and can drain funds.
                </p>
              </div>
              <div className="mt-3 border border-neon-pink/30 bg-neon-pink/5 p-3">
                <p className="break-all font-mono text-xs text-neon-pink">
                  {secretKey}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy(secretKey, 'Private key')}
                className="terminal-btn glow-hover-pink mt-3 flex w-full items-center justify-center gap-2 border border-neon-pink/50 py-2 font-mono text-xs text-neon-pink"
              >
                <Copy size={14} />
                COPY PRIVATE KEY
              </button>
              <p className="mt-2 text-center font-mono text-[9px] text-cyber-cyan/30">
                Phantom → Add Wallet → Import Private Key
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
