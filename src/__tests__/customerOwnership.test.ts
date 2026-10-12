// P2 backlog #12 — `no_user_id` null-safety
// เป้าหมาย: พิสูจน์ว่าการมีแถว customers ที่ไม่มีเจ้าของ "ไม่มีทาง" ทำให้เกิด runtime error
// และ semantics ตรงกับ RLS จริง (`user_id = auth.uid()` → NULL = false)
import { describe, it, expect } from 'vitest'
import {
  isOrphanCustomer,
  canCustomerBeReadBy,
  describeOwnershipState,
  countOwnedAndOrphan,
} from '@/lib/customerOwnership'

describe('orphan customer detection — ค่าว่างทุกรูปแบบ', () => {
  it('treats null / undefined / empty / whitespace as orphan', () => {
    expect(isOrphanCustomer(null)).toBe(true)
    expect(isOrphanCustomer(undefined)).toBe(true)
    expect(isOrphanCustomer({ user_id: null })).toBe(true)
    expect(isOrphanCustomer({ user_id: undefined })).toBe(true)
    expect(isOrphanCustomer({ user_id: '' })).toBe(true)
    expect(isOrphanCustomer({ user_id: '   ' })).toBe(true)
    expect(isOrphanCustomer({})).toBe(true)
  })

  it('treats a real uid as owned', () => {
    expect(isOrphanCustomer({ user_id: 'a1b2c3d4-0000-0000-0000-000000000000' })).toBe(false)
  })

  it('never throws on a missing object', () => {
    expect(() => isOrphanCustomer(null)).not.toThrow()
  })
})

describe('canCustomerBeReadBy — ตรงกับ semantics ของ RLS', () => {
  const uid = 'user-uuid-1'

  it('owner can read their own row', () => {
    expect(canCustomerBeReadBy({ user_id: uid }, uid)).toBe(true)
  })

  it('another signed-in user cannot read it', () => {
    expect(canCustomerBeReadBy({ user_id: uid }, 'someone-else')).toBe(false)
  })

  it('an orphan row (NULL user_id) is NEVER readable by a normal user — matches SQL NULL = x → NULL', () => {
    // จุดสำคัญของงานชิ้นนี้: แถว NULL ต้องถูก "ปฏิเสธ" ไม่ใช่ "อนุญาต"
    expect(canCustomerBeReadBy({ user_id: null }, uid)).toBe(false)
    expect(canCustomerBeReadBy({ user_id: undefined }, uid)).toBe(false)
    expect(canCustomerBeReadBy({ user_id: '' }, uid)).toBe(false)
  })

  it('anon (no session) is denied even for an owned row', () => {
    expect(canCustomerBeReadBy({ user_id: uid }, null)).toBe(false)
    expect(canCustomerBeReadBy({ user_id: uid }, undefined)).toBe(false)
    expect(canCustomerBeReadBy({ user_id: uid }, '')).toBe(false)
  })

  it('admin bypasses ownership — including reading orphan rows', () => {
    expect(canCustomerBeReadBy({ user_id: null }, uid, true)).toBe(true)
    expect(canCustomerBeReadBy({ user_id: null }, null, true)).toBe(true)
    expect(canCustomerBeReadBy({ user_id: uid }, 'other', true)).toBe(true)
  })

  it('never throws regardless of input shape', () => {
    for (const c of [null, undefined, {}, { user_id: null }]) {
      for (const u of [null, undefined, '', uid]) {
        expect(() => canCustomerBeReadBy(c as never, u as never)).not.toThrow()
      }
    }
  })
})

describe('countOwnedAndOrphan — นับโดยไม่พังเมื่อเจอ null', () => {
  it('splits owned vs orphan', () => {
    const r = countOwnedAndOrphan([
      { user_id: 'a' },
      { user_id: null },
      { user_id: 'b' },
      { user_id: '' },
    ])
    expect(r).toEqual({ total: 4, owned: 2, orphan: 2 })
  })

  it('handles null / undefined input as an empty list', () => {
    expect(countOwnedAndOrphan(null)).toEqual({ total: 0, owned: 0, orphan: 0 })
    expect(countOwnedAndOrphan(undefined)).toEqual({ total: 0, owned: 0, orphan: 0 })
  })
})

describe('describeOwnershipState — ข้อความแอดมิน ไม่รั่วข้อมูลส่วนตัว', () => {
  it('names the orphan state plainly', () => {
    expect(describeOwnershipState({ user_id: null })).toContain('ไม่มีบัญชีผูก')
  })

  it('never echoes the uid or any PII', () => {
    const msg = describeOwnershipState({ user_id: 'user-uuid-secret-123' })
    expect(msg).not.toContain('user-uuid-secret-123')
  })

  it('handles a missing object without throwing', () => {
    expect(describeOwnershipState(null)).toContain('ไม่พบ')
    expect(() => describeOwnershipState(undefined)).not.toThrow()
  })
})
