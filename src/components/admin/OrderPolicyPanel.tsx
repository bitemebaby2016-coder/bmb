// ============================================
// Admin — Order/Delivery Policy panel (typed form)
// ============================================
// WHY (Owner 2026-10-24): "ข้อมูลต้องถูกตั้งจากฝั่งแอดมินได้" — ฟอร์มมีชนิดข้อมูล
// บันทึกลง business_settings.order_policy (คีย์เดียวกับที่ server order_setting อ่าน)
// — ปิดช่องพิมพ์ JSON ดิบจนค่าพัง (pre_order_lead_days = "มี7" -> 22P02 ทั้งระบบ)

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import {
  getBusinessSettings,
  setBusinessSetting,
} from '@/lib/bmbAdminApi_settings'
import {
  ORDER_POLICY_FIELDS,
  normalizeOrderPolicy,
  validateOrderPolicy,
  type OrderPolicy,
} from '@/lib/orderPolicy'

export function OrderPolicyPanel() {
  const [policy, setPolicy] = useState<OrderPolicy | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const s = await getBusinessSettings()
      setPolicy(normalizeOrderPolicy(s.order_policy))
    })()
  }, [])

  async function handleSave() {
    if (!policy) return
    const invalid = validateOrderPolicy(policy)
    if (invalid) {
      showToast(invalid, 'error')
      return
    }
    setSaving(true)
    try {
      const s = await getBusinessSettings()
      // merge — คีย์อื่นใน order_policy ที่ฟอร์มไม่แสดงต้องไม่หาย
      const merged = { ...(s.order_policy ?? {}), ...policy }
      const ok = await setBusinessSetting('order_policy', merged)
      showToast(ok ? 'บันทึกนโยบายสั่งซื้อ/จัดส่งแล้ว' : 'บันทึกไม่สำเร็จ — ลองใหม่', ok ? 'success' : 'error')
      if (ok) setPolicy(normalizeOrderPolicy(merged))
    } finally {
      setSaving(false)
    }
  }

  if (!policy) {
    return <div className="card mb-6 text-brand-muted text-sm">กำลังโหลดนโยบายสั่งซื้อ/จัดส่ง…</div>
  }

  return (
    <div className="card mb-6" data-testid="order-policy-panel">
      <h2 className="text-xl font-bold text-brand-accent mb-1">📋 นโยบายสั่งซื้อ & จัดส่ง (order_policy)</h2>
      <p className="text-sm text-brand-muted mb-4">
        ค่าเหล่านี้ถูกใช้โดยเซิร์ฟเวอร์จริงตอนสั่งซื้อ (คัทออฟพรีออเดอร์ = ปิดรับก่อนเวลาส่งตามจำนวน ชม. ที่ตั้ง)
        {' · '}<b>ลำดับกันชน (audit D2):</b> คัทออฟต่อรอบ (<code>pre_order_cutoff</code> ที่หน้า{' '}
        <Link to="/admin/delivery?tab=rounds" className="text-brand-primary font-semibold">รอบจัดส่ง</Link>) มีสิทธิ์ทับกฎนี้
        — ถ้ารอบไม่ได้ตั้งไว้ จึงใช้ <code>cutoff_hours</code> ตรงนี้ (fallback → ป้าย legacy)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ORDER_POLICY_FIELDS.map((f) => (
          <label key={f.key} className="text-sm">
            <span className="font-medium text-slate-800">{f.label}</span>
            <input
              type="number"
              className="input mt-1"
              step={f.step}
              min={f.min}
              max={f.max}
              value={policy[f.key]}
              data-testid={`order-policy-${f.key}`}
              onChange={(e) => setPolicy({ ...policy, [f.key]: Number(e.target.value) })}
            />
            <span className="block text-xs text-brand-muted mt-1">{f.hint}</span>
          </label>
        ))}
      </div>
      <button onClick={() => void handleSave()} disabled={saving} className="btn btn-success mt-4" data-testid="order-policy-save">
        {saving ? 'กำลังบันทึก…' : 'บันทึกนโยบาย'}
      </button>
    </div>
  )
}