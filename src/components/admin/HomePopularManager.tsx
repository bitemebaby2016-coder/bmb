// ============================================
// Bite Me Baby — แผงแอดมิน "เมนูยอดนิยม" + ข้อความหน้าเว็บ
// ============================================
// - เลือกเมนูจาก "ทุกกลุ่มเมนู/ทุกหมวด" (รวมเมนูจองล่วงหน้า) มาโชว์ใน section
//   "เมนูยอดนิยม" หน้าแรก — ใช้ dropdown เลือก + ปุ่มเปิด-ปิดแต่ละเมนู
// - แก้หัวข้อ/ข้อความเตือนได้ในหน้านี้เลย (ค่าเก็บ business_settings —
//   ลูกค้าเห็นผลทันที ไม่ต้อง deploy)
// ============================================

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { showToast } from '@/components/ui/ToastContainer'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'
import { updateProduct } from '@/lib/bmbAdminApi_products'
import { uploadProductImage, validateImageFile } from '@/lib/bmbAdminApi_media'
import {
  HOME_POPULAR_KEY,
  SITE_COPY_KEY,
  DEFAULT_HOME_POPULAR,
  DEFAULT_SITE_COPY,
  parseHomePopularConfig,
  parseSiteCopy,
  productModeOf,
  type HomePopularConfig,
  type SiteCopy,
} from '@/lib/homePopular'
import { ToggleSwitch } from './ToggleSwitch'
import type { MenuSection, Product, ProductCategory } from '@/types'

interface HomePopularManagerProps {
  products: Product[]
  categories: ProductCategory[]
  sections: MenuSection[]
}

const SHOW_COUNT_CHOICES = [4, 6, 8, 10, 12, 16]

export function HomePopularManager({ products, categories, sections }: HomePopularManagerProps) {
  const [config, setConfig] = useState<HomePopularConfig>({ ...DEFAULT_HOME_POPULAR })
  const [copy, setCopy] = useState<SiteCopy>({ ...DEFAULT_SITE_COPY })
  const [pickId, setPickId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // A3 (UX fix 2026-10-15): รูปเมนูต่อรายการ — thumbnail + ปุ่มเปลี่ยนรูป (อัปเดต products.image_url)
  const [imgOverrides, setImgOverrides] = useState<Record<string, string>>({})
  const [imgTarget, setImgTarget] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      const s = await getBusinessSettings().catch(() => ({} as Record<string, any>))
      setConfig(parseHomePopularConfig(s?.[HOME_POPULAR_KEY]))
      setCopy(parseSiteCopy(s?.[SITE_COPY_KEY]))
      setLoading(false)
    })()
  }, [])

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const catLabelOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c.id, `${c.icon ? c.icon + ' ' : ''}${c.name}`)
    return m
  }, [categories])

  // dropdown จัดกลุ่ม: กลุ่มเมนู (Section) · หมวดหมู่ → เมนู (รวมเมนูจองล่วงหน้า)
  const optionGroups = useMemo(() => {
    const secName = new Map(sections.map((s) => [s.id, s.name]))
    const groups: Array<{ label: string; items: Product[] }> = []
    const seenCats = new Set<string>()
    for (const s of [...sections].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
      for (const c of categories.filter((x) => (x.menu_section_id ?? '') === s.id && !x.archived)) {
        const items = products.filter((p) => p.category_id === c.id && !p.archived)
        if (items.length > 0) groups.push({ label: `${s.name} · ${catLabelOf.get(c.id) ?? c.name}`, items })
        seenCats.add(c.id)
      }
    }
    for (const c of categories.filter((x) => !x.archived && !seenCats.has(x.id))) {
      const items = products.filter((p) => p.category_id === c.id && !p.archived)
      if (items.length > 0) groups.push({ label: `ไม่อยู่ในกลุ่ม · ${catLabelOf.get(c.id) ?? c.name}`, items })
    }
    return groups
  }, [products, categories, sections, catLabelOf])

  const disabledSet = useMemo(() => new Set(config.disabledIds), [config.disabledIds])

  function addPicked() {
    if (!pickId) return
    if (config.productIds.includes(pickId)) {
      showToast('เมนูนี้อยู่ในรายการแล้ว', 'info')
      return
    }
    setConfig({ ...config, productIds: [...config.productIds, pickId] })
    setPickId('')
  }

  function removeItem(id: string) {
    setConfig({
      ...config,
      productIds: config.productIds.filter((x) => x !== id),
      disabledIds: config.disabledIds.filter((x) => x !== id),
    })
  }

  function toggleItem(id: string, on: boolean) {
    setConfig({
      ...config,
      disabledIds: on ? config.disabledIds.filter((x) => x !== id) : [...config.disabledIds, id],
    })
  }

  function moveItem(id: string, dir: -1 | 1) {
    const idx = config.productIds.indexOf(id)
    const next = idx + dir
    if (idx < 0 || next < 0 || next >= config.productIds.length) return
    const arr = [...config.productIds]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    setConfig({ ...config, productIds: arr })
  }

  // A3: เปลี่ยนรูปเมนูในรายการยอดนิยม — Storage → media_assets → products.image_url
  function pickImage(id: string) {
    setImgTarget(id)
    fileRef.current?.click()
  }

  async function handleImageChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const id = imgTarget
    e.target.value = ''
    if (!file || !id || uploading) return
    const v = validateImageFile(file)
    if (!v.ok) {
      showToast('รูปไม่ผ่านเงื่อนไข: ' + v.error, 'error')
      return
    }
    setUploading(true)
    const res = await uploadProductImage(file)
    setUploading(false)
    if (!res.ok || !res.url) {
      showToast('อัปโหลดรูปไม่สำเร็จ: ' + (res.error || ''), 'error')
      return
    }
    const updated = await updateProduct(id, { image_url: res.url })
    if (!updated) {
      showToast('บันทึกรูปลงเมนูไม่สำเร็จ — ลองใหม่อีกครั้ง', 'error')
      return
    }
    setImgOverrides((prev) => ({ ...prev, [id]: res.url as string }))
    showToast('เปลี่ยนรูปเมนูแล้ว — ลูกค้าเห็นผลทันที', 'success')
  }

  async function save() {
    setSaving(true)
    const okA = await setBusinessSetting(HOME_POPULAR_KEY, config)
    const okB = await setBusinessSetting(SITE_COPY_KEY, copy)
    setSaving(false)
    showToast(okA && okB ? 'บันทึกเมนูยอดนิยม + ข้อความแล้ว — ลูกค้าเห็นผลทันที' : 'บันทึกไม่สำเร็จ ลองอีกครั้ง', okA && okB ? 'success' : 'error')
  }

  return (
    <div className="card mb-6 bg-brand-bg" data-testid="home-popular-manager">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-brand-accent">🔥 เมนูยอดนิยม (หน้าแรก)</h3>
        <button onClick={() => void save()} disabled={saving || loading} className="btn btn-success text-sm">
          💾 บันทึก
        </button>
      </div>
      <p className="text-xs text-brand-muted mb-3">
        เลือกเมนูจากทุกกลุ่ม (รวมเมนูจองล่วงหน้า) มาโชว์ในช่องแรกของหน้าแรก — ระบบสลับสับเปลี่ยนรายการให้อัตโนมัติ · เปลี่ยนรูปเมนูได้จากปุ่ม "เปลี่ยนรูป" ในแต่ละรายการ
      </p>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-hidden="true" tabIndex={-1} onChange={handleImageChosen} data-testid="popular-image-file" />

      {loading ? (
        <p className="text-sm text-brand-muted">กำลังโหลด…</p>
      ) : (
        <>
          {/* หัวข้อ + การสลับโชว์ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <label className="text-xs flex flex-col gap-1">
              หัวข้อช่อง (ค่าเริ่มต้น: เมนูยอดนิยม)
              <input
                className="input"
                value={config.title}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                placeholder="เมนูยอดนิยม"
              />
            </label>
            <label className="text-xs flex flex-col gap-1">
              จำนวนที่โชว์ต่อรอบ
              <select
                className="input"
                value={config.showCount}
                onChange={(e) => setConfig({ ...config, showCount: parseInt(e.target.value, 10) })}
              >
                {SHOW_COUNT_CHOICES.map((n) => <option key={n} value={n}>{n} เมนู</option>)}
              </select>
            </label>
            <div className="flex items-end pb-1">
              <ToggleSwitch
                checked={config.autoRotate}
                onChange={(v) => setConfig({ ...config, autoRotate: v })}
                label="สลับสับเปลี่ยนเมนูอัตโนมัติ"
                testId="popular-auto-rotate"
              />
            </div>
          </div>

          {/* เลือกเมนูจาก dropdown (ทุกกลุ่ม รวมเมนูจองล่วงหน้า) */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select className="input max-w-md" value={pickId} onChange={(e) => setPickId(e.target.value)}>
              <option value="">— เลือกเมนูเพื่อเพิ่ม (จากทุกกลุ่ม) —</option>
              {optionGroups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.price} บาท{productModeOf(p) === 'pre-order' ? ' (จองล่วงหน้า)' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button onClick={addPicked} className="btn btn-primary text-sm" disabled={!pickId}>+ เพิ่ม</button>
          </div>

          {/* รายการเมนูยอดนิยม — ปุ่มเปิด-ปิดต่อเมนู */}
          <div className="space-y-1">
            {config.productIds.map((id, idx) => {
              const p = byId.get(id)
              const on = !disabledSet.has(id)
              const imgUrl = imgOverrides[id] ?? p?.image_url ?? ''
              return (
                <div key={id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-brand-muted">#{idx + 1}</span>
                    {imgUrl ? (
                      <img src={imgUrl} alt={p?.name ?? id} className="w-10 h-10 rounded-lg object-cover border border-brand-border shrink-0" />
                    ) : (
                      <span className="w-10 h-10 rounded-lg bg-brand-bg border border-dashed border-brand-border shrink-0 flex items-center justify-center text-xs text-brand-muted" aria-label="ยังไม่มีรูป">🍽️</span>
                    )}
                    <span className="font-medium text-brand-accent truncate">{p?.name ?? id}</span>
                    <span className="text-xs text-brand-muted truncate">{catLabelOf.get(p?.category_id ?? '') ?? ''}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p && productModeOf(p) === 'pre-order' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                      {p && productModeOf(p) === 'pre-order' ? 'จองล่วงหน้า' : 'สั่งวันนี้'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => moveItem(id, -1)} className="btn btn-outline text-xs" aria-label="เลื่อนขึ้น">↑</button>
                    <button onClick={() => moveItem(id, 1)} className="btn btn-outline text-xs" aria-label="เลื่อนลง">↓</button>
                    <button onClick={() => pickImage(id)} className="btn btn-outline text-xs" disabled={uploading} data-testid="popular-change-image">เปลี่ยนรูป</button>
                    <ToggleSwitch checked={on} onChange={(v) => toggleItem(id, v)} label="โชว์" testId="popular-item-toggle" />
                    <button onClick={() => removeItem(id)} className="btn btn-outline text-xs text-red-500">เอาออก</button>
                  </div>
                </div>
              )
            })}
            {config.productIds.length === 0 && (
              <p className="text-sm text-brand-muted px-1">
                ยังไม่ได้เลือกเมนู — ถ้าไม่เลือก ระบบจะสลับเมนูแนะนำจากทุกกลุ่มมาโชว์ให้อัตโนมัติ
              </p>
            )}
          </div>

          {/* ข้อความบนหน้าเว็บที่แอดมินแก้ได้เอง */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <label className="text-xs flex flex-col gap-1">
              หัวข้อช่องจองล่วงหน้า (หน้าแรก)
              <input
                className="input"
                value={copy.homePreOrderTitle}
                onChange={(e) => setCopy({ ...copy, homePreOrderTitle: e.target.value })}
              />
            </label>
            <label className="text-xs flex flex-col gap-1">
              ข้อความเตือนใต้แคมเปญ
              <input
                className="input"
                value={copy.adNotice}
                onChange={(e) => setCopy({ ...copy, adNotice: e.target.value })}
              />
            </label>
          </div>
        </>
      )}
    </div>
  )
}
