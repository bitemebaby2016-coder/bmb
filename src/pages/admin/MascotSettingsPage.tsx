// ============================================
// Bite Me Baby — Admin Mascot Settings (ADM-07)
// Admin changes mascot art per role without changing code (mascot_overrides).
// ============================================

import { useEffect, useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { getMascotOverrides, upsertMascotOverride, MASCOT_ROLES, type MascotOverride } from '@/lib/mascotService'

export function MascotSettingsPage() {
  const [overrides, setOverrides] = useState<MascotOverride[]>([])
  const [form, setForm] = useState<Record<string, { url: string; alt: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)

  async function refresh() {
    const list = await getMascotOverrides()
    setOverrides(list)
    const next: Record<string, { url: string; alt: string }> = {}
    for (const role of MASCOT_ROLES) {
      const o = list.find((x) => x.role_name === role)
      next[role] = { url: o?.media_url ?? '', alt: o?.alt ?? '' }
    }
    setForm(next)
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function save(role: string) {
    setSaving(role)
    const f = form[role]
    await upsertMascotOverride(role, f.url.trim(), f.alt.trim())
    setSaving(null)
    await refresh()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-accent">🦖 Mascot Self-Service</h1>
        <button className="btn btn-outline text-sm" onClick={() => void refresh()}>🔄</button>
      </div>
      <p className="text-sm text-slate-500">
        วาง Media URL (จาก Admin Media Library ใน bucket <code>bmb-images</code>) ต่อบทบาทมาสคอต — หน้าเว็บใช้รูปใหม่ทันทีโดยไม่ต้องแก้ code
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MASCOT_ROLES.map((role) => (
          <GlassCard key={role} className="p-4">
            <h3 className="font-bold text-slate-700 text-sm mb-2">🤖 {role}</h3>
            <input
              className="input mb-1 text-xs"
              placeholder="Media URL (https://…)"
              value={form[role]?.url ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, [role]: { ...(p[role] ?? { alt: '' }), url: e.target.value } }))}
              data-testid={`mascot-url-${role}`}
            />
            <input
              className="input mb-2 text-xs"
              placeholder="Alt text (optional)"
              value={form[role]?.alt ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, [role]: { ...(p[role] ?? { url: '' }), alt: e.target.value } }))}
            />
            <button className="btn btn-primary text-xs w-full" disabled={saving === role} onClick={() => void save(role)}>
              {saving === role ? 'บันทึก…' : '💾 บันทึก'}
            </button>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}