// ============================================
// Bite Me Baby — N3 (R19 · QA review 2026-10-29 ข้อ 1.6):
// listener auth กลาง = ตาราง decision ล้วน ๆ (ไม่แตะ Supabase/React)
//   SIGNED_OUT → clear (+ redirect /login เก็บ `from` เฉพาะตอนเคยล็อกอินจริง)
//   TOKEN_REFRESHED → refreshRole · USER_UPDATED/SIGNED_IN → re-map customer
// ============================================
import { describe, it, expect } from 'vitest'
import { resolveAuthSyncAction, LOGIN_PATH, type AuthSyncAction } from '@/lib/authSessionSync'

const at = (path: string) => path

describe('N3 — resolveAuthSyncAction (ตาราง event auth กลาง)', () => {
  it('SIGNED_OUT ระหว่างใช้งาน (เคยล็อกอิน) → clear + redirect /login + เก็บ from', () => {
    const a: AuthSyncAction = resolveAuthSyncAction({ event: 'SIGNED_OUT', wasAuthenticated: true, path: at('/orders?tab=1') })
    expect(a.clear).toBe(true)
    expect(a.redirectLogin).toBe(true)
    expect(a.from).toBe('/orders?tab=1')
    expect(a.remapUser).toBe(false)
    expect(a.refreshRole).toBe(false)
  })

  it('SIGNED_OUT ตอนไม่มี session อยู่แล้ว (boot/เปิดแท็บใหม่) → clear อย่างเดียว ห้ามเด้ง (กัน boot loop)', () => {
    const a = resolveAuthSyncAction({ event: 'SIGNED_OUT', wasAuthenticated: false, path: at('/menu') })
    expect(a.clear).toBe(true)
    expect(a.redirectLogin).toBe(false)
    expect(a.from).toBeNull()
  })

  it('SIGNED_OUT ขณะยืนอยู่ /login อยู่แล้ว → clear อย่างเดียว ไม่ navigate ซ้ำ', () => {
    const a = resolveAuthSyncAction({ event: 'SIGNED_OUT', wasAuthenticated: true, path: at(LOGIN_PATH) })
    expect(a.clear).toBe(true)
    expect(a.redirectLogin).toBe(false)
    expect(a.from).toBeNull()
  })

  it('SIGNED_OUT path ว่าง → from = / (ไม่ใช่ empty string)', () => {
    const a = resolveAuthSyncAction({ event: 'SIGNED_OUT', wasAuthenticated: true, path: '' })
    expect(a.redirectLogin).toBe(true)
    expect(a.from).toBe('/')
  })

  it('TOKEN_REFRESHED ขณะล็อกอินอยู่ → refreshRole อย่างเดียว (ไม่ clear ไม่เด้ง)', () => {
    const a = resolveAuthSyncAction({ event: 'TOKEN_REFRESHED', wasAuthenticated: true, path: at('/admin/orders') })
    expect(a.refreshRole).toBe(true)
    expect(a.clear).toBe(false)
    expect(a.redirectLogin).toBe(false)
    expect(a.remapUser).toBe(false)
  })

  it('TOKEN_REFRESHED ตอนไม่ได้ล็อกอิน → ไม่ทำอะไร (ไม่ยิง query ฟรี)', () => {
    const a = resolveAuthSyncAction({ event: 'TOKEN_REFRESHED', wasAuthenticated: false, path: at('/') })
    expect(a).toEqual({ clear: false, remapUser: false, refreshRole: false, redirectLogin: false, from: null })
  })

  it('USER_UPDATED (แก้โปรไฟล์/เมลยืนยัน) → re-map customer อย่างเดียว ไม่ logout', () => {
    const a = resolveAuthSyncAction({ event: 'USER_UPDATED', wasAuthenticated: true, path: at('/profile') })
    expect(a.remapUser).toBe(true)
    expect(a.clear).toBe(false)
    expect(a.redirectLogin).toBe(false)
  })

  it('SIGNED_IN (login สำเร็จ/แท็บอื่น) → re-map + refreshRole เมื่อเคยล็อกอินแล้ว', () => {
    const a = resolveAuthSyncAction({ event: 'SIGNED_IN', wasAuthenticated: true, path: at('/menu') })
    expect(a.remapUser).toBe(true)
    expect(a.refreshRole).toBe(true)
  })

  it('event อื่น (INITIAL_SESSION/PASSWORD_RECOVERY/…) → ไม่ทำอะไร (boot path เดิมของ checkAuth)', () => {
    for (const event of ['INITIAL_SESSION', 'PASSWORD_RECOVERY', 'USER_UPDATED']) {
      const a = resolveAuthSyncAction({ event, wasAuthenticated: false, path: at('/') })
      if (event === 'USER_UPDATED') expect(a.remapUser).toBe(true)
      else expect(a).toEqual({ clear: false, remapUser: false, refreshRole: false, redirectLogin: false, from: null })
    }
  })
})
