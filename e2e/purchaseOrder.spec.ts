// ============================================
// Bite Me Baby — WP3 E2E: Purchase Order UI (PurchaseHub)
// ต้องการ: dev/preview server ที่ baseURL (ค่าเริ่มต้น :5199) + บัญชี admin
//   + DB ที่มี migration 219-224 applied (staging/test)
// เช่น: npm run build && npm run preview -- --port 5199
//   แล้ว: npx playwright test e2e/purchaseOrder.spec.ts
// หมายเหตุ: ต้องเปิดใช้งานจริง (ห้าม mock) — ยืนยันสร้าง/แก้/ส่ง/อนุมัติผ่าน API จริง
// สถานะ: LIVE_TEST_PENDING (ต้องรันบน staging ที่มี DB + auth จริง)
// ============================================

import { test, expect } from '@playwright/test'

test.describe('WP3 Purchase Order UI', () => {
  test('create → submit → approve flow (real API)', async ({ page }) => {
    // เข้าสู่ระบบด้วย admin (ตั้งค่า env BMB_E2E_EMAIL/PASSWORD หรือ storageState)
    await page.goto('/login')
    const email = process.env.BMB_E2E_EMAIL
    const password = process.env.BMB_E2E_PASSWORD
    if (!email || !password) {
      test.skip(true, 'ต้องตั้ง BMB_E2E_EMAIL/BMB_E2E_PASSWORD + staging DB (migration 224)')
      return
    }
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/(shop|admin)/)

    // ไปที่ PurchaseHub → แท็บใบสั่งซื้อ
    await page.goto('/admin/purchase')
    await page.getByRole('button', { name: /ใบสั่งซื้อ/ }).click()

    // สร้างใบสั่งซื้อ
    await page.getByRole('button', { name: /สร้างใบสั่งซื้อ/ }).click()
    await page.locator('select').first().selectOption({ index: 1 })
    await page.getByRole('button', { name: /เพิ่มรายการ/ }).click()
    await page.getByRole('button', { name: 'บันทึก' }).click()

    // ตรวจว่ามีแถว PO ใหม่ (เลขที่ PO-YYYYMMDD-)
    await expect(page.locator('table tbody tr').filter({ hasText: /^PO-\d{8}-\d{4}$/ }).first()).toBeVisible()

    // ส่งอนุมัติ + อนุมัติ
    const row = page.locator('table tbody tr').filter({ hasText: /PO-\d{8}-\d{4}/ }).first()
    await row.getByRole('button', { name: /ส่งอนุมัติ/ }).click()
    await expect(row).toContainText('รออนุมัติ')
    await row.getByRole('button', { name: 'อนุมัติ' }).click()
    await expect(row).toContainText('อนุมัติแล้ว')
  })

  test('validation: cannot save without supplier/lines', async ({ page }) => {
    await page.goto('/admin/purchase')
    await page.getByRole('button', { name: /ใบสั่งซื้อ/ }).click()
    await page.getByRole('button', { name: /สร้างใบสั่งซื้อ/ }).click()
    await page.getByRole('button', { name: 'บันทึก' }).click()
    await expect(page.getByText('กรุณาเลือกผู้ขาย')).toBeVisible()
  })
})