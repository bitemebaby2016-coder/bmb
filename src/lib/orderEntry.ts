// ============================================
// Bite Me Baby — CANONICAL ORDER-ENTRY PATH (storefront)
// ============================================
// Owner directive 2026-10-26: "ระบบสั่งของพรีออเดอร์กับเซมเดย์ มีหลายเส้นทางจนมั่วกันเอง"
//
// ก่อนหน้านี้ HomePage กับ MenuPage ต่างเก็บสำเนาของ flow เดียวกันคนละชุด:
//   order builder (topping/upsell) -> addItem -> gate AddToCartResult -> route
// ทำให้แก้ guard ทีเดียวต้องแก้ 2 ที่ (และเคยมีเคส "toast ว่าเพิ่มแล้วทั้งที่ไม่ได้เพิ่ม")
// ไฟล์นี้คือ implementation เดียวที่ทุก surface ของร้านใช้ร่วมกัน:
//   HomePage (popular / section cards / FoodTheater / review CTA)
//   MenuPage (การ์ดเมนู 2 แท็บ)
// หน้าที่ของ page เหลือแค่ "presentation" = เลือกข้อความ toast + เส้นทางไปต่อ
//
// Contracts ที่ห้ามละเมิด (RC-3 / OD-4 / P0 2026-10-14):
//   1. ห้าม toast ว่า "เพิ่มแล้ว" เมื่อ addItem ไม่ได้คืน 'added'
//   2. ห้าม navigate ไป /checkout ทั้งที่ไม่มีอะไรเข้าตะกร้า
//   3. 'blocked' / 'context_blocked' ต้องถูกแจ้งผู้ใช้ (ห้ามกลืนเงียบ)
//
// การสร้างออเดอร์จริงยังคงอยู่ที่ server RPC `create_order_with_items` เท่านั้น
// (client ไม่เคย insert ตาราง orders เอง) — เส้นทางนี้มีหน้าที่ "ใส่ตะกร้า + พาไปหน้าถัดไป"
// ============================================

import type { Product } from '@/types'
import type { OrderMode } from '@/config/platformConfig'
import type { AddToCartResult } from '@/store/cartStore'
import { useOrderBuilderStore, type OrderBuilderResult } from '@/store/orderBuilderStore'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

/** เซ็นเนเจอร์ของ cartStore.addItem ที่ทุกหน้าส่งเข้ามา (ผูกกับ store จริงของหน้านั้น) */
export type AddItemFn = (
  product: Product,
  quantity?: number,
  customizations?: Record<string, any>,
  mode?: OrderMode,
) => AddToCartResult

export type ToastFn = (message: string, type: ToastType) => void

export interface BlockedToast {
  message: string
  type: ToastType
}

export interface OrderEntryOptions {
  /** productId จาก payload ของปุ่มสั่งซื้อ */
  productId: string
  /** catalog ที่ใช้หาสินค้า + สร้าง recommendation */
  products: Product[]
  /** SAME_DAY หรือ PRE_ORDER — ถูกส่งต่อให้ cart line โดยตรง */
  mode: OrderMode
  addItem: AddItemFn
  toast: ToastFn
  navigate: (to: string) => void
  /** ข้อความเมื่อหาสินค้าจาก payload ไม่เจอ (แต่ละหน้าคงข้อความเดิมของตัวเอง) */
  notFound: string
  /** ข้อความ/ระดับสำหรับผลที่ไม่ใช่ 'added' — คงข้อความเดิมของหน้าไว้ทุกประการ */
  blockedToast: (res: Exclude<AddToCartResult, 'added'>) => BlockedToast
  /** เรียกหลัง gate ผ่านแล้ว (หน้าใช้สร้าง toast "สำเร็จ" ของตัวเอง) */
  onAdded?: (result: OrderBuilderResult) => void
}

/**
 * เส้นทางสั่งซื้อเดียวของ storefront — ปุ่ม "สั่งเลย / จองล่วงหน้า" ทุกปุ่มต้องผ่านฟังก์ชันนี้
 *
 * Flow: หาสินค้า -> order builder (topping/upsell) -> addItem(mode)
 *       -> gate 'added' (คืนทันทีถ้าไม่สำเร็จ) -> เพิ่ม recommended -> toast สำเร็จ
 *       -> PRE_ORDER ค่อย navigate ไป /checkout?mode=pre-order
 *       (SAME_DAY คงอยู่หน้าเดิม ลูกค้าค่อยไป /cart เองตาม UX เดิม)
 */
export function runOrderBuilder(opts: OrderEntryOptions): void {
  const { productId, products, mode, addItem, toast, navigate, notFound, blockedToast, onAdded } = opts
  const product = products.find((p) => p.id === productId)
  if (!product) {
    toast(notFound, 'error')
    return
  }
  useOrderBuilderStore.getState().openBuilder(product, products, (result) => {
    const customizations: Record<string, any> = {}
    if (result.addOns.length > 0) {
      customizations['addOns'] = result.addOns.map((a) => ({
        addonId: a.addonId,
        selections: a.selections,
        note: a.note ?? '',
      }))
    }
    const res = addItem(result.product, result.quantity, customizations, mode)
    if (res !== 'added') {
      const t = blockedToast(res)
      toast(t.message, t.type)
      return
    }
    for (const rec of result.recommended) addItem(rec, 1, {}, mode)
    onAdded?.(result)
    if (mode === 'PRE_ORDER') navigate('/checkout?mode=pre-order')
  })
}