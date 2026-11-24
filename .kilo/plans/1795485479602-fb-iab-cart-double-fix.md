# BMB-FB-IAB-CART-DOUBLE-FIX-2026-11-24 — กัน Double-Add ใน IAB + ให้คัดลอกลิงก์พาตะกร้าสดจริง

## ปัญหา (Root Cause เดียวกัน 2 อาการ)
| อาการ | สาเหตุจริง |
|-------|------------|
| **IAB**: กดลิงก์ซ้ำ → นับสินค้าเพิ่มทุกครั้ง | `history.replaceState` **ล้มเหลวใน FB IAB** → `?cart=` ค้างใน URL → navigate กลับ `/shop` (แม้ใน SPA) → Layout effect รันใหม่ → decode `?cart=` ซ้ำ → `addItem` ซ้ำ |
| **External (Chrome)**: คัดลอกจาก IAB → เปิด Chrome ตะกร้าว่าง | ลิงก์ที่คัดลอกมาจาก IAB มี `?cart=` **เสียหาย (double-encoded / payload แพะจากบั๊ก IAB)** → `normalizeCartParam` ถอดไม่ได้ → `return` ไม่เติมของ |

> งานเก่า (`1795399498532-fb-cart-bridge-live-plan.md`) ทำ Phase 1–3 logic ถูกต้อง (encode v2, live-cart copy, scope line) แต่ **ข้ามกรณี IAB ไป** — ไม่ได้ guard ป้องกัน double-add เมื่อ URL param ค้าง และไม่ได้ strip `fbclid` ก่อน encode

---

## เป้าหมาย (Acceptance)
1. **IAB**: กดลิงก์ 5 ครั้ง / navigate กลับ `/shop` 5 ครั้ง → `addItem` ถูกเรียก **1 ครั้งเท่านั้น** → count ไม่เพิ่ม
2. **External**: คัดลอกจาก IAB → วางใน Chrome → `normalizeCartParam` ถอดผ่าน → items ตรง live cart ณ เวลากด
3. **เทสต์**: `fbCartBridgeIAB.test.ts` ทุก case ผ่าน + lint/tsc/test/build เขียว

---

## งาน (Task List — เรียงตาม dependency)

### 1. Layout.tsx — Guard ป้องกัน double-process `?cart=`
**ไฟล์**: `src/components/layout/Layout.tsx` (effect บรรทัด 71–175)

**การเปลี่ยนแปลง**:
- เพิ่ม helper `makeProcessedKey(rawCart: string): string` → `bmb:cart-processed-${first16chars(rawCart)}`
- ใน `runAdd` **ก่อน** decode/loop: check `sessionStorage.getItem(key)` — ถ้ามีแล้ว `return` ทันที (ข้ามทั้ง decode + addItem)
- หลัง `runAdd` สำเร็จ (`added > 0`): `sessionStorage.setItem(key, '1')`
- `replaceState` strip `?cart=`/`?s=` wrap ใน `try/catch` → **fail → fallback: set flag เดียวกัน** (กัน URL ค้างแต่ยังมี flag กันซ้ำ)

**เหตุผล**: ใช้ `sessionStorage` (ตายตอนปิดแท็บ) เพราะ IAB/Chrome ไม่แชร์กัน → flag ทำงานใน IAB เดียว พอ user ปิดแท็บ flag หาย = ปลอดภัย

### 2. InAppBrowserBanner.tsx — Live cart เสมอ + strip fbclid ก่อน encode
**ไฟล์**: `src/components/InAppBrowserBanner.tsx` (function `buildLiveHandoffUrl` บรรทัด 171–217)

**การเปลี่ยนแปลง**:
- ย้าย `fbclid` strip **ก่อน** fallback chain (บรรทัด 210 → ย้ายขึ้นก่อน `if (liveCart.length > 0)`)
- **บังคับใช้ live cart เสมอเมื่อมีของ** (`liveCart.length > 0`) — ไม่ fallback ไป mount snapshot / resume ที่อาจเก่า/แพะ
- เพิ่ม `data-testid="inapp-live-cart-count"` บนข้อความ "พบรายการ N รายการ (M ชิ้น)" (บรรทัด 298–301) เพื่อ e2e assertion

### 3. เทสต์ใหม่ — IAB double-add + External copy
**ไฟล์**: `src/__tests__/fbCartBridgeIAB.test.ts` (ใหม่)

**Test cases**:
```ts
// 1. IAB double-add guard
it('navigate /shop?cart=... 5 ครั้ง → addItem เรียก 1 ครั้ง', async () => {
  // mock useCartStore, useLocation, sessionStorage
  // render Layout → advance timers → assert addItem call count === 1
})

// 2. External copy from IAB
it('copy URL จาก IAB (มี fbclid + ?cart=double-encoded) → decode ใน Chrome ผ่าน', () => {
  // สร้าง URL แบบ IAB: ?cart=encoded%253D...&fbclid=xxx
  // เรียก buildLiveHandoffUrl → เรียก normalizeCartParam → items ตรง live cart
})

// 3. fbclid stripped
it('buildLiveHandoffUrl ไม่มี fbclid ใน URL สุดท้าย', () => {
  // window.location.href = '...?fbclid=xxx&cart=...'
  // เรียก buildLiveHandoffUrl → URL ไม่มี fbclid
})
```

### 4. อัปเดตเอกสาร
**ไฟล์**: `AI_WORK_STATE.md` — เพิ่ม entry บันทึก root cause + การแก้ (รูปแบบเดิม)

---

## ขอบเขตที่ **ไม่** รวม (Out of Scope)
| รายการ | สถานะ | เหตุผล |
|----------|-------|--------|
| Server-side cart sync | ❌ ไม่ทำ | ต้อง architecture ใหม่ (DB, RPC, conflict resolution) — งานแยก sprint |
| LINE/IG in-app browser | ❌ ไม่ทำ | Hook รองรับแล้ว แต่รอ channel จริง — แยกงานทดสอบ |
| PWA install flow | ❌ ไม่ทำ | ทำงานอยู่แล้ว ไม่มีบั๊ก |

---

## Validation Gates (ต้องผ่านจริงก่อนปิด)
```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```
- `fbCartBridgeIAB.test.ts` ทุก case ผ่าน
- Manual: IAB กดลิงก์ 5 ครั้ง → count ไม่เพิ่ม / External copy → Chrome ตะกร้าตรง

---

## ไฟล์ที่ต้องแก้ (Summary)
1. `src/components/layout/Layout.tsx` — guard + replaceState fallback
2. `src/components/InAppBrowserBanner.tsx` — live cart บังคับ + strip fbclid ก่อน + testid
3. `src/__tests__/fbCartBridgeIAB.test.ts` — ใหม่
4. `AI_WORK_STATE.md` — append entry