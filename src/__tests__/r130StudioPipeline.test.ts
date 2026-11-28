// ============================================
// Bite Me Baby — IMG Studio Pipeline (2026-11-28)
//   · buildStudioPayload จับคู่หมวด/คอนเทนเนอร์/texture ตามชื่อเมนู
//   · applyBrandWatermark: mascot='none' = ไม่มีลายน้ำเลย (คืนภาพเดิม)
//   · EF image-gen: system rules (Geometry Lock/#FFFFFF/macro) + BEN2 + ห้ามตีความเป็นร้านขนมหวาน
//   · UI: กล่องพรอมป์เสริมเฉพาะ studio + สถานะลบพื้นหลัง
// ============================================
import { describe, it, expect } from 'vitest'
import { buildStudioPayload, applyBrandWatermark, STUDIO_PAD_SIZE, ALPHA_WEBP_QUALITY } from '@/lib/aiImageStudio'
import imageGenSrc from '../../supabase/functions/image-gen/index.ts?raw'
import marketingSrc from '../pages/admin/AdminMarketing.tsx?raw'
import contentTabSrc from '../components/admin/ContentTab.tsx?raw'

describe('IMG — buildStudioPayload จับคู่หมวดอาหารอัตโนมัติ', () => {
  it('ของทอด → crispy/golden + จานกระเบื้อง', () => {
    const p = buildStudioPayload('ไก่ทอดกรอบ', '')
    expect(p.menu_name).toBe('ไก่ทอดกรอบ')
    expect(p.category).toBe('ของทอด')
    expect(p.container_type).toContain('ตะกร้า')
    expect(p.texture_keywords.join(' ')).toMatch(/crispy/i)
  })
  it('เครื่องดื่มเย็น → frosty/condensation + แก้วใส', () => {
    const p = buildStudioPayload('ชาไทยเย็น', '')
    expect(p.category).toBe('เครื่องดื่มเย็น')
    expect(p.container_type).toContain('แก้ว')
    expect(p.texture_keywords.join(' ')).toMatch(/frosty|condensation/i)
  })
  it('เบเกอรี่ → flaky/buttery', () => {
    const p = buildStudioPayload('ครัวซองต์เนย', '')
    expect(p.category).toBe('เบเกอรี่')
    expect(p.texture_keywords.join(' ')).toMatch(/flaky|buttery/i)
  })
  it('สลัด → fresh/crisp + ชาม', () => {
    const p = buildStudioPayload('สลัดผักใหม่', '')
    expect(p.category).toBe('สลัด')
    expect(p.texture_keywords.join(' ')).toMatch(/fresh|crisp/i)
  })
  it('ข้าวหน้า → fluffy rice + จานร้อน', () => {
    const p = buildStudioPayload('ข้าวผัดกะปิ', '')
    expect(p.category).toBe('ข้าวหน้าต่างๆ')
    expect(p.texture_keywords.join(' ')).toMatch(/rice/i)
  })
  it('ไม่รู้จัก → ทั่วไป + จานเดี่ยว (ไม่ตีความเป็นร้านขนมหวาน)', () => {
    const p = buildStudioPayload('เมนูพิเศษ', '')
    expect(p.category).toBe('ทั่วไป')
    expect(p.container_type).toContain('จาน')
    expect(p.texture_keywords.length).toBeGreaterThan(0)
  })
})

describe('IMG — applyBrandWatermark: mascot=none = ไม่มีลายน้ำ', () => {
  it('คืนภาพเดิมเมื่อ mascotChoice=none (ไม่วาดโลโก้/ข้อความ)', async () => {
    const src = 'https://x.supabase.co/storage/v1/object/public/bmb-images/ai-generated/studio/a.webp'
    const out = await applyBrandWatermark(src, 'studio', 'none')
    expect(out).toBe(src)
  })
})

describe('IMG — EF image-gen system rules + BEN2 + ห้ามร้านขนมหวาน', () => {
  it('มี กฎเหล็ก Geometry Lock / #FFFFFF / 100mm macro / ห้ามตีความเป็นร้านขนมหวาน', () => {
    expect(imageGenSrc).toContain('100mm macro look, tack-sharp focus')
    expect(imageGenSrc).toContain('#FFFFFF')
    expect(imageGenSrc).toContain('Geometry Lock')
    expect(imageGenSrc).toContain('ห้ามตีความว่า Bite Me Baby เป็นร้านขนมหวาน')
    expect(imageGenSrc).toContain('ห้ามเจน/วาด/ติดโลโก้')
    expect(imageGenSrc).toContain("role: 'system'")
  })
  it('มี BEN2 removeBackground + fallback manual + bg_removed', () => {
    expect(imageGenSrc).toContain('BEN2_ENDPOINT')
    expect(imageGenSrc).toContain('removeBackgroundBEN2')
    expect(imageGenSrc).toContain("fallback = 'manual'")
    expect(imageGenSrc).toContain('bg_removed')
  })
  it('ไม่คงคำว่า "ร้านของหวาน" ใน presets แล้ว', () => {
    expect(imageGenSrc).not.toContain('ร้านของหวาน')
  })
  it('รับ JSON payload fields (menu_name/category/container_type/texture_keywords)', () => {
    expect(imageGenSrc).toContain('menu_name')
    expect(imageGenSrc).toContain('container_type')
    expect(imageGenSrc).toContain('texture_keywords')
  })
})

describe('IMG — UI กล่องพรอมป์เสริมเฉพาะ studio + สถานะ', () => {
  it('AdminMarketing + ContentTab มีกล่อง studio-only + ใช้ buildStudioPayload/finalizeStudioImage', () => {
    for (const src of [marketingSrc, contentTabSrc]) {
      expect(src).toContain('mk-studio-extra-prompt')
      expect(src).toContain("genKind === 'studio'")
      expect(src).toContain('buildStudioPayload')
      expect(src).toContain('finalizeStudioImage')
    }
  })
  it('คงค่ามาตรฐาน 1024 + webp 0.85', () => {
    expect(STUDIO_PAD_SIZE).toBe(1024)
    expect(ALPHA_WEBP_QUALITY).toBe(0.85)
  })
})