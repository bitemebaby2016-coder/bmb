// R79 → R81 (Owner 2026-11-08): Smart Escape ออกแบบใหม่ตามหลักฐาน 6 รอบ
// หลักฐาน R79: ปุ่ม intent = error · ⋮/แชร์ เปิดต่อไม่ได้ · ปุ่ม "เปิดภายนอก" รัน share
//   อัตโนมัติ = "กลายเป็นแชร์" (design bug ของ R79 เอง) + popup คัดลอกขึ้นซ้ำหลายสถานะ
// R81-B2: ปุ่มเดียว = คัดลอก+guide (ห้าม auto-share) · ลบปุ่ม intent ทั้งหมด ·
//   share = ปุ่มที่สองชื่อชัด · guide ขึ้นครั้งเดียวตาม platform · R81-B1 debug capture
import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  r81DebugEnabled,
  r81Capture,
  r81ReadLog,
  r81Platform,
  R81_DEBUG_FLAG,
  R81_DEBUG_LOG,
} from '@/lib/r81DebugCapture'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const noticeSrc = read('src/components/layout/InAppBrowserNotice.tsx')

describe('R81-B2 — Smart Escape ใหม่: ปุ่มเดียว = คัดลอก+guide · ห้าม auto-share · ไม่มีปุ่ม intent', () => {
  it('ปุ่มหลัก = <button onClick={handleOpenExternal}> — ไม่มีปุ่ม intent บน UI อีกแล้ว', () => {
    expect(noticeSrc).toContain('data-testid="inapp-open-external"')
    expect(noticeSrc).toContain('onClick={handleOpenExternal}')
    expect(noticeSrc).not.toContain('data-testid="inapp-open-try"')
    expect(noticeSrc).not.toContain('href={intentUrl}')
    expect(noticeSrc).not.toContain('setIntentUrl')
    expect(noticeSrc).not.toContain('⚡')
  })

  it('คัดลอกอัตโนมัติก่อนเปิด guide: clipboard API + execCommand fallback + setGuideOpen(true)', () => {
    expect(noticeSrc).toContain('const copyUrl = async')
    expect(noticeSrc).toContain('navigator.clipboard.writeText(url)')
    expect(noticeSrc).toContain("document.execCommand('copy')")
    expect(noticeSrc).toContain('setGuideOpen(true)')
    expect(noticeSrc).toContain('const ok = await copyUrl()')
  })

  it('ห้าม auto-share: handleOpenExternal ไม่มี share · share เรียกเฉพาะ handleShare (ปุ่มชื่อชัด)', () => {
    const m = /const handleOpenExternal = async \(\) => \{[\s\S]*?\n {2}\}/.exec(noticeSrc)
    expect(m).toBeTruthy()
    expect(m![0]).not.toContain('share')
    expect(noticeSrc).toContain('const handleShare = async () =>')
    expect(noticeSrc).toContain('data-testid="inapp-share"')
    expect(noticeSrc).toContain('📤 แชร์/ส่งต่อ')
  })

  it('guide ขึ้นครั้งเดียว + 3 ขั้นตาม platform (iOS = Safari · ที่เหลือ = Chrome) + ปุ่มคัดลอกซ้ำ/ปิด', () => {
    expect(noticeSrc).toContain('data-testid="inapp-guide"')
    expect(noticeSrc).toContain('data-testid="inapp-guide-status"')
    expect(noticeSrc).toContain('คัดลอกลิงก์แล้ว')
    expect(noticeSrc).toContain("platform === 'ios'")
    expect(noticeSrc).toContain('<b>Safari</b>')
    expect(noticeSrc).toContain('เปิดแอป <b>Chrome</b>')
    expect(noticeSrc).toContain('data-testid="inapp-copy"')
    expect(noticeSrc).toContain('data-testid="inapp-guide-close"')
    expect(noticeSrc).toContain('data-testid="inapp-close"')
    expect(noticeSrc).toContain('NOTICE_DISMISS_KEY')
  })

  it('Android = target="_blank" เท่านั้น (ไม่มีทางพาหน้าปัจจุบันไป error) · ห้าม intent nav/auto', () => {
    expect(noticeSrc).toContain('data-testid="inapp-open-tab"')
    expect(noticeSrc).toContain('target="_blank"')
    expect(noticeSrc).toContain('rel="noopener noreferrer"')
    expect(noticeSrc).not.toContain('window.open(intent')
    expect(noticeSrc).not.toContain('window.location.replace(intent)')
    expect(noticeSrc).not.toContain('openIntentSafely')
    expect(noticeSrc).not.toContain('EXT_REDIRECT_KEY')
    expect(noticeSrc).not.toContain('openExternalIos')
  })

  it('externalBrowserIntentUrl (pure helper คงไว้ให้ test r57): https เท่านั้น + chrome + fallback', () => {
    expect(noticeSrc).toContain('package=com.android.chrome')
    expect(noticeSrc).toContain('s.browser_fallback_url=')
    expect(noticeSrc).toContain("if (u.protocol !== 'https:') return null")
  })
})

describe('R81-B1 — debug capture (behind flag): UA + ผลกดปุ่มลง localStorage/console', () => {
  beforeEach(() => {
    localStorage.removeItem(R81_DEBUG_FLAG)
    localStorage.removeItem(R81_DEBUG_LOG)
  })

  it('ค่าเริ่มต้น = ปิด — r81Capture ไม่เขียน log อะไรเลย (คนทั่วไปไม่มี overhead)', () => {
    expect(r81DebugEnabled()).toBe(false)
    r81Capture('copy_and_guide', 'copied')
    expect(r81ReadLog()).toEqual([])
    expect(localStorage.getItem(R81_DEBUG_LOG)).toBeNull()
  })

  it('เมื่อเปิด flag = r81DebugEnabled true + เก็บ entry (t/ua/action/detail)', () => {
    localStorage.setItem(R81_DEBUG_FLAG, '1')
    expect(r81DebugEnabled()).toBe(true)
    r81Capture('copy_and_guide', 'copied')
    const log = r81ReadLog()
    expect(log.length).toBe(1)
    expect(log[0].action).toBe('copy_and_guide')
    expect(log[0].detail).toBe('copied')
    expect(log[0].ua.length).toBeGreaterThan(0)
    expect(log[0].t.length).toBeGreaterThan(0)
  })

  it('r81Platform แยก ios/android/other ตาม UA จริง (เลือกข้อความ guide ถูกเครื่อง)', () => {
    expect(r81Platform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios')
    expect(r81Platform('Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A)')).toBe('android')
    expect(r81Platform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0')).toBe('other')
  })
})