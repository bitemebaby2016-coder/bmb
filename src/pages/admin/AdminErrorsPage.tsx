// ============================================
// Bite Me Baby — Admin Errors feed (ADM-01)
// Reads system_errors (client/webhook/EF) — admins see failures in real time.
// ============================================

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GlassCard } from '@/components/ui/GlassCard'

interface SystemErrorRow {
  id: string
  source: string
  level: string
  message: string
  created_at: string
}

const LEVEL_COLOR: Record<string, string> = {
  info: 'bg-sky-100 text-sky-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-rose-100 text-rose-700',
  critical: 'bg-red-600 text-white',
}

export function AdminErrorsPage() {
  const [errors, setErrors] = useState<SystemErrorRow[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    const { data, error } = await supabase.rpc('list_system_errors', { p_limit: 60 })
    if (!error && data) setErrors((data as unknown as { errors: SystemErrorRow[] }).errors ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), 30000) // auto-refresh < 5 min cadence (30s)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-accent">🛠️ Errors &amp; Exceptions</h1>
        <button className="btn btn-outline text-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'โหลด…' : '🔄 รีเฟรช'}
        </button>
      </div>

      {errors.length === 0 && <GlassCard className="p-5 text-center text-slate-400">ไม่มีข้อผิดพลาดล่าสุด ✅</GlassCard>}

      <div className="space-y-2">
        {errors.map((e) => (
          <GlassCard key={e.id} className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_COLOR[e.level] || 'bg-slate-100 text-slate-600'}`}>{e.level}</span>
              <span className="text-[10px] text-slate-400">{e.source}</span>
              <span className="text-[10px] text-slate-400 ml-auto">{new Date(e.created_at).toLocaleString('th-TH')}</span>
            </div>
            <p className="text-sm text-slate-700 break-words">{e.message.slice(0, 500)}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}