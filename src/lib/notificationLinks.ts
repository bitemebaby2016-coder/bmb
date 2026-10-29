// ============================================
// Bite Me Baby — notification → หน้าทำงานที่เกี่ยวข้อง (R11 · Owner 2026-10-27)
// กติกา (ทำตามกฏ): กดอ่านแจ้งเตือน = เด้งไปหน้าทำงานของ "เรื่องนั้น" ตาม role
//   · rider           → /rider (หน้างานของฉัน)
//   · admin-capable   → ตามประเภท: ครัว (preparing/ready) / จัดส่ง (delivery
//                       states) / ออเดอร์ (created/confirmed/payment/อื่น ๆ)
//   · customer/อื่น ๆ → เลขออเดอร์ → /track/<order> · โปรโมชัน → /promotions
//                       · อื่น ๆ → /orders
// pure function — ทดสอบใน src/__tests__/notificationLinks.test.ts
// ============================================

export interface NotificationLinkInput {
  type?: string | null
  notification_type?: string | null
  title?: string | null
  body?: string | null
  message?: string | null
  data?: Record<string, unknown> | null
}

/** ดึงเลขออเดอร์จากข้อความ/ข้อมูล (#PO-… / BMB-… ทั้งแบบมี # และไม่มี) */
export function extractOrderNumber(n: NotificationLinkInput): string | null {
  const fromData = n.data && typeof n.data.orderNumber === 'string' ? n.data.orderNumber : ''
  const text = `${fromData} ${n.title ?? ''} ${n.body ?? ''} ${n.message ?? ''}`
  const m = text.match(/(?:#)?((?:PO|BMB)-\d{6,}-\d+)/i)
  return m ? m[1].toUpperCase() : null
}

const ADMIN_KITCHEN_TYPES = ['ORDER_PREPARING', 'ORDER_READY', 'ORDER_READY_FOR_DISPATCH']
// R21 (Owner ask #1): ทีมครัวกดแจ้งเตือน "ออเดอร์ใหม่/เพิ่งยืนยัน" → ไปคิวครัวทันที
// (role อื่น ๆ ยังคงไป /admin/orders — หน้ารับออเดอร์ ไม่เปลี่ยนพฤติกรรมเดิม)
const KITCHEN_NEW_ORDER_TYPES = ['ORDER_CREATED', 'ORDER_PLACED', 'ORDER_CONFIRMED', 'PAYMENT_CONFIRMED']
const ADMIN_DELIVERY_TYPES = [
  'ORDER_DISPATCHED',
  'ORDER_OUT_FOR_DELIVERY',
  'ORDER_IN_TRANSIT',
  'ORDER_ARRIVED',
  'ORDER_DELIVERED',
]

/**
 * เส้นทางหน้าทำงานที่เกี่ยวข้องของแจ้งเตือนหนึ่งใบ (ตาม role ของผู้กด)
 * คืน null = ไม่ต้องเด้ง (ไม่รู้จักเรื่อง/หน้า)
 */
export function resolveNotificationRoute(
  n: NotificationLinkInput,
  role: string | null | undefined,
): string | null {
  const type = String(n.notification_type ?? n.type ?? '').toUpperCase()
  const orderNo = extractOrderNumber(n)

  if (role === 'rider') return '/rider'

  if (role && role !== 'customer') {
    // admin-capable + specialist roles (146) — หน้าทำงานตามประเภทงาน
    if (ADMIN_KITCHEN_TYPES.includes(type)) return '/admin/kitchen'
    // R21 (Owner ask #1): ทีมครัวกดแจ้งเตือนออเดอร์ใหม่/ยืนยันแล้ว → คิวครัวทันที
    if (role === 'kitchen' && KITCHEN_NEW_ORDER_TYPES.includes(type)) return '/admin/kitchen'
    if (ADMIN_DELIVERY_TYPES.includes(type)) {
      // R13 (Owner 2026-10-28): เด้งไปหน้าจัดส่งพร้อมไฮไลต์แถวออเดอร์นั้น
      // — เปิดเจอ "คิว/กำลังเดินทาง" ที่มีปุ่ม "แอดมินปิดวงจร" ทันที
      return orderNo ? `/admin/delivery?focus=${orderNo}` : '/admin/delivery'
    }
    return '/admin/orders'
  }

  if (orderNo) return `/track/${orderNo}`
  if (type.startsWith('PROMOTION') || type === 'PROMOTION_EXPIRED') return '/promotions'
  return '/orders'
}