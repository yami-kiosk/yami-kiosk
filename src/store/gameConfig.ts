export type GamePhase = 1 | 2 | 3 | 4 | 5 | 6

export interface PhaseDefinition {
  id: GamePhase
  name: string
  nameJa: string
  offlineRatePerMin: number
  activeRatePerMin: number
  upgradeCost: number
  gridDrainPerTick: number
  powerRestoreOnClick: number
  description: string
}

export const PHASES: Record<GamePhase, PhaseDefinition> = {
  1: {
    id: 1,
    name: 'Alley Operator',
    nameJa: '路地裏オペレーター',
    offlineRatePerMin: 3.5,
    activeRatePerMin: 14,
    upgradeCost: 6_500,
    gridDrainPerTick: 0.48,
    powerRestoreOnClick: 8.5,
    description: 'Desperate street operator. Survive the alley.',
  },
  2: {
    id: 2,
    name: 'Black Market Fixer',
    nameJa: '闇市の修理工',
    offlineRatePerMin: 9,
    activeRatePerMin: 36,
    upgradeCost: 38_000,
    gridDrainPerTick: 0.68,
    powerRestoreOnClick: 7.5,
    description: 'Hardware upgrades unlocked. Auto-injectors online.',
  },
  3: {
    id: 3,
    name: 'Grid Hijacker',
    nameJa: 'グリッドハイジャッカー',
    offlineRatePerMin: 28,
    activeRatePerMin: 110,
    upgradeCost: 180_000,
    gridDrainPerTick: 1.05,
    powerRestoreOnClick: 6.5,
    description: 'Hacking scripts unlocked. Dark Web raids online.',
  },
  4: {
    id: 4,
    name: 'Syndicate Supplier',
    nameJa: 'シンジケート供給者',
    offlineRatePerMin: 80,
    activeRatePerMin: 320,
    upgradeCost: 750_000,
    gridDrainPerTick: 2.35,
    powerRestoreOnClick: 5,
    description: 'Grid drain accelerated. Passive upgrades critical.',
  },
  5: {
    id: 5,
    name: 'Cyber-Warlord',
    nameJa: 'サイバー・ウォーロード',
    offlineRatePerMin: 280,
    activeRatePerMin: 1_100,
    upgradeCost: 3_800_000,
    gridDrainPerTick: 3.15,
    powerRestoreOnClick: 4,
    description: 'Megacorp Raid UI unlocked. Dominate the underworld.',
  },
  6: {
    id: 6,
    name: 'The Neon God',
    nameJa: 'ネオンの神',
    offlineRatePerMin: 1_100,
    activeRatePerMin: 4_200,
    upgradeCost: Infinity,
    gridDrainPerTick: 4,
    powerRestoreOnClick: 3,
    description: 'System Override. End of season.',
  },
}

export const TICK_INTERVAL_MS = 1_000
export const GRID_POWER_MAX = 100
export const GRID_POWER_CRITICAL = 30
export const STORAGE_KEY = 'yami-kiosk-save'
export const BURNER_SK_KEY = 'yami_sk'

/** $YEN drained per second while grid is at 0% — scales with phase & passive rate */
export function getGridCollapseYenDrainPerTick(
  phase: GamePhase,
  passiveRatePerMin: number,
): number {
  const passivePerTick = passiveRatePerMin / 60
  return Math.max(passivePerTick * 2.5, phase * 0.18)
}

export const SKILL_PATHS = [
  { id: 'hardware', label: 'Hardware', range: 'Batteries → Plasma Generators' },
  { id: 'software', label: 'Software', range: 'Auto-Click Scripts → AI Bypass' },
  { id: 'network', label: 'Network', range: 'Street Gangs → Yakuza Backing' },
  { id: 'stealth', label: 'Stealth', range: 'Basic VPN → Megacorp Blindspots' },
  { id: 'distribution', label: 'Distribution', range: 'Alley Sales → Dark Web Exchange' },
] as const
