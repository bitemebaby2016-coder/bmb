// ============================================
// Bite Me Baby — CAT-03: canonical media/storage (migration 057, CAT-D03=B)
// upload authorization · validation · metadata · product attachment · public read
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return {
    supabase: createSupabaseMock(),
    supabaseAdmin: null,
    getCurrentUser: async () => null,
    isAdmin: async () => false,
    default: null,
  }
})

import { supabase } from '@/lib/supabase'
import { validateImageFile, uploadProductImage, deleteMediaAsset, listMediaAssets, IMAGE_MIME_WHITELIST, MAX_IMAGE_BYTES } from '@/lib/bmbAdminApi_media'

function file(name: string, type: string, size: number): File {
  return { name, type, size, slice: () => new Blob(['x']) } as unknown as File
}

beforeEach(async () => {
  await (supabase as any).__reset?.()
  ;(supabase as any).__setNoAdmin?.(false)
})

describe('CAT-03 · file validation (client gate — server policies still authority)', () => {
  it('accepts whitelisted image MIME within size limit', () => {
    expect(validateImageFile(file('a.jpg', 'image/jpeg', 100_000)).ok).toBe(true)
    expect(validateImageFile(file('a.webp', 'image/webp', 100_000)).ok).toBe(true)
  })
  it('rejects non-image MIME (ERR_INVALID_MIME)', () => {
    const v = validateImageFile(file('a.pdf', 'application/pdf', 1000))
    expect(v.ok).toBe(false)
    expect(v.error).toContain('ERR_INVALID_MIME')
  })
  it('rejects oversized / empty files (ERR_INVALID_SIZE)', () => {
    expect(validateImageFile(file('big.png', 'image/png', MAX_IMAGE_BYTES + 1)).error).toContain('ERR_INVALID_SIZE')
    expect(validateImageFile(file('empty.png', 'image/png', 0)).error).toContain('ERR_INVALID_SIZE')
  })
})

describe('CAT-03 · upload → metadata → product attachment (canonical flow)', () => {
  it('upload creates Storage object + media_assets row and returns public URL', async () => {
    const res = await uploadProductImage(file('pad-thai.jpg', 'image/jpeg', 120_000), 'ผัดไทย')
    expect(res.ok).toBe(true)
    expect(res.url).toContain('/object/public/bmb-images/')
    const rows = await listMediaAssets()
    expect(rows).toHaveLength(1)
    expect(rows[0].url).toBe(res.url)
    expect(rows[0].kind).toBe('image')
  })

  it('product attachment: image_url = storage public URL (not Base64)', async () => {
    const res = await uploadProductImage(file('kao-moo.jpg', 'image/jpeg', 80_000))
    expect(res.ok).toBe(true)
    const { error } = await supabase.from('products').update({ image_url: res.url }).eq('id', 'prod-2')
    expect(error).toBeNull()
    const { data } = await supabase.from('products').select('*').eq('id', 'prod-2').single()
    expect((data as any).image_url).toBe(res.url)
    expect(String((data as any).image_url).startsWith('data:image')).toBe(false)
  })

  it('replace: second upload adds a new asset row (old asset preserved until delete)', async () => {
    await uploadProductImage(file('a.jpg', 'image/jpeg', 10_000))
    await uploadProductImage(file('b.jpg', 'image/jpeg', 10_000))
    expect(await listMediaAssets()).toHaveLength(2)
  })

  it('delete asset removes metadata row (storage remove mirrored in mock)', async () => {
    await uploadProductImage(file('a.jpg', 'image/jpeg', 10_000))
    const rows = await listMediaAssets()
    expect(await deleteMediaAsset(rows[0])).toBe(true)
    expect(await listMediaAssets()).toHaveLength(0)
  })
})

describe('CAT-03 · security mirrors (migration 057 policies)', () => {
  it('anon (non-admin) upload rejected — storage INSERT policy mirror', async () => {
    ;(supabase as any).__setNoAdmin?.(true)
    const res = await uploadProductImage(file('anon.jpg', 'image/jpeg', 10_000))
    expect(res.ok).toBe(false)
    expect(res.error).toContain('ERR_UPLOAD_FAILED')
  })

  it('media_assets remains publicly readable (customer rendering)', async () => {
    await uploadProductImage(file('a.jpg', 'image/jpeg', 10_000))
    const { data, error } = await supabase.from('media_assets').select('*')
    expect(error).toBeNull()
    expect((data as any[]).length).toBe(1)
  })
})

// ============================================
// CAT-03A implementation gate — parser + review closure (migration 058, RE-D1..D3)
// ============================================

import { parseBase64Image, isValidWebp } from '@/lib/bmbAdminApi_media'
import { getHomeProducts } from '@/lib/homeProviders'
import { SOCIAL_PROOF_REVIEWS } from '@/lib/socialProofReviews'
import reviewPageSrc from '../pages/ReviewPage.tsx?raw'
import socialProofSrc from '../lib/socialProofReviews.ts?raw'
import migration058Src from '../../supabase/migrations/058_preorder_votes_close_anon_insert.sql?raw'

// minimal RIFF/WEBP header for tests
const WEBP_BYTES = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2])

describe('CAT-03A · Base64 parser (migration contract §7)', () => {
  it('parses image data URL into mime + bytes', () => {
    let b64 = ''
    for (const b of WEBP_BYTES) b64 += String.fromCharCode(b)
    b64 = btoa(b64)
    const p = parseBase64Image(`data:image/webp;base64,${b64}`)
    expect(p).not.toBeNull()
    expect(p!.mime).toBe('image/webp')
    expect(Array.from(p!.bytes.slice(0, 4))).toEqual([0x52, 0x49, 0x46, 0x46])
    expect(isValidWebp(p!.bytes)).toBe(true)
  })
  it('rejects non-image and malformed data URLs', () => {
    expect(parseBase64Image('https://example.com/a.webp')).toBeNull()
    expect(parseBase64Image('data:text/html;base64,PGI+')).toBeNull()
    expect(parseBase64Image('data:image/webp;base64,!!!!not-base64!!!!')).toBeNull()
  })
  it('WebP magic check rejects other formats / short buffers', () => {
    expect(isValidWebp(new Uint8Array([1, 2, 3]))).toBe(false)
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(isValidWebp(png)).toBe(false)
  })
})

describe('CAT-03A · RE-D3 — seed rating/review_count are not customer-review truth', () => {
  const products = [
    { id: 'p1', name: 'A', price: 1, category_id: 'c1', image_url: '', rating: 5.0, review_count: 42, is_available: true } as any,
  ]
  it('getHomeProducts omits rating/reviewCount (hidden until canonical aggregate exists)', () => {
    const { sameDay } = getHomeProducts(products, [])
    expect(sameDay).toHaveLength(1)
    expect(sameDay[0].rating).toBeUndefined()
    expect(sameDay[0].reviewCount).toBeUndefined()
  })
})

describe('CAT-03A · RE-D2 — static testimonials are Marketing, never reviews', () => {
  it('SOCIAL_PROOF_REVIEWS is a static marketing list (source-labeled platforms, not reviews table)', () => {
    expect(SOCIAL_PROOF_REVIEWS.length).toBeGreaterThan(0)
    for (const t of SOCIAL_PROOF_REVIEWS) expect(['grabfood', 'facebook', 'website']).toContain(t.source)
  })
  it('fake review write path removed from ReviewPage (+10 points / fake success toast absent)', () => {
    expect(reviewPageSrc).not.toMatch(/\+10\s*แต้ม/)
    expect(reviewPageSrc).not.toMatch(/ส่งรีวิวสำเร็จ/)
    expect(reviewPageSrc).not.toMatch(/from\('reviews'\)/)
  })
  it('no code inserts static testimonials into reviews table', () => {
    expect(socialProofSrc).not.toMatch(/from\('reviews'\)/)
    expect(socialProofSrc).toMatch(/MARKETING TESTIMONIALS/)
  })
})

describe('CAT-03A · RE-D1 — migration 058 committed (policy-only, documented)', () => {
  it('migration 058 drops the anon INSERT policy on preorder_votes', () => {
    expect(migration058Src).toMatch(/DROP POLICY IF EXISTS preorder_votes_anon/)
  })
})
