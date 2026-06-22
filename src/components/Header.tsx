import { useState } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { copyToClipboard } from '../lib/clipboard'
import { truncatePublicKey } from '../lib/wallet'
import { formatYenBalance } from '../lib/yen'
import { useGameStore } from '../store/useGameStore'
import { BurnerWalletModal } from './BurnerWalletModal'
import { GridPowerBar } from './GridPowerBar'
import { SyndicateNetworkBadge } from './SyndicateNetworkBadge'

interface HeaderProps {
  onExit?: () => void
  onOpenLeaderboard?: () => void
}

function formatYen(value: number): string {
  return formatYenBalance(value)
}

export function Header({ onExit, onOpenLeaderboard }: HeaderProps) {
  const [showWallet, setShowWallet] = useState(false)

  const yen = useGameStore((s) => s.yen)
  const dirtyCredits = useGameStore((s) => s.dirtyCredits)
  const yamiBalance = useGameStore((s) => s.yamiBalance)
  const gridPower = useGameStore((s) => s.gridPower)
  const walletPublicKey = useGameStore((s) => s.walletPublicKey)
  const operatorName = useGameStore((s) => s.operatorName)
  const phase = useGameStore((s) => s.getCurrentPhaseDefinition())

  const handleCopyAddress = async () => {
    if (!walletPublicKey) return
    const success = await copyToClipboard(walletPublicKey)
    if (success) {
      toast.success('Burner address copied', { className: 'yami-toast' })
    } else {
      toast.error('Copy failed.')
    }
  }

  return (
    <>
      <header className="game-header game-glass shrink-0 border-b border-neon-pink/30 px-2 py-2 md:px-3">
        <div className="flex items-start gap-2 md:gap-3">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="terminal-btn glow-hover-cyan shrink-0 self-start border border-cyber-cyan/40 px-1.5 py-1 font-mono text-[8px] text-cyber-cyan md:py-1.5"
            >
              [ EXIT ]
            </button>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="game-header-title min-w-0">
                <h1 className="font-vt323 text-2xl leading-none tracking-[0.22em] text-neon-pink md:text-3xl md:tracking-[0.28em] lg:text-4xl">
                  YAMI KIOSK
                </h1>
                <p className="mt-0.5 truncate font-mono text-[8px] text-cyber-cyan/60 md:text-[9px]">
                  ヤミキオスク // {phase.nameJa}
                </p>
                <SyndicateNetworkBadge compact />
              </div>

              <div className="shrink-0 text-right">
                <p className="font-mono text-[8px] text-cyber-cyan/50">
                  BLACK MARKET
                </p>
                <p className="font-vt323 text-lg leading-tight text-neon-pink md:text-2xl">
                  ${formatYen(yen)}{' '}
                  <span className="text-[10px] text-cyber-cyan md:text-xs">
                    YEN
                  </span>
                </p>
                <div className="flex justify-end gap-2 font-mono text-[7px] md:text-[8px]">
                  <span className="text-terminal-green">
                    CR: {formatYen(dirtyCredits)}
                  </span>
                  <span className="text-cyber-cyan">
                    $YAMI: {formatYen(yamiBalance)}
                  </span>
                </div>
              </div>
            </div>

            <div className="game-header-status-row flex items-stretch gap-2">
              <GridPowerBar
                power={gridPower}
                className="game-grid-bar game-status-chip min-w-0 flex-1 border border-cyber-cyan/15 bg-cyber-cyan/5 px-2 py-1"
              />

              <div className="game-wallet-chip game-status-chip flex shrink-0 items-center justify-center gap-2 border border-cyber-cyan/15 bg-cyber-cyan/5 px-2.5 md:gap-2.5 md:px-3">
                {onOpenLeaderboard ? (
                  <button
                    type="button"
                    onClick={onOpenLeaderboard}
                    className="terminal-btn glow-hover-cyan shrink-0 border border-cyber-cyan/40 px-1.5 py-0.5 font-mono text-[8px] text-cyber-cyan md:px-2 md:py-1 md:text-[9px]"
                  >
                    [ LEADERBOARD ]
                  </button>
                ) : null}
                <p className="truncate font-mono text-[9px] text-terminal-green md:text-[10px]">
                  OP:{' '}
                  <span className="text-cyber-cyan">
                    {operatorName ||
                      (walletPublicKey
                        ? truncatePublicKey(walletPublicKey, 4)
                        : '...')}
                  </span>
                </p>
                {walletPublicKey ? (
                  <button
                    type="button"
                    onClick={() => void handleCopyAddress()}
                    title={walletPublicKey}
                    className="terminal-btn glow-hover-cyan hidden max-w-[88px] truncate border border-cyber-cyan/25 px-1.5 py-0.5 font-mono text-[7px] text-cyber-cyan/70 sm:inline-flex sm:items-center sm:gap-1 md:max-w-none md:text-[8px]"
                  >
                    {truncatePublicKey(walletPublicKey, 3)}
                    <Copy size={10} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowWallet(true)}
                  disabled={!walletPublicKey}
                  className="terminal-btn glow-hover-pink shrink-0 border border-neon-pink/50 px-1.5 py-0.5 font-mono text-[8px] text-neon-pink md:px-2 md:py-1 md:text-[9px] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  [ WALLET ]
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {showWallet && walletPublicKey ? (
        <BurnerWalletModal onClose={() => setShowWallet(false)} />
      ) : null}
    </>
  )
}
