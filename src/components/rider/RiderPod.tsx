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

async function getGPS(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ latitude: 0, longitude: 0 }); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve({ latitude: 0, longitude: 0 }),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}

export function RiderPod({ orderId, orderNumber, onCaptured, onCancel }: RiderPodProps) {
  const [capturing, setCapturing] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCameraCapture = useCallback(async () => {
    setCapturing(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      const video = document.createElement('video')
      video.srcObject = stream; video.play()
      await new Promise(r => setTimeout(r, 500))
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth; canvas.height = video.videoHeight
      canvas.getContext('2d')!.drawImage(video, 0, 0)
      ;(stream as MediaStream).getTracks().forEach(t => t.stop())
      setPhotoUrl(canvas.toDataURL('image/jpeg', 0.8))
    } catch { fileInputRef.current?.click() } finally { setCapturing(false) }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoUrl(reader.result as string); reader.readAsDataURL(file)
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
          <button type="button" onClick={() => { setGpsLoading(true); getGPS().then(g => { setGps({ lat: g.latitude, lng: g.longitude }); setGpsLoading(false) }) }} disabled={gpsLoading} className="btn bg-slate-100 text-slate-700 px-3 py-2 rounded-xl text-sm disabled:opacity-50">
            {gpsLoading ? '⏳ กำลังดึง...' : '📍 ดึงตำแหน่ง'}
          </button>
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