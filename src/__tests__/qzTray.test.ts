// ============================================
// Bite Me Baby — R27 unit tests: QZ Tray transport helpers (pure)
// ============================================
import { describe, it, expect } from 'vitest'
import { normalizeQzPrinters, describeQzError, qzIsConnected } from '@/lib/qzTray'
import qzSrc from '@/lib/qzTray?raw'

describe('qzTray — normalizeQzPrinters', () => {
  it('จัดรูปผลลัพธ์ของ qz.printers.find() เป็น string[] ที่ใช้ได้', () => {
    expect(normalizeQzPrinters(['Nimbot B1Pro', 'Microsoft Print to PDF'])).toEqual(['Nimbot B1Pro', 'Microsoft Print to PDF'])
    expect(normalizeQzPrinters('SinglePrinter')).toEqual(['SinglePrinter'])
    expect(normalizeQzPrinters(null)).toEqual([])
    expect(normalizeQzPrinters([null, '', '   ', 'null', 'undefined', 'Ok'])).toEqual(['Ok'])
  })
})

describe('qzTray — describeQzError (ข้อความไทยบอกก้าวถัดไป)', () => {
  it('cert/trust → กด Allow ใน QZ', () => {
    expect(describeQzError(new Error('Certificate not trusted'))).toContain('Allow')
  })
  it('connect/socket → เปิดโปรแกรม QZ + พอร์ต 8181', () => {
    expect(describeQzError(new Error('connect ECONNREFUSED'))).toContain('8181')
  })
  it('printer not found → ตรวจชื่อเครื่อง', () => {
    expect(describeQzError(new Error('Printer not found'))).toContain('ชื่อเครื่อง')
  })
  it('อื่น ๆ → ตัดข้อความต้นฉบับไม่ยาวเกิน', () => {
    const msg = 'x'.repeat(300)
    expect(describeQzError(new Error(msg)).length).toBeLessThanOrEqual(160)
  })
})

describe('qzTray — wiring (source contract)', () => {
  it('qzIsConnected ไม่โหลด lib เอง (อ่าน window.qz อย่างเดียว)', () => {
    expect(qzIsConnected()).toBe(false)
  })
  it('เชื่อมผ่าน qz.websocket.connect + data = {type:pixel, format:html} (JSDoc qz.print)', () => {
    expect(qzSrc).toMatch(/websocket\.connect/)
    expect(qzSrc).toMatch(/format: 'html'/)
    expect(qzSrc).toMatch(/type: 'pixel'/)
    expect(qzSrc).toMatch(/setCertificatePromise/)
    expect(qzSrc).toMatch(/setSignaturePromise/)
    expect(qzSrc).toMatch(/8181/)
  })
})
