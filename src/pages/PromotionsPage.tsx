import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getPromotionsWithStatus, attachPromotionScope, type PromotionRow } from '@/lib/bmbAdminApi_promotions'
// R53 (Owner 2026-11-18): แสดงข้อมูลจริงที่แอดมินตั้งให้ครบ — ภาพแบนเนอร์ (is_banner/banner_image),
// ขอบเขตเมนูร่วมรายการ (applies_to/scope_product_ids), เพดานส่วนลด (max_discount_amount),
// สิทธิ์คงเหลือ (usage_limit/usage_count) และสิทธิ์ซ้อน (stackable) — ไม่มีข้อความโกหก
import { getProducts } from '@/lib/bmbAdminApi_products'
import type { Product } from '@/types'

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

// R53: export เพื่อหน้าโหวต/สุ่มใช้สูตรเดียวกัน (กัน label ส่วนลดต่างกันระหว่างหน้า)
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
  // QA 3.9 (R19): ปุ่ม "ลองใหม่" = refetch รอบนี้แทน location.reload (ไม่ต้องรีโหลดทั้งหน้า)
  const [reloadKey, setReloadKey] = useState(0)
  const navigate = useNavigate()

  // R53: ชื่อเมนูจริง (id → name) สำหรับแสดงขอบเขต "เฉพาะเมนู" จากแอดมิน
  const [productNames, setProductNames] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadFailed(false)
    void (async () => {
      try {
        const { rows: data, ok } = await getPromotionsWithStatus()
        if (!alive) return
        // R53: ผูก scope เมนูร่วมรายการ (ตาราง promotion_products — ข้อมูลจริงจากแอดมิน)
        const withScope = await attachPromotionScope(data)
        if (!alive) return
        setRows(withScope)
        setLoadFailed(!ok)
        try {
          const products = await getProducts()
          if (!alive) return
          const names: Record<string, string> = {}
          for (const p of products as Product[]) names[p.id] = p.name
          setProductNames(names)
        } catch {
          /* ชื่อเมนูโหลดไม่ได้ = แสดงจำนวนแทน (ไม่แสร้งชื่อ) */
        }
      } catch {
        if (alive) setLoadFailed(true)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [reloadKey])

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
      <h1 className="text-3xl font-bold text-brand-accent mb-6">🎟️ โปรโมชั่น ข่าวสาร และ กิจกรรม</h1>

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
          <button onClick={() => setReloadKey((k) => k + 1)} className="btn btn-primary">ลองใหม่</button>
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
          {promos.map((promo) => {
            const scopeIds = promo.applies_to === 'specific_products' ? (promo.scope_product_ids ?? []) : []
            const scopeLabel = scopeIds
              .slice(0, 3)
              .map((id) => productNames[id] ?? 'เมนูที่ร่วมรายการ')
              .join(', ')
            const remaining =
              promo.usage_limit != null
                ? Math.max(0, promo.usage_limit - (promo.usage_count ?? 0))
                : null
            const maxCap = Number(promo.max_discount_amount) || 0
            return (
              <div key={promo.id} className="card flex items-center gap-4 min-h-[120px]">
                <div className="w-16 h-16 bg-brand-bg rounded-xl overflow-hidden flex items-center justify-center text-2xl shrink-0">
                  {promo.banner_image ? (
                    <img src={promo.banner_image} alt={promo.name} className="w-full h-full object-cover" />
                  ) : (
                    promo.discount_type === 'percentage' ? '🎉' : '🎁'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-brand-accent line-clamp-1">{promo.name}</h3>
                    <span className="badge badge-primary">โปรโมชั่น</span>
                  </div>
                  <p className="text-brand-primary font-bold text-lg">{promoDiscountLabel(promo)}</p>
                  {promo.description && <p className="text-sm text-brand-muted line-clamp-2">{promo.description}</p>}
                  {promoExpiryLabel(promo) && (
                    <p className="text-xs text-brand-muted">{promoExpiryLabel(promo)}</p>
                  )}
                  {/* R53: ขอบเขตเมนูร่วมรายการ — ตามที่แอดมินตั้ง (promotion_products จริง) */}
                  {promo.applies_to === 'specific_products' && (
                    <p className="text-xs text-brand-muted line-clamp-1" data-testid="promo-scope">
                      เฉพาะเมนู: {scopeLabel}
                      {scopeIds.length > 3 ? ` +${scopeIds.length - 3} เมนู` : ''}
                    </p>
                  )}
                  {/* R53: เพดานส่วนลด · สิทธิ์คงเหลือ · สิทธิ์ซ้อน — แสดงเมื่อแอดมินกำหนดค่านั้นจริง */}
                  {(maxCap > 0 || remaining !== null || promo.stackable === true) && (
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {maxCap > 0 && <span className="badge">สูงสุด ฿{maxCap.toLocaleString('th-TH')}/ออเดอร์</span>}
                      {remaining !== null && <span className="badge" data-testid="promo-remaining">เหลือ {remaining.toLocaleString('th-TH')} สิทธิ์</span>}
                      {promo.stackable === true && <span className="badge">ใช้ร่วมกับข้อเสนออื่นได้</span>}
                    </div>
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
            )
          })}
        </div>
      )}
    </div>
  )
}