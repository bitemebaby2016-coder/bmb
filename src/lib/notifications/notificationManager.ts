// ============================================
// Bite Me Baby — Notification Manager (R48 · Unified Notification Abstraction — client side)
// ============================================
// Owner: "สร้าง Notification Service กลาง (Abstraction Layer) ที่รับ Event แล้วกระจาย
//         ตาม Channel Availability"
// หน้าที่ client = แค่ ① อ่าน flags ② ผูก channel identity (PSID) ③ emit event เข้า outbox —
// การกระจายช่องทาง (web_push → messenger → line) = server (notification-dispatcher) ที่เดียว
// ไม่เขียนโค้ดซ้ำ: push transport ใช้ pushService เดิม (enablePush) ไม่ duplicate
// ============================================

import { supabase } from '@/lib/supabase'
import { enablePush, getPushPermissionState, type PushResult } from '@/lib/pushService'

export type NotifyEventCategory = 'Transactional' | 'Marketing' | 'Bite' | 'Operational'

export interface NotifyEventInput {
  /** idempotency key — ซ้ำ = ไม่สร้างแถวใหม่ (กัน loop/แจ้งซ้ำ) ตัวอย่าง: `ord-123-confirmed` */
  key: string
  title: string
  body?: string
  category?: NotifyEventCategory
  url?: string
}

export interface ChannelFlags {
  push: boolean
  messenger: boolean
  line: boolean
  /** 'disabled'|'mock' = LINE ยังไม่อนุมัติ (บันทึกสถานะ) · 'live' = ส่งจริง */
  lineMode: 'disabled' | 'mock' | 'live'
}

export const DEFAULT_FLAGS: ChannelFlags = { push: true, messenger: true, line: false, lineMode: 'mock' }

/** อ่าน feature flags จาก business_settings.notification_channels (m164 = anon read) — ค่าหาย = default */
export async function getChannelFlags(): Promise<ChannelFlags> {
  try {
    const { data, error } = await supabase.from('business_settings').select('value').eq('key', 'notification_channels').maybeSingle()
    if (error || !data?.value) return DEFAULT_FLAGS
    const o = (data.value ?? {}) as Record<string, unknown>
    const lineMode = o.lineMode === 'live' ? 'live' : o.lineMode === 'disabled' ? 'disabled' : 'mock'
    return {
      push: typeof o.push === 'boolean' ? o.push : DEFAULT_FLAGS.push,
      messenger: typeof o.messenger === 'boolean' ? o.messenger : DEFAULT_FLAGS.messenger,
      line: lineMode === 'live',
      lineMode,
    }
  } catch { return DEFAULT_FLAGS }
}

/** ผูกตัวตนช่องทาง (FB PSID / LINE userId) กับบัญชีลูกค้า — server resolve customer จาก JWT (m179) */
export async function registerChannelIdentity(
  channel: 'messenger' | 'line',
  externalId: string,
  source = 'client',
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('register_channel_identity', {
      p_channel: channel,
      p_external_id: externalId,
      p_source: source,
    } as never)
    if (error) return { ok: false, error: error.message }
    const j = (data ?? {}) as { ok?: boolean; error?: string }
    return j.ok ? { ok: true } : { ok: false, error: j.error || 'ERR_REGISTER_FAILED' }
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e).slice(0, 120) }
  }
}

/** ยิง event เข้า notification_outbox (idempotent) — server จะกระจายเองตาม flags/availability */
export async function emitNotification(ev: NotifyEventInput): Promise<{ ok: boolean; inserted?: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('enqueue_notification', {
      p_event_key: ev.key,
      p_customer_id: null,
      p_category: ev.category || 'Transactional',
      p_title: ev.title,
      p_body: ev.body || '',
      p_url: ev.url ?? null,
    } as never)
    if (error) return { ok: false, error: error.message }
    const j = (data ?? {}) as { ok?: boolean; inserted?: boolean; error?: string }
    return j.ok ? { ok: true, inserted: !!j.inserted } : { ok: false, error: j.error || 'ERR_ENQUEUE_FAILED' }
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e).slice(0, 120) }
  }
}

// push transport = ของเดิม (m115/pushService) — re-export ให้ caller เดียวไม่ต้อง import สองที่
export { enablePush, getPushPermissionState, type PushResult }