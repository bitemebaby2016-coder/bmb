// ============================================
// Bite Me Baby Admin API — Business Settings (D15 gap)
// Phase D: DB-backed key/value settings (`business_settings` table).
// Seeded in migration 008 (kitchen_location / delivery_policy / hours).
// ============================================

import { supabase } from './supabase'
import type { FloatingAdConfig, FloatingAdSourceConfig, FloatingAdItem } from '@/types'

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

const DEFAULT_FLOATING_AD_CONFIG: FloatingAdConfig = {
  enabled: true,
  maxCount: 3,
  sources: {
    promotions: { enabled: true, maxItems: 3 },
    posts: { enabled: true, maxItems: 3 },
    products: { enabled: true, maxItems: 3 },
  },
}

// CANONICAL = floating_ad_config.items (FloatingAdTab). legacy keys (enabled/sources/image)
// เก็บไว้เป็น default เท่านั้น — items ว่าง = แสดงอะไรเลย (ไม่มี seed จาก flag อัตโนมัติ)
function migrateLegacyFloatingAd(settings: Record<string, any>): FloatingAdConfig {
  const legacyEnabled = settings.floating_ad_enabled ?? true
  const legacySources = settings.floating_ad_sources ?? []
  const legacyImage = settings.floating_ad_image

  const sourceConfig: FloatingAdConfig['sources'] = {
    promotions: { enabled: legacySources.includes('floating_promotions'), maxItems: 3 },
    posts: { enabled: legacySources.includes('floating_posts'), maxItems: 3 },
    products: { enabled: legacySources.includes('floating_products'), maxItems: 3 },
  }

  return {
    enabled: legacyEnabled,
    maxCount: 3,
    backgroundImage: legacyImage,
    sources: sourceConfig,
  }
}

export async function getFloatingAdConfig(): Promise<FloatingAdConfig> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('key, value')
    .in('key', ['floating_ad_config', 'floating_ad_enabled', 'floating_ad_sources', 'floating_ad_image'])

  if (error) {
    console.error('[getFloatingAdConfig] Error:', error)
    return DEFAULT_FLOATING_AD_CONFIG
  }

  const settings: Record<string, any> = {}
  for (const row of (data || []) as Array<{ key: string; value: any }>) {
    settings[row.key] = typeof row.value === 'string' ? safeJson(row.value) : row.value
  }

  if (settings.floating_ad_config) {
    const cfg = settings.floating_ad_config as FloatingAdConfig
    return {
      enabled: cfg.enabled ?? true,
      maxCount: cfg.maxCount ?? 3,
      backgroundImage: cfg.backgroundImage,
      sources: {
        promotions: cfg.sources?.promotions ?? { enabled: true, maxItems: 3 },
        posts: cfg.sources?.posts ?? { enabled: true, maxItems: 3 },
        products: cfg.sources?.products ?? { enabled: true, maxItems: 3 },
      },
      items: cfg.items,
    }
  }

  return migrateLegacyFloatingAd(settings)
}

export async function setFloatingAdConfig(config: FloatingAdConfig): Promise<boolean> {
  const payload: FloatingAdConfig = {
    enabled: config.enabled ?? true,
    maxCount: Math.min(Math.max(config.maxCount ?? 3, 1), 5),
    backgroundImage: config.backgroundImage,
    sources: {
      promotions: config.sources?.promotions ?? { enabled: true, maxItems: 3 },
      posts: config.sources?.posts ?? { enabled: true, maxItems: 3 },
      products: config.sources?.products ?? { enabled: true, maxItems: 3 },
    },
    items: config.items?.map((item, idx) => ({ ...item, order: idx })) ?? [],
  }

  const { error } = await supabase
    .from('business_settings')
    .upsert(
      { key: 'floating_ad_config', value: payload, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

  if (error) {
    console.error('[setFloatingAdConfig] Error:', error)
    return false
  }
  return true
}