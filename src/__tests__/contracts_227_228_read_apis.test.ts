// ============================================
// Bite Me Baby — Phase 2 WP7/WP8 source-contract (MIGRATIONS 227/228)
// STATIC: read APIs เป็น SECURITY INVOKER (RLS บังคับ) + filter/aggregate ครบ
// runtime จริง พิสูจน์ใน e2e/contracts_wp7_wp8_227_228.sql
// ============================================

import { describe, it, expect } from 'vitest'
import wp7 from '../../supabase/migrations/227_price_history_read_api.sql?raw'
import wp8 from '../../supabase/migrations/228_po_dashboard_read_api.sql?raw'

describe('Phase 2 WP7 — Migration 227 (Price History Read API)', () => {
  it('SECURITY INVOKER (RLS enforced) + BEGIN/COMMIT', () => {
    expect(wp7).toMatch(/BEGIN;/)
    expect(wp7).toMatch(/COMMIT;/)
    expect(wp7).toMatch(/SECURITY INVOKER/)
    expect(wp7).not.toMatch(/SECURITY DEFINER/)
  })

  it('filter params ครบ + pagination clamp', () => {
    expect(wp7).toMatch(/p_ingredient_id IS NULL OR ingredient_id = p_ingredient_id/)
    expect(wp7).toMatch(/p_supplier_id IS NULL OR supplier_id = p_supplier_id/)
    expect(wp7).toMatch(/p_price_type IS NULL OR price_type = p_price_type/)
    expect(wp7).toMatch(/LIMIT LEAST\(p_limit, 500\)/)
  })

  it('ไม่มี package_size', () => {
    expect(wp7).not.toMatch(/package_size/)
  })
})

describe('Phase 2 WP8 — Migration 228 (PO Dashboard Read API)', () => {
  it('SECURITY INVOKER + BEGIN/COMMIT', () => {
    expect(wp8).toMatch(/BEGIN;/)
    expect(wp8).toMatch(/COMMIT;/)
    expect(wp8).toMatch(/SECURITY INVOKER/)
    expect(wp8).not.toMatch(/SECURITY DEFINER/)
  })

  it('aggregate ครบ (counts/spend/outstanding/action items/top suppliers)', () => {
    expect(wp8).toMatch(/'po_counts'/)
    expect(wp8).toMatch(/'grn_pending'/)
    expect(wp8).toMatch(/'total_spend'/)
    expect(wp8).toMatch(/'outstanding_qty'/)
    expect(wp8).toMatch(/'pos_needing_action'/)
    expect(wp8).toMatch(/'grns_awaiting_approval'/)
    expect(wp8).toMatch(/'top_suppliers'/)
  })
})