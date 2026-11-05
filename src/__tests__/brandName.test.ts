// ============================================
// Guard: ชื่อแบรนด์/มาสคอตห้ามผิด
// ============================================
// แบ่งเป็น 2 ส่วน (โปรเจกต์ไม่ได้ติด @types/node จึงใช้ node:fs ใน test ไม่ได้):
//   1. test นี้ — canonical name + sanitizer พฤติกรรม (pure ล้วน)
//   2. scripts/brandNameGuard.cjs — สแกนทั้ง repo
//      ผูกกับ `npm run lint` ⇒ CI รันทุก push ห้ามชื่อผิดหลุดเข้ามาอีก
// ============================================
import { describe, it, expect } from 'vitest'
import {
  MASCOT_TH,
  BRAND_TH,
  BANNED_MASCOT_NAMES,
  normalizeBrandNames,
  containsWrongMascotName,
  mascotNameRule,
} from '@/lib/brandName'
// N-3 (Owner 2026-11-05): source contract — จุดแสดงผลแชทต้องผ่าน sanitizer
import talkSrc from '../components/ai/TalkToBite.tsx?raw'

describe('brand name — canonical spelling (Owner rule อัปเดต 2026-11-01 R50: ทับศัพท์ Bite)', () => {
  it('mascot is Bite and brand is Bite Me Baby — ทับศัพท์อังกฤษเท่านั้น (ไบ๊ ถูกแทนที่หมด)', () => {
    expect(MASCOT_TH).toBe('Bite')
    expect(BRAND_TH).toBe('Bite Me Baby')
  })

  it('banned list never contains a word that collides with normal Thai', () => {
    // 'บิต' ⊂ เครดิต/เดบิต · 'บับ' ⊂ บับเบิล — ห้ามใส่เด็ดขาด
    // ไม่งั้น guard จับผิดกับคำที่ถูกต้อง แล้วจะแก้ไม่จบสักที
    expect(BANNED_MASCOT_NAMES).not.toContain('บิต')
    expect(BANNED_MASCOT_NAMES).not.toContain('บับ')
    expect(BANNED_MASCOT_NAMES).not.toContain('บิด')
    expect(BANNED_MASCOT_NAMES).not.toContain('บีท')
  })
})

describe('brand name — normalizeBrandNames fixes every wrong spelling', () => {
  it('rewrites every banned variant to Bite', () => {
    for (const bad of BANNED_MASCOT_NAMES) {
      const out = normalizeBrandNames('สวัสดีครับ ' + bad + ' ครับ')
      expect(out, `ยังคงมีชื่อผิด "${bad}" หลัง normalize`).toBe('สวัสดีครับ Bite ครับ')
      expect(containsWrongMascotName(out)).toBe(false)
    }
  })

  it('rewrites every Thai spelling of the brand/mascot (รวม "ไบ๊") to the English transliteration', () => {
    expect(normalizeBrandNames('ที่ร้าน ไบ๊มีเบบี้ อร่อย')).toContain('Bite Me Baby')
    expect(normalizeBrandNames('ที่ร้าน ไบ๊มีเบบี้ อร่อย')).not.toContain('ไบ๊')
    expect(normalizeBrandNames('น้อง ไบ๊ ช่วยแนะนำ')).toBe('น้อง Bite ช่วยแนะนำ')
    expect(normalizeBrandNames('ที่ร้าน Bite Me Baby อร่อย')).toBe('ที่ร้าน Bite Me Baby อร่อย')
    expect(containsWrongMascotName(normalizeBrandNames('ที่ร้าน ไบ๊มีเบบี้ อร่อย'))).toBe(false)
  })

  it('never produces a doubled mascot name from layered replacements', () => {
    const out = normalizeBrandNames('ไบ๊ท์ ไบท์ ไบท บั๊บ')
    expect(out).not.toContain('BiteBite')
    expect(out.split('Bite').length - 1).toBe(4)
  })

  it('leaves ordinary Thai text completely untouched', () => {
    const plain = 'บัตรเครดิตและเดบิต ใช้ได้ทั้งคู่ ครับ'
    expect(normalizeBrandNames(plain)).toBe(plain)
  })

  it('is safe on empty input', () => {
    expect(normalizeBrandNames('')).toBe('')
    expect(containsWrongMascotName('')).toBe(false)
  })
})

describe('brand name — mascotNameRule prompt', () => {
  it('states the correct names (Bite / Bite Me Baby) and bans the known wrong ones', () => {
    const rule = mascotNameRule()
    expect(rule).toContain('Bite')
    expect(rule).toContain('Bite Me Baby')
    expect(rule).toContain('บั๊บ')
    expect(rule).toContain('บิท')
  })
})

describe('N-3 (Owner 2026-11-05) — จุดแสดงผลแชทต้องผ่าน sanitizer (ล้าง "ไบ๊" ที่เหลือก่อนขึ้นจอ)', () => {
  it('TalkToBite render ทุกจุด (content + intro) ผ่าน normalizeBrandNames', () => {
    expect(talkSrc).toContain("from '@/lib/brandName'")
    expect(talkSrc).toContain('normalizeBrandNames(m.content)')
    expect(talkSrc).toContain('normalizeBrandNames(m.intro)')
  })
  it('ข้อความ AI ที่หลุด "ไบ๊"/"ไบ๊มีเบบี้" มา = แสดงเป็น Bite / Bite Me Baby เสมอ', () => {
    expect(normalizeBrandNames('ให้ ไบ๊ ช่วยแนะนำเมนูนะครับ')).toBe('ให้ Bite ช่วยแนะนำเมนูนะครับ')
    expect(normalizeBrandNames('สวัสดีจาก ไบ๊มีเบบี้ ครับ')).toContain('Bite Me Baby')
    expect(containsWrongMascotName(normalizeBrandNames('ผม ไบ๊ ครับ'))).toBe(false)
  })
})
