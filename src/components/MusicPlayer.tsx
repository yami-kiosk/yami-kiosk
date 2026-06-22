import { useCallback, useEffect, useRef, useState } from 'react'

const PLAYLIST = [
  { id: 'music1', src: '/music.mp3', label: '01' },
  { id: 'music2', src: '/music2.mp3', label: '02' },
  { id: 'music3', src: '/music3.mp3', label: '03' },
  { id: 'music4', src: '/music4.mp3', label: '04' },
] as const

const VOLUME_STORAGE_KEY = 'yami-music-volume'
const TRACK_STORAGE_KEY = 'yami-music-track'
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

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(loadStoredVolume)
  const [trackIndex, setTrackIndex] = useState(loadStoredTrackIndex)

  const track = PLAYLIST[trackIndex]

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.loop = true
    audio.volume = volume
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const wasPlaying = !audio.paused
    audio.pause()
    audio.src = track.src
    audio.load()

    if (wasPlaying) {
      void audio.play().catch(() => setPlaying(false))
    }
  }, [track.src])

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

  const changeTrack = useCallback(
    (delta: number) => {
      setTrackIndex((current) => {
        const next = (current + delta + PLAYLIST.length) % PLAYLIST.length
        saveTrackIndex(next)
        return next
      })
    },
    [],
  )

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
        src={track.src}
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
