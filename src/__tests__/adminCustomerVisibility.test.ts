// ============================================
// Bite Me Baby — P0 2026-10-14: Admin ↔ Customer catalog visibility + save guard
// ============================================
// Root-cause regression (Owner P0: "Admin ไม่ได้เชื่อมกับ data flow จริง / เมนูที่
// แก้ไม่สะท้อนถึงลูกค้า / กดสั่งแล้วของไม่เข้าตะกร้า"):
//   1) customerVisibilityIssue — สินค้าที่หมวดหมู่ปิด/หาย/จัดเก็บ = ลูกค้าไม่เห็น
//      (buildCatalogGroups + RLS product_categories_public_read) → admin ต้องเห็น
//      ธงนี้บนการ์ดสินค้า ไม่งั้นแอดมินแยกไม่ออกว่าลูกค้าไม่เห็นของ
//   2) handleAddProduct/handleUpdateProduct ต้องเช็คผลลัพธ์ก่อน toast สำเร็จ
//      (createProduct/updateProduct คืน null ตอน write ล้ม — ของเดิมไม่เช็คเลย)
// ============================================

import { describe, expect, it } from 'vitest'
import { customerVisibilityIssue, CUSTOMER_VISIBILITY_LABEL } from '@/lib/catalogStructure'
import adminProductsSrc from '../pages/admin/AdminProducts.tsx?raw'

const cat = (id: string, over: Partial<{ is_active: boolean; archived: boolean }> = {}) => ({
  id,
  is_active: over.is_active ?? true,
  archived: over.archived ?? false,
})

describe('customerVisibilityIssue — เหตุผลที่ลูกค้าไม่เห็นสินค้า', () => {
  it('หมวดหมู่ที่ active + ไม่ archived = ลูกค้าเห็นปกติ (null)', () => {
    expect(customerVisibilityIssue({ category_id: 'cat-3' }, [cat('cat-3')])).toBeNull()
  })

  it('ผูกกับหมวดหมู่ที่ปิดอยู่ → category_inactive (เคสจริง: สินค้า cat-1/cat-2)', () => {
    expect(customerVisibilityIssue({ category_id: 'cat-1' }, [cat('cat-1', { is_active: false })]))
      .toBe('category_inactive')
  })

  it('ผูกกับหมวดหมู่ที่ถูกจัดเก็บ → category_archived', () => {
    expect(customerVisibilityIssue({ category_id: 'cat-2' }, [cat('cat-2', { archived: true })]))
      .toBe('category_archived')
  })

  it('หมวดหมู่ไม่มีอยู่ในสารบบแล้ว → category_missing', () => {
    expect(customerVisibilityIssue({ category_id: 'cat-gone' }, [cat('cat-3')])).toBe('category_missing')
  })

  it('label ภาษาไทยครบทุกกรณี', () => {
    expect(CUSTOMER_VISIBILITY_LABEL.category_inactive).toContain('ปิด')
    expect(CUSTOMER_VISIBILITY_LABEL.category_archived).toContain('จัดเก็บ')
    expect(CUSTOMER_VISIBILITY_LABEL.category_missing).toContain('ไม่มี')
  })
})

describe('AdminProducts.tsx — source contract (P0 save guard + visibility badge)', () => {
  it('handleAddProduct ต้องเช็คผล createProduct ก่อน toast สำเร็จ (ห้าม swallow null)', () => {
    const src = adminProductsSrc
    expect(src).toContain('const created = await createProduct(')
    expect(src).toContain('if (!created)')
    // ต้อง return ก่อนถึง resetForm/toast สำเร็จ
    const addBlock = src.slice(src.indexOf('async function handleAddProduct'), src.indexOf('function handleEditProduct'))
    expect(addBlock).toContain('if (!created)')
    expect(addBlock.indexOf('if (!created)')).toBeLessThan(addBlock.indexOf('resetForm()'))
  })

  it('handleUpdateProduct ต้องเช็คผล updateProduct ก่อน toast สำเร็จ', () => {
    const src = adminProductsSrc
    expect(src).toContain('const updated = await updateProduct(')
    expect(src).toContain('if (!updated)')
    const updBlock = src.slice(src.indexOf('async function handleUpdateProduct'), src.indexOf('async function handleArchiveProduct'))
    expect(updBlock.indexOf('if (!updated)')).toBeLessThan(updBlock.indexOf('resetForm()'))
  })

  it('การ์ดสินค้าต้องมีธง "ซ่อนจากหน้าลูกค้า" ตาม customerVisibilityIssue', () => {
    expect(adminProductsSrc).toContain('data-testid="admin-product-customer-hidden"')
    expect(adminProductsSrc).toContain('customerVisibilityIssue(product, adminCats)')
  })
})