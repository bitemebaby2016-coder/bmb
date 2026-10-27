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
    // Owner 2026-10-27: ปุ่มของการ์ดตัดสินจาก "ป้ายปฏิทิน" (เมนูตาราง = พรีออเดอร์)
    expect(menuPageSrc).toContain("const mode: OrderMode = schedDate ? 'pre-order' : 'same-day'")
    // 2026-10-26: เส้นทางสั่งซื้อยุบเป็น implementation เดียว (@/lib/orderEntry) —
    // หน้าต้อง delegate พร้อม mode PRE_ORDER (ไม่เก็บสำเนา addItem ซ้ำในหน้าแล้ว)
    expect(menuPageSrc).toContain('runOrderBuilder({')
    expect(menuPageSrc).toContain("mode: 'PRE_ORDER'")
    expect(menuPageSrc).not.toContain('openBuilder(product, products')
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
    expect(homePageSrc).toContain('scrollToSectionOrTop(')
    expect(homePageSrc).toContain('scrollToSection(`home-cat-${cat.id}`)')
  })

  it('ลำดับหมวด = N-4 #7 (Owner 2026-10-26): ส่งวันนี้ → จองล่วงหน้า → สุขภาพ → เครื่องดื่ม → ของทานเล่น/ผลไม้ → สำเร็จรูป (+ alias)', () => {
    expect([...CATEGORY_DISPLAY_ORDER]).toEqual([
      ['ส่งวันนี้ / Same Day', 'ส่งวันนี้', 'same day'],
      ['จองล่วงหน้า / พรีออเดอร์', 'พรีออเดอร์', 'จองล่วงหน้า', 'preorder'],
      ['เมนูสุขภาพ'],
      ['เครื่องดื่ม'],
      ['ของทานเล่น / ผลไม้', 'ของหวานลัน / ผลไม้', 'ของกินเล่น / ผลไม้'],
      ['สินค้าสำเร็จรูป', 'เมนูสำเร็จ'],
    ])
    expect(categoryDisplayRank('เมนูสุขภาพ')).toBe(2)
    expect(categoryDisplayRank('เครื่องดื่ม')).toBe(3)
    expect(categoryDisplayRank('ของทานเล่น / ผลไม้')).toBe(4)
    expect(categoryDisplayRank('ของทานเล่น/ผลไม้')).toBe(4) // ทนต่อช่องว่าง/สแลช
    expect(categoryDisplayRank('ของหวานลัน / ผลไม้')).toBe(4) // alias: ชื่อจริงใน DB = ความหมายเดียวกัน
    expect(categoryDisplayRank('สินค้าสำเร็จรูป')).toBe(5)
    expect(categoryDisplayRank('เมนูสำเร็จ')).toBe(5) // alias: ชื่อจริงใน DB
    expect(categoryDisplayRank('ส่งวันนี้ / Same Day')).toBe(0)
    expect(categoryDisplayRank('จองล่วงหน้า / พรีออเดอร์')).toBe(1)
    expect(categoryDisplayRank('อื่น ๆ')).toBe(CATEGORY_DISPLAY_ORDER.length) // นอกลิสต์ = ท้ายเสมอ
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