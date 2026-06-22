import { useCallback, useEffect, useRef, useState } from 'react'

const MUSIC_SRC = '/music.mp3'
const VOLUME_STORAGE_KEY = 'yami-music-volume'
const VOLUME_STEP = 0.1
const DEFAULT_VOLUME = 0.5

function loadStoredVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (raw == null) return DEFAULT_VOLUME
    const parsed = Number.parseFloat(raw)
    if (!Number.isFinite(parsed)) return DEFAULT_VOLUME
    return Math.min(1, Math.max(0, parsed))
  } catch {
    return DEFAULT_VOLUME
  }
}

function saveVolume(volume: number): void {
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, String(volume))
  } catch {
    /* ignore */
  }
}

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(loadStoredVolume)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.loop = true
    audio.volume = volume
  }, [volume])

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }

    try {
      await audio.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }, [playing])

  const volumeUp = useCallback(() => {
    setVolume((current) => {
      const next = Math.min(1, Math.round((current + VOLUME_STEP) * 10) / 10)
      saveVolume(next)
      return next
    })
  }, [])

  const volumeDown = useCallback(() => {
    setVolume((current) => {
      const next = Math.max(0, Math.round((current - VOLUME_STEP) * 10) / 10)
      saveVolume(next)
      return next
    })
  }, [])

  const volumeLabel = `${Math.round(volume * 100)}%`

  return (
    <>
      <audio
        ref={audioRef}
        src={MUSIC_SRC}
        preload="auto"
        loop
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <div
        className="music-player fixed bottom-3 right-3 z-[120] flex flex-col items-end gap-1.5"
        aria-label="Background music controls"
      >
        <p className="font-mono text-[8px] tracking-[0.2em] text-cyber-cyan/40">
          SYNDICATE AUDIO
        </p>
        <div className="flex items-center gap-1 border border-cyber-cyan/25 bg-black/80 px-1.5 py-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => void togglePlay()}
            className="terminal-btn glow-hover-cyan border border-cyber-cyan/35 px-2 py-1 font-mono text-[9px] text-terminal-green hover:text-neon-pink"
            aria-label={playing ? 'Pause music' : 'Play music'}
          >
            {playing ? '[ ❚❚ ]' : '[ ▶ ]'}
          </button>
          <button
            type="button"
            onClick={volumeDown}
            disabled={volume <= 0}
            className="terminal-btn glow-hover-cyan border border-cyber-cyan/35 px-2 py-1 font-mono text-[9px] text-cyber-cyan disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Volume down"
          >
            [ VOL− ]
          </button>
          <span className="min-w-[2.25rem] text-center font-mono text-[9px] text-cyber-cyan/70">
            {volumeLabel}
          </span>
          <button
            type="button"
            onClick={volumeUp}
            disabled={volume >= 1}
            className="terminal-btn glow-hover-cyan border border-cyber-cyan/35 px-2 py-1 font-mono text-[9px] text-cyber-cyan disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Volume up"
          >
            [ VOL+ ]
          </button>
        </div>
      </div>
    </>
  )
}
