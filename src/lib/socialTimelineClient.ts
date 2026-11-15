// ============================================
// Bite Me Baby — Social timeline client (R96 Phase 2 · fix 2026-11-15)
// ============================================
// "รวมใช้บริบทเดียวกันทุกช่องทางและรับต่อเนื่องกัน" — ฝั่งเว็บดึงประวัติการคุยข้าม
// ช่องทาง (คอมเมนต์ FB + Messenger) ของลูกค้าที่ล็อกอิน "จาก server" ผ่าน RPC
// `social_timeline_for_web` (migration 205) — ก่อนหน้านี้เว็บมีแค่ sessionStorage
// ของเครื่องเดียว → เครื่องใหม่/แท็บใหม่ = ไม่รู้เรื่องที่คุยไว้เลย
//
// ของจริงเท่านั้น: ข้อความจาก social_events (server truth) · RPC ล้ม = คืน []
// (ไม่มโน — TalkToBite ใช้บริบทปกติเมื่อไม่มี timeline)
// ============================================

export interface SocialTimelineRow {
  event_type: 'comment' | 'message'
  content: string
  reply: string
  received_at: string
}

/** ดึง timeline ข้ามช่องทางของลูกค้าที่ล็อกอิน (best-effort — fail = []) */
export async function fetchSocialTimelineForWeb(): Promise<SocialTimelineRow[]> {
  try {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase.rpc('social_timeline_for_web')
    if (error || !Array.isArray(data)) return []
    return (data as SocialTimelineRow[])
      .filter((r) => r && (r.event_type === 'comment' || r.event_type === 'message'))
      .map((r) => ({
        event_type: r.event_type,
        content: String(r.content || '').slice(0, 200),
        reply: String(r.reply || '').slice(0, 200),
        received_at: String(r.received_at || ''),
      }))
  } catch {
    return []
  }
}

/**
 * Pure — สร้างบรรทัดบริบท "ต่อเนื่องข้ามช่องทาง" จาก server timeline
 * ต่างจาก buildSocialHandoffContext (sessionStorage เครื่องเดียว): อิงข้อความ
 * ลูกค้าจริงจาก social_events ทุกเครื่องเห็นเหมือนกัน · คืน '' เมื่อไม่มีข้อมูล
 */
export function buildServerTimelineContext(rows: SocialTimelineRow[]): string {
  if (!rows || rows.length === 0) return ''
  const lines: string[] = []
  for (const r of rows.slice(-5)) {
    const ch = r.event_type === 'message' ? 'Messenger' : 'คอมเมนต์ FB'
    if (r.content) lines.push(`ลูกค้า (${ch}): ${r.content}`)
    if (r.reply) lines.push(`Bite (${ch}): ${r.reply}`)
  }
  if (lines.length === 0) return ''
  return [
    'ประวัติการคุยข้ามช่องทางจากระบบ (DATA — ลูกค้าเคยคุยกับ Bite บน Facebook/Messenger):',
    ...lines,
    'ให้ต่อบทสนทนาจากประวัตินี้ทันที ห้ามทักทายเหมือนเพิ่งคุยครั้งแรก ห้ามถามเรื่องที่สรุปแล้วซ้ำ',
  ].join(' | ')
}
