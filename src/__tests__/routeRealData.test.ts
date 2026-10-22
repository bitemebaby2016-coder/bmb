// ============================================
// Bite Me Baby — E2 (2026-10-22): ลบ mock ปลอม — real-data adapters + guarantee
// ============================================
// RouteOptimizationPage ต้องอ่านออเดอร์/ไรเดอร์จริงเท่านั้น (กติกาข้อ 5:
// ห้ามเหลือ mock/demo ในหน้าแอดมิน) — mapper เป็น pure functions ทดสอบได้
// และ source-scan คุมว่า mock (BMB-00x / Somchai) ไม่กลับมาอีก
//
// NOTE: ไฟล์นี้ต้องเป็น `.ts` — vitest include pattern รับเฉพาะ .js/.ts (ไม่รับ .tsx)
import { describe, it, expect } from 'vitest'
import { toRouteOrders, toRouteDrivers, assignOrdersToDrivers } from '@/lib/routeOptimization'
import routePageSrc from '../pages/admin/RouteOptimizationPage.tsx?raw'

describe('E2 · toRouteOrders — real orders only, no invented numbers', () => {
  const base = {
    id: 'o1',
    order_number: 'BMB-20261022-001',
    dropoff_latitude: 12.62,
    dropoff_longitude: 102.1,
    delivery_address: 'บ้านเลขที่ 1',
    items: [{ quantity: 2 }, { quantity: 1 }],
  }

  it('maps real fields: coordinates, address, items_count from real quantities', () => {
    const rows = toRouteOrders([base])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'o1',
      order_number: 'BMB-20261022-001',
      dropoff_latitude: 12.62,
      dropoff_longitude: 102.1,
      dropoff_detail: 'บ้านเลขที่ 1',
      items_count: 3,
    })
  })

  it('order without coordinates is skipped (never a fake 0,0 pin)', () => {
    const rows = toRouteOrders([
      base,
      { ...base, id: 'o2', order_number: 'BMB-2', dropoff_latitude: null, dropoff_longitude: null },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('o1')
  })

  it('estimated_weight stays 0 — ระบบไม่มีข้อมูลน้ำหนักจริง ห้ามเดา (E2)', () => {
    expect(toRouteOrders([base])[0].estimated_weight).toBe(0)
  })

  it('empty items → items_count = 1 (ขั้นต่ำ 1 รายการ ไม่ใช่ 0 ปลอม)', () => {
    expect(toRouteOrders([{ ...base, items: [] }])[0].items_count).toBe(1)
  })
})

describe('E2 · toRouteDrivers — real drivers (list_drivers rows), no Somchai', () => {
  const fb = { latitude: 12.6, longitude: 102.1 }

  it('maps driver_name/status/position from real rows', () => {
    const rows = toRouteDrivers([
      {
        id: 'd1', driver_name: 'พ่อไม้', status: 'available', max_capacity: 8,
        current_latitude: 12.65, current_longitude: 102.12, active_assignments: 2,
      },
    ], fb)
    expect(rows[0]).toMatchObject({
      id: 'd1', name: 'พ่อไม้', status: 'available', max_capacity: 8, current_load: 2,
      current_latitude: 12.65, current_longitude: 102.12,
    })
    expect(rows[0].current_orders).toEqual([])
  })

  it('missing position falls back to the kitchen point (ไม่เดาพิกัดปลอม)', () => {
    const rows = toRouteDrivers([
      { id: 'd1', driver_name: 'A', status: 'busy', max_capacity: 5 },
    ], fb)
    expect(rows[0].current_latitude).toBe(fb.latitude)
    expect(rows[0].current_longitude).toBe(fb.longitude)
    expect(rows[0].status).toBe('busy')
    expect(rows[0].current_load).toBe(0)
  })

  it('status offline stays offline; unknown status → available', () => {
    const rows = toRouteDrivers([
      { id: 'd1', driver_name: 'A', status: 'offline', max_capacity: 5 },
      { id: 'd2', driver_name: 'B', status: 'on_break', max_capacity: 5 },
    ], fb)
    expect(rows[0].status).toBe('offline')
    expect(rows[1].status).toBe('available')
  })

  it('assignOrdersToDrivers รันกับข้อมูล mapper จริงได้ — เลขระยะทางมาจากสมการจริง ไม่ใช่ของปลอม', () => {
    const orders = toRouteOrders([
      {
        id: 'o1', order_number: 'BMB-R-1', dropoff_latitude: 12.62, dropoff_longitude: 102.11,
        delivery_address: 'A', items: [{ quantity: 1 }],
      },
    ])
    const drivers = toRouteDrivers([
      { id: 'd1', driver_name: 'พ่อไม้', status: 'available', max_capacity: 5 },
    ], fb)
    const routes = assignOrdersToDrivers(orders, drivers, fb.latitude, fb.longitude)
    expect(routes).toHaveLength(1)
    expect(routes[0].orders.map((o) => o.order_number)).toEqual(['BMB-R-1'])
    expect(routes[0].total_distance).toBeGreaterThan(0) // haversine จริง (~1-2 km)
    expect(routes[0].estimated_time).toBeGreaterThan(0)
  })
})

describe('E2 · source guarantee: หน้าเส้นทางไม่มี mock/demo หลงเหลือ', () => {
  it('RouteOptimizationPage.tsx ไม่มี mockOrders/mockDrivers/ชื่อปลอม/ออเดอร์ปลอม', () => {
    for (const banned of ['mockOrders', 'mockDrivers', 'Somchai', 'Somying', 'Wichai', 'BMB-001']) {
      expect(routePageSrc, `ห้ามเหลือ "${banned}"`).not.toContain(banned)
    }
    expect(routePageSrc).toContain('adminListDrivers')
    expect(routePageSrc).toContain('getOrdersByStatuses')
    expect(routePageSrc).toContain('toRouteOrders')
    expect(routePageSrc).toContain('toRouteDrivers')
  })
})