// ============================================
// Bite Me Baby — shared voice-activity event (smallest possible interface)
// aiVoice (existing TTS pipeline) EMITS here; ambient music LISTENS and ducks.
// Nothing else in the voice/chat pipeline changes.
// ============================================

export const VOICE_ACTIVITY_EVENT = 'bmb:voiceactivity'

export interface VoiceActivityDetail {
  speaking: boolean
}

/** Emit from the voice pipeline whenever playback starts/stops (incl. errors). */
export function emitVoiceActivity(speaking: boolean): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<VoiceActivityDetail>(VOICE_ACTIVITY_EVENT, { detail: { speaking } })
  )
}

/** Subscribe to voice playback state. Returns an unsubscribe function. */
export function onVoiceActivity(handler: (speaking: boolean) => void): () => void {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<VoiceActivityDetail>).detail
    handler(!!detail?.speaking)
  }
  window.addEventListener(VOICE_ACTIVITY_EVENT, listener)
  return () => window.removeEventListener(VOICE_ACTIVITY_EVENT, listener)
}