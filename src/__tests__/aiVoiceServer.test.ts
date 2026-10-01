// ============================================
// Bite Me Baby — AI Voice WS-2f tests: server STT/TTS helpers (offline)
// ============================================
import { describe, it, expect } from 'vitest'
import { isMediaRecorderSupported } from '../lib/aiVoice'

describe('aiVoice WS-2f server chains', () => {
  it('isMediaRecorderSupported returns false without mediaDevices (jsdom)', () => {
    // jsdom navigator ไม่มี mediaDevices → ต้อง false แล้ว UI จะ fallback Web Speech API
    const supported = isMediaRecorderSupported()
    expect(supported).toBe(false)
  })
})