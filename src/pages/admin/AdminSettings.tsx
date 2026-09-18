// ============================================
// Admin — Business Settings (D15 gap, Phase D)
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'

export function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [textMode, setTextMode] = useState<Record<string, boolean>>({})

  useEffect(() => { load() }, [])

  async function load() {
    setSettings(await getBusinessSettings())
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