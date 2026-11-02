// ============================================
// Bite Me Baby — R52 UI codemod test lock (2026-11-01)
// กติกา: สิ่งที่ codemod แก้ไปแล้วห้ามถอยกลับ
//   1) หน้า auth (Login/Register/Reset) = heart แทนด้วย MascotBadge pose="greeting"
//   2) MascotSettingsPage มี testid ครบ (refresh/alt/save) สำหรับ test lock
//   3) AdminHubs HubShell = rule 12.3 smooth-scroll ไป hub-content ทุกคลิกแท็บ
// ============================================
import { describe, it, expect } from 'vitest'
import loginSrc from '../pages/login/LoginPage.tsx?raw'
import registerSrc from '../pages/login/RegisterPage.tsx?raw'
import resetSrc from '../pages/ResetPasswordPage.tsx?raw'
import mascotSettingsSrc from '../pages/admin/MascotSettingsPage.tsx?raw'
import adminHubsSrc from '../components/admin/AdminHubs.tsx?raw'

const GREETING_MASCOT = '<MascotBadge pose="greeting" size="lg" alt="น้อง Bite ต้อนรับ" loading="eager" />'
const AUTH_PAGES: Array<[string, string]> = [
  ['LoginPage', loginSrc],
  ['RegisterPage', registerSrc],
  ['ResetPasswordPage', resetSrc],
]

describe('R52 lock · หน้า auth ใช้ mascot ต้อนรับแทนหัวใจ (cm_e)', () => {
  for (const [name, src] of AUTH_PAGES) {
    it(`${name}: มี MascotBadge pose="greeting` + '" ครบทุกจุด', () => {
      expect(src, `${name} ต้อง import MascotBadge`).toContain('import { MascotBadge')
      expect(src, `${name} ต้องเรนเดอร์ greeting mascot`).toContain(GREETING_MASCOT)
    })

    it(`${name}: placeholder หัวใจเดิม (text-6xl mb-4) ถูกถอดแล้ว`, () => {
      expect(src, `${name} ยังมี div หัวใจเดิมอยู่`).not.toContain('text-6xl mb-4')
    })
  }
})

describe('R52 lock · MascotSettingsPage testids (test lock 🧡)', () => {
  it('ปุ่มรีเฟช = data-testid="mascot-refresh"', () => {
    expect(mascotSettingsSrc).toContain('data-testid="mascot-refresh"')
  })

  it('ช่อง alt + ปุ่มบันทึก มี testid รายบทบาท (mascot-alt-/mascot-save-)', () => {
    expect(mascotSettingsSrc).toContain('data-testid={`mascot-alt-${role}`}')
    expect(mascotSettingsSrc).toContain('data-testid={`mascot-save-${role}`}')
    expect(mascotSettingsSrc).toContain('data-testid={`mascot-url-${role}`}')
  })

  it('บันทึกแล้วยัง invalidate cache ให้ storefront เห็นรูปใหม่ทันที', () => {
    expect(mascotSettingsSrc).toContain('invalidateMascotOverrides()')
  })
})

describe('R52 lock · AdminHubs rule 12.3 (คลิกแท็บ = smooth-scroll ไปเนื้อหา)', () => {
  it('HubShell มี contentRef + scrollIntoView smooth block start ใน onClick แท็บ', () => {
    expect(adminHubsSrc).toContain('const contentRef = useRef<HTMLDivElement>(null)')
    expect(adminHubsSrc).toContain("contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })")
  })

  it('กล่องเนื้อหาห่อไว้ด้วย data-testid="hub-content"', () => {
    expect(adminHubsSrc).toContain('data-testid="hub-content"')
    expect(adminHubsSrc).toContain('<div ref={contentRef} data-testid="hub-content">')
  })

  it('ทุก Hub ยัง compose ผ่าน HubShell (Orders/Delivery/Settings/Menu/Org)', () => {
    for (const fn of ['OrdersHub', 'DeliveryHub', 'SettingsHub', 'MenuHub', 'OrgHub']) {
      expect(adminHubsSrc, `ต้องมี export ${fn}`).toContain(`export function ${fn}()`)
    }
  })
})