// ============================================
// BMB — shared load-error banner (R21 · Phase 3 UI/UX edge cases)
// ============================================
// ปัญหาที่แก้: หลายหน้า console.error แล้วค้างหน้าไว้เงิน ๆ → ลูกค้า/แอดมินเห็น
// "ไม่มีข้อมูล" ทั้งที่จริงคือเน็ตหลุด/RLS บล็อก — ต้องบอกว่า "โหลดไม่สำเร็จ"
// พร้อมปุ่มลองใหม่เสมอ (หน้าที่มี retry อยู่แล้ว: AdminOrders/RouteOptimization/
// PaymentConfirmation/RiderPwa — ไฟล์นี้เอาแพตเทิร์นเดียวกันไปใช้ที่อื่น)
// ============================================
import type { ReactNode } from 'react'

export interface LoadErrorBannerProps {
  /** ข้อความไทยที่บอกว่าโหลดไม่สำเร็จเพราะอะไร/ทำอย่างไรต่อ */
  message: string
  /** กดแล้วโหลดซ้ำ — ทุกหน้าต้องส่ง refetch จริง (ห้าม location.reload()) */
  onRetry: () => void
  /** ปุ่มรอง (optional) เช่น "ไปหน้าแรก" */
  secondaryAction?: ReactNode
  testId?: string
}

export function LoadErrorBanner({ message, onRetry, secondaryAction, testId = 'load-error' }: LoadErrorBannerProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700"
      role="alert"
      data-testid={testId}
    >
      <span>⚠️ {message}</span>
      <span className="flex items-center gap-2">
        {secondaryAction}
        <button type="button" onClick={onRetry} className="btn btn-outline btn-sm" data-testid={`${testId}-retry`}>
          🔄 ลองใหม่
        </button>
      </span>
    </div>
  )
}
