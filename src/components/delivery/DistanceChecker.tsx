// ============================================
// Bite Me Baby — Smart Delivery Distance Checker
// ============================================
// Address/coordinate verification with a strict debounce (default 500ms)
// before the coordinates reach the routing hub, minimizing rate-limit usage.
// Visualizes the two-tier decision (Bite Drive vs 3rd-party) on a GlassCard.

import { useEffect, useRef, useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { useDeliveryRouter, type LatLng } from '@/stores/useDeliveryRouter'
import { usePlatformConfig } from '@/config/platformConfig'
import { fetchServerDeliveryFee, type DeliveryFeeQuote } from '@/lib/deliveryFeeApi'

export interface DistanceCheckerProps {
  origin?: LatLng | null
  /** Controlled destination (from geolocation / map pin). */
  destination?: LatLng | null
  label?: string
}

export function DistanceChecker({ origin = null, destination = null, label = 'ตรวจสอบจุดจัดส่ง' }: DistanceCheckerProps) {
  const config = usePlatformConfig()
  const { quote, setOrigin, setDestination, evaluate } = useDeliveryRouter()

  // Debounce 500ms before evaluating — throttles coordinate-change API calls.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [evaluating, setEvaluating] = useState(false)

  // W-1.4b: ค่าจัดส่ง display ของ Tier 1 (Bite Drive) ดึงจาก server authority
  // (delivery_zones ผ่าน compute_delivery_fee_rpc) — แทนค่าคงที่ biteDriveFlatFee
  const [serverFee, setServerFee] = useState<DeliveryFeeQuote | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!destination || !quote || quote.tier !== 'bite_drive') {
      setServerFee(null)
      return
    }
    void fetchServerDeliveryFee({
      dropoffLatitude: destination.latitude,
      dropoffLongitude: destination.longitude,
      distanceKm: quote.distanceKm,
    })
      .then((r) => { if (!cancelled) setServerFee(r) })
      .catch(() => { if (!cancelled) setServerFee(null) })
    return () => { cancelled = true }
  }, [destination, quote])

  // Hydrate the store from props without re-evaluating on every keystroke.
  useEffect(() => {
    setOrigin(origin)
  }, [origin, setOrigin])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!destination) {
      setEvaluating(false)
      return
    }
    setDestination(destination)
    setEvaluating(true)
    timer.current = setTimeout(() => {
      evaluate()
      setEvaluating(false)
    }, config.delivery.debounceMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [destination, config.delivery.debounceMs, setDestination, evaluate])

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">{label}</h3>
        {evaluating && <span className="text-xs text-slate-500">กำลังคำนวณ...</span>}
      </div>

      {!config.delivery.biteDriveEnabled && (
        <p className="mt-2 text-xs font-medium text-amber-600" data-testid="bite-drive-disabled-note">
          ร้านปิดรับงาน Bite Drive ชั่วคราว — ติดต่อร้านเพื่อสอบถามวิธีจัดส่งที่เปิดรับ
        </p>
      )}

      {!destination && <p className="text-sm text-slate-500 mt-2">กรุณาเลือกที่อยู่หรือปักหมุดแผนที่เพื่อตรวจสอบค่าจัดส่ง</p>}

      {destination && !evaluating && quote && (
        <div className="mt-3 space-y-2" data-testid="distance-checker-result">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-slate-500">ระยะทาง</span>
            <span className="font-semibold text-slate-800">{quote.distanceKm.toFixed(2)} กม.</span>
          </div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-slate-500">ช่องทาง</span>
            <span className="font-semibold text-slate-800">{quote.providerLabel}</span>
          </div>
          {quote.markup > 0 && (
            <div className="flex items-baseline justify-between text-xs text-slate-500">
              <span>ค่าบริการภายนอก</span>
              <span>฿{quote.executorFee} + markup ฿{quote.markup}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between text-sm border-t border-white/30 pt-2">
            <span className="text-slate-500">ค่าจัดส่งรวม</span>
            <span className="font-bold text-lg text-slate-800">
              ฿{serverFee && serverFee.delivery_fee != null ? serverFee.delivery_fee : quote.finalFee}
              {serverFee?.source === 'server' && serverFee.delivery_fee != null && (
                <span className="ml-1 text-[10px] font-normal text-emerald-600">(จากโซนร้าน)</span>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{quote.rationale}</p>
        </div>
      )}
    </GlassCard>
  )
}

/** 500ms debounce helper exposed for reuse in address inputs. */
export function createDebounced(fn: (...args: unknown[]) => void, wait = 500) {
  let t: ReturnType<typeof setTimeout> | null = null
  return (...args: unknown[]) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}
