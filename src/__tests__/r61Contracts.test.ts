// ============================================
// Bite Me Baby — R61 contract tests (Owner 2026-11-03)
// ① §T-1 ซ่อมแล้ว: Layout ถอด ?cart= ด้วย decodeCartParam (ไม่ใช่ readCartParam)
// ② สลับโมเดล: qwen-image-2.1-pro ใช้ก่อน seedream (คุม "ลำดับ" ใน default string)
// ③ /admin/promotions: ภาพ+มาสคอต — จากเครื่อง / จากคลังภาพ AI (basket) / มาตรฐาน + พรีวิวประกอบ
// ============================================
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import promoSrc from '../pages/admin/AdminPromotions.tsx?raw'
import promoApiSrc from '../lib/bmbAdminApi_promotions.ts?raw'
import fladSrc from '../components/home/FloatingAdBanners.tsx?raw'
import homeSrc from '../pages/HomePage.tsx?raw'
import layoutSrc from '../components/layout/Layout.tsx?raw'
import imageGenSrc from '../../supabase/functions/image-gen/index.ts?raw'
import cssSrc from '../index.css?raw'

const mig = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/183_promo_banner_mascot.sql'), 'utf8')

describe('R61 · /admin/promotions — ภาพ+มาสคอต แนบเอง/ประกอบเอง', () => {
  it(' PromotionRow + migration มี banner_mascot (คอลัมน์เดียวที่ต้องมีบน production)', () => {
    expect(promoApiSrc).toContain('banner_mascot?: string | null')
    expect(mig).toContain('ADD COLUMN IF NOT EXISTS banner_mascot TEXT')
  })

  it('ฟอร์ม = 3 แหล่ง (เครื่อง · คลังภาพ AI · มาตรฐาน 4 ท่า) + ปุ่มครบ', () => {
    // ภาพจากเครื่อง (มีอยู่แล้ว) + จากคลังภาพ
    expect(promoSrc).toContain('aria-label="เลือกรูปแบนเนอร์จากเครื่อง"')
    expect(promoSrc).toContain('data-testid="promo-banner-album"')
    expect(promoSrc).toContain('listAiAlbumFiles()')
    // มาสคอต: จากเครื่อง + จากคลังภาพ + มาตรฐาน MASCOT_ROTATION + ล้าง
    expect(promoSrc).toContain('data-testid="promo-mascot-file"')
    expect(promoSrc).toContain("uploadMediaAsset(file, 'mascot'")
    expect(promoSrc).toContain('data-testid="promo-mascot-album"')
    expect(promoSrc).toContain('data-testid={`promo-mascot-std-${i}`}')
    expect(promoSrc).toContain('MASCOT_ROTATION.map')
    expect(promoSrc).toContain('data-testid="promo-mascot-clear"')
    // คลังภาพ: เลือกแล้วใส่ "ภาพ" หรือ "มาสคอต" ตามปุ่มที่เปิด
    expect(promoSrc).toContain("albumPanel === 'mascot'")
    expect(promoSrc).toContain('data-testid={`promo-album-pick-${i}`}')
  })

  it('มีพรีวิวประกอบด้วยคลาสชุดเดียวกับการ์ดหน้าแรก (ประกอบเองเห็นเป๊ะ)', () => {
    expect(promoSrc).toContain('data-testid="promo-compose-preview"')
    expect(promoSrc).toContain('className="flad-media"')
    expect(promoSrc).toContain('flad-mascot-composed flad-mascot-pos-')
    // CSS ตัวเดียวกันกับหน้าแรก (ไม่ใช่ styles แยกชุด)
    expect(cssSrc).toContain('.flad-media img.flad-mascot-composed')
  })

  it('บันทึก/แก้ไขอ่าน-เขียน banner_mascot (create = form · edit = promo)', () => {
    expect(promoSrc).toContain('banner_mascot: form.banner_mascot || null')
    expect(promoSrc).toContain('banner_mascot: promo.banner_mascot ||')
    expect(promoSrc).toContain("banner_mascot: '',")
  })

  it('หน้าแรกส่งต่อ + FloatingAdBanners ใช้มาสคอตของโปรโมชั่น (ว่าง = สลับตามเดิม)', () => {
    expect(homeSrc).toContain('mascot: r.banner_mascot')
    expect(fladSrc).toContain('mascot?: string')
    expect(fladSrc).toContain('const promoMascot = promo.mascot || mascotSrc')
    // wm-* ข้าม overlay ตามเดิม เว้นแต่แอดมินประกอบเอง
    expect(fladSrc).toContain('(promo.mascot || !mediaSrc.includes')
    // fallback (ไม่มีภาพ) ก็ใช้มาสคอตของโปรโมชั่น
    expect(fladSrc).toContain('<img src={promoMascot} alt="" loading="lazy" className="flad-fallback-mascot" />')
  })
})

describe('R61 · §T-1 ลิงก์ตะกร้า (Layout ถอดค่าตรง ๆ)', () => {
  it('Layout ใช้ decodeCartParam(raw) — ห้ามใช้ readCartParam(raw)', () => {
    expect(layoutSrc).toContain('decodeCartParam(raw)')
    expect(layoutSrc).not.toContain('readCartParam(raw)')
  })
})

describe('R61 · image-gen สลับโมเดล (qwen ใช้ก่อน seedream)', () => {
  it('default ของ IMAGE_MODEL_CANDIDATES เรียง qwen ก่อน seedream เป๊ะ', () => {
    expect(imageGenSrc).toContain("'qwen/qwen-image-2.1-pro,bytedance-seed/seedream-5-0-flash'")
  })
})
