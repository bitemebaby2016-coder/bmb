import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { mmToStickerPx, stickerPageHeight, clampFaceHeight } from '@/lib/stickerPng'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const printSrc = read('src/pages/admin/AdminPrintSettings.tsx')
const mkSrc = read('src/pages/admin/AdminMarketing.tsx')
const imgSrc = read('supabase/functions/image-gen/index.ts')

describe('R40-1 · สติกเกอร์ — วิซาร์ดตั้งค่า (ตั้งหลักใหม่) + วิธีใช้ 2 ค่า + ปุ่มที่ไม่ใช้ค่าต้องเตือน', () => {
  it('pure: mm→px @300dpi + หน้า px = faceH+offset บวก (คณิตที่วิซาร์ด/จอโชว์ = ค่าพิมพ์จริง)', () => {
    expect(mmToStickerPx(60)).toBe(709) // มาตรฐาน 40×60
    expect(mmToStickerPx(25.4)).toBe(300)
    expect(clampFaceHeight(mmToStickerPx(62))).toBe(732)
    expect(stickerPageHeight(30, 709)).toBe(739) // offset บวก = หน้ายาวขึ้นตาม
    expect(stickerPageHeight(-30, 709)).toBe(709) // ติดลบ = หน้าเท่าเดิม
  })

  it('source: btPrintWith = จุดเดียวของทุกปุ่ม BT (handleBtTest/ใบวัด/วิซาร์ดเรียกทางนี้) — จอ=เครื่อง', () => {
    expect(printSrc).toContain("async function btPrintWith(off: number, faceH: number")
    expect(printSrc).toContain('renderStickerPng(sampleSticker(), off, faceH)')
    expect(printSrc).toContain('renderCalibrationPng(faceH)')
    expect(printSrc).toContain('await btPrintWith(clampFeedOffset(settings.stickerOffsetYPx ?? 0), clampFaceHeight(settings.stickerFaceHPx ?? 709), \'sticker\', 1)')
    expect(printSrc).toContain("btPrintWith(0, clampFaceHeight(settings.stickerFaceHPx ?? 709), 'calibration', 1)")
  })

  it('source: วิซาร์ด = บันทึกอัตโนมัติ(savePrinterSettings) → พิมพ์ด้วยค่านั้น · ล้มบันทึก = ไม่ยิงพิมพ์ · x4 ตรวจข้ามดวง', () => {
    expect(printSrc).toContain('data-testid="sticker-wizard"')
    expect(printSrc).toContain("async function handleWizard(kind: 'offset' | 'face' | 'x4')")
    expect(printSrc).toContain('const saved = await savePrinterSettings(next)')
    expect(printSrc).toContain('บันทึกค่าไม่สำเร็จ — ยังไม่สั่งพิมพ์')
    expect(printSrc).toContain("if (!saved) {")
    expect(printSrc).toContain("'sticker', 4)") // พิมพ์ต่อเนื่อง 4 ใบ = printStickerRoll
    expect(printSrc).toContain('printStickerRoll(Array.from({ length: copies }')
    expect(printSrc).toContain('data-testid="sticker-wiz-offset"')
    expect(printSrc).toContain('data-testid="sticker-wiz-face"')
    expect(printSrc).toContain('data-testid="sticker-wiz-x4"')
    expect(printSrc).toContain('data-testid="sticker-live-values"')
    expect(printSrc).toContain('stickerPageHeight(settings.stickerOffsetYPx ?? 0, settings.stickerFaceHPx ?? 709)')
  })

  it('source: วิธีใช้ครบ 2 ค่า + ปุ่มที่ไม่ใช้ค่าชดเชยถูกเตือน ⚠ ทุกจุด (Owner: ตั้งหลายที่แต่ไม่เห็นเปลี่ยน)', () => {
    expect(printSrc).toContain('"ชดเชยฟีด (px)" ใช้ยังไง')
    expect(printSrc).toContain('"ความสูงหน้าดวง" ใช้ยังไง')
    expect(printSrc).toContain('ขอบล่าง→ขอบล่าง ของดวงติดกัน')
    expect(printSrc).toContain('× 11.81')
    // ปุ่ม HTML/ไดอะล็อก = ไม่ใช้ 2 ค่า → ต้องโชว์ ⚠ (Owner เคยตั้งค่าแล้ววัดผลผิดทาง)
    expect(printSrc.match(/ไม่ใช้ชดเชย/g)!.length).toBeGreaterThanOrEqual(4) // QZ + receipt + kitchen + dialog
    expect(printSrc).toContain('Bluetooth — ใช้ค่าชดเชย/หน้าดวง')
  })
})

describe('R40-2 · image-gen — สถานะ + พรีวิว + อัลบั้มโฟลเดอร์แยก + error ต้องเป็น JSON อ่านได้', () => {
  it('AdminMarketing: genStatus 3 สถานะ (running/ok/fail) + การ์ดสถานะ + พรีวิวผล + อัลบั้มเลือกใช้ได้', () => {
    expect(mkSrc).toContain("phase: 'idle' | 'running' | 'ok' | 'fail'")
    expect(mkSrc).toContain('data-testid="mk-gen-status"')
    expect(mkSrc).toContain('<b>กำลังสร้างภาพ…</b>')
    expect(mkSrc).toContain('<b>สร้างสำเร็จ</b>')
    expect(mkSrc).toContain('<b>สร้างไม่สำเร็จ:</b>')
    expect(mkSrc).toContain('data-testid="mk-gen-result"')
    expect(mkSrc).toContain('พรีวิวผลลัพธ์ล่าสุด')
    expect(mkSrc).toContain('data-testid="mk-ai-album"')
    expect(mkSrc).toContain(".from('bmb-images').list('ai-generated'")
    expect(mkSrc).toContain('function pickAiImage(url: string)')
    expect(mkSrc).toContain('await loadAiAlbum()')
    expect(mkSrc).toContain('setGenStatus({ phase: \'running\' })')
  })

  it('AdminMarketing: error อ่าน body เป็น text ก่อน (json พัง = ยังเห็น raw) — ไม่โชว์แค่ non-2xx', () => {
    expect(mkSrc).toContain('ctx.text === \'function\'')
    expect(mkSrc).toContain('await ctx.text()')
    expect(mkSrc).toContain('.slice(0, 180)')
  })

  it('EF: อัปโหลดเข้า bmb-images/ai-generated (อัลบั้มเดียวกัน โฟลเดอร์แยก) + error ทุกกรณี = JSON (ERR_UNCAUGHT)', () => {
    expect(imgSrc).toContain('`ai-generated/gen-')
    expect(imgSrc).toContain('/storage/v1/object/bmb-images/')
    expect(imgSrc).toContain('/storage/v1/object/public/bmb-images/')
    expect(imgSrc).toContain("folder: 'ai-generated'")
    expect(imgSrc).toContain("'ERR_UNCAUGHT'")
    expect(imgSrc).toContain('try {') // wrap ครอบ handler — crash = json ไม่ใช่ body ว่าง
  })
})