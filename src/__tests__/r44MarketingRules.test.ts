// ============================================
// Bite Me Baby — R44 marketing rules (Owner 2026-11-01, updated 2026-11-20)
//   เดิม: ภาพเจน = รูปเดียวตอนสร้างโพสต์ (ห้ามขึ้นต้นแบบ+เจนคู่กัน)
//   ใหม่ (เจ้าของสั่ง 2026-11-20): ยกเลิก R44 — เลือกผสมเมนู+ภาพเจน+อัปโหลดได้สูงสุด 5 รูปต่อโพสต์
//   ② footer บังคับทุกโพส: สั่งใต้โพส · Messenger · เว็บ · ปิดการขายทุกช่องทางใส่ตะกร้า
// ============================================

import { describe, it, expect } from 'vitest'
import marketingSrc from '../pages/admin/AdminMarketing.tsx?raw'
import publishSrc from '../../supabase/functions/social-publish-worker/index.ts?raw'

describe('R44 — เลือกรูปผสมได้สูงสุด 5 รูป (ยกเลิกกติกา gen-single ตามสั่งเจ้าของ 2026-11-20)', () => {
  it('AdminMarketing: มีค่าคงที่ MAX_POST_IMAGES = 5 และ helper addImages', () => {
    expect(marketingSrc).toContain('export const MAX_POST_IMAGES = 5')
    expect(marketingSrc).toContain('function addImages(')
  })
  it('AdminMarketing: pickAiImage = toggle เลือก/เลิกเลือก (ไม่ใช่ setImages([url]) ทับชุด)', () => {
    expect(marketingSrc).toContain('function pickAiImage(url: string)')
    expect(marketingSrc).not.toContain('setImages([url])')
    expect(marketingSrc).toContain('if (prev.includes(url))')
    expect(marketingSrc).toContain('if (prev.length >= MAX_POST_IMAGES)')
  })
  it('AdminMarketing: ไม่มีตัวกรอง gen-single (R44 ถูกยกเลิก) — ส่ง images ทั้งชุด', () => {
    expect(marketingSrc).not.toContain('const genOnes = images.filter(isGenImage)')
    expect(marketingSrc).not.toContain('const postImages = genOnes.length > 0 ? [genOnes[genOnes.length - 1]] : images')
    expect(marketingSrc).toContain('const postImages = images.slice(0, MAX_POST_IMAGES)')
  })
  it('AdminMarketing: ไม่มีแถบเตือน mk-images-gen-only และข้อความ "จะไม่ถูกแนบคู่กัน"', () => {
    expect(marketingSrc).not.toContain('mk-images-gen-only')
    expect(marketingSrc).not.toContain('จะไม่ถูกแนบคู่กัน')
  })
  it('AdminMarketing: อัลบั้ม AI โชว์สถานะ selected (ขอบสีแบรนด์ + ✓ + ปุ่ม "เลิก")', () => {
    expect(marketingSrc).toContain('const isSelected = images.includes(a.url)')
    expect(marketingSrc).toContain("isSelected ? 'border-2 border-brand-primary'")
    expect(marketingSrc).toContain('isSelected && (')
    expect(marketingSrc).toContain('isSelected ? \'เลิก\' : \'ใช้\'')
  })
  it('AdminMarketing: Planner จิ้มเมนู = append เข้าชุด (addImages) ไม่ทับชุดเดิม', () => {
    expect(marketingSrc).toContain('if (p.image_url) {')
    expect(marketingSrc).toContain('addImages([p.image_url!])')
  })
  it('AdminMarketing: Studio มีการ์ด "เลือกจากเมนูทั้งหมด" append เข้าชุดภาพโพสต์', () => {
    expect(marketingSrc).toContain('mk-studio-menu-picker')
    expect(marketingSrc).toContain('mk-studio-pick-')
    expect(marketingSrc).toContain('addImages([p.image_url!])')
  })
  it('R79 (เจ้าของ 2026-11-20): Studio picker = แท็บหัวข้อเมนูจริง (buildHeadingGroups) · ครบทุกเมนู ไม่มีเพดาน 20', () => {
    // ตัวจัดกลุ่มเดียวกับ /shop และ /menu — หัวข้อใหม่/เมนูใหม่ที่แอดมินเพิ่มอนาคตเข้าอัตโนมัติ
    expect(marketingSrc).toContain('buildHeadingGroups(catalog, menuCategories)')
    expect(marketingSrc).toContain('mk-studio-menu-tabs')
    expect(marketingSrc).toContain('mk-studio-tab-${g.category.id}')
    expect(marketingSrc).toContain('getProducts()')
    expect(marketingSrc).toContain('getCategories()')
    // ไม่มีเพดาน 20 รายการ (ข้อความเดิมถูกลบ) · เมนูไม่มีรูป = โชว์แต่กดไม่ได้ (🚫)
    expect(marketingSrc).not.toContain('แสดง 20 รายการแรก')
    expect(marketingSrc).not.toContain('.slice(0, 20)')
    expect(marketingSrc).toContain('ยังไม่มีรูปในระบบ')
  })
  it('AdminMarketing: handleBrowseImage รับ multiple files + ย่อ 1080px/500KB + อัปขึ้น uploads/', () => {
    expect(marketingSrc).toContain('multiple')
    expect(marketingSrc).toContain('POST_IMAGE_MAX_SIDE')
    expect(marketingSrc).toContain('POST_IMAGE_MAX_BYTES')
    expect(marketingSrc).toContain('uploads/mk-')
  })
  it('AdminMarketing: ตัวนับภาพ "N/5" ในชุดภาพและ PostForm', () => {
    expect(marketingSrc).toContain('แนบรูปแล้ว {images.length}/{MAX_POST_IMAGES} รูป')
    expect(marketingSrc).toContain('แนบรูปแล้ว {props.images.length}/{MAX_POST_IMAGES} รูป')
  })
})

describe('R44 — footer บังคับคู่โพสทุกครั้ง (publish path เดียว = social-publish-worker)', () => {
  it('มี POST_CTA_FOOTER ครบ 5 ข้อ (R46 += แจ้งลิงก์นอก FB) + withPostCta idempotent', () => {
    expect(publishSrc).toContain('POST_CTA_FOOTER')
    expect(publishSrc).toContain('🛒 สั่งใต้โพสนี้ได้เลย')
    expect(publishSrc).toContain('💬 หรือทักไปสั่งใน Messenger')
    // R75 (Owner 2026-11-07: "ลิ้งที่เอไอสร้างใช้ไม่ได้เลยสักลิ้ง") — ลิงก์ต้องเป็น https:// URL
    // เต็มรูปแบบ (แตะได้จริงบน Facebook) — เดิม hard-code โดเมนเปล่า = ตัวบั๊กเอง
    expect(publishSrc).toContain('🌐 สั่งต่อที่เว็บ https://biteme-baby.com/shop')
    expect(publishSrc).toContain('✅ ปิดการขายผ่านช่องทางไหนก็ได้')
    expect(publishSrc).toContain('🔗 ลิงก์เปิดเว็บภายนอก Facebook — เปิดไม่ออก? กดคัดลอกลิงก์ในแถบที่ขึ้น แล้ววางใน Chrome/Safari')
    expect(publishSrc).toContain('function withPostCta(text: string): string')
    expect(publishSrc).toContain("base.includes('ปิดการขายผ่านช่องทางไหนก็ได้')")
  })
  it('publishToFeed ต้องรับข้อความผ่าน withPostCta เสมอ', () => {
    expect(publishSrc).toContain('withPostCta(`${row.title}')
  })
  it('social-publish-worker: รองรับ attached_media สูงสุด 5 รูป (เพิ่มจาก 4 ตามสั่งเจ้าของ)', () => {
    expect(publishSrc).toContain('imageUrls.slice(0, 5)')
    // publishToFeed ใช้ slice(0, 5) สองจุด: ในฟังก์ชันและใน handler
    const matches = publishSrc.match(/slice\(0, 5\)/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(2)
  })
})