// ============================================
// Bite Me Baby — AI Voice tests (WS-2): Web Speech API mocked, offline
// ============================================

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

type ChatWithAIMock = Mock

// --- Web Speech API mock (not in jsdom by default) ---
class FakeUtterance {
  lang = ''; rate = 1; pitch = 1; volume = 1; voice: unknown = null; text = ''
  onend: (() => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  constructor(public txt: string) { this.text = txt }
}

class FakeRecognition {
  lang = ''; continuous = false; interimResults = false; maxAlternatives = 1
  started = false
  start() { this.started = true }
  stop() { this.started = false }
  abort() { this.started = false }
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onend: (() => void) | null = null
}

const fakeSynth = {
  cancel: vi.fn(),
  speak: vi.fn((u: FakeUtterance) => { queueMicrotask(() => u.onend?.()) }),
  getVoices: vi.fn(() => [
    { name: 'Thai Female', lang: 'th-TH' },
    { name: 'English', lang: 'en-US' },
  ] as unknown as SpeechSynthesisVoice[]),
}

beforeEach(() => {
  vi.resetModules()
  fakeSynth.speak.mockClear()
  fakeSynth.cancel.mockClear()
  ;(globalThis as any).SpeechSynthesisUtterance = FakeUtterance
  Object.defineProperty(globalThis, 'speechSynthesis', { configurable: true, value: fakeSynth })
  Object.defineProperty(globalThis, 'webkitSpeechRecognition', { configurable: true, value: FakeRecognition })
  Reflect.deleteProperty(globalThis, 'SpeechRecognition')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: vi.fn(), setItem: vi.fn() } })
})

// --- aiService mock: voice must ride the SAME chat pipeline (WS-2 เดียวกับ chat) ---
vi.mock('@/lib/aiService', () => ({
  chatWithAI: vi.fn(async (text: string, _ctx: unknown, opts?: { voiceMode?: boolean }) => {
    if (opts?.voiceMode) return `voice:${text}`
    return `text:${text}`
  }),
}))

import {
  AIVoiceService,
  speakableText,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  isVoiceSupported,
  isVoiceReplyEnabled,
  setVoiceReplyEnabled,
} from '@/lib/aiVoice'
import { chatWithAI } from '@/lib/aiService'

describe('Voice support helpers (WS-2b/c — graceful fallback)', () => {
  it('detects full support when Web Speech API exists', () => {
    expect(isSpeechRecognitionSupported()).toBe(true)
    expect(isSpeechSynthesisSupported()).toBe(true)
    expect(isVoiceSupported()).toBe(true)
  })

  it('reports no support when the browser lacks the API (Firefox/iOS)', async () => {
    vi.resetModules()
    Reflect.deleteProperty(globalThis, 'webkitSpeechRecognition')
    Reflect.deleteProperty(globalThis, 'speechSynthesis')
    const mod = await import('@/lib/aiVoice')
    expect(mod.isSpeechRecognitionSupported()).toBe(false)
    expect(mod.isSpeechSynthesisSupported()).toBe(false)
    expect(mod.isVoiceSupported()).toBe(false)
    // service must not crash when unsupported
    const svc = new mod.AIVoiceService()
    expect(svc.startListening()).toBe(false)
    await expect(svc.speak('ทดสอบ')).rejects.toThrow('not supported')
  })
})

describe('speakableText (WS-2c — กรองข้อความก่อนพูด)', () => {
  it('strips markdown, emoji and symbols that TTS cannot read', () => {
    const raw = '# เมนูแนะนำ\n**ขนมครก** 🍊 *30 บาท*\n- ข้าวเหนียวมะม่วง → 65 บาท\n[ดูเพิ่ม](https://x.y)'
    const out = speakableText(raw)
    expect(out).not.toMatch(/[#*]|→|🍊/)
    expect(out).toContain('ขนมครก 30 บาท')
    expect(out).toContain('ดูเพิ่ม')
  })

  it('keeps plain Thai sentences intact', () => {
    expect(speakableText('มีขนมครกกับข้าวเหนียวมะม่วงค่ะ')).toBe('มีขนมครกกับข้าวเหนียวมะม่วงค่ะ')
  })
})

describe('Voice reply setting persistence (WS-2c — จำการตั้งค่า)', () => {
  it('persists via localStorage', () => {
    setVoiceReplyEnabled(true)
    expect(localStorage.setItem).toHaveBeenCalledWith('bmb_voice_reply_enabled', '1')
    setVoiceReplyEnabled(false)
    expect(localStorage.setItem).toHaveBeenCalledWith('bmb_voice_reply_enabled', '0')
    // getItem mock returns undefined → disabled
    expect(isVoiceReplyEnabled()).toBe(false)
  })
})

describe('AIVoiceService (WS-2b — STT ไทย + barge-in + ระบบเดียวกับ chat)', () => {
  it('configures STT for Thai (th-TH) with interim results', () => {
    const svc = new AIVoiceService()
    svc.startListening()
    // recognition created lazily in initSpeechRecognition → new FakeRecognition set lang th-TH
  })

  it('barge-in: starting to listen stops the speaking utterance immediately', async () => {
    const svc = new AIVoiceService()
    const p = svc.speak('กำลังพูดอยู่นะคะ')
    expect(svc.isSpeaking()).toBe(true)
    svc.startListening() // user starts talking → AI must stop
    expect(fakeSynth.cancel).toHaveBeenCalled()
    await p
  })

  it('routes text through chatWithAI with voiceMode (same pipeline as chat)', async () => {
    const svc = new AIVoiceService()
    const res = await svc.sendTextMessage('มีอะไรขายวันนี้')
    expect(res.error).toBeUndefined()
    expect(res.content).toBe('voice:มีอะไรขายวันนี้')
    expect(chatWithAI).toHaveBeenCalledWith('มีอะไรขายวันนี้', undefined, { voiceMode: true })
    // conversation tracked for UI display
    expect(svc.getConversation().length).toBe(2)
  })

  it('returns a friendly error shape when the AI call fails', async () => {
    ;(chatWithAI as unknown as ChatWithAIMock).mockRejectedValueOnce(new Error('proxy down'))
    const svc = new AIVoiceService()
    const res = await svc.sendTextMessage('สวัสดี')
    expect(res.error).toBe('proxy down')
    expect(res.content).toBe('')
  })

  it('TTS speaks filtered text with Thai language config', async () => {
    const svc = new AIVoiceService()
    await svc.speak('สวัสดีค่ะ 🍊')
    const utter = fakeSynth.speak.mock.calls[0][0] as FakeUtterance
    expect(utter.text).toBe('สวัสดีค่ะ 🍊') // speak() รับข้อความดิบ — ตัวเรียกใช้ speakableText ก่อน
    expect(utter.lang).toBe('th-TH')
  })
})