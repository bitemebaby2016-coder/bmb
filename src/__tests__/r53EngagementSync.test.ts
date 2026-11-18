// ============================================
// R53 (Owner 2026-11-18): โหวตเมนู + สุ่มเมนู ซิงก์เมนูจริงและระบบโปรโมชันจากแอดมิน
//   "ห้ามมีฮาร์ดโค้ดในโปรเจค ทุกอย่างลิ้งค์ดึงจากของจริงเท่านั้น" — source-contract
//   ตาม convention ของ adminShell.test.ts (?raw literal imports)
// ============================================
import { describe, it, expect } from 'vitest'
import randomMenuPageSrc from '../pages/RandomMenuPage.tsx?raw'
import votePageSrc from '../pages/VotePage.tsx?raw'
import promotionsPageSrc from '../pages/PromotionsPage.tsx?raw'
import migration208Src from '../../supabase/migrations/208_preorder_vote_cast.sql?raw'
import contract208Src from '../../e2e/contracts_208_preorder_vote.sql?raw'

/** ตัด comment ออกก่อนตรวจ not.toContain — TSX: // · SQL: -- (convention จาก canonicalFallbackContract) */
const stripLineComments = (src: string, mark: '//' | '--') =>
  src
    .split(/\r?\n/)
    .map((l) => l.replace(new RegExp(`${mark}.*$`), ''))
    .join('\n')

describe('R53 — หน้าสุ่มเมนู: ห้ามเมนูปลอม สุ่มจากเมนูจริงของแอดมินเท่านั้น', () => {
  it('ลบ menuItems hardcode 6 ชิ้น + รูป unsplash ออกให้หมด', () => {
    const code = stripLineComments(randomMenuPageSrc, '//')
    expect(code).not.toContain('const menuItems')
    expect(code).not.toContain('unsplash')
    expect(code).not.toContain('ผัดไทยกุ้งสด')
    expect(code).not.toContain('ข้าวหมทอดกระเทียม')
    expect(code).not.toContain('แกงเขียวหวานไก่')
    expect(code).not.toContain('กาแฟเย็น')
    expect(code).not.toContain('ไข่ดาวน้ำมัน')
    expect(code).not.toContain('ขนมปังกรอบ')
  })

  it('สุ่มจาก getProducts จริง: กรอง archived + is_available (เมนูขายได้จริง)', () => {
    expect(randomMenuPageSrc).toContain("products.filter((p: Product) => !p.archived && p.is_available)")
  })

  it('แสดงรูป/ราคาจริงของเมนูจาก DB (image_url · price)', () => {
    expect(randomMenuPageSrc).toContain('selectedItem.image_url')
    expect(randomMenuPageSrc).toContain('selectedItem.price')
  })

  it('ปุ่มไปสั่ง = deep link ไปหมวดของเมนูที่สุ่มได้ (MenuPage อ่าน ?category=)', () => {
    expect(randomMenuPageSrc).toContain('/menu?category=')
  })

  it('ซิงก์โปรโมชันจริง: scope ต่อเมนู (all_products/specific) จากแอดมิน + live เท่านั้น', () => {
    expect(randomMenuPageSrc).toContain('attachPromotionScope')
    expect(randomMenuPageSrc).toContain('isPromoLiveNow')
    expect(randomMenuPageSrc).toContain('scope_product_ids')
    expect(randomMenuPageSrc).toContain('ใช้โปรโมชั่นกับเมนูนี้ได้')
  })

  it('โหลดเมนูล้มเหลวต้องฟ้อง + ลองใหม่ (ไม่เงียบเป็นหน้าเปล่า)', () => {
    expect(randomMenuPageSrc).toContain('LoadErrorBanner')
    expect(randomMenuPageSrc).toContain('random-menu-load-error')
  })

  it('ภาษาไทยถูก (แก้พิมพ์ผิดเดิม "สุ่มเมน")', () => {
    expect(randomMenuPageSrc).toContain('กดปุ่มเพื่อสุ่มเมนู')
    expect(randomMenuPageSrc).not.toContain('กดปุ่มเพื่อสุ่มเมน —')
    expect(randomMenuPageSrc).not.toContain('กดสุ่มเมน<')
  })

  it('ไม่มีแต้มปลอมฝั่งเครื่อง (รางวัล = spin_reward RPC จาก server เท่านั้น)', () => {
    expect(randomMenuPageSrc).not.toContain('addPoints')
    expect(randomMenuPageSrc).toContain('trySpinReward')
  })
})

describe('R53 — หน้าโปรโมชัน: สมบูรณ์ตามที่แอดมินตั้ง (ข้อมูลจริงทุกช่อง)', () => {
  it('แสดงภาพแบนเนอร์จริงเมื่อแอดมินตั้ง (banner_image)', () => {
    expect(promotionsPageSrc).toContain('banner_image')
  })

  it('แสดงขอบเขตเมนูร่วมรายการจาก promotion_products (attachPromotionScope)', () => {
    expect(promotionsPageSrc).toContain('attachPromotionScope')
    expect(promotionsPageSrc).toContain('เฉพาะเมนู:')
  })

  it('แสดงเพดานส่วนลด + สิทธิ์คงเหลือ + สิทธิ์ซ้อน เมื่อแอดมินกำหนดจริง', () => {
    expect(promotionsPageSrc).toContain('max_discount_amount')
    expect(promotionsPageSrc).toContain('usage_limit')
    expect(promotionsPageSrc).toContain('stackable')
  })

  it('คงสัญญา UI เดิม (R12): การ์ด min-h เท่ากัน + ข้อความคลิปปิด', () => {
    expect(promotionsPageSrc).toContain('min-h-[120px]')
    expect(promotionsPageSrc).toContain('line-clamp-1')
    expect(promotionsPageSrc).toContain('line-clamp-2')
  })
})

describe('R53 — migration 208: server-authoritative vote (ตามเจตนา m058 · กันสแปม)', () => {
  it('มี RPC ครบ 3 ตัว + policy seed ผ่าน business_settings (แอดมินคุม — ไม่ hardcode)', () => {
    expect(migration208Src).toContain('CREATE OR REPLACE FUNCTION public.preorder_vote_status()')
    expect(migration208Src).toContain('CREATE OR REPLACE FUNCTION public.preorder_vote_cast(p_product_id text)')
    expect(migration208Src).toContain('CREATE OR REPLACE FUNCTION public.vote_policy_state()')
    expect(migration208Src).toContain("'vote_policy'")
  })

  it('grants ถูกทิศ: cast = authenticated เท่านั้น (anon ถูกปิด — เจตนา RE-D1 คงอยู่)', () => {
    expect(migration208Src).toContain('REVOKE EXECUTE ON FUNCTION public.preorder_vote_cast(text) FROM PUBLIC, anon')
    expect(migration208Src).toContain('GRANT EXECUTE ON FUNCTION public.preorder_vote_cast(text) TO authenticated, service_role')
    expect(migration208Src).toContain('GRANT EXECUTE ON FUNCTION public.preorder_vote_status() TO anon, authenticated, service_role')
  })

  it('กันสแปม: unique identity index + advisory lock + daily_limit + audit ทุกครั้ง', () => {
    expect(migration208Src).toContain('idx_preorder_votes_unique_identity')
    expect(migration208Src).toContain("pg_advisory_xact_lock(hashtext('vote:'")
    expect(migration208Src).toContain("AT TIME ZONE 'Asia/Bangkok'")
    expect(migration208Src).toContain("'preorder_vote_cast'")
  })

  it('โหวตเฉพาะเมนูจริงที่ยังไม่ถูกเก็บถาวร (ซิงก์เมนูแอดมิน — ไม่สร้างสินค้าซ้ำ)', () => {
    expect(migration208Src).toContain('AND NOT p.archived')
    expect(migration208Src).not.toContain('INSERT INTO public.products')
  })

  it('ZERO-FAKE: ไม่แตะ points_ledger (โหวตไม่มีแหล่งแต้ม — ห้ามอวดแต้มปลอม)', () => {
    const code = stripLineComments(migration208Src, '--')
    expect(code).not.toContain('points_ledger')
  })

  it('มี verification block กันเกม (ตามแบบ m207) + contract SQL มี marker และ rollback', () => {
    expect(migration208Src).toContain('VERIFY_R208_OK')
    expect(contract208Src).toContain('C208_OK')
    expect(contract208Src).toContain('ROLLBACK;')
    expect(contract208Src).toContain('ERR_VOTE_DISABLED')
    expect(contract208Src).toContain('ERR_VOTE_LIMIT')
    expect(contract208Src).toContain('ERR_VOTE_ALREADY')
  })
})
