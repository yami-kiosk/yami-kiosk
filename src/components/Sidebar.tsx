import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PHASES, SKILL_PATHS } from '../store/gameConfig'
import {
  SKILL_MAX_LEVEL,
  getSkillEffectLabel,
  getSkillUpgradeCost,
  type SkillPathId,
} from '../store/skillConfig'
import {
  getSkillUpgradePreview,
  getMilestoneLabel,
  type MilestoneTier,
} from '../store/skillMilestones'
import { pickSkillLevels } from '../store/rateCalculator'
import { useGameStore } from '../store/useGameStore'
import { DarkWebPanel } from './DarkWebPanel'
import { SyndicateDoctrinePanel } from './SyndicateDoctrinePanel'

export type SidebarTab = 'phases' | 'upgrades' | 'darkweb'

interface SidebarProps {
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
}

interface FlashEffect {
  pathId: SkillPathId
  label: string
  level: number
  milestone?: string
}

function getLevelForPath(
  pathId: SkillPathId,
  levels: {
    hardwareLevel: number
    softwareLevel: number
    networkLevel: number
    stealthLevel: number
    distributionLevel: number
  },
): number {
  switch (pathId) {
    case 'hardware':
      return levels.hardwareLevel
    case 'software':
      return levels.softwareLevel
    case 'network':
      return levels.networkLevel
    case 'stealth':
      return levels.stealthLevel
    case 'distribution':
      return levels.distributionLevel
  }
}

function MilestoneBadge({
  tier,
  unlocked,
  pathId,
}: {
  tier: MilestoneTier
  unlocked: boolean
  pathId: SkillPathId
}) {
  const label = getMilestoneLabel(pathId, tier)
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center border text-[9px] ${
        unlocked
          ? 'border-terminal-green bg-terminal-green/15 text-terminal-green'
          : 'border-cyber-cyan/15 text-cyber-cyan/25'
      }`}
      title={label}
    >
      {tier}
    </span>
  )
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [flashEffect, setFlashEffect] = useState<FlashEffect | null>(null)

  const phase = useGameStore((s) => s.phase)
  const yen = useGameStore((s) => s.yen)
  const hijackPassiveBonus = useGameStore((s) => s.hijackPassiveBonus)
  const hardwareLevel = useGameStore((s) => s.hardwareLevel)
  const softwareLevel = useGameStore((s) => s.softwareLevel)
  const networkLevel = useGameStore((s) => s.networkLevel)
  const stealthLevel = useGameStore((s) => s.stealthLevel)
  const distributionLevel = useGameStore((s) => s.distributionLevel)
  const upgradeSkill = useGameStore((s) => s.upgradeSkill)

  const skillLevels = {
    hardwareLevel,
    softwareLevel,
    networkLevel,
    stealthLevel,
    distributionLevel,
  }

  const skillLevelsForPreview = pickSkillLevels({
    phase,
    ...skillLevels,
    hijackPassiveBonus,
  })

  const darkWebLocked = phase < 2

  const tabs: { id: SidebarTab; label: string; locked?: boolean }[] = [
    { id: 'phases', label: 'PHASES' },
    { id: 'upgrades', label: 'UPGRADES' },
    { id: 'darkweb', label: darkWebLocked ? '🔒 WEB' : 'DARK WEB', locked: darkWebLocked },
  ]

  useEffect(() => {
    if (!flashEffect) return
    const timer = setTimeout(() => setFlashEffect(null), 1200)
    return () => clearTimeout(timer)
  }, [flashEffect])

  const handleSkillUpgrade = (pathId: SkillPathId) => {
    const result = upgradeSkill(pathId)
    if (result.success && result.pathId && result.newLevel && result.effectLabel) {
      setFlashEffect({
        pathId: result.pathId,
        label: result.milestoneUnlocked ?? result.effectLabel,
        level: result.newLevel,
        milestone: result.milestoneUnlocked,
      })
      toast.success(result.message, { className: 'yami-toast' })
      if (result.milestoneUnlocked) {
        toast.info(result.milestoneUnlocked, { className: 'yami-toast' })
      }
    } else if (result.success) {
      toast.success(result.message, { className: 'yami-toast' })
    } else {
      toast.error(result.message, { className: 'yami-toast' })
    }
  }

  return (
    <aside className="game-glass flex h-full min-h-0 flex-col overflow-hidden border-l border-cyber-cyan/20">
      <div className="flex border-b border-cyber-cyan/20">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`sidebar-tab flex-1 px-2 py-2 font-mono text-[10px] uppercase tracking-wider ${
              activeTab === tab.id
                ? tab.id === 'darkweb'
                  ? darkWebLocked
                    ? 'bg-lobster-red/5 text-lobster-red/60'
                    : 'bg-lobster-red/10 text-lobster-red'
                  : 'bg-neon-pink/10 text-neon-pink'
                : tab.locked
                  ? 'text-cyber-cyan/25 hover:text-cyber-cyan/40'
                  : 'text-cyber-cyan/50 hover:text-cyber-cyan'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {activeTab === 'phases' ? (
          <div className="space-y-3">
            <p className="font-mono text-[10px] text-cyber-cyan/50">
              // PROGRESSION STATE MACHINE
            </p>
            {(Object.values(PHASES) as (typeof PHASES)[keyof typeof PHASES][]).map(
              (p) => {
                const isActive = p.id === phase
                const isLocked = p.id > phase
                return (
                  <div
                    key={p.id}
                    className={`terminal-card border p-3 font-mono text-xs ${
                      isActive
                        ? 'border-neon-pink bg-neon-pink/5 text-neon-pink glow-hover-pink'
                        : isLocked
                          ? 'border-cyber-cyan/10 text-cyber-cyan/30'
                          : 'border-cyber-cyan/30 text-cyber-cyan/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-vt323 text-base">
                        P{p.id}: {p.name}
                      </span>
                      {isActive && (
                        <span className="text-[10px] text-neon-pink animate-pulse">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] opacity-70">{p.nameJa}</p>
                    <p className="mt-2 text-[10px]">
                      {p.offlineRatePerMin}/min offline · {p.activeRatePerMin}
                      /min active
                    </p>
                  </div>
                )
              },
            )}

          </div>
        ) : activeTab === 'upgrades' ? (
          <div className="space-y-3">
            <SyndicateDoctrinePanel />
            <p className="font-mono text-[10px] text-cyber-cyan/50">
              // SKILL TREE — 5 PATHS · MILESTONES Lv3 / 6 / 10
            </p>
            {SKILL_PATHS.map((path) => {
              const pathId = path.id as SkillPathId
              const level = getLevelForPath(pathId, skillLevels)
              const isMax = level >= SKILL_MAX_LEVEL
              const cost = getSkillUpgradeCost(level, phase)
              const canBuy = !isMax && yen >= cost
              const isFlashing = flashEffect?.pathId === pathId
              const perLevelEffect = getSkillEffectLabel(pathId)
              const preview = getSkillUpgradePreview(
                pathId,
                skillLevelsForPreview,
                perLevelEffect,
              )

              return (
                <div
                  key={path.id}
                  className={`terminal-card relative overflow-hidden border p-3 font-mono text-xs ${
                    isFlashing
                      ? 'skill-card-flash border-neon-pink'
                      : 'border-cyber-cyan/20'
                  }`}
                >
                  {isFlashing && flashEffect && (
                    <>
                      <span className="skill-float-text pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap font-vt323 text-sm text-neon-pink">
                        {flashEffect.milestone ? '★ ' : '+'}
                        {flashEffect.label}
                      </span>
                      <span className="skill-scanline pointer-events-none absolute inset-0" />
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="font-vt323 text-base text-neon-pink">
                      {path.label}
                    </p>
                    <span
                      className={`text-[10px] text-terminal-green ${
                        isFlashing ? 'skill-level-pop' : ''
                      }`}
                    >
                      Lv{level}/{SKILL_MAX_LEVEL}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-cyber-cyan/60">
                    {path.range}
                  </p>
                  <p className="mt-1 text-[9px] text-cyber-cyan/40">
                    {perLevelEffect} / level
                  </p>

                  <div className="mt-2 flex gap-1">
                    {([3, 6, 10] as MilestoneTier[]).map((tier) => (
                      <MilestoneBadge
                        key={tier}
                        tier={tier}
                        pathId={pathId}
                        unlocked={level >= tier}
                      />
                    ))}
                  </div>

                  {preview.unlockedMilestones.length > 0 && (
                    <div className="mt-2 space-y-0.5 border border-terminal-green/20 bg-terminal-green/5 p-2">
                      {preview.unlockedMilestones.map((m) => (
                        <p
                          key={m.tier}
                          className="text-[9px] text-terminal-green/80"
                        >
                          ✓ Lv{m.tier}: {m.label}
                        </p>
                      ))}
                    </div>
                  )}

                  {!isMax && preview.statDelta && (
                    <p className="mt-2 text-[9px] text-cyber-cyan/70">
                      After upgrade: {preview.statDelta}
                    </p>
                  )}

                  {!isMax && preview.nextMilestone?.tier === level + 1 && (
                    <p className="mt-1 text-[9px] text-neon-pink/80">
                      ★ Next: {preview.nextMilestone.label}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSkillUpgrade(pathId)}
                    disabled={!canBuy}
                    className={`mt-2 w-full py-2 text-[10px] disabled:cursor-not-allowed disabled:opacity-30 ${
                      isFlashing
                        ? 'skill-upgrade-btn border-neon-pink bg-neon-pink/20 text-neon-pink skill-btn-pulse'
                        : 'skill-upgrade-btn'
                    }`}
                  >
                    {isMax
                      ? 'MAX LEVEL'
                      : `UPGRADE — ${cost.toLocaleString()} $YEN`}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <DarkWebPanel />
        )}
      </div>
    </aside>
  )
}
