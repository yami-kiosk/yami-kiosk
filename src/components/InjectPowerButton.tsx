import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  formatRateShort,
  getLiveComboCount,
  getNextClickYen,
  useRateState,
} from '../lib/effectiveRates'
import { useGameStore } from '../store/useGameStore'

interface YenFloat {
  id: number
  amount: number
  x: number
}

const MAX_FLOATS = 14
const FLOAT_DURATION_MS = 900

function formatClickYen(value: number): string {
  return formatRateShort(value)
}

export function InjectPowerButton() {
  const injectPower = useGameStore((s) => s.injectPower)
  const powerRestore = useGameStore((s) => s.powerRestoreOnClick)
  const rateState = useRateState()

  const [now, setNow] = useState(() => Date.now())
  const [floats, setFloats] = useState<YenFloat[]>([])
  const nextId = useRef(0)
  const handleInjectRef = useRef<(trusted: boolean) => void>(() => {})

  const yenPerClick = getNextClickYen(rateState, now)
  const liveCombo = getLiveComboCount(rateState, now)

  const handleInject = useCallback(
    (trusted = true) => {
      if (!trusted) {
        toast.error('UNTRUSTED INPUT — inject rejected.', {
          className: 'yami-toast',
        })
        return
      }

      const result = injectPower()

      if (result.shouldWarn && result.message) {
        toast.error(result.message, { className: 'yami-toast' })
      }

      if (result.grantedYen <= 0) return

      const id = nextId.current++
      const x = Math.round((Math.random() - 0.5) * 56)

      setFloats((prev) => {
        const next = [...prev, { id, amount: result.grantedYen, x }]
        return next.length > MAX_FLOATS ? next.slice(-MAX_FLOATS) : next
      })

      window.setTimeout(() => {
        setFloats((prev) => prev.filter((particle) => particle.id !== id))
      }, FLOAT_DURATION_MS)
    },
    [injectPower],
  )

  handleInjectRef.current = handleInject

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'b') return
      if (event.repeat) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      handleInjectRef.current(event.isTrusted)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-full">
        {floats.map((particle) => (
          <span
            key={particle.id}
            className="yen-float-particle pointer-events-none absolute left-1/2 top-1/2 z-10 font-vt323 text-lg tracking-wide text-terminal-green md:text-xl"
            style={{ ['--drift-x' as string]: `${particle.x}px` }}
          >
            +{formatClickYen(particle.amount)} $YEN
          </span>
        ))}

        <button
          type="button"
          onClick={(event) => handleInject(event.isTrusted)}
          className="group relative w-full px-4 py-3 font-vt323 text-base tracking-widest md:text-lg inject-btn glow-hover-pink"
        >
          <span className="absolute left-1.5 top-0.5 font-mono text-[8px] text-cyber-cyan/50">
            [ EXEC ]
          </span>
          INJECT POWER [BYPASS]
          <span className="absolute bottom-0.5 right-1.5 font-mono text-[8px] text-cyber-cyan/50">
            [ B ]
          </span>
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 font-mono text-[9px] text-cyber-cyan/60">
        <span>+{formatClickYen(yenPerClick)} $YEN/click</span>
        {liveCombo > 0 ? (
          <span className="text-terminal-green">combo ×{liveCombo}</span>
        ) : null}
        <span>+{powerRestore.toFixed(1)}% restore</span>
      </div>
    </div>
  )
}
