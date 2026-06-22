import { useCallback, useEffect, useRef, useState } from 'react'

const PLAYLIST = [
  { id: 'music1', src: '/music.mp3', label: '01' },
  { id: 'music2', src: '/music2.mp3', label: '02' },
  { id: 'music3', src: '/music3.mp3', label: '03' },
  { id: 'music4', src: '/music4.mp3', label: '04' },
] as const

const VOLUME_STORAGE_KEY = 'yami-music-volume'
const TRACK_STORAGE_KEY = 'yami-music-track'
const AUTOPLAY_KEY = 'yami-music-autoplay'
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

function loadStoredTrackIndex(): number {
  try {
    const raw = localStorage.getItem(TRACK_STORAGE_KEY)
    if (raw == null) return 0
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed)) return 0
    return Math.min(PLAYLIST.length - 1, Math.max(0, parsed))
  } catch {
    return 0
  }
}

function loadAutoplayPreference(): boolean {
  try {
    const raw = localStorage.getItem(AUTOPLAY_KEY)
    return raw !== '0'
  } catch {
    return true
  }
}

function saveVolume(volume: number): void {
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, String(volume))
  } catch {
    /* ignore */
  }
}

function saveTrackIndex(index: number): void {
  try {
    localStorage.setItem(TRACK_STORAGE_KEY, String(index))
  } catch {
    /* ignore */
  }
}

function saveAutoplayPreference(enabled: boolean): void {
  try {
    localStorage.setItem(AUTOPLAY_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const wantPlayRef = useRef(loadAutoplayPreference())
  const unlockBoundRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(loadStoredVolume)
  const [trackIndex, setTrackIndex] = useState(loadStoredTrackIndex)

  const track = PLAYLIST[trackIndex]

  const applyAudioSettings = useCallback(
    (audio: HTMLAudioElement) => {
      audio.loop = true
      audio.preload = 'auto'
      audio.volume = volume
      audio.muted = false
    },
    [volume],
  )

  const attemptPlay = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current
    if (!audio) return false

    applyAudioSettings(audio)

    try {
      await audio.play()
      wantPlayRef.current = true
      saveAutoplayPreference(true)
      setPlaying(true)
      return true
    } catch {
      try {
        audio.muted = true
        await audio.play()
        audio.muted = false
        audio.volume = volume
        wantPlayRef.current = true
        saveAutoplayPreference(true)
        setPlaying(true)
        return true
      } catch {
        setPlaying(false)
        return false
      }
    }
  }, [applyAudioSettings, volume])

  const bindAudioRef = useCallback(
    (node: HTMLAudioElement | null) => {
      audioRef.current = node
      if (!node) return

      applyAudioSettings(node)

      if (wantPlayRef.current) {
        void node.play().then(
          () => setPlaying(true),
          () => setPlaying(false),
        )
      }
    },
    [applyAudioSettings],
  )

  useEffect(() => {
    const audio = audioRef.current
    if (audio) applyAudioSettings(audio)
  }, [volume, applyAudioSettings])

  useEffect(() => {
    if (!wantPlayRef.current) return

    const audio = audioRef.current
    if (!audio) return

    applyAudioSettings(audio)
    void audio.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    )
  }, [trackIndex, applyAudioSettings])

  useEffect(() => {
    if (unlockBoundRef.current) return
    unlockBoundRef.current = true

    void attemptPlay()

    const unlock = () => {
      void attemptPlay()
    }

    document.addEventListener('pointerdown', unlock, { once: true })
    return () => document.removeEventListener('pointerdown', unlock)
  }, [attemptPlay])

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      wantPlayRef.current = false
      saveAutoplayPreference(false)
      setPlaying(false)
      return
    }

    await attemptPlay()
  }, [playing, attemptPlay])

  const changeTrack = useCallback((delta: number) => {
    setTrackIndex((current) => {
      const next = (current + delta + PLAYLIST.length) % PLAYLIST.length
      saveTrackIndex(next)
      return next
    })
  }, [])

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
        key={track.id}
        ref={bindAudioRef}
        src={track.src}
        loop
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          console.warn('[music] failed to load', track.src)
          setPlaying(false)
        }}
      />

      <div
        className="music-player fixed bottom-3 right-3 z-[120] flex flex-col items-end gap-1.5"
        aria-label="Background music controls"
      >
        <p className="font-mono text-[8px] tracking-[0.2em] text-cyber-cyan/40">
          SYNDICATE AUDIO · TRK {track.label}/{PLAYLIST.length.toString().padStart(2, '0')}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-1 border border-cyber-cyan/25 bg-black/80 px-1.5 py-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => changeTrack(-1)}
            className="terminal-btn glow-hover-cyan border border-cyber-cyan/35 px-2 py-1 font-mono text-[9px] text-cyber-cyan hover:text-neon-pink"
            aria-label="Previous track"
          >
            [ ◀◀ ]
          </button>
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
            onClick={() => changeTrack(1)}
            className="terminal-btn glow-hover-cyan border border-cyber-cyan/35 px-2 py-1 font-mono text-[9px] text-cyber-cyan hover:text-neon-pink"
            aria-label="Next track"
          >
            [ ▶▶ ]
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
