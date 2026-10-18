// ============================================
// Admin — Promotions Management (D5 gap, Phase D)
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getPromotionsAdmin, upsertPromotion, deletePromotion, togglePromotion, type PromotionRow } from '@/lib/bmbAdminApi_promotions'
import { submitContentForApproval } from '@/lib/contentApproval'
import { validatePromotionForm } from '@/lib/promotionClient'
import { uploadMediaAsset } from '@/lib/bmbAdminApi_media'

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
}

export function AdminPromotions() {
  const [promotions, setPromotions] = useState<PromotionRow[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editing, setEditing] = useState<PromotionRow | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [uploading, setUploading] = useState(false)

  useEffect(() => { loadPromotions() }, [])

  async function loadPromotions() {
    setPromotions(await getPromotionsAdmin())
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowAddForm(true)
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
    })
    setShowAddForm(true)
  }

  async function handleSave() {
    // Real validation: sane values, date order and UNIQUE code — migration 114
    // looks codes up with LIMIT 1 so duplicates would make the discount applied
    // to customers non-deterministic.
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
      // DATE/TEXT columns: empty string is NOT NULL — send null so a blank
      // date field stores NULL (matches the114 "NULL = unbounded" rule).
      start_date: v.start_date || null,
      end_date: v.end_date || null,
      is_active: v.is_active,
      is_banner: v.is_banner,
      banner_image: v.banner_image || null,
    }
    const saved = await upsertPromotion(row)
    if (!saved.ok) {
      // แสดงเหตุผลจริงจากฐานข้อมูลบนจอ — ไม่กลบปัญหาด้วยข้อความกว้าง ๆ
      showToast(`บันทึกโปรโมชั่นไม่สำเร็จ: ${saved.error}`, 'error')
      return
    }
    // CNT-01: banner content is submitted for human review (real workflow —
    // `content_approvals` + review RPC). NOTE: customer visibility of the home
    // banner is controlled by the Active toggle (HomePage/FloatingAdBanners read
    // `is_banner AND is_active`) — this copy never claims an approval gate the
    // renderer does not enforce.
    if (row.is_banner) {
      const approvalId = await submitContentForApproval('banner', row.name, row.description || '')
      if (approvalId) {
        showToast('บันทึกโปรโมชั่นแล้ว + ส่งแบนเนอร์เข้าคิวตรวจเนื้อหา (CNT-01) — แบนเนอร์จะขึ้นหน้าแรกเมื่อเปิดใช้งาน (แนะนำ: รอผลตรวจก่อนเปิดใช้งาน)', 'success')
      } else {
        showToast('บันทึกโปรโมชั่นแล้ว แต่ส่งเข้าคิวตรวจเนื้อหาไม่สำเร็จ — แบนเนอร์จะแสดงตามปุ่มเปิดใช้งาน (Active) เท่านั้น', 'warning')
      }
    } else {
      showToast('บันทึกโปรโมชั่นแล้ว', 'success')
    }
    setShowAddForm(false)
    loadPromotions()
  }

  async function handleToggle(promo: PromotionRow) {
    const res = await togglePromotion(promo.id, !promo.is_active)
    if (res.ok) {
      showToast(promo.is_active ? 'พักโปรโมชั่นแล้ว — ลูกค้าใช้โค้ดนี้ไม่ได้จนกว่าจะเปิดใหม่' : 'เปิดใช้งานโปรโมชั่นแล้ว — ลูกค้าใช้โค้ดได้ตามเงื่อนไข', 'success')
      loadPromotions()
    } else {
      showToast(`เปลี่ยนสถานะไม่สำเร็จ: ${res.error ?? 'ลองอีกครั้ง'}`, 'error')
    }
  }

  async function handleDelete(promo: PromotionRow) {
    if (!window.confirm(`ลบโปรโมชั่น "${promo.name}"? — โค้ด ${promo.code || '(ไม่มีโค้ด)'} จะใช้ไม่ได้ทันที`)) return
    const res = await deletePromotion(promo.id)
    if (res.ok) {
      showToast('ลบโปรโมชั่นแล้ว', 'success')
      loadPromotions()
    } else {
      showToast(`ลบไม่สำเร็จ: ${res.error ?? 'ลองอีกครั้ง'}`, 'error')
    }
  }

  async function handleUploadBanner(file: File) {
    setUploading(true)
    try {
      const asset = await uploadMediaAsset(file, 'image', form.name || 'banner')
      if (asset?.url) {
        setForm((f) => ({ ...f, banner_image: asset.url }))
        showToast('อัปโหลดรูปสำเร็จ — รูปจะใช้เป็นแบนเนอร์ตามที่ตั้งค่าไว้', 'success')
      } else {
        showToast('อัปโหลดรูปไม่สำเร็จ — ลองอีกครั้ง หรือวางลิงก์รูปในช่องด้านบนแทน', 'error')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🎁 โปรโมชั่น</h1>
        <Link to="/admin" className="btn btn-outline">← กลับหน้าภาพรวม</Link>
      </div>

      <div className="mb-4">
        <button onClick={openCreate} className="btn btn-primary">+ สร้างโปรโมชั่นใหม่</button>
      </div>

      {showAddForm && (
        <div className="card mb-6 p-4">
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
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_banner} onChange={(e) => setForm({ ...form, is_banner: e.target.checked })} />
              🏠 แสดงเป็นแบนเนอร์หน้าแรก (ลูกค้าปิดได้)
            </label>
            <input
              className="input"
              placeholder="ลิงก์รูปแบนเนอร์ (ไม่บังคับ)"
              value={form.banner_image}
              onChange={(e) => setForm({ ...form, banner_image: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                className="input"
                aria-label="เลือกรูปแบนเนอร์จากเครื่อง"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleUploadBanner(f)
                }}
              />
              {uploading && <span className="text-sm text-brand-muted">กำลังอัปโหลดรูป…</span>}
            </div>
            {form.banner_image && (
              <div className="col-span-2">
                <p className="text-xs text-brand-muted mb-1">รูปที่จะใช้:</p>
                <img src={form.banner_image} alt="ตัวอย่างรูปแบนเนอร์" className="h-24 rounded-lg object-cover border border-brand-border" />
              </div>
            )}
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
              </div>
              <div className="text-right">
                <span className={`badge ${p.is_active ? 'badge-success' : 'badge-warning'}`}>{p.is_active ? 'เปิดใช้งาน' : 'พักชั่วคราว'}</span>
                {p.is_banner && (
                  <Link to="/admin/content-approvals" className="badge badge-info text-xs" title="แบนเนอร์จะส่งเข้าคิวตรวจเนื้อหาก่อนแสดงผล">🛡️ รอตรวจเนื้อหา</Link>
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