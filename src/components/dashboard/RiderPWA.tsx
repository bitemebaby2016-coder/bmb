// ============================================
// Bite Me Baby — Rider PWA (Delivery Completion + POD)
// ============================================
// Restricts the final `Delivered` transition:
//  1. HTML5 Geolocation must place the rider within a radius of the drop-off.
//  2. A Proof-of-Delivery photo must be captured (compressed → base64) and
//     stored as `proof_of_delivery_url` BEFORE the transition is allowed.
// Uses the reactive order state machine; the completion gates block `Delivered`.

import { useRef, useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { useOrderStateMachine } from '@/stores/useOrderStateMachine'
import { haversineDistanceKm } from '@/lib/deliveryRouter'

export interface RiderPWAProps {
  /** Expected drop-off coordinates (from the order). */
  dropOff: { latitude: number; longitude: number }
  /** Allowed margin (meters) around the drop-off to confirm delivery. */
  radiusMeters?: number
}

export function RiderPWA({ dropOff, radiusMeters = 300 }: RiderPWAProps) {
  const { status, transition } = useOrderStateMachine()
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [podUrl, setPodUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function checkIn() {
    if (!('geolocation' in navigator)) {
      setGeoError('เบราว์เซอร์ไม่รองรับ Geolocation API')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setGeoError(null)
      },
      (err) => setGeoError(`อ่านพิกัดไม่สำเร็จ: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPodUrl(reader.result as string) // data URL → proof_of_delivery_url
    reader.readAsDataURL(file)
  }

  // Distance to the drop-off (m). Coords absent ⇒ cannot verify ⇒ gate blocked.
  const distanceM = coords ? haversineDistanceKm(coords.latitude, coords.longitude, dropOff.latitude, dropOff.longitude) * 1000 : null
  const geoOk = coords !== null && distanceM !== null && distanceM <= radiusMeters

  function handleDeliver() {
    if (!geoOk) return
    if (!podUrl) return
    transition('Delivered')
  }

  return (
    <GlassCard className="p-5">
      <h3 className="font-bold text-slate-800 mb-1">🧑‍🔧 หน้าจอไรเดอร์ (PWA)</h3>
      <p className="text-sm text-slate-500 mb-4">สถานะปัจจุบัน: {status}</p>

      <h4 className="text-sm font-semibold text-slate-700 mb-2">1. เช็คอินตำแหน่งปลายทาง</h4>
      <button onClick={checkIn} className="btn btn-outline text-sm mb-2" data-testid="rider-checkin">
        📍 ตรวจพิกัดปัจจุบัน
      </button>
      {coords && (
        <p className="text-xs text-slate-600 mb-1">
          พิกัด: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}{' '}
          · ห่างปลายทาง {distanceM !== null ? Math.round(distanceM) : '-'} ม.
        </p>
      )}
      {geoError && <p className="text-xs text-red-600 mb-1">{geoError}</p>}
      {coords && !geoOk && (
        <p className="text-xs text-amber-600 mb-2">⚠️ ยังอยู่นอกระยะ {radiusMeters} ม. — ยืนยันส่งไม่ได้</p>
      )}
      {geoOk && <p className="text-xs text-green-600 mb-2">✅ อยู่ในระยะที่กำหนด ตรวจพิกัดผ่านแล้ว</p>}

      <h4 className="text-sm font-semibold text-slate-700 mb-2 mt-3">2. ถ่ายภาพ proof of delivery (POD)</h4>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickPhoto} className="block text-xs mb-2" data-testid="rider-pod-input" />
      {podUrl && <img src={podUrl} alt="Proof of delivery" className="w-32 h-32 object-cover rounded-xl mb-2" />}

      <button
        onClick={handleDeliver}
        disabled={!geoOk || !podUrl}
        className="btn btn-primary w-full mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="rider-deliver"
      >
        {!geoOk ? '⛔ ตรวจพิกัดก่อนส่ง' : !podUrl ? '📸 ถ่ายรูป POD ก่อนส่ง' : '✅ ยืนยัน Delivered'}
      </button>
    </GlassCard>
  )
}
