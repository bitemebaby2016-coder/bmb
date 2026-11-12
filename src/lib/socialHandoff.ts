// ============================================
// Bite Me Baby — Social Handoff Context (R91 · Owner 2026-11-11)
// ============================================
// "บริบทจากเฟซบุ๊กต้องต่อเข้า Bite AI ของเว็บให้เหมือนกันและต่อเนื่อง"
//
// หลักการ: ลูกค้าคุยกับ Bite บน Facebook/Messenger → AI แนบลิงก์ /shop?cart=...
// → ลูกค้ากดเข้าเว็บ → Layout เติมตะกร้า และ **บันทึกว่าลูกค้ามาจากโซเชียล**
// (sessionStorage, จบแท็บแล้วล้าง) → TalkToBite รวมบริบทนี้เข้า runtimeContext
// ทุกข้อความ = Bite บนเว็บรู้รายการที่คุย/สรุปไว้ก่อนหน้า ต่อสนทนาทันที ไม่ถามซ้ำ
//
// สุจริตข้อมูล: เก็บเฉพาะ id/จำนวนที่มากับลิงก์ (เดียวกับ ?cart= — ไม่มีราคา/PII)
// ชื่อเมนูแสดงเมื่อ match กับ cart store จริงเท่านั้น (ห้ามมโนชื่อ)
// ============================================

export const SOCIAL_HANDOFF_KEY = 'bmb:social-handoff'
export const SOCIAL_CONTEXT_MAX = 200

export type SocialSource = 'facebook' | 'messenger' | 'other'

/** R96 Phase 2: Cross-channel timeline entry */
export interface SocialHandoffTimelineEntry {
  channel: 'facebook_post' | 'facebook_comment' | 'messenger' | 'web'
  topic?: string
  product_ids?: string[]
  time: number
  summary: string
}

/** R96 Phase 2: Extended handoff with timeline */
export interface ExtendedSocialHandoff {
  source: 'facebook' | 'messenger' | 'web'
  ids: Array<{ id: string; q: number }>
  at: number
  /** R92: ประโยคสรุป "ระบบเขียน" ที่มากับลิงก์ ?s= (≤200 chars · ไม่มี URL) — ถ้ามี */
  summary?: string
  /** R96 Phase 2: Timeline of cross-channel interactions */
  timeline: SocialHandoffTimelineEntry[]
}

// For backward compatibility
export interface SocialHandoff {
  source: 'facebook' | 'messenger'
  ids: Array<{ id: string; q: number }>
  at: number
  /** R92: ประโยคสรุป "ระบบเขียน" ที่มากับลิงก์ ?s= (≤200 chars · ไม่มี URL) — ถ้ามี */
  summary?: string
}

/** R92 pure — ถอด `s` จากลิงก์ (?s=<b64url(JSON {v:1,src,t})>) → {src, summary} | null.
 *  fail-closed: v ไม่ใช่ 1 / src ไม่รู้จัก / t ว่างหรือเกิน 200 หรือมี URL = null (กัน prompt-injection/PII) */
export function decodeSocialContextParam(raw: string | null | undefined): { src: 'facebook' | 'messenger'; summary: string } | null {
  if (!raw || typeof raw !== 'string') return null
  try {
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(padded + (padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))))
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
    const parsed = JSON.parse(json) as { v?: unknown; src?: unknown; t?: unknown }
    if (!parsed || parsed.v !== 1) return null
    const src = parsed.src === 'facebook' || parsed.src === 'messenger' ? parsed.src : null
    const t = typeof parsed.t === 'string' ? parsed.t.trim() : ''
    if (!src || !t || t.length > SOCIAL_CONTEXT_MAX || /https?:\/\//i.test(t)) return null
    return { src, summary: t }
  } catch {
    return null
  }
}

/** Pure — จำแนกแหล่งที่มา จาก referrer + UA ผสมกัน (FB/Messenger in-app → web)
 *  Messenger UA มี token `FB_IAB/MESSENGER`; แอปเฟซธรรมดาเป็น FBAN/FBAV */
export function detectSocialSource(referrer: string): SocialSource {
  const r = (referrer || '').toLowerCase()
  // ลำดับสำคัญ: ตรวจ messenger ก่อน — UA Messenger มีทั้ง FBAV/FB_IAB และ MESSENGER
  if (r.includes('messenger') || r.includes('fb.me')) return 'messenger'
  if (r.includes('facebook') || r.includes('fb.com') || r.includes('fb4a') || r.includes('fb_iab') || r.includes('fban') || r.includes('fbav')) return 'facebook'
  return 'other'
}

/** R96 Phase 2: Map channel string to timeline entry channel */
function mapChannelToTimeline(channel: string): SocialHandoffTimelineEntry['channel'] {
  switch (channel) {
    case 'facebook_post': return 'facebook_post'
    case 'facebook_comment': return 'facebook_comment'
    case 'messenger': return 'messenger'
    case 'web': return 'web'
    default: return 'web'
  }
}

/** บันทึก handoff (เฉพาะเมื่อมาจากโซเชียล) — storage พัง = เงียบ ไม่บล็อก flow
 *  R92: summary = ประโยคสรุปจาก ?s= (ผ่าน decodeSocialContextParam แล้ว — cap 200 อีกชั้น)
 *  R96 Phase 2: Also append to timeline for cross-channel context */
export function saveSocialHandoff(
  source: SocialSource,
  ids: Array<{ id: string; q: number }>,
  summary?: string,
  channel?: string, // R96: specific channel for timeline
  topic?: string,   // R96: conversation topic
  productIds?: string[], // R96: product IDs discussed
): void {
  if (source === 'other' || ids.length === 0) return
  const cap = typeof summary === 'string' && summary.trim() && !/https?:\/\//i.test(summary)
    ? summary.trim().slice(0, SOCIAL_CONTEXT_MAX)
    : undefined
  
  // R96 Phase 2: Build timeline entry
  const timelineEntry: SocialHandoffTimelineEntry = {
    channel: channel ? mapChannelToTimeline(channel) : (source === 'messenger' ? 'messenger' : 'facebook_comment'),
    topic,
    product_ids: productIds,
    time: Date.now(),
    summary: cap || summary || 'ลูกค้าคุยกับ Bite',
  }
  
  try {
    // Read existing handoff for timeline
    let existingHandoff: ExtendedSocialHandoff | null = null
    try {
      const raw = sessionStorage.getItem(SOCIAL_HANDOFF_KEY)
      if (raw) existingHandoff = JSON.parse(raw) as ExtendedSocialHandoff
    } catch { /* ignore */ }
    
    const timeline = [...(existingHandoff?.timeline || []), timelineEntry].slice(-10) // Keep last 10
    
    const extendedHandoff: ExtendedSocialHandoff = {
      source: source === 'facebook' ? 'facebook' : source === 'messenger' ? 'messenger' : 'web',
      ids,
      at: Date.now(),
      ...(cap ? { summary: cap } : {}),
      timeline,
    }
    
    sessionStorage.setItem(SOCIAL_HANDOFF_KEY, JSON.stringify(extendedHandoff))
  } catch { /* บล็อก/โหมดส่วนตั — ไม่มี handoff = AI ใช้บริบทปกติ */ }
}

export function readSocialHandoff(): ExtendedSocialHandoff | null {
  try {
    const raw = sessionStorage.getItem(SOCIAL_HANDOFF_KEY)
    if (!raw) return null
    const h = JSON.parse(raw) as ExtendedSocialHandoff
    if (!h || (h.source !== 'facebook' && h.source !== 'messenger' && h.source !== 'web') || !Array.isArray(h.ids)) return null
    // R92: summary เสีย/มี URL (ของเก่าหรือถูกแก้) = ทิ้ง field นั้น ไม่ทำให้ handoff ทั้งก้อนพัง
    if (typeof h.summary !== 'string' || h.summary.length > SOCIAL_CONTEXT_MAX || /https?:\/\//i.test(h.summary)) delete h.summary
    // Ensure timeline exists
    if (!Array.isArray(h.timeline)) h.timeline = []
    return h
  } catch {
    return null
  }
}

/**
 * R96 Phase 2: Read timeline only
 */
export function readSocialHandoffTimeline(): SocialHandoffTimelineEntry[] {
  const h = readSocialHandoff()
  return h?.timeline || []
}

/**
 * Pure — สร้างประโยคบริบทต่อสนทนาให้ TalkToBite ยัดเข้า runtimeContext
 * `cartItems` = ของจริงจาก cart store (Layout เติมไว้จากลิงก์เดียวกัน) — ใช้ยืนยันชื่อเมนู
 * คืน '' เมื่อไม่มี handoff (บริบทเว็บปกติ ไม่ inject อะไรเลย)
 * R96 Phase 2: Include timeline for cross-channel context
 */
export function buildSocialHandoffContext(
  cartItems: Array<{ product: { id: string; name: string }; quantity: number }>,
  handoff: ExtendedSocialHandoff | null = readSocialHandoff(),
): string {
  if (!handoff) return ''
  const label = handoff.source === 'messenger' ? 'Messenger' : 'Facebook'
  // R92 (Owner 2026-11-11): ประโยคแรก = สรุป "ระบบเขียน" จาก ?s= ของลิงก์ (ช่องทาง+รอบ+ชื่อรายการจริง
  // ฝั่ง server) — ทำให้ Bite รู้ "คุยเรื่องอะไรไว้" แม้ชื่อใน summary ยังไม่ได้อยู่ในตะกร้าก็ไม่มโน
  const summaryLine = handoff.summary ? `ต่อจากที่คุยกันใน${label}: ${handoff.summary}` : ''
  const names = handoff.ids
    .map((h) => {
      const match = cartItems.find((c) => c.product.id === h.id)
      if (!match) return null
      const q = h.q > 1 ? h.q : match.quantity
      return `${match.product.name} x${q}`
    })
    .filter((n): n is string => !!n)
  const itemLine = names.length > 0 ? `รายการที่สรุปคุยกันไว้: ${names.join(', ')} (อยู่ในตะกร้าแล้ว)` : 'ลูกค้าตามลิงก์สรุปตะกร้าที่ระบบส่งไว้ในแชทเข้ามา'
  
  // R96 Phase 2: Add timeline context
  const timelineLines: string[] = []
  if (handoff.timeline && handoff.timeline.length > 0) {
    const recentTimeline = handoff.timeline.slice(-5) // Last 5 interactions
    for (const entry of recentTimeline) {
      const timeStr = new Date(entry.time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      const channelLabel = entry.channel === 'facebook_post' ? 'โพสต์ FB' : 
                          entry.channel === 'facebook_comment' ? 'คอมเมนต์ FB' :
                          entry.channel === 'messenger' ? 'Messenger' : 'เว็บ'
      const topicStr = entry.topic ? ` เรื่อง "${entry.topic}"` : ''
      const productsStr = entry.product_ids?.length ? ` (${entry.product_ids.length} รายการ)` : ''
      timelineLines.push(`  · ${channelLabel} @ ${timeStr}${topicStr}${productsStr}`)
    }
  }
  const timelineContext = timelineLines.length > 0
    ? `ประวัติการคุยข้ามช่องทาง:\n${timelineLines.join('\n')}`
    : ''

  return [
    ...(summaryLine ? [summaryLine] : []),
    `ต้นทาง: ลูกค้าเพิ่งคุยกับ Bite บน${label} แล้วกดลิงก์ต่อเข้าเว็บ`,
    itemLine,
    ...(timelineContext ? [timelineContext] : []),
    `ให้ต่อบทสนทนาจาก${label}ทันที (เช่น "ต่อจากที่คุยกันใน${label}นะครับ") — ห้ามทำเหมือนเพิ่งคุยกันครั้งแรก`,
    'ห้ามถามเมนู/จำนวนที่สรุปแล้วซ้ำ · ชวนตรวจรายการในตะกร้าและชำระเงินต่อได้เลย',
  ].join(' | ')
}