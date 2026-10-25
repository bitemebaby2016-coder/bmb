// ============================================
// Bite Me Baby — Transport Availability Board (D2 2026-10-25)
// ============================================
// แท็บ "ความพร้อมรับออเดอร์" ของศูนย์ขนส่ง — อ่านอย่างเดียว
// แสดงผลการตัดสินใจจาก authority เดิมเท่านั้น: roundBookability/roundCutoffLabel
// (src/lib/deliveryRoundStatus — client display mirror; server = authority จริงตอน
// สร้างออเดอร์) · ไม่มีตรรกะตัดสินใจใหม่ ไม่มี API ใหม่ — ใช้ listRoundsForDate เดิม
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRoundsForDate, type DeliveryRoundRow } from '@/lib/bmbAdminApi_rounds'
import { roundBookability, roundStatusLabel, roundCutoffLabel } from '@/lib/deliveryRoundStatus'

function todayBkk(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}

export function TransportAvailabilityBoard() {
  const [rows, setRows] = useState<DeliveryRoundRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listRoundsForDate(todayBkk())
      .then((list) => { if (!cancelled) setRows(list) })
      .catch((e) => { if (!cancelled) setError(String((e as Error)?.message ?? e)) })
    return () => { cancelled = true }
  }, [])

  return (
    <div data-testid="transport-availability-board">
      <h2 className="text-xl font-bold text-brand-accent">✅ ความพร้อมรับออเดอร์ของรอบวันนี้</h2>
      <p className="text-sm text-brand-muted mt-1 mb-3">
        ตารางนี้เป็น<b>มุมมองอ่านอย่างเดียว</b>ของการตัดสินใจจากโค้ดชุดเดียวกับหน้าสั่งซื้อ
        (deliveryRoundStatus) — เซมเดย์ไม่มีคัทออฟ (เหลือแค่เต็ม/ปิดโดยแอดมิน) ·
        คัทออฟมีเฉพาะพรีออเดอร์ · เซิร์ฟเวอร์ตรวจซ้ำอีกครั้งตอนสร้างออเดอร์เสมอ
      </p>
      {error && <p className="text-sm text-red-600" data-testid="availability-error">{error}</p>}
      {!rows && !error && <p className="text-sm text-brand-muted">กำลังโหลดรอบ…</p>}
      {rows && rows.length === 0 && (
        <p className="text-sm text-brand-muted" data-testid="availability-empty">วันนี้ยังไม่มีรอบจัดส่ง — สร้าง/ซ่อมรอบที่แท็บ "รอบจัดส่ง & แพทเทิร์น"</p>
      )}
      {rows && rows.map((r) => {
        const sameDay = roundBookability(r, { isToday: true, mode: 'SAME_DAY' })
        const preOrder = roundBookability(r, { isToday: true, mode: 'PRE_ORDER' })
        return (
          <div key={r.id} className="card mb-2" data-testid={`availability-row-${r.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-brand-accent">
                  {r.display_name || r.round_key || r.id}{' '}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                    {r.status === 'active' ? 'เปิดรับ' : 'ปิดรับ'}
                  </span>
                </div>
                <div className="text-xs text-brand-muted">
                  ส่ง {String(r.delivery_start ?? '').slice(0, 5)}–{String(r.delivery_end ?? '').slice(0, 5)} · ความจุ {r.current_count}/{r.max_capacity}
                  {' · คัทออฟพรีออเดอร์ '}{roundCutoffLabel(r, 'PRE_ORDER')}
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <span className={`px-2 py-1 rounded-full font-semibold ${sameDay === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`} data-testid={`availability-sameday-${r.id}`}>
                  เซมเดย์: {roundStatusLabel(sameDay)}
                </span>
                <span className={`px-2 py-1 rounded-full font-semibold ${preOrder === 'open' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`} data-testid={`availability-preorder-${r.id}`}>
                  พรีออเดอร์: {roundStatusLabel(preOrder)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
      <Link to="/admin/delivery?tab=rounds" className="text-sm text-brand-primary hover:underline">จัดการรอบ/แพทเทิร์น →</Link>
    </div>
  )
}