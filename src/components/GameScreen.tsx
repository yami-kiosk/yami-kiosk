import { useState } from 'react'
import { Header } from './Header'
import { InjectPowerButton } from './InjectPowerButton'
import { LeaderboardModal } from './LeaderboardModal'
import { PhaseUpgradeButton } from './PhaseUpgradeButton'
import { Sidebar, type SidebarTab } from './Sidebar'
import { SyndicatePayouts } from './SyndicatePayouts'
import { buildVendingAscii } from '../lib/asciiBox'
import { getEffectivePassiveRatePerMin, useRateState } from '../lib/effectiveRates'
import { formatYenBalance } from '../lib/yen'
import { useGameStore } from '../store/useGameStore'
import { ActiveBuffsPanel } from './ActiveBuffsPanel'

interface GameScreenProps {
  onExit?: () => void
}

export function GameScreen({ onExit }: GameScreenProps) {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('phases')
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const phase = useGameStore((s) => s.getCurrentPhaseDefinition())
  const yen = useGameStore((s) => s.yen)
  const dirtyCreditsPerMin = useGameStore((s) => s.dirtyCreditsPerMin)
  const rateState = useRateState()

  const effectivePassive = getEffectivePassiveRatePerMin(rateState)

  return (
    <div className="game-screen game-screen-bg relative flex h-full flex-col text-cyber-cyan scanlines">
      <div className="game-bg-overlay" aria-hidden />

      <div className="game-ui-layer flex min-h-0 flex-1 flex-col">
        <Header
          onExit={onExit}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <main className="game-main flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-hidden px-3 py-2 md:gap-3 md:px-4">
            <div className="flex w-full max-w-xs flex-col items-center gap-2 md:max-w-sm md:gap-2.5">
                <p className="shrink-0 text-center font-mono text-[8px] text-cyber-cyan/60">
                  // P{phase.id} — {phase.name.toUpperCase()}
                </p>

                <div className="relative w-full shrink-0">
                  <div className="game-glass relative terminal-panel border border-neon-pink/40 p-3 glow-hover-pink">
                    <pre className="vending-ascii mb-2 font-mono text-[8px] leading-snug text-cyber-cyan/60 md:text-[9px]">
                      {buildVendingAscii(effectivePassive, dirtyCreditsPerMin)}
                    </pre>
                    <ActiveBuffsPanel />
                    <InjectPowerButton />
                  </div>
                </div>

                <PhaseUpgradeButton />

                <div className="grid w-full shrink-0 grid-cols-2 gap-1.5 font-mono text-[8px] md:text-[9px]">
                  <div className="game-glass-light terminal-card border border-cyber-cyan/20 p-1.5">
                    <span className="text-cyber-cyan/50">BALANCE</span>
                    <p className="mt-0.5 text-neon-pink leading-tight">
                      {formatYenBalance(yen)}
                    </p>
                  </div>
                  <div className="game-glass-light terminal-card border border-cyber-cyan/20 p-1.5">
                    <span className="text-cyber-cyan/50">DRAIN</span>
                    <p className="mt-0.5 text-neon-pink">
                      {phase.gridDrainPerTick}%/s
                    </p>
                  </div>
                </div>

                <SyndicatePayouts
                  onOpenLeaderboard={() => setShowLeaderboard(true)}
                />
              </div>
          </main>

          <div className="sidebar-panel flex max-h-[36vh] min-h-0 w-full shrink-0 flex-col md:max-h-none md:h-full md:w-72">
            <Sidebar activeTab={sidebarTab} onTabChange={setSidebarTab} />
          </div>
        </div>

        <footer className="game-glass shrink-0 border-t border-cyber-cyan/10 px-2 py-1 text-center font-mono text-[8px] text-cyber-cyan/40">
          v0.1.0 // BURNER NODE // $YAMI $YEN // 3-DAY POOL
        </footer>
      </div>

      {showLeaderboard ? (
        <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
      ) : null}
    </div>
  )
}
