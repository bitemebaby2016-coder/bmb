// ============================================
// Bite Me Baby — Cart Session Sync (R49 · abandoned-cart signal → server)
// ============================================
// R49 (เดิม): sync "เบา" ของตะกร้าลง public.cart_sessions (m180) เพื่อให้ EF
// notification-dispatcher สร้างแจ้งเตือนตะกร้าทิ้ง 15-30 นาที — TELEMETRY เท่านั้น
// R103 (2026-11-24 · m213): เลิกเป็น telemetry เฉย ๆ — เก็บ "เนื้อตะกร้าจริง" ลง
// cart_sessions.payload (รูปเดียวกับ localStorage bmb-cart-v1 · serializeCartObject)
// เพื่อ restore ข้ามเครื่องสำหรับลูกค้าที่ล็อกอิน:
//   * id deterministic = 'csa-' || customers.id → 1 แถว/1 ลูกค้า · เครื่องไหนอัปเดต = แถวเดิม
//   * ไม่มีราคา/PII ใน payload — server re-derive ตอนสร้างออเดอร์เสมอ (RPC 025)
//   * guest ยังไม่ยิง (R63 คงเดิม — m180/m213 ไม่เปิด anon · พิสูจน์จริง:
//     e2e/r63Cart401Probe.cjs → anon=401 · admin/auth=201) · guest ข้ามเครื่อง = deep-link ?cart=
//   * ไม่ blocking · error = เงียบ (ไม่ toast ขัดใจช้อปปิ้ง) · throttle 60 วินาที/ครั้ง
//   * ตะกร้าว่าง = mark converted + payload ว่าง (หยุดสแกน)
// G7/R68 คงเดิม: RLS คุมแถวตัวเอง · ห้ามแตะราคา/คูปอง server-side authority
// ============================================

import { useCartStore } from '@/store/cartStore'
import { serializeCartObject } from './cartPersistence'

const THROTTLE_MS = 60_000

// R103: customer_id cache ต่อ uid (sync ถี่ — ห้าม query customers ทุกครั้ง)
let cachedIdentity: { uid: string; customerId: string | null } | null = null

async function resolveIdentity(uid: string): Promise<string | null> {
  if (cachedIdentity && cachedIdentity.uid === uid) return cachedIdentity.customerId
  const { supabase } = await import('./supabase')
  const { data } = await supabase.from('customers').select('id').eq('user_id', uid).maybeSingle()
  const customerId = (data as { id?: string } | null)?.id ?? null
  cachedIdentity = { uid, customerId }
  return customerId
}

export async function syncCartSessionNow(): Promise<void> {
  try {
    const state = useCartStore.getState()
    const count = state.items.reduce((s, i) => s + i.quantity, 0)
    const { supabase } = await import('./supabase')
    const uid = (await supabase.auth.getSession()).data.session?.user?.id ?? null
    // R63: guest ไม่มีสิทธิ์เขียน (m180 = TO authenticated เท่านั้น) → ข้ามก่อน upsert
    // เพื่อไม่ให้ console ฟ้อง 401 ทุกครั้งที่เปิดหน้าโดยยังไม่ล็อกอิน
    if (!uid) return
    const customerId = await resolveIdentity(uid)
    if (!customerId) return
    // R103: deterministic row ต่อลูกค้า — ข้ามเครื่อง upsert แถวเดิมเสมอ (legacy csx-* = telemetry เก่า)
    const res = await supabase.from('cart_sessions').upsert({
      id: 'csa-' + customerId,
      customer_id: customerId,
      items_count: count,
      total_amount: Math.round((Number(state.subtotal) || 0) * 100) / 100,
      status: count === 0 ? 'converted' : 'active',
      updated_at: new Date().toISOString(),
      // R103: เนื้อตะกร้าจริง (ids/qty/customizations/mode/coupon/referral — ไม่มีราคา)
      // ตะกร้าว่าง = payload null (แถวคงอยู่แต่ไม่มีของให้ restore)
      payload: count === 0 ? null : serializeCartObject(state),
    }, { onConflict: 'id' })
    if (res?.error) return // telemetry เท่านั้น — error = เงียบ ห้าม log ขึ้น console
  } catch { /* telemetry เท่านั้น — ล้มก็ไม่กระทบอะไร */ }
}

/**
 * R103: อ่านตะกร้าล่าสุดของลูกค้า (ที่ล็อกอิน) จาก server — ใช้ restore ตอน
 * hydration ของอีกเครื่อง (local ว่างเท่านั้น — กฎ restore อยู่ที่ cartPersistence)
 * คืน null เมื่อ: ไม่ล็อกอิน / ไม่มีแถว / payload ว่าง / error (เงียบ ไม่ throw)
 */
export async function fetchLatestServerCart(): Promise<import('./cartPersistence').StoredCart | null> {
  try {
    const { supabase } = await import('./supabase')
    const uid = (await supabase.auth.getSession()).data.session?.user?.id ?? null
    if (!uid) return null
    const customerId = await resolveIdentity(uid)
    if (!customerId) return null
    const { data } = await supabase
      .from('cart_sessions')
      .select('payload')
      .eq('customer_id', customerId)
      .order('updated_at', { ascending: false })
      .limit(1)
    const row = Array.isArray(data) && data[0] ? (data[0] as { payload?: unknown }) : null
    if (!row || !row.payload || typeof row.payload !== 'object') return null
    // payload เก็บเป็น jsonb object อยู่แล้ว (ไม่ double-encoded) — parse ผ่าน strict validator เดิม
    return (await import('./cartPersistence')).parseStoredCart(JSON.stringify(row.payload))
  } catch {
    return null
  }
}

/** เรียนครั้งเดียวจาก main.tsx — subscribe cart เปลี่ยน + throttle */
export function initCartSessionSync(): void {
  if (typeof window === 'undefined') return
  let last = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const fire = () => {
    const now = Date.now()
    if (now - last < THROTTLE_MS) return
    last = now
    void syncCartSessionNow()
  }
  useCartStore.subscribe(() => {
    if (timer) return
    // หน่วง 5 วิหลังเปลี่ยนครั้งสุดท้าย (debounce) แล้วค่อยยิง (เคลือบ throttle)
    timer = setTimeout(() => { timer = null; fire() }, 5000)
  })
  // sync ตอนเข้าหน้า (ถ้ามีของค้างอยู่ในตะกร้า)
  fire()
}