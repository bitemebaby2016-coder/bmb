// R75 (Owner 2026-11-07: "ลิ้งที่เอไอสร้างใช้ไม่ได้เลยสักลิ้ง ต่อออกภายนอกก็ไม่ได้")
// — ลิงก์ทุกตัวที่ AI/ระบบส่งขึ้น Facebook ต้องเป็น https:// URL เต็มรูปแบบที่แตะได้จริง
//   (Facebook ทำลิงก์ให้แตะได้เฉพาะ URL ที่มี scheme — โดเมนเปล่า/ markdown = แตะไม่ได้)
// evidence: e2e/_r75_link_audit.log (live replies 2026-11-07 = bare domain ทุกลิงก์)
import { describe, it, expect } from 'vitest'
import { normalizeAiTextLinks, SITE_URL } from '../../supabase/functions/_shared/socialLinkFormat.ts'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const aiWorkerSrc = read('supabase/functions/social-ai-worker/index.ts')
const postWorkerSrc = read('supabase/functions/social-post-worker/index.ts')
const publishSrc = read('supabase/functions/social-publish-worker/index.ts')

// ลิงก์ตะกร้าจริงจาก live evidence (e2e/_r75_link_audit.log) — ต้องคงเดิมเป๊ะ (idempotent)
const LIVE_CART_LINK = 'https://biteme-baby.com/shop?cart=eyJ2IjoxLCJpdGVtcyI6W3siaWQiOiJwcm9kLTE3OTMzNzA1NDgxNzctb2lsZnhpIiwicSI6MX1dfQ'

describe('R75 — normalizeAiTextLinks: โดเมนเปล่า → https:// URL ที่แตะได้', () => {
  it('ข้อความ AI จริงจาก live: bare biteme-baby.com/shop → https:// (Facebook ทำลิงก์ให้)', () => {
    const live = '🛒 เปิดตะกร้าที่ biteme-baby.com/shop แล้วสั่งต่อได้เลยครับ'
    const out = normalizeAiTextLinks(live)
    expect(out).toBe('🛒 เปิดตะกร้าที่ https://biteme-baby.com/shop แล้วสั่งต่อได้เลยครับ')
    expect(out).not.toContain('ที่ biteme-baby.com')
  })

  it('ทุกฟอร์ม bare / www / http → https://biteme-baby.com เสมอ', () => {
    expect(normalizeAiTextLinks('กดที่ biteme-baby.com/checkout เลย')).toBe('กดที่ https://biteme-baby.com/checkout เลย')
    expect(normalizeAiTextLinks('ดูที่ www.biteme-baby.com/shop')).toBe('ดูที่ https://biteme-baby.com/shop')
    expect(normalizeAiTextLinks('เปิด http://biteme-baby.com/shop')).toBe('เปิด https://biteme-baby.com/shop')
    expect(normalizeAiTextLinks('เว็บ biteme-baby.com ครับ')).toBe('เว็บ https://biteme-baby.com ครับ')
  })

  it('idempotent — ลิงก์ https:// เดิม (รวมลิงก์ตะกร้าจริง) คงเดิมเป๊ะ ไม่ถูกแต่งซ้ำ', () => {
    expect(normalizeAiTextLinks(LIVE_CART_LINK)).toBe(LIVE_CART_LINK)
    const twice = normalizeAiTextLinks(normalizeAiTextLinks('ที่ biteme-baby.com/shop'))
    expect(twice).toBe('ที่ https://biteme-baby.com/shop')
  })

  it('markdown [label](url) → ข้อความ+URL (Facebook ไม่ render markdown)', () => {
    expect(normalizeAiTextLinks('กด [ที่นี่](https://biteme-baby.com/shop) เลย'))
      .toBe('กด ที่นี่: https://biteme-baby.com/shop เลย')
    expect(normalizeAiTextLinks('[](biteme-baby.com/shop)')).toBe('https://biteme-baby.com/shop')
  })

  it('วรรคตอนท้ายไม่ถูกดึงเข้า URL + อักขระไทยหลัง URL ไม่ติดเข้า path', () => {
    expect(normalizeAiTextLinks('สั่งที่ biteme-baby.com/shop.')).toBe('สั่งที่ https://biteme-baby.com/shop.')
    expect(normalizeAiTextLinks('(biteme-baby.com/shop)')).toBe('(https://biteme-baby.com/shop)')
    expect(normalizeAiTextLinks('ที่ biteme-baby.com/shopครับ')).toBe('ที่ https://biteme-baby.com/shopครับ')
    expect(normalizeAiTextLinks('ที่ biteme-baby.com/shop แล้วกสั่งได้เลยครับ'))
      .toBe('ที่ https://biteme-baby.com/shop แล้วกสั่งได้เลยครับ')
  })

  it('ไม่แตะ URL ภายนอกอื่น / host ที่ยาวกว่า / ข้อความว่าง', () => {
    expect(normalizeAiTextLinks('ดูที่ https://example.com/x')).toBe('ดูที่ https://example.com/x')
    expect(normalizeAiTextLinks('biteme-baby.commerce')).toBe('biteme-baby.commerce')
    expect(normalizeAiTextLinks('')).toBe('')
  })
})

describe('R75 — ท่อส่งออกทุกเส้นผ่าน normalize + prompt สอน URL เต็มรูปแบบ', () => {
  it('social-ai-worker: normalize ก่อนบันทึก/ส่ง reply เสมอ', () => {
    expect(aiWorkerSrc).toContain("from '../_shared/socialLinkFormat.ts'")
    expect(aiWorkerSrc).toContain('const finalText = normalizeAiTextLinks(')
    expect(aiWorkerSrc).toContain('normalizeAiTextLinks(footer)')
  })

  it('social-post-worker: normalize title/body ของ draft ก่อน persist', () => {
    expect(postWorkerSrc).toContain("from '../_shared/socialLinkFormat.ts'")
    expect(postWorkerSrc).toContain('v.title = normalizeAiTextLinks(v.title)')
    expect(postWorkerSrc).toContain('v.body = normalizeAiTextLinks(v.body)')
  })

  it('social-publish-worker: CTA footer มี https:// URL จริง + body ถูก normalize', () => {
    expect(publishSrc).toContain("from '../_shared/socialLinkFormat.ts'")
    expect(publishSrc).toContain('normalizeAiTextLinks(String(text ?? \'\'))')
    expect(publishSrc).toContain('🌐 สั่งต่อที่เว็บ https://biteme-baby.com/shop')
    // บรรทัด "ลิงก์เปิดเว็บภายนอก" ต้องมี URL จริงต่อท้าย (เดิมไม่มีลิงก์ = ต่อออกภายนอกไม่ได้)
    expect(publishSrc).toMatch(/ลิงก์เปิดเว็บภายนอก Facebook[^\n]*https:\/\/biteme-baby\.com\/shop/)
  })

  it('prompts ทุกตัวสอนเขียน https:// URL เต็ม + ห้าม markdown (กันต้นเหตุ)', () => {
    expect(aiWorkerSrc).toContain('ทุกลิงก์ต้องเขียนเป็น URL เต็มรูปแบบที่ขึ้นต้นด้วย https://')
    expect(postWorkerSrc).toContain('ทุกลิงก์ต้องเขียนเป็น URL เต็มรูปแบบที่ขึ้นต้นด้วย https://')
    expect(aiWorkerSrc).toContain('ห้ามเขียนลิงก์แบบ markdown')
    expect(postWorkerSrc).toContain('ห้ามเขียนลิงก์แบบ markdown')
  })

  it('SITE_URL = https://biteme-baby.com', () => {
    expect(SITE_URL).toBe('https://biteme-baby.com')
  })
})