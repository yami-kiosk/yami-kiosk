import { useEffect, useMemo, useState } from 'react'
import {
  formatDurationMs,
  getLiveComboCount,
  isOverclockActive,
} from '../lib/effectiveRates'
import { getInjectGuardStatus } from '../lib/antiCheat/injectGuard'
import {
  INJECT_COMBO_MAX,
  getInjectComboBonusPercent,
  hasSkillMilestone,
  OVERCLOCK_MULTIPLIER,
} from '../store/skillMilestones'
import { getDoctrineLabel } from '../store/syndicateDoctrine'
import { useGameStore } from '../store/useGameStore'

interface BuffChip {
  id: string
  label: string
  detail?: string
  tone: 'active' | 'ready' | 'passive'
}

export function ActiveBuffsPanel() {
  const [now, setNow] = useState(() => Date.now())

  const hardwareLevel = useGameStore((s) => s.hardwareLevel)
  const softwareLevel = useGameStore((s) => s.softwareLevel)
  const stealthLevel = useGameStore((s) => s.stealthLevel)
  const distributionLevel = useGameStore((s) => s.distributionLevel)
  const overclockBoostUntil = useGameStore((s) => s.overclockBoostUntil)
  const overclockNextAt = useGameStore((s) => s.overclockNextAt)
  const injectComboCount = useGameStore((s) => s.injectComboCount)
  const injectComboLastAt = useGameStore((s) => s.injectComboLastAt)
  const syndicateDoctrine = useGameStore((s) => s.syndicateDoctrine)
  const hijackScriptOwned = useGameStore((s) => s.hijackScriptOwned)
  const hijackPassiveBonus = useGameStore((s) => s.hijackPassiveBonus)
  const raidFailInsuranceUsed = useGameStore((s) => s.raidFailInsuranceUsed)
  const bulkLaunderBonusUsed = useGameStore((s) => s.bulkLaunderBonusUsed)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const buffs = useMemo(() => {
    const chips: BuffChip[] = []
    const comboState = {
      softwareLevel,
      injectComboCount,
      injectComboLastAt,
    }
    const liveCombo = getLiveComboCount(comboState, now)
    const { botPenaltyRemainingMs } = getInjectGuardStatus(now)

    if (botPenaltyRemainingMs > 0) {
      chips.push({
        id: 'ice-trace',
        label: 'ICE TRACE',
        detail: `inject blocked · ${formatDurationMs(botPenaltyRemainingMs)}`,
        tone: 'active',
      })
    }

    if (liveCombo > 0) {
      chips.push({
        id: 'combo',
        label: `COMBO ×${liveCombo}`,
        detail: `+${getInjectComboBonusPercent(liveCombo).toFixed(1)}% click $YEN`,
        tone: 'active',
      })
    }

    if (isOverclockActive({ hardwareLevel, overclockBoostUntil }, now)) {
      chips.push({
        id: 'overclock',
        label: 'OVERCLOCK',
        detail: `${OVERCLOCK_MULTIPLIER}× · ${formatDurationMs(overclockBoostUntil - now)}`,
        tone: 'active',
      })
    } else if (
      hasSkillMilestone(hardwareLevel, 10) &&
      overclockNextAt > now
    ) {
      chips.push({
        id: 'overclock-wait',
        label: 'OVERCLOCK',
        detail: `ready in ${formatDurationMs(overclockNextAt - now)}`,
        tone: 'passive',
      })
    }

    const doctrineLabel = getDoctrineLabel(syndicateDoctrine)
    if (doctrineLabel) {
      chips.push({
        id: 'doctrine',
        label: doctrineLabel,
        tone: 'passive',
      })
    }

    if (hijackScriptOwned && hijackPassiveBonus > 0) {
      chips.push({
        id: 'hijack',
        label: 'SCRIPT',
        detail: `+${hijackPassiveBonus} $YEN/m`,
        tone: 'passive',
      })
    }

    if (hasSkillMilestone(stealthLevel, 10) && !raidFailInsuranceUsed) {
      chips.push({
        id: 'ice',
        label: 'ICE IMMUNITY',
        detail: '1 free raid fail',
        tone: 'ready',
      })
    }

    if (hasSkillMilestone(distributionLevel, 10) && !bulkLaunderBonusUsed) {
      chips.push({
        id: 'wholesale',
        label: 'WHOLESALE',
        detail: 'zero-fee launder',
        tone: 'ready',
      })
    }

    if (hasSkillMilestone(softwareLevel, 3) && liveCombo === 0) {
      chips.push({
        id: 'combo-hint',
        label: 'COMBO',
        detail: `stack up to ×${INJECT_COMBO_MAX}`,
        tone: 'passive',
      })
    }

    return chips
  }, [
    bulkLaunderBonusUsed,
    distributionLevel,
    hardwareLevel,
    hijackPassiveBonus,
    hijackScriptOwned,
    injectComboCount,
    injectComboLastAt,
    now,
    overclockBoostUntil,
    overclockNextAt,
    raidFailInsuranceUsed,
    softwareLevel,
    stealthLevel,
    syndicateDoctrine,
  ])

  if (buffs.length === 0) return null

  const toneClass = (tone: BuffChip['tone']) => {
    switch (tone) {
      case 'active':
        return 'border-terminal-green/50 bg-terminal-green/10 text-terminal-green'
      case 'ready':
        return 'border-neon-pink/50 bg-neon-pink/10 text-neon-pink'
      default:
        return 'border-cyber-cyan/25 bg-cyber-cyan/5 text-cyber-cyan/70'
    }
  }

  return (
    <div className="flex w-full flex-wrap justify-center gap-1">
      {buffs.map((buff) => (
        <span
          key={buff.id}
          className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[7px] leading-tight tracking-wide md:text-[8px] ${toneClass(buff.tone)} ${buff.tone === 'active' ? 'animate-pulse' : ''}`}
          title={buff.detail}
        >
          <span>{buff.label}</span>
          {buff.detail ? (
            <span className="opacity-75">· {buff.detail}</span>
          ) : null}
        </span>
      ))}
    </div>
  )
}
