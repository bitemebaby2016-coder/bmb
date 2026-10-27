// Phase 6 (RC-7 · INV-18): ผิวสั่งซื้อ customer ทุกจุดต้องอ่าน mode flags ด้วย canonical
// fallback (`available_* ?? is_preorder`) — ห้ามอ่าน alias `is_preorder` ตรง ๆ
// source-contract ตาม convention ของ adminShell.test.ts (?raw literal imports)
import { describe, expect, it } from 'vitest'
import menuPageSrc from '../pages/MenuPage.tsx?raw'
import votePageSrc from '../pages/VotePage.tsx?raw'
import foodMenuCardSrc from '../components/FoodMenuCard.tsx?raw'
import homeShowcaseSrc from '../lib/homeShowcase.ts?raw'
import reviewCarouselSrc from '../components/home/ReviewCarouselSection.tsx?raw'

/** ตัด comment ออกก่อนตรวจ — split ด้วย /\r?\n/ กัน CRLF ทำให้ //.*$ strip ไม่หมด */
const stripComments = (src: string) =>
  src
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')

describe('INV-18 — canonical fallback ใน customer ordering surfaces', () => {
  it('MenuPage.tsx: ทุกบรรทัดที่มี is_preorder ต้องใช้ ?? fallback (ไม่มี raw alias read)', () => {
    const src = stripComments(menuPageSrc)
    const lines = src.split('\n').filter((l) => l.includes('is_preorder'))
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(line, `raw alias read ใน MenuPage: ${line.trim()}`).toContain('??')
    }
  })

  it('VotePage.tsx: poll options กรองเฉพาะ archived — ครบทุกเมนู (Owner L-5 2026-10-26 แทน fallback)', () => {
    expect(votePageSrc).toContain('!p.archived')
    expect(votePageSrc).not.toContain('products.filter((p: Product) => p.is_preorder)')
  })

  it('FoodMenuCard.tsx: ปุ่มตัดสินจาก "ป้ายปฏิทิน" = เมนูตาราง (Owner 2026-10-27 — ตัวตนสินค้าใหม่)', () => {
    const src = stripComments(foodMenuCardSrc)
    // ปุ่ม 2 โหมดยังอยู่ครบ ("จองล่วงหน้า" ของเมนูตาราง + "สั่งทันที" ของเมนูนอกตาราง)
    // แต่ตัดสินด้วย scheduledDate (ป้ายปฏิทิน) แทน flag — พรีออเดอร์กับเมนูตารางอันเดียวกัน
    expect(src).toContain('scheduledDate ? (')
    expect(src).toContain('⚡ สั่งทันที')
  })

  it('homeShowcase.ts: mirror ใช้ canonical fallback ทั้งคู่ (คงอยู่ต่อไป)', () => {
    const src = stripComments(homeShowcaseSrc)
    expect(src).toContain('p.available_same_day ?? !p.is_preorder')
    expect(src).toContain('p.available_preorder ?? p.is_preorder')
  })

  it('ReviewCarouselSection.tsx: mode ของรีวิวใช้ canonical fallback', () => {
    const src = stripComments(reviewCarouselSrc)
    expect(src).toContain('product?.available_preorder ?? product?.is_preorder')
  })
})