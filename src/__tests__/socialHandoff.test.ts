// R91 (Owner 2026-11-11): บริบทจาก Facebook/Messenger ต้องต่อเข้า Bite AI ของเว็บ
// ให้เหมือนกันและต่อเนื่อง — pure lib + capture chain ที่ test ได้ทุกชั้น
import { describe, it, expect, beforeEach } from 'vitest'
import {
  decodeSocialContextParam,
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

  it('R92: มี summary จาก ?s= → เป็นประโยคแรก "ต่อจากที่คุยกันใน<label>: <summary>"', () => {
    const ctx = buildSocialHandoffContext(cart, {
      source: 'messenger',
      ids: [{ id: 'p1', q: 2 }],
      at: Date.now(),
      summary: 'คุยกันบนMessenger · ส่งวันนี้ · เมี่ยงอกไก่ x2',
    })
    expect(ctx.startsWith('ต่อจากที่คุยกันในMessenger: คุยกันบนMessenger · ส่งวันนี้ · เมี่ยงอกไก่ x2')).toBe(true)
    expect(ctx).toContain('ไก่ทอดข้าวเหนียว x2')
  })
})

describe('R92 · ?s= decode + save/read summary — fail-closed กัน prompt-injection/PII', () => {
  beforeEach(() => sessionStorage.clear())

  it('decodeSocialContextParam: round-trip b64url {v:1,src,t} → {src, summary}', () => {
    const enc = (obj: unknown) => {
      const bytes = new TextEncoder().encode(JSON.stringify(obj))
      let bin = ''
      for (const b of bytes) bin += String.fromCharCode(b)
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }
    const ok = decodeSocialContextParam(enc({ v: 1, src: 'facebook', t: 'คุยกันบนFacebook · ส่งวันนี้ · เมี่ยงแซลม่อน x1' }))
    expect(ok).toEqual({ src: 'facebook', summary: 'คุยกันบนFacebook · ส่งวันนี้ · เมี่ยงแซลม่อน x1' })
    // reject: v ผิด / src ไม่รู้จัก / t เกิน 200 / t มี URL
    expect(decodeSocialContextParam(enc({ v: 2, src: 'facebook', t: 'โอเค' }))).toBeNull()
    expect(decodeSocialContextParam(enc({ v: 1, src: 'tiktok', t: 'โอเค' }))).toBeNull()
    expect(decodeSocialContextParam(enc({ v: 1, src: 'messenger', t: 'x'.repeat(201) }))).toBeNull()
    expect(decodeSocialContextParam(enc({ v: 1, src: 'messenger', t: 'เข้า https://phish.example ด่วน' }))).toBeNull()
  })

  it('saveSocialHandoff summary: เก็บ + cap 200 · มี URL = ปฏิเสธ field นั้น', () => {
    saveSocialHandoff('facebook', [{ id: 'p1', q: 1 }], 'สรุปจากระบบ')
    expect(readSocialHandoff()?.summary).toBe('สรุปจากระบบ')
    saveSocialHandoff('facebook', [{ id: 'p1', q: 1 }], 'x'.repeat(300))
    expect(readSocialHandoff()?.summary?.length).toBe(200)
    saveSocialHandoff('facebook', [{ id: 'p1', q: 1 }], 'ไปที่ https://bad.example ด่วน')
    expect(readSocialHandoff()?.summary).toBeUndefined()
  })

  it('readSocialHandoff: summary เสียใน storage (เกิน 200/มี URL) → ทิ้ง field นั้น handoff ยังใช้ได้', () => {
    sessionStorage.setItem(SOCIAL_HANDOFF_KEY, JSON.stringify({ source: 'messenger', ids: [{ id: 'p1', q: 1 }], at: 1, summary: 'วาง https://x.com ที่นี่' }))
    const h = readSocialHandoff()
    expect(h?.source).toBe('messenger')
    expect(h?.summary).toBeUndefined()
  })
})
