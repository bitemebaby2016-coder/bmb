// R79 (Owner 2026-11-07 ดึก — "สำคัญ: ทำให้ป๊อปอัพเปิดบราวเซอร์ภายนอกจากเม้นเอไอในแชต ต่อออกได้จริง")
// ผลทดสอบจริง: ปุ่ม <a href=intent> = เออเร่อ · ⋮/แชร์ ก็ไม่ออกถึงบราวเซอร์ภายนอก (FB WebView บล็อก)
// → Smart Escape: คัดลอกอัตโนมัติ + navigator.share (ถ้ามี) + แผง guide + ปุ่มรอง intent — ห้าม error หน้า
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const noticeSrc = read('src/components/layout/InAppBrowserNotice.tsx')

describe('R79 — Smart Escape: กดปุ่มเดียวได้ทุกช่อง ไม่มีทาง error หน้า', () => {
  it('ปุ่มหลัก = <button onClick={handleOpenExternal}> (ไม่ใช่ <a href=intent> ที่พาหน้า error)', () => {
    expect(noticeSrc).toContain('data-testid="inapp-open-external"')
    expect(noticeSrc).toContain('onClick={handleOpenExternal}')
    // intent เหลือแค่ปุ่มรองใน guide — ห้ามเป็นปุ่มหลักที่นำทางเฟรมเดียวทันที
    expect(noticeSrc).toContain('data-testid="inapp-open-try"')
    expect(noticeSrc).toContain('href={intentUrl}')
  })

  it('คัดลอกลิงก์อัตโนมัติก่อนเปิด guide: clipboard API + fallback execCommand', () => {
    expect(noticeSrc).toContain('const copyUrl = async')
    expect(noticeSrc).toContain('navigator.clipboard.writeText(url)')
    expect(noticeSrc).toContain("document.execCommand('copy')")
    expect(noticeSrc).toContain('setGuideOpen(true)')
    expect(noticeSrc).toContain('const ok = await copyUrl()')
  })

  it('navigator.share ถ้าเครื่องมี (share sheet จริง) — catch น้ำผู้ใช้ยกเลิก แผง guide ยังค้างใช้ต่อ', () => {
    expect(noticeSrc).toContain('nav.share')
    expect(noticeSrc).toContain('await nav.share({')
    expect(noticeSrc).toContain('user cancel')
  })

  it('แผง guide มีสถานะ + 3 ขั้นเปิด Chrome + ปุ่มคัดลอกซ้ำ + ปิดคำแนะนำ', () => {
    expect(noticeSrc).toContain('data-testid="inapp-guide"')
    expect(noticeSrc).toContain('data-testid="inapp-guide-status"')
    expect(noticeSrc).toContain('คัดลอกลิงก์แล้ว')
    expect(noticeSrc).toContain('เปิดแอป <b>Chrome</b>')
    expect(noticeSrc).toContain('data-testid="inapp-copy"')
    expect(noticeSrc).toContain('data-testid="inapp-guide-close"')
    expect(noticeSrc).toContain('data-testid="inapp-close"')
    expect(noticeSrc).toContain('NOTICE_DISMISS_KEY')
  })

  it('ห้ามพาหน้า error เด็ดขาด: no window.open(intent) · no location.replace/intentional nav ไป intent · ไม่ยิงอัตโนมัติตอนโหลด', () => {
    expect(noticeSrc).not.toContain('window.open(intent')
    expect(noticeSrc).not.toContain('window.location.replace(intent)')
    expect(noticeSrc).not.toContain('openIntentSafely')
    expect(noticeSrc).not.toContain('EXT_REDIRECT_KEY')
    expect(noticeSrc).not.toContain('openExternalIos')
  })

  it('externalBrowserIntentUrl (pure) คงเดิม: https เท่านั้น + chrome package + fallback เดิม', () => {
    expect(noticeSrc).toContain('package=com.android.chrome')
    expect(noticeSrc).toContain('s.browser_fallback_url=')
    expect(noticeSrc).toContain('if (u.protocol !== \'https:\') return null')
  })
})