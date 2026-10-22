// ============================================
// Bite Me Baby — adminMarketing (Part C · 2026-10-22)
// ============================================
// API ชั้นเดียวของ AdminMarketing — ทุกฟังก์ชันต่อของจริงเท่านั้น:
//   · โพสต์  = marketing_posts (137) + content_approvals (022/126 เดิม)
//   · อนุมัติ = reviewContent ของเดิม (คนเท่านั้น — ห้าม auto-publish)
//   · ตั้งเวลา = marketing_schedule_post (137 — บังคับ approval='approved')
//   · กติกา = marketing_rules ผ่าน marketing_save_rules (ไม่ hardcode ฝั่ง UI)
//   · ตัวเลข Planner = order_items จริง (best-seller จริง ไม่มีข้อมูลปลอม)
// ============================================

import { supabase } from './supabase'
import { submitContentForApproval, type ContentType } from './contentApproval'

export type MarketingPostStatus = 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'published' | 'failed'

export interface MarketingPostRow {
  id: string
  approval_id: string | null
  title: string
  body: string
  content_type: ContentType
  image_urls: string[]
  objective: string
  status: MarketingPostStatus
  scheduled_for: string | null
  provider_post_id: string | null
  error: string | null
  publish_attempts: number
  created_at: string
  published_at: string | null
}

export interface MarketingRules {
  frequency_per_week: number
  publishing_window: { start: string; end: string }
  content_mix: Record<string, number>
  menu_rules: Record<string, unknown>
  cooldown_hours: number
  stop_conditions: Record<string, unknown>
}

const POST_FIELDS = 'id,approval_id,title,body,content_type,image_urls,objective,status,scheduled_for,provider_post_id,error,publish_attempts,created_at,published_at'

export async function listMarketingPosts(): Promise<MarketingPostRow[]> {
  const { data, error } = await supabase
    .from('marketing_posts')
    .select(POST_FIELDS)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return []
  return (data ?? []) as MarketingPostRow[]
}

/** สร้างโพสต์: สร้าง content_approval (คนอนุมัติภายหลัง) + ผูก marketing_posts */
export async function createMarketingPost(input: {
  title: string
  body: string
  content_type: ContentType
  objective?: string
  image_urls?: string[]
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const approvalId = await submitContentForApproval(
    input.content_type,
    input.title,
    input.body,
    input.image_urls?.[0],
  )
  if (!approvalId) return { ok: false, error: 'ERR_SUBMIT_FAILED' }
  const id = 'mk-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
  const { error } = await supabase.from('marketing_posts').insert({
    id,
    approval_id: approvalId,
    title: input.title,
    body: input.body,
    content_type: input.content_type,
    image_urls: input.image_urls ?? [],
    objective: input.objective ?? 'reach',
    status: 'pending_approval',
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, id }
}

/** ตั้งเวลาเผยแพร่ — server บังคับว่าคนต้องอนุมัติแล้ว (ERR_APPROVAL_REQUIRED) */
export async function scheduleMarketingPost(id: string, whenIso: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('marketing_schedule_post', { p_post_id: id, p_when: whenIso })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function getMarketingRules(): Promise<MarketingRules | null> {
  const { data, error } = await supabase.from('marketing_rules').select('*').eq('id', 'default').maybeSingle()
  if (error || !data) return null
  return data as unknown as MarketingRules
}

export async function saveMarketingRules(rules: Partial<MarketingRules>): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('marketing_save_rules', { p_rules: rules })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** best-seller จริงจาก order_items (ใช้เลือกสินค้าใน Content Planner — ไม่มีข้อมูลปลอม) */
export async function bestSellerProducts(limit = 8): Promise<Array<{ product_id: string; product_name: string; units: number }>> {
  const { data, error } = await supabase
    .from('order_items')
    .select('product_id, product_name, quantity')
    .limit(2000)
  if (error || !data) return []
  const byProduct = new Map<string, { product_id: string; product_name: string; units: number }>()
  for (const row of data as Array<{ product_id: string; product_name: string; quantity: number }>) {
    const hit = byProduct.get(row.product_id) ?? { product_id: row.product_id, product_name: row.product_name, units: 0 }
    hit.units += Number(row.quantity || 0)
    byProduct.set(row.product_id, hit)
  }
  return [...byProduct.values()].sort((a, b) => b.units - a.units).slice(0, limit)
}

/** ตัวเลขภาพรวม (Overview) — นับจากแถวจริงทั้งหมด */
export async function marketingStats(): Promise<Record<MarketingPostStatus, number>> {
  const out: Record<MarketingPostStatus, number> = { draft: 0, pending_approval: 0, approved: 0, scheduled: 0, published: 0, failed: 0 }
  for (const p of await listMarketingPosts()) out[p.status] = (out[p.status] ?? 0) + 1
  return out
}