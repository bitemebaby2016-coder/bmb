// ============================================
// G&R STAGE 2 (migration 154) — Referral client mirror + flows
//   · normalize code/phone (mirror SQL แบบตัวต่อตัว)
//   · validate (format + self-referral guard) + ข้อความไทยครบทุก reason
//   · deep-link ?ref= + share URL (base แอดมินได้)
//   · apply/revalidate gate (mirror coupon gate — ไม่ผ่านจริง = ไม่เก็บ)
//   · cartStore + persistence (referralCode ข้าม reload)
//   · claim payload (rpc ชื่อ/พารามิเตอร์ถูก — server คือผู้ตัดสินคนเดียว)
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: vi.fn(() => ({})),
  },
}))
vi.mock('@/components/ui/ToastContainer', () => ({ showToast: vi.fn() }))

import {
  normalizeReferralCode,
  normalizeReferralPhone,
  validateReferralCode,
  describeReferralIssue,
  describeReferralClaim,
  fetchReferralPreview,
  claimReferralCode,
  referralShareUrl,
  referralCodeFromSearch,
  REFERRAL_CODE_RE,
} from '@/lib/referralClient'
import { applyReferralCode, revalidateReferralForSubmit, removeReferralCode } from '@/components/ReferralBox'
import { useCartStore } from '@/store/cartStore'
import { serializeCart, parseStoredCart } from '@/lib/cartPersistence'
import { showToast } from '@/components/ui/ToastContainer'

beforeEach(() => {
  rpcMock.mockReset()
  useCartStore.getState().clearCart()
  vi.mocked(showToast).mockClear()
})

describe('normalizeReferralCode — mirror SQL referral_normalize_code', () => {
  it('ตัด whitespace ทั้งหมด + uppercase', () => {
    expect(normalizeReferralCode('  bmb-abc1234 ')).toBe('BMB-ABC1234')
    expect(normalizeReferralCode('B MB-AB C1234')).toBe('BMB-ABC1234')
  })
  it('ค่าว่าง/null → empty string', () => {
    expect(normalizeReferralCode(null)).toBe('')
    expect(normalizeReferralCode(undefined)).toBe('')
    expect(normalizeReferralCode('   ')).toBe('')
  })
})

describe('normalizeReferralPhone — mirror SQL (otpPolicy + 66 → 0)', () => {
  it('+66 แบบ international → 0xx', () => {
    expect(normalizeReferralPhone('+66 81 234 5678')).toBe('0812345678')
    expect(normalizeReferralPhone('66812345678')).toBe('0812345678')
  })
  it('รูปแบบในประเทศ ตัดขีด/ช่องว่าง', () => {
    expect(normalizeReferralPhone('081-234-5678')).toBe('0812345678')
    expect(normalizeReferralPhone('0 8123 45678')).toBe('0812345678')
  })
  it('ค่าว่าง/null → empty (ไม่แมตช์เบอร์อื่นโดยบังเอิญ)', () => {
    expect(normalizeReferralPhone('')).toBe('')
    expect(normalizeReferralPhone(null)).toBe('')
  })
  it('ตัดเฉพาะ 14 หลักท้าย (ตรง otpPolicy slice(-14))', () => {
    expect(normalizeReferralPhone('123456789012345678')).toBe('456789012345678'.slice(-14))
  })
})

describe('REFERRAL_CODE_RE + validateReferralCode', () => {
  it('รูปแบบที่ถูกต้อง', () => {
    expect(REFERRAL_CODE_RE.test('BMB-ABC1234')).toBe(true)
    expect(REFERRAL_CODE_RE.test('BMB-12345678')).toBe(true)
  })
  it('รูปแบบผิด', () => {
    expect(REFERRAL_CODE_RE.test('BMB-AB')).toBe(false) // สั้นกว่า 6
    expect(REFERRAL_CODE_RE.test('XX-ABC1234')).toBe(false)
    expect(REFERRAL_CODE_RE.test('BMB-ABC12!')).toBe(false)
    expect(REFERRAL_CODE_RE.test('')).toBe(false)
  })
  it('validate: empty → empty_code · format → bad_format', () => {
    expect(validateReferralCode('')).toEqual({ ok: false, issue: 'empty_code' })
    expect(validateReferralCode('xx')).toEqual({ ok: false, issue: 'bad_format' })
  })
  it('validate: โค้ดตัวเอง → own_code (mirror hard block self_referral)', () => {
    expect(validateReferralCode('bmb-abc1234', 'BMB-ABC1234')).toEqual({ ok: false, issue: 'own_code' })
    expect(validateReferralCode('BMB-ABC1234', 'BMB-ABC9999')).toEqual({ ok: true, code: 'BMB-ABC1234' })
  })
  it('validate: ไม่รู้จักโค้ดตัวเอง (null) = ผ่าน (server จับซ้ำอีกชั้น)', () => {
    expect(validateReferralCode('BMB-ABC1234', null)).toEqual({ ok: true, code: 'BMB-ABC1234' })
  })
  it('describeReferralIssue ครบทุกเหตุผล ไม่คืน string ว่าง', () => {
    for (const issue of ['empty_code', 'bad_format', 'own_code', 'load_failed'] as const) {
      expect(describeReferralIssue(issue).length).toBeGreaterThan(5)
    }
  })
})

describe('fetchReferralPreview — server precheck (anon)', () => {
  it('valid → ok + rpc args ถูก', async () => {
    rpcMock.mockResolvedValueOnce({ data: { valid: true, reason: null }, error: null })
    await expect(fetchReferralPreview('BMB-ABC1234')).resolves.toEqual({ ok: true })
    expect(rpcMock).toHaveBeenCalledWith('referral_preview', { p_code: 'BMB-ABC1234' })
  })
  it('server ปฏิเสธ → ok:false พร้อม reason', async () => {
    rpcMock.mockResolvedValueOnce({ data: { valid: false, reason: 'unknown_code' }, error: null })
    await expect(fetchReferralPreview('BMB-ABC1234')).resolves.toEqual({ ok: false, reason: 'unknown_code' })
  })
  it('network error → load_failed (ไม่แสร้งว่าผ่าน)', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    await expect(fetchReferralPreview('BMB-ABC1234')).resolves.toEqual({ ok: false, reason: 'load_failed' })
  })
  it('รูปแบบผิด → ไม่ยิง server (bad_format ทันที)', async () => {
    await expect(fetchReferralPreview('xx')).resolves.toEqual({ ok: false, reason: 'bad_format' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})

describe('applyReferralCode / revalidateReferralForSubmit — gate แบบ coupon', () => {
  it('โค้ดไม่ผ่าน rules → ไม่ลง store (ไม่แสร้งว่าใช้ได้)', async () => {
    const r = await applyReferralCode('xx')
    expect(r.ok).toBe(false)
    expect(useCartStore.getState().referralCode).toBe('')
  })
  it('server บอก unknown → ไม่ลง store', async () => {
    rpcMock.mockResolvedValueOnce({ data: { valid: false, reason: 'unknown_code' }, error: null })
    const r = await applyReferralCode('BMB-ABC1234')
    expect(r.ok).toBe(false)
    expect(useCartStore.getState().referralCode).toBe('')
  })
  it('ผ่านทั้งคู่ → normalize + ลง store ทันที', async () => {
    rpcMock.mockResolvedValueOnce({ data: { valid: true, reason: null }, error: null })
    const r = await applyReferralCode(' bmb-abc1234 ')
    expect(r.ok).toBe(true)
    expect(useCartStore.getState().referralCode).toBe('BMB-ABC1234')
  })
  it('revalidate: ไม่มีโค้ด → ok(code=null) — โค้ดเป็นทางเลือก', async () => {
    await expect(revalidateReferralForSubmit()).resolves.toEqual({ ok: true, code: null })
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it('revalidate: โค้ดค้างที่ server ไม่รู้จัก → ถูกเอาออกจาก store + ok:false', async () => {
    useCartStore.getState().setReferralCode('BMB-ABC1234')
    rpcMock.mockResolvedValueOnce({ data: { valid: false, reason: 'unknown_code' }, error: null })
    const r = await revalidateReferralForSubmit()
    expect(r.ok).toBe(false)
    expect(useCartStore.getState().referralCode).toBe('')
  })
  it('removeReferralCode เอาออกจาก store + toast', () => {
    useCartStore.getState().setReferralCode('BMB-ABC1234')
    removeReferralCode()
    expect(useCartStore.getState().referralCode).toBe('')
    expect(vi.mocked(showToast)).toHaveBeenCalled()
  })
})

describe('claimReferralCode — payload ถูกต้อง (server ตัดสิน)', () => {
  it('ส่ง p_order_number + p_referral_code (normalize ก่อน)', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { status: 'held', reason: null, risk: 'none', already_claimed: false, order_number: 'BMB-1' },
      error: null,
    })
    const r = await claimReferralCode('BMB-1', ' bmb-abc1234 ')
    expect(rpcMock).toHaveBeenCalledWith('referral_claim', {
      p_order_number: 'BMB-1',
      p_referral_code: 'BMB-ABC1234',
    })
    expect(r?.status).toBe('held')
  })
  it('rpc error → null (caller แจ้งลูกค้า — ไม่แสร้งว่าสำเร็จ)', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(claimReferralCode('BMB-1', 'BMB-ABC1234')).resolves.toBeNull()
  })
})

describe('describeReferralClaim — ข้อความไทยทุกสถานะ', () => {
  it('held → success · qualified → success · disabled/ineligible → info', () => {
    expect(describeReferralClaim({ status: 'held' }).tone).toBe('success')
    expect(describeReferralClaim({ status: 'qualified' }).tone).toBe('success')
    expect(describeReferralClaim({ status: 'disabled' }).tone).toBe('info')
    expect(describeReferralClaim({ status: 'ineligible' }).tone).toBe('info')
  })
  it('blocked ทุก reason → ข้อความไม่ซ้ำกันและมีความหมาย', () => {
    const reasons = ['self_referral', 'same_phone', 'not_new', 'already_referred', 'claim_window_expired', 'referrer_cap_exceeded']
    const msgs = reasons.map((reason) => describeReferralClaim({ status: 'blocked', reason }).message)
    expect(new Set(msgs).size).toBe(reasons.length)
    msgs.forEach((m) => expect(m.length).toBeGreaterThan(10))
  })
  it('invalid + unknown_code → ข้อความ "ไม่พบรหัส"', () => {
    expect(describeReferralClaim({ status: 'invalid', reason: 'unknown_code' }).message).toContain('ไม่พบ')
  })
})

describe('share link + deep-link ?ref=', () => {
  it('referralShareUrl: base แอดมิน (ตัด slash ท้าย)', () => {
    expect(referralShareUrl('https://biteme-baby.com/', 'BMB-ABC1234')).toBe('https://biteme-baby.com/?ref=BMB-ABC1234')
  })
  it('referralShareUrl: ไม่ระบุ base → ใช้ origin ปัจจุบัน', () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://biteme-baby.com'
    expect(referralShareUrl('', 'BMB-ABC1234')).toBe(`${origin}/?ref=BMB-ABC1234`)
  })
  it('referralCodeFromSearch: ดึง + normalize + validate', () => {
    expect(referralCodeFromSearch('?ref=bmb-abc1234')).toBe('BMB-ABC1234')
    expect(referralCodeFromSearch('ref=BMB-ABC1234&x=1')).toBe('BMB-ABC1234')
  })
  it('referralCodeFromSearch: ไม่มี/รูปแบบผิด → null (ไม่เก็บขยะลง store)', () => {
    expect(referralCodeFromSearch('')).toBeNull()
    expect(referralCodeFromSearch('?ref=XX')).toBeNull()
    expect(referralCodeFromSearch('?other=1')).toBeNull()
  })
})

describe('cartStore + cartPersistence — referralCode อยู่ข้าม reload', () => {
  it('setReferralCode เก็บ · clearCart ล้าง', () => {
    useCartStore.getState().setReferralCode('BMB-ABC1234')
    expect(useCartStore.getState().referralCode).toBe('BMB-ABC1234')
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().referralCode).toBe('')
  })
  it('serialize/parse round-trip referralCode', () => {
    useCartStore.getState().setReferralCode('BMB-ABC1234')
    const json = serializeCart(useCartStore.getState())
    expect(json).toContain('BMB-ABC1234')
    const parsed = parseStoredCart(json)
    expect(parsed?.referralCode).toBe('BMB-ABC1234')
  })
  it('cart เก่า (ไม่มี field) → parse ได้ + referralCode = ค่าว่าง', () => {
    const legacy = JSON.stringify({ v: 1, savedAt: '', order_mode: null, couponCode: 'X', items: [] })
    const parsed = parseStoredCart(legacy)
    expect(parsed?.couponCode).toBe('X')
    expect(parsed?.referralCode).toBe('')
  })
})