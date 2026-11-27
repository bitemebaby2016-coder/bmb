// ============================================
// Bite Me Baby — R47 AI Studio (Owner 2026-11-01)
//   ① ยกเลิกกฎห้ามเจนภาพอาหาร · รูปเมนูตัวอย่าง = ต้นแบบไดคัท
//   ② ข้อความโปรโมตบนภาพ = ตรงรายละเอียดเนื้อหาโพสต์
//   ③ ยุบสองเซคชั่นสตูดิโอเป็นใบเดียว
//   ④ เจนซ้อนหลายภาพ + ปุ่มลบจริง (ลบไฟล์จากคลัง)
//   ⑤ ลายน้ำ = โลโก้แบรนด์จริง + มาสคอตอัตโนมัติ + จำค่าไว้ใช้ทุกภาพ
// ============================================
import { describe, it, expect } from 'vitest'
import { autoMascotForKind } from '@/pages/admin/AdminMarketing'
import marketingSrc from '../pages/admin/AdminMarketing.tsx?raw'
import studioSrc from '../lib/aiImageStudio.ts?raw'
import imageGenSrc from '../../supabase/functions/image-gen/index.ts?raw'

describe('R47 — ยกเลิกกฎห้ามเจนภาพอาหาร + ข้อความโปรโมตตรงเนื้อหาโพสต์', () => {
  it('UI เสนอภาพเมนู/อาหาร + ไม่บล็อก return + EF prompt ใช้รูปต้นแบบ/ข้อความตามรายละเอียด', () => {
    expect(marketingSrc).toContain('<option value="menu">')
    expect(marketingSrc).toContain('<option value="studio">')
    expect(marketingSrc).toContain("genKind === 'menu' || genKind === 'studio'")
    expect(marketingSrc).toContain('ต้นแบบไดคัท')
    // EF presets: เมนูใช้ภาพต้นแบบ · promo/festival เขียนอักษรตาม note ที่ให้มา (ไม่ใช่ "ไม่มีตัวอักษร")
    expect(imageGenSrc).toContain('ภาพเมนูตัวอย่างแนบมาให้ใช้เป็นต้นแบบไดคัท')
    expect(imageGenSrc).toContain('ข้อความโปรโมตบนภาพต้องตรงกับรายละเอียดส่วนลดนี้เป๊ะ')
    expect(imageGenSrc).toContain('ห้ามเขียนข้อความลดราคา/เปอร์เซ็นต์/คูปอง/โค้ดส่วนลด ใด ๆ บนภาพ')
    expect(imageGenSrc).not.toContain('ไม่มีตัวอักษรยาว')
    expect(imageGenSrc).not.toContain('พื้นที่ว่างสำหรับข้อความ')
  })
})

describe('R47 — ยุบสองเซคชั่นเป็นใบเดียว + เจนซ้อน + ลบจริง', () => {
  it('PostForm ยุบเข้าใบเดียวกับเครื่องมือภาพ (mk-studio-merged) + strip มีปุ่ม ✕ ลบไฟล์จริง', () => {
    expect(marketingSrc).toContain('data-testid="mk-studio-merged"')
    expect(marketingSrc).toContain('สองเซคชั่นของหน้าเอไอสตูดิโอ ยุบรวมกัน')
    // R55 (Owner): ห้ามเลือกภาพเจนใช้แทนอัตโนมัติ — ไม่ append เข้าชุด (ต้องกด "ใช้ เองจากอัลบั้ม)
    expect(marketingSrc).not.toContain('setImages((prev) => [...prev, wmUrl])')
    expect(marketingSrc).toContain('checkGenQuality(wmUrl, genKind)')
    expect(marketingSrc).toContain('data-testid={`mk-img-del-${images.indexOf(u)}`}')
    expect(marketingSrc).toContain(".from('bmb-images').remove([path])")
    expect(marketingSrc).toContain('ลบรูปออกจากชุดภาพ + ลบไฟล์จริงจากคลังภาพแล้ว')
    // ลบต้นฉบับหลังอัปรูปลายน้ำ (เหลือเฉพาะรูปที่มีลายน้ำในอัลบั้ม)
    expect(marketingSrc).toContain("await supabase.storage.from('bmb-images').remove([decodeURIComponent(p)])")
  })
})

describe('R47 — ลายน้ำโลโก้จริง + มาสคอตอัตโนมัติ + จำค่า', () => {
  it('applyBrandWatermark ใช้ Logo_Sticker_Circle + mascot จาก Admin Override + เลือกตาม kind + จำ localStorage', () => {
    // applyBrandWatermark ย้ายไปแหล่งเดียว src/lib/aiImageStudio.ts
    expect(studioSrc).toContain("fetchBitmap('/Logo_Sticker_Circle.webp')")
    expect(studioSrc).toContain('getOverrideUrl(mascotKey)')
    expect(studioSrc).toContain('compressGeneratedToWeb')
    expect(studioSrc).toContain("'Bite Me Baby'")
    expect(studioSrc).toContain("mascotChoice === 'none'")
    expect(studioSrc).toContain("key: 'none'")
    // UI เรียก applyBrandWatermark + จำค่าใน localStorage
    expect(marketingSrc).toContain('applyBrandWatermark(data.url, genKind, wmMascot)')
    expect(marketingSrc).toContain("localStorage.getItem('bmb:wm-mascot') || 'auto'")
    expect(marketingSrc).toContain("localStorage.setItem('bmb:wm-mascot', v)")
    expect(marketingSrc).toContain('data-testid="mk-wm-mascot"')
    // ป้ายมาสคอตตัด (R47 — ทุกภาพเจน) ออกแล้ว
    expect(marketingSrc).not.toContain('มาสคอตลายน้ำ (R47 — ทุกภาพเจน)')
  })

  it('autoMascotForKind: menu/studio→menu · festival→award · อื่น ๆ →recommend', () => {
    expect(autoMascotForKind('menu')).toBe('menu')
    expect(autoMascotForKind('studio')).toBe('menu')
    expect(autoMascotForKind('festival')).toBe('award')
    expect(autoMascotForKind('promo')).toBe('recommend')
  })
})