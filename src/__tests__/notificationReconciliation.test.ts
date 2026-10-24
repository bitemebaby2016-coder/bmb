// ============================================
// Bite Me Baby — 2026-10-24 (handoff task 2): notification reconciliation
// Owner symptom (order 841):
//   1) ป้ายแดงไม่หายหลัง reload — hydrate ข้ามแถวที่มีใน cache อยู่แล้ว
//      จึงไม่เคยดึง is_read=true จากเซิร์ฟเวอร์มาอัปเดต
//   2) "อ่านทั้งหมดแล้ว" ไม่ได้บันทึกลงเซิร์ฟเวอร์ → ป้ายแดงกลับมาทุกครั้ง
//   3) รายการเรียงไม่ตามเวลา → ข้อความ "กำลังเตรียมอาหาร" เก่าโผล่แทน "จัดส่งแล้ว"
// Contract: server rows are canonical — local cache follows ONLY the server result.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { orderStateRank, useNotificationStore } from '@/store/notificationStore'
import { markAllNotificationsRead, type NotificationRow } from '@/lib/notificationService'
import dropdownSrc from '@/components/notification/NotificationDropdown.tsx?raw'

vi.mock('@/lib/notificationService', () => ({
  markNotificationRead: vi.fn(async () => true),
  markAllNotificationsRead: vi.fn(async () => true),
}))

function row(id: string, over: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id,
    title: `t-${id}`,
    message: `m-${id}`,
    category: 'Transactional',
    is_read: false,
    created_at: '2026-10-24T01:30:00+07:00',
    notification_type: 'order_update',
    ...over,
  }
}

beforeEach(() => {
  useNotificationStore.setState({ notifications: [], unreadCount: 0 })
  vi.mocked(markAllNotificationsRead).mockReset().mockResolvedValue(true)
})

describe('hydrateServerNotifications — server-canonical merge (841)', () => {
  it('rehydration with server is_read=true REPLACES the stale local unread copy → badge clears', () => {
    useNotificationStore.getState().hydrateServerNotifications([row('evt-841', { is_read: false })])
    expect(useNotificationStore.getState().unreadCount).toBe(1)

    // second load (reload / another session): server already read
    useNotificationStore.getState().hydrateServerNotifications([row('evt-841', { is_read: true })])
    const after = useNotificationStore.getState()
    expect(after.notifications).toHaveLength(1)
    expect(after.notifications[0].is_read).toBe(true)
    expect(after.unreadCount).toBe(0)
  })

  it('repeated hydration is idempotent — no duplicate ids ever', () => {
    const rows = [row('evt-a'), row('evt-b')]
    useNotificationStore.getState().hydrateServerNotifications(rows)
    useNotificationStore.getState().hydrateServerNotifications(rows)
    const ids = useNotificationStore.getState().notifications.map((n) => n.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    expect(useNotificationStore.getState().unreadCount).toBe(2)
  })

  it('order 841 REAL data: timestamps INVERTED — delivered ranks above stale preparing by STATE', () => {
    // read-only production probe 2026-10-24: preparing 11:29:07 is NEWER than
    // delivered 11:29:05 — raw created_at sorting is exactly the Owner defect.
    useNotificationStore.getState().hydrateServerNotifications([
      row('evt-ord-BMB-20261023-841-preparing', { notification_type: 'ORDER_PREPARING', title: 'กำลังเตรียมอาหาร', created_at: '2026-10-23T11:29:07+00' }),
      row('evt-ord-BMB-20261023-841-delivered', { notification_type: 'ORDER_DELIVERED', title: 'จัดส่งสำเร็จ', is_read: true, created_at: '2026-10-23T11:29:05+00' }),
      row('evt-ord-BMB-20261023-841-ready_for_dispatch', { notification_type: 'ORDER_READY', title: 'อาหารพร้อมแล้ว', is_read: true, created_at: '2026-10-23T11:29:06+00' }),
      row('evt-ord-BMB-20261023-841-dispatched', { notification_type: 'ORDER_OUT_FOR_DELIVERY', title: 'ออกส่งแล้ว', is_read: true, created_at: '2026-10-23T11:29:04+00' }),
    ])
    expect(useNotificationStore.getState().notifications.map((n) => n.id)).toEqual([
      'evt-ord-BMB-20261023-841-delivered',
      'evt-ord-BMB-20261023-841-dispatched',
      'evt-ord-BMB-20261023-841-ready_for_dispatch',
      'evt-ord-BMB-20261023-841-preparing',
    ])
  })

  it('stale LOCAL "preparing" of the same order clusters below the server delivered row', () => {
    const staleLocal = {
      id: 'notif-local-stale',
      title: 'Preparing Food',
      body: 'Order BMB-20261023-841 being prepared.',
      type: 'order_status',
      is_read: false,
      created_at: '2026-10-23T11:30:00+00', // newest clock time, wrong state
      channel: 'in_app',
    } as unknown as import('@/types').Notification
    useNotificationStore.setState({ notifications: [staleLocal], unreadCount: 1 })

    useNotificationStore.getState().hydrateServerNotifications([
      row('evt-ord-BMB-20261023-841-delivered', { notification_type: 'ORDER_DELIVERED', title: 'จัดส่งสำเร็จ', is_read: true, created_at: '2026-10-23T11:29:05+00' }),
    ])

    const list = useNotificationStore.getState().notifications
    expect(list[0].id).toBe('evt-ord-BMB-20261023-841-delivered')
    expect(list[list.length - 1].id).toBe('notif-local-stale')
    // delivered row is read server-side → badge counts ONLY the stale local row
    expect(useNotificationStore.getState().unreadCount).toBe(1)
  })

  it('Thai-title fallback ranks state when notification_type is a generic value', () => {
    // type ที่ hydrate map ได้ ('order_update') ไม่อยู่ในตาราง rank → ต้องใช้ข้อความไทย
    expect(orderStateRank({ type: 'order_update', title: 'จัดส่งสำเร็จ' })).toBe(60)
    expect(orderStateRank({ type: 'order_update', title: 'กำลังเตรียมอาหาร' })).toBe(30)
    expect(orderStateRank({ type: 'order_update', title: 'อาหารพร้อมแล้ว' })).toBe(40)
    // canonical type ต้องมากกว่าสถานะก่อนหน้าเสมอ
    expect(orderStateRank({ type: 'ORDER_DELIVERED' })).toBeGreaterThan(orderStateRank({ type: 'ORDER_PREPARING' }))
    expect(orderStateRank({ type: 'ORDER_OUT_FOR_DELIVERY' })).toBeGreaterThan(orderStateRank({ type: 'ORDER_READY' }))
  })
})

describe('markAllAsReadServer — server-authoritative badge', () => {
  it('writes server-side first, then clears the badge only on success', async () => {
    useNotificationStore.getState().hydrateServerNotifications([row('evt-x')])
    expect(useNotificationStore.getState().unreadCount).toBe(1)

    const ok = await useNotificationStore.getState().markAllAsReadServer()
    expect(ok).toBe(true)
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1)
    expect(useNotificationStore.getState().unreadCount).toBe(0)
    expect(useNotificationStore.getState().notifications.every((n) => n.is_read)).toBe(true)
  })

  it('a FAILED server write must NOT clear the badge (no fake PASS)', async () => {
    vi.mocked(markAllNotificationsRead).mockResolvedValue(false)
    useNotificationStore.getState().hydrateServerNotifications([row('evt-y')])
    expect(useNotificationStore.getState().unreadCount).toBe(1)

    const ok = await useNotificationStore.getState().markAllAsReadServer()
    expect(ok).toBe(false)
    expect(useNotificationStore.getState().unreadCount).toBe(1)
  })
})

describe('NotificationDropdown.tsx — source contract (history + auto-dismiss)', () => {
  it('bell stays visible at 0 unread (history reachable — no early return on empty)', () => {
    expect(dropdownSrc).not.toContain('if (unreadCount === 0 && !open) return null')
  })

  it('mark-all goes through the server-persisting action, then the popup auto-dismisses', () => {
    expect(dropdownSrc).toContain('markAllAsReadServer()')
    expect(dropdownSrc).toContain('if (ok) setOpen(false)')
  })

  it('footer links to the Notification Center history page', () => {
    expect(dropdownSrc).toContain('to="/notifications"')
    expect(dropdownSrc).not.toContain('to="/profile"')
  })
})