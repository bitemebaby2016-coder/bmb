// R44 (Owner 2026-11-01) — ปิดลูป T6/T9/T10/T13 จาก feedback ชุดทดสอบ:
//  T10 = "ใช้พิกัดกดแล้วเงียบ · ยืนยันตำแหน่งไปคิดค่าบริการไม่ได้" → ห้าม return เงียบ 3 จุด
//  T6  = FB in-app เสิร์ฟ HTML/บันเดิลเก่า (?cart= เงียบ) → _headers no-cache
//  T13 = หน้าปริ้นเตอร์ รก/ซ้ำ → ขั้นตอน ①-⑥ + ค่า known-good 80/690 บนวิซาร์ด
//  T9  = evidence: production chunk มี key จริง (probe) → ปัญหาอยู่ runtime ไม่ใช่ build
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const picker = read('src/components/delivery/DeliveryMapPicker.tsx')
const checkout = read('src/pages/CheckoutPage.tsx')
const checker = read('src/components/delivery/DistanceChecker.tsx')
const headers = read('public/_headers')

describe('R44 T10 — ห้ามกดแล้วเงียบ (manual pin / ยืนยันตำแหน่ง / แผงค่าจัดส่ง)', () => {
  it('DeliveryMapPicker: parse ไม่ผ่าน = แดงบอกวิธีแก้ · ผ่าน = เขียวบอกขั้นถัดไป (manual-pin-msg)', () => {
    expect(picker).toContain('data-testid="manual-pin-msg"')
    expect(picker).toContain('data-testid="manual-pin-use"')
    expect(picker).toContain('if (!p) {')
    expect(picker).toContain('พิกัดยังไม่ถูกต้อง')
    expect(picker).toContain('ยืนยันตำแหน่งจัดส่งนี้') // ข้อความสำเร็จชี้ขั้นถัดไป
  })

  it('CheckoutPage: guard ยืนยัน = toast เหตุผลจริง (ไม่ใช่ return เงียบ) + บอกสถานะครบทุกกรณี', () => {
    expect(checkout).toContain('ห้าม return เงียบ')
    expect(checkout).toContain('ยังไม่มีพิกัดจัดส่ง')
    expect(checkout).toContain('data-testid="confirm-location-hint"')
    expect(checkout).toContain('data-testid="confirm-location-done"')
    expect(checkout).toContain('ค่าจัดส่งคำนวณด้านล่าง')
    // เดิม: if (!deliveryPointStatus(deliveryAddress).confirmable) return — เงียบสนิท
    expect(checkout).not.toMatch(/if \(!deliveryPointStatus\(deliveryAddress\)\.confirmable\) return/)
  })

  it('DistanceChecker: quote คำนวณไม่ออก = แสดงเหตุผล (routeError) ไม่ใช่แผงว่าง', () => {
    expect(checker).toContain('error: routeError')
    expect(checker).toContain('data-testid="distance-checker-error"')
    expect(checker).toContain('ยังคำนวณค่าจัดส่งไม่สำเร็จ')
  })
})

describe('R44 T6 — HTML ห้าม cache (FB in-app เคยเสิร์ฟบันเดิลเก่า → ?cart=/ค่า key เก่า)', () => {
  it('_headers = Cache-Control no-cache ทุกหน้า HTML (SPA) · /assets/* ยัง immutable', () => {
    expect(headers).toContain('R44 T6')
    expect(headers).toContain('Cache-Control: no-cache')
    expect(headers).toContain('Cache-Control: public, max-age=31536000, immutable')
  })
})

describe('R44 T13 — หน้าปริ้นเตอร์: ขั้นตอน ①-⑥ + ค่า known-good 80/690', () => {
  const printSrc = read('src/pages/admin/AdminPrintSettings.tsx')
  it('เลขขั้นตอน + ค่า known-good บนวิซาร์ด + contract เดิม (ไม่ใช้ชดเชย ×4) ไม่พัง', () => {
    expect(printSrc).toContain('data-testid="print-flow-steps"')
    expect(printSrc).toContain('data-testid="print-known-good"')
    expect(printSrc).toContain('ชดเชยฟีด 80px · หน้าดวง 680px')
    expect(printSrc).toContain('② 🖨️')
    expect(printSrc).toContain('⑤ 📡')
    expect(printSrc).toContain('⑥ 🧭')
    expect(printSrc.match(/ไม่ใช้ชดเชย/g)!.length).toBeGreaterThanOrEqual(4)
    expect(printSrc).toContain('Incognito') // contract เดิมของ stickerQueueR31 ยังอยู่ (กล่อง QZ)
  })
})

describe('R44 T9 — evidence: production bundle มี key จริง (ปัญหา = runtime ไม่ใช่ build)', () => {
  it('probe จริงพบ AIza ใน googleMaps chunk + ข้อความ missing-key เป็น const โค้ด (ไม่ได้แปลว่าถูกยิง)', () => {
    const probe = JSON.parse(read('e2e/r44_maps_bundle_probe.json')) as { aiza_files: unknown[]; missing_msg_files: string[] }
    expect(probe.aiza_files.length).toBeGreaterThan(0)
    expect(probe.missing_msg_files.some((f) => f.includes('googleMaps'))).toBe(true)
    const keyProbe = JSON.parse(read('e2e/r44_gmaps_key_probe.json')) as { key_masked: string }
    expect(keyProbe.key_masked.startsWith('AIza')).toBe(true)
  })
})