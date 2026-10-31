// ============================================
// Bite Me Baby — R34 contracts (Owner 2026-10-30 · 11 คำสั่ง)
// ============================================
// source contracts + pure checks รวมในที่เดียว (กัน regression ข้ามไฟล์)
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import homeSrc from '../pages/HomePage.tsx?raw'
import roundsSrc from '../pages/admin/AdminRounds.tsx?raw'
import footerSrc from '../components/layout/Footer.tsx?raw'
import marketingSrc from '../pages/admin/AdminMarketing.tsx?raw'
import imageGenSrc from '../../supabase/functions/image-gen/index.ts?raw'
import socialSrc from '../lib/socialLinks.ts?raw'
import homePopularSrc from '../lib/homePopular.ts?raw'
import { REAL_REVIEW_PHOTOS } from '@/lib/realReviews'
import { resolvePopularItems, DEFAULT_HOME_POPULAR } from '@/lib/homePopular'
import type { Product, ProductCategory } from '@/types'

describe('R34 · หน้าแรก = หัวข้อแอดมิน + อัลบั้มรีวิวจริง + การ์ดชวนเพื่อนจริง', () => {
  it('หัวข้อเซกชันโหมด = ชื่อหมวดจากแอดมิน (ไม่ hardcode) — แท็บ + h2 ใช้ตัวแปรเดียวกัน', () => {
    expect(homeSrc).toContain("modeSectionTitle('same_day'")
    expect(homeSrc).toContain("modeSectionTitle('pre_order'")
    expect(homeSrc).toContain('sameDaySectionTitle')
    expect(homeSrc).toContain('preOrderSectionTitle')
    // h2/แท็บต้อง render ตัวแปร (ไม่ใช่สตริงตายตัวเดิม — fallback ห้ามฝังใน JSX)
    expect(homeSrc).not.toContain('>🚗 ส่งวันนี้</h2>')
    expect(homeSrc).not.toContain('>{🚗 ส่งวันนี้}<')
  })

  it('เมนูยอดนิยม: resolvePopularItems ส่ง schedule — pre-order ไม่มีปฏิทินถูกกรองออก', () => {
    expect(homeSrc).toContain('resolvePopularItems(products, categories, popularCfg, undefined, scheduleMap)')
    expect(homePopularSrc).toContain('productModeOf(p)')
    expect(homePopularSrc).toContain('!schedule[p.id]')
    // pure: pre-order ไม่มี schedule → ไม่ติดลิสต์ · มี schedule/เซมเดย์ → ติด
    const cat = { id: 'c1', name: 'จองล่วงหน้า', slug: 'preorder', icon: '', sort_order: 1, is_active: true, created_at: '' } as ProductCategory
    const pre = (id: string, sched?: boolean): Product => ({
      id, name: id, description: '', price: 10, category_id: 'c1', image_url: '', is_available: true,
      is_featured: false, is_preorder: !!sched, available_preorder: true, available_same_day: false,
      prep_minutes: 10, sort_order: 1, created_at: '',
      ...(sched ? {} : {}),
    } as Product)
    const out = resolvePopularItems([pre('no-cal'), pre('on-cal', true)], [cat], { ...DEFAULT_HOME_POPULAR, productIds: ['no-cal', 'on-cal'], disabledIds: [], autoRotate: false }, Date.now(), { 'on-cal': '2026-11-01' })
    expect(out.map((p) => p.id)).toEqual(['on-cal'])
  })

  it('อัลบั้มรีวิวจริง mount บนหน้าแรก + รายชื่อ = ไฟล์จริง 32 ใบ (ไม่มีรูปผี 404)', () => {
    expect(homeSrc).toContain('<ReviewGallerySection')
    expect(REAL_REVIEW_PHOTOS.length).toBe(32)
    const dir = path.resolve(__dirname, '../../public/assets/reviews/small')
    const onDisk = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort()
    const inCode = REAL_REVIEW_PHOTOS.map((p) => p.src.split('/').pop()).sort()
    expect(inCode).toEqual(onDisk)
  })

  it('การ์ดชวนเพื่อน = policy จริงจากแอดมิน (referral_policy) — ห้าม hardcode ฿30 · ปิดนโยบาย = ไม่โชว์', () => {
    expect(homeSrc).toContain("settings?.['referral_policy']")
    expect(homeSrc).toContain('referral?.enabled')
    expect(homeSrc).not.toContain('รับคูปองคนละ ฿30')
  })
})

describe('R34 · AdminRounds กระชับ — หน้าต่าง 7/14 วัน + ซ่อนวันผ่าน/นอกหน้าต่าง', () => {
  it('มี control หน้าต่าง + กรองวัน (ค่าเริ่มต้น 7 วัน · วันผ่าน/นอก = ซ่อน ดูย้อนหลังได้ ไม่ลบ)', () => {
    expect(roundsSrc).toContain('rounds-window-7')
    expect(roundsSrc).toContain('rounds-window-14')
    expect(roundsSrc).toContain('rounds-show-past')
    expect(roundsSrc).toContain("useState<7 | 14>(7)")
    expect(roundsSrc).toContain('d < todayStr') // past partition
    expect(roundsSrc).toContain('d > windowEnd') // beyond partition
    expect(roundsSrc).toContain('visibleDates')
    expect(roundsSrc).toContain('showPast ? pastDates : []')
  })
})

describe('R34 · Footer — ลิงก์ชวนเพื่อนจริง + โลโก้จริงจาก public/', () => {
  it('footer ชี้ /share (ระบบ referral จริง) — ไม่ใช่ /viral (หน้า mock)', () => {
    expect(footerSrc).toContain("path: '/share'")
    expect(footerSrc).not.toContain("path: '/viral'")
    expect(footerSrc).toContain('social.img')
    expect(socialSrc).toContain("/Facebook Logo.webp")
    expect(socialSrc).toContain("/line logo.webp")
    // ไฟล์โลโก้มีจริงบนดิสก์ (รวม line logo ที่ต้อง git add)
    expect(fs.existsSync(path.resolve(__dirname, '../../public/Facebook Logo.webp'))).toBe(true)
    expect(fs.existsSync(path.resolve(__dirname, '../../public/line logo.webp'))).toBe(true)
  })
})

describe('R34 · Marketing — รูปเมนูใช้ภาพจริง · ห้ามเจนรูปอาหาร · โมเดล image ที่มีจริง', () => {
  it('Picker select image_url + แนบรูปจริง + UI ไม่เสนอเมนูอาหาร + EF ไม่ตายเพราะโมเดลร้าง', () => {
    expect(marketingSrc).toContain("select('id,name,price,is_preorder,available_preorder,available_same_day,is_available,image_url')")
    expect(marketingSrc).toContain('setImages(p.image_url ? [p.image_url] : [])')
    expect(marketingSrc).not.toContain('<option value="menu">')
    expect(marketingSrc).toContain("genKind === 'menu'")
    expect(imageGenSrc).toContain('IMAGE_MODEL_CANDIDATES')
    expect(imageGenSrc).toContain('google/gemini-3.1-flash-image')
    // โมเดลร้างที่เคยทำ image-gen พัง (R32 error) ต้องออกจาก default
    expect(imageGenSrc).not.toContain('google/gemini-2.5-flash-image-preview')
    expect(imageGenSrc).not.toContain('google/gemini-2.0-flash-preview-image-generation')
  })
})
