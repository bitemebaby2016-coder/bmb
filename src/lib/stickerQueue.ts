// ============================================
// Bite Me Baby — R31: คิวพิมพ์สติกเกอร์อัตโนมัติ (Bluetooth) — 1 ดวง ต่อ 1 ชิ้น
// ============================================
// Owner (2026-10-30): ข้อมูลทุกช่องทาง (เว็บ/โซเชียล/ข้อความ) ไหลเข้า "ตะกร้า/orders กลาง" อยู่แล้ว
// → หลังแอดมินกด "รับออเดอร์" ให้พิมพ์ต่อคิวอัตโนมัติหลาย ๆ ใบ · เทมเพลต BMB เดิม 40×60
// แต่ 1 สติกเกอร์ = 1 ชิ้น (จำนวน 2 = 2 ใบ) แม้ออเดอร์/ลูกค้าเดียวกัน · resolve = เครื่องยืนยันครบ
// ============================================
import type { PrintOrderData } from './printService'
import { renderStickerPng } from './stickerPng'
import { niimbotPrintStickers, describeNiimbotError, niimbotSupported } from './niimbotBt'

/** แยก 1 ดวง ต่อ 1 ชิ้น — Menu ในใบ = สินค้าชิ้นนั้น x1 (ออเดอร์/ลูกค้า/Order id เดิมทุกใบ) */
export function stickerRollForOrder(data: PrintOrderData): PrintOrderData[] {
  const roll: PrintOrderData[] = []
  for (const it of data.items) {
    const qty = Math.max(1, Math.floor(it.quantity || 1))
    for (let i = 0; i < qty; i++) {
      roll.push({ ...data, items: [{ ...it, quantity: 1 }] })
    }
  }
  if (roll.length === 0) roll.push(data) // ไม่มี line = 1 ใบรวม (กันคิวว่าง)
  return roll
}

/** render ทุกใบเป็น PNG แล้วยิงต่อคิวด้วย printBatch (job เดียว หลายหน้า) — resolve = เครื่องยืนยันครบ */
export async function printStickerRoll(roll: PrintOrderData[], onProgress?: (s: string) => void): Promise<void> {
  if (!niimbotSupported()) {
    throw new Error('อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth — เปิดหน้าแอดมินด้วย Chrome/Edge (https) เท่านั้น')
  }
  const pngs: string[] = []
  for (const piece of roll) {
    pngs.push(await renderStickerPng(piece))
  }
  await niimbotPrintStickers(pngs, onProgress)
}

/** แปล error คิวเป็นคำไทย (reuse ตัวเดิมจาก niimbotBt) */
export function describeStickerRollError(e: unknown): string {
  return describeNiimbotError(e)
}
