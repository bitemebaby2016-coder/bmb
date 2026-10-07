// W-2.3: SMS transport helpers (shared between sms-send EF and client-side use)
import { describe, expect, it } from 'vitest'
import { normalizeThaiPhone, maskPhone } from '../../supabase/functions/_shared/sms.ts'

describe('sms helpers (W-2.3)', () => {
  it('normalises Thai mobile formats to leading-0 E.164-less form', () => {
    expect(normalizeThaiPhone('081-234-5678')).toBe('0812345678')
    expect(normalizeThaiPhone('+66812345678')).toBe('0812345678')
    expect(normalizeThaiPhone('+66 81 234 5678')).toBe('0812345678')
    expect(normalizeThaiPhone('0812345678')).toBe('0812345678')
    expect(normalizeThaiPhone('66812345678')).toBe('0812345678') // bare 66… (profiles จริงรูปแบบนี้)
    expect(normalizeThaiPhone('6681234567')).toBe('081234567')   // 66 + 8 หลัก
  })

  it('masks phone numbers for logs/responses', () => {
    expect(maskPhone('0812345678')).toBe('081***5678')
    expect(maskPhone('')).toBe('')
  })
})