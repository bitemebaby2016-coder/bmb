// ============================================
// WAVE 2 (Owner 2026-10-25) — Features A/B/C regression guards
// ============================================
// A: แท็บพรีออเดอร์รวมสินค้าทั่วไป (general ride-along) + ปุ่มจองในแท็บ
// B: ลำดับ sections หน้าแรก + แท็บลิงก์แนวนอน + ลำดับหมวด pinned
// C: admin จิ้มปุ่ม → smooth-scroll ไปฟอร์ม (rule 12.3) + แท็บหมวด + การ์ดเท่ากัน
// ============================================

import { describe, it, expect } from 'vitest'
import menuPageSrc from '../pages/MenuPage.tsx?raw'
import homePageSrc from '../pages/HomePage.tsx?raw'
import adminProductsSrc from '../pages/admin/AdminProducts.tsx?raw'
import catalogSrc from '../lib/catalogStructure.ts?raw'
import { categoryDisplayRank, CATEGORY_DISPLAY_ORDER } from '@/lib/catalogStructure'

describe('Feature A — general items join the pre-order cart (one round, same cart)', () => {
  it('แท็บพรีออเดอร์ไม่กรองสินค้าทั่วไปออกอีก (เดิม gate ด้วย scheduleMap)', () => {
    expect(menuPageSrc).not.toContain("if (menuTab === 'pre-order' && !scheduleMap[p.id]) return false")
    // จัดเมนูปฏิทินไว้ก่อน สินค้าทั่วไป (จองร่วมรอบ) ตามหลัง
    expect(menuPageSrc).toContain('const ordered = menuTab === \'pre-order\'')
    expect(menuPageSrc).toContain('buildHeadingGroups(ordered, categories)')
  })

  it('ในแท็บพรีออเดอร์ สินค้าทั่วไปถูกเพิ่มเป็น PRE_ORDER ร่วมตะกร้าเดียวกัน', () => {
    expect(menuPageSrc).toContain("menuTab === 'pre-order' || (product.available_preorder ?? product.is_preorder)")
    expect(menuPageSrc).toContain("addItem(result.product, result.quantity, customizations, 'PRE_ORDER')")
  })

  it('client gate รับ general ride-along ใน PRE_ORDER (เท่า server 142 G2)', async () => {
    const { checkModeEligibility } = await import('@/lib/bmbMenuSchedule')
    const res = checkModeEligibility(
      [
        { product_id: 'menu-1', name: 'เมนูปฏิทิน', is_available: true, preorder_ok: true, same_day_ok: true },
        { product_id: 'gen-1', name: 'สินค้าทั่วไป', is_available: true, preorder_ok: false, same_day_ok: true },
      ],
      'PRE_ORDER',
    )
    expect(res.ok).toBe(true)
    expect(res.rejected).toEqual([])
  })
})

describe('Feature B — homepage section order + horizontal tab links', () => {
  it('ลำดับ sections = แนะนำ → ส่งวันนี้ → พรีออเดอร์ → หมวดหมู่', () => {
    const iRec = homePageSrc.indexOf('id="home-sec-recommended"')
    const iSame = homePageSrc.indexOf('id="home-sec-sameday"')
    const iPre = homePageSrc.indexOf('id="home-sec-preorder"')
    const iCat = homePageSrc.indexOf('<CategorySections')
    expect(iRec).toBeGreaterThan(0)
    expect(iSame).toBeGreaterThan(iRec)
    expect(iPre).toBeGreaterThan(iSame)
    expect(iCat).toBeGreaterThan(iPre)
  })

  it('แท็บแนวนอน = ทั้งหมด | ส่งวันนี้ | พรีออเดอร์ | หมวดหมู่ และลิงก์ด้วย smooth-scroll', () => {
    const iAll = homePageSrc.indexOf('data-testid="home-tab-all"')
    const iSame = homePageSrc.indexOf('data-testid="home-tab-sameday"')
    const iPre = homePageSrc.indexOf('data-testid="home-tab-preorder"')
    expect(iAll).toBeGreaterThan(0)
    expect(iSame).toBeGreaterThan(iAll)
    expect(iPre).toBeGreaterThan(iSame)
    expect(homePageSrc).toContain("scrollIntoView({ behavior: 'smooth', block: 'start' })")
    expect(homePageSrc).toContain('scrollToSection(`home-cat-${cat.id}`)')
  })

  it('ลำดับหมวด pinned = สุขภาพ → เครื่องดื่ม → ของทานเล่น/ผลไม้ → สำเร็จรูป', () => {
    expect([...CATEGORY_DISPLAY_ORDER]).toEqual(['เมนูสุขภาพ', 'เครื่องดื่ม', 'ของทานเล่น / ผลไม้', 'สินค้าสำเร็จรูป'])
    expect(categoryDisplayRank('เมนูสุขภาพ')).toBe(0)
    expect(categoryDisplayRank('เครื่องดื่ม')).toBe(1)
    expect(categoryDisplayRank('ของทานเล่น / ผลไม้')).toBe(2)
    expect(categoryDisplayRank('ของทานเล่น/ผลไม้')).toBe(2) // ทนต่อช่องว่าง/สแลช
    expect(categoryDisplayRank('สินค้าสำเร็จรูป')).toBe(3)
    expect(categoryDisplayRank('อื่น ๆ')).toBe(4)
    expect(catalogSrc).toContain('categoryDisplayRank(a.name) - categoryDisplayRank(b.name)')
  })
})

describe('Feature C — admin auto-scroll (rule 12.3) + category tabs + uniform cards', () => {
  it('ฟอร์มสินค้า/หัวข้อ/ย้ายสินค้า = เด้งขึ้นไปรับงานอัตโนมัติเมื่อเปิด', () => {
    expect(adminProductsSrc).toContain('if (showAddForm) formRef.current?.scrollIntoView')
    expect(adminProductsSrc).toContain('if (showCatForm) catFormRef.current?.scrollIntoView')
    expect(adminProductsSrc).toContain('if (moveFrom) movePanelRef.current?.scrollIntoView')
    expect(adminProductsSrc).toContain('data-testid="product-form-frame"')
    expect(adminProductsSrc).toContain('data-testid="category-form-frame"')
  })

  it('แท็บหมวดหมู่สินค้ากรองรายการ + แสดงหัวข้อปัจจุบัน', () => {
    expect(adminProductsSrc).toContain('data-testid="admin-prod-tab-all"')
    expect(adminProductsSrc).toContain('admin-prod-tab-${c.id}')
    expect(adminProductsSrc).toContain('data-testid="admin-prod-list-heading"')
    expect(adminProductsSrc).toContain('products.filter((p) => p.category_id === catTab)')
  })

  it('การ์ดสินค้าขนาดเท่ากันทุกใบ (ไม่มีใบที่ใหญ่กว่าเพื่อน)', () => {
    expect(adminProductsSrc).toContain('card flex flex-col min-h-[430px]')
    expect(adminProductsSrc).toContain('auto-rows-fr')
    expect(adminProductsSrc).toContain('flex gap-2 mt-auto pt-2')
  })
})