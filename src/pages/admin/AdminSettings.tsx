// ============================================
// Admin — Business Settings (D15 gap, Phase D)
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'
import { supabase } from '@/lib/supabase'

export function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [textMode, setTextMode] = useState<Record<string, boolean>>({})
  // FINAL CONFIG CLOSURE: admin แก้ canonical นอก business_settings ได้โดยไม่ต้องแก้ code
  const [zones, setZones] = useState<any[] | null>(null)
  const [brand, setBrand] = useState<any>(null)
  const [branch, setBranch] = useState<any>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [s, z, b, br] = await Promise.all([
      getBusinessSettings(),
      supabase.from('delivery_zones').select('*').order('min_distance_km'),
      supabase.from('brands').select('id, display_name, name, theme_tokens').eq('is_default', true).maybeSingle(),
      supabase.from('branches').select('id, display_name, name, service_radius_km, operating_hours').eq('is_default', true).maybeSingle(),
    ])
    setSettings(s)
    setZones(z.data ?? [])
    setBrand(b.data ?? null)
    setBranch(br.data ?? null)
    setLoading(false)
  }

  async function handleSave(key: string) {
    const ok = await setBusinessSetting(key, settings[key])
    showToast(ok ? `Saved ${key}` : `Failed to save ${key}`, ok ? 'success' : 'error')
    if (ok) await load()
  }

  async function handleSaveAll() {
    let allOk = true
    for (const key of Object.keys(settings)) {
      if (!(await setBusinessSetting(key, settings[key]))) allOk = false
    }
    showToast(allOk ? 'All settings saved' : 'Some settings failed', allOk ? 'success' : 'error')
    await load()
  }

  async function saveZone(z: any) {
    const row = {
      ...z,
      min_distance_km: Number(z.min_distance_km),
      max_distance_km: Number(z.max_distance_km),
      fee: Number(z.fee),
    }
    const { error } = await supabase.from('delivery_zones').upsert(row, { onConflict: 'id' })
    showToast(error ? `Zone failed: ${error.message}` : `Saved zone ${row.name}`, error ? 'error' : 'success')
    if (!error) await load()
  }

  async function saveBrand() {
    if (!brand) return
    const { error } = await supabase
      .from('brands')
      .update({ display_name: brand.display_name, theme_tokens: brand.theme_tokens, updated_at: new Date().toISOString() })
      .eq('id', brand.id)
    showToast(error ? `Brand failed: ${error.message}` : 'Saved brand', error ? 'error' : 'success')
    if (!error) await load()
  }

  async function saveBranch() {
    if (!branch) return
    const { error } = await supabase
      .from('branches')
      .update({ service_radius_km: Number(branch.service_radius_km), operating_hours: branch.operating_hours, updated_at: new Date().toISOString() })
      .eq('id', branch.id)
    showToast(error ? `Branch failed: ${error.message}` : 'Saved branch', error ? 'error' : 'success')
    if (!error) await load()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">⚙️ Business Settings</h1>
        <Link to="/admin" className="btn btn-outline">← Dashboard</Link>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading…</div>
      ) : Object.keys(settings).length === 0 ? (
        <div className="card text-center py-12 text-brand-muted">
          No settings seeded yet. Migration 008 seeds kitchen_location / delivery_policy / hours.
          Create keys below (JSON values).
        </div>
      ) : (
        <div className="space-y-4">
          {Object.keys(settings).map((key) => (
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

      {/* ===== FINAL CONFIG CLOSURE: canonical นอก business_settings (RLS admin manage) ===== */}
      <div className="space-y-4 mt-8" data-testid="admin-config-external">
        <h2 className="text-xl font-bold text-brand-accent">🚚 Delivery Zones (ค่าส่ง — delivery_zones)</h2>
        {(zones ?? []).map((z) => (
          <div key={z.id} className="card" data-testid={`zone-${z.id}`}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
              <label className="text-xs flex flex-col gap-1">ชื่อโซน
                <input className="input" value={z.name ?? ''}
                  onChange={(e) => setZones((zs) => (zs ?? []).map((x) => x.id === z.id ? { ...x, name: e.target.value } : x))} />
              </label>
              <label className="text-xs flex flex-col gap-1">จาก (กม.)
                <input className="input" value={String(z.min_distance_km ?? '')}
                  onChange={(e) => setZones((zs) => (zs ?? []).map((x) => x.id === z.id ? { ...x, min_distance_km: /^-?\d+(\.\d+)?$/.test(e.target.value) ? Number(e.target.value) : e.target.value } : x))} />
              </label>
              <label className="text-xs flex flex-col gap-1">ถึง (กม.)
                <input className="input" value={String(z.max_distance_km ?? '')}
                  onChange={(e) => setZones((zs) => (zs ?? []).map((x) => x.id === z.id ? { ...x, max_distance_km: /^-?\d+(\.\d+)?$/.test(e.target.value) ? Number(e.target.value) : e.target.value } : x))} />
              </label>
              <label className="text-xs flex flex-col gap-1">ค่าส่ง (฿)
                <input className="input" value={String(z.fee ?? '')}
                  onChange={(e) => setZones((zs) => (zs ?? []).map((x) => x.id === z.id ? { ...x, fee: /^-?\d+(\.\d+)?$/.test(e.target.value) ? Number(e.target.value) : e.target.value } : x))} />
              </label>
              <button onClick={() => void saveZone(z)} className="btn btn-success text-sm">💾 บันทึกโซน</button>
            </div>
          </div>
        ))}

        <h2 className="text-xl font-bold text-brand-accent">🎨 Brand (ชื่อ + ธีม glass)</h2>
        {brand && (
          <div className="card" data-testid="brand-config">
            <label className="text-xs flex flex-col gap-1 mb-2">ชื่อแบรนด์
              <input className="input" value={brand.display_name ?? ''}
                onChange={(e) => setBrand({ ...brand, display_name: e.target.value })} />
            </label>
            <div className="text-xs font-mono text-brand-muted mb-1">theme_tokens (JSON — key `glass` คุมพื้นหลัง/blur/ขอบ/ตัวอักษร/เงา)</div>
            <textarea className="input font-mono w-full" rows={5}
              value={JSON.stringify(brand.theme_tokens ?? {}, null, 2)}
              onChange={(e) => { try { setBrand({ ...brand, theme_tokens: JSON.parse(e.target.value) }) } catch { /* แก้ต่อไป */ } }} />
            <button onClick={() => void saveBrand()} className="btn btn-success text-sm mt-2">💾 บันทึกแบรนด์</button>
          </div>
        )}

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