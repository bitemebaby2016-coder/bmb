# Ambient Music Engine Race Condition Fix

## Problem Summary

`createAudioFileEngine.start()` returns `true` immediately after calling `playUrl()`, but `audio.play()` is async and can fail (CORS, 404, codec, network). The manager sets `playing = true` and UI shows "playing" while no sound is produced.

## Root Cause Location

`src/lib/ambientMusic.ts` lines 247-259 (`createAudioFileEngine` → `start()` method)

## Required Changes

### 1. Modify `playUrl()` to return `Promise<void>`
- Resolve on `onplay` event (audio actually started)
- Reject on `onerror` event
- Remove the `playPromise.catch()` that silently calls `onEnded()`

### 2. Modify `start()` to await first successful playback
```typescript
async start(volume: number): Promise<boolean> {
  currentVolume = volume
  isPlaying = true
  await ensureQueue()
  
  // Try tracks until one plays successfully or queue exhausted
  while (isPlaying) {
    const url = pickNextUrl()
    if (!url) break
    
    try {
      await playUrl(url)
      return true  // First track playing successfully
    } catch {
      // Try next track
      continue
    }
  }
  
  isPlaying = false
  return false
}
```

### 3. Keep `onEnded()` and `onError()` for subsequent tracks
- These remain as `void` functions handling queue progression after first track
- They don't affect the `start()` return value

## Files to Modify

- `src/lib/ambientMusic.ts` — only the `createAudioFileEngine` function (lines 183-280)

## Validation

### Unit Tests (add to `src/__tests__/ambientMusic.test.ts`)

1. `engine.start()` returns `false` when bucket empty (no URLs)
2. `engine.start()` returns `false` when all tracks fail to play
3. `engine.start()` returns `true` when first track plays successfully
4. `engine.start()` tries next track when first fails (simulated error)

### Manual Verification

1. Open `/admin/settings?tab=music` → upload 1+ audio files
2. Enable "เปิดใช้งานเพลงพื้นหลัง" toggle
3. Go to homepage → click ♪ button
4. Verify: sound plays, UI shows "กำลังเล่น" with volume slider (not "ไม่มีเพลงใน bucket")

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Empty bucket | `start()` → `false` immediately |
| First track 404/CORS | Tries next track automatically |
| All tracks fail | `start()` → `false` after exhausting queue |
| Autoplay blocked | `audio.play()` rejects → tries next track |
| User clicks toggle again while starting | `stop()` called → `isPlaying = false` → loop exits |

## Out of Scope

- Migration 196 (already applied)
- Bucket policies / CORS (user confirmed OK)
- `AmbientMusicManager`, `AmbientMusicToggle`, `BackgroundMusicSettingsPage`
- Ducking logic (`onVoiceActivity`)
- Volume persistence

## Implementation Notes

- Use `audio.onplay` event (fires when playback starts) not `oncanplay` (fires when ready to play but may not have started)
- Keep `audio.loop = false` — queue handled by `onEnded`
- Preserve existing `duckLevel` volume scaling
- No API changes to `AmbientEngine` interface (still `start(volume): Promise<boolean>`)