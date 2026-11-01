// ============================================
// Bite Me Baby — Cart Session Sync (R49 · abandoned-cart signal → server)
// ============================================
// sync "เบา" ของตะกร้าลง public.cart_sessions (m180) เพื่อให้ EF notification-dispatcher
// สร้างแจ้งเตือนตะกร้าทิ้ง 15-30 นาทีได้ — TELEMETRY เท่านั้น:
//   * ไม่แตะราคา/คูปอง/ออเดอร์ · ไม่ blocking · error = เงียบ (ไม่ toast ขัดใจช้อปปิ้ง)
//   * throttle 60 วินาที/ครั้ง · ตะกร้าว่าง = mark converted (หยุดสแกน)
// ============================================

import { useCartStore } from '@/store/cartStore'

const SESSION_KEY = 'bmb-cart-session-v1'
const THROTTLE_MS = 60_000

function sessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = 'csx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
      localStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return 'csx-' + Date.now().toString(36)
  }
}

export async function syncCartSessionNow(): Promise<void> {
  try {
    const state = useCartStore.getState()
    const count = state.items.reduce((s, i) => s + i.quantity, 0)
    const { supabase } = await import('./supabase')
    const uid = (await supabase.auth.getSession()).data.session?.user?.id ?? null
    let customerId: string | null = null
    if (uid) {
      const { data } = await supabase.from('customers').select('id').eq('user_id', uid).maybeSingle()
      customerId = (data as { id?: string } | null)?.id ?? null
    }
    await supabase.from('cart_sessions').upsert({
      id: sessionId(),
      customer_id: customerId,
      items_count: count,
      total_amount: Math.round((Number(state.subtotal) || 0) * 100) / 100,
      status: count === 0 ? 'converted' : 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
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