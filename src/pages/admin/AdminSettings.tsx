// ============================================
// Admin — Business Settings (D15 gap, Phase D)
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'
import { OrderPolicyPanel } from '@/components/admin/OrderPolicyPanel'
import { SOCIAL_LINKS_SETTING_KEY, getSocialLinks, type SocialLinks } from '@/lib/socialLinks'
import { THEATER_DAILY_COPY_KEY, THEATER_DAILY_COPY_STARTER } from '@/lib/theaterDailyCopy'
import { SEO_SETTINGS_KEY, getSeoSettings, type SeoSettings } from '@/lib/seoSettings'
import { STORE_STATUS_COPY_KEY, getStoreStatusCopy, setStoreStatusCopyLive, type StoreStatusCopy } from '@/lib/storeStatusCopy'
import { supabase } from '@/lib/supabase'

// C1/Q8 (audit D1 — "1 เรื่อง = 1 ที่"): key ที่มีฟอร์มเฉพาะทาง — generic editor
// (JSON/JsonForm + Save All) ห้ามโชว์/ห้ามเขียน กันพิมพ์ค่าเสียแบบ 22P02 ซ้ำ
const TYPED_FORM_KEYS = new Set<string>([SOCIAL_LINKS_SETTING_KEY, SEO_SETTINGS_KEY, STORE_STATUS_COPY_KEY, 'order_policy'])

export function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [textMode, setTextMode] = useState<Record<string, boolean>>({})
  const [newKey, setNewKey] = useState('')
  // FINAL CONFIG CLOSURE: admin แก้ canonical นอก business_settings ได้โดยไม่ต้องแก้ code
  const [branch, setBranch] = useState<any>(null)
  const [socials, setSocials] = useState<SocialLinks | null>(null)
  const [seoCopy, setSeoCopy] = useState<SeoSettings | null>(null)
  // N1 (Owner 4-2 · R19): copy แถบสถานะหน้าแรกแก้เองได้ (คีย์ business_settings)
  const [statusCopy, setStatusCopy] = useState<StoreStatusCopy | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [s, br, sl, seo, sc] = await Promise.all([
      getBusinessSettings(),
      supabase.from('branches').select('id, display_name, name, service_radius_km, operating_hours').eq('is_default', true).maybeSingle(),
      getSocialLinks(true),
      getSeoSettings(true),
      getStoreStatusCopy(true),
    ])
    setSettings(s)
    setBranch(br.data ?? null)
    setSocials(sl)
    setSeoCopy(seo)
    setStatusCopy(sc)
    setLoading(false)
  }

  async function handleSave(key: string) {
    // D-02 (R2.1) + C1/Q8: ทางบันทึกเดียว — key ที่มีฟอร์มเฉพาะทางห้ามเขียนจาก generic
    if (TYPED_FORM_KEYS.has(key)) {
      showToast(`${key} บันทึกจากฟอร์มเฉพาะทางด้านบนเท่านั้น (ทางบันทึกเดียว)`, 'error')
      return
    }
    const ok = await setBusinessSetting(key, settings[key])
    showToast(ok ? `Saved ${key}` : `Failed to save ${key}`, ok ? 'success' : 'error')
    if (ok) await load()
  }

  async function handleSaveAll() {
    let allOk = true
    for (const key of Object.keys(settings)) {
      // D-02 (R2.1) + C1/Q8: key ที่มีฟอร์มเฉพาะทางห้ามเขียนจากทางนี้ (ทางบันทึกเดียว)
      if (TYPED_FORM_KEYS.has(key)) continue
      if (!(await setBusinessSetting(key, settings[key]))) allOk = false
    }
    showToast(allOk ? 'All settings saved' : 'Some settings failed', allOk ? 'success' : 'error')
    await load()
  }

  // Add a key to the EXISTING key/value editor (nothing persists until Save).
  // theater_daily_copy gets the 7-day starter template prefilled for review.
  function handleAddKey() {
    const key = newKey.trim()
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(key)) {
      showToast('Key ต้องเป็น a-z/0/_/ ขึ้นต้นด้วยตัวอักษร', 'error')
      return
    }
    if (key in settings) {
      showToast(`Key ${key} มีอยู่แล้ว`, 'error')
      return
    }
    const initial = key === THEATER_DAILY_COPY_KEY
      ? JSON.parse(JSON.stringify(THEATER_DAILY_COPY_STARTER))
      : {}
    setSettings({ ...settings, [key]: initial })
    setNewKey('')
    showToast(`เพิ่ม ${key} ในหน้านี้แล้ว — กด Save เพื่อบันทึกลง business_settings`, 'success')
  }

  // D2 (2026-10-25): ค่าส่ง/โซนย้ายไปศูนย์ขนส่งเดียว — DeliveryZonesPanel ที่ /admin/delivery?tab=fees

  // C3/Q1: brand editor ย้ายไป OrgHub (AdminBrands) ที่เดียว — เหลือลิงก์ด้านล่าง

  async function saveBranch() {
    if (!branch) return
    const { error } = await supabase
      .from('branches')
      .update({ service_radius_km: Number(branch.service_radius_km), operating_hours: branch.operating_hours, updated_at: new Date().toISOString() })
      .eq('id', branch.id)
    showToast(error ? `Branch failed: ${error.message}` : 'Saved branch', error ? 'error' : 'success')
    if (!error) await load()
  }

  // ลิงก์โซเชียล/LINE — แอดมินใส่เองได้ทีหลัง (คีย์ business_settings: social_links)
  // D-02 (R2.1): ฟอร์มนี้คือ "ทางบันทึกเดียว" ของ social_links — generic editor
  // ด้านบนถูกตัด key นี้ออกแล้ว (แก้ที่หนึ่งแล้วอีกที่เขียนทับ = บั๊กที่ Owner เจอ)
  async function saveSocials() {
    if (!socials) return
    const ok = await setBusinessSetting(SOCIAL_LINKS_SETTING_KEY, socials)
    showToast(ok ? 'บันทึก social_links แล้ว — ฟุตเตอร์อัปเดตทันที' : 'Failed to save social_links', ok ? 'success' : 'error')
    if (ok) await load()
  }

  // R12 (Owner 2026-10-28): SEO copy แก้ได้ที่นี่ (คีย์ business_settings: seo)
  // — หน้าแรก/meta/JSON-LD อ่านค่าจริงนี้ (fallback = ค่าจริงที่ Owner ยืนยันแล้ว)
  async function saveSeoCopy() {
    if (!seoCopy) return
    const ok = await setBusinessSetting(SEO_SETTINGS_KEY, seoCopy)
    showToast(ok ? 'บันทึก SEO copy แล้ว — หน้าแรก/meta อัปเดต (≤7 นาที/reload)' : 'Failed to save seo', ok ? 'success' : 'error')
    if (ok) await load()
  }

  // N1 (Owner 4-2 · R19): copy แถบสถานะ — เขียนเฉพาะ "ข้อความ" 4 บรรทัด
  // ไฟ 🟢/🔴 (sameDayOpen/preOrderOpen) ยังคำนวจากรอบจริงเสมอ = ห้าม override ผ่านคีย์นี้
  async function saveStatusCopy() {
    if (!statusCopy) return
    const ok = await setBusinessSetting(STORE_STATUS_COPY_KEY, statusCopy)
    showToast(ok ? 'บันทึก copy แถบสถานะแล้ว — หน้าแรกอัปเดตทันทีในเครื่องนี้ (ผู้ชมท่านอื่น ≤7 นาที/reload)' : 'Failed to save store_status_copy', ok ? 'success' : 'error')
    if (ok) {
      setStoreStatusCopyLive(statusCopy) // เห็นผลทันที (live store ของ strip)
      await load()
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">⚙️ Business Settings</h1>
        <Link to="/admin" className="btn btn-outline">← Dashboard</Link>
      </div>

      {/* ✅ Owner 2026-10-24: ค่า policy ตั้งจากฝั่งแอดมินได้ — ฟอร์มมีชนิดข้อมูล (order_policy) */}
      <OrderPolicyPanel />

      {loading ? (
        <div className="text-center py-12">Loading…</div>
      ) : Object.keys(settings).length === 0 ? (
        <div className="card text-center py-12 text-brand-muted">
          No settings seeded yet. Migration 008 seeds kitchen_location / delivery_policy / hours.
          Create keys below (JSON values).
        </div>
      ) : (
        <div className="space-y-4">
          {Object.keys(settings)
            // D-02 (R2.1) + C1/Q8 (audit): key ที่มีฟอร์มเฉพาะทาง (social_links/order_policy)
            // ห้ามโผล่ใน generic editor — "1 เรื่อง = 1 ที่ = ทางบันทึกเดียว"
            .filter((key) => !TYPED_FORM_KEYS.has(key))
            .map((key) => (
            <div key={key} className="card">
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-sm font-bold text-brand-accent">{key}</div>
                <button
                  onClick={() => setTextMode({ ...textMode, [key]: !textMode[key] })}
                  className="btn btn-outline text-sm"
                >
                  {textMode[key] ? 'Form' : 'JSON'}
                </button>
              </div>
              {textMode[key] ? (
                <textarea
                  className="input font-mono w-full"
                  rows={4}
                  value={JSON.stringify(settings[key], null, 2)}
                  onChange={(e) => {
                    try {
                      settings[key] = JSON.parse(e.target.value)
                      setSettings({ ...settings })
                    } catch {
                      // keep editing — show as-is
                    }
                  }}
                />
              ) : (
                <JsonForm value={settings[key]} onChange={(v) => setSettings({ ...settings, [key]: v })} />
              )}
              <button onClick={() => handleSave(key)} className="btn btn-success text-sm mt-2">💾 Save {key}</button>
            </div>
          ))}
          <button onClick={handleSaveAll} className="btn btn-primary w-full">💾 Save All Settings</button>
        </div>
      )}

      {/* Add a NEW key into the same editor — no separate CMS, persists only on Save */}
      {!loading && (
        <div className="card mt-4" data-testid="add-setting-key">
          <div className="font-mono text-sm font-bold text-brand-accent mb-2">➕ เพิ่ม key ใหม่</div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="เช่น theater_daily_copy"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddKey() }}
            />
            <button className="btn btn-outline" onClick={handleAddKey}>➕ เพิ่ม key</button>
          </div>
          <p className="text-xs text-brand-muted mt-2">
            เพิ่ม key ในหน้านี้ก่อน แล้วกด Save เพื่อเขียนลง business_settings —
            key <code>theater_daily_copy</code> จะถูกเติมเทมเพลตคัดลอก 7 วันให้ตรวจแก้ก่อนบันทึก
          </p>
        </div>
      )}

      {/* ===== FINAL CONFIG CLOSURE: canonical นอก business_settings (RLS admin manage) ===== */}
      <div className="space-y-4 mt-8" data-testid="admin-config-external">
        <h2 className="text-xl font-bold text-brand-accent">📱 โซเชียล & LINE (แสดงในฟุตเตอร์)</h2>
        {socials && (
          <div className="card" data-testid="social-links-config">
            <p className="text-xs text-brand-muted mb-2">
              ช่องที่เว้นว่าง = ไม่แสดงปุ่มนั้นในฟุตเตอร์ · ใส่ URL เต็ม (เช่น https://line.me/R/ti/p/@xxxx) ·
              LINE ID ใส่ได้ทีหลัง ระบบเก็บใน business_settings คีย์ <code>social_links</code>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {([
                ['facebook', 'Facebook (URL เต็ม)'],
                ['messenger', 'Messenger (URL เต็ม)'],
                ['line', 'LINE — ลิงก์เพิ่มเพื่อน (URL เต็ม)'],
                ['line_id', 'LINE ID (เช่น @bitemebaby)'],
                ['instagram', 'Instagram (URL)'],
                ['tiktok', 'TikTok (URL)'],
                ['youtube', 'YouTube (URL)'],
              ] as const).map(([field, label]) => (
                <label key={field} className="text-xs flex flex-col gap-1">{label}
                  <input
                    className="input"
                    value={socials[field] ?? ''}
                    onChange={(e) => setSocials({ ...socials, [field]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <button onClick={() => void saveSocials()} className="btn btn-success text-sm mt-2">💾 บันทึกลิงก์โซเชียล</button>
          </div>
        )}

        <h2 className="text-xl font-bold text-brand-accent">🔎 SEO / คำโปรยเว็บ</h2>
        {seoCopy && (
          <div className="card" data-testid="seo-copy-config">
            <p className="text-xs text-brand-muted mb-2">
              แก้คำโปรย SEO ของหน้าแรก (title tagline + meta description) — ค่าเดียวกับที่ Search/Crawler
              เห็นจากค่าจริงของร้าน (คีย์ <code>seo</code> · ผู้เยี่ยมชมเห็นอัตโนมัติ ≤7 นาที หรือ reload)
            </p>
            <label className="text-xs flex flex-col gap-1">
              tagline (ต่อท้ายชื่อหน้าแรก · ใช้ใน JSON-LD WebSite)
              <input
                className="input"
                value={seoCopy.tagline}
                onChange={(e) => setSeoCopy({ ...seoCopy, tagline: e.target.value })}
              />
            </label>
            <label className="text-xs flex flex-col gap-1 mt-2">
              description (meta description ของหน้าแรก)
              <textarea
                className="input w-full"
                rows={3}
                value={seoCopy.description}
                onChange={(e) => setSeoCopy({ ...seoCopy, description: e.target.value })}
              />
            </label>
            <button onClick={() => void saveSeoCopy()} className="btn btn-success text-sm mt-2">💾 บันทึก SEO copy</button>
          </div>
        )}

        {/* N1 (Owner 4-2 · R19): แถบสถานะหน้าแรก — แอดมินแก้ข้อความเองได้ · ไฟอัตโนมัติคงเดิม */}
        <h2 className="text-xl font-bold text-brand-accent">📣 แถบสถานะหน้าแรก (ข้อความ)</h2>
        {statusCopy && (
          <div className="card" data-testid="store-status-copy-config">
            <p className="text-xs text-brand-muted mb-2">
              แก้ข้อความแถบสถานะร้านได้เอง 4 บรรทัด — <strong>ไฟ 🟢/🔴 สองบรรทัดยังเปิด/ปิดอัตโนมัติจากรอบจริงเสมอ</strong>{' '}
              (เปลี่ยนจากที่นี่ไม่ได้) · ป้ายพรีออเดอร์ &quot;เปิดรับ … รอบ … (ปิดรอบ …)&quot; เป็นข้อมูลสดก็แก้ตรงนี้ไม่ได้{' '}
              (คีย์ <code>store_status_copy</code> · ผู้ชมเห็น ≤7 นาที หรือ reload)
            </p>
            <label className="text-xs flex flex-col gap-1">
              บรรทัดบน — เซมเดย์เปิด (🟢)
              <input
                className="input"
                data-testid="status-copy-sameday"
                value={statusCopy.sameDayOpen}
                onChange={(e) => setStatusCopy({ ...statusCopy, sameDayOpen: e.target.value })}
              />
            </label>
            <label className="text-xs flex flex-col gap-1 mt-2">
              บรรทัดบน — วันนี้ปิดรับ แต่ยังรับจองล่วงหน้าได้
              <input
                className="input"
                data-testid="status-copy-preorder-only"
                value={statusCopy.preOrderOnly}
                onChange={(e) => setStatusCopy({ ...statusCopy, preOrderOnly: e.target.value })}
              />
            </label>
            <label className="text-xs flex flex-col gap-1 mt-2">
              บรรทัดบน — ไม่มีรอบเปิดรับเลย (🔴)
              <input
                className="input"
                data-testid="status-copy-closed"
                value={statusCopy.closed}
                onChange={(e) => setStatusCopy({ ...statusCopy, closed: e.target.value })}
              />
            </label>
            <label className="text-xs flex flex-col gap-1 mt-2">
              บรรทัดล่าง — พรีออเดอร์ปิดรับแล้ว (🔴)
              <input
                className="input"
                data-testid="status-copy-preorder-closed"
                value={statusCopy.preOrderClosed}
                onChange={(e) => setStatusCopy({ ...statusCopy, preOrderClosed: e.target.value })}
              />
            </label>
            <button onClick={() => void saveStatusCopy()} className="btn btn-success text-sm mt-2">💾 บันทึกข้อความแถบสถานะ</button>
          </div>
        )}

        <h2 className="text-xl font-bold text-brand-accent">🚚 ค่าส่ง/โซน (อยู่ที่ศูนย์ขนส่ง)</h2>
        <div className="card text-sm" data-testid="zones-moved">
          จัดการค่าส่งตามระยะ (delivery_zones) ทั้งหมดที่{' '}
          <Link to="/admin/delivery?tab=fees" className="text-brand-primary font-semibold">การขนส่ง → แท็บค่าส่ง/โซน</Link>
          {' '}(D2 2026-10-25 — 1 เรื่อง = 1 ที่: งานขนส่งทั้งหมดอยู่ที่ศูนย์ขนส่งเดียว)
        </div>

        <h2 className="text-xl font-bold text-brand-accent">🎨 Brand</h2>
        <div className="card text-sm" data-testid="brand-config">
          จัดการชื่อแบรนด์/ธีม/ค่าเริ่มต้นทั้งหมดที่{' '}
          <Link to="/admin/tenants?tab=brands" className="text-brand-primary font-semibold">องค์กรและแบรนด์ → แท็บแบรนด์</Link>
          {' '}(audit D3/Q1 — 1 เรื่อง = 1 ที่: แก้ที่ OrgHub ที่เดียว)
        </div>

        <h2 className="text-xl font-bold text-brand-accent">🏬 Branch (รัศมี + เวลาสาขา)</h2>
        {branch && (
          <div className="card" data-testid="branch-config">
            <div className="grid grid-cols-2 gap-2 items-end">
              <label className="text-xs flex flex-col gap-1">service radius (กม.)
                <input className="input" value={String(branch.service_radius_km ?? '')}
                  onChange={(e) => setBranch({ ...branch, service_radius_km: /^-?\d+(\.\d+)?$/.test(e.target.value) ? Number(e.target.value) : e.target.value })} />
              </label>
              <button onClick={() => void saveBranch()} className="btn btn-success text-sm">💾 บันทึกสาขา</button>
            </div>
            <div className="text-xs font-mono text-brand-muted mt-2 mb-1">operating_hours (JSON)</div>
            <textarea className="input font-mono w-full" rows={3}
              value={JSON.stringify(branch.operating_hours ?? {}, null, 2)}
              onChange={(e) => { try { setBranch({ ...branch, operating_hours: JSON.parse(e.target.value) }) } catch { /* แก้ต่อไป */ } }} />
          </div>
        )}
      </div>
    </div>
  )
}

function JsonForm({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  if (typeof value !== 'object' || value === null) {
    return (
      <input
        className="input w-full"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.keys(value).map((k) => (
        <label key={k} className="text-xs flex flex-col gap-1">
          <span className="font-mono text-brand-muted">{k}</span>
          <input
            className="input"
            value={String(value[k] ?? '')}
            onChange={(e) => {
              const next = { ...value }
              const raw = e.target.value
              next[k] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw
              onChange(next)
            }}
          />
        </label>
      ))}
    </div>
  )
}