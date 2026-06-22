import {
  GRID_POWER_CRITICAL,
  GRID_POWER_MAX,
  getGridCollapseYenDrainPerTick,
} from '../store/gameConfig'
import { useGameStore } from '../store/useGameStore'

interface GridPowerBarProps {
  power: number
  className?: string
}

export function GridPowerBar({ power, className = '' }: GridPowerBarProps) {
  const phase = useGameStore((s) => s.phase)
  const passiveRatePerMin = useGameStore((s) => s.passiveRatePerMin)

  const percentage = (power / GRID_POWER_MAX) * 100
  const isCollapsed = power <= 0
  const isCritical = !isCollapsed && power < GRID_POWER_CRITICAL
  const collapseDrain = getGridCollapseYenDrainPerTick(phase, passiveRatePerMin)

  return (
    <div className={className}>
      <div className="mb-0.5 flex items-center justify-between gap-2 font-mono text-[8px] md:text-[9px]">
        <span className="text-cyber-cyan/70">GRID POWER</span>
        <span
          className={
            isCollapsed || isCritical
              ? 'text-red-500 animate-blink'
              : 'text-neon-pink'
          }
        >
          {power.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 w-full border border-cyber-cyan/30 bg-black">
        <div
          className={`grid-bar-fill h-full ${
            isCollapsed || isCritical
              ? 'bg-red-600 animate-blink'
              : 'bg-gradient-to-r from-neon-pink to-cyber-cyan'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isCollapsed ? (
        <p className="mt-0.5 font-mono text-[7px] text-red-500 animate-blink md:text-[8px]">
          ⚠ GRID DEAD — -{collapseDrain.toFixed(2)} $YEN/s
        </p>
      ) : isCritical ? (
        <p className="mt-0.5 font-mono text-[7px] text-red-500 animate-blink md:text-[8px]">
          ⚠ CRITICAL — INJECT NOW
        </p>
      ) : null}
    </div>
  )
}
