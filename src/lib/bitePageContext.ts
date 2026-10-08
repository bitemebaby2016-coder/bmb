// ============================================
// Bite Me Baby — Bite page context (pure presentation helpers)
// ============================================
// Maps the customer's REAL route + REAL cart state into:
//   1. a section key (drives the floating mascot pose), and
//   2. an optional Thai context line Bite can open a conversation with.
// No fabricated order status, no fake data — presentation layer only.
// ============================================

/** Route → section key consumed by BiteMascot.contextPose(). */
export function sectionFromPath(pathname: string): string {
  const p = (pathname || '/').toLowerCase()
  if (p.startsWith('/shop') || p.startsWith('/menu') || p.startsWith('/random-menu')) return 'menu'
  if (p.startsWith('/cart')) return 'cart'
  if (p.startsWith('/checkout')) return 'checkout'
  if (p.startsWith('/orders') || p.startsWith('/order') || p.startsWith('/track')) return 'orders'
  if (p.startsWith('/promotions') || p.startsWith('/vote')) return 'pre-order'
  if (p.startsWith('/talk-to-bite') || p.startsWith('/ai-chat')) return 'ai-chat'
  if (p.startsWith('/login') || p.startsWith('/register') || p.startsWith('/profile')) return 'account'
  if (p.startsWith('/rider')) return 'rider'
  if (p === '/' || p === '') return 'home'
  return 'home'
}

export interface PageContextState {
  cartCount: number
  cartTotal: number
  /** Latest real order status label when the page already loaded one (never fabricated). */
  orderStatusLabel?: string
}

/**
 * A single Thai line derived ONLY from real state. Returns null when there is
 * nothing honest/specific to say (Bite stays silent instead of inventing).
 */
export function pageContextLine(section: string, state: PageContextState): string | null {
  switch (section) {
    case 'cart':
      if (state.cartCount > 0) {
        return `ตอนนี้ในตะกร้ามี ${state.cartCount} อย่าง รวม ${state.cartTotal} บาทแล้วครับ อยากให้ผมเช็กว่าพอดีกับกี่คนไหม?`
      }
      return 'ตะกร้ายังว่างอยู่ครับ อยากให้ผมเลือกเมนูเริ่มต้นให้ไหม?'
    case 'checkout':
      return state.cartCount > 0
        ? `กำลังจะชำระเงิน ${state.cartCount} อย่างครับ ตรวจที่อยู่กับรูปสถานที่จัดส่งให้เรียบร้อยนะครับ`
        : null
    case 'orders':
      return state.orderStatusLabel
        ? `ออเดอร์ล่าสุด "${state.orderStatusLabel}" ครับ`
        : 'ดูออเดอร์อยู่ใช่ไหมครับ กดเรียกผมได้ทุกเมื่อเลย'
    case 'menu':
      return state.cartCount > 0
        ? `เห็นคุณกำลังดูเมนูอยู่ครับ ในตะกร้ามี ${state.cartCount} อย่างแล้ว อยากให้ผมเลือกตัวที่เข้ากับอาหารให้ไหม?`
        : 'เห็นคุณกำลังดูเมนูอยู่ครับ อยากให้ผมเลือกตัวที่เข้ากับอาหารให้ไหม?'
    case 'pre-order':
      return 'รอบจองล่วงหน้าเปลี่ยนตามที่ร้านเปิดรอบนะครับ เลือกได้เลย'
    case 'account':
      return null
    case 'home':
      return null
    default:
      return null
  }
}
