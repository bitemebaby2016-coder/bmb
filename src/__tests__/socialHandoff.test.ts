// R91 (Owner 2026-11-11): บริบทจาก Facebook/Messenger ต้องต่อเข้า Bite AI ของเว็บ
// ให้เหมือนกันและต่อเนื่อง — pure lib + capture chain ที่ test ได้ทุกชั้น
import { describe, it, expect, beforeEach } from 'vitest'
import {
  detectSocialSource,
  saveSocialHandoff,
  readSocialHandoff,
  buildSocialHandoffContext,
  SOCIAL_HANDOFF_KEY,
} from '@/lib/socialHandoff'

describe('R91 · detectSocialSource — จำแนกแหล่งจาก referrer+UA ผสม', () => {
  it('Messenger in-app UA (FB_IAB/MESSENGER) → messenger', () => {
    expect(detectSocialSource('Mozilla/5.0 (Linux; Android 14) [FB_IAB/MESSENGER;FBAV/400]')).toBe('messenger')
    expect(detectSocialSource('https://www.messenger.com/')).toBe('messenger')
  })
  it('Facebook app/web → facebook', () => {
    expect(detectSocialSource('Mozilla/5.0 (Linux; Android 14) [FBAN/FB4A;FBAV/400]')).toBe('facebook')
    expect(detectSocialSource('https://m.facebook.com/')).toBe('facebook')
    expect(detectSocialSource('https://www.facebook.com/')).toBe('facebook')
  })
  it('ที่มาอื่น/ไม่รู้ → other', () => {
    expect(detectSocialSource('')).toBe('other')
    expect(detectSocialSource('https://google.com/')).toBe('other')
  })
})

describe('R91 · save/read handoff ผ่าน sessionStorage (jsdom)', () => {
  beforeEach(() => sessionStorage.clear())

  it('บันทึกเฉพาะแหล่งโซเชียล + มีรายการ — other/ว่าง = ไม่บันทึก', () => {
    saveSocialHandoff('other', [{ id: 'p1', q: 1 }])
    expect(readSocialHandoff()).toBeNull()
    saveSocialHandoff('facebook', [])
    expect(readSocialHandoff()).toBeNull()
    saveSocialHandoff('messenger', [{ id: 'p1', q: 2 }])
    const h = readSocialHandoff()
    expect(h?.source).toBe('messenger')
    expect(h?.ids).toEqual([{ id: 'p1', q: 2 }])
  })

  it('ข้อมูลเสียใน storage → read คืน null (ไม่ throw ไม่มโน)', () => {
    sessionStorage.setItem(SOCIAL_HANDOFF_KEY, '{ไม่ใช่ json')
    expect(readSocialHandoff()).toBeNull()
    sessionStorage.setItem(SOCIAL_HANDOFF_KEY, JSON.stringify({ source: 'tiktok', ids: [] }))
    expect(readSocialHandoff()).toBeNull()
  })
})

describe('R91 · buildSocialHandoffContext — ต่อบทสนทนาจากของจริงเท่านั้น', () => {
  const cart = [{ product: { id: 'p1', name: 'ไก่ทอดข้าวเหนียว' }, quantity: 1 }]

  it('ไม่มี handoff → คืนค่าว่าง (ไม่ inject อะไรเลย)', () => {
    expect(buildSocialHandoffContext(cart, null)).toBe('')
  })

  it('handoff item ตรงกับตะกร้า → ชื่อจริง+จำนวนจากร้าน (ห้ามมโน)', () => {
    const ctx = buildSocialHandoffContext(cart, { source: 'messenger', ids: [{ id: 'p1', q: 2 }], at: Date.now() })
    expect(ctx).toContain('Messenger')
    expect(ctx).toContain('ไก่ทอดข้าวเหนียว x2')
    expect(ctx).toContain('ต่อบทสนทนา')
    expect(ctx).toContain('ห้ามถามเมนู/จำนวนที่สรุปแล้วซ้ำ')
  })

  it('handoff item ไม่อยู่ในตะกร้า (เมนูหาย) → ใช้ประโยคทั่วไป ไม่สร้างชื่อปลอม', () => {
    const ctx = buildSocialHandoffContext(cart, { source: 'facebook', ids: [{ id: 'zzz', q: 1 }], at: Date.now() })
    expect(ctx).toContain('Facebook')
    expect(ctx).toContain('ลิงก์สรุปตะกร้า')
    expect(ctx).not.toContain('zzz')
  })
})
