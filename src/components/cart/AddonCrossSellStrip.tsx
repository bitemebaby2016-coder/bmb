// ============================================
// Bite Me Baby — AddonCrossSellStrip (R49 · cross-sell แอดออนเรียงตามกำไร)
// ============================================
// Owner: "เมื่อลูกค้าเลือกเมนูหลัก → แสดง Add-on ที่แอดมินเปิดใช้แบบ Cross-sell
//         (จัดลำดับ Margin สูงสุดก่อน) ดึง real-time จาก DB ตามที่ Admin ตั้ง"
// ข้อมูลจริง = products.addons ของเมนูในตะกร้า (admin แก้ที่ AddonsEditor → บันทึกปั๊บเห็นปั๊บ)
// gate: cross_sell_enabled=false = ซ่อน · main_dish_required=true = ต้องมีเมนูหลัก (ของในตะกร้า) ก่อนโชว์
// ============================================

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { getBusinessSettings } from '@/lib/bmbAdminApi_settings'
import { normalizeAddonMarginPolicy, sortAddonsByMargin, effectiveAddonPrice } from '@/lib/addonMarginGuard'

interface CrossItem {
  key: string
  name: string
  parentName: string
  parentId: string
  price: number
  promoPrice: number
}

export function AddonCrossSellStrip() {
  const items = useCartStore((s) => s.items)
  const [policy, setPolicy] = useState(() => normalizeAddonMarginPolicy(null))
  const [loaded, setLoaded] = useState(false)

  useMemo(() => {
    // load once (fire-and-forget) — default = เปิด cross-sell ตาม m181 seed
    if (loaded) return
    setLoaded(true)
    void getBusinessSettings()
      .then((s) => setPolicy(normalizeAddonMarginPolicy(s?.addon_margin_policy)))
      .catch(() => undefined)
  }, [loaded])

  const hasMainDish = items.length > 0
  if (!policy.enabled || !policy.crossSellEnabled) return null
  if (policy.mainDishRequired && !hasMainDish) return null

  const list: CrossItem[] = useMemo(() => {
    const seen = new Map<string, CrossItem>()
    for (const line of items) {
      const addons = Array.isArray(line.product.addons) ? (line.product.addons as unknown as Array<Record<string, unknown>>) : []
      for (const a of addons) {
        const id = String(a.id ?? '')
        if (!id || seen.has(id)) continue
        seen.set(id, {
          key: `${line.product.id}:${id}`,
          name: String(a.name ?? ''),
          parentName: line.product.name,
          parentId: line.product.id,
          price: Number(a.price) || 0,
          promoPrice: effectiveAddonPrice(a),
        })
      }
    }
    const arr = Array.from(seen.values())
    return sortAddonsByMargin(arr) // Profit Weight — กำไรสูงสุดก่อน
  }, [items])

  if (list.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border border-brand-border bg-white p-3" data-testid="addon-cross-sell">
      <p className="text-xs font-bold text-brand-accent mb-2">✨ ทานคู่กันอร่อยกว่า (เรียงจากกำไรสูงสุดที่ร้านตั้งค่า)</p>
      <div className="flex flex-wrap gap-2">
        {list.map((x) => (
          <Link
            key={x.key}
            to="/menu"
            className="rounded-full border border-brand-primary/40 bg-brand-bg px-3 py-1.5 text-xs text-brand-accent hover:bg-brand-primary/10"
            data-testid="addon-cross-sell-item"
          >
            {x.name}
            <span className="text-brand-muted"> · กับ {x.parentName}</span>
            <span className="font-bold text-brand-primary ml-1">
              ฿{x.promoPrice}
              {x.promoPrice > 0 && x.promoPrice < x.price ? <s className="ml-1 opacity-60">฿{x.price}</s> : null}
            </span>
          </Link>
        ))}
      </div>
      <Link to="/menu" className="text-[11px] text-brand-primary underline mt-1 inline-block">เปิดเมนูเพื่อเพิ่มท็อปปิ้ง →</Link>
    </div>
  )
}