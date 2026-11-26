// ============================================
// Bite Me Baby — WP5 E2E: Goods Receiving UI (PurchaseHub)
// ต้องการ: dev/preview server (baseURL :5199) + บัญชี inventory/admin
//   + DB migration 219-225 (staging/test)
// สถานะ: LIVE_TEST_PENDING (ต้องรันบน staging ที่มี DB + auth จริง)
// ============================================

import { test, expect } from '@playwright/test'

test.describe('WP5 Goods Receiving UI', () => {
  test('create GRN draft → approve (real API)', async ({ page }) => {
    await page.goto('/login')
    const email = process.env.BMB_E2E_EMAIL
    const password = process.env.BMB_E2E_PASSWORD
    if (!email || !password) {
      test.skip(true, 'ต้องตั้ง BMB_E2E_EMAIL/BMB_E2E_PASSWORD + staging DB (migration 225)')
      return
    }
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/(shop|admin)/)

    await page.goto('/admin/purchase')
    await page.getByRole('button', { name: /รับสินค้า/ }).click()

    // สร้างใบรับสินค้า
    await page.getByRole('button', { name: /สร้างใบรับสินค้า/ }).click()
    await page.locator('select').first().selectOption({ index: 1 })
    // กรอกจำนวนรับแถวแรก
    const qtyInput = page.locator('table input[type="number"]').first()
    await qtyInput.fill('2')
    await page.getByRole('button', { name: /บันทึก/ }).click()

    // ตรวจมีแถว GRN ใหม่ + อนุมัติ
    const row = page.locator('table tbody tr').filter({ hasText: /GRN-\d{8}-\d{4}/ }).first()
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'อนุมัติ' }).click()
    await expect(row).toContainText('อนุมัติแล้ว')
  })

  test('validation: cannot save without PO', async ({ page }) => {
    await page.goto('/admin/purchase')
    await page.getByRole('button', { name: /รับสินค้า/ }).click()
    await page.getByRole('button', { name: /สร้างใบรับสินค้า/ }).click()
    await page.getByRole('button', { name: /บันทึก/ }).click()
    await expect(page.getByText('กรุณาเลือกใบสั่งซื้อ')).toBeVisible()
  })
})