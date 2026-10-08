// ============================================
// Bite Me Baby — AI Voice WS-2f tests: server STT/TTS helpers (offline)
// ============================================
import { describe, it, expect } from 'vitest'
import { isMediaRecorderSupported, splitWordSafe } from '../lib/aiVoice'

describe('aiVoice WS-2f server chains', () => {
  it('isMediaRecorderSupported returns false without mediaDevices (jsdom)', () => {
    // jsdom navigator ไม่มี mediaDevices → ต้อง false แล้ว UI จะ fallback Web Speech API
    const supported = isMediaRecorderSupported()
    expect(supported).toBe(false)
  })
})

// ============================================
// V2 FIX (owner report 2026-10-01: พูดขาดตอน) — splitWordSafe ตัดที่ขอบคำ
// ภาษาไทยไม่มีช่องว่าง วิธีเดิม (หาช่องว่าง) ตัดกลางคำ → เสียงหลุดกลางประโยค
// ============================================
describe('V2 splitWordSafe — ตัดที่ขอบคำ ไม่ตัดกลางคำ', () => {
  const LONG_THAI =
    'สวัสดีครับยินดีต้อนรับสู่ร้านไบ๊ท์มีเบบี้ วันนี้เรามีขนมครกกระทะร้อน ๆ หอมหวานอร่อยแน่นอนครับ' +
    'และยังมีข้าวเหนียวมะม่วงสุกหวานฉ่ำจากสวนจันทบุรีบ้านเราครับ สั่งผ่านแอปได้เลยครับขอบคุณครับ'

  it('ทุกชิ้นไม่เกิน max และต่อกันคืนได้ข้อความเดิมทั้งหมด', () => {
    const chunks = splitWordSafe(LONG_THAI, 180)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(180)
    expect(chunks.join('')).toBe(LONG_THAI) // ไม่หาย ไม่ซ้ำ ไม่เปลี่ยนอักษร
  })

  it('ไม่มีการตัดกลางคำสำคัญ (ขอบชิ้นไม่ตรงกลางคำที่ Segmenter รู้จัก)', () => {
    // คำที่ต้องอยู่ครบในชิ้นใดชิ้นหนึ่ง ไม่ถูกแยกข้ามชิ้น
    const chunks = splitWordSafe(LONG_THAI, 180)
    const joined = chunks.map((c, i) => (i > 0 ? '\n' + c : c)).join('')
    for (const word of ['ขนมครก', 'ข้าวเหนียวมะม่วง', 'สั่งผ่านแอป']) {
      // คำจะต้องอยู่ในชิ้นเดียวกัน (ไม่ถูกตัดกลางคำ) — ตรวจโดยไม่มีชิ้นจบ/เริ่มกลางคำ
      const parts = joined.split('\n')
      const foundWhole = parts.some((p) => p.includes(word))
      expect(foundWhole).toBe(true)
    }
  })

  it('ข้อความสั้นคืนชิ้นเดียว', () => {
    expect(splitWordSafe('สวัสดีครับ', 180)).toEqual(['สวัสดีครับ'])
  })

  it('ข้อความเปล่า/ข้อความยาวมากไม่ crash', () => {
    expect(splitWordSafe('', 180)).toEqual([''])
    const huge = 'ครก'.repeat(500) // 1500 ตัวอักษร
    const chunks = splitWordSafe(huge, 180)
    expect(chunks.join('')).toBe(huge)
  })
})