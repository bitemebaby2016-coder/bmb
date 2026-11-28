// ============================================
// buildRuntimeManifest (pure) — runtime brand icons
// ============================================
import { describe, it, expect } from 'vitest'
import { buildRuntimeManifest } from '@/lib/runtimeBrandIcons'

describe('buildRuntimeManifest — PWA manifest follows admin logo', () => {
  it('uses the provided logo URL for every icon', () => {
    const m = buildRuntimeManifest('https://cdn.example.com/logo-real.png')
    expect(m.icons).toHaveLength(3)
    for (const icon of m.icons) expect(icon.src).toBe('https://cdn.example.com/logo-real.png')
    expect(m.icons.map((i) => i.purpose)).toEqual(['any', 'any', 'maskable'])
  })

  it('falls back to the real bundled logo when blank (never the orange B placeholder)', () => {
    const m = buildRuntimeManifest('   ')
    for (const icon of m.icons) expect(icon.src).toBe('/Head Logo.webp')
  })

  it('keeps the canonical app identity (name/short_name/theme)', () => {
    const m = buildRuntimeManifest('')
    expect(m.short_name).toBe('BMB')
    expect(m.theme_color).toBe('#FF5E1E')
    expect(m.display).toBe('standalone')
  })
})