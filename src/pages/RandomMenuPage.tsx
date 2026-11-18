import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
// [G&R 156] Spin & Win — รางวัลจริงจากเซิร์ฟเวอร์ (เพดานรายวัน · ZERO-FAKE:
// ห้ามสัญญาแต้ม/คูปองฝั่งเครื่อง — policy ปิด = บอกตรง ๆ ว่ายังไม่เปิด)
import {
  fetchSpinStatus,
  trySpinReward,
  describeSpinIssue,
  type SpinStatus,
} from '@/lib/engagementClient'
// R53 (Owner 2026-11-18): สุ่มจาก "เมนูจริงของแอดมิน" เท่านั้น —
// เดิม menuItems 6 ชิ้น hardcode + รูป unsplash ไม่ใช่เมนูร้าน (ไม่ซิงก์เมนู)
// ใหม่: getProducts() กรอง archived/ไม่พร้อมขายออก + ซิงก์โปรโมชันจริงที่ใช้กับเมนูได้
import { getProducts } from '@/lib/bmbAdminApi_products'
import { getPromotionsWithStatus, attachPromotionScope, type PromotionRow } from '@/lib/bmbAdminApi_promotions'
import { isPromoLiveNow, promoDiscountLabel } from '@/pages/PromotionsPage'
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'
import type { Product } from '@/types'

/** โปรโมชันที่ใช้กับเมนูนี้ได้จริง (scope ตามที่แอดมินตั้ง — all_products หรือ specific list) */
function promosForProduct(promos: PromotionRow[], product: Product): PromotionRow[] {
  return promos.filter((promo) =>
    promo.applies_to === 'specific_products'
      ? (promo.scope_product_ids ?? []).includes(product.id)
      : true,
  )
}

export function RandomMenuPage() {
  const [eligible, setEligible] = useState<Product[]>([])
  const [promos, setPromos] = useState<PromotionRow[]>([])
  const [selectedItem, setSelectedItem] = useState<Product | null>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const [lastAward, setLastAward] = useState<string | null>(null)
  const [spinStatus, setSpinStatus] = useState<SpinStatus | null>(null)
  const [spinLoaded, setSpinLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    void fetchSpinStatus().then((s) => {
      if (!active) return
      setSpinStatus(s)
      setSpinLoaded(true)
    })

    // R53: เมนูจริงที่ขายได้จากแอดมิน (archived = เก็บออกแล้ว · is_available=false = ปิดขายชั่วคราว)
    async function loadMenu() {
      setLoadError('')
      try {
        const products = await getProducts()
        if (!active) return
        setEligible(products.filter((p: Product) => !p.archived && p.is_available))
      } catch (err) {
        console.error('[RandomMenuPage] Load error:', err)
        if (active) setLoadError('โหลดเมนูไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
      }
    }
    loadMenu()

    // R53: โปรโมชันจริงจากแอดมิน (live เท่านั้น) + ผูก scope เพื่อแสดง "ใช้ได้กับเมนูที่สุ่มได้"
    void (async () => {
      try {
        const { rows, ok } = await getPromotionsWithStatus()
        if (!active) return
        if (!ok) return
        const live = rows.filter((p) => isPromoLiveNow(p))
        setPromos(await attachPromotionScope(live))
      } catch {
        /* โปรโหลดไม่ได้ = แถบโปรไม่แสดง (ไม่แสร้งว่ามีโปร) */
      }
    })()

    return () => { active = false }
  }, [retryKey])

  async function spinWheel() {
    if (isSpinning) return
    if (eligible.length === 0) {
      showToast('ยังไม่มีเมนูพร้อมขายให้สุ่มตอนนี้ค่ะ — ลองใหม่อีกครั้งนะคะ', 'warning')
      return
    }
    setIsSpinning(true)
    setLastAward(null)

    // รางวัล = เซิร์ฟเวอร์ตัดสินใจเท่านั้น (เพดาน/อัตราจาก policy แอดมิน)
    let award: string | null = null
    if (spinStatus?.enabled && spinStatus.remaining_today > 0) {
      const attempt = await trySpinReward()
      if (attempt.ok) {
        award = `+${attempt.result.points} แต้ม`
        setSpinStatus((prev) => (prev ? { ...prev, ...attempt.result } : prev))
      } else {
        showToast(describeSpinIssue(attempt.reason), 'warning')
      }
    }

    await new Promise((r) => setTimeout(r, 1500))
    // R53: สุ่มจากเมนูจริงของร้าน (ไม่มีรายการปลอมในระบบ)
    const picked = eligible[Math.floor(Math.random() * eligible.length)]
    setSelectedItem(picked)
    setLastAward(award)
    setIsSpinning(false)
    showToast(
      award ? `สุ่มได้ ${picked.name} และได้รับ ${award} จากล้อสุ่ม!` : `สุ่มได้ ${picked.name} ค่ะ`,
      'success',
    )
  }

  function goOrder() {
    if (!selectedItem) return
    // R53: ไปยังเมนูจริงของเมนูที่สุ่มได้ (MenuPage อ่าน ?category= อยู่แล้ว — ตรงเป้าหมาย)
    navigate(selectedItem.category_id ? `/menu?category=${encodeURIComponent(selectedItem.category_id)}` : '/menu')
  }

  const pickedPromos = selectedItem ? promosForProduct(promos, selectedItem) : []

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 text-center">
      <h1 className="text-3xl font-bold text-brand-accent mb-2">🎲 คิดไม่ออก?</h1>
      <p className="text-brand-muted mb-4">สุ่มเมนูให้เลย!</p>

      {/* [G&R 156] สถานะรางวัลล้อสุ่ม — แสดงตามจริงจากเซิร์ฟเวอร์ (ZERO-FAKE) */}
      <div className="card mb-4 border-2 border-amber-300 bg-amber-50" data-testid="spin-reward-banner">
        {!spinLoaded ? (
          <p className="text-sm text-amber-800">⏳ กำลังโหลดสถานะรางวัล…</p>
        ) : spinStatus === null ? (
          <p className="text-sm text-amber-800">โหลดสถานะรางวัลไม่สำเร็จ — ยังไม่สัญญาแต้มค่ะ</p>
        ) : !spinStatus.enabled ? (
          <p className="text-sm text-amber-800">ยังไม่เปิดรางวัลล้อสุ่ม — สุ่มเมนูได้ตามปกติค่ะ</p>
        ) : (
          <div className="text-sm text-amber-800 space-y-1">
            <div>
              🎰 รางวัล: <b>{spinStatus.points_per_spin} แต้ม</b>ต่อการหมุน · เหลือ{' '}
              <b>{spinStatus.remaining_today}</b> ครั้งวันนี้
            </div>
            <div className="text-xs">แต้มสะสมของคุณ: {spinStatus.balance} แต้ม</div>
          </div>
        )}
      </div>

      {/* R53: เมนูจริงจากแอดมิน — โหลดล้มเหลวต้องฟ้อง (หน้าเปล่า ≠ ไม่มีเมนู) */}
      {loadError && (
        <div className="mb-4">
          <LoadErrorBanner message={loadError} onRetry={() => setRetryKey((n) => n + 1)} testId="random-menu-load-error" />
        </div>
      )}
      {!loadError && !isSpinning && !selectedItem && eligible.length === 0 && (
        <div className="card mb-4 text-center">
          <p className="text-brand-accent font-bold mb-2">ยังไม่มีเมนูพร้อมขายในขณะนี้ค่ะ</p>
          <p className="text-sm text-brand-muted mb-4">กลับมาสุ่มอีกครั้งหลังร้านเปิดเมนูค่ะ</p>
          <button onClick={() => setRetryKey((k) => k + 1)} className="btn btn-primary">ลองใหม่</button>
        </div>
      )}

      {/* Spin Wheel */}
      <div className="card mb-6">
        {!isSpinning && !selectedItem && eligible.length > 0 && (
          <div className="py-12">
            <div className="text-6xl mb-4 animate-bounce">🎰</div>
            <p className="text-brand-muted mb-6">กดปุ่มเพื่อสุ่มเมนู — สุ่มจากเมนูจริงของร้าน ({eligible.length} เมนู)</p>
          </div>
        )}

        {isSpinning && (
          <div className="py-12">
            <div className="text-6xl mb-4 animate-spin">🎰</div>
            <p className="text-brand-primary font-bold">กำลังสุ่ม...</p>
          </div>
        )}

        {selectedItem && !isSpinning && (
          <div className="py-8">
            <img src={selectedItem.image_url || '/placeholder.svg'} alt={selectedItem.name} className="w-48 h-48 rounded-2xl object-cover mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-brand-accent mb-2">{selectedItem.name}</h3>
            <p className="text-brand-primary text-xl font-bold mb-4">{selectedItem.price} บาท</p>
            {lastAward && (
              <div className="bg-green-50 p-4 rounded-xl mb-4" data-testid="spin-award-real">
                <p className="text-green-800 font-medium">🎉 ได้รับ {lastAward} จริงจากล้อสุ่ม!</p>
                <p className="text-sm text-green-600 mt-1">ดูประวัติแต้มได้ที่หน้า "รางวัลและแต้ม"</p>
              </div>
            )}
            {/* R53: โปรโมชันจริงที่ใช้กับเมนูนี้ได้ (จากแอดมิน · แสดงเมื่อมีจริง) */}
            {pickedPromos.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 mb-4" data-testid="random-menu-promos">
                <p className="text-sm font-bold text-amber-800 mb-1">🎟️ ใช้โปรโมชั่นกับเมนูนี้ได้</p>
                {pickedPromos.map((promo) => (
                  <p key={promo.id} className="text-sm text-amber-800">
                    {promo.name} — <b>{promoDiscountLabel(promo)}</b>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={spinWheel}
          disabled={isSpinning || (!loadError && !selectedItem && eligible.length === 0)}
          className="btn btn-primary text-lg py-4 px-8 disabled:opacity-50"
        >
          {isSpinning ? '⏳ กำลังสุ่ม...' : '🎲 สุ่มเมนู!'}
        </button>
      </div>

      {/* Go to menu — ไม่มีคูปองปลอม: ไปสั่งจริง ๆ เท่านั้น · R53 พาไปถึงหมวดของเมนูที่สุ่มได้ */}
      {selectedItem && (
        <button onClick={goOrder} className="btn btn-secondary w-full text-lg py-4 mb-6">
          🛒 ไปดูเมนูและสั่งเลย
        </button>
      )}

      {/* How it works */}
      <div className="card bg-brand-bg">
        <h3 className="font-bold text-brand-accent mb-4">💡 วิธีใช้งาน</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl mb-2">1️⃣</div>
            <div className="text-sm text-brand-muted">กดสุ่มเมนู</div>
          </div>
          <div>
            <div className="text-3xl mb-2">2️⃣</div>
            <div className="text-sm text-brand-muted">
              {spinStatus?.enabled ? `ลุ้น ${spinStatus.points_per_spin} แต้ม/วัน` : 'ดูเมนูที่สุ่มได้'}
            </div>
          </div>
          <div>
            <div className="text-3xl mb-2">3️⃣</div>
            <div className="text-sm text-brand-muted">ไปสั่งเลย!</div>
          </div>
        </div>
      </div>
    </div>
  )
}
