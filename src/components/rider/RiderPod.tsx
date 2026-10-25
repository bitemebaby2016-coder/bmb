// ============================================
// Bite Me Baby — Rider PWA Proof of Delivery (POD)
// Mandatory: Photo + GPS coordinates on delivery completion.
// ============================================

import { useState, useRef, useCallback } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'

export interface PodCaptureResult {
  photoDataUrl: string
  latitude: number
  longitude: number
  capturedAt: string
}

export interface RiderPodProps {
  orderId: string
  orderNumber: string
  onCaptured: (pod: PodCaptureResult) => void
  onCancel?: () => void
}

async function getGPS(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    // R-08/D8 (2026-10-25): ไม่ปลอม 0,0 อีกต่อไป (ZERO-FAKE) — ดึงไม่ได้ = null ให้ผู้ใช้ลองใหม่
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}

/** R-08: รอเฟรมกล้องจน videoWidth พร้อมจริง (ข้ามเบราว์เซอร์ — เดิมรอ 500ms ตายตัว
 *  → iOS/Safari ช้ากว่า ได้ canvas 0×0 = รูปว่าง "ไม่ขึ้น") */
function waitForVideoFrame(video: HTMLVideoElement, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve() }
    const fail = () => { cleanup(); reject(new Error('ERR_POD_CAMERA_NO_FRAME')) }
    const timer = setTimeout(() => (video.videoWidth > 0 ? done() : fail()), timeoutMs)
    const cleanup = () => { clearTimeout(timer); video.removeEventListener('loadeddata', done) }
    if (video.videoWidth > 0) { done(); return }
    video.addEventListener('loadeddata', done)
    video.addEventListener('error', fail, { once: true })
  })
}

export function RiderPod({ orderId, orderNumber, onCaptured, onCancel }: RiderPodProps) {
  const [capturing, setCapturing] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCameraCapture = useCallback(async () => {
    setCapturing(true)
    setCaptureError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      const video = document.createElement('video')
      // R-08: iOS บังคับ muted+playsInline ไม่งั้น play() ถูกบล็อก (เงียบ = ดูเหมือนกล้องพัง)
      video.muted = true
      video.playsInline = true
      video.setAttribute('playsinline', '')
      video.setAttribute('muted', '')
      video.srcObject = stream
      await video.play()
      await waitForVideoFrame(video) // รอจนมีเฟรมจริง (ไม่ใช่ 500ms เดา)
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      if (canvas.width < 2 || canvas.height < 2) throw new Error('ERR_POD_CAMERA_NO_FRAME')
      canvas.getContext('2d')!.drawImage(video, 0, 0)
      ;(stream as MediaStream).getTracks().forEach(t => t.stop())
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      if (!dataUrl.startsWith('data:image/jpeg')) throw new Error('ERR_POD_CAMERA_NO_FRAME')
      setPhotoUrl(dataUrl)
    } catch {
      // fallback ไปช่องเลือกรูป (ถ่าย/decode ไม่ได้ในเบราว์เซอร์นี้)
      setCaptureError('กล้องเบราว์เซอร์นี้ใช้ไม่ได้ — ใช้ปุ่ม "เลือกรูป" แทน (แนะนำ JPEG/PNG)')
      fileInputRef.current?.click()
    } finally { setCapturing(false) }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setCaptureError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      if (!result.startsWith('data:image/')) {
        setCaptureError('ไฟล์นี้ไม่ใช่รูปภาพที่เบราว์เซอร์เปิดได้ — ถ่ายใหม่เป็น JPEG/PNG')
        return
      }
      setPhotoUrl(result)
    }
    reader.onerror = () => setCaptureError('อ่านไฟล์รูปไม่สำเร็จ — เลือกใหม่อีกครั้ง')
    reader.readAsDataURL(file)
    e.target.value = '' // เลือกไฟล์เดิมซ้ำได้
  }, [])

  const handleConfirm = useCallback(() => {
    if (!photoUrl || !gps) return
    onCaptured({ photoDataUrl: photoUrl, latitude: gps.lat, longitude: gps.lng, capturedAt: new Date().toISOString() })
  }, [photoUrl, gps, onCaptured])

  return (
    <GlassCard className="p-6 max-w-md mx-auto">
      <div className="mb-4 pb-3 border-b border-white/20">
        <h3 className="text-lg font-bold text-brand-accent">📸 ยืนยันการจัดส่ง</h3>
        <p className="text-sm text-brand-muted">{orderNumber}</p>
      </div>
      {/* Photo */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-brand-accent mb-2">📷 รูปหลักฐาน (บังคับ)</label>
        {captureError && (
          <p className="text-xs text-amber-600 mb-2" data-testid="pod-capture-error">{captureError}</p>
        )}
        {!photoUrl ? (
          <div className="flex gap-2">
            <button type="button" onClick={handleCameraCapture} disabled={capturing} className="btn btn-primary px-3 py-2 rounded-xl text-sm disabled:opacity-50">
              {capturing ? '⏳ กำลังเปิด...' : '📷 เปิดกล้อง'}
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="btn bg-slate-100 text-slate-700 px-3 py-2 rounded-xl text-sm">
              🖼️ เลือกรูป
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </div>
        ) : (
          <div className="relative">
            <img src={photoUrl} alt="POD" className="w-full h-40 object-cover rounded-xl border border-white/20" />
            <button type="button" onClick={() => setPhotoUrl(null)} className="absolute top-1 right-1 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">✕</button>
          </div>
        )}
      </div>
      {/* GPS */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-brand-accent mb-2">📍 พิกัด GPS (บังคับ)</label>
        {!gps ? (
          <>
            <button type="button" onClick={() => {
              setGpsLoading(true); setGpsError(null)
              void getGPS().then(g => {
                if (g) { setGps({ lat: g.latitude, lng: g.longitude }) }
                else { setGpsError('ดึงพิกัดไม่สำเร็จ — เปิดสิทธิ์ตำแหน่งให้เบราว์เซอร์แล้วกดใหม่') }
                setGpsLoading(false)
              })
            }} disabled={gpsLoading} className="btn bg-slate-100 text-slate-700 px-3 py-2 rounded-xl text-sm disabled:opacity-50">
              {gpsLoading ? '⏳ กำลังดึง...' : '📍 ดึงตำแหน่ง'}
            </button>
            {gpsError && <p className="text-xs text-amber-600 mt-2" data-testid="pod-gps-error">{gpsError}</p>}
          </>
        ) : (
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
            <p className="text-sm font-mono text-emerald-700">📍 {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}</p>
          </div>
        )}
      </div>
      {/* Confirm */}
      <div className="flex gap-2 mt-4 pt-3 border-t border-white/20">
        <button type="button" disabled={!photoUrl || !gps} onClick={handleConfirm} className="btn btn-primary flex-1 rounded-xl disabled:opacity-50">
          ✅ ยืนยันจัดส่งสำเร็จ
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn bg-slate-100 text-slate-700 px-3 py-2 rounded-xl">ยกเลิก</button>
        )}
      </div>
    </GlassCard>
  )
}