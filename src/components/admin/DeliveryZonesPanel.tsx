// ============================================
// Bite Me Baby — Delivery Zones Panel (D2 2026-10-25)
// ============================================
// ย้ายมาจาก AdminSettings (แท็บ store) — D2: ศูนย์ขนส่งเดียว = เจ้าของเดียวของ
// UI ค่าส่ง/โซน · API/ตารางเดิม (delivery_zones + supabase upsert) ไม่แตะต้อง
// ============================================

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'

interface ZoneRow {
  id: string
  name?: string
  min_distance_km?: number | string
  max_distance_km?: number | string
  fee?: number | string
}

export function DeliveryZonesPanel() {
  const [zones, setZones] = useState<ZoneRow[] | null>(null)

  async function reload(): Promise<void> {
    const { data } = await supabase.from('delivery_zones').select('*').order('min_distance_km')
    setZones((data as ZoneRow[] | null) ?? [])
  }

  useEffect(() => { void reload() }, [])

  async function saveZone(z: ZoneRow): Promise<void> {
    const row = {
      ...z,
      min_distance_km: Number(z.min_distance_km),
      max_distance_km: Number(z.max_distance_km),
      fee: Number(z.fee),
    }
    const { error } = await supabase.from('delivery_zones').upsert(row, { onConflict: 'id' })
    showToast(error ? `Zone failed: ${error.message}` : `Saved zone ${row.name}`, error ? 'error' : 'success')
    if (!error) await reload()
  }

  function patch(id: string, changes: Partial<ZoneRow>): void {
    setZones((zs) => (zs ?? []).map((x) => (x.id === id ? { ...x, ...changes } : x)))
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-brand-accent">🚚 Delivery Zones (ค่าส่ง — delivery_zones)</h2>
      <p className="text-sm text-brand-muted mt-1 mb-3">
        เจ้าของเดียวของค่าส่งตามระยะ (D2 2026-10-25) — เซิร์ฟเวอร์คำนวณค่าส่งจริงอีกครั้งตอนสร้างออเดอร์ (compute_delivery_fee)
      </p>
      {(zones ?? []).map((z) => (
        <div key={z.id} className="card" data-testid={`zone-${z.id}`}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <label className="text-xs flex flex-col gap-1">ชื่อโซน
              <input className="input" value={z.name ?? ''}
                onChange={(e) => patch(z.id, { name: e.target.value })} />
            </label>
            <label className="text-xs flex flex-col gap-1">จาก (กม.)
              <input className="input" value={String(z.min_distance_km ?? '')}
                onChange={(e) => patch(z.id, { min_distance_km: /^-?\d+(\.\d+)?$/.test(e.target.value) ? Number(e.target.value) : e.target.value })} />
            </label>
            <label className="text-xs flex flex-col gap-1">ถึง (กม.)
              <input className="input" value={String(z.max_distance_km ?? '')}
                onChange={(e) => patch(z.id, { max_distance_km: /^-?\d+(\.\d+)?$/.test(e.target.value) ? Number(e.target.value) : e.target.value })} />
            </label>
            <label className="text-xs flex flex-col gap-1">ค่าส่ง (฿)
              <input className="input" value={String(z.fee ?? '')}
                onChange={(e) => patch(z.id, { fee: /^-?\d+(\.\d+)?$/.test(e.target.value) ? Number(e.target.value) : e.target.value })} />
            </label>
            <button onClick={() => void saveZone(z)} className="btn btn-success text-sm">💾 บันทึกโซน</button>
          </div>
        </div>
      ))}
    </div>
  )
}