// ============================================
// Bite Me Baby — AI Context Builder (AI-EXT Phase)
// Assembles live store data for น้อง Bite / Content Studio:
//   a) Active Branch (public ?branch= param, falls back to default branch)
//   b) Catalog snapshot (M092 branch-aware availability)
//   c) Current Delivery Rounds (today + tomorrow, branch-scoped)
// Returns a compact text block injected as the AI system context.
// ============================================

import { supabase } from '../supabase'

export interface AiStoreContext {
  branchId: string | null
  branchName: string
  branchLat: number | null
  branchLng: number | null
  productLines: string[]
  roundLines: string[]
  rendered: string
}

const fmtRounds = (rows: any[]): string[] =>
  rows.map((r: any) =>
    `- ${r.round_key} ${r.display_name} (cutoff ${r.cutoff_time}, capacity ${r.current_count}/${r.max_capacity}, ${r.status})`
  )

const fmtProducts = (rows: any[]): string[] =>
  rows.map((p: any) =>
    `- ${p.name} ฿${Number(p.price).toFixed(0)} [${p.available_same_day ? 'SAME_DAY' : ''}${p.available_preorder ? ' PRE_ORDER' : ''}]${p.description ? ' — ' + p.description : ''}`
  )

// AI-OPT: In-memory context cache (TTL 12 min) — avoids re-querying Supabase
// (branches + products + delivery_rounds) on every new chat message. The store
// data changes rarely (menu edits, round seeding), so a short-TTL cache is safe
// and callers can force a refresh via invalidateAiContextCache().
const CONTEXT_TTL_MS = 12 * 60 * 1000
let ctxCache: { at: number; value: AiStoreContext } | null = null

export function invalidateAiContextCache(): void {
  ctxCache = null
}

export function getAiContextCacheAgeMs(): number | null {
  return ctxCache ? Date.now() - ctxCache.at : null
}

export async function buildAiStoreContext(forceRefresh = false): Promise<AiStoreContext> {
  if (!forceRefresh && ctxCache && Date.now() - ctxCache.at < CONTEXT_TTL_MS) {
    return ctxCache.value
  }
  const built = await buildAiStoreContextFresh()
  ctxCache = { at: Date.now(), value: built }
  return built
}

async function buildAiStoreContextFresh(): Promise<AiStoreContext> {
  // 1) Resolve branch: URL ?branch=<slug> first, else tenant default
  let branchId: string | null = null
  let branchName = 'BMB Central (สาขาหลัก)'
  let branchLat: number | null = null
  let branchLng: number | null = null
  try {
    const slug = new URLSearchParams(window.location.search).get('branch')
    let q = supabase.from('branches').select('id,name,latitude,longitude,is_default').eq('status', 'active')
    if (slug) q = q.eq('slug', slug)
    const { data } = await (slug ? q : q.eq('is_default', true)).limit(1)
    const b = (data as any[])?.[0]
    if (b) {
      branchId = b.id
      branchName = b.name
      branchLat = b.latitude ?? null
      branchLng = b.longitude ?? null
    }
  } catch { /* context is best-effort — never block chat */ }

  // 2) Catalog snapshot (public read, active only, max 20 lines)
  const productLines: string[] = []
  try {
    const { data } = await supabase
      .from('products')
      .select('name,price,description,available_same_day,available_preorder,is_available')
      .eq('is_available', true)
      .order('sort_order')
      .limit(20)
    if (data) productLines.push(...fmtProducts(data as any[]))
  } catch { /* skip */ }

  // 3) Delivery rounds: today + tomorrow for this branch
  const roundLines: string[] = []
  try {
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    let q = supabase
      .from('delivery_rounds')
      .select('round_key,display_name,cutoff_time,delivery_start,delivery_end,max_capacity,current_count,status,scheduled_date')
      .in('scheduled_date', [today, tomorrow])
      .eq('status', 'active')
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q.order('scheduled_date').order('delivery_start')
    if (data) roundLines.push(...fmtRounds(data as any[]))
  } catch { /* skip */ }

  const rendered = [
    `ACTIVE BRANCH: ${branchName}${branchId ? ` (id=${branchId})` : ''}`,
    branchLat != null && branchLng != null ? `BRANCH LOCATION: ${branchLat},${branchLng}` : '',
    '',
    'MENU (currently available):',
    ...(productLines.length ? productLines : ['- (menu data unavailable right now)']),
    '',
    'DELIVERY ROUNDS (today/tomorrow):',
    ...(roundLines.length ? roundLines : ['- (rounds not seeded yet)']),
    '',
    'RULES: Use ONLY the data above for menu/price/round answers. If an item or round is not listed, say it is not available today and suggest checking the menu page.',
  ].filter(Boolean).join('\n')

  return { branchId, branchName, branchLat, branchLng, productLines, roundLines, rendered }
}