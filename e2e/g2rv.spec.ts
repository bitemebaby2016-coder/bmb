import { test, expect } from '@playwright/test'
import fs from 'node:fs'

// Real GoTrue session for the tenant-A admin fixture, created via the isolated
// stack's GoTrue admin API (see scripts/jwt-debug.cjs + profile promote via psql).
// Credentials never appear in code or reports.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54335'
const ANON = process.env.VITE_SUPABASE_ANON_KEY || ''
const SESSION_FILE = process.env.E2E_SESSION_FILE || ''
const SESSION = SESSION_FILE ? JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) : null

async function injectSession(page: any) {
  if (!SESSION) throw new Error('E2E_SESSION_FILE not set')
  await page.addInitScript((tok: string) => {
    localStorage.setItem('sb-127-auth-token', tok)
  }, JSON.stringify(SESSION))
}
test('A: Tenant A admin sees own asset registry rows in Admin UI', async ({ page }) => {
  await injectSession(page)
  await page.goto('/admin/media')
  await expect(page.getByText('Asset Registry')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('brand.logo.brand-a1')).toBeVisible()
})

test('B: Tenant A admin does NOT see inactive Tenant B asset', async ({ page }) => {
  await injectSession(page)
  await page.goto('/admin/media')
  await expect(page.getByText('Asset Registry')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('B1-inactive')).toHaveCount(0)
})

test('D: Tenant A admin sees own inactive asset (own-scope read)', async ({ page }) => {
  await injectSession(page)
  await page.goto('/admin/media')
  await expect(page.getByText('Asset Registry')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('A1-logo-old')).toBeVisible()
})

test('E: cross-tenant mutation from browser session is blocked by RLS', async ({ page }) => {
  await injectSession(page)
  await page.goto('/admin/media')
  const token = SESSION.access_token
  const res = await page.evaluate(async ({ url, anon, token }) => {
    const r = await fetch(`${url}/rest/v1/media_assets?id=eq.m-b1-logo`, {
      method: 'PATCH',
      headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false }),
    })
    await r.text()
    const after = await fetch(`${url}/rest/v1/media_assets?id=eq.m-b1-logo&select=is_active`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    })
    const state = await after.json()
    return { stillActive: state[0]?.is_active }
  }, { url: SUPABASE_URL, anon: ANON, token })
  expect(res.stillActive).toBe(true)
})

test('I+H: runtime consumer uses registry asset (approved wins over mock, fallback intact)', async ({ page }) => {
  await page.goto('/?brand=brand-a1')
  await page.waitForFunction(() => {
    const href = document.querySelector('link[rel*="icon"]')?.getAttribute('href') || ''
    return href.includes('isolated.local')
  }, { timeout: 20000 })
  const icon = await page.getAttribute('link[rel*="icon"]', 'href')
  expect(icon).toContain('A1-logo.webp')
  expect(icon).not.toContain('A1-mock')
})