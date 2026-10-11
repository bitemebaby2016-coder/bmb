// ============================================
// Bite Me Baby — Ambient Music (lo-fi instrumental สำหรับเลือกเมนู)
// ============================================
// - ไม่มีเนื้อร้อง: สังเคราะห์ pad บรรเลงด้วย WebAudio ตอนผู้ใช้กดเปิด
//   (ไม่ใช้ไฟล์เพลงภายนอก → ไม่มีปัญหาลิขสิทธิ์ ไม่โหลดไฟล์ใหญ่ตั้งแต่หน้าแรก)
// - Singleton ต่อ session: engine สร้างตอนกดเปิดครั้งแรกเท่านั้น (user gesture
//   = ไม่ autoplay) — เปลี่ยนหน้าใน SPA ไม่สร้าง player ซ้ำ
// - Ducking: ฟัง VOICE_ACTIVITY_EVENT จาก pipeline เสียงเดิม (aiVoice) —
//   Bite พูด → ลดเสียงเพลงชั่วคราว → พูดจบ/พัง → คืนระดับ (ไม่เคยเปิดเพลงเอง)
// - Preference: ระดับเสียงเก็บใน localStorage แยกจากธีม (bmb-theme)
// ============================================

import { onVoiceActivity } from './audioEvents'

export const MUSIC_VOLUME_KEY = 'bmb-music-volume'
export const MUSIC_EVENT = 'bmb:musicchange'
/** fraction of user volume while Bite is speaking */
export const DUCK_LEVEL = 0.25
export const DUCK_RAMP_SEC = 0.25
export const RESTORE_RAMP_SEC = 0.6
export const DEFAULT_VOLUME = 0.6

export interface AmbientEngine {
  /** Begin playback at volume 0..1 (called only from a user gesture). */
  start(volume: number): void
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
    // Subscribe once at the singleton level — component remounts never stack listeners
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
    if (this.playing) {
      this.stopMusic()
      return false
    }
    try {
      if (!this.engine) this.engine = this.engineFactory()
      this.engine.start(this.volume)
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
// -----------------------------------------------
// Default engine: generative lo-fi chord pad (WebAudio)
// Instrumental by construction — warm sine/triangle pads, lowpass,
// slow crossfaded 4-chord loop. Royalty-free: generated by our own code.
// -----------------------------------------------
const CHORDS_HZ: number[][] = [
  [261.63, 329.63, 392.0, 493.88], // Cmaj7
  [220.0, 261.63, 329.63, 392.0], // Am7
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [196.0, 246.94, 293.66, 392.0], // G
]
const CHORD_MS = 8000
const FADE_SEC = 2.2

export function createWebAudioAmbient(): AmbientEngine {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let chordIndex = 0
  let active: { osc: OscillatorNode; gain: GainNode }[] = []

  function stopChord(fadeSeconds: number): void {
    if (!ctx) return
    const now = ctx.currentTime
    for (const v of active) {
      try {
        v.gain.gain.cancelScheduledValues(now)
        v.gain.gain.setTargetAtTime(0, now, fadeSeconds / 3)
        v.osc.stop(now + fadeSeconds)
      } catch {
        // already stopped
      }
    }
    active = []
  }

  function playChord(notes: number[]): void {
    if (!ctx || !master) return
    const now = ctx.currentTime
    for (const hz of notes) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = hz
      osc.detune.value = (Math.random() - 0.5) * 6 // gentle analog-style spread
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.06, now + FADE_SEC * 0.5)
      osc.connect(gain)
      gain.connect(master)
      osc.start(now)
      active.push({ osc, gain })
    }
    // soft top layer for air (triangle, quieter)
    const air = ctx.createOscillator()
    air.type = 'triangle'
    air.frequency.value = notes[notes.length - 1] * 2
    const airGain = ctx.createGain()
    airGain.gain.setValueAtTime(0, now)
    airGain.gain.linearRampToValueAtTime(0.015, now + FADE_SEC)
    air.connect(airGain)
    airGain.connect(master)
    air.start(now)
    active.push({ osc: air, gain: airGain })
  }

  function teardown(fadeSeconds: number): void {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
    stopChord(fadeSeconds)
    const closing = ctx
    const g = master
    ctx = null
    master = null
    if (closing && g) {
      const now = closing.currentTime
      try {
        g.gain.cancelScheduledValues(now)
        g.gain.setTargetAtTime(0, now, fadeSeconds / 3)
        closing.close().catch(() => undefined)
      } catch {
        // closing twice — ignore
      }
    }
  }

  return {
    start(volume: number): void {
      const AC: typeof AudioContext | undefined =
        typeof window !== 'undefined'
          ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined
      if (!AC) throw new Error('WebAudio not supported')
      teardown(0.05) // clean any previous instance (remount safety)
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 0
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1600
      filter.Q.value = 0.4
      master.connect(filter)
      filter.connect(ctx.destination)
      chordIndex = 0
      playChord(CHORDS_HZ[chordIndex])
      timer = setInterval(() => {
        if (!ctx) return
        stopChord(FADE_SEC)
        chordIndex = (chordIndex + 1) % CHORDS_HZ.length
        playChord(CHORDS_HZ[chordIndex])
      }, CHORD_MS)
      // resume if browser suspended the context (autoplay policy)
      void ctx.resume?.().catch(() => undefined)
      const now = ctx.currentTime
      master.gain.linearRampToValueAtTime(clampVolume(volume), now + 1.4)
    },
    setVolume(volume: number, rampSeconds = 0.3): void {
      if (!ctx || !master) return
      const now = ctx.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(clampVolume(volume), now + Math.max(0.01, rampSeconds))
    },
    stop(): void {
      teardown(FADE_SEC > 1 ? 1 : FADE_SEC)
    },
  }
}

// -----------------------------------------------
// Session singleton — Layout mounts the widget, but the manager survives
// route changes (single player, no duplicate audio across pages)
// -----------------------------------------------
let manager: AmbientMusicManager | null = null

export function getAmbientMusic(): AmbientMusicManager {
  if (!manager) manager = new AmbientMusicManager(() => createWebAudioAmbient())
  return manager
}

/** Test-only: drop the singleton so each test gets a fresh manager. */
export function resetAmbientMusicForTests(): void {
  manager?.dispose()
  manager = null
}
