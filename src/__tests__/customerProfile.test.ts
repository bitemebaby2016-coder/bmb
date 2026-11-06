import { describe, it, expect } from 'vitest'
import { validateBirthday } from '@/lib/customerProfile'

describe('R73g — validateBirthday (birthday + consent UI guard)', () => {
  it('accepts empty (ยังไม่กรอก = ผ่าน) และวันเกิดในอดีต', () => {
    expect(validateBirthday('')).toBeNull()
    expect(validateBirthday(null)).toBeNull()
    expect(validateBirthday(undefined)).toBeNull()
    expect(validateBirthday('1990-05-20')).toBeNull()
  })

  it('rejects วันในอนาคต', () => {
    const future = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10)
    expect(validateBirthday(future)).toBe('วันเกิดต้องไม่เป็นวันในอนาคต')
  })

  it('rejects รูปแบบ/วันที่ไม่ถูกต้อง', () => {
    expect(validateBirthday('20-05-1990')).toBe('รูปแบบวันที่ไม่ถูกต้อง')
    expect(validateBirthday('1990/05/20')).toBe('รูปแบบวันที่ไม่ถูกต้อง')
    expect(validateBirthday('1990-13-45')).toBe('วันที่ไม่ถูกต้อง')
    expect(validateBirthday('abc')).toBe('รูปแบบวันที่ไม่ถูกต้อง')
  })

  it('rejects ปีที่ไม่สมเหตุสมผล', () => {
    expect(validateBirthday('1800-01-01')).toBe('ปีที่กรอกไม่สมเหตุสมผล')
  })
})