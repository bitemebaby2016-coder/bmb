// ============================================
// Bite Me Baby — Cart Isolation Modal (ModalAlert)
// ============================================
// Global modal surfaced when `addToCart` detects an order-mode mismatch
// (e.g. cart holds SAME_DAY items but the user taps a PRE_ORDER product).
// Requests explicit approval to clear the previous cart before switching.

import { useEffect } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { useCartStore } from '@/stores/useCartStore'

const MODE_LABEL: Record<string, string> = {
  SAME_DAY: 'สั่งวันนี้ (Same-Day)',
  PRE_ORDER: 'สั่งล่วงหน้า (Pre-Order)',
}

export function CartIsolationModal() {
  const pendingMode = useCartStore((s) => s.pendingMode)
  const itemsCount = useCartStore((s) => s.items.length)
  const order_mode = useCartStore((s) => s.order_mode)
  const confirmModeSwitch = useCartStore((s) => s.confirmModeSwitch)
  const cancelModeSwitch = useCartStore((s) => s.cancelModeSwitch)

  // Escape key closes (cancel) without clearing.
  useEffect(() => {
    if (!pendingMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelModeSwitch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingMode, cancelModeSwitch])

  if (!pendingMode) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="ยืนยันการสลับโหมดออเดอร์"
      data-testid="cart-isolation-modal"
    >
      <GlassCard className="max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-2">สลับโหมดการสั่งซื้อ</h3>
        <p className="text-sm text-slate-600 mb-4">
          ตะกร้าของคุณมีสินค้า <strong>{itemsCount} รายการ</strong> จากโหมด{' '}
          <strong>{MODE_LABEL[order_mode ?? ''] ?? order_mode}</strong> แล้ว
          <br />
          ต้องการสลับไปโหมด <strong>{MODE_LABEL[pendingMode] ?? pendingMode}</strong> หรือไม่?
          <br />
          <span className="text-xs text-slate-400">(การสลับจะล้างสินค้าในตะกร้าเดิม)</span>
        </p>
        <div className="flex gap-3">
          <button onClick={cancelModeSwitch} className="btn btn-outline flex-1" data-testid="cart-isolation-cancel">
            ยกเลิก
          </button>
          <button
            onClick={confirmModeSwitch}
            className="btn btn-primary flex-1"
            data-testid="cart-isolation-confirm"
          >
            ยืนยันสลับ
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
