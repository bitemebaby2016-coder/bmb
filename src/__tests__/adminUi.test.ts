// Bite Me Baby - PHASE 6 UI/admin + PHASE 7 CNT-01 tests

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return { supabase: createSupabaseMock(), supabaseAdmin: null, default: null }
})

import { supabase } from '@/lib/supabase'

describe('adminUi — role-based admin link', () => {
  it('opens for any admin role regardless of email', async () => {
    const { shouldShowAdminLink } = await import('@/lib/adminUi')
    expect(shouldShowAdminLink('admin', 'some.owner@example.com')).toBe(true)
    expect(shouldShowAdminLink('admin', null)).toBe(true)
  })
  it('no longer trusts legacy public admin emails (F-01 — revoked credential)', async () => {
    const { shouldShowAdminLink } = await import('@/lib/adminUi')
    expect(shouldShowAdminLink(null, 'admin@bmb.co.th')).toBe(false)
    expect(shouldShowAdminLink(null, 'owner@bmb.co.th')).toBe(false)
    expect(shouldShowAdminLink('customer', 'admin@bmb.co.th')).toBe(false)
  })
  it('stays closed for ordinary customers', async () => {
    const { shouldShowAdminLink } = await import('@/lib/adminUi')
    expect(shouldShowAdminLink('customer', 'user@example.com')).toBe(false)
    expect(shouldShowAdminLink(null, 'user@example.com')).toBe(false)
    expect(shouldShowAdminLink(null, null)).toBe(false)
  })
})

describe('adminUi — category heading slug + image source validation', () => {
  it('slugifies category heading names', async () => {
    const { slugifyCategory } = await import('@/lib/adminUi')
    expect(slugifyCategory('Thai Dish')).toBe('thai-dish')
    expect(slugifyCategory('  Burgers & Fries ')).toBe('burgers-fries')
  })
  it('falls back to a unique slug for non-latin headings', async () => {
    const { slugifyCategory } = await import('@/lib/adminUi')
    expect(slugifyCategory('🍔🍟')).toMatch(/^cat-\d+$/)
  })
  it('accepts data-URL uploads and http(s) image sources only', async () => {
    const { isImageSourceValid } = await import('@/lib/adminUi')
    expect(isImageSourceValid('data:image/png;base64,AAAA')).toBe(true)
    expect(isImageSourceValid('https://cdn.example.com/food.png')).toBe(true)
    expect(isImageSourceValid('http://cdn.example.com/food.webp')).toBe(true)
    expect(isImageSourceValid('not-a-url')).toBe(false)
    expect(isImageSourceValid(null)).toBe(false)
  })
})

describe('adminUi — admin navigation catalogue', () => {
  it('covers dashboard, products, media and content approvals', async () => {
    const { ADMIN_NAV_ITEMS } = await import('@/lib/adminUi')
    const paths = ADMIN_NAV_ITEMS.map((i) => i.to)
    expect(paths).toContain('/admin')
    expect(paths).toContain('/admin/products')
    expect(paths).toContain('/admin/media')
    expect(paths).toContain('/admin/content-approvals')
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths.every((p) => p.startsWith('/admin'))).toBe(true)
  })
})

describe('adminUi — ADMIN_NAV_GROUPS (sidebar grouping, single nav set)', () => {
  it('flattening the groups yields exactly ADMIN_NAV_ITEMS (no lost or duplicated menu)', async () => {
    const { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS } = await import('@/lib/adminUi')
    const flat = ADMIN_NAV_GROUPS.flatMap((g) => g.items)
    expect(flat.length).toBe(ADMIN_NAV_ITEMS.length)
    expect(new Set(flat.map((i) => i.to)).size).toBe(flat.length) // no duplicates inside groups
    expect(new Set(flat.map((i) => i.to))).toEqual(new Set(ADMIN_NAV_ITEMS.map((i) => i.to)))
  })

  it('every group has an id, a label and at least one item', async () => {
    const { ADMIN_NAV_GROUPS } = await import('@/lib/adminUi')
    const ids = ADMIN_NAV_GROUPS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const g of ADMIN_NAV_GROUPS) {
      expect(g.id.length).toBeGreaterThan(0)
      expect(g.label.length).toBeGreaterThan(0)
      expect(g.items.length).toBeGreaterThan(0)
    }
  })

  it('every grouped route is registered in App.tsx (menu never points at a dead path)', async () => {
    const { ADMIN_NAV_ITEMS } = await import('@/lib/adminUi')
    const app = (await import('../App.tsx?raw')).default
    for (const item of ADMIN_NAV_ITEMS) {
      expect(app, `${item.to} must have a Route in App.tsx`).toContain(`path="${item.to}"`)
    }
  })
})
describe('PHASE 6 — category CRUD via admin API (Supabase mock)', () => {
  beforeEach(() => {
    (supabase as any).__reset?.()
  })
  it('creates, renames and deletes a category heading', async () => {
    const api = await import('@/lib/bmbAdminApi_products')
    const created = await api.createCategory({ name: 'Burgers', slug: 'burgers', icon: ':P', sort_order: 9, is_active: true })
    expect(created).toBeTruthy()
    expect(created!.name).toBe('Burgers')
    const all = await api.getCategoriesAdmin()
    expect(all.some((c) => c.id === created!.id && c.name === 'Burgers')).toBe(true)
    const renamed = await api.updateCategory(created!.id, { name: 'Gourmet Burgers' })
    expect(renamed!.name).toBe('Gourmet Burgers')
    expect(await api.deleteCategory(created!.id)).toBe(true)
    expect((await api.getCategoriesAdmin()).some((c) => c.id === created!.id)).toBe(false)
  })
})

describe('PHASE 7 — CNT-01 content approval gate', () => {
  beforeEach(() => {
    (supabase as any).__reset?.()
  })
  it('submits banner content for approval and opens the gate only after approval', async () => {
    const { submitContentForApproval, reviewContent, listContentApprovals } = await import('@/lib/contentApproval')
    const id = await submitContentForApproval('banner', 'Home banner', 'flash deal 10%')
    expect(id).toBeTruthy()
    const pending = await listContentApprovals()
    expect(pending.some((r) => r.id === id && r.status === 'pending')).toBe(true)
    expect(await reviewContent(id!, 'approved', 'looks good')).toBe(true)
    const after = await listContentApprovals()
    expect(after.find((r) => r.id === id)?.status).toBe('approved')
  })
  it('keeps the publish gate closed for anything not approved', async () => {
    const { canPublish } = await import('@/lib/contentApproval')
    expect(canPublish('pending')).toBe(false)
    expect(canPublish('rejected')).toBe(false)
    expect(canPublish(undefined)).toBe(false)
    expect(canPublish('approved')).toBe(true)
  })
  it('saving a banner promotion routes it through the approval workflow', async () => {
    const { upsertPromotion } = await import('@/lib/bmbAdminApi_promotions')
    const { submitContentForApproval, listContentApprovals } = await import('@/lib/contentApproval')
    const res = await upsertPromotion({ id: '', name: 'Flash 10%', discount_type: 'percentage', discount_value: 10, min_order_amount: 100, is_active: true, is_banner: true })
    expect(res.ok).toBe(true)
    const promo = res.ok ? res.row : null
    const id = await submitContentForApproval('banner', promo!.name, promo!.description || '')
    expect(id).toBeTruthy()
    expect((await listContentApprovals()).some((r) => r.id === id && r.status === 'pending')).toBe(true)
  })
})
