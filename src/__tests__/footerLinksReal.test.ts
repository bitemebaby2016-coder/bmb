// ============================================
// R12 (Owner 2026-10-27): (1) Footer links must be real — every static
// footer link path must have a real <Route> in App.tsx (no dead links).
// (2) Deep-link B wiring guard — both the bell dropdown and the
// notification center must resolve a route and navigate on tap.
// ============================================
import { describe, it, expect } from 'vitest'
import footerSrc from '../components/layout/Footer.tsx?raw'
import appSrc from '../App.tsx?raw'
import dropdownSrc from '../components/notification/NotificationDropdown.tsx?raw'
import centerSrc from '../pages/NotificationCenterPage.tsx?raw'

describe('R12 — footer links real (every static path has a Route)', () => {
  const footerPaths = [...footerSrc.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1])
  const routePaths = new Set([...appSrc.matchAll(/path="([^"]+)"/g)].map((m) => m[1]))

  it('every footer static link path (staticSections + contactLinks + menu) has a Route in App.tsx', () => {
    expect(footerPaths.length).toBeGreaterThanOrEqual(8)
    for (const p of footerPaths) {
      expect(routePaths.has(p), `footer link has no Route: ${p}`).toBe(true)
    }
  })
})

describe('R12 — deep-link B wiring: bell dropdown + notification center navigate on tap', () => {
  it('NotificationDropdown resolves a route and navigates to the target', () => {
    expect(dropdownSrc).toContain('resolveNotificationRoute')
    expect(dropdownSrc).toContain('navigate(target)')
  })
  it('NotificationCenterPage resolves a route and navigates to the target', () => {
    expect(centerSrc).toContain('resolveNotificationRoute')
    expect(centerSrc).toContain('navigate(target)')
  })
})