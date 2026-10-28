import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getPromotionsWithStatus, type PromotionRow } from '@/lib/bmbAdminApi_promotions'

// ============================================
// Bite Me Baby — Promotions page (ZERO-FAKE closure 2026-10-18)
// เดิม: promo/คอมโบ hardcode + "ใช้โค้ดสำเร็จ" ปลอม (แต้ม rewards ปลอม)
// ใหม่: แสดงโปรโมชันจริงจากตาราง `promotions` (แอดมินจัดการที่ /admin/promotions)
//       โค้ดส่วนลดถูกตรวจสอบโดย SERVER ตอนสั่งซื้อ (create_order_with_items)
//       — หน้านี้เป็น display เท่านั้น ไม่มีการ "ยืนยันส่วนลด" ปลอม
// ============================================

/** วันที่แบบ date-only → นับถึงสิ้นวัน (ไม่ตัดโปรโมชันก่อนหมดวันจริง) */
function endDateMs(value?: string | null): number | null {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59+07:00` : raw
  const ms = new Date(iso).getTime()
  return Number.isFinite(ms) ? ms : null
}

function startDateMs(value?: string | null): number | null {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00+07:00` : raw
  const ms = new Date(iso).getTime()
  return Number.isFinite(ms) ? ms : null
}

/** Display mirror — หน้าต่างเวลาจริง; server ตัดสินอีกครั้งตอนสั่งซื้อ */
export function isPromoLiveNow(p: PromotionRow, nowMs: number = Date.now()): boolean {
  if (p.is_active === false) return false
  const start = startDateMs(p.start_date)
  const end = endDateMs(p.end_date)
  if (start !== null && nowMs < start) return false
  if (end !== null && nowMs > end) return false
  return true
}

export function promoDiscountLabel(p: PromotionRow): string {
  const value = Number(p.discount_value) || 0
  const base = p.discount_type === 'percentage'
    ? `ลด ${value}%`
    : `ลด ฿${value.toLocaleString('th-TH')}`
  const min = Number(p.min_order_amount) || 0
  return min > 0 ? `${base} เมื่อสั่งขั้นต่ำ ฿${min.toLocaleString('th-TH')}` : base
}

function promoExpiryLabel(p: PromotionRow): string | null {
  const end = endDateMs(p.end_date)
  if (end === null) return null
  return `ถึง ${new Date(end).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export function PromotionsPage() {
  const [rows, setRows] = useState<PromotionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [usedId, setUsedId] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { rows: data, ok } = await getPromotionsWithStatus()
        if (!alive) return
        setRows(data)
        setLoadFailed(!ok)
      } catch {
        if (alive) setLoadFailed(true)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const promos = rows.filter((p) => isPromoLiveNow(p))

  async function handleUseCode(promo: PromotionRow) {
    const code = (promo.code || '').trim()
    if (!code) {
      showToast('โปรโมชันนี้ไม่มีโค้ด — รับสิทธิ์อัตโนมัติเมื่อเข้าเงื่อนไขค่ะ', 'info')
      navigate('/menu')
      return
    }
    // R10 (Owner 2026-10-27): คูปองใช้ที่หน้าเช็คเอาท์อย่างเดียว — "ใช้เลย" ไม่ apply
    // จากหน้านี้แล้ว (เดิม apply นอกหน้าชำระเงิน → ค้าง "ยังไม่เข้าเงื่อนไข") — พาไป
    // หน้าชำระเงินให้เลือกโค้ดจาก popup (เติมอัตโนมัติ) · clipboard = bonus เงียบ
    setUsedId(promo.id)
    try {
      await navigator.clipboard?.writeText(code)
    } catch {
      /* clipboard ใช้ไม่ได้ (WebView/มือถือ/ไม่ใช่ https) — ไม่แสร้งว่าก้อบ */
    }
    showToast(`โค้ด ${code} — เลือกใช้ที่หน้าชำระเงิน (แตะกล่องคูปองแล้วเลือกจากรายการ)`, 'info')
    navigate('/checkout')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">🎟️ โปรโมชั่น</h1>

      <div className="card mb-6 bg-gradient-to-r from-purple-50 to-pink-50">
        <h3 className="font-bold text-brand-accent mb-2">💡 วิธีใช้โค้ดส่วนลด</h3>
        <p className="text-sm text-brand-muted">
          กดปุ่ม &quot;ใช้เลย&quot; — ระบบพาไปหน้าชำระเงินให้เลือกโค้ดจากรายการ (เติมอัตโนมัติ)
          ระบบตรวจส่วนลดจากโปรโมชั่นจริงตามเงื่อนไข (วันที่/ยอดขั้นต่ำ) และยืนยันยอดจริงอีกครั้งบนเซิร์ฟเวอร์ตอนสั่งซื้อ
        </p>
      </div>

      {loading && (
        <div className="card text-center text-brand-muted">⏳ กำลังโหลดโปรโมชัน…</div>
      )}

      {!loading && loadFailed && (
        <div className="card text-center">
          <p className="text-brand-accent font-bold mb-2">โหลดโปรโมชันไม่สำเร็จค่ะ</p>
          <p className="text-sm text-brand-muted mb-4">การเชื่อมต่อข้อมูลร้านขัดข้อง — กรุณาลองใหม่อีกครั้ง</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary">ลองใหม่</button>
        </div>
      )}

      {!loading && !loadFailed && promos.length === 0 && (
        <div className="card text-center">
          <p className="text-brand-accent font-bold mb-2">ยังไม่มีโปรโมชันในขณะนี้ค่ะ</p>
          <p className="text-sm text-brand-muted mb-4">ติดตามโปรโมชันใหม่ได้ที่หน้านี้ หรือทาง Facebook ของร้าน</p>
          <Link to="/menu" className="btn btn-primary">ดูเมนูอาหาร →</Link>
        </div>
      )}

      {!loading && !loadFailed && promos.length > 0 && (
        <div className="space-y-4 mb-6">
          {promos.map((promo) => (
            <div key={promo.id} className="card flex items-center gap-4 min-h-[120px]">
              <div className="w-16 h-16 bg-brand-bg rounded-xl flex items-center justify-center text-2xl">
                {promo.discount_type === 'percentage' ? '🎉' : '🎁'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-brand-accent line-clamp-1">{promo.name}</h3>
                  <span className="badge badge-primary">โปรโมชั่น</span>
                </div>
                <p className="text-brand-primary font-bold text-lg">{promoDiscountLabel(promo)}</p>
                {promo.description && <p className="text-sm text-brand-muted line-clamp-2">{promo.description}</p>}
                {promoExpiryLabel(promo) && (
                  <p className="text-xs text-brand-muted">{promoExpiryLabel(promo)}</p>
                )}
              </div>
              <div className="text-right">
                {promo.code && (
                  <div className="font-mono text-sm text-brand-accent bg-brand-bg px-3 py-1 rounded-lg">{promo.code}</div>
                )}
                <button
                  onClick={() => handleUseCode(promo)}
                  className="btn btn-outline text-xs mt-2"
                  data-testid="promo-use-code"
                >
                  {usedId === promo.id ? 'ใช้แล้ว ✓' : 'ใช้เลย'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}