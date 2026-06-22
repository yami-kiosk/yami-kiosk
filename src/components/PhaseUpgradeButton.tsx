import { toast } from 'sonner'
import { PHASES } from '../store/gameConfig'
import { canAffordYen, formatYenBalance } from '../lib/yen'
import { useGameStore } from '../store/useGameStore'

export function PhaseUpgradeButton() {
  const phase = useGameStore((s) => s.phase)
  const yen = useGameStore((s) => s.yen)
  const tryUpgradePhase = useGameStore((s) => s.tryUpgradePhase)

  const currentPhase = PHASES[phase]
  const nextPhase = phase < 6 ? PHASES[(phase + 1) as keyof typeof PHASES] : null

  if (!nextPhase) {
    return (
      <div className="game-glass-light w-full border border-terminal-green/30 p-2 text-center font-mono text-[8px] text-terminal-green md:text-[9px]">
        {'>'} MAX PHASE — NEON GOD OVERRIDE ACTIVE
      </div>
    )
  }

  const cost = currentPhase.upgradeCost
  const canUpgrade = canAffordYen(yen, cost)
  const yenShortfall = Math.max(0, cost - yen)

  const handlePhaseUpgrade = () => {
    if (!canAffordYen(yen, cost)) {
      toast.error(
        `Need ${formatYenBalance(cost)} $YEN — you have ${formatYenBalance(yen)}`,
        { className: 'yami-toast' },
      )
      return
    }

    const ok = tryUpgradePhase()
    if (ok) {
      toast.success(`Core upgraded → ${nextPhase.name}`, {
        className: 'yami-toast',
      })
    }
  }

  return (
    <button
      type="button"
      onClick={handlePhaseUpgrade}
      disabled={!canUpgrade}
      className={`phase-upgrade-btn w-full border px-3 py-2.5 font-mono text-[8px] leading-snug md:text-[9px] ${
        canUpgrade
          ? 'border-neon-pink bg-neon-pink/10 text-neon-pink glow-hover-pink animate-pulse'
          : 'border-cyber-cyan/25 bg-cyber-cyan/5 text-cyber-cyan/50'
      } disabled:cursor-not-allowed`}
    >
      <span className="block font-vt323 text-sm tracking-wider md:text-base">
        {canUpgrade ? '[ UPGRADE CORE ]' : '[ LOCKED — GRIND $YEN ]'}
      </span>
      <span className="mt-0.5 block text-cyber-cyan/80">
        P{phase} → P{nextPhase.id} · {nextPhase.name}
      </span>
      <span className="mt-0.5 block text-neon-pink">
        {formatYenBalance(cost)} $YEN
        {!canUpgrade && yenShortfall > 0 ? (
          <span className="text-cyber-cyan/50">
            {' '}
            · need {formatYenBalance(yenShortfall)} more
          </span>
        ) : null}
      </span>
    </button>
  )
}
