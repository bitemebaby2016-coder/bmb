// ============================================
// Bite Me Baby — R59: เพิ่มเมนู → บราวซ์ภาพที่เจน + ชี้ไฟล์เข้าคลัง + ลดขนาดอัตโนมัติ
//   (Owner: "รูปที่เจนให้บร้าวจากการเพิ่มเมนูแล้วชี้ไฟล์ไปที่เก็บมาเลือกใช้ได้
//    และให้ลดขนาดอัตโนมัติเมื่อเลือกมาใช้")
// ============================================
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const adminSrc = read('src/pages/admin/AdminProducts.tsx')
const mediaSrc = read('src/lib/bmbAdminApi_media.ts')

describe('R59 ① — หน้าเพิ่ม/แก้เมนู: เลือกรูปจากภาพที่เจน (ai-generated) + ย่ออัตโนมัติ', () => {
  it('AdminProducts: ปุ่มบราวซ์ + พาเนลคลัง + handler เลือก/ย่อ/อัปโหลดครบ + auto-scroll', () => {
    expect(adminSrc).toContain('data-testid="product-ai-browse"')
    expect(adminSrc).toContain('data-testid="product-ai-album"')
    expect(adminSrc).toContain('data-testid={`product-ai-pick-${a.name}`}')
    expect(adminSrc).toContain('function handleAiBrowse')
    expect(adminSrc).toContain('async function handleAiPick')
    // เลือกจากคลัง = ดึงไฟล์จริง → ย่ออัตโนมัติ → อัปโหลดเข้าคลัง → image_url ชี้ไฟล์ใน storage
    expect(adminSrc).toContain('const res = await fetch(item.url)')
    expect(adminSrc).toContain('const small = await downscaleImageFile(src)')
    expect(adminSrc).toContain('const up = await uploadProductImage(small')
    expect(adminSrc).toContain('listAiAlbumFiles()')
    // ทางไฟล์/กล้อง ก็ย่ออัตโนมัติก่อน validate (รูปเจน 5.8MB เคยโดน reject ที่ MAX_IMAGE_BYTES)
    expect(adminSrc).toContain('const sized = await downscaleImageFile(file)')
    expect(adminSrc).toContain('const v = validateImageFile(sized)')
    // rule 12.3: เปิดพาเนล = เลื่อนไปที่พาเนลทันที
    expect(adminSrc).toContain('aiPanelRef.current?.scrollIntoView')
  })

  it('media lib: downscaleImageFile (EXIF ถูก + jpeg q0.82 + maxSide 1024 + gif/decode ไม่แตะ) + listAiAlbumFiles (3 หมวด + รูต · ไม่เอา _disabled)', () => {
    expect(mediaSrc).toContain("createImageBitmap(file, { imageOrientation: 'from-image' })")
    expect(mediaSrc).toContain('canvas.toBlob((b) => resolve(b), \'image/jpeg\', quality)')
    expect(mediaSrc).toContain('export const PRODUCT_IMAGE_MAX_SIDE = 1024')
    expect(mediaSrc).toContain('export const PRODUCT_IMAGE_QUALITY = 0.82')
    expect(mediaSrc).toContain("if (file.type === 'image/gif') return file")
    // คืนไฟล์เดิมเมื่อเล็กรอบแล้ว (ไม่ย่อฟรี) — decode ไม่ได้/ctx ไม่พร้อม = zero-fake คืนเดิม
    expect(mediaSrc).toContain('if (longest <= maxSide && file.size <= PRODUCT_IMAGE_ALREADY_OK_BYTES) return file')
    expect(mediaSrc).toContain('if (!bmp) return file')
    // คลัง: ai-generated/{menu,promo,festival} + ไฟล์รูต (id=null = โฟลเดอร์ → ข้าม)
    expect(mediaSrc).toContain("for (const kind of ['menu', 'promo', 'festival'])")
    expect(mediaSrc).toContain('ai-generated/${kind}')
    expect(mediaSrc).toContain('f.id == null')
    expect(mediaSrc).not.toContain('ai-generated/_disabled')
  })
})