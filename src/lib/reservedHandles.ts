/** NPC syndicate handles — cannot be claimed by players */
export const SYNDICATE_NPC_HANDLES = [
  'NEON_VIPER',
  'GRID_RAT',
  'VOID_RUNNER',
  'KIOSK_GHOST',
  'YAKUZA_NODE',
  'PINK_ICE',
  'DATA_YAKUZA',
  'ALLEY_KING',
  'SYNTH_MONK',
  'CORP_LEECH',
  'BLACKOUT_7',
  'WIRE_FOX',
  'JUNK_SAMURAI',
  'HIVE_DRIFT',
  'STATIC_GOD',
  'MEGACORP_RONIN',
  'DIRTY_AEGIS',
  'PULSE_DEALER',
] as const

export const SYNDICATE_RESERVED_HANDLES = [
  ...SYNDICATE_NPC_HANDLES,
  'YOU',
  'YAMI',
  'ADMIN',
  'SYNDICATE',
  'DEV',
  'OPERATOR',
] as const

export const RESERVED_HANDLE_SET = new Set(
  SYNDICATE_RESERVED_HANDLES.map((h) => h.toUpperCase()),
)
