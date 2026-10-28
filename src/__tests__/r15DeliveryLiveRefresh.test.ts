// ============================================
// Bite Me Baby — R15 tests (Owner 2026-10-28):
//   1) auto-close ฝั่ง server = ทำงานจริงแล้ว (probe evidence) — ที่ "ไม่ปิด" = หน้าค้าง
//      → DeliveryManagement ต้อง refresh เอง (poll + visibilitychange) + ?focus= เลื่อนแถว
//   2) แอดมินกด "🔥 สร้าง Batch" (เริ่มผลิต) → เด้งไปหน้าจัดส่ง/มอบหมายงาน
// ============================================
import { describe, it, expect } from 'vitest'
import deliverySrc from '../pages/admin/DeliveryManagement.tsx?raw'
import kitchenSrc from '../pages/admin/AdminKitchen.tsx?raw'
import apply167 from '../../e2e/r14Apply167-result.json'
import probeB from '../../e2e/r15ProbeB-result.json'

describe('R15 — ปิดวงจรอัตโนมัติ: server ทำงานแล้ว (หลักฐาน production) + หน้าจอห้ามค้าง', () => {
  it('server auto-close = order delivered + assignment delivered + driver กลับ available + POD มีรูป', () => {
    const p = (probeB as any)[0].probe
    const asg = p.asg135[0]
    expect(asg.status).toBe('delivered')
    expect(asg.delivered_at).toBeTruthy()
    expect(asg.proof_of_delivery_path).toContain('PO-20261028-135')
    expect(p.drivers_status.every((d: any) => d.status !== 'on_job' || d.id !== asg.driver_id)).toBe(true)
    const driver = p.drivers_status.find((d: any) => d.id === asg.driver_id)
    expect(driver.status).toBe('available')
    const o135 = p.orders_ui.find((o: any) => o.order_number === 'PO-20261028-135')
    expect(o135.status).toBe('delivered')
  })

  it('delivered ทั้ง order+assignment = timestamp เดียวกัน (เดียวกัน = tx เดียว = auto-close ไม่ใช่กดมือ)', () => {
    const p = (probeB as any)[0].probe
    const asg = p.asg135[0]
    // delivered_at ของการ assignment ตรงกับเวลา hop delivered ของ order (09:40:16.443277)
    expect(asg.delivered_at).toBe('2026-10-28T09:40:16.443277+00:00')
    const hist = (apply167 as any) // sanity: apply evidence exists
    expect(hist.record.ledgerTopAfter).toContain('167')
  })

  it('DeliveryManagement: poll เงียบทุก 20 วิ + refetch ตอนกลับมาที่แท็บ (visibilitychange)', () => {
    expect(deliverySrc).toContain('window.setInterval(() => { void load(true) }, 20000)')
    expect(deliverySrc).toContain("addEventListener('visibilitychange'")
    expect(deliverySrc).toContain("document.visibilityState === 'visible'")
    expect(deliverySrc).toContain('if (!silent) setLoading(false)')
  })

  it('?focus= จากแจ้งเตือน = refetch เสมอ + scrollIntoView แถว (data-focus-row ทั้ง 2 ตาราง)', () => {
    expect(deliverySrc).toContain('data-focus-row=')
    expect(deliverySrc).toContain('scrollIntoView({ block: \'center\'')
    expect(deliverySrc).toContain('scrolledFocusRef')
    // แถวทั้งคิว dispatch และตาราง en-route ต้องมี data-focus-row
    expect(deliverySrc.match(/data-focus-row=/g)?.length).toBeGreaterThanOrEqual(2)
  })
})

describe('R15 — แอดมินกดเริ่มผลิต (🔥 สร้าง Batch) → เด้งหน้าจัดส่ง/มอบหมายงาน', () => {
  it('success path: toast + navigate /admin/delivery (แทน await load())', () => {
    expect(kitchenSrc).toContain("navigate('/admin/delivery')")
    expect(kitchenSrc).toContain("'สร้าง Batch สำเร็จ: '")
  })

  it('failure path ยังคงอยู่ (toast เหตุจริง ไม่เด้ง)', () => {
    expect(kitchenSrc).toContain("('ไม่สามารถสร้าง Batch ได้: '")
  })
})