// Bite Me Baby — Printer Settings (migration 128) — Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
// เลือก/ตั้งค่าเครื่องพิมพ์ที่รองรับ + Auto-Print. Browser print fallback ใช้ได้กับ
// เครื่องพิมพ์ทุกตัวที่ OS มองเห็น; ESC/POS raw adapter = แผนระยะถัดไป (ดู docs).
import { useState, useEffect } from 'react'
import { showToast } from '@/components/ui/ToastContainer'
import { loadPrinterSettings, savePrinterSettings, PrinterSettings, DEFAULT_PRINTER_SETTINGS, createPrinterDef, upsertPrinter, removePrinter, assignPrinter, describePrinterTarget, PRINTER_MODEL_LABELS, PRINTER_MODEL_DEFAULT_WIDTH, type PrinterModel, printHtmlInHiddenFrame, buildBmbStickerHtml, type PrintOrderData } from '@/lib/printService'
import { describeQzError, qzConnect, qzPrintHtml } from '@/lib/qzTray'
import { niimbotSupported, niimbotPrintSticker, describeNiimbotError } from '@/lib/niimbotBt'
import { renderStickerPng, renderCalibrationPng, clampFeedOffset, clampFaceHeight, stickerPageHeight, mmToStickerPx } from '@/lib/stickerPng'
import { printStickerRoll } from '@/lib/stickerQueue'
// R25: ไม่มี local flag — ทุกปุ่มทดสอบยิงผ่าน printHtmlInHiddenFrame (guard กลาง + afterprint cleanup ใน printService)
// (เดิม: popup window.open + win.print() = popup ค้างหลัง Cancel + testPrintRole ไม่มี guard → ซ้อนได้)
// R27: เพิ่ม QZ Tray transport + เทมเพลตสติกเกอร์ BMB 40×60 (ใบเสร็จ+ครัว = ใบเดียวกัน)

export function AdminPrintSettings() {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // R21 (Owner 2026-10-29): ฟอร์มเพิ่มเครื่องพิมพ์เอง — ค่าเริ่มต้น = Nimbot B1Pro ที่ร้านใช้อยู่
  const [draftLabel, setDraftLabel] = useState('Nimbot B1Pro')
  const [draftModel, setDraftModel] = useState<PrinterModel>('nimbot_b1pro')
  const [draftWidth, setDraftWidth] = useState<number>(PRINTER_MODEL_DEFAULT_WIDTH.nimbot_b1pro)
  const [draftLocation, setDraftLocation] = useState('')
  // R27: QZ Tray — สถานะเชื่อมต่อ/รายชื่อเครื่องจาก QZ (ไม่พึ่งไดรเวอร์ Windows)
  const [qzPrinters, setQzPrinters] = useState<string[] | null>(null)
  const [qzBusy, setQzBusy] = useState(false)
  // R29b: ตัวแสดงสถานะ QZ ชัดเจน — connected = พอร์ตในเครื่องตอบแล้ว (เขียว) · down = เห็นเหตุผลใต้ชิป
  const [qzState, setQzState] = useState<'unknown' | 'connected' | 'down'>('unknown')
  const [qzLastError, setQzLastError] = useState('')

  useEffect(() => {
    void (async () => {
      setSettings(await loadPrinterSettings())
      setLoaded(true)
    })()
  }, [])

  // R29: เปิดหน้า = เชื่อม QZ ให้เอง (ถ้าเปิดใช้ไว้) — ไม่ต้องกดเชื่อมใหม่ทุกครั้ง
  // (websocket ตายตอนเปลี่ยนหน้า/รีเฟรช — รีเชื่อมอัตโนมัติ · เงียบ ไม่ toast ทุกรอบ)
  useEffect(() => {
    if (!loaded || !settings.qzEnabled) return
    void handleConnectQz(true)
  }, [loaded])

  async function handleSave() {
    setSaving(true)
    const ok = await savePrinterSettings(settings)
    setSaving(false)
    showToast(ok ? 'บันทึกตั้งค่าเครื่องพิมพ์แล้ว' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
  }

  /** R23: เพิ่มเติม — ปุ่มทดสอบจาก dropdown (R27: ยิงเทมเพลตสติกเกอร์ BMB ผ่าน frame กลาง) */
  async function testPrintFromDropdown() {
    const html = await buildBmbStickerHtml(sampleSticker())
    const r = printHtmlInHiddenFrame(html)
    if (r === 'failed') { showToast('มี dialog พิมพ์เปิดอยู่ (หรือเปิดไม่สำเร็จ) — ปิดก่อนแล้วลองใหม่', 'warning'); return }
    showToast('เปิด dialog แล้ว — เลือกได้เฉพาะเครื่องที่ Windows รู้จัก หรือเปิดใช้ QZ Tray ด้านล่างถ้า Nimbot ไม่มีไดรเวอร์ (ดูกล่องวิธีใช้)', 'info')
  }

  /** ตัวอย่างสติกเกอร์ทดสอบ — อ่านค่าจากแบบฟอร์มเดียวกับตอนพิมพ์จริง (buildPrintOrderData) */
  function sampleSticker(): PrintOrderData {
    return {
      order_number: 'TEST-STICKER',
      created_at: new Date().toISOString(),
      customer_name: 'ทดสอบเครื่องพิมพ์',
      customer_phone: '08x-xxx-xxxx',
      items: [{ product_name: 'เมนูตัวอย่าง', quantity: 1, unit_price: 0, special_request: 'ไม่เผ็ด' }],
      total_amount: 0,
      special_instructions: 'ทดสอบพิมพ์สติกเกอร์ 40x60',
    }
  }

  /** R27: เชื่อมต่อ QZ Tray (qz.websocket.connect → พอร์ตในเครื่อง) แล้วดึงรายชื่อเครื่องพิมพ์
   *  R29: silent=true ใช้ตอนเปิดหน้าอัตโนมัติ — ไม่ toast สำเร็จ/เตือน (แสดงเฉพาะตอนกดเอง) */
  async function handleConnectQz(silent = false) {
    setQzBusy(true)
    try {
      const names = await qzConnect()
      setQzPrinters(names)
      setQzState('connected')
      setQzLastError('')
      if (silent) return
      if (names.length > 0) showToast(`เชื่อมต่อ QZ แล้ว — เจอ ${names.length} เครื่องพิมพ์`, 'success')
      else showToast('เชื่อมต่อ QZ แล้วแต่ไม่เจอเครื่องพิมพ์ — เพิ่มเครื่องใน Windows/QZ ให้ขึ้นในรายการก่อน', 'warning')
    } catch (e) {
      const msg = describeQzError(e)
      setQzState('down')
      setQzLastError(msg)
      if (!silent) showToast(msg, 'error')
      else console.warn('[QZ] auto-connect failed:', e)
    } finally {
      setQzBusy(false)
    }
  }

  /** R27: พิมพ์สติกเกอร์ตัวอย่างเงียบ ๆ ผ่าน QZ (resolve = ส่งงานแล้ว ไม่ใช่คำว่าปริ้นสำเร็จ) */
  async function handleTestStickerQz() {
    if (!settings.qzPrinterName) { showToast('เลือกเครื่องพิมพ์จาก QZ ก่อน แล้วกดบันทึก', 'warning'); return }
    setQzBusy(true)
    try {
      const html = await buildBmbStickerHtml(sampleSticker())
      await qzPrintHtml(settings.qzPrinterName, html, { widthMm: 40, heightMm: 60, jobName: 'test-sticker' })
      showToast(`ส่งสติกเกอร์ทดสอบเข้า QZ → "${settings.qzPrinterName}" แล้ว (sent = ส่งงานเข้าคิว ยังไม่ใช่ยืนยันปริ้นสำเร็จ)`, 'success')
    } catch (e) {
      showToast(describeQzError(e), 'error')
    } finally {
      setQzBusy(false)
    }
  }

  async function testPrint() {
    const html = await buildBmbStickerHtml(sampleSticker())
    const r = printHtmlInHiddenFrame(html)
    if (r === 'failed') { showToast('มี dialog พิมพ์เปิดอยู่ (หรือเปิดไม่สำเร็จ) — ปิดก่อนแล้วลองใหม่', 'warning'); return }
    showToast('เปิดคำสั่งพิมพ์ทดสอบ (เทมเพลตสติกเกอร์ BMB) — กด Cancel = หยุดจริง (ไม่มีงานซ้อน) · สถานะ "sent" ไม่ได้หมายถึงพิมพ์สำเร็จ', 'info')
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

  async function testPrintRole(role: 'receipt' | 'kitchen') {
    const target = describePrinterTarget(settings, role)
    // R27: ทดสอบ = เทมเพลตสติกเกอร์ BMB จริง (ใบเสร็จ/ครัว = ใบเดียวกัน)
    const html = await buildBmbStickerHtml(sampleSticker())
    const r = printHtmlInHiddenFrame(html)
    if (r === 'failed') { showToast('มี dialog พิมพ์เปิดอยู่ (หรือเปิดไม่สำเร็จ) — ปิดก่อนแล้วลองใหม่', 'warning'); return }
    showToast(`ส่งสติกเกอร์ทดสอบไปที่ "${target}" — กด Cancel = หยุดจริง (ไม่มีงานซ้อน) · สถานะ "sent" ไม่ได้หมายถึงพิมพ์สำเร็จ`, 'info')
  }

  // R30: สถานะพิมพ์ผ่าน Bluetooth (Nimbot โดยตรง — ทางหลักของ B1 Pro)
  const [btBusy, setBtBusy] = useState(false)
  const [btState, setBtState] = useState<'unknown' | 'printing' | 'done' | 'down'>('unknown')
  const [btErr, setBtErr] = useState('')
  const [btProgress, setBtProgress] = useState('')
  // R31 (Owner: "ใบว่าง"): โชว์ PNG ที่จะยิงจริงก่อนสั่งพิมพ์ — เห็นขาว = ปัญหาอยู่ที่ render, เห็นตัวอักษร = ปัญหาอยู่ที่เครื่อง/การลงทะเบียน
  const [btPreview, setBtPreview] = useState('')

  /** R40 — จุดเดียวที่ทุกปุ่ม Bluetooth ใช้ร่วมกัน: ค่าที่โชว์บนจอ = ค่าที่ยิงเข้าเครื่องเสมอ (off · faceH · หน้า px) */
  async function btPrintWith(off: number, faceH: number, kind: 'sticker' | 'calibration' = 'sticker', copies = 1): Promise<void> {
    setBtBusy(true)
    setBtState('printing')
    setBtErr('')
    setBtProgress('')
    setBtPreview('')
    try {
      if (!niimbotSupported()) {
        setBtState('down')
        setBtErr('เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth — เปิดด้วย Chrome/Edge (https) เท่านั้น')
        return
      }
      const png = kind === 'sticker'
        ? await renderStickerPng(sampleSticker(), off, faceH)
        : await renderCalibrationPng(faceH)
      setBtPreview(png) // เห็นรูปทันที — ตรวจ "มีตัวอักษร?" + ตำแหน่งเนื้อก่อนเครื่องวิ่ง
      if (kind === 'sticker' && copies > 1) {
        // หลายใบ = job เดียวผ่านคิวเดียวกับงานออเดอร์จริง (ตรวจ "ข้ามดวงสะสม" ได้ตรงจริง)
        await printStickerRoll(Array.from({ length: copies }, () => sampleSticker()), { onProgress: (s) => setBtProgress(s), offsetY: off, faceH })
      } else {
        await niimbotPrintSticker(png, { onProgress: (s) => setBtProgress(s), offsetY: off, faceH })
      }
      setBtState('done')
      showToast(kind === 'calibration'
        ? '✅ ใบวัดฟีดออกแล้ว — อ่าน 3 จุด: (ก) เส้น 0px หายเหนือขอบบน → ใส่ +N · (ข) แถบขาวเหนือเส้น 0px → ใส่ −N · (ค) เส้นขอบล่างเลยขอบล่างดวง → ใส่ "ความสูงหน้าดวง" = เลขนั้น'
        : `✅ พิมพ์×${copies} · ชดเชยฟีด ${off > 0 ? '+' : ''}${off}px · หน้าดวง ${faceH}px · PNG/SetPageSize 472×${stickerPageHeight(off, faceH)}px — ตรวจกระดาษ`, 'success')
    } catch (e) {
      const msg = describeNiimbotError(e)
      setBtState('down')
      setBtErr(msg)
      showToast(msg, 'error')
    } finally {
      setBtBusy(false)
    }
  }

  async function handleBtTest() {
    await btPrintWith(clampFeedOffset(settings.stickerOffsetYPx ?? 0), clampFaceHeight(settings.stickerFaceHPx ?? 709), 'sticker', 1)
  }

  /** R33: พิมพ์ "ใบวัดฟีด" — เส้นขีด px/mm บนดวงจริง (offset คงที่ 0 = ค่า raw ของเครื่อง)
   *  อ่านว่าเส้น 0px ตรงขอบบนดวงพอดีไหม → ได้ค่าชดเชยเป็นตัวเลข ไม่ต้องเดา · ตรวจด้วยว่าการข้ามดวงสะสมไหม */
  async function handleBtCalibration() {
    await btPrintWith(0, clampFaceHeight(settings.stickerFaceHPx ?? 709), 'calibration', 1)
  }

  // ─── R40 วิซาร์ดตั้งค่า (Owner: "ตั้งหลักเริ่มใหม่ ทดสอบเองได้เลย + บอกวิธีใช้ ชดเชยฟีด กับ ความสูงหน้าดวง") ───
  // วงปิด: ใส่ค่า → บันทึกอัตโนมัติ (ถ้าบันทึกไม่สำเร็จ = ไม่ยิงพิมพ์) → พิมพ์ด้วยค่าที่โชว์บนจอทันที → ดูกระดาษ → ขยับใหม่
  const [wizValue, setWizValue] = useState('')
  async function handleWizard(kind: 'offset' | 'face' | 'x4') {
    if (btBusy) return
    if (kind === 'x4') {
      await btPrintWith(clampFeedOffset(settings.stickerOffsetYPx ?? 0), clampFaceHeight(settings.stickerFaceHPx ?? 709), 'sticker', 4)
      return
    }
    const raw = Number(wizValue)
    if (!wizValue.trim() || !Number.isFinite(raw)) {
      showToast('ใส่ค่าก่อน — "ชดเชยฟีด" = px (เช่น 20) · "หน้าดวง" = มม. (เช่น 62)', 'error')
      return
    }
    let next: PrinterSettings
    let label: string
    if (kind === 'offset') {
      const v = clampFeedOffset(raw)
      next = { ...settings, stickerOffsetYPx: v }
      label = `ชดเชยฟีด ${v >= 0 ? '+' : ''}${v}px`
    } else {
      const px = clampFaceHeight(mmToStickerPx(raw))
      next = { ...settings, stickerFaceHPx: px }
      label = `หน้าดวง ${raw} มม. → ${px}px`
    }
    setSettings(next)
    const saved = await savePrinterSettings(next)
    if (!saved) {
      showToast('บันทึกค่าไม่สำเร็จ — ยังไม่สั่งพิมพ์ (ค่าใหม่ยังไม่ลงฐานข้อมูล)', 'error')
      return
    }
    const off = clampFeedOffset(next.stickerOffsetYPx ?? 0)
    const face = clampFaceHeight(next.stickerFaceHPx ?? 709)
    await btPrintWith(off, face, 'sticker', 1)
    showToast(`🧪 ${label} = บันทึกแล้ว · พิมพ์ด้วย 472×${stickerPageHeight(off, face)}px — ดูผลบนกระดาษแล้วขยับใหม่ได้เลย`, 'success')
  }

  if (!loaded) return <p className="text-brand-muted">กำลังโหลดตั้งค่า...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-accent">🖨️ ตั้งค่าเครื่องพิมพ์</h1>
      <div className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">ชื่ออ้างอิง "ใบเสร็จ"</label>
            <input className="input" value={settings.receiptPrinterName} onChange={(e) => setSettings({ ...settings, receiptPrinterName: e.target.value })} placeholder="เช่น EPSON TM-T20III (Counter)" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ชื่ออ้างอิง "คิวครัว"</label>
            <input className="input" value={settings.kitchenPrinterName} onChange={(e) => setSettings({ ...settings, kitchenPrinterName: e.target.value })} placeholder="เช่น RONGTA RP80 (Kitchen)" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ความกว้างกระดาษ (มม.)</label>
            <select className="input w-full" value={settings.paperWidthMm} onChange={(e) => setSettings({ ...settings, paperWidthMm: Number(e.target.value) })}>
              <option value={58}>58 มม.</option>
              <option value={80}>80 มม.</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.autoPrintReceipt} onChange={(e) => setSettings({ ...settings, autoPrintReceipt: e.target.checked })} />
            <span>Auto-Print ใบเสร็จ</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.autoPrintKitchen} onChange={(e) => setSettings({ ...settings, autoPrintKitchen: e.target.checked })} />
            <span>Auto-Print ใบสั่งครัว</span>
          </label>
          {/* R31 (Owner): คิวสติกเกอร์ Bluetooth อัตโนมัติ — 1 ดวง ต่อ 1 ชิ้น ต่อกันหลายใบหลังกดรับออเดอร์ */}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.autoPrintStickers ?? true} onChange={(e) => setSettings({ ...settings, autoPrintStickers: e.target.checked })} data-testid="auto-print-stickers" />
            <span>Auto-Print สติกเกอร์ Bluetooth (1 ดวง/ชิ้น · ทุกช่องทาง)</span>
          </label>
          <span className="text-xs text-brand-muted">(ปิดได้ = พิมพ์เองจากปุ่มในหน้าออเดอร์)</span>
        </div>
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
              <button className="btn btn-outline btn-sm" onClick={() => void testPrintRole(settings.receiptPrinterId === p.id ? 'receipt' : 'kitchen')}>ทดสอบ</button>
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
            <button className="btn btn-outline" onClick={() => void testPrintRole('receipt')}>ทดสอบใบเสร็จ ⚠ ไม่ใช้ชดเชย</button>
            <button className="btn btn-outline" onClick={() => void testPrintRole('kitchen')}>ทดสอบใบสั่งครัว ⚠ ไม่ใช้ชดเชย</button>
          </div>
          {/* R27 (Owner): QZ Tray — ทางพิมพ์สติกเกอร์ไม่พึ่งไดรเวอร์ Windows (Nimbot B1Pro มีไดรเวอร์แค่ Win7) */}
          <div className="border-t border-brand-border pt-3 space-y-2" data-testid="qz-tray-panel">
            <h2 className="font-bold text-brand-accent">🔗 QZ Tray (ตัวกลางพิมพ์สติกเกอร์ 40×60)</h2>
            {/* R29b: สถานะแบบเห็นชัด — เขียว = เชื่อมต่อพอร์ตในเครื่องแล้ว · แดง = บอกเหตุผล + วิธีต่อ */}
            <div className="flex items-center gap-2 text-sm" data-testid="qz-status">
              <span className={qzState === 'connected' ? 'text-green-600 font-semibold' : qzState === 'down' ? 'text-red-500 font-semibold' : 'text-brand-muted'}>
                ● {qzState === 'connected' ? 'QZ เชื่อมต่อแล้ว (พอร์ตในเครื่อง)' : qzState === 'down' ? 'QZ ยังเชื่อมต่อไม่ได้' : 'ยังไม่ได้เชื่อมต่อ QZ'}
              </span>
              {qzState === 'connected' && <span className="text-xs text-brand-muted">เปิดหน้านี้ไว้ = เชื่อมตลอด · รีเฟรชก็ต่อให้เอง</span>}
            </div>
            {qzState === 'down' && (
              <p className="text-xs text-red-400">
                {qzLastError} → เปิดโปรแกรม <b>QZ Tray</b> บนเครื่องนี้ค้างไว้ แล้วกด "เชื่อมต่อ &amp; ดึงรายชื่อ"
                {qzLastError.includes('Allow') ? ' · ครั้งแรกให้ติ๊ก Remember this decision + Allow ในกล่องของ QZ' : ''}
              </p>
            )}
            <p className="text-xs text-brand-muted">ใบเสร็จ + ใบสั่งครัว = <b>สติกเกอร์แบบฟอร์มเดียวกัน</b> (เทมเพลต BMB 40×60) · QZ Tray เชื่อมผ่านพอร์ตในเครื่อง ไม่ต้องง้อไดรเวอร์ของ Windows — ต้องเปิดโปรแกรม QZ Tray บนเครื่องที่ต่อเครื่องพิมพ์ไว้ก่อน แล้วกด "เชื่อมต่อ" (ครั้งแรกกด Allow + ติ๊ก Remember this decision · ใช้หน้าต่างปกติ ไม่ใช่ Incognito = ไม่ถามใหม่ทุกครั้ง)</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.qzEnabled ?? false} onChange={(e) => setSettings({ ...settings, qzEnabled: e.target.checked })} />
              <span>เปิดใช้ QZ Tray เป็นทางพิมพ์หลัก (ปิด = ใช้ dialog เดิมของเบราว์เซอร์/OS เหมือนเคย)</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">เครื่องพิมพ์จาก QZ</label>
                <select
                  className="input"
                  value={settings.qzPrinterName ?? ''}
                  onChange={(e) => setSettings({ ...settings, qzPrinterName: e.target.value })}
                  data-testid="qz-printer-select"
                >
                  <option value="">(ยังไม่ได้เลือก)</option>
                  {(qzPrinters ?? (settings.qzPrinterName ? [settings.qzPrinterName] : [])).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2 flex-wrap">
                <button className="btn btn-outline" disabled={qzBusy} onClick={() => void handleConnectQz()} data-testid="qz-connect">{qzBusy ? '⏳ ...' : 'เชื่อมต่อ & ดึงรายชื่อเครื่อง'}</button>
                <button className="btn btn-outline" disabled={qzBusy} onClick={() => void handleTestStickerQz()} data-testid="qz-test-sticker">ทดสอบสติกเกอร์ (QZ) ⚠ ไม่ใช้ชดเชย</button>
              </div>
            </div>
          </div>
          {/* R30 (Owner): พิมพ์ตรงผ่าน Web Bluetooth — จบปัญหา ไดรเวอร์/คิว/spooler/COM (Nimbot พูดภาษาจีน → driver ภาษาจีน reverse แล้ว validated บน B1 Pro) */}
          <div className="border-t border-brand-border pt-3 space-y-2" data-testid="bt-panel">
            <h2 className="font-bold text-brand-accent">📡 พิมพ์ผ่าน Bluetooth — Nimbot B1 Pro โดยตรง (ไม่ง้อ QZ/ไดรเวอร์/คิว)</h2>
            <p className="text-xs text-brand-muted">เบราว์เซอร์คุยกับเครื่องผ่าน BLE ตรง ๆ (protocol จีนของ Nimbot ในตัว) · Chrome/Edge + HTTPS · ใช้ปุ่มเดียว = เลือกเครื่อง + พิมพ์ · ~5-10 วิ/ใบ</p>
            <div className="flex items-center gap-2 text-sm">
              <span className={!niimbotSupported() ? 'text-red-500 font-semibold' : btState === 'done' ? 'text-green-600 font-semibold' : btState === 'down' ? 'text-red-500 font-semibold' : 'text-brand-muted'}>
                ● {!niimbotSupported() ? 'เบราว์เซอร์นี้ไม่รองรับ (ใช้ Chrome/Edge)' : btState === 'printing' ? `กำลังส่งเข้าเครื่อง… ${btProgress}` : btState === 'done' ? 'พิมพ์ยืนยันแล้ว ✓' : btState === 'down' ? 'ยังพิมพ์ไม่สำเร็จ' : 'พร้อม — กดปุ่มแล้วเลือก B1 Pro ในกล่อง Windows'}
              </span>
            </div>
            {/* R31: preview รูปจริงที่จะพิมพ์ — ขาว = render มีปัญหา (แจ้งเรา) · มีตัวอักษร = ดูที่เครื่อง/ม้วนกระดาษ */}
            {btPreview && (
              <div className="flex items-center gap-3" data-testid="bt-preview">
                <img src={btPreview} alt="sticker preview" className="w-28 border border-brand-border rounded" />
                <p className="text-xs text-brand-muted">รูปจริงที่ส่งเข้าเครื่อง (472×{709 + Math.max(0, clampFeedOffset(settings.stickerOffsetYPx ?? 0))}px รวมชดเชยฟีด — 40×60 มม. @300dpi) — ขาวสนิท = แจ้งทีมว่า "preview ว่าง" · มีตัวอักษรแต่พิมพ์ไม่ตรงขอบ/ข้ามดวง = ใช้ใบวัดฟีดด้านล่างแล้วใส่ค่าชดเชย</p>
              </div>
            )}
            {btState === 'down' && btErr && <p className="text-xs text-red-400">{btErr}</p>}
            {/* R33 (Owner: "พิมไม่ตรง/ข้ามดวง"): ชดเชยฟีดแนวตั้ง — ค่าเดียวใช้ทุกทาง (ทดสอบ/อัตโนมัติ) · วัดจากใบวัดฟีด */}
            <div className="flex items-center gap-2 text-sm flex-wrap" data-testid="bt-feed-offset-row">
              <label htmlFor="sticker-offset-ypx" className="whitespace-nowrap font-medium">ชดเชยฟีดแนวตั้ง (px)</label>
              <input
                id="sticker-offset-ypx"
                type="number"
                min={-40}
                max={300}
                step={1}
                className="input w-24"
                value={settings.stickerOffsetYPx ?? 0}
                onChange={(e) => setSettings({ ...settings, stickerOffsetYPx: clampFeedOffset(Number(e.target.value)) })}
                data-testid="sticker-offset-ypx"
              />
              <span className="text-xs text-brand-muted">+ = เนื้อหาเลื่อนลง (แก้ภาพข้ามขอบบน) · − = เลื่อนขึ้น (จำกัด −40 กันหัวเรื่องโดนตัด) · พิมพ์ใบวัดฟีด → อ่านค่า → ใส่ → กดบันทึก = มีผลทุกทาง (ทดสอบ + ออโต้พิมพ์)</span>
            </div>
            {/* R34 (Owner: "ยังข้ามดวง"): ความสูงหน้าดวงจริง — ถ้าใบวัดฟีดเส้นขอบล่างเลยขอบล่างดวง = หน้าสั้นกว่า 709 → ใส่ค่าที่วัดได้ (QR เลื่อนขึ้นเอง ไม่ล้นดวง) */}
            <div className="flex items-center gap-2 text-sm flex-wrap" data-testid="bt-face-height-row">
              <label htmlFor="sticker-face-hpx" className="whitespace-nowrap font-medium">ความสูงหน้าดวง (px)</label>
              <input
                id="sticker-face-hpx"
                type="number"
                min={640}
                max={760}
                className="input w-28"
                value={settings.stickerFaceHPx ?? 709}
                onChange={(e) => setSettings({ ...settings, stickerFaceHPx: clampFaceHeight(Number(e.target.value)) })}
                data-testid="sticker-face-hpx"
              />
              <span className="text-xs text-brand-muted">709 = 40×60 มาตรฐาน (ค่าเริ่มต้น) · วัดจากใบวัดฟีด: เส้นขอบล่างตรงขอบล่างดวงจริง = ค่านี้ถูก · ไม่ตรง = ใส่เลขเส้นที่ตรงพอดี → PNG/SetPageSize/ตำแหน่ง QR ปรับตามอัตโนมัติ</span>
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <button className="btn btn-outline" disabled={btBusy} onClick={() => void handleBtTest()} data-testid="bt-test-print">{btBusy ? '⏳ ...' : '🔗 เชื่อม & พิมพ์สติกเกอร์ทดสอบ (Bluetooth — ใช้ค่าชดเชย/หน้าดวง)'}</button>
              <button className="btn btn-outline" disabled={btBusy} onClick={() => void handleBtCalibration()} data-testid="bt-calibration-print">{btBusy ? '⏳ ...' : '📏 พิมพ์ใบวัดฟีด (วัด offset จริง)'}</button>
            </div>
            <p className="text-xs text-brand-muted">🛟 <b>ใบวัดฟีด:</b> พิมพ์ออกมาเป็นเส้นขีด px/mm บนดวงจริง → อ่านตาม 2 กรณี: <b>(ก)</b> เส้น <b>0px หายเหนือขอบบน</b> (หัว BITE ME BABY หลุดข้ามใบก่อน = เครื่องเริ่มพิมพ์ "ก่อน" ขอบ) → ดูว่าเส้นตัวเลขไหนตรงขอบบนพอดี มีค่า <b>N → ใส่ +N</b> · <b>(ข)</b> มี<b>แถบขาว N px เหนือเส้น 0px</b> (เครื่องเริ่มช้า) → <b>ใส่ −N</b> · เส้น 0px ตรงขอบพอดีอยู่แล้ว = 0 · ยังไม่ตรง/ข้ามดวงเรื่อย ๆ ทั้งที่ใส่ค่าแล้ว = ลอง calibrate ม้วนที่ตัวเครื่อง (ปุ่ม feed ค้างตอนปิดฝาตามคู่มือ B1 Pro) แล้วแจ้งทีม</p>
            <p className="text-xs text-brand-muted">🔒 Allow QZ ขึ้นทุกครั้ง? = เพราะเปิดหน้าใน <b>Incognito</b> (ไม่จดจำสิทธิ์) → ใช้หน้าต่างปกติ + ติ๊ก <b>Remember this decision</b> ในกล่อง QZ = ถามครั้งเดียว · Bluetooth ก็เหมือนกัน — จับคู่ครั้งแรกในหน้าปกติจะไม่ถามอีก</p>
          </div>
          <p className="text-xs text-brand-muted">ผูกไว้: ใบเสร็จ = <b>{describePrinterTarget(settings, 'receipt')}</b> · ครัว = <b>{describePrinterTarget(settings, 'kitchen')}</b> — ทดสอบแล้วขึ้น "ไม่พบเครื่องพิมพ์" = เพิ่มเครื่องด้านบนก่อนแล้วกดบันทึก</p>
          {/* R40 — วิซาร์ดตั้งค่า 2 ตัว + วิธีใช้ (Owner: ตั้งหลักใหม่ · ทดสอบเอง · บอกวิธีใช้ชดเชยฟีด/หน้าดวง) */}
          <div className="rounded-xl border border-brand-accent/40 bg-brand-surface p-3 space-y-2" data-testid="sticker-wizard">
            <p className="text-sm font-bold text-brand-accent">🧭 ตั้งค่าเองทีละขั้น — วัดจากกระดาษจริง ไม่ต้องเดา</p>
            <p className="text-xs text-brand-muted">
              ทุกปุ่มด้านล่าง = <b>บันทึกค่าให้อัตโนมัติ แล้วพิมพ์ทดสอบด้วยค่านั้นทันที</b> · ค่าที่ใช้ตอนนี้:{' '}
              <b data-testid="sticker-live-values">ชดเชยฟีด {settings.stickerOffsetYPx ?? 0}px · หน้าดวง {settings.stickerFaceHPx ?? 709}px · PNG/SetPageSize 472×{stickerPageHeight(settings.stickerOffsetYPx ?? 0, settings.stickerFaceHPx ?? 709)}px</b>{' '}
              — ถ้าพิมแล้วผล "ไม่เปลี่ยนเลย" ทั้งที่เลขจอเปลี่ยน = ค่าเข้าเครื่องแล้วแต่ฮาร์ด/ไลบรารีไม่เชื่อ → เก็บหลักฐานรูปพร้อมเลขนี้แจ้งทีม
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs">ค่าทดลอง
                <input className="input w-28" inputMode="decimal" value={wizValue} onChange={(e) => setWizValue(e.target.value)} placeholder="20 หรือ 62" data-testid="sticker-wiz-value" />
              </label>
              <button className="btn btn-primary text-xs" disabled={btBusy} onClick={() => void handleWizard('offset')} data-testid="sticker-wiz-offset">⬇️ ใช้เป็น "ชดเชยฟีด" (px) + พิมพ์ทดสอบ</button>
              <button className="btn btn-outline text-xs" disabled={btBusy} onClick={() => void handleWizard('face')} data-testid="sticker-wiz-face">↕️ ใช้เป็น "หน้าดวง" (มม. ×11.81) + พิมพ์ทดสอบ</button>
              <button className="btn btn-outline text-xs" disabled={btBusy} onClick={() => void handleWizard('x4')} data-testid="sticker-wiz-x4">🖨️ พิมพ์ต่อเนื่อง 4 ใบ (ตรวจน้ำข้ามดวง)</button>
            </div>
            <div className="text-xs text-brand-muted space-y-1">
              <p><b>📖 "ชดเชยฟีด (px)" ใช้ยังไง</b> — ขยับเนื้อหาส่วนบนลง/ขึ้น "ภายในหน้าเดิม" (R41: <b>หน้าเท่าเดิม — ไม่ยืดหน้า</b>): หัว BITE ME BABY โดนตัด/หายขอบบน → ใส่ <b>+N</b> (เนื้อหาเลื่อนลง · QR ยังผูกขอบล่างดวง) · มีแถบขาวมากเหนือเส้น 0 ของใบวัด → ใส่ <b>−N</b> · เริ่มที่ 0 แล้วขยับทีละ 10–20 จนตรง (ค่าที่ใช้ตอนนี้ = 62 ตามที่ทดสอบแล้วตรง)</p>
              <p><b>📖 "ความสูงหน้าดวง" ใช้ยังไง</b> — ความสูง 1 ดวงที่เครื่องฟีดต่อใบ (px @300dpi · มม. ×11.81): <b>709 = 60 มม. มาตรฐาน</b> · พิมแล้ว "ข้ามดวงสะสม/หัวข้ามร่อง" → วัดระยะ <b>ขอบล่าง→ขอบล่าง ของดวงติดกัน (มม.)</b> × 11.81 ใส่เป็นค่านี้ (ใส่เป็น มม. ในช่องวิซาร์ดก็ได้) · QR ผูกขอบล่างอัตโนมัติเสมอ</p>
              <p>⚠️ <b>ปุ่ม "ทดสอบสติกเกอร์ (QZ)" / "ทดสอบใบเสร็จ-ใบสั่งครัว" / "ทดสอบพิมพ์" = ทาง HTML ของ Windows ไม่ใช้ 2 ค่านี้</b> — ปรับให้เห็นผลต้องใช้ปุ่ม <b>Bluetooth</b> ในแผงนี้ · ออเดอร์จริง (auto-print) ใช้ Bluetooth = ค่าเดียวกับแผงนี้เสมอ</p>
            </div>
          </div>
          <details className="rounded-lg border border-brand-border text-xs" data-testid="print-howto">
            <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-brand-accent">📖 วิธีใช้ & เทมเพลต — แตะเพื่อกาง</summary>
            <div className="px-3 pb-3 space-y-1">
              <p>• <b>เทมเพลตสติกเกอร์ BMB 40×60 (ใบเสร็จ+ครัวใช้ใบเดียวกัน)</b> — <code>buildBmbStickerHtml</code> ใน <code>src/lib/printService.ts</code> แบบมาจาก Templates-BmB ของ Owner: ป้ายซ้ายฝังตาย ค่าอ่านจากแบบฟอร์มออเดอร์เท่านั้น (หลัง : ) · QR = biteme-baby.com · unit test: <code>bmbSticker.test.ts</code> / <code>printTemplates.test.ts</code></p>
              <p>• <b>Nimbot ไม่มีไดรเวอร์ Win10?</b> → เปิดใช้ <b>QZ Tray</b> ด้านบน: ลงโปรแกรม QZ Tray → เปิดโปรแกรมค้างไว้ → กด "เชื่อมต่อ & ดึงรายชื่อ" (ครั้งแรกติ๊ก <b>Remember this decision</b> + Allow ใน QZ) → เลือกเครื่อง → บันทึก → "ทดสอบสติกเกอร์ (QZ)" · ทาง dialog เดิมยังใช้ได้เสมอเมื่อปิดสวิตช์ QZ</p>
              <p>• <b>คิวพิมพ์ขึ้น Error / พิมพ์ไม่ออก / รีสตารทแล้วยังค้าง?</b> = เช็คไดรเวอร์ของคิวใน "อุปกรณ์และเครื่องพิมพ์": ถ้าคิวเป็น <b>Generic / Text Only</b> → เปลี่ยนมาเลือกคิวที่มีไดรเวอร์จริง (เช่น <code>B1 Pro-I…</code> ที่ติดตั้งมาจาก Nimbot) ใน dropdown ด้านบน · ล้างงานค้าง = คลิกขวาคิว → Cancel All Documents หรือรัน <code>e2e/print_clear_queue.cmd</code> <b>ในฐานะ Administrator</b></p>
              <p>• <b>พิมพ์ไม่ตรงขอบ / ข้ามดวง (R33)?</b> = วัดด้วย <b>📏 พิมพ์ใบวัดฟีด</b> (offset 0 = ค่า raw ของเครื่อง) → อ่านเส้นที่ตรงขอบบนดวง → ใส่เป็น "ชดเชยฟีดแนวตั้ง" → บันทึก → ทดสอบซ้ำ · ต้นเหตุฝั่งฮาร์ดแวร์ที่พบบ่อย = ม้วนไม่ถูก calibrate ที่เครื่อง (ปุ่ม feed ค้างตอนใส่ม้วนใหม่) · registry ของไลบรารีเองยอมรับว่า size T40x60 ยังไม่เคยถูกวัดบนกระดาษจริง → ค่าที่ได้จากใบวัด = ค่าจริงของเครื่องร้านเรา</p>
              <p>• <b>ลำดับตั้งค่า</b>: เพิ่มเครื่อง → ผูกบทบาท (ใบเสร็จ/ใบสั่งครัว) → สวิตช์ Auto-Print → กดบันทึก → ทดสอบ "ทดสอบใบเสร็จ"/"ทดสอบใบสั่งครัว" → ใบสั่งครัวออโต้ = 1 dialog (ใบเสร็จ+ใบรวมหน้า) ต่อ 1 ออเดอร์</p>
              <p>• ทางพิมพ์ R27: <b>QZ Tray</b> (เปิดสวิตช์ด้านบน) = ส่งงานเงียบ ๆ ผ่านตัวกลาง ไม่พึ่งไดรเวอร์ Windows · ปิดสวิตช์ = คำสั่งพิมพ์ของเบราว์เซอร์/OS เดิม (รองรับเครื่องพิมพ์ทุกตัวที่ Windows/macOS มองเห็น)</p>
              <p>• สถานะงานพิมพ์แยกเป็น requested → sent → acknowledged → printed — ระบบจะไม่อ้างว่า "พิมพ์สำเร็จ" จนกว่าจะกดยืนยันเอง · เครื่องพิมพ์ออฟไลน์: ออเดอร์อยู่ครบ งานพิมพ์ค้างเป็น failed ให้กดพิมพ์ซ้ำ</p>
            </div>
          </details>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}>{saving ? '⏳ ...' : 'บันทึก'}</button>
          <button className="btn btn-outline" onClick={() => void testPrint()}>ทดสอบพิมพ์ ⚠ ไม่ใช้ชดเชย (ไดอะล็อกเบราว์เซอร์)</button>
        </div>
      </div>
    </div>
  )
}