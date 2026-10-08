// ============================================
// Bite Me Baby — Bite page context (pure logic tests)
// Offline + deterministic. Context lines must come from REAL state only.
// ============================================

import { describe, it, expect } from 'vitest'
import { sectionFromPath, pageContextLine } from '@/lib/bitePageContext'

describe('sectionFromPath', () => {
  it('maps store routes to the menu section', () => {
    expect(sectionFromPath('/shop')).toBe('menu')
    expect(sectionFromPath('/menu')).toBe('menu')
    expect(sectionFromPath('/random-menu')).toBe('menu')
  })

  it('maps commerce routes', () => {
    expect(sectionFromPath('/cart')).toBe('cart')
    expect(sectionFromPath('/checkout')).toBe('checkout')
    expect(sectionFromPath('/orders')).toBe('orders')
    expect(sectionFromPath('/order-track/B-1')).toBe('orders')
  })

  it('maps Bite + account routes', () => {
    expect(sectionFromPath('/talk-to-bite')).toBe('ai-chat')
    expect(sectionFromPath('/login')).toBe('account')
    expect(sectionFromPath('/profile')).toBe('account')
  })

  it('root and unknown routes fall back to home', () => {
    expect(sectionFromPath('/')).toBe('home')
    expect(sectionFromPath('')).toBe('home')
    expect(sectionFromPath('/nope')).toBe('home')
  })
})

describe('pageContextLine', () => {
  it('cart with items reports REAL count and total', () => {
    const line = pageContextLine('cart', { cartCount: 3, cartTotal: 267 })
    expect(line).toContain('3')
    expect(line).toContain('267')
  })

  it('cart without items suggests starting (no fake numbers)', () => {
    const line = pageContextLine('cart', { cartCount: 0, cartTotal: 0 })
    expect(line).toContain('ว่าง')
  })

  it('checkout with empty cart says nothing', () => {
    expect(pageContextLine('checkout', { cartCount: 0, cartTotal: 0 })).toBeNull()
  })

  it('orders uses the REAL status label when provided — never invents one', () => {
    const line = pageContextLine('orders', { cartCount: 0, cartTotal: 0, orderStatusLabel: 'กำลังเตรียม' })
    expect(line).toContain('กำลังเตรียม')
    expect(pageContextLine('orders', { cartCount: 0, cartTotal: 0 })).not.toBeNull()
  })

  it('home and account stay silent', () => {
    expect(pageContextLine('home', { cartCount: 2, cartTotal: 100 })).toBeNull()
    expect(pageContextLine('account', { cartCount: 2, cartTotal: 100 })).toBeNull()
  })

  it('menu mentions cart only when it really has items', () => {
    expect(pageContextLine('menu', { cartCount: 0, cartTotal: 0 })).not.toContain('ตะกร้ามี')
    expect(pageContextLine('menu', { cartCount: 2, cartTotal: 90 })).toContain('2')
  })
})
