// ============================================
// Bite Me Baby — _shared/notificationLinks.ts
// R80 · D-4 (Owner 2026-11-07): "ไม่มีแจ้งเตือนจากเฟซเวลาเอไอตอบโพสและข้อความ"
//   → ระบบแจ้งทีมแอดมินเองผ่านวงจรที่มีอยู่แล้ว (m179 notification hub):
//     enqueue_notification (event_key UNIQUE = idempotent) → notification_outbox
//     → cron bmb-notify (≤5 นาที) → in-app public.notifications + push (Notification Center)
//   ข้อบังคับ: ความล้มเหลวของแจ้งเตือนห้ามกระทบขั้นตอนตอบ/โพสของเอไอ —
//   ผู้เรียกต้อง wrap try/catch (หรือ void) เองเสมอ
// ============================================

export type AdminAlertCategory = 'Transactional' | 'Marketing' | 'Bite' | 'Operational'

export interface AdminAlert {
  /** คีย์ฐาน idempotency ต่อ event (ต่อผู้รับจะ suffix customerId — กันแถวซ้ำ ไม่มีทาง loop) */
  eventKey: string
  title: string
  body: string
  category: AdminAlertCategory
  url?: string
}

/** m171: profiles.role = บทบาทแอดมิน (owner/manager/staff/...) — D-4 = Owner + ทีมแอดมินเห็น */
const ADMIN_ROLES = 'owner,manager,staff,admin'

/** หา customer_id ของทีมแอดมิน (profiles.role → customers.user_id) — ไม่เดา ไม่ hardcode */
export async function resolveAdminCustomerIds(sbUrl: string, serviceKey: string): Promise<string[]> {
  const p = await fetch(
    `${sbUrl}/rest/v1/profiles?select=user_id,role&role=in.(${ADMIN_ROLES})&limit=50`,
    { headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey } },
  )
  if (!p.ok) throw new Error('profiles read failed: ' + p.status)
  const rows = (await p.json()) as Array<{ user_id: string }>
  const users = [...new Set(rows.map((r) => r.user_id).filter(Boolean))]
  if (users.length === 0) return []
  const c = await fetch(
    `${sbUrl}/rest/v1/customers?select=id&user_id=in.(${users.map(encodeURIComponent).join(',')})&limit=50`,
    { headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey } },
  )
  if (!c.ok) throw new Error('customers read failed: ' + c.status)
  const cs = (await c.json()) as Array<{ id: string }>
  return cs.map((r) => r.id).filter(Boolean)
}

/** ยิงแจ้งเตือนไปยังแอดมินทุกราย — event_key ต่อผู้รับ (retry/ซ้ำ = ไม่มีแถวซ้ำ) */
export async function enqueueAdminAlert(
  sbUrl: string,
  serviceKey: string,
  a: AdminAlert,
): Promise<{ attempted: number; inserted: number }> {
  const ids = await resolveAdminCustomerIds(sbUrl, serviceKey)
  let inserted = 0
  for (const id of ids) {
    const res = await fetch(`${sbUrl}/rest/v1/rpc/enqueue_notification`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_event_key: `${a.eventKey}-${id}`.slice(0, 200),
        p_customer_id: id,
        p_category: a.category,
        p_title: a.title.slice(0, 200),
        p_body: a.body.slice(0, 1000),
        p_url: a.url ?? null,
      }),
    })
    if (res.ok) {
      const j = (await res.json().catch(() => null)) as { inserted?: boolean } | null
      if (j?.inserted) inserted++
    }
  }
  return { attempted: ids.length, inserted }
}
