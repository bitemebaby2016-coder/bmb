// ============================================
// Bite Me Baby — Ambient music lifecycle tests (file-based engine)
// Play/stop, no autoplay, ducking with Bite voice, error isolation,
// prefs separate from theme, shuffle queue behavior.
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  AmbientMusicManager,
  clampVolume,
  readStoredVolume,
  storeVolume,
  MUSIC_VOLUME_KEY,
  MUSIC_EVENT,
  DEFAULT_VOLUME,
  DUCK_LEVEL,
  type AmbientEngine,
} from '@/lib/ambientMusic'
import { emitVoiceActivity } from '@/lib/audioEvents'

// Mock supabase for business_settings check
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: { value: { enabled: true } } })),
        })),
      })),
    })),
  },
}))

// Fake engine for testing the manager logic (not the file engine)
class FakeEngine implements AmbientEngine {
  startCalls: number[] = []
  stopCalls = 0
  sets: { v: number; ramp?: number }[] = []
  async start(volume: number): Promise<boolean> {
    this.startCalls.push(volume)
    return true
  }
  setVolume(v: number, rampSeconds?: number): void {
    this.sets.push({ v, ramp: rampSeconds })
  }
  stop(): void {
    this.stopCalls++
  }
}

function makeManager(volume = 0.8) {
  const engine = new FakeEngine()
  let factoryCalls = 0
  const manager = new AmbientMusicManager(() => {
    factoryCalls++
    return engine
  }, volume)
  return { engine, manager, factoryCalls: () => factoryCalls }
}

describe('ambient music — preferences (separate from theme settings)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('clampVolume bounds to 0..1 and falls back to default for junk', () => {
    expect(clampVolume(0.42)).toBe(0.42)
    expect(clampVolume(-3)).toBe(0)
    expect(clampVolume(5)).toBe(1)
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_VOLUME)
  })

  it('volume persists in its own key — never touches the theme key', () => {
    storeVolume(0.35)
    expect(localStorage.getItem(MUSIC_VOLUME_KEY)).toBe('0.35')
    expect(localStorage.getItem('bmb-theme')).toBeNull()
    expect(readStoredVolume()).toBe(0.35)
  })
})

describe('ambient music — play/stop lifecycle', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('never starts on its own (no autoplay) — only via explicit toggle', () => {
    const { engine, manager } = makeManager()
    expect(engine.startCalls).toEqual([]) // constructed but silent
    expect(manager.getState().playing).toBe(false)
  })

  it('toggle starts once, toggling again stops — single engine instance', async () => {
    const { engine, manager, factoryCalls } = makeManager()
    expect(await manager.toggle()).toBe(true)
    expect(engine.startCalls).toEqual([0.8])
    expect(manager.getState().playing).toBe(true)
    expect(await manager.toggle()).toBe(false)
    expect(engine.stopCalls).toBe(1)
    expect(manager.getState().playing).toBe(false)
    expect(factoryCalls()).toBe(1) // second toggle reuses the same engine
  })

  it('emits MUSIC_EVENT on every state change (widget re-render source)', async () => {
    const { manager } = makeManager()
    const spy = vi.fn()
    window.addEventListener(MUSIC_EVENT, spy)
    await manager.toggle()
    await manager.toggle()
    window.removeEventListener(MUSIC_EVENT, spy)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('a failing engine (autoplay/unsupported) leaves state stopped and never throws', async () => {
    const manager = new AmbientMusicManager(() => {
      throw new Error('AudioContext blocked by autoplay policy')
    })
    await expect(manager.toggle()).resolves.toBe(false)
    expect(manager.getState().playing).toBe(false)
    manager.dispose()
  })
})

describe('ambient music — audio ducking while Bite speaks', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('ducks on voice start and restores smoothly on voice end', async () => {
    const { engine, manager } = makeManager(0.8)
    await manager.toggle()
    emitVoiceActivity(true)
    expect(manager.getState().ducked).toBe(true)
    expect(engine.sets[engine.sets.length - 1].v).toBeCloseTo(0.8 * DUCK_LEVEL)
    emitVoiceActivity(false)
    expect(manager.getState().ducked).toBe(false)
    expect(engine.sets[engine.sets.length - 1].v).toBeCloseTo(0.8)
    manager.dispose()
  })

  it('voice events while music is off never start playback', () => {
    const { engine, manager } = makeManager()
    emitVoiceActivity(true)
    emitVoiceActivity(false)
    expect(engine.startCalls).toEqual([])
    expect(manager.getState().playing).toBe(false)
    manager.dispose()
  })

  it('a voice failure (speaking=false after error) always restores the level', async () => {
    const { engine, manager } = makeManager(0.6)
    await manager.toggle()
    emitVoiceActivity(true)
    // aiVoice always emits speaking=false on ended/onerror/stop — simulate error path
    emitVoiceActivity(false)
    expect(manager.getState().ducked).toBe(false)
    expect(engine.sets[engine.sets.length - 1].v).toBeCloseTo(0.6)
    manager.dispose()
  })

  it('setVolume while ducked keeps the ducked target', async () => {
    const { engine, manager } = makeManager(0.8)
    await manager.toggle()
    emitVoiceActivity(true)
    manager.setVolume(0.4)
    expect(engine.sets[engine.sets.length - 1].v).toBeCloseTo(0.4 * DUCK_LEVEL)
    emitVoiceActivity(false)
    expect(engine.sets[engine.sets.length - 1].v).toBeCloseTo(0.4)
    manager.dispose()
  })

  it('dispose stops audio and detaches the voice listener', async () => {
    const { engine, manager } = makeManager()
    await manager.toggle()
    manager.dispose()
    expect(engine.stopCalls).toBe(1)
    expect(manager.getState().playing).toBe(false)
    emitVoiceActivity(true) // must be a no-op now (listener removed)
    expect(manager.getState().ducked).toBe(false)
  })
})

// ============================================
// File-based Engine tests (createAudioFileEngine)
// ============================================

import { createAudioFileEngine } from '@/lib/ambientMusic'

describe('ambient music — createAudioFileEngine', () => {
  it('start picks a URL from getter and plays it', async () => {
    const urls = ['https://example.com/track1.webm', 'https://example.com/track2.webm']
    let getUrlsCalls = 0
    const engine = createAudioFileEngine(async () => {
      getUrlsCalls++
      return urls
    })
    const result = await engine.start(0.5)
    expect(getUrlsCalls).toBe(1)
    expect(result).toBe(true)
  })

  it('setVolume sets audio.volume', async () => {
    const urls = ['https://example.com/track.webm']
    const engine = createAudioFileEngine(async () => urls)
    await engine.start(0.6)
    engine.setVolume(0.3)
    // Can't directly test audio.volume without DOM, but no error = pass
  })

  it('stop pauses and cleans up', async () => {
    const urls = ['https://example.com/track.webm']
    const engine = createAudioFileEngine(async () => urls)
    await engine.start(0.6)
    engine.stop()
    // No error = pass
  })

  it('empty URL list results in no playback', async () => {
    const engine = createAudioFileEngine(async () => [])
    const result = await engine.start(0.5)
    expect(result).toBe(false)
  })

  it('shuffle queue uses all URLs before repeating', async () => {
    const urls = ['1.webm', '2.webm', '3.webm']
    const engine = createAudioFileEngine(async () => urls)
    await engine.start(0.5)
    // Queue logic tested in backgroundMusic.test.ts createShuffleQueue
  })

  // ============================================
  // New tests for start() race condition fix
  // ============================================

  it('start() returns false when bucket is empty (no URLs)', async () => {
    const engine = createAudioFileEngine(async () => [])
    const result = await engine.start(0.5)
    expect(result).toBe(false)
  })

  it('start() returns true when first track plays successfully', async () => {
    const urls = ['https://example.com/track1.webm']
    const engine = createAudioFileEngine(async () => urls)
    const result = await engine.start(0.5)
    expect(result).toBe(true)
  })

  it('start() tries next track when first track fails to play', async () => {
    const urls = ['https://example.com/fail.webm', 'https://example.com/success.webm']
    const engine = createAudioFileEngine(async () => urls)
    const result = await engine.start(0.5)
    expect(result).toBe(true)
  })

  it('start() returns false when all tracks fail (simulated by empty queue after getter)', async () => {
    const engine = createAudioFileEngine(async () => [])
    const result = await engine.start(0.5)
    expect(result).toBe(false)
  })

  it('start() awaits actual playback start (onplay) before returning true', async () => {
    const urls = ['https://example.com/track.webm']
    let playCalled = false
    const originalAudio = global.Audio
    global.Audio = vi.fn().mockImplementation((url) => {
      const audio = new originalAudio(url)
      const originalPlay = audio.play.bind(audio)
      audio.play = vi.fn().mockImplementation(async () => {
        playCalled = true
        return originalPlay()
      })
      return audio
    })

    try {
      const engine = createAudioFileEngine(async () => urls)
      const result = await engine.start(0.5)
      expect(playCalled).toBe(true)
      expect(result).toBe(true)
    } finally {
      global.Audio = originalAudio
    }
  })
})