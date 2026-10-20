// ============================================
// Bite Me Baby — A5/A3 unit tests (2026-10-20)
// 1) classifyDriverError: แยก network / permission / state / unknown ถูกต้อง
//    (UI ใช้ตัดสินใจ retry ได้เฉพาะเครือข่าย — ต้องไม่เดาผิด)
// 2) uploadPodPhoto: ตรวจชนิด/ขนาดไฟล์ก่อนแตะ storage (fail fast, ข้อความไทย)
// ============================================

import { describe, it, expect, vi } from 'vitest'
import { classifyDriverError, uploadPodPhoto, compressPodImage, POD_MAX_INPUT_BYTES } from '@/lib/driverService'

describe('classifyDriverError (A5)', () => {
  it('network failures → kind=network (retry ได้)', () => {
    const r = classifyDriverError({ message: 'TypeError: Failed to fetch' })
    expect(r.kind).toBe('network')
    expect(r.error).toContain('เครือข่าย')
  })

  it('offline (navigator.onLine=false) → kind=network', () => {
    vi.stubGlobal('navigator', { onLine: false })
    try {
      expect(classifyDriverError({ message: 'whatever' }).kind).toBe('network')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('auth/identity errors → kind=permission', () => {
    expect(classifyDriverError({ message: 'ERR_NOT_A_DRIVER: no driver record' }).kind).toBe('permission')
    expect(classifyDriverError({ message: 'ERR_FORBIDDEN' }).kind).toBe('permission')
    expect(classifyDriverError({ message: 'JWT expired' }).kind).toBe('permission')
  })

  it('assignment/POD/state errors → kind=state', () => {
    expect(classifyDriverError({ message: 'ERR_ASSIGNMENT_NOT_ACCEPTABLE' }).kind).toBe('state')
    expect(classifyDriverError({ message: 'ERR_POD_REQUIRED' }).kind).toBe('state')
    expect(classifyDriverError({ message: 'ERR_ALREADY_DELIVERED' }).kind).toBe('state')
  })

  it('ข้อความ error แปลเป็นไทยเสมอ (ไม่หลุดรหัสระบบ)', () => {
    const r = classifyDriverError({ message: 'ERR_POD_REQUIRED' })
    expect(r.error).toContain('รูปส่งมอบ')
  })
})

describe('uploadPodPhoto guards (A3)', () => {
  it('ไฟล์ไม่ใช่รูป → ปฏิเสธก่อนแตะ storage', async () => {
    const f = new File(['x'], 'note.txt', { type: 'text/plain' })
    const r = await uploadPodPhoto(f, 'drv-x', 'ORD-1')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.kind).toBe('state')
      expect(r.error).toContain('รูปภาพ')
    }
  })

  it('ไฟล์ใหญ่เกิน limit → ปฏิเสธก่อนแตะ storage', async () => {
    const f = new File([new Uint8Array(1024)], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(f, 'size', { value: POD_MAX_INPUT_BYTES + 1 })
    const r = await uploadPodPhoto(f, 'drv-x', 'ORD-1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('15MB')
  })

  it('ข้อมูลงานไม่ครบ (ไม่มี driver/order) → ปฏิเสธ', async () => {
    const f = new File([new Uint8Array(10)], 'ok.jpg', { type: 'image/jpeg' })
    const r = await uploadPodPhoto(f, '', '')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('ข้อมูลงานไม่ครบ')
  })
})

describe('compressPodImage (A3)', () => {
  it('ไฟล์ไม่ใช่รูป → reject (ERR_POD_NOT_IMAGE)', async () => {
    const f = new File(['x'], 'a.txt', { type: 'text/plain' })
    await expect(compressPodImage(f)).rejects.toThrow('ERR_POD_NOT_IMAGE')
  })
})