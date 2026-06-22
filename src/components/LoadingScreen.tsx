import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ensureOperatorSyncedToRemote,
  getRegisteredNameForWallet,
  resolveRegisteredNameForWallet,
} from '../lib/operatorRegistry'
import {
  OPERATOR_NAME_MAX,
  OPERATOR_NAME_MIN,
  isValidOperatorName,
  sanitizeOperatorName,
} from '../lib/operatorName'
import { isSupabaseConfigured, getSupabaseConfigHint } from '../lib/supabase/client'
import { useSupabaseStatus } from '../hooks/useSupabaseStatus'
import { useGameStore } from '../store/useGameStore'

const MIN_ANIMATION_MS = 2_000

interface LoadingScreenProps {
  variant?: 'boot' | 'bypass'
  ready?: boolean
  onEnter?: () => void
}

export function LoadingScreen({
  variant = 'bypass',
  ready = false,
  onEnter,
}: LoadingScreenProps) {
  const walletPublicKey = useGameStore((s) => s.walletPublicKey)
  const savedOperatorName = useGameStore((s) => s.operatorName)
  const registerOperatorName = useGameStore((s) => s.registerOperatorName)

  const [animationDone, setAnimationDone] = useState(false)
  const [draftName, setDraftName] = useState(savedOperatorName)
  const [error, setError] = useState<string | null>(null)
  const [lockedName, setLockedName] = useState<string | null>(() =>
    getRegisteredNameForWallet(walletPublicKey),
  )
  const [submitting, setSubmitting] = useState(false)

  const { status: networkStatus, message: networkMessage } = useSupabaseStatus(
    variant === 'bypass',
  )

  const isLocked = Boolean(lockedName)

  useEffect(() => {
    if (!walletPublicKey) return
    void resolveRegisteredNameForWallet(walletPublicKey).then((name) => {
      if (name) setLockedName(name)
    })
  }, [walletPublicKey])

  useEffect(() => {
    setDraftName(lockedName ?? savedOperatorName)
  }, [lockedName, savedOperatorName])

  useEffect(() => {
    if (variant === 'boot') {
      setAnimationDone(true)
      return
    }

    setAnimationDone(false)
    const timer = setTimeout(() => setAnimationDone(true), MIN_ANIMATION_MS)
    return () => clearTimeout(timer)
  }, [variant])

  const canEnter = ready && animationDone && !submitting
  const nameValid = isValidOperatorName(isLocked ? (lockedName ?? '') : draftName)

  const handleNameChange = (value: string) => {
    if (isLocked) return
    setError(null)
    setDraftName(sanitizeOperatorName(value))
  }

  const handleEnter = async () => {
    if (!nameValid || !onEnter || !walletPublicKey) return

    if (isLocked && lockedName) {
      if (!isSupabaseConfigured()) {
        onEnter()
        return
      }

      setSubmitting(true)
      setError(null)
      try {
        const sync = await ensureOperatorSyncedToRemote(walletPublicKey)
        if (sync?.success) {
          setLockedName(sync.name)
          toast.success(`Operator ${sync.name} synced to syndicate network.`, {
            className: 'yami-toast',
          })
          onEnter()
          return
        }
        if (sync && !sync.success) {
          setError(sync.message)
          toast.error(sync.message, {
            className: 'yami-toast',
            duration: 8000,
          })
          return
        }
        onEnter()
      } finally {
        setSubmitting(false)
      }
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const result = await registerOperatorName(draftName)
      if (!result.success) {
        setError(result.message)
        return
      }
      if (result.localOnly) {
        toast.warning('Handle saved on this device only — not on syndicate network.', {
          description:
            'Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY on Vercel, redeploy, then refresh.',
          className: 'yami-toast',
          duration: 8000,
        })
      } else {
        toast.success(`Operator ${result.name} registered on syndicate network.`, {
          className: 'yami-toast',
        })
      }
      setLockedName(result.name)
      onEnter()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="loading-screen fixed inset-0 z-[100] flex min-h-svh w-full flex-col items-center justify-center bg-black px-4 scanlines">
      <div
        className="font-vt323 text-7xl text-neon-pink animate-flash md:text-9xl"
        aria-live="polite"
      >
        ヤミ!
      </div>

      {variant === 'boot' && !canEnter && (
        <p className="mt-6 font-mono text-sm tracking-[0.4em] text-cyber-cyan animate-pulse">
          YAMI KIOSK // ヤミキオスク
        </p>
      )}

      {variant === 'bypass' && !canEnter && (
        <p className="mt-6 font-mono text-xs tracking-[0.25em] text-cyber-cyan/50 animate-pulse">
          [ INITIALIZING BURNER NODE... ]
        </p>
      )}

      {canEnter && onEnter && (
        <div className="mt-10 flex w-full max-w-sm flex-col items-center gap-4">
          <div className="w-full">
            <label
              htmlFor="operator-handle"
              className="mb-2 block text-center font-mono text-[10px] tracking-[0.3em] text-cyber-cyan/60"
            >
              {'>'} OPERATOR HANDLE // SYNDICATE ID
            </label>
            <input
              id="operator-handle"
              type="text"
              value={isLocked ? (lockedName ?? '') : draftName}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nameValid && !submitting) {
                  void handleEnter()
                }
              }}
              placeholder="NEON_RONIN"
              maxLength={OPERATOR_NAME_MAX}
              autoComplete="off"
              spellCheck={false}
              readOnly={isLocked}
              className={`w-full border bg-black/60 px-4 py-3 text-center font-mono text-sm tracking-widest placeholder:text-cyber-cyan/25 focus:outline-none ${
                isLocked
                  ? 'cursor-not-allowed border-terminal-green/40 text-terminal-green'
                  : 'border-cyber-cyan/40 text-terminal-green focus:border-neon-pink'
              }`}
            />
            {isLocked ? (
              <p className="mt-2 text-center font-mono text-[9px] text-terminal-green/70">
                1 HANDLE · 1 BURNER NODE — locked to this account
              </p>
            ) : (
              <>
                <p className="mt-2 text-center font-mono text-[9px] text-cyber-cyan/40">
                  {OPERATOR_NAME_MIN}–{OPERATOR_NAME_MAX} chars · A–Z 0–9 _ ·
                  permanent
                  {isSupabaseConfigured()
                    ? networkStatus === 'online'
                      ? ' · global registry LIVE'
                      : networkStatus === 'checking'
                        ? ' · connecting to syndicate…'
                        : ' · syndicate offline (local fallback)'
                    : ` · local only — ${getSupabaseConfigHint() ?? 'add .env.local'}`}
                </p>
                {networkStatus === 'offline' && networkMessage ? (
                  <p className="mt-1 text-center font-mono text-[8px] text-lobster-red/80">
                    {networkMessage}
                  </p>
                ) : null}
              </>
            )}
            {error ? (
              <p className="mt-2 text-center font-mono text-[9px] text-neon-pink">
                {error}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void handleEnter()}
            disabled={!nameValid || submitting}
            className="landing-enter-btn enter-alley-btn px-10 py-4 font-vt323 text-2xl tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'REGISTERING...' : 'ENTER TO ALLEY'}
          </button>
        </div>
      )}
    </div>
  )
}
