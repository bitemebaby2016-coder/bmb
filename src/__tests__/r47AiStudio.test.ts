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
import imageGenSrc from '../../supabase/functions/image-gen/index.ts?raw'

describe('R47 — ยกเลิกกฎห้ามเจนอาหาร + ข้อความโปรโมตตรงเนื้อหาโพสต์', () => {
  it('UI เสนอภาพเมนู/อาหาร + ไม่บล็อก return + EF prompt ใช้รูปต้นแบบ/ข้อความตามรายละเอียด', () => {
    expect(marketingSrc).toContain('<option value="menu">')
    expect(marketingSrc).toContain("genKind === 'menu' && !reference")
    expect(marketingSrc).toContain('ต้นแบบไดคัท')
    // EF presets: เมนูใช้ภาพต้นแบบ · promo/festival เขียนอักษรตาม note ที่ให้มา (ไม่ใช่ "ไม่มีตัวอักษร")
    expect(imageGenSrc).toContain('ภาพเมนูตัวอย่างแนบมาให้ใช้เป็นต้นแบบไดคัท')
    expect(imageGenSrc).toContain('ข้อความโปรโมตบนภาพต้องตรงกับรายละเอียดนี้เป๊ะ')
    expect(imageGenSrc).not.toContain('ไม่มีตัวอักษรยาว')
    expect(imageGenSrc).not.toContain('พื้นที่ว่างสำหรับข้อความ')
  })
})

describe('R47 — ยุบสองเซคชั่นเป็นใบเดียว + เจนซ้อน + ลบจริง', () => {
  it('PostForm ยุบเข้าใบเดียวกับเครื่องมือภาพ (mk-studio-merged) + strip มีปุ่ม ✕ ลบไฟล์จริง', () => {
    expect(marketingSrc).toContain('data-testid="mk-studio-merged"')
    expect(marketingSrc).toContain('สองเซคชั่นของหน้าเอไอสตูดิโอ ยุบรวมกัน')
    expect(marketingSrc).toContain('setImages((prev) => [...prev, wmUrl])')
    expect(marketingSrc).toContain('data-testid={`mk-img-del-${images.indexOf(u)}`}')
    expect(marketingSrc).toContain(".from('bmb-images').remove([path])")
    expect(marketingSrc).toContain('ลบรูปออกจากชุดภาพ + ลบไฟล์จริงจากคลังภาพแล้ว')
    // ลบต้นฉบับหลังอัปรูปลายน้ำ (เหลือเฉพาะรูปที่มีลายน้ำในอัลบั้ม)
    expect(marketingSrc).toContain("await supabase.storage.from('bmb-images').remove([decodeURIComponent(p)])")
  })
})

describe('R47 — ลายน้ำโลโก้จริง + มาสคอตอัตโนมัติ + จำค่า', () => {
  it('applyBrandWatermark ใช้ Logo_Sticker_Circle + mascot จาก /assets/mascot + เลือกตาม kind + จำ localStorage', () => {
    expect(marketingSrc).toContain('applyBrandWatermark(data.url, genKind, wmMascot)')
    expect(marketingSrc).toContain("fetchBitmap('/Logo_Sticker_Circle.webp')")
    expect(marketingSrc).toContain('`/assets/mascot/${mascotKey}.webp`')
    expect(marketingSrc).toContain("localStorage.getItem('bmb:wm-mascot') || 'auto'")
    expect(marketingSrc).toContain("localStorage.setItem('bmb:wm-mascot', v)")
    expect(marketingSrc).toContain('data-testid="mk-wm-mascot"')
    expect(marketingSrc).toContain("'Bite Me Baby'")
  })

  it('autoMascotForKind: menu→bite_menu · festival→bite_award · อื่น ๆ →bite_recommend', () => {
    expect(autoMascotForKind('menu')).toBe('bite_menu')
    expect(autoMascotForKind('festival')).toBe('bite_award')
    expect(autoMascotForKind('promo')).toBe('bite_recommend')
  })
})