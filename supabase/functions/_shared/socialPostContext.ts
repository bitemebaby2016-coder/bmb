// ============================================
// Bite Me Baby — R57: บริบท "โพสต์ต้นทาง" ของคอมเมนต์ Facebook
// Owner 2026-11-02: "ข้อมูลสรุปออเดอร์ไม่ตรงกับโพส ตอบลูกค้าไม่ถูกบริบทร้าน
// → ต้องตอบข้อมูลจริงตามโพสและตามเว็บ" ⇒ ดึงข้อความโพสต์ที่ลูกค้าคอมเมนต์อยู่
// ใส่ prompt เป็น DATA (คู่กับ getShopContext = ข้อมูลเว็บจริง)
//
// แหล่ง post_id จริงใน social_events.payload:
//   - poll (social-publish-worker): payload.post_id ตรง ๆ (source:'poll')
//   - webhook (channel-webhook):   payload.changes[].value.post_id
// pure = ไม่แตะ network · fetch ส่วน test ยิงด้วย fetchImpl จำลองได้
// ============================================

/** หา post_id ต้นทางจาก payload ดิบของ event — ไม่เจอ = '' (ไม่ throw) */
export function extractSourcePostId(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const p = payload as Record<string, unknown>
  // poll path: { post_id: 'pageid_postid', source: 'poll' }
  if (typeof p.post_id === 'string' && p.post_id.includes('_')) return p.post_id
  // webhook feed path: { changes: [{ value: { post_id } }] }
  const changes = Array.isArray(p.changes) ? p.changes : []
  for (const ch of changes) {
    if (!ch || typeof ch !== 'object') continue
    const value = (ch as Record<string, unknown>).value
    if (!value || typeof value !== 'object') continue
    const pid = (value as Record<string, unknown>).post_id
    if (typeof pid === 'string' && pid.includes('_')) return pid
  }
  return ''
}

/**
 * ดึงข้อความโพสต์จริงจาก Graph API (page token อ่านโพสต์ของตัวเองได้)
 * ล้มเหลว/ไม่มีข้อความ/ไม่มี token = '' (prompt ต่อได้ — ห้ามให้ network ทำให้ตอบไม่ได้)
 */
export async function fetchPostMessage(
  postId: string,
  pageToken: string,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<string> {
  if (!postId || !pageToken || !postId.includes('_')) return ''
  const f = deps.fetchImpl ?? fetch
  try {
    const r = await f(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(postId)}?fields=message`,
      {
        headers: { Authorization: 'Bearer ' + pageToken },
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!r.ok) return ''
    const j = await r.json().catch(() => null)
    const msg = j && typeof j.message === 'string' ? j.message.trim() : ''
    return msg.slice(0, 1200)
  } catch {
    return ''
  }
}
