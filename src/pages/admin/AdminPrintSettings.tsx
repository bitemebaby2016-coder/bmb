// Bite Me Baby — Printer Settings (migration 128) — Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
// เลือก/ตั้งค่าเครื่องพิมพ์ที่รองรับ + Auto-Print. Browser print fallback ใช้ได้กับ
// เครื่องพิมพ์ทุกตัวที่ OS มองเห็น; ESC/POS raw adapter = แผนระยะถัดไป (ดู docs).
import { useState, useEffect } from 'react'
import { showToast } from '@/components/ui/ToastContainer'
import { loadPrinterSettings, savePrinterSettings, PrinterSettings, DEFAULT_PRINTER_SETTINGS } from '@/lib/printService'

export function AdminPrintSettings() {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

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

  function testPrint() {
    const win = window.open('', '_blank', 'width=380,height=520')
    if (!win) { showToast('เบราว์เซอร์บล็อกหน้าต่างทดสอบพิมพ์', 'warning'); return }
    win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>Test Print</title>
      <style>body{font-family:'Sarabun','Tahoma',sans-serif;font-size:12px;width:72mm;margin:4mm}
      h1{font-size:15px;text-align:center}hr{border:none;border-top:1px dashed #000;margin:6px 0}</style></head><body>
      <h1>Bite Me Baby</h1><div style="text-align:center">ทดสอบเครื่องพิมพ์ / Test Print</div><hr>
      <div>ความกว้างกระดาษ: ${settings.paperWidthMm} มม.</div>
      <div>เครื่องพิมพ์ใบเสร็จ: ${settings.receiptPrinterName || '(ค่าเริ่มต้นของระบบ)'}</div>
      <div>เครื่องพิมพ์คิวครัว: ${settings.kitchenPrinterName || '(ค่าเริ่มต้นของระบบ)'}</div><hr>
      <div style="text-align:center">ไทย: ทดสอบตัวอักษรไทย — ฿123.45</div>
      </body></html>`)
    win.document.close()
    win.focus()
    win.print()
    showToast('เปิดคำสั่งพิมพ์ทดสอบแล้ว — สถานะ "sent" ไม่ได้หมายถึงพิมพ์สำเร็จ', 'info')
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