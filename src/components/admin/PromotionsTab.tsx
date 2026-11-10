// ============================================
// Bite Me Baby — Promotions Tab (Promotion CRUD only)
// Image upload/browse/album moved to ContentTab (สร้างเนื้อหา)
// ============================================
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getPromotionsAdmin, upsertPromotion, deletePromotion, togglePromotion, attachPromotionScope, setPromotionApprovalId, type PromotionRow } from '@/lib/bmbAdminApi_promotions'
import { submitContentForApproval } from '@/lib/contentApproval'
import { validatePromotionForm } from '@/lib/promotionClient'
import { getProducts } from '@/lib/bmbAdminApi_products'

const EMPTY_FORM = {
  name: '',
  description: '',
  code: '',
  discount_type: 'percentage' as 'percentage' | 'fixed_amount',
  discount_value: 10,
  min_order_amount: 0,
  start_date: '',
  end_date: '',
  is_active: true,
  is_banner: false,
  banner_image: '',
  banner_mascot: '',
  stackable: false,
  applies_to: 'all_products' as 'all_products' | 'specific_products',
  max_discount_amount: null as number | null,
  usage_limit: null as number | null,
  scope_product_ids: [] as string[],
}

export interface PromotionsTabProps {
  /** Promotions from parent container (shared state) */
  promotions: PromotionRow[]
  /** Setter for promotions to update parent state */
  setPromotions: (promos: PromotionRow[]) => void
}

export function PromotionsTab({ promotions, setPromotions }: PromotionsTabProps) {
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: number }>>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editing, setEditing] = useState<PromotionRow | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void (async () => setProducts(await getProducts()))()
  }, [])

  function scrollToForm() {
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowAddForm(true)
    scrollToForm()
  }

  function openEdit(promo: PromotionRow) {
    setEditing(promo)
    setForm({
      name: promo.name,
      description: promo.description || '',
      code: promo.code || '',
      discount_type: promo.discount_type,
      discount_value: Number(promo.discount_value),
      min_order_amount: Number(promo.min_order_amount),
      start_date: (promo.start_date || '').slice(0, 10),
      end_date: (promo.end_date || '').slice(0, 10),
      is_active: promo.is_active,
      is_banner: promo.is_banner || false,
      banner_image: promo.banner_image || '',
      banner_mascot: promo.banner_mascot || '',
      stackable: promo.stackable ?? false,
      applies_to: promo.applies_to ?? 'all_products',
      max_discount_amount:
        promo.max_discount_amount === null || promo.max_discount_amount === undefined
          ? null
          : Number(promo.max_discount_amount),
      usage_limit:
        promo.usage_limit === null || promo.usage_limit === undefined
          ? null
          : Number(promo.usage_limit),
      scope_product_ids: promo.scope_product_ids ?? [],
    })
    setShowAddForm(true)
    scrollToForm()
  }

  async function handleSave() {
    const validated = validatePromotionForm(form, promotions, editing?.id)
    if (!validated.ok) {
      showToast(validated.errors[0], 'warning')
      return
    }
    const v = validated.values
    const row: PromotionRow = {
      id: editing?.id || '',
      name: v.name,
      description: v.description || null,
      code: v.code || null,
      discount_type: v.discount_type,
      discount_value: v.discount_value,
      min_order_amount: v.min_order_amount,
      start_date: v.start_date || null,
      end_date: v.end_date || null,
      is_active: v.is_active,
      is_banner: v.is_banner,
      banner_image: v.banner_image || null,
      banner_mascot: form.banner_mascot || null,
      stackable: v.stackable ?? false,
      applies_to: v.applies_to ?? 'all_products',
      max_discount_amount: v.max_discount_amount ?? null,
      usage_limit: v.usage_limit ?? null,
      scope_product_ids: v.scope_product_ids ?? [],
    }
    const saved = await upsertPromotion(row)
    if (!saved.ok) {
      showToast(`บันทึกโปรโมชั่นไม่สำเร็จ: ${saved.error}`, 'error')
      return
    }
    if (row.is_banner) {
      const approvalId = await submitContentForApproval('banner', row.name, row.description || '')
      if (approvalId) {
        // Persist approval_id to promotion row for traceability
        await setPromotionApprovalId(row.id, approvalId)
        showToast('บันทึกโปรโมชั่นแล้ว + ส่งแบนเนอร์เข้าคิวตรวจเนื้อหา (CNT-01) — แบนเนอร์จะขึ้นหน้าแรกเมื่ออนุมัติ', 'success')
      } else {
        showToast('บันทึกโปรโมชั่นแล้ว แต่ส่งเข้าคิวตรวจเนื้อหาไม่สำเร็จ — แบนเนอร์จะแสดงตามปุ่มเปิดใช้งาน (Active) เท่านั้น', 'warning')
      }
    } else {
      showToast('บันทึกโปรโมชั่นแล้ว', 'success')
    }
    setShowAddForm(false)
    setPromotions(await attachPromotionScope(await getPromotionsAdmin()))
  }

  async function handleToggle(promo: PromotionRow) {
    const res = await togglePromotion(promo.id, !promo.is_active)
    if (res.ok) {
      showToast(promo.is_active ? 'พักโปรโมชั่นแล้ว — ลูกค้าใช้โค้ดนี้ไม่ได้จนกว่าจะเปิดใหม่' : 'เปิดใช้งานโปรโมชั่นแล้ว — ลูกค้าใช้โค้ดได้ตามเงื่อนไข', 'success')
      setPromotions(await attachPromotionScope(await getPromotionsAdmin()))
    } else {
      showToast(`เปลี่ยนสถานะไม่สำเร็จ: ${res.error ?? 'ลองอีกครั้ง'}`, 'error')
    }
  }

  async function handleDelete(promo: PromotionRow) {
    if (!window.confirm(`ลบโปรโมชั่น "${promo.name}"? — โค้ด ${promo.code || '(ไม่มีโค้ด)'} จะใช้ไม่ได้ทันที`)) return
    const res = await deletePromotion(promo.id)
    if (res.ok) {
      showToast('ลบโปรโมชั่นแล้ว', 'success')
      setPromotions(await attachPromotionScope(await getPromotionsAdmin()))
    } else {
      showToast(`ลบไม่สำเร็จ: ${res.error ?? 'ลองอีกครั้ง'}`, 'error')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🎁 โปรโมชั่น/ส่วนลด</h1>
        <Link to="/admin" className="btn btn-outline">← กลับหน้าภาพรวม</Link>
      </div>

      <div className="mb-4">
        <button onClick={openCreate} className="btn btn-primary">+ สร้างโปรโมชั่นใหม่</button>
        <p className="text-xs text-brand-muted mt-1">💡 รูปภาพ/มาสคอตจัดการที่แท็บ "📝 สร้างเนื้อหา" ได้</p>
      </div>

      {showAddForm && (
        <div className="card mb-6 p-4" ref={formRef}>
          <h3 className="font-bold text-brand-accent mb-3">{editing ? 'แก้ไขโปรโมชั่น' : 'สร้างโปรโมชั่นใหม่'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="ชื่อโปรโมชั่น *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="รหัสโค้ด (เช่น BMB10)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input className="input" placeholder="รายละเอียด" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <select className="input" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as any })}>
              <option value="percentage">ลดเป็นเปอร์เซ็นต์ (%)</option>
              <option value="fixed_amount">ลดเป็นจำนวนเงิน (บาท)</option>
            </select>
            <input type="number" className="input" placeholder="มูลค่าส่วนลด" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} />
            <input type="number" className="input" placeholder="ยอดสั่งขั้นต่ำ (บาท)" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: Number(e.target.value) })} />
            <input
              type="number"
              min={0}
              className="input"
              placeholder="เพดานส่วนลด/ออเดอร์ (บาท · ว่าง = ไม่จำกัด)"
              value={form.max_discount_amount ?? ''}
              onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value === '' ? null : Number(e.target.value) })}
              data-testid="promo-max-discount"
            />
            <input
              type="number"
              min={1}
              className="input"
              placeholder="จำนวนสิทธิ์ใช้โค้ด (ว่าง = ไม่จำกัด)"
              value={form.usage_limit ?? ''}
              onChange={(e) => setForm({ ...form, usage_limit: e.target.value === '' ? null : Number(e.target.value) })}
              data-testid="promo-usage-limit"
            />
            <label className="text-sm flex items-center gap-2">
              เริ่ม:
              <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </label>
            <label className="text-sm flex items-center gap-2">
              ถึง:
              <input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              เปิดใช้งาน
            </label>
            <label className="flex items-center gap-2" title="ปิด = เลือกข้อเสนอที่ดีที่สุดอย่างเดียว (เปิดจริงตอนระบบแต้มมาถึง)">
              <input type="checkbox" checked={form.stackable} onChange={(e) => setForm({ ...form, stackable: e.target.checked })} data-testid="promo-stackable" />
              🧩 ซ้อนกับสิทธิ์อื่นได้
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_banner} onChange={(e) => setForm({ ...form, is_banner: e.target.checked })} />
              🏠 แสดงเป็นแบนเนอร์หน้าแรก (ลูกค้าปิดได้)
            </label>
            <label className="text-sm">
              สินค้าที่ร่วมรายการ
              <select
                className="input w-full"
                value={form.applies_to}
                onChange={(e) => setForm({ ...form, applies_to: e.target.value as 'all_products' | 'specific_products' })}
                data-testid="promo-applies-to"
              >
                <option value="all_products">ทั้งออเดอร์ (ทุกสินค้า)</option>
                <option value="specific_products">จำกัดสินค้าที่เลือก</option>
              </select>
            </label>
            {form.applies_to === 'specific_products' && (
              <div className="col-span-2 rounded-xl border border-brand-border p-3" data-testid="promo-scope-picker">
                <p className="text-xs text-brand-muted mb-2">
                  เลือกสินค้าที่เข้าเกณฑ์ส่วนลด (ส่วนลดคิดจากยอดของสินค้าเหล่านี้เท่านั้น — เลือกแล้วอย่างน้อย 1 รายการ)
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.scope_product_ids.includes(p.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            scope_product_ids: e.target.checked
                              ? [...form.scope_product_ids, p.id]
                              : form.scope_product_ids.filter((id) => id !== p.id),
                          })
                        }
                      />
                      <span>{p.name}</span>
                      <span className="text-brand-muted">฿{p.price}</span>
                    </label>
                  ))}
                  {products.length === 0 && <p className="text-xs text-brand-muted">ยังไม่มีสินค้าในระบบ</p>}
                </div>
              </div>
            )}
            <input
              className="input"
              placeholder="ลิงก์รูปแบนเนอร์ (จัดการรูปที่แท็บ สร้างเนื้อหา)"
              value={form.banner_image}
              onChange={(e) => setForm({ ...form, banner_image: e.target.value })}
              data-testid="promo-banner-image-url"
              readOnly
            />
            <p className="text-xs text-brand-muted col-span-2">🖼 รูปแบนเนอร์/มาสคอตจัดการได้ที่แท็บ <b>📝 สร้างเนื้อหา</b> (อัปโหลด/เลือกจากคลังภาพ AI/ตั้งเป็น Floating Ad)</p>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} className="btn btn-success">💾 บันทึก</button>
            <button onClick={() => setShowAddForm(false)} className="btn btn-outline">ยกเลิก</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {promotions.map((p) => (
          <div key={p.id} className="card">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-bold text-brand-accent">
                  {p.name}
                  {p.code && <span className="ml-2 badge badge-primary">{p.code}</span>}
                </div>
                <div className="text-sm text-brand-muted">
                  {p.discount_type === 'percentage' ? `ลด ${p.discount_value}%` : `ลด ฿${p.discount_value}`} • ขั้นต่ำ ฿{p.min_order_amount} • {p.start_date ? `เริ่ม ${p.start_date}` : 'เริ่มทันที'} → {p.end_date ? `ถึง ${p.end_date}` : 'ไม่กำหนดวันสิ้นสุด'}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.applies_to === 'specific_products' && (
                    <span className="badge badge-info text-xs" data-testid="promo-badge-scope">🎯 จำกัดสินค้า {(p.scope_product_ids ?? []).length} รายการ</span>
                  )}
                  {p.max_discount_amount !== null && p.max_discount_amount !== undefined && (
                    <span className="badge badge-warning text-xs">เพดาน ฿{Number(p.max_discount_amount)}</span>
                  )}
                  {p.usage_limit !== null && p.usage_limit !== undefined && (
                    <span className={`badge text-xs ${Number(p.usage_count ?? 0) >= Number(p.usage_limit) ? 'badge-danger' : 'badge-primary'}`} data-testid="promo-badge-usage">
                      สิทธิ์ {Number(p.usage_count ?? 0)}/{Number(p.usage_limit)}
                    </span>
                  )}
                  {p.stackable && <span className="badge badge-success text-xs">🧩 ซ้อนได้</span>}
                  {p.is_banner && <span className="badge badge-info text-xs">🏠 แบนเนอร์</span>}
                </div>
              </div>
              <div className="text-right">
                <span className={`badge ${p.is_active ? 'badge-success' : 'badge-warning'}`}>{p.is_active ? 'เปิดใช้งาน' : 'พักชั่วคราว'}</span>
                {p.is_banner && (
                  <Link to="/admin/marketing-promotions?tab=approvals" className="badge badge-info text-xs" title="แบนเนอร์จะส่งเข้าคิวตรวจเนื้อหาก่อนแสดงผล">🛡️ รอตรวจเนื้อหา</Link>
                )}
                <div className="flex gap-2 mt-1">
                  <button onClick={() => openEdit(p)} className="btn btn-outline text-sm">✏️ แก้ไข</button>
                  <button onClick={() => handleToggle(p)} className="btn btn-outline text-sm">{p.is_active ? '⏸ พักใช้' : '▶ เปิดใช้'}</button>
                  <button onClick={() => handleDelete(p)} className="btn btn-danger text-sm">🗑 ลบ</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {promotions.length === 0 && (
        <div className="text-center py-12 text-brand-muted">ยังไม่มีโปรโมชั่น — กดปุ่ม "สร้างโปรโมชั่นใหม่" ด้านบนได้เลยค่ะ</div>
      )}
    </div>
  )
}