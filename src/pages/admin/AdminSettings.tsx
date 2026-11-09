// ============================================
// Bite Me Baby — Admin Business Settings (HUB SETTINGS TAB)
// ============================================
// ส่วนที่เห็นโดย admin: เซตค่ากลางของร้าน — load/save ผ่าน RPC bmb_admin_api_get_settings/set
// รวม generic JSON editor + typed panels (order_policy, social, SEO, status copy, branch config)
// คีย์ที่มี typed UI อยู่ใน TYPED_FORM_KEYS = generic editor จะข้าม
// R84: เพิ่มคีย์ CRM Automation + Promotion Policy kill switch (boolean) ให้มี ToggleSwitch แทนพิมพ์ true/false เอง

import { useEffect, useRef, useState } from 'react'
import { showToast } from '@/components/ui/ToastContainer'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'
import { OrderPolicyPanel } from '@/components/admin/OrderPolicyPanel'
import { ToggleSwitch } from '@/components/admin/ToggleSwitch'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

// keys that get their own typed UI (generic editor skips these)
const TYPED_FORM_KEYS = new Set<string>([
  'social_links',
  'seo',
  'store_status_copy',
  'order_policy',
  'store_master_open',
  'cod_enabled',
  'crm_automation',       // R84: CRM Automation kill switch
  'promotion_policy',     // R84: Promotion Policy kill switch
])

const SOCIAL_LINKS_SETTING_KEY = 'social_links'
const SEO_SETTINGS_KEY = 'seo'
const STORE_STATUS_COPY_KEY = 'store_status_copy'

const SOCIAL_DEFAULTS = { facebook: '', instagram: '', line_oa: '', tiktok: '', youtube: '' }
const SEO_DEFAULTS = { meta_title: '', meta_description: '', og_image_url: '' }
const STATUS_COPY_DEFAULTS = { open_text: '', closed_text: '', preparing_text: '', busy_text: '' }

export function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)
  const [jsonKey, setJsonKey] = useState('')
  const [jsonValue, setJsonValue] = useState('')
  const [branchHours, setBranchHours] = useState<any>(null)
  const [branchRadius, setBranchRadius] = useState<number>(0)
  const [branchConfigLoaded, setBranchConfigLoaded] = useState(false)
  const [searchParams] = useSearchParams()

  // M4: deep-link ?focus=key — โฟกัส section ที่ระบุ (จาก hub/ตำแหน่งอื่น)
  const focusKey = searchParams.get('focus')
  const focusedRef = useRef<string | null>(null)

  useEffect(() => {
    void (async () => {
      setSettings(await getBusinessSettings())
      setLoading(false)
      // โหลด branch config แยก (radius + hours) - ดึงจาก branches table โดยตรง
      const { data: branches } = await supabase
        .from('branches')
        .select('id, name, slug, service_radius_km, operating_hours, is_default')
        .eq('status', 'active')
        .order('is_default', { ascending: false })
      const defaultBranch = (branches || []).find((b: any) => b.is_default) || branches?.[0]
      if (defaultBranch) {
        setBranchHours(defaultBranch.operating_hours || {})
        setBranchRadius(defaultBranch.service_radius_km ?? 0)
      }
      setBranchConfigLoaded(true)
    })()
  }, [])

  // M4: เมื่อ focus เปลี่ยน ให้โหลดใหม่ + scroll ไป section นั้น
  useEffect(() => {
    if (!focusKey) return
    void (async () => {
      setSettings(await getBusinessSettings())
      const t = window.setTimeout(() => {
        const el = document.querySelector(`[data-focus-key="${focusKey}"]`)
        if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); focusedRef.current = focusKey }
      }, 150)
      return () => window.clearTimeout(t)
    })()
  }, [focusKey])

  async function handleSaveAll() {
    const keys = Object.keys(settings).filter((k) => !TYPED_FORM_KEYS.has(k))
    let allOk = true
    for (const k of keys) {
      const ok = await setBusinessSetting(k, settings[k])
      if (!ok) allOk = false
    }
    showToast(allOk ? 'บันทึกการตั้งค่าทั้งหมดแล้ว' : 'บางการตั้งค่าบันทึกไม่สำเร็จ', allOk ? 'success' : 'error')
  }

  async function handleJsonSave(key: string) {
    try {
      const parsed = JSON.parse(jsonValue)
      setSettings((s) => ({ ...s, [key]: parsed }))
      const ok = await setBusinessSetting(key, parsed)
      showToast(ok ? `บันทึก ${key} แล้ว` : `บันทึก ${key} ไม่สำเร็จ`, ok ? 'success' : 'error')
      if (ok) { setShowJson(false); setJsonKey(''); setJsonValue('') }
    } catch {
      showToast('JSON ไม่ถูกต้อง', 'error')
    }
  }

  async function handleToggle(key: string, value: boolean) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    const ok = await setBusinessSetting(key, value)
    showToast(ok ? `บันทึก ${key} แล้ว` : `บันทึก ${key} ไม่สำเร็จ`, ok ? 'success' : 'error')
    if (!ok) setSettings(settings)
  }

  // R84: handler สำหรับ boolean nested settings
  async function handleToggleNested(key: string, field: string, value: boolean) {
    const nextValue = { ...(settings[key] || {}), [field]: value }
    const next = { ...settings, [key]: nextValue }
    setSettings(next)
    const ok = await setBusinessSetting(key, nextValue)
    showToast(ok ? `บันทึก ${key}.${field} แล้ว` : `บันทึก ${key}.${field} ไม่สำเร็จ`, ok ? 'success' : 'error')
    if (!ok) setSettings(settings)
  }

  async function handleBranchSave() {
    const { data: branches } = await supabase
      .from('branches')
      .select('id')
      .eq('status', 'active')
      .order('is_default', { ascending: false })
    const defaultBranch = branches?.[0]
    if (!defaultBranch) {
      showToast('ไม่พบสาขาเริ่มต้น', 'error')
      return
    }
    const { error } = await supabase
      .from('branches')
      .update({ service_radius_km: branchRadius, operating_hours: branchHours, updated_at: new Date().toISOString() })
      .eq('id', defaultBranch.id)
    const ok = !error
    showToast(ok ? 'บันทึกตั้งค่าสาขาแล้ว' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
  }

  const editableKeys = Object.keys(settings).filter((k) => !TYPED_FORM_KEYS.has(k))

  if (loading) return <p className="text-brand-muted">กำลังโหลด...</p>

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6" data-testid="admin-settings-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-accent">⚙️ ตั้งค่าธุรกิจ</h1>
        <Link to="/admin" className="btn btn-outline">← แดชบอร์ด</Link>
      </div>

      {/* 1. Order Policy (typed panel) */}
      <div className="card" data-testid="order-policy-panel" data-focus-key="order_policy">
        <OrderPolicyPanel />
      </div>

      {/* 2. Generic JSON Editor (all other keys) */}
      <div className="card" data-focus-key="json_editor">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-brand-accent">📝 ตัวแก้ไข JSON ทั่วไป</h2>
          {editableKeys.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                className="input text-sm"
                value={jsonKey}
                onChange={(e) => { const k = e.target.value; setJsonKey(k); setJsonValue(JSON.stringify(settings[k] ?? {}, null, 2)) }}
              >
                <option value="">— เลือกคีย์ —</option>
                {editableKeys.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <button className="btn btn-outline btn-sm" onClick={() => setShowJson(!showJson)}>
                {showJson ? 'ซ่อน' : 'แก้ไข'}
              </button>
            </div>
          )}
        </div>
        {editableKeys.length === 0 && <p className="text-sm text-brand-muted">ไม่มีคีย์เพิ่มเติม (ทั้งหมดมี UI แบบฟอร์มแล้ว)</p>}
        {showJson && jsonKey && (
          <div className="space-y-2" data-testid="json-form">
            <textarea
              className="input font-mono text-xs min-h-[120px]"
              value={jsonValue}
              onChange={(e) => setJsonValue(e.target.value)}
              placeholder="{}"
              data-testid="json-textarea"
            />
            <button className="btn btn-primary btn-sm" onClick={() => void handleJsonSave(jsonKey)} data-testid="json-save">
              💾 บันทึก {jsonKey}
            </button>
          </div>
        )}
      </div>

      {/* 3. Master Switch (store_master_open) */}
      <div className="card" data-testid="master-switch" data-focus-key="store_master_open">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-semibold">สวิตช์หลัก (เปิด/ปิดร้านทั้งระบบ)</div>
            <div className="text-xs text-brand-muted">
              ปิด = หยุดรับออเดอร์ทุกช่องทางทันที · เปิด = ใช้กฎเวลา/รอบปกติ · ค่าเริ่มต้น = เปิด
            </div>
          </div>
          <ToggleSwitch
            checked={settings.store_master_open !== false}
            onChange={(v) => void handleToggle('store_master_open', v)}
            label={settings.store_master_open !== false ? 'เปิด' : 'ปิด'}
            testId="master-switch-toggle"
          />
        </div>
      </div>

      {/* 4. COD Switch (cod_enabled.enabled) */}
      <div className="card" data-testid="cod-switch" data-focus-key="cod_enabled">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-semibold">เงินสดปลายทาง</div>
            <div className="text-xs text-brand-muted">
              ปิด = ซ่อนตัวเลือก COD จากหน้าร้าน · เปิด = แสดง · ค่าเริ่มต้น = เปิด
            </div>
          </div>
          <ToggleSwitch
            checked={settings.cod_enabled?.enabled !== false}
            onChange={(v) => void handleToggleNested('cod_enabled', 'enabled', v)}
            label={settings.cod_enabled?.enabled !== false ? 'เปิด' : 'ปิด'}
            testId="cod-switch-toggle"
          />
        </div>
      </div>

      {/* R84: 5. CRM Automation Kill Switch (crm_automation.enabled) */}
      <div className="card" data-testid="crm-automation-switch" data-focus-key="crm_automation">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-semibold">CRM Automation</div>
            <div className="text-xs text-brand-muted">
              ปิด = หยุดการส่งอัตโนมัติ (Win-back / Birthday / Segment) ทันที · เปิด = ทำงานตามตาราง · ค่าเริ่มต้น = เปิด
            </div>
          </div>
          <ToggleSwitch
            checked={settings.crm_automation?.enabled !== false}
            onChange={(v) => void handleToggleNested('crm_automation', 'enabled', v)}
            label={settings.crm_automation?.enabled !== false ? 'เปิด' : 'ปิด'}
            testId="crm-automation-toggle"
          />
        </div>
      </div>

      {/* R84: 6. Promotions Kill Switch (promotion_policy.promotions_enabled) */}
      <div className="card" data-testid="promotions-switch" data-focus-key="promotion_policy">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-semibold">โปรโมชัน (Kill Switch)</div>
            <div className="text-xs text-brand-muted">
              ปิด = ซ่อนโปรโมชันทั้งหมดจากหน้าร้าน/เมนู · เปิด = แสดงตามกฎปกติ · ค่าเริ่มต้น = เปิด
            </div>
          </div>
          <ToggleSwitch
            checked={settings.promotion_policy?.promotions_enabled !== false}
            onChange={(v) => void handleToggleNested('promotion_policy', 'promotions_enabled', v)}
            label={settings.promotion_policy?.promotions_enabled !== false ? 'เปิด' : 'ปิด'}
            testId="promotions-toggle"
          />
        </div>
      </div>

      {/* 7. Social Links */}
      <div className="card" data-focus-key="social_links">
        <h2 className="font-bold text-brand-accent mb-3">📱 โซเชียลและไลน์ (แสดงในฟุตเตอร์)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(SOCIAL_DEFAULTS).map(([k, def]) => (
            <label key={k} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{k}</span>
              <input
                className="input"
                value={settings.social_links?.[k] ?? def}
                onChange={(e) => setSettings((s) => ({ ...s, social_links: { ...(s.social_links ?? SOCIAL_DEFAULTS), [k]: e.target.value } }))}
              />
            </label>
          ))}
        </div>
        <button className="btn btn-primary btn-sm mt-3" onClick={async () => {
          const ok = await setBusinessSetting(SOCIAL_LINKS_SETTING_KEY, settings.social_links ?? SOCIAL_DEFAULTS)
          showToast(ok ? 'บันทึกโซเชียลแล้ว' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
        }} data-testid="save-social">
          💾 บันทึกโซเชียล
        </button>
      </div>

      {/* 8. SEO Copy */}
      <div className="card" data-focus-key="seo">
        <h2 className="font-bold text-brand-accent mb-3">🔎 SEO / คำค้นหา</h2>
        <div className="space-y-3">
          {Object.entries(SEO_DEFAULTS).map(([k, def]) => (
            <label key={k} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{k === 'meta_title' ? 'Title' : k === 'meta_description' ? 'Description' : 'OG Image URL'}</span>
              <input
                className="input"
                value={settings.seo?.[k] ?? def}
                onChange={(e) => setSettings((s) => ({ ...s, seo: { ...(s.seo ?? SEO_DEFAULTS), [k]: e.target.value } }))}
              />
            </label>
          ))}
        </div>
        <button className="btn btn-primary btn-sm mt-3" onClick={async () => {
          const ok = await setBusinessSetting(SEO_SETTINGS_KEY, settings.seo ?? SEO_DEFAULTS)
          showToast(ok ? 'บันทึก SEO แล้ว' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
        }} data-testid="save-seo">
          💾 บันทึก SEO
        </button>
      </div>

      {/* 9. Store Status Copy */}
      <div className="card" data-focus-key="store_status_copy">
        <h2 className="font-bold text-brand-accent mb-3">📣 แถบสถานะหน้าร้าน (ข้อความ)</h2>
        <div className="space-y-3">
          {Object.entries(STATUS_COPY_DEFAULTS).map(([k, def]) => (
            <label key={k} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{k === 'open_text' ? 'เปิด' : k === 'closed_text' ? 'ปิด' : k === 'preparing_text' ? 'กำลังเตรียม' : 'แอ่วแนว'}</span>
              <input
                className="input"
                value={settings.store_status_copy?.[k] ?? def}
                onChange={(e) => setSettings((s) => ({ ...s, store_status_copy: { ...(s.store_status_copy ?? STATUS_COPY_DEFAULTS), [k]: e.target.value } }))}
              />
            </label>
          ))}
        </div>
        <button className="btn btn-primary btn-sm mt-3" onClick={async () => {
          const ok = await setBusinessSetting(STORE_STATUS_COPY_KEY, settings.store_status_copy ?? STATUS_COPY_DEFAULTS)
          showToast(ok ? 'บันทึกข้อความสถานะแล้ว' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
        }} data-testid="save-status-copy">
          💾 บันทึกข้อความสถานะ
        </button>
      </div>

      {/* 10. Delivery Zones (link) */}
      <div className="card" data-focus-key="delivery_zones">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <div className="font-semibold">🚚 ค่าส่ง/โซน</div>
            <div className="text-xs text-brand-muted">จัดการโซนและอัตราค่าส่งที่ศูนย์ขนส่ง</div>
          </div>
          <Link to="/admin/delivery" className="btn btn-outline btn-sm">ไปที่ศูนย์ขนส่ง</Link>
        </div>
      </div>

      {/* 11. Brand (link) */}
      <div className="card" data-focus-key="brand">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <div className="font-semibold">🎨 แบรนด์</div>
            <div className="text-xs text-brand-muted">จัดการแบรนด์/ธีม/โดเมนของร้าน</div>
          </div>
          <Link to="/admin/tenants?tab=brands" className="btn btn-outline btn-sm">ไปจัดการแบรนด์</Link>
        </div>
      </div>

      {/* 12. Branch Config (radius + hours JSON) */}
      <div className="card" data-focus-key="branch_config">
        <h2 className="font-bold text-brand-accent mb-3">🏬 สาขา (รัศมี + เวลาเปิด-ปิด)</h2>
        <div className="space-y-3 mb-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">รัศมีบริการ (กม.)</span>
            <input type="number" min={0} max={100} step={1} className="input w-32" value={branchRadius} onChange={(e) => setBranchRadius(Number(e.target.value) || 0)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">เวลาเปิด-ปิด (JSON)</span>
            <textarea className="input font-mono text-xs min-h-[100px]" value={JSON.stringify(branchHours, null, 2)} onChange={(e) => { try { setBranchHours(JSON.parse(e.target.value)) } catch {} }} placeholder='{"mon":{"open":"08:00","close":"22:00"},"tue":...}' />
          </label>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleBranchSave} disabled={!branchConfigLoaded} data-testid="save-branch-config">
          {branchConfigLoaded ? '💾 บันทึกสาขา' : '⏳ กำลังโหลด...'}
        </button>
      </div>

      {/* Save All Button */}
      <div className="flex justify-end">
        <button className="btn btn-success" onClick={handleSaveAll} data-testid="save-all-settings">
          💾 บันทึกทั้งหมด
        </button>
      </div>
    </div>
  )
}