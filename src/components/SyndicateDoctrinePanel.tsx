import { toast } from 'sonner'
import {
  DOCTRINE_UNLOCK_TOTAL_LEVELS,
  SYNDICATE_DOCTRINES,
  canChooseDoctrine,
  getDoctrineLabel,
  getTotalSkillLevels,
  type SyndicateDoctrineId,
} from '../store/syndicateDoctrine'
import { useGameStore } from '../store/useGameStore'

export function SyndicateDoctrinePanel() {
  const hardwareLevel = useGameStore((s) => s.hardwareLevel)
  const softwareLevel = useGameStore((s) => s.softwareLevel)
  const networkLevel = useGameStore((s) => s.networkLevel)
  const stealthLevel = useGameStore((s) => s.stealthLevel)
  const distributionLevel = useGameStore((s) => s.distributionLevel)
  const syndicateDoctrine = useGameStore((s) => s.syndicateDoctrine)
  const chooseSyndicateDoctrine = useGameStore((s) => s.chooseSyndicateDoctrine)

  const totalLevels = getTotalSkillLevels({
    hardwareLevel,
    softwareLevel,
    networkLevel,
    stealthLevel,
    distributionLevel,
  })

  const eligible = canChooseDoctrine(totalLevels)

  if (syndicateDoctrine) {
    const active = SYNDICATE_DOCTRINES.find((d) => d.id === syndicateDoctrine)
    return (
      <div className="border border-terminal-green/30 bg-terminal-green/5 p-3 font-mono text-xs">
        <p className="font-vt323 text-base text-terminal-green">
          SYNDICATE DOCTRINE
        </p>
        <p className="mt-1 text-sm text-neon-pink">
          {getDoctrineLabel(syndicateDoctrine)}
        </p>
        {active && (
          <>
            <p className="mt-1 text-[10px] text-cyber-cyan/60">
              {active.tagline}
            </p>
            <p className="mt-2 text-[9px] text-terminal-green">
              ✓ {active.bonus}
            </p>
            <p className="text-[9px] text-lobster-red/80">△ {active.tradeoff}</p>
          </>
        )}
        <p className="mt-2 text-[9px] text-cyber-cyan/40">
          Locked until cycle reset
        </p>
      </div>
    )
  }

  if (!eligible) {
    return (
      <div className="border border-cyber-cyan/15 bg-black/40 p-3 font-mono text-xs">
        <p className="font-vt323 text-base text-cyber-cyan/70">
          SYNDICATE DOCTRINE
        </p>
        <p className="mt-1 text-[10px] text-cyber-cyan/50">
          Total skill levels: {totalLevels}/{DOCTRINE_UNLOCK_TOTAL_LEVELS}
        </p>
        <p className="mt-1 text-[9px] text-cyber-cyan/40">
          Reach {DOCTRINE_UNLOCK_TOTAL_LEVELS} combined skill levels to pledge
          allegiance to a syndicate lane.
        </p>
      </div>
    )
  }

  const handleChoose = (doctrine: SyndicateDoctrineId) => {
    const result = chooseSyndicateDoctrine(doctrine)
    if (result.success) {
      toast.success(result.message, { className: 'yami-toast' })
    } else {
      toast.error(result.message, { className: 'yami-toast' })
    }
  }

  return (
    <div className="space-y-2 border border-neon-pink/40 bg-neon-pink/5 p-3 font-mono text-xs">
      <p className="font-vt323 text-base text-neon-pink animate-pulse">
        SYNDICATE DOCTRINE — CHOOSE ONE
      </p>
      <p className="text-[9px] text-cyber-cyan/60">
        Total skill Lv{totalLevels} // permanent for this cycle
      </p>
      {SYNDICATE_DOCTRINES.map((doctrine) => (
        <button
          key={doctrine.id}
          type="button"
          onClick={() => handleChoose(doctrine.id)}
          className="w-full border border-cyber-cyan/25 bg-black/50 p-2 text-left transition hover:border-neon-pink/50 hover:bg-neon-pink/10"
        >
          <p className="font-vt323 text-sm text-cyber-cyan">{doctrine.name}</p>
          <p className="text-[9px] text-cyber-cyan/50">{doctrine.tagline}</p>
          <p className="mt-1 text-[9px] text-terminal-green">{doctrine.bonus}</p>
          <p className="text-[9px] text-lobster-red/70">{doctrine.tradeoff}</p>
        </button>
      ))}
    </div>
  )
}
