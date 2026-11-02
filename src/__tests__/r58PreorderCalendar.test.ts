// ============================================
// Bite Me Baby — R58 (Owner 2026-11-02):
//  ① การ์ดประกาศ = ภาพเจนการตลาด/โปรโมชั่น (ไม่ใช่รูปเมนู) โชว์แทนตัวมาสคอต ·
//     มาสคอตย่อเป็นตัวเล็กมุมรูป + สลับไม่ซ้ำตามลำดับโพส
//  ② พรีออเดอร์ = ผูกวันปฏิทินสั่งจริง (menu_schedule) · เมนูยังไม่ลงปฏิทิน =
//     "เปิดจองล่วงหน้าเร็ว ๆ นี้" (ทุกช่องทาง AI ผ่าน getShopContext)
//  ③ อัลบั้มภาพ AI = bmb-images/ai-generated/<หมวด>/ (probe จริง e2e/r58_album_probe.json)
// ============================================
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  pickMarketingAiImage,
  mascotForPosition,
  mascotCornerForPosition,
  MASCOT_ROTATION,
} from '@/components/home/FloatingAdBanners'
import { buildMenuCalendarLines } from '../../supabase/functions/_shared/shopContext.ts'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const fladSrc = read('src/components/home/FloatingAdBanners.tsx')
const shopCtxSrc = read('supabase/functions/_shared/shopContext.ts')
const cssSrc = read('src/index.css')

describe('R58 ① — การ์ดประกาศ: ภาพเจนการตลาดแทนมาสคอต + มาสคอตมุมรูปสลับไม่ซ้ำ', () => {
  it('pickMarketingAiImage = เฉพาะ ai-generated การตลาด/โปรโมชั่น · รูปเมนู/disabled/ค้างลิงก์ถูกปฏิเสธ', () => {
    expect(pickMarketingAiImage(['https://x/ai-generated/promo/gen-1.png'])).toBe('https://x/ai-generated/promo/gen-1.png')
    expect(pickMarketingAiImage(['https://x/ai-generated/festival/gen-2.png'])).toBe('https://x/ai-generated/festival/gen-2.png')
    expect(pickMarketingAiImage('https://x/ai-generated/promo/gen-3.png')).toBe('https://x/ai-generated/promo/gen-3.png')
    // รูปเมนู = ห้ามเอามาโชว์แทนมาสคอต
    expect(pickMarketingAiImage(['https://x/ai-generated/menu/wm-9.png'])).toBe('')
    expect(pickMarketingAiImage(['https://x/ai-generated/_disabled/promo/gen-4.png'])).toBe('')
    expect(pickMarketingAiImage(['https://x/catalog/photo.jpg', ''])).toBe('')
    expect(pickMarketingAiImage(null)).toBe('')
    // เอาใบใช้ได้ใบสุดท้าย (ใหม่สุดตอน insert)
    expect(pickMarketingAiImage([
      'https://x/ai-generated/promo/old.png',
      'https://x/ai-generated/promo/new.png',
    ])).toBe('https://x/ai-generated/promo/new.png')
  })

  it('mascotForPosition = สลับไม่ซ้ำตามลำดับโพส (การ์ดติดกันคนละตัว · mod วนได้) + มุม 0-3', () => {
    // การ์ดติดกัน 4 แรก = ตัวไม่ซ้ำกันเลย
    const first = [0, 1, 2, 3].map(mascotForPosition)
    expect(new Set(first).size).toBe(4)
    expect(mascotForPosition(4)).toBe(first[0]) // วนรอบ
    expect(MASCOT_ROTATION.length).toBeGreaterThanOrEqual(4)
    for (const src of MASCOT_ROTATION) expect(src.startsWith('/assets/mascot/')).toBe(true)
    // มุมสลับ 4 มุม
    expect([0, 1, 2, 3].map(mascotCornerForPosition)).toEqual([0, 1, 2, 3])
    expect(mascotCornerForPosition(5)).toBe(1)
    expect(mascotCornerForPosition(Number.NaN)).toBe(0)
  })

  it('source: announcements ผูก image_urls ของโพสเอง + media สลับอัลบั้ม/โฆษณาลอย + composed = มุมสลับ', () => {
    expect(fladSrc).toContain('image: pickMarketingAiImage(p.image_urls)')
    // ลำดับ media: ภาพโพส → floating_ad_image → อัลบั้ม promo/festival (ไม่ใช่เมนู)
    expect(fladSrc).toContain('const mediaSrc = promo.image || floatImg || (albumImgs.length > 0')
    expect(fladSrc).toContain("'ai-generated/promo'")
    expect(fladSrc).toContain("'ai-generated/festival'")
    // มาสคอตตัวเล็กมุมรูป = คนละตัว/คนละมุมตามลำดับโพส
    expect(fladSrc).toContain('const mascotSrc = mascotForPosition(pos)')
    expect(fladSrc).toContain('flad-mascot-composed flad-mascot-pos-')
    expect(fladSrc).toContain('const positionOf = new Map(merged.map((p, i) => [p.id, i]))')
    // CSS: ยุบเล็ก (46%) + คลาส 4 มุม
    expect(cssSrc).toContain('height: 46%;')
    expect(cssSrc).toContain('.flad-media img.flad-mascot-pos-0')
    expect(cssSrc).toContain('.flad-media img.flad-mascot-pos-3')
  })
})

describe('R58 ② — ปฎิทินเมนูจริงใน prompt AI (พรีออเดอร์ผูกวันจริง · ยังไม่ลงปฎิทิน = เปิดจองล่วงหน้าเร็ว ๆ นี้)', () => {
  it('buildMenuCalendarLines: รวมตามวันจริง + กฎบังคับ + null/ว่าง = ไม่เดา', () => {
    const lines = buildMenuCalendarLines([
      { scheduled_date: '2026-11-06', product_name: 'ข้าวมันไก่' },
      { scheduled_date: '2026-11-05', product_name: 'สเต๊กเต้าหู้' },
      { scheduled_date: '2026-11-05', product_name: 'ชานมไข่มุก' },
    ])
    const text = lines.join('\n')
    expect(text).toContain('MENU CALENDAR')
    expect(text).toContain('- 2026-11-05: สเต๊กเต้าหู้, ชานมไข่มุก') // เรียงวัน + รวมรายการ
    expect(text).toContain('- 2026-11-06: ข้าวมันไก่')
    expect(text).toContain('เปิดจองล่วงหน้าเร็ว ๆ นี้')
    expect(text).toContain('ห้ามเดาวันเอง')
    expect(text).toContain('PRE-ORDER DATE RULES')
    // ดึงไม่ได้ = ZERO-FAKE บอกตรง ๆ
    expect(buildMenuCalendarLines(null).join('\n')).toContain('ดึงข้อมูลปฎิทินเมนูไม่ได้')
    // ว่าง = ยังไม่มีเมนูลงปฎิทิน
    expect(buildMenuCalendarLines([]).join('\n')).toContain('ยังไม่มีเมนูลงปฎิทิน')
  })

  it('source contract: getShopContext ดึง menu_schedule + ฉีด MENU CALENDAR + products มี id ผูกชื่อ', () => {
    expect(shopCtxSrc).toContain('/rest/v1/menu_schedule')
    expect(shopCtxSrc).toContain('is_published=eq.true')
    expect(shopCtxSrc).toContain('scheduled_date=gte.')
    expect(shopCtxSrc).toContain('select=id,name,price') // +id สำหรับ join ชื่อจาก schedule
    expect(shopCtxSrc).toContain('buildMenuCalendarLines')
    expect(shopCtxSrc).toContain('lines.push(...buildMenuCalendarLines(')
    // MAX_CHARS ยก 4000→5000 (r43Contracts คุมค่าเดียวกัน)
    expect(shopCtxSrc).toMatch(/MAX_CHARS = 5000/)
  })
})