// ============================================
// R-08 — Rider POD ต้องทำงานข้ามเบราว์เซอร์ (D8 2026-10-25)
// ============================================
// ปัญหาเดิมที่ Owner เจอ: "รูปขึ้นเฉพาะบางเบราว์เซอร์" —
//   1. กล้อง: video.play() ไม่รอเฟรม (500ms เดา) + ไม่มี playsInline/muted →
//      iOS/Safari ได้ canvas 0×0 = รูปว่าง
//   2. GPS ปลอม 0,0 ตอนดึงไม่ได้
//   3. compressPodImage ไม่จัดการ EXIF orientation
// ชุดนี้กัน regression ของจุดซ่อมทั้งสาม
// ============================================

import { describe, it, expect } from 'vitest'
import riderPodSrc from '../components/rider/RiderPod.tsx?raw'
import driverServiceSrc from '../lib/driverService.ts?raw'

describe('R-08 — cross-browser POD guards', () => {
  it('RiderPod: กล้องรอเฟรมจริง + playsInline/muted (ไม่ใช่ 500ms เดา)', () => {
    expect(riderPodSrc).toContain('waitForVideoFrame')
    expect(riderPodSrc).not.toContain('setTimeout(r, 500)')
    expect(riderPodSrc).toContain("video.setAttribute('playsinline'")
    expect(riderPodSrc).toContain('video.muted = true')
    // กัน canvas 0×0 / dataURL ว่าง
    expect(riderPodSrc).toContain('ERR_POD_CAMERA_NO_FRAME')
    expect(riderPodSrc).toContain("dataUrl.startsWith('data:image/jpeg')")
  })

  it('RiderPod: ไม่ปลอม GPS 0,0 — ดึงไม่ได้ต้อง null + แจ้งผู้ใช้', () => {
    expect(riderPodSrc).not.toContain('latitude: 0, longitude: 0')
    expect(riderPodSrc).toContain('pod-gps-error')
    expect(riderPodSrc).toContain('pod-capture-error')
  })

  it('compressPodImage: ใช้ createImageBitmap + imageOrientation (EXIF ถูกทุกเบราว์เซอร์) + fallback เดิม', () => {
    expect(driverServiceSrc).toContain("createImageBitmap(file, { imageOrientation: 'from-image' })")
    expect(driverServiceSrc).toContain('loadImageElement')
    // error codes เดิมต้องคง (contract กับ uploadPodPhoto/tests)
    expect(driverServiceSrc).toContain("ERR_POD_NOT_IMAGE")
    expect(driverServiceSrc).toContain("ERR_POD_PROCESS_FAILED")
  })
})