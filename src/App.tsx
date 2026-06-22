import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { GameScreen } from './components/GameScreen'
import { LandingPage } from './components/LandingPage'
import { LoadingScreen } from './components/LoadingScreen'
import { MusicPlayer } from './components/MusicPlayer'
import { SeasonEndModal } from './components/SeasonEndModal'
import { getOfflineReturnToast } from './lib/offlineToast'
import { useCycleScoreSync } from './hooks/useCycleScoreSync'
import { TICK_INTERVAL_MS } from './store/gameConfig'
import { useGameStore } from './store/useGameStore'

type Screen = 'landing' | 'loading' | 'game'

function App() {
  const [screen, setScreen] = useState<Screen>('landing')

  const isHydrated = useGameStore((s) => s.isHydrated)
  const isWalletReady = useGameStore((s) => s.isWalletReady)
  const applyOfflineProgress = useGameStore((s) => s.applyOfflineProgress)
  const initWallet = useGameStore((s) => s.initWallet)
  const tick = useGameStore((s) => s.tick)
  const syncSeason = useGameStore((s) => s.syncSeason)
  const pendingSeasonEndModal = useGameStore((s) => s.pendingSeasonEndModal)
  const dismissSeasonEndModal = useGameStore((s) => s.dismissSeasonEndModal)

  const kioskReady = isHydrated && isWalletReady

  const handleEnterKiosk = () => {
    setScreen('loading')
  }

  const handleEnterAlley = () => {
    setScreen('game')
  }

  const handleExitToLanding = () => {
    setScreen('landing')
  }

  const offlineToastShown = useRef(false)
  const seasonSynced = useRef(false)

  useEffect(() => {
    if (!isHydrated) {
      seasonSynced.current = false
      return
    }
    if (seasonSynced.current) return
    seasonSynced.current = true

    void syncSeason()
      .then((result) => {
        if (result.entitlementError) {
          toast.error(result.entitlementError, { className: 'yami-toast' })
        }
        if (
          result.rolledOver &&
          result.modal?.payoutYami &&
          result.modal.payoutYami > 0
        ) {
          toast.success(
            `Cycle ${result.modal.seasonId} · Rank #${result.modal.rank}: +${result.modal.payoutYami.toLocaleString()} $YAMI`,
            { className: 'yami-toast' },
          )
        }
      })
      .catch((err: unknown) => {
        seasonSynced.current = false
        const message =
          err instanceof Error ? err.message : 'Season rollover failed.'
        toast.error(message, { className: 'yami-toast' })
      })
  }, [isHydrated, syncSeason])

  useEffect(() => {
    if (screen !== 'game' || !isHydrated) {
      offlineToastShown.current = false
      return
    }

    if (offlineToastShown.current) return
    offlineToastShown.current = true

    const result = applyOfflineProgress()
    const payload = getOfflineReturnToast(result)
    if (!payload) return

    const toastOpts = { className: 'yami-toast' }
    if (payload.variant === 'error') {
      toast.error(payload.message, toastOpts)
    } else {
      toast.success(payload.message, toastOpts)
    }
  }, [screen, isHydrated, applyOfflineProgress])

  useEffect(() => {
    if (screen !== 'loading') return
    initWallet()
  }, [screen, initWallet])

  useEffect(() => {
    document.body.classList.toggle('game-active', screen === 'game')
    return () => document.body.classList.remove('game-active')
  }, [screen])

  useEffect(() => {
    if (screen !== 'game' || !isHydrated) return

    const interval = setInterval(() => {
      tick()
    }, TICK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [screen, isHydrated, tick])

  useCycleScoreSync(screen === 'game' && isHydrated)

  let screenContent: ReactNode

  if (screen === 'landing') {
    screenContent = (
      <div key="landing" className="screen-enter">
        <LandingPage onEnter={handleEnterKiosk} />
      </div>
    )
  } else if (screen === 'loading' || (screen === 'game' && !kioskReady)) {
    screenContent = (
      <LoadingScreen
        variant={screen === 'loading' ? 'bypass' : 'boot'}
        ready={kioskReady}
        onEnter={handleEnterAlley}
      />
    )
  } else {
    screenContent = (
      <div key="game" className="screen-enter h-svh overflow-hidden">
        <GameScreen onExit={handleExitToLanding} />
        {pendingSeasonEndModal ? (
          <SeasonEndModal
            data={pendingSeasonEndModal}
            onDismiss={dismissSeasonEndModal}
          />
        ) : null}
      </div>
    )
  }

  return (
    <>
      {screenContent}
      <MusicPlayer />
    </>
  )
}

export default App
