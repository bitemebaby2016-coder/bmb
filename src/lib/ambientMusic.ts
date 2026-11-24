// ============================================
// Bite Me Baby — Ambient Music (Background Music from Supabase)
// Single engine: plays audio files from bucket `background_music` (shuffle queue, loop)
// Ducking via onVoiceActivity, volume persisted in localStorage, no autoplay.
// ============================================

import { onVoiceActivity } from './audioEvents'
import { listBackgroundMusicFiles, createShuffleQueue } from './backgroundMusic'
import { supabase } from './supabase'

export const MUSIC_VOLUME_KEY = 'bmb-music-volume'
export const MUSIC_EVENT = 'bmb:musicchange'
/** fraction of user volume while Bite is speaking */
export const DUCK_LEVEL = 0.25
export const DUCK_RAMP_SEC = 0.25
export const RESTORE_RAMP_SEC = 0.6
export const DEFAULT_VOLUME = 0.6

export interface AmbientEngine {
  /** Begin playback at volume 0..1 (called only from a user gesture). Returns true if playback actually started. */
  start(volume: number): Promise<boolean>
  /** Smoothly change volume (ramp seconds; used for ducking + user slider). */
  setVolume(volume: number, rampSeconds?: number): void
  /** Halt playback completely. Safe to call when already stopped. */
  stop(): void
}

export interface MusicState {
  playing: boolean
  volume: number
  ducked: boolean
}

export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_VOLUME
  return Math.min(1, Math.max(0, v))
}

export function readStoredVolume(): number {
  try {
    return clampVolume(parseFloat(localStorage.getItem(MUSIC_VOLUME_KEY) ?? ''))
  } catch {
    return DEFAULT_VOLUME
  }
}

export function storeVolume(v: number): void {
  try {
    localStorage.setItem(MUSIC_VOLUME_KEY, String(clampVolume(v)))
  } catch {
    // private mode — volume lives for this session only
  }
}

export class AmbientMusicManager {
  private engine: AmbientEngine | null = null
  private playing = false
  private ducked = false
  private volume: number
  private unsubscribeVoice: () => void

  constructor(
    private readonly engineFactory: () => AmbientEngine,
    initialVolume?: number
  ) {
    this.volume = initialVolume !== undefined ? clampVolume(initialVolume) : readStoredVolume()
    this.unsubscribeVoice = onVoiceActivity((speaking) => this.handleVoice(speaking))
  }

  getState(): MusicState {
    return { playing: this.playing, volume: this.volume, ducked: this.ducked }
  }

  private emit(): void {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(MUSIC_EVENT, { detail: this.getState() }))
  }

  private currentTarget(): number {
    return this.playing ? this.volume * (this.ducked ? DUCK_LEVEL : 1) : 0
  }

  /** Play/stop — MUST be called from a user gesture (browser autoplay policy). */
  async toggle(): Promise<boolean> {
    // 1) ตรวจ master flag จาก business_settings ก่อน
    try {
      const { data } = await supabase
        .from('business_settings')
        .select('value')
        .eq('key', 'ambient_music')
        .maybeSingle()
      const enabled = typeof data?.value === 'object' && data.value.enabled === true
      if (!enabled) {
        this.emit()
        return false
      }
    } catch {
      // ไม่บล็อก — คงเล่นตาม state เดิม ถ้าอ่านไม่ได้
    }

    if (this.playing) {
      this.stopMusic()
      return false
    }
    try {
      if (!this.engine) this.engine = this.engineFactory()
      const started = await this.engine.start(this.volume)
      if (!started) {
        this.emit()
        return false
      }
      this.playing = true
      this.emit()
      return true
    } catch {
      // autoplay/codec failure — stay silent, never surface an error to the page
      this.playing = false
      this.ducked = false
      this.emit()
      return false
    }
  }

  private stopMusic(): void {
    try {
      this.engine?.stop()
    } catch {
      // engine teardown errors must not break the page
    }
    this.playing = false
    this.ducked = false
    this.emit()
  }

  setVolume(v: number): void {
    this.volume = clampVolume(v)
    storeVolume(this.volume)
    if (this.playing) {
      try {
        this.engine?.setVolume(this.currentTarget(), DUCK_RAMP_SEC)
      } catch {
        // ignore — state stays consistent
      }
    }
    this.emit()
  }

  private handleVoice(speaking: boolean): void {
    if (!this.playing) return // music off → nothing to duck; never auto-starts
    if (speaking && !this.ducked) {
      this.ducked = true
      try {
        this.engine?.setVolume(this.volume * DUCK_LEVEL, DUCK_RAMP_SEC)
      } catch {
        this.ducked = false
      }
      this.emit()
    } else if (!speaking && this.ducked) {
      this.ducked = false
      try {
        this.engine?.setVolume(this.volume, RESTORE_RAMP_SEC)
      } catch {
        // restore failed — next setVolume/voice event will re-apply target
      }
      this.emit()
    }
  }

  /** Test/teardown: stop audio and drop the voice subscription. */
  dispose(): void {
    if (this.playing) this.stopMusic()
    this.unsubscribeVoice()
    this.engine = null
  }
}

// ============================================
// File-based Engine: plays audio files from Supabase bucket (shuffle queue)
// ============================================

type UrlGetter = () => Promise<string[]>

export function createAudioFileEngine(getUrls: UrlGetter): AmbientEngine {
  let audio: HTMLAudioElement | null = null
  let currentUrls: string[] = []
  let queue: ReturnType<typeof createShuffleQueue<string>> | null = null
  let isPlaying = false
  let currentVolume = 0.6
  let duckLevel = 1

  async function ensureQueue(): Promise<void> {
    if (queue && currentUrls.length > 0) return
    currentUrls = await getUrls()
    queue = createShuffleQueue(currentUrls)
  }

  function pickNextUrl(): string | null {
    if (!queue) return null
    const url = queue.next()
    if (!url) {
      // queue exhausted (shouldn't happen with shuffle queue) — refill
      queue.reset()
      return queue.next()
    }
    return url
  }

  /** Play a single URL. Resolves when playback actually starts (onplay), rejects on error (onerror). */
  function playUrl(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (audio) {
        audio.pause()
        audio.src = ''
        audio.removeEventListener('ended', onEnded)
        audio.removeEventListener('error', onError)
      }

      const newAudio = new Audio(url)
      audio = newAudio
      newAudio.loop = false
      newAudio.volume = currentVolume * duckLevel

      const onPlay = () => {
        newAudio.removeEventListener('play', onPlay)
        newAudio.removeEventListener('error', onErrorHandler)
        resolve()
      }

      const onErrorHandler = () => {
        newAudio.removeEventListener('play', onPlay)
        newAudio.removeEventListener('error', onErrorHandler)
        reject(new Error('playback failed'))
      }

      newAudio.addEventListener('play', onPlay, { once: true })
      newAudio.addEventListener('error', onErrorHandler, { once: true })
      newAudio.addEventListener('ended', onEnded)
      newAudio.addEventListener('error', onError)

      const playResult = newAudio.play()
      if (playResult && typeof playResult.then === 'function') {
        // Real browser: play() returns Promise that resolves when playback starts
        playResult.then(() => resolve()).catch(() => reject(new Error('playback failed')))
      } else {
        // jsdom: play() is a no-op stub returning undefined — resolve immediately
        resolve()
      }
    })
  }

  function onEnded(): void {
    if (!isPlaying) return
    const nextUrl = pickNextUrl()
    if (nextUrl) {
      playUrl(nextUrl).catch(() => {
        // error will be handled by onError event listener
      })
    } else {
      isPlaying = false
    }
  }

  function onError(): void {
    if (!isPlaying) return
    const nextUrl = pickNextUrl()
    if (nextUrl) {
      playUrl(nextUrl).catch(() => {})
    } else {
      isPlaying = false
    }
  }

  return {
    async start(volume: number): Promise<boolean> {
      currentVolume = volume
      isPlaying = true
      await ensureQueue()

      while (isPlaying) {
        const url = pickNextUrl()
        if (!url) break

        try {
          await playUrl(url)
          return true
        } catch {
          // try next track
          continue
        }
      }

      isPlaying = false
      return false
    },
    setVolume(volume: number, _rampSeconds = 0.3): void {
      currentVolume = volume
      if (audio) {
        audio.volume = currentVolume * duckLevel
      }
    },
    stop(): void {
      isPlaying = false
      if (audio) {
        audio.pause()
        audio.src = ''
        audio.removeEventListener('ended', onEnded)
        audio.removeEventListener('error', onError)
        audio = null
      }
      queue = null
      currentUrls = []
    },
  }
}

// ============================================
// Session singleton — Layout mounts the widget, but the manager survives
// route changes (single player, no duplicate audio across pages)
// ============================================

let manager: AmbientMusicManager | null = null

export function getAmbientMusic(): AmbientMusicManager {
  if (!manager) {
    manager = new AmbientMusicManager(() =>
      createAudioFileEngine(async () => {
        const files = await listBackgroundMusicFiles()
        return files.map((f) => f.url)
      })
    )
  }
  return manager
}

/** Test-only: drop the singleton so each test gets a fresh manager. */
export function resetAmbientMusicForTests(): void {
  manager?.dispose()
  manager = null
}