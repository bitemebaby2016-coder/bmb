// ============================================
// G2-A regression — Asset Registry selection policy (migration 105 contract)
// selectRuntimeAssetUrl: approved(active+non-mock) > mock(active) > null
// ============================================

import { describe, it, expect } from 'vitest'
import { selectRuntimeAssetUrl, type RegistryAssetRow } from '@/lib/bmbAdminApi_media'

function row(over: Partial<RegistryAssetRow>): RegistryAssetRow {
  return {
    id: over.id || 'media-x',
    url: over.url || 'https://x/storage/u.webp',
    alt: '',
    kind: 'image',
    is_active: true,
    is_mock: false,
    sort_order: 0,
    version: 1,
    ...over,
  } as RegistryAssetRow
}

describe('asset registry runtime selection policy (G2-A)', () => {
  it('prefers approved (non-mock) over mock even when mock has lower sort_order (Test J)', () => {
    const url = selectRuntimeAssetUrl([
      row({ id: 'mock', is_mock: true, sort_order: 0, url: 'https://x/mock.webp' }),
      row({ id: 'real', is_mock: false, sort_order: 5, url: 'https://x/real.webp' }),
    ])
    expect(url).toBe('https://x/real.webp')
  })

  it('falls back to active mock when no approved asset exists', () => {
    const url = selectRuntimeAssetUrl([
      row({ id: 'mock1', is_mock: true, sort_order: 3, url: 'https://x/m1.webp' }),
      row({ id: 'mock2', is_mock: true, sort_order: 1, url: 'https://x/m2.webp' }),
    ])
    expect(url).toBe('https://x/m2.webp') // lowest sort_order
  })

  it('ignores inactive assets entirely (Test H — deactivate → fallback)', () => {
    expect(selectRuntimeAssetUrl([row({ is_active: false })])).toBeNull()
  })

  it('returns null when list is empty → consumer uses its own static fallback', () => {
    expect(selectRuntimeAssetUrl([])).toBeNull()
  })

  it('lowest sort_order wins among equals (reorder support)', () => {
    const url = selectRuntimeAssetUrl([
      row({ id: 'b', sort_order: 7, url: 'https://x/b.webp' }),
      row({ id: 'a', sort_order: 2, url: 'https://x/a.webp' }),
    ])
    expect(url).toBe('https://x/a.webp')
  })

  it('ignores rows without url', () => {
    const url = selectRuntimeAssetUrl([row({ url: '' })])
    expect(url).toBeNull()
  })
})