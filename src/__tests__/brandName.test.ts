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

describe('brand name — canonical spelling (Owner rule 2026-10-12)', () => {
  it('mascot is ไบ๊ and brand is ไบ๊มีเบบี้ — ทับศัพท์ตรง ๆ เท่านั้น', () => {
    expect(MASCOT_TH).toBe('ไบ๊')
    expect(BRAND_TH).toBe('ไบ๊มีเบบี้')
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
  it('rewrites every banned variant to ไบ๊', () => {
    for (const bad of BANNED_MASCOT_NAMES) {
      const out = normalizeBrandNames('สวัสดีครับ ' + bad + ' ครับ')
      expect(out, `ยังคงมีชื่อผิด "${bad}" หลัง normalize`).toBe('สวัสดีครับ ไบ๊ ครับ')
      expect(containsWrongMascotName(out)).toBe(false)
    }
  })

  it('rewrites the English brand name to the Thai spelling', () => {
    const out = normalizeBrandNames('ที่ร้าน Bite Me Baby อร่อย')
    expect(out).toContain('ไบ๊มีเบบี้')
    expect(out).not.toContain('Bite Me Baby')
    expect(containsWrongMascotName(out)).toBe(false)
  })

  it('never produces a doubled mascot name from layered replacements', () => {
    const out = normalizeBrandNames('ไบ๊ท์ ไบท์ ไบท บั๊บ')
    expect(out).not.toContain('ไบ๊ไบ๊')
    expect(out.split('ไบ๊').length - 1).toBe(4)
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
  it('states the correct names and bans the known wrong ones', () => {
    const rule = mascotNameRule()
    expect(rule).toContain('ไบ๊')
    expect(rule).toContain('ไบ๊มีเบบี้')
    expect(rule).toContain('บั๊บ')
    expect(rule).toContain('บิท')
  })
})
