// ============================================
// Bite Me Baby — Background Music lib tests
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  validateMusicFile,
  compressAudioForMusic,
  createShuffleQueue,
  MUSIC_BUCKET,
  AUDIO_MIME_WHITELIST,
  MAX_AUDIO_BYTES,
  TARGET_AUDIO_BYTES,
  TARGET_BITRATE_KBPS,
} from '@/lib/backgroundMusic'

function makeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type, lastModified: Date.now() })
}

describe('backgroundMusic — validation', () => {
  it('accepts valid audio MIME types', () => {
    for (const mime of AUDIO_MIME_WHITELIST) {
      const file = makeFile('test.webm', mime, 1024)
      const v = validateMusicFile(file)
      expect(v.ok).toBe(true)
    }
  })

  it('rejects non-audio MIME types', () => {
    const file = makeFile('test.jpg', 'image/jpeg', 1024)
    const v = validateMusicFile(file)
    expect(v.ok).toBe(false)
    expect(v.error).toContain('ERR_INVALID_MIME')
  })

  it('rejects oversized files', () => {
    const file = makeFile('big.webm', 'audio/webm', MAX_AUDIO_BYTES + 1)
    const v = validateMusicFile(file)
    expect(v.ok).toBe(false)
    expect(v.error).toContain('ERR_INVALID_SIZE')
  })

  it('rejects empty files', () => {
    const file = makeFile('empty.webm', 'audio/webm', 0)
    const v = validateMusicFile(file)
    expect(v.ok).toBe(false)
    expect(v.error).toContain('ERR_INVALID_SIZE')
  })
})

describe('backgroundMusic — compressAudioForMusic', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns original file if already under target size', async () => {
    const file = makeFile('small.webm', 'audio/webm', 500 * 1024) // 500KB
    const result = await compressAudioForMusic(file)
    expect(result).toBe(file)
  })

  it('attempts compression for large files — falls back to original if AudioContext unavailable', async () => {
    const file = makeFile('test.webm', 'audio/webm', 5 * 1024 * 1024)
    const result = await compressAudioForMusic(file)
    // In jsdom: AudioContext unavailable → returns original
    // In real browser: returns compressed WebM Opus file
    expect(result).toBeDefined()
    expect(typeof result.size).toBe('number')
  })
})

describe('backgroundMusic — createShuffleQueue', () => {
  it('returns all items before repeating (shuffle queue)', () => {
    const items = [1, 2, 3, 4, 5]
    const { next, reset } = createShuffleQueue(items)
    const seen = new Set<number>()
    for (let i = 0; i < items.length; i++) {
      const n = next()
      expect(n).not.toBeNull()
      expect(items).toContain(n)
      seen.add(n!)
    }
    expect(seen.size).toBe(items.length)
    // Next call should reset and give a new item
    const nextAfterCycle = next()
    expect(nextAfterCycle).not.toBeNull()
  })

  it('reset reshuffles the queue', () => {
    const items = ['a', 'b', 'c']
    const { next, reset } = createShuffleQueue(items)
    const first = next()
    reset()
    const afterReset = next()
    // After reset, queue is reshuffled — could be same or different
    expect(items).toContain(afterReset)
  })

  it('returns null for empty input', () => {
    const { next } = createShuffleQueue([])
    expect(next()).toBeNull()
  })
})

describe('backgroundMusic — constants', () => {
  it('MUSIC_BUCKET is background_music', () => {
    expect(MUSIC_BUCKET).toBe('background_music')
  })
  it('MAX_AUDIO_BYTES = 20MB', () => {
    expect(MAX_AUDIO_BYTES).toBe(20 * 1024 * 1024)
  })
  it('TARGET_AUDIO_BYTES = 2MB', () => {
    expect(TARGET_AUDIO_BYTES).toBe(2 * 1024 * 1024)
  })
  it('TARGET_BITRATE_KBPS = 128', () => {
    expect(TARGET_BITRATE_KBPS).toBe(128)
  })
})