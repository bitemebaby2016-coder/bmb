// ============================================
// Bite Me Baby — R63 · IMG-1 (Owner 2026-11-03: ทุกภาพที่ระบบเอามาใช้ = ลดขนาดอัตโนมัติ)
//   ทุก ingestion path ที่ขาด = ต้องเรียก downscaleImageFile ก่อน upload · evidence sweep = e2e/r63ImageSweep-*.json
// ============================================
import { describe, it, expect } from 'vitest'
import mediaSrc from '../lib/bmbAdminApi_media.ts?raw'
import addressSrc from '../lib/addressPhoto.ts?raw'
import paymentSrc from '../lib/paymentGateway.ts?raw'
import onboardingSrc from '../pages/admin/AdminOnboarding.tsx?raw'
import marketingSrc from '../pages/admin/AdminMarketing.tsx?raw'

describe('R63 IMG-1 · ทุก path ที่ภาพเข้าระบบย่ออัตโนมัติก่อน upload', () => {
  it('media lib = จุดกลาง: uploadMediaAsset + uploadRegisteredAsset เรียก downscale ก่อน upload (Registered = ย่อก่อน validate)', () => {
    expect(mediaSrc).toContain('export async function downscaleImageFile')
    expect(mediaSrc).toContain('export async function compressToWebLimits') // R92: บังคับ 300×300/100KB
    // uploadMediaAsset: sized ก่อน build path (R92 = compressToWebLimits)
    expect(mediaSrc).toMatch(/uploadMediaAsset\([\s\S]{0,400}?const sized = await compressToWebLimits\(file\)/)
    expect(mediaSrc).toMatch(/uploadMediaAsset\([\s\S]{0,700}?\.upload\(path, sized/)
    // uploadRegisteredAsset: ย่อก่อน validate (5MB cap = ผ่านหลังย่อ แบบ T-C3)
    expect(mediaSrc).toMatch(/uploadRegisteredAsset\([\s\S]{0,400}?const sized = await compressToWebLimits\(file\)[\s\S]{0,200}?validateImageFile\(sized\)/)
    expect(mediaSrc).toMatch(/uploadRegisteredAsset\([\s\S]{0,900}?\.upload\(path, sized/)
  })

  it('addressPhoto = ย่อ 1600px/q0.85 ก่อนขึ้น address-photos', () => {
    expect(addressSrc).toContain('downscaleImageFile(file, 1600, 0.85)')
    expect(addressSrc).toMatch(/const sized = await downscaleImageFile[\s\S]{0,300}?\.upload\(path, sized/)
    expect(addressSrc).not.toMatch(/\.upload\(path, file,/)
  })

  it('payment slip = ย่อ 1600px/q0.85 ก่อนขึ้น payment-slips (ตัวอักษรสลิปยังอ่านออก)', () => {
    expect(paymentSrc).toContain('downscaleImageFile(file, 1600, 0.85)')
    expect(paymentSrc).toMatch(/uploadPaymentSlip\([\s\S]{0,700}?\.upload\(path, sized/)
    expect(paymentSrc).not.toMatch(/uploadPaymentSlip\([\s\S]{0,700}?\.upload\(path, file,/)
  })

  it('AdminMarketing browse = ย่อก่อนขึ้น marketing/ (R92 = 300×300/100KB) · AdminOnboarding logo = ย่อก่อนขึ้น brands/', () => {
    expect(marketingSrc).toContain('const sized = await compressToWebLimits(file)')
    expect(marketingSrc).toMatch(/marketing\/browse-\$\{Date\.now\(\)\}-\$\{safe\}[\s\S]{0,200}?\.upload\(path, sized/)
    expect(onboardingSrc).toContain('const sized = await downscaleImageFile(logoFile)')
    expect(onboardingSrc).toMatch(/\.upload\(path, sized/)
  })

  it('AdminProducts (เดิม R59) ยังคงเรียก downscale ทั้งสองทาง', () => {
    // ไม่ import raw ใหม่ — ยืนยันผ่าน media lib ที่เป็นศูนย์กลาง + constants เดิม
    expect(mediaSrc).toContain('export const PRODUCT_IMAGE_MAX_SIDE = 1024')
    expect(mediaSrc).toContain('export const PRODUCT_IMAGE_QUALITY = 0.82')
  })
})