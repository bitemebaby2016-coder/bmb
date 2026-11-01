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
  it('เจนสำเร็จ/เลือกจากอัลบั้ม = แทนรูปเดิม (setImages รูปเดียว) + คำใบ้ใน strip', () => {
    expect(marketingSrc).toContain('setImages([data.url])')
    expect(marketingSrc).toContain('function pickAiImage(url: string)')
    expect(marketingSrc).toContain('setImages([url])')
    expect(marketingSrc).toContain('data-testid="mk-images-gen-only"')
    expect(marketingSrc).toContain('จะไม่ถูกแนบคู่กัน')
  })
})

describe('R44 — footer บังคับคู่โพสทุกครั้ง (publish path เดียว = social-publish-worker)', () => {
  it('มี POST_CTA_FOOTER ครบ 4 ข้อ + withPostCta idempotent', () => {
    expect(publishSrc).toContain('POST_CTA_FOOTER')
    expect(publishSrc).toContain('🛒 สั่งใต้โพสนี้ได้เลย')
    expect(publishSrc).toContain('💬 หรือทักไปสั่งใน Messenger')
    expect(publishSrc).toContain('🌐 สั่งต่อที่เว็บ biteme-baby.com/shop')
    expect(publishSrc).toContain('✅ ปิดการขายผ่านช่องทางไหนก็ได้')
    expect(publishSrc).toContain('function withPostCta(text: string): string')
    expect(publishSrc).toContain("base.includes('ปิดการขายผ่านช่องทางไหนก็ได้')")
  })
  it('publishToFeed ต้องรับข้อความผ่าน withPostCta เสมอ', () => {
    expect(publishSrc).toContain('withPostCta(`${row.title}')
  })
})