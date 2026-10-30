// Bite Me Baby — Printer Settings (migration 128) — Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
// เลือก/ตั้งค่าเครื่องพิมพ์ที่รองรับ + Auto-Print. Browser print fallback ใช้ได้กับ
// เครื่องพิมพ์ทุกตัวที่ OS มองเห็น; ESC/POS raw adapter = แผนระยะถัดไป (ดู docs).
import { useState, useEffect } from 'react'
import { showToast } from '@/components/ui/ToastContainer'
import { loadPrinterSettings, savePrinterSettings, PrinterSettings, DEFAULT_PRINTER_SETTINGS, createPrinterDef, upsertPrinter, removePrinter, assignPrinter, describePrinterTarget, PRINTER_MODEL_LABELS, PRINTER_MODEL_DEFAULT_WIDTH, type PrinterModel, printHtmlInHiddenFrame } from '@/lib/printService'
// R25: ไม่มี local flag — ทุกปุ่มทดสอบยิงผ่าน printHtmlInHiddenFrame (guard กลาง + afterprint cleanup ใน printService)
// (เดิม: popup window.open + win.print() = popup ค้างหลัง Cancel + testPrintRole ไม่มี guard → ซ้อนได้)

export function AdminPrintSettings() {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // R21 (Owner 2026-10-29): ฟอร์มเพิ่มเครื่องพิมพ์เอง — ค่าเริ่มต้น = Nimbot B1Pro ที่ร้านใช้อยู่
  const [draftLabel, setDraftLabel] = useState('Nimbot B1Pro')
  const [draftModel, setDraftModel] = useState<PrinterModel>('nimbot_b1pro')
  const [draftWidth, setDraftWidth] = useState<number>(PRINTER_MODEL_DEFAULT_WIDTH.nimbot_b1pro)
  const [draftLocation, setDraftLocation] = useState('')

  useEffect(() => {
    void (async () => {
      setSettings(await loadPrinterSettings())
      setLoaded(true)
    })()
  }, [])

  async function handleSave() {
    setSaving(true)
    const ok = await savePrinterSettings(settings)
    setSaving(false)
    showToast(ok ? 'บันทึกตั้งค่าเครื่องพิมพ์แล้ว' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
  }

  /** R23: เพิ่มเติม — ปุ่มทดสอบจาก dropdown (เลือกเครื่องพิมพ์จาก OS ก่อนกด) */
  function testPrintFromDropdown() {
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>Test</title>
      <style>body{font-family:'Sarabun',sans-serif;font-size:12px;width:72mm;margin:4mm}</style></head>
      <body><h1 style="text-align:center">ทดสอบเครื่องพิมพ์</h1>
      <p>เครื่องที่ระบบผูก: ${describePrinterTarget(settings, 'receipt')}</p></body></html>`
    const r = printHtmlInHiddenFrame(html)
    if (r === 'failed') { showToast('มี dialog พิมพ์เปิดอยู่ (หรือเปิดไม่สำเร็จ) — ปิดก่อนแล้วลองใหม่', 'warning'); return }
    showToast('เปิด dialog แล้ว — เลือกได้เฉพาะเครื่องที่ Windows รู้จัก (Nimbot ต้องลงไดรเวอร์ก่อน ดูกล่องวิธีใช้ด้านล่าง)', 'info')
  }

  function testPrint() {
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>Test Print</title>
      <style>body{font-family:'Sarabun','Tahoma',sans-serif;font-size:12px;width:${settings.paperWidthMm}mm;margin:4mm}
      h1{font-size:15px;text-align:center}hr{border:none;border-top:1px dashed #000;margin:6px 0}</style></head><body>
      <h1>Bite Me Baby</h1><div style="text-align:center">ทดสอบเครื่องพิมพ์ / Test Print</div><hr>
      <div>ความกว้างกระดาษ: ${settings.paperWidthMm} มม.</div>
      <div>เครื่องพิมพ์ใบเสร็จ: ${settings.receiptPrinterName || '(ค่าเริ่มต้นของระบบ)'}</div>
      <div>เครื่องพิมพ์คิวครัว: ${settings.kitchenPrinterName || '(ค่าเริ่มต้นของระบบ)'}</div><hr>
      <div style="text-align:center">ไทย: ทดสอบตัวอักษรไทย — ฿123.45</div>
      </body></html>`
    const r = printHtmlInHiddenFrame(html)
    if (r === 'failed') { showToast('มี dialog พิมพ์เปิดอยู่ (หรือเปิดไม่สำเร็จ) — ปิดก่อนแล้วลองใหม่', 'warning'); return }
    showToast('เปิดคำสั่งพิมพ์ทดสอบแล้ว — กด Cancel ใน dialog = หยุดจริง (ไม่มีงานซ้อน) · สถานะ "sent" ไม่ได้หมายถึงพิมพ์สำเร็จ', 'info')
  }

  function handleAddPrinter() {
    if (!draftLabel.trim()) { showToast('ตั้งชื่อเครื่องพิมพ์ก่อน', 'warning'); return }
    const def = createPrinterDef({ label: draftLabel, model: draftModel, paperWidthMm: draftWidth, location: draftLocation })
    setSettings((s) => upsertPrinter(s, def))
    setDraftLocation('')
    showToast(`เพิ่ม "${def.label}" แล้ว — กด "บันทึก" เพื่อให้มีผลกับทุกหน้า`, 'info')
  }

  function handleRemovePrinter(id: string) {
    const p = (settings.printers ?? []).find((x) => x.id === id)
    if (!window.confirm(`ลบเครื่องพิมพ์ "${p?.label ?? ''}"?`)) return
    setSettings((s) => removePrinter(s, id))
    showToast('ลบออกจากรายชื่อแล้ว (กดบันทึกเพื่อบันทึกลงระบบ)', 'info')
  }

  /** ทดสอบพิมพ์จาก "เครื่องที่ผูกกับบทบาท" — ใช้เทมเพลตใบเสร็จจริงของระบบ (R25: ผ่าน frame กลาง = มี guard + Cancel หยุดจริง) */
  function testPrintRole(role: 'receipt' | 'kitchen') {
    const target = describePrinterTarget(settings, role)
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>Test Print</title>
      <style>body{font-family:'Sarabun','Tahoma',sans-serif;font-size:12px;width:${role === 'receipt' ? settings.paperWidthMm : 58}mm;margin:4mm}
      h1{font-size:15px;text-align:center}hr{border:none;border-top:1px dashed #000;margin:6px 0}</style></head><body>
      <h1>Bite Me Baby</h1><div style="text-align:center">ทดสอบเครื่องพิมพ์ (${role === 'receipt' ? 'ใบเสร็จ' : 'คิวครัว'})</div><hr>
      <div>เครื่องที่ระบบผูกไว้: ${target}</div>
      <div>ความกว้างกระดาษ: ${settings.paperWidthMm} มม.</div>
      <div style="text-align:center">ไทย: ทดสอบตัวอักษรไทย — ฿123.45</div>
      </body></html>`
    const r = printHtmlInHiddenFrame(html)
    if (r === 'failed') { showToast('มี dialog พิมพ์เปิดอยู่ (หรือเปิดไม่สำเร็จ) — ปิดก่อนแล้วลองใหม่', 'warning'); return }
    showToast(`ส่งคำสั่งพิมพ์ไปที่ "${target}" — กด Cancel = หยุดจริง (ไม่มีงานซ้อน) · สถานะ "sent" ไม่ได้หมายถึงพิมพ์สำเร็จ`, 'info')
  }

  if (!loaded) return <p className="text-brand-muted">กำลังโหลดตั้งค่า...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-accent">🖨️ ตั้งค่าเครื่องพิมพ์</h1>
      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">ชื่อเครื่องพิมพ์ใบเสร็จ (สำหรับอ้างอิงในระบบ)</label>
          <input className="input" value={settings.receiptPrinterName} onChange={(e) => setSettings({ ...settings, receiptPrinterName: e.target.value })} placeholder="เช่น EPSON TM-T20III (Counter)" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ชื่อเครื่องพิมพ์คิวครัว</label>
          <input className="input" value={settings.kitchenPrinterName} onChange={(e) => setSettings({ ...settings, kitchenPrinterName: e.target.value })} placeholder="เช่น RONGTA RP80 (Kitchen)" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ความกว้างกระดาษ (มม.)</label>
          <select className="input w-40" value={settings.paperWidthMm} onChange={(e) => setSettings({ ...settings, paperWidthMm: Number(e.target.value) })}>
            <option value={58}>58 มม.</option>
            <option value={80}>80 มม.</option>
          </select>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.autoPrintReceipt} onChange={(e) => setSettings({ ...settings, autoPrintReceipt: e.target.checked })} />
          <span>Auto-Print ใบเสร็จเมื่อมีออเดอร์ใหม่</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.autoPrintKitchen} onChange={(e) => setSettings({ ...settings, autoPrintKitchen: e.target.checked })} />
          <span>Auto-Print คิวครัวเมื่อยืนยันออเดอร์</span>
        </label>
        {/* R21 (Owner 2026-10-29): ทะเบียนเครื่องพิมพ์ — แอดมินเพิ่ม/ลบ/ผูกบทบาทเองได้ */}
        <div className="border-t border-brand-border pt-4 space-y-3" data-testid="printer-registry">
          <h2 className="font-bold text-brand-accent">🖨️ เครื่องพิมพ์ที่ตั้งไว้</h2>
          {(settings.printers ?? []).length === 0 && (
            <p className="text-sm text-brand-muted">ยังไม่มีเครื่องพิมพ์ในระบบ — เพิ่มด้านล่าง (ค่าเริ่มต้นของร้าน = Nimbot B1Pro)</p>
          )}
          {(settings.printers ?? []).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-border p-3" data-testid={`printer-row-${p.id}`}>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.label}{!p.active && <span className="text-xs text-brand-muted"> (ปิดใช้งาน)</span>}</div>
                <div className="text-xs text-brand-muted">{PRINTER_MODEL_LABELS[p.model]} · {p.paperWidthMm} มม.{p.location ? ` · ${p.location}` : ''}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => testPrintRole(settings.receiptPrinterId === p.id ? 'receipt' : 'kitchen')}>ทดสอบ</button>
              <button className="btn btn-outline btn-sm text-red-500" onClick={() => handleRemovePrinter(p.id)}>ลบ</button>
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">เพิ่มเครื่องใหม่ — ชื่อ</label>
              <input className="input" value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} placeholder="เช่น Nimbot B1Pro — ครัว" data-testid="printer-draft-label" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">โมเดล</label>
              <select
                className="input"
                value={draftModel}
                onChange={(e) => { const m = e.target.value as PrinterModel; setDraftModel(m); setDraftWidth(PRINTER_MODEL_DEFAULT_WIDTH[m]) }}
              >
                {(Object.keys(PRINTER_MODEL_LABELS) as PrinterModel[]).map((m) => (
                  <option key={m} value={m}>{PRINTER_MODEL_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ความกว้างกระดาษ (มม.)</label>
              <input type="number" min={20} max={120} className="input" value={draftWidth} onChange={(e) => setDraftWidth(Number(e.target.value) || 80)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">จุดตั้งเครื่อง (ไม่บังคับ)</label>
              <input className="input" value={draftLocation} onChange={(e) => setDraftLocation(e.target.value)} placeholder="เช่น ครัว / เคาน์เตอร์" />
            </div>
          </div>
          <button className="btn btn-outline" onClick={handleAddPrinter} data-testid="add-printer">➕ เพิ่มเครื่องพิมพ์</button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-sm font-medium mb-1">ใช้เครื่องไหนพิมพ์ "ใบเสร็จ"</label>
              <select className="input" value={settings.receiptPrinterId ?? ''} onChange={(e) => setSettings((s) => assignPrinter(s, 'receipt', e.target.value || null))}>
                <option value="">(ค่าเริ่มต้นของระบบ)</option>
                {(settings.printers ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ใช้เครื่องไหนพิมพ์ "ใบสั่งอาหารเข้าครัว"</label>
              <select className="input" value={settings.kitchenPrinterId ?? ''} onChange={(e) => setSettings((s) => assignPrinter(s, 'kitchen', e.target.value || null))}>
                <option value="">(ค่าเริ่มต้นของระบบ)</option>
                {(settings.printers ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-outline" onClick={() => testPrintRole('receipt')}>ทดสอบใบเสร็จ</button>
            <button className="btn btn-outline" onClick={() => testPrintRole('kitchen')}>ทดสอบใบสั่งครัว</button>
          </div>
          <p className="text-xs text-brand-muted">เครื่องที่ระบบผูกไว้ตอนนี้: ใบเสร็จ = <b>{describePrinterTarget(settings, 'receipt')}</b> · คิวครัว = <b>{describePrinterTarget(settings, 'kitchen')}</b></p>
          <p className="text-xs text-amber-600">💡 ถ้ากดทดสอบแล้วขึ้น <b>"ไม่พบเครื่องพิมพ์"</b> = ต้องเพิ่มเครื่องพิมพ์ด้านบนก่อน แล้วกด "บันทึก"</p>
          <div className="rounded-lg border border-brand-border p-3 text-xs space-y-1" data-testid="print-howto">
            <p className="font-semibold text-brand-accent">📖 วิธีใช้ & เทมเพลต</p>
            <p>• <b>เทมเพลตใบเสร็จ/ใบสั่งครัวอยู่ที่ <code>src/lib/printService.ts</code></b> — <code>buildReceiptHtml</code> / <code>buildKitchenTicketHtml</code> (+ <code>printCss()</code> กำหนดความกว้างจากค่า <b>{settings.paperWidthMm} มม.</b> ด้านบน) · มี unit test คุมที่ <code>printTemplates.test.ts</code> · ของที่ออกแบบในแอป Nimbot = สำหรับป้ายในแอป Nimbot โดยตรง (คนละระบบกับการพิมพ์จากหน้านี้)</p>
            <p>• <b>dialog ไม่มีเครื่องให้เลือก?</b> = Windows ยังไม่รู้จักเครื่องพิมพ์ตัวนั้น — ต้องลงไดรเวอร์ Nimbot (USB/Bluetooth) ให้ขึ้นใน "เครื่องพิมพ์และเครื่องสแกน" ของ Windows ก่อน Chrome จะแสดง (Adobe PDF / Save as PDF = ตัวเสมือนล้วน ไม่ใช่เครื่องจริง)</p>
            <p>• <b>ลำดับตั้งค่า</b>: เพิ่มเครื่อง → ผูกบทบาท (ใบเสร็จ/ใบสั่งครัว) → สวิตช์ Auto-Print → กดบันทึก → ทดสอบ "ทดสอบใบเสร็จ"/"ทดสอบใบสั่งครัว" → ใบสั่งครัวออโต้ = 1 dialog (ใบเสร็จ+ใบรวมหน้า) ต่อ 1 ออเดอร์</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}>{saving ? '⏳ ...' : 'บันทึก'}</button>
          <button className="btn btn-outline" onClick={testPrint}>ทดสอบพิมพ์</button>
        </div>
        <div className="text-xs text-brand-muted space-y-1">
          <p>• ระบบใช้คำสั่งพิมพ์ของเบราว์เซอร์/OS — รองรับเครื่องพิมพ์ทุกตัวที่ Windows/macOS มองเห็น (USB/LAN/Bluetooth ผ่านไดรเวอร์เครื่องพิมพ์)</p>
          <p>• สถานะงานพิมพ์แยกเป็น requested → sent → acknowledged → printed — ระบบจะไม่อ้างว่า "พิมพ์สำเร็จ" จนกว่าจะกดยืนยันเอง</p>
          <p>• ถ้าเครื่องพิมพ์ออฟไลน์: ออเดอร์ยังอยู่ครบ — งานพิมพ์ค้างเป็นสถานะ failed ให้กดพิมพ์ซ้ำภายหลัง</p>
        </div>
      </div>
    </div>
  )
}