// ============================================
// Bite Me Baby Admin API — Business Settings (D15 gap)
// Phase D: DB-backed key/value settings (`business_settings` table).
// Seeded in migration 008 (kitchen_location / delivery_policy / hours).
// ============================================

import { supabase } from './supabase'

export async function getBusinessSettings(): Promise<Record<string, any>> {
  const { data, error } = await supabase.from('business_settings').select('*')
  if (error) { console.error('[getBusinessSettings] Error:', error); return {} }
  const out: Record<string, any> = {}
  for (const row of (data || []) as Array<{ key: string; value: any }>) {
    out[row.key] = typeof row.value === 'string' ? safeJson(row.value) : row.value
  }
  return out
}

export async function setBusinessSetting(key: string, value: any): Promise<boolean> {
  const { error } = await supabase
    .from('business_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) { console.error('[setBusinessSetting] Error:', error); return false }
  return true
}

function safeJson(v: string): any {
  try { return JSON.parse(v) } catch { return v }
}