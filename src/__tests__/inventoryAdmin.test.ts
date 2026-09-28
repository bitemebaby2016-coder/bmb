// ============================================
// STEP 3A / G-SEC-01 — Admin inventory path must remain functional
// after the public-read RLS policy is removed.
// Offline Supabase mock. (Real RLS enforcement is verified post-deploy by
// e2e/ct-gsec01-verify.cjs — this suite guards the ADMIN read/mutation code path
// that must keep working: requirement 3 (admin read) + 4 (admin mutation).)
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return { supabase: createSupabaseMock(), supabaseAdmin: null, default: null }
})

import { supabase } from '@/lib/supabase'
import {
  getInventory,
  getInventoryByName,
  createInventory,
  updateInventoryStock,
  deleteInventory,
} from '@/lib/bmbAdminApi_inventory'

function seed(row: Record<string, any>) {
  return (supabase as any).from('inventory').insert(row) // mock supports insert
}

beforeEach(async () => {
  // Reset the inventory table on the shared mock instance (must be awaited —
  // the mock executes the delete on await, matching the real async contract).
  await (supabase as any).from('inventory').delete()
})

describe('G-SEC-01 — Admin inventory READ path stays functional', () => {
  it('getInventory returns the admin-scoped inventory rows', async () => {
    await seed({ id: 'ing-a', name: 'Flour', category: 'Bakery', unit: 'kg', current_stock: 10, min_stock: 2, max_stock: 20, unit_price: 5, supplier_name: 'S1', supplier_phone: '+1', status: 'in_stock' })
    const rows = await getInventory()
    expect(rows.length).toBe(1)
    expect(rows[0].name).toBe('Flour')
    expect(rows[0].supplier_name).toBe('S1') // admin may see the sensitive columns
  })

  it('getInventoryByName returns the matching row', async () => {
    await seed({ id: 'ing-b', name: 'Sugar', category: 'Bakery', unit: 'kg', current_stock: 4, min_stock: 1, max_stock: 10, unit_price: 7, supplier_name: 'S2', supplier_phone: '', status: 'low_stock' })
    const row = await getInventoryByName('Sugar')
    expect(row?.id).toBe('ing-b')
    expect(await getInventoryByName('NOPE')).toBeNull()
  })
})

describe('G-SEC-01 — Admin inventory MUTATION path stays functional', () => {
  it('createInventory inserts and returns the row', async () => {
    const created = await createInventory({
      name: 'Eggs', category: 'Dairy', unit: 'piece', current_stock: 24,
      min_stock: 6, max_stock: 60, unit_price: 3, supplier_name: 'S3', supplier_phone: '+2',
    })
    expect(created).not.toBeNull()
    expect(created?.name).toBe('Eggs')
    expect((await getInventory()).length).toBe(1)
  })

  it('updateInventoryStock adjusts current_stock (never negative)', async () => {
    await seed({ id: 'ing-c', name: 'Milk', category: 'Dairy', unit: 'L', current_stock: 5, min_stock: 1, max_stock: 20, unit_price: 8, supplier_name: '', supplier_phone: '', status: 'in_stock' })
    const up = await updateInventoryStock('ing-c', 3, 'restock')
    expect(up?.current_stock).toBe(8)
    const floored = await updateInventoryStock('ing-c', -999, 'manual adjust')
    expect(floored?.current_stock).toBe(0)
  })

  it('deleteInventory removes the row', async () => {
    await seed({ id: 'ing-d', name: 'Salt', category: 'Spice', unit: 'kg', current_stock: 2, min_stock: 1, max_stock: 5, unit_price: 2, supplier_name: '', supplier_phone: '', status: 'in_stock' })
    expect(await deleteInventory('ing-d')).toBe(true)
    expect((await getInventory()).length).toBe(0)
  })
})