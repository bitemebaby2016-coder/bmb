// ============================================
// Bite Me Baby — R44 marketing rules (Owner 2026-11-01)
//   ① ภาพเจน = รูปเดียวตอนสร้างโพสต์ (ห้ามขึ้นต้นแบบ+เจนคู่กัน)
//   ② footer บังคับทุกโพส: สั่งใต้โพส · Messenger · เว็บ · ปิดการขายทุกช่องทางใส่ตะกร้า
// ============================================

import { describe, it, expect } from 'vitest'
import marketingSrc from '../pages/admin/AdminMarketing.tsx?raw'
import publishSrc from '../../supabase/functions/social-publish-worker/index.ts?raw'

describe('R44 — ภาพเจนใช้รูปเดียวตอนสร้างโพสต์', () => {
  it('AdminMarketing: isGenImage + submit กรองใช้ภาพเจนรูปสุดท้ายรูปเดียว', () => {
    expect(marketingSrc).toContain("const isGenImage = (u: string) => u.includes('/ai-generated/')")
    expect(marketingSrc).toContain('const genOnes = images.filter(isGenImage)')
    expect(marketingSrc).toContain('const postImages = genOnes.length > 0 ? [genOnes[genOnes.length - 1]] : images')
    expect(marketingSrc).toContain('image_urls: postImages')
  })
  it('R55 "ห้ามเลือกใช้แทนอัตโนมัติ" — ไม่ append เข้าชุด + ตรวจคุณภาพ + ปุ่ม ใช้/ปิด/ลบ ที่อัลบั้ม', () => {
    // R55 (Owner 2026-11-02): "ภาพที่เจนมาพอไปอยู่ในเมนูแล้วเบี้ยวเละเทะ ขนาดไม่ตรง
    //   ห้ามเลือกมาใช้แทนโดยอัตโนมัติ" → เจนแล้วอยู่ที่อัลบั้มเท่านั้น (ไม่ต่อชุดภาพอัตโนมัติ)
    expect(marketingSrc).not.toContain('setImages((prev) => [...prev, wmUrl])')
    expect(marketingSrc).toContain('checkGenQuality(wmUrl, genKind)')
    expect(marketingSrc).toContain('data-testid="mk-gen-qa-warn"')
    // ปุ่มต่อรูป: ใช้ (pickAiImage) · ปิด/เปิด (toggleAiImage = ย้ายไฟล์จริง) · ลบ (deleteAiImage)
    expect(marketingSrc).toContain('data-testid={`mk-ai-pick-${a.name}`}')
    expect(marketingSrc).toContain('data-testid={`mk-ai-toggle-${a.name}`}')
    expect(marketingSrc).toContain('data-testid={`mk-ai-del-${a.name}`}')
    expect(marketingSrc).toContain('data-testid={`mk-img-del-${images.indexOf(u)}`}')
    expect(marketingSrc).toContain('handleRemoveImage')
    expect(marketingSrc).toContain(".from('bmb-images').remove([path])")
    expect(marketingSrc).toContain('function pickAiImage(url: string)')
    expect(marketingSrc).toContain('setImages([url])')
    expect(marketingSrc).toContain('data-testid="mk-images-gen-only"')
    expect(marketingSrc).toContain('จะไม่ถูกแนบคู่กัน')
  })
})

describe('R44 — footer บังคับคู่โพสทุกครั้ง (publish path เดียว = social-publish-worker)', () => {
  it('มี POST_CTA_FOOTER ครบ 5 ข้อ (R46 += แจ้งลิงก์นอก FB) + withPostCta idempotent', () => {
    expect(publishSrc).toContain('POST_CTA_FOOTER')
    expect(publishSrc).toContain('🛒 สั่งใต้โพสนี้ได้เลย')
    expect(publishSrc).toContain('💬 หรือทักไปสั่งใน Messenger')
    expect(publishSrc).toContain('🌐 สั่งต่อที่เว็บ biteme-baby.com/shop')
    expect(publishSrc).toContain('✅ ปิดการขายผ่านช่องทางไหนก็ได้')
    expect(publishSrc).toContain('🔗 ลิงก์เปิดเว็บภายนอก Facebook — แตะเพื่อยืนยันเปิดในเบราว์เซอร์ของคุณ')
    expect(publishSrc).toContain('function withPostCta(text: string): string')
    expect(publishSrc).toContain("base.includes('ปิดการขายผ่านช่องทางไหนก็ได้')")
  })
  it('publishToFeed ต้องรับข้อความผ่าน withPostCta เสมอ', () => {
    expect(publishSrc).toContain('withPostCta(`${row.title}')
  })
})