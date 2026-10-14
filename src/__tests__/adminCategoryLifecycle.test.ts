// ============================================
// Bite Me Baby — P0 WS2: Admin category lifecycle source contract
// ============================================
// Owner decision B (approved): one canonical category per meaning; support
// create / rename / reorder / on-off / MOVE products. The move/merge tool must
// use the canonical updateProduct API, must never hard-delete data, and must
// report per-row failures instead of claiming success.

import { describe, expect, it } from 'vitest'
import adminProductsSrc from '../pages/admin/AdminProducts.tsx?raw'

describe('AdminProducts.tsx — category move/merge lifecycle', () => {
  it('handleMoveProducts reassigns via canonical updateProduct and counts failures', () => {
    const block = adminProductsSrc.slice(
      adminProductsSrc.indexOf('async function handleMoveProducts'),
      adminProductsSrc.indexOf('async function handleArchiveProduct'),
    )
    expect(block).toContain('const res = await updateProduct(p.id, { category_id: moveTarget })')
    expect(block).toContain('if (res) ok += 1')
    expect(block).toContain('failed.push(p.name)')
  })

  it('never hard-deletes catalog data during a move (CAT-D04=B)', () => {
    const block = adminProductsSrc.slice(
      adminProductsSrc.indexOf('async function handleMoveProducts'),
      adminProductsSrc.indexOf('async function handleArchiveProduct'),
    )
    expect(block).not.toContain('deleteCategory')
    expect(block).not.toContain('deleteProduct')
  })

  it('move panel + per-category actions and customer-visibility labels are rendered', () => {
    expect(adminProductsSrc).toContain('data-testid="admin-move-products-panel"')
    expect(adminProductsSrc).toContain('data-testid={`admin-move-products-${cat.id}`}')
    expect(adminProductsSrc).toContain('data-testid={`cat-customer-visibility-${cat.id}`}')
    expect(adminProductsSrc).toContain('ซ่อนจากลูกค้า')
    expect(adminProductsSrc).toContain('ลูกค้าเห็น')
  })

  it('move target options warn when the destination category is hidden from customers', () => {
    expect(adminProductsSrc).toContain("(ปิดอยู่ — ลูกค้าจะไม่เห็น)")
  })
})