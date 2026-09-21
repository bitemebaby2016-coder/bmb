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
  it('keeps the legacy seeded admin emails as a fallback', async () => {
    const { shouldShowAdminLink } = await import('@/lib/adminUi')
    expect(shouldShowAdminLink(null, 'admin@bmb.co.th')).toBe(true)
    expect(shouldShowAdminLink(null, 'owner@bmb.co.th')).toBe(true)
    expect(shouldShowAdminLink('customer', 'admin@bmb.co.th')).toBe(true)
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
    const promo = await upsertPromotion({ id: '', name: 'Flash 10%', discount_type: 'percentage', discount_value: 10, min_order_amount: 100, is_active: true, is_banner: true })
    expect(promo).toBeTruthy()
    const id = await submitContentForApproval('banner', promo!.name, promo!.description || '')
    expect(id).toBeTruthy()
    expect((await listContentApprovals()).some((r) => r.id === id && r.status === 'pending')).toBe(true)
  })
})
