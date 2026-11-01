// ============================================
// Bite Me Baby — AddonMarginPolicyCard (R49 · Admin Control Panel ของกฎกำไรแอดออน)
// ============================================
// หน้าเดียวรวมกติกาที่ Owner สั่ง: (a) ราคาปกติ/โปร = แก้รายชิ้นใน AddonsEditor ด้านล่างฟอร์มเมนู
// (b) เพดานส่วนลดสูงสุด % (กันคูปอง/แต้มกัดกำไร) (c) บังคับซื้อคู่เมนูหลัก (d) เปิด/ปิด cross-sell
// เก็บลง business_settings.addon_margin_policy ด้วย setBusinessSetting ของเดิม + audit log ของเดิม
// ============================================

import { useEffect, useState } from 'react'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'
import { normalizeAddonMarginPolicy, DEFAULT_ADDON_MARGIN_POLICY } from '@/lib/addonMarginGuard'
import { ToggleSwitch } from '@/components/admin/ToggleSwitch'
import { writeAuditLog } from '@/lib/auditLog'
import { showToast } from '@/components/ui/ToastContainer'

export function AddonMarginPolicyCard() {
  const [policy, setPolicy] = useState(DEFAULT_ADDON_MARGIN_POLICY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    void getBusinessSettings()
      .then((s) => { if (alive) setPolicy(normalizeAddonMarginPolicy(s?.addon_margin_policy)) })
      .catch(() => undefined)
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  async function save() {
    setSaving(true)
    const payload = {
      enabled: policy.enabled,
      max_discount_pct: policy.maxDiscountPct,
      min_addon_margin_pct: policy.minAddonMarginPct,
      main_dish_required: policy.mainDishRequired,
      cross_sell_enabled: policy.crossSellEnabled,
    }
    const ok = await setBusinessSetting('addon_margin_policy', payload)
    setSaving(false)
    if (!ok) { showToast('บันทึกกฎกำไรแอดออนไม่สำเร็จ — ลองใหม่', 'error'); return }
    writeAuditLog({
      action: 'settings_change',
      entity_type: 'addon_margin_policy',
      description: 'บันทึกกฎกำไร/ส่วนลดแอดออน',
      metadata: payload,
    })
    showToast('💾 บันทึกกฎกำไรแอดออนแล้ว — มีผลกับหน้าร้าน/ตะกร้ารอบถัดไปทันที', 'success')
  }

  if (loading) return null

  return (
    <div className="card mb-6 bg-brand-bg" data-testid="addon-margin-policy-card">
      <h3 className="text-lg font-bold text-brand-accent mb-1">⚖️ กฎกำไรแอดออน (Add-on Margin Rules)</h3>
      <p className="text-xs text-brand-muted mb-3">
        แอดมินตั้งเอง — เพดานส่วนลดรวมใช้แทนค่าตายตัว 15% เดิม · ราคาโปรโมชัน/ต้นทุนแอดออน = กรอกที่กลุ่ม Toppings ในฟอร์มเมนู · ทุกการเปลี่ยนแปลงบันทึก Audit Trail
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <div className="flex items-center gap-3">
          <ToggleSwitch checked={policy.enabled} onChange={(v) => setPolicy({ ...policy, enabled: v })} label="เปิดกฎนี้" testId="amp-enabled" />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-accent mb-1">เพดานส่วนลดสูงสุด (% ของยอดสินค้า)</label>
          <input
            type="number" min={0} max={90}
            className="input py-1.5 text-sm"
            data-testid="amp-max-discount"
            value={policy.maxDiscountPct}
            onChange={(e) => setPolicy({ ...policy, maxDiscountPct: Math.min(90, Math.max(0, parseInt(e.target.value || '0', 10) || 0)) })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-accent mb-1">กำไรขั้นต่ำแอดออน (% กันคูปองกัด)</label>
          <input
            type="number" min={0} max={90}
            className="input py-1.5 text-sm"
            data-testid="amp-min-margin"
            value={policy.minAddonMarginPct}
            onChange={(e) => setPolicy({ ...policy, minAddonMarginPct: Math.min(90, Math.max(0, parseInt(e.target.value || '0', 10) || 0)) })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <ToggleSwitch checked={policy.mainDishRequired} onChange={(v) => setPolicy({ ...policy, mainDishRequired: v })} label="บังคับคู่กับเมนูหลัก" testId="amp-main-dish" />
          <ToggleSwitch checked={policy.crossSellEnabled} onChange={(v) => setPolicy({ ...policy, crossSellEnabled: v })} label="เปิดแผง Cross-sell" testId="amp-cross-sell" />
        </div>
      </div>
      <div className="mt-3">
        <button onClick={() => void save()} disabled={saving} className="btn btn-primary text-sm" data-testid="amp-save">
          {saving ? 'กำลังบันทึก…' : '💾 บันทึกกฎ'}
        </button>
      </div>
    </div>
  )
}