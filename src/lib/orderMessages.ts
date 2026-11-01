// ============================================
// Bite Me Baby — R51: Order messages (แชต ลูกค้า ↔ ไรเดอร์ ↔ แอดมิน)
// ============================================
// Owner (2026-11-01): "สร้างช่องทางติดต่อทางข้อความ … ของเว็บเองด้วย
// เชื่อมต่อกับระบบเดิม ห้ามเปลี่ยนโลจิกหรือสร้างซ้ำ"
//   - thread ผูกกับออเดอร์กลาง (orders.order_number) — ไม่มี order engine ใหม่
//   - เขียนผ่าน RPC เดียว `send_order_message` (m182 · server validate role)
//   - แจ้งลูกค้าฝั่ง server ผ่าน `enqueue_notification` (m179) — ไม่เขียน outbox เอง
//   - realtime = ไม่ใช้ (W4C stub) → component poll ทุก CHAT_POLL_MS
//   - m182 ยังไม่ถูก apply = ฟังก์ชัน RPC ไม่มี → คืน error ตรง ๆ ไม่แกล้งทำสำเร็จ
// ============================================
import { supabase } from './supabase'

export type ChatRole = 'customer' | 'rider' | 'admin'

export interface OrderMessageRow {
  id: string
  order_number: string
  sender_role: ChatRole
  sender_id: string | null
  driver_id: string | null
  body: string
  created_at: string
}

export const CHAT_ROLE_LABELS: Record<ChatRole, string> = {
  customer: 'ลูกค้า',
  rider: 'ไรเดอร์',
  admin: 'ร้าน',
}

/** ระยะ poll ของแผงแชต (ms) — realtime ถูก stub ตาม W4C → ใช้ polling แบบ Dispatch Center */
export const CHAT_POLL_MS = 10_000
export const CHAT_MAX_LEN = 2000

/** pure guard: คืน null = ผ่าน · คืนข้อความ error = ห้ามส่ง (test ได้ไม่ต้องยิง network) */
export function chatComposeGuard(body: string): string | null {
  const t = (body ?? '').trim()
  if (!t) return 'พิมพ์ข้อความก่อนกดส่ง'
  if (t.length > CHAT_MAX_LEN) return `ข้อความยาวเกิน ${CHAT_MAX_LEN} ตัวอักษร`
  return null
}

/** อ่านข้อความของออเดอร์ (RLS = เจ้าของ/ไรเดอร์ที่ผูกงาน/แอดมิน เท่านั้น) */
export async function listOrderMessages(orderNumber: string): Promise<{ ok: boolean; rows?: OrderMessageRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('order_messages')
      .select('*')
      .eq('order_number', orderNumber)
      .order('created_at', { ascending: true })
      .limit(200)
    if (error) return { ok: false, error: error.message }
    return { ok: true, rows: (data ?? []) as OrderMessageRow[] }
  } catch (e) {
    return { ok: false, error: String((e as { message?: string })?.message ?? e) }
  }
}

/** ส่งข้อความ — เดียวทางคือ RPC send_order_message (m182) */
export async function sendOrderMessage(
  orderNumber: string,
  body: string,
  role: ChatRole,
): Promise<{ ok: boolean; error?: string }> {
  const guard = chatComposeGuard(body)
  if (guard) return { ok: false, error: guard }
  try {
    const { data, error } = await supabase.rpc('send_order_message', {
      p_order_number: orderNumber,
      p_body: body.trim(),
      p_sender_role: role,
    })
    if (error) {
      const missing = /send_order_message|Could not find/i.test(error.message ?? '')
      return {
        ok: false,
        error: missing
          ? 'ฟีเจอร์แชตยังไม่ถูกเปิดบนระบบ (อยู่ระหว่างรอเปิดใช้งาน — m182)'
          : (error.message || 'ส่งข้อความไม่สำเร็จ'),
      }
    }
    const payload = data as { ok?: boolean; error?: string } | null
    if (!payload?.ok) return { ok: false, error: payload?.error || 'ส่งข้อความไม่สำเร็จ' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String((e as { message?: string })?.message ?? e) }
  }
}
