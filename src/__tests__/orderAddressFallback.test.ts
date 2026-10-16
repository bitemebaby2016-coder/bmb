import { describe, it, expect } from 'vitest'
import { resolveOrderDeliveryAddress } from '../lib/orderAddress'

describe('resolveOrderDeliveryAddress — DeliveryManagement dropoff_detail fallback', () => {
  it('prefers delivery_address when both sources have content', () => {
    expect(resolveOrderDeliveryAddress({ delivery_address: ' ที่อยู่เดิม ', dropoff_detail: 'ที่อยู่ใหม่' })).toBe('ที่อยู่เดิม')
  })
  it('falls back to dropoff_detail when delivery_address is missing/null', () => {
    expect(resolveOrderDeliveryAddress({ dropoff_detail: '123 หมู่ 1 จันทบุรี' })).toBe('123 หมู่ 1 จันทบุรี')
    expect(resolveOrderDeliveryAddress({ delivery_address: null, dropoff_detail: 'บ้านเลขที่ 9' })).toBe('บ้านเลขที่ 9')
  })
  it('falls back when delivery_address is empty or whitespace only', () => {
    expect(resolveOrderDeliveryAddress({ delivery_address: '', dropoff_detail: 'ซอย 2' })).toBe('ซอย 2')
    expect(resolveOrderDeliveryAddress({ delivery_address: '   ', dropoff_detail: 'ซอย 3' })).toBe('ซอย 3')
  })
  it('returns empty string when neither source has content', () => {
    expect(resolveOrderDeliveryAddress({ delivery_address: '', dropoff_detail: '' })).toBe('')
    expect(resolveOrderDeliveryAddress({ delivery_address: ' ', dropoff_detail: null })).toBe('')
    expect(resolveOrderDeliveryAddress({})).toBe('')
  })
  it('handles null/undefined input safely', () => {
    expect(resolveOrderDeliveryAddress(null)).toBe('')
    expect(resolveOrderDeliveryAddress(undefined)).toBe('')
  })
  it('trims surrounding whitespace but keeps interior text', () => {
    expect(resolveOrderDeliveryAddress({ dropoff_detail: '  บ้าน ใหญ่  ' })).toBe('บ้าน ใหญ่')
  })
})