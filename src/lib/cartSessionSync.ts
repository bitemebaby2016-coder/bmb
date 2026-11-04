// ============================================
// Bite Me Baby — Cart Session Sync (R49 · abandoned-cart signal → server)
// ============================================
// sync "เบา" ของตะกร้าลง public.cart_sessions (m180) เพื่อให้ EF notification-dispatcher
// สร้างแจ้งเตือนตะกร้าทิ้ง 15-30 นาทีได้ — TELEMETRY เท่านั้น:
//   * ไม่แตะราคา/คูปอง/ออเดอร์ · ไม่ blocking · error = เงียบ (ไม่ toast ขัดใจช้อปปิ้ง)
//   * throttle 60 วินาที/ครั้ง · ตะกร้าว่าง = mark converted (หยุดสแกน)
//   * GUEST = ไม่ยิง (R63): m180 ไม่มี GRANT/RLS ให้ anon INSERT → ทุกครั้ง = 401 (42501)
//     (พิสูจน์จริง: e2e/r63Cart401Probe.cjs → anon=401 · admin/auth=201) · dispatcher ก็
//     "guest = skip ไม่แกล้งยิง" อยู่แล้ว → telemetry นี้มีไว้สำหรับลูกค้าที่ล็อกอินเท่านั้น
// ============================================

import { useCartStore } from '@/store/cartStore'

const SESSION_KEY = 'bmb-cart-session-v1'
const THROTTLE_MS = 60_000

// R68 (console noise 42501): key ต่อ "ผู้ใช้" — อีกบัญชีที่ใช้เครื่องเดียวกันได้ id คนละอัน
// จึงไม่ upsert ทับแถวของอีกบัญชี (RLS cart_sessions_update_own ปฏิเสธ = 403/42501)
// หลักฐานเดิม r63Cart401Probe.cjs: anon=401 · authed=201 — แถวของตัวเองอัปเดตได้ปกติ
function sessionId(uid: string): string {
  const key = SESSION_KEY + ':' + uid
  try {
    let id = localStorage.getItem(key)
    if (!id) {
      id = 'csx-' + uid.slice(0, 8) + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return 'csx-' + uid.slice(0, 8) + '-' + Date.now().toString(36)
  }
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
    let customerId: string | null = null
    {
      const { data } = await supabase.from('customers').select('id').eq('user_id', uid).maybeSingle()
      customerId = (data as { id?: string } | null)?.id ?? null
    }
    const res = await supabase.from('cart_sessions').upsert({
      id: sessionId(uid),
      customer_id: customerId,
      items_count: count,
      total_amount: Math.round((Number(state.subtotal) || 0) * 100) / 100,
      status: count === 0 ? 'converted' : 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (res?.error) return // telemetry เท่านั้น — error = เงียบ ห้าม log ขึ้น console
  } catch { /* telemetry เท่านั้น — ล้มก็ไม่กระทบอะไร */ }
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