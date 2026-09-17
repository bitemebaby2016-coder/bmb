# Component Specification: Normal Document Flow Layout (UI / PWA Home & Menu)

> **Document role:** Single Source of Truth สำหรับหน้าตา UI ใหม่ (Home/Menu), Micro-interactions, Business Rules ของปุ่มสั่งซื้อ และช่องทาง Admin อัปโหลดรูปอาหาร  
> **Applies to:** `src/components/FoodMenuCard.tsx`, `src/components/CustomerReviewCard.tsx`, `src/components/LazyVideo.tsx`, โซน Social Proof Review Feed + Featured บน HomePage, กริดเมนูบน MenuPage และทุก surface ฝั่งลูกค้าของ PWA ที่เรนเดอร์การ์ดสินค้า  
> **Created:** 2026-09-14 · **Updated:** 2026-09-17 · **Version:** 4.0 (Normal Document Flow + CustomerReviewCard — 2.5D/3D Hybrid Glassmorphism)  
> **Status:** ✅ APPROVED — Implementasi Ready  
> **Process:** จัดทำตาม README #78 DEVELOPMENT DOCUMENTATION GATE (D0 → D1 → D2 → D3 → D4) และ #89 SOURCE OF TRUTH HIERARCHY

---

## 0. สิ่งที่ขออนุมัติ (Approval Scope)

1. **Admin Image Upload** — Admin อัปโหลด/แก้ไขรูปอาหารผ่าน Products Management (ไม่ใช่ AI Pipeline)
2. **FoodMenuCard Normal Document Flow UI** — คอมโพเนนต์การ์ดเมนูใหม่สำหรับหน้า Home/Menu (`src/components/`) — v3.0 ใช้ vertical flexbox, ไม่มี overlap
3. **Business Rules** — ปุ่ม Same-day / Pre-order แยก Action และแยก Log เด็ดขาด

> ⚠️ ห้ามเริ่ม Step 2 (Implementation) ก่อนเจ้าของโปรเจกต์อนุมัติเอกสารฉบับนี้

---

## 1. Purpose & Scope

เอกสารนี้กำหนดวิธีที่ Bite Me Baby เรนเดอร์สินค้าอาหารบน PWA ฝั่งลูกค้าในสไตล์ **"Normal Document Flow with Vertical Flexbox"** โดย Admin เป็นคนอัปโหลดและแก้ไขรูปอาหารเองทั้งหมดผ่าน Products Management (ไม่ใช้ AI Image Generation)

**v3.0 Update (2026-09-15):** เปลี่ยนจาก 3D Floating (negative margin, absolute positioning) เป็น Normal Document Flow — ลบ overlap issues, ใช้ vertical stacking ที่ชัดเจน

ครอบคลุม:

- ข้อกำหนด Normal Document Flow Layout (Vertical Flexbox, 3 Sections: Image → Info → Actions)
- พฤติกรรม Micro-interaction Animation (scale hover, shadow transition)
- การบังคับใช้ Business Rule ของปุ่ม Same-day / Pre-order
- Props Interface ของ `FoodMenuCard` และ Cross-document Audit กับตาราง `products` บน Supabase

### v3.0 Layout Changes (จาก v2.0)

| Aspect | v2.0 (3D Floating) | v3.0 (Normal Document Flow) |
|--------|-------------------|---------------------------|
| **Layout Method** | Negative margin + absolute positioning | Vertical flexbox (flex-col) |
| **Image Position** | ล้นขอบการ์ด (mb-[-1.5rem]) | Within card (mb-4, centered) |
| **Badges/Status** | Absolute positioned | Inline (normal flow) |
| **Shadow on Image** | drop-shadow ซ้อนเลเยอร์ | shadow-lg (simple) |
| **Hover Effect** | translateY(-16px) + scale | scale(1.05) only |
| **Overlap Risk** | สูง (absolute + negative margin) | ไม่มี (document flow) |

---

## 2. Image Management (Admin Manual Upload)

> **หมายเหตุ:** เปลี่ยนจาก AI Image Pipeline เป็น Admin อัปโหลด/แก้ไขรูปเอง — ไม่ต้องใช้ OpenRouter Image API

### 2.1 กระบวนการอัปโหลดรูปอาหาร

```text
Admin เข้า Products Management ใน Panel
↓
เลือกรายการเมนู → คลิก "แก้ไข" / "อัปโหลดรูป"
↓
อัปโหลดภาพอาหาร (JPEG/PNG/WebP) — ระบบจะ crop ให้พอดี
↓
บันทึก → image_url จะถูกอัปเดต
↓
FoodMenuCard แสดงผลรูปภาพอัตโนมัติ (พร้อม hover animation)
```

### 2.2 ข้อกำหนดรูปอาหาร

| หัวข้อ | รายละเอียด |
|--------|-----------|
| **รูปแบบไฟล์** | JPEG, PNG, หรือ WebP |
| **สัดส่วนแนะนำ** | 1:1 (สี่เหลี่ยมจัตุรัส) หรือ 4:3 |
| **ขนาดไฟล์** | ต่ำกว่า 500 KB เพื่อความเร็ว PWA |
| **คุณภาพ** | รูปจริง清晰 สว่าง ไม่เบลอ (Admin เลือกเอง) |
| **พื้นหลัง** | แนะนำพื้นหลังขาวหรือโทนเข้าคู่ brand |

### 2.3 การแสดงผลใน FoodMenuCard

- `product.image_url` คือแหล่งภาพเดียวที่ใช้แสดง
- หากไม่มีรูป (empty string) จะแสดง placeholder emoji 🍽️ แทน
- Hover บน image container → ภาพจะขยาย scale 105% (ไม่มีลอยเหนือขอบการ์ด)

---

## 3. Normal Document Flow Layout Specification (v3.0)

### 3.1 Card Container

| Property | Value | Notes |
|----------|-------|-------|
| Background | White | `bg-white` พร้อม border สีอ่อน |
| Border Radius | `rounded-2xl` (24px) | มุมโค้งพรีเมียม |
| Shadow (default) | `shadow-md` | เงาเบา |
| Shadow (hover) | `hover:shadow-xl` | เงาฟุ้งเมื่่อชี้ |
| Scale (hover) | `group-hover:scale-105` | ขยายเล็กน้อยเมื่่อชี้ (บน image container) |
| Layout | `flex flex-col items-center` | Vertical stacking |
| Overflow | `overflow-hidden` | ตัดขอบไม่ให้อອก |

### 3.2 Three-Section Structure (Vertical Flexbox)

**v3.0 ใช้ 3 sections ที่ชัดเจน ไม่ overlap กัน:**

| Section | Content | Styling |
|---------|---------|---------|
| **TOP: Image Container** | Category badge, Status pill, Food image | `bg-gradient-to-b from-orange-50 to-white py-6 px-4` |
| **MIDDLE: Info** | Name, Description, Price + Prep time | `px-5 py-4 flex flex-col items-center gap-3` |
| **BOTTOM: Actions** | Same-day button, Pre-order button | `px-5 pb-5 flex flex-col gap-2` |

### 3.3 Image Container (Fixed Size, Centered)

| Property | Value | Notes |
|----------|-------|-------|
| Size | `w-48 h-48` (192x192px) | ขนาดคงที่ |
| Position | `mx-auto mb-4` | กึ่งกลาง, มี margin ล่าง |
| Image Shape | `rounded-full` | วงกลม |
| Shadow | `shadow-lg` | เงาแบบ simple |
| Hover | `group-hover:scale-105 transition-transform` | ขยาย 5% เมื่่อชี้ |
| Placeholder | Gradient orange + emoji 🍽️ | เมื่อไม่มีรูป |

### 3.4 Badges & Status (Inline, Not Absolute)

| Element | Position | Styling |
|---------|----------|---------|
| Category Badge | Inline (above image) | `inline-flex rounded-full px-3 py-1 text-xs bg-brand-primary text-white mb-3` |
| Status Pill | Inline (above image, if not available) | `inline-flex rounded-full px-3 py-1 text-xs bg-red-100 text-red-700 mb-3` |

> **v3.0 Change:** เปลี่ยนจาก `position: absolute` เป็น `inline-flex` — ไม่มี overlap กับเนื้อหา
| Dimensions | `w-48 h-48` (192×192px) | สี่เหลี่ยมจัตุรัส — ปรับได้ผ่าน design token |
| Overflow container | `overflow-visible` | **สำคัญ** — ไม่มี `overflow-hidden` เพื่อให้รูป hover ลอยเลยขอบได้ |
| Object fit | `object-contain` | แสดงรูปเต็ม ไม่ตัด |
| Dimensions | `w-48 h-48` (192×192px) | สี่เหลี่ยมจัตุรัส — ปรับได้ผ่าน design token |
| Overflow container | `overflow-visible` | **สำคัญ** — ไม่มี `overflow-hidden` เพื่อให้รูป hover ลอยเลยขอบได้ |
| Object fit | `object-contain` | แสดงรูปเต็ม ไม่ตัด |

### 3.3 Text & Info Layer

```text
[ Category badge (absolute top-left z-30) ]    [ Status pill (absolute top-right z-30) ถ้าไม่ avail ]

              ภาพอาหาร (center, overflow visible)

       ชื่อเมนู (h3, font-bold, centered)
       รายละเอียด (p, line-clamp-2, centered)
       ราคา + เวลาเตรียม (row, centered)
       ปุ่ม action (flex-col, centered)
```uctId}-studio-v{n}.webp`
- Fallback: หาก pipeline ล้มเหลว UI ยังแสดงภาพเดิม/placeholder ได้ทันที (ไม่ block การเรนเดอร์)
- Job log บันทึก: `requestId`, `productId`, `inputImage`, `model`, `promptHash`, `cost`, `status`, `error`, `operator`, `timestamp` — retry ได้ตาม max retry count

### 2.7 Security & Logging

- 🔴 **ห้ามมี OpenRouter API Key ในซอร์สโค้ด frontend** — อ่านจาก environment variable เท่านั้น (key เดิมที่ hardcode ใน `aiService.ts` ต้องย้ายออกใน Step 2)
- ทุก request ต้อง log ครบตาม §2.6 เพื่อ audit ย้อนหลังได้
- Failed job ต้อง retry ได้และห้ามบล็อก UI จากการแสดง fallback asset

---

## 3. 3D Floating UI Specification

### 3.1 Container / Card

- การ์ดพื้นฐานเป็น **พื้นกระจกฝ้า (frosted glass)** สไตล์ Soft UI — ไม่ใช่กรอบสี่เหลี่ยมหนัก ๆ
- การ์ดเป็น `group` container เพื่อรองรับ `group-hover` / `group-active`
- คง Design tokens เดิมของโปรเจกต์ (`src/types/index.ts → UI_CONFIG`):
  - พื้นหลัง: white surface / warm cream (`#FFF7ED`)
  - Border radius: `rounded-2xl` / `rounded-3xl`
  - สีแบรนด์: ส้ม `#F97316` (primary), น้ำตาลเข้ม `#92400E` (accent)

### 3.2 Layering Rule (หัวใจของ 3D Floating)

- ภาพอาหารต้อง **เหลื่อมหลุดจากขอบบนของการ์ด** ด้วย Negative Margin (`-mt-6` / `-mt-8`) เพื่อเอฟเฟกต์ "ลอยหลุดขอบ"
- สร้างมิติความลึกด้วยเงาซ้อนเลเยอร์:
  - ✅ **อนุญาต:** `filter: drop-shadow(...)` ต่อกันหลายชั้นบนคอนเทนเนอร์รูปอาหาร
  - ⛔ **ห้ามเด็ดขาด:** ใช้ `box-shadow` บนรูปอาหาร (จะกลายเป็นกรอบสี่เหลี่ยม — ผิด spec)
- ค่าแนะนำ (Tailwind arbitrary value): `[filter:drop-shadow(0_20px_14px_rgba(146,64,14,0.20))_drop-shadow(0_8px_8px_rgba(0,0,0,0.12))]`

### 3.3 Depth / Glassmorphism

- เงาอย่างน้อย 2 ชั้น: เงานอกนุ่ม (elevation) + เงาแนบรูป (contact shadow)
- การ์ดกระจกฝ้า: พื้น translucent + `backdrop-blur` (เช่น `bg-white/80 backdrop-blur-md`) คงความอ่านง่ายบนพื้นหลังหลากแบบ

### 3.4 Visual Concept

```text
        🍤   ← ภาพอาหาร .webp โปร่งใส ลอยเหลื่อมขอบบนการ์ด
   ╭─────────────────────────╮
   │    (negative margin)    │
   │   การ์ดกระจกฝ้า (glass)  │  ← drop-shadow ซ้อนหลายชั้น
   │   ชื่อเมนู · ราคา · ปุ่ม  │
   ╰─────────────────────────╯
```

---

## 4. Micro-interactions Animation

### 4.1 Hover (desktop)

เมื่อผู้ใช้ชี้เมาส์บนการ์ด:

- ภาพอาหารลอยสูงขึ้นและขยายออก:
  - `group-hover:-translate-y-4`
  - `group-hover:scale-105`
- การ์ดกระจกฝ้าด้านหลังยุบตัวลงเล็กน้อยเมื่อกด/แตะ: `group-active:scale-[0.99]`
- เงาฟุ้งกระจายกว้างขึ้นอย่างนุ่มนวล เพื่อความรู้สึกลอยจริงระดับพรีเมียม
- Timing: `duration-300` / `ease-out` (หรือ `cubic-bezier(0.4, 0, 0.2, 1)`) พร้อม `will-change-transform`

### 4.2 Active / Touch (mobile)

เมื่อผู้ใช้แตะ/กดบนการ์ด:

- พื้นการ์ดยุบตัวลงเล็กน้อย `group-active:scale-[0.99]`
- ภาพอาหารคงสถานะลอย/ขยายระหว่างการกด
- เงากระจายกว้างขึ้นเพื่อ tactile feedback สมจริง

### 4.3 Accessibility

- แอนิเมชันทั้งหมดเคารพ `prefers-reduced-motion: reduce` (ผ่าน global CSS rule เดิม)
- Touch target ≥ 44px
- ภาพอาหารต้องยังมองเห็นครบและไม่ถูก crop ที่ความกว้างมือถือทั่วไป

---

## 5. Business Rules Enforcement (Same-day vs Pre-order)

### 5.1 ปุ่ม "Same-day Order" (สั่งเลยวันนี้)

แสดงผล **เฉพาะเมื่อครบทุกเงื่อนไข**:

- `products.is_available = true` จากฐานข้อมูล (Source of Truth) **และ** ผ่านการประเมินจาก **Live Availability Engine** (README #13: AVAILABLE / LIMITED / SOLD_OUT / TEMPORARILY_UNAVAILABLE / STORE_CLOSED / DELIVERY_UNAVAILABLE)
- เวลาปัจจุบันยังไม่ถึง Same-day cutoff
- Delivery Zone เปิดให้บริการ
- Kitchen/Delivery Capacity ของรอบวันนี้ยังรับออเดอร์ได้

ถ้า `is_available = false` หรือ Engine ตัดสินว่าขายไม่ได้ → ปุ่ม Same-day **ห้าม render** (ไม่ใช่ render แล้ว disable ทิ้งไว้)

### 5.2 ปุ่ม "Pre-order" (จองล่วงหน้า)

- Render เสมอเมื่อสินค้ามีอยู่
- กดแล้วเปิดให้เลือก **Delivery Round** (morning / midday / evening / รอบอนาคต) ตามตารางการผลิตจาก backend

### 5.3 แยก Action และแยก Log เด็ดขาด

- แตะ **Same-day Order** → เรียก action เฉพาะ + เขียน log เฉพาะ (`orderMode = 'same-day'`, availability snapshot, productId, timestamp)
- แตะ **Pre-order** → เรียก action เฉพาะ + เขียน log เฉพาะ (`orderMode = 'pre-order'`, roundId ที่เลือก, scheduledDate)
- Log เป็น **append-only** ห้ามแก้ย้อนหลัง ประกอบด้วย:
  - `orderMode`
  - `productId`
  - `timestamp`
  - `userId`
  - `actionType`
  - `metadataSnapshot`
- หนึ่งการแตะห้ามเกิด log ทั้งสองโหมดเด็ดขาด

---

## 6. FoodMenuCard Props Interface (TypeScript)

ห้ามใช้ `any` เด็ดขาด — ทุก props ประกาศชนิดชัดเจน และ reuse type หลักจาก `@/types` (ซึ่งตรงกับ Supabase schema ตาม §7):

```typescript
import type { Product, ProductCategory } from '@/types'

export type OrderMode = 'same-day' | 'pre-order'

export type AvailabilityState =
  | 'available'
  | 'limited'
  | 'sold_out'
  | 'temporarily_unavailable'
  | 'store_closed'
  | 'delivery_unavailable'

export interface SameDayOrderPayload {
  productId: string;
  quantity: number;
  timestamp: string;
  availabilitySnapshot: {
    isAvailable: boolean;
    engineState: AvailabilityState;
    source: string;
    snapshotAt: string;
  };
}

export interface PreOrderPayload {
  productId: string;
  quantity: number;
  deliveryRoundId: string;
  scheduledDate: string;
}

export interface FoodMenuCardProps {
  product: Product;
  category?: ProductCategory;
  mode: OrderMode;
  availability: AvailabilityState;
  studioImageUrl?: string;
  onSameDayOrder: (payload: SameDayOrderPayload) => void;
  onPreOrder: (payload: PreOrderPayload) => void;
}
```

---

---

## 4. Micro-interactions Animation

| Trigger | Animation | CSS Class |
|---------|-----------|-----------|
| Hover ภาพ | ยกขึ้น + ขยาย | `group-hover:-translate-y-4 group-hover:scale-105` |
| Active การ์ด | ยุบลงเล็กน้อย | `group-active:scale-[0.99]` |
| Hover การ์ด | เงาฟุ้งขึ้น | `group-hover:shadow-xl group-hover:-translate-y-1` |
| Reduced motion | หยุด animation ทั้งหมด | `@media (prefers-reduced-motion: reduce)` |

```css
/* keyframes floating food (CSS) */
@keyframes floatFood {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
```

---

## 5. Business Rules (Buttons)

### 5.1 Same-day Order Button

- แสดงเฉพาะเมื่อ **สองเงื่อนไข**: `is_available = true` **+** `mode === 'same-day'`
- ค่า `is_available` อ่านจาก Live Availability Engine เมื่อ Supabase พร้อม (ตอนนี้จาก `products.is_available`)
- Payload ส่งไป `onSameDayOrder`: `{ productId, quantity, timestamp, availabilitySnapshot }`

### 5.2 Pre-order Button

- เปิดให้เลือก Delivery Round (เช้า / กลางวัน / เย็น หรือรอบอนาคต)
- แยก handler ต่างหากจาก Same-day — **แยก Log append-only คนละรายการ**
- Payload ส่งไป `onPreOrder`: `{ productId, quantity, deliveryRoundId, scheduledDate }`

### 5.3 Logging Rule

```text
Same-day log table : same_day_logs (append-only)
Pre-order log table: pre_order_logs (append-only)
ไม่สามารถรวมหรือ cross-write ระหว่าง two log tables เด็ดขาด
```

---

## 6. Component Props Interface (`FoodMenuCardProps`)

```typescript
export type OrderMode = 'same-day' | 'pre-order';

export type AvailabilityState =
  | 'available'
  | 'limited'
  | 'sold_out'
  | 'temporarily_unavailable'
  | 'store_closed'
  | 'delivery_unavailable';

export interface FoodMenuCardProps {
  product: Product;                  // ข้อมูลสินค้าจาก data layer เดิม
  category?: ProductCategory;        // หมวดหมู่ optional
  mode: OrderMode;                   // 'same-day' | 'pre-order'
  availability: AvailabilityState;   // ผลจาก Live Availability Engine
  onSameDayOrder: (p: SameDayOrderPayload) => void;
  onPreOrder: (p: PreOrderPayload) => void;
}

export interface SameDayOrderPayload {
  productId: string;
  quantity: number;
  timestamp: string;
  availabilitySnapshot: {
    isAvailable: boolean;
    engineState: AvailabilityState;
    source: string;
    snapshotAt: string;
  };
}

export interface PreOrderPayload {
  productId: string;
  quantity: number;
  deliveryRoundId: string;
  scheduledDate: string;
}
```

- **ห้ามใช้ `any`** ในคอมโพเนนต์ — ทุก prop ต้อง Type-safe ตาม TypeScript interfaces ด้านบน

---

## 7. Cross-document Audit: Props vs Supabase `products` vs Production Code

### 7.1 Field-level Audit (อ้างอิง `supabase/migrations/001_init_tables.sql` + `src/types/index.ts`)

| Field | UI spec | Supabase migration | TS `Product` (@/types) | Audit result |
|-------|---------|--------------------|------------------------|--------------|
| `id` | required string | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | `string` | ✅ ตรงกัน |
| `name` | required string | `TEXT NOT NULL` | `string` | ✅ ตรงกัน |
| `description` | optional display | `TEXT` (nullable) | `string` | ⚠️ DB nullable แต่ TS ไม่ optional — UI ต้องกันค่าว่าง (`?? ''`) |
| `price` | required number | `DECIMAL(10,2) NOT NULL` | `number` | ✅ ตรงกัน |
| `category_id` | optional display | `UUID REFERENCES product_categories` (nullable) | `string` | ⚠️ DB nullable แต่ TS ไม่ optional |
| `image_url` | แหล่งภาพ raw/studio | `TEXT` (nullable) | `string` | ⚠️ DB nullable — UI ต้องมี fallback placeholder เสมอ |
| `is_available` | Same-day gate | `BOOLEAN DEFAULT true` | `boolean` | ✅ ตรงกัน |
| `is_featured` | โซน Featured หน้า Home | `BOOLEAN DEFAULT false` | `boolean` | ✅ ตรงกัน |
| `prep_minutes` | แสดงบนการ์ด | `INTEGER DEFAULT 15` | `number` | ✅ ตรงกัน |
| `sort_order` | ลำดับเมนู | `INTEGER DEFAULT 0` | `number` | ✅ ตรงกัน |
| `created_at` | ไม่แสดง | `TIMESTAMPTZ DEFAULT NOW()` | `string` | ✅ ตรงกัน |
| `updated_at` | ไม่แสดง | `TIMESTAMPTZ DEFAULT NOW()` | ❌ ไม่มีใน TS interface | ⚠️ ควรเพิ่มใน Step 2 (non-breaking) |
| `studio_image_url` | ต้องการแยก raw/studio | ❌ ไม่มีคอลัมน์ | ❌ ไม่มี | ⚠️ ระยะแรกใช้ `studioImageUrl` prop หรือเขียนทับ `image_url` แบบ versioned; migration เพิ่มคอลัมน์เป็นทางเลือกถัดไป |

### 7.2 Findings จาก D0 — Existing System Audit (2026-09-14)

| # | ผลการตรวจโค้ดจริง | สถานะ | การจัดการใน Step 2 |
|---|-------------------|--------|---------------------|
| F1 | ไม่มี `src/components/FoodMenuCard.tsx` | NOT FOUND | สร้างใหม่ตาม spec นี้ (README #90: Document → Design → Implement) |
| F2 | ใช้ Admin Upload รูปอาหารแทนระบบ AI (เปลี่ยนจาก v1.0) | ✅ Done | Admin อัปโหลดรูปผ่าน Products Management |
| F3 | `MenuPage.tsx` ใช้ `mockProducts: any[]` และ render `product.image` ซึ่งไม่มีฟิลด์นี้ใน mock (ภาพแสดงไม่ออก) | BROKEN | แทนที่ด้วย `Product[]` + `FoodMenuCard` |
| F4 | `HomePage.tsx` ใช้ `useState<any[]>` + mock placeholder | PARTIAL | แทนที่ด้วย `FoodMenuCard` (โซน Featured) |
| F5 | OpenRouter API key hardcode ใน `src/lib/aiService.ts` | 🔴 P0 (GAP_ANALYSIS SEC-01) | ย้ายเข้า `.env` (`VITE_OPENROUTER_API_KEY`) |
| F6 | ข้อมูลสินค้ามาจาก localStorage (`bmbAdminApi_products.ts`) ไม่ใช่ Supabase | PARTIAL | UI อ่านผ่าน data layer เดิม; เสียบ Live Availability Engine เมื่อ Supabase พร้อม |
| F7 | ไม่มีปุ่ม Same-day/Pre-order แยก (มีปุ่มเดียว "+ เพิ่ม") | MISSING | สองปุ่ม + สอง log ตาม §5 |
| F8 | `cartStore.addItem(product: Product, qty)` พร้อมใช้งาน | EXISTS | ปุ่ม action ส่ง `Product` ตรง type ได้ทันที |

---

## 8. File Impact Map (Step 2 — ทำเฉพาะเมื่ออนุมัติแล้ว)

| ไฟล์ | การกระทำ | เนื้อหา |
|------|----------|---------|
| `src/components/FoodMenuCard.tsx` | UPDATE | Normal Document Flow card ครบตาม §3–§6 (v3.0), ไม่มี `any`, ไม่มี `box-shadow` บนรูปอาหาร, vertical flexbox stacking |
| `src/pages/MenuPage.tsx` | REWRITE (โซนกริด) | ตัด mock `any[]`, ใช้ `Product[]` + `FoodMenuCard` |
| `src/pages/HomePage.tsx` | REWRITE (โซน Featured) | ใช้ `FoodMenuCard` |
| `src/components/ui/FoodPlaceholder.tsx` | EXTEND | เป็น fallback ของภาพเมื่อไม่มีรูป |
| `src/index.css` | EXTEND | keyframes / reduced-motion ที่จำเป็น |
| `src/lib/aiService.ts` | REFACTOR | key → `.env` (P0 SEC-01) |
| `.env` / `.env.example` | CREATE | `VITE_OPENROUTER_API_KEY` + model vars |
| `src/types/index.ts` | EXTEND | เพิ่ม `updated_at` และ availability types |

---

## 9. Acceptance Criteria (v3.0)

- [ ] รูปอาหารที่ Admin อัปโหลดแสดงถูกต้องบน FoodMenuCard ผ่าน `product.image_url`
- [ ] Layout เป็น Normal Document Flow (vertical flexbox) — ไม่มี negative margin, ไม่มี absolute positioning
- [ ] 3 sections ชัดเจน: Image (top) → Info (middle) → Actions (bottom) — ไม่มี overlap
- [ ] Hover บน image container → ขยาย `scale-105` (ไม่มี `-translate-y`)
- [ ] ปุ่ม Same-day แสดงเฉพาะ `is_available = true` ผ่าน Live Availability Engine
- [ ] Same-day และ Pre-order แยก handler + log append-only คนละรายการ
- [ ] ไม่มี `box-shadow` บนองค์ประกอบรูปอาหาร
- [ ] ไม่มี type `any` ใน `FoodMenuCard.tsx`
- [ ] ทุกแอนิเมชันเคารพ `prefers-reduced-motion`

---

## 10. Related Documents

- `README.md` (#13 Live Availability Engine, #78 Documentation Gate, #89 Source of Truth Hierarchy, #101 3D Floating Visual Layout)
- `BiteMeBaby_TARGET_PRODUCT_SPEC.md` (Feature 7 — 3D Floating UI)
- `BiteMeBaby_REALITY_MAP.md` (UI Presentation — Current State)
- `docs/BiteMeBaby_GAP_ANALYSIS.md` (P1 — Visual Upgrade)
- `docs/BiteMeBaby_IMPLEMENTATION_ROADMAP.md` (Phase 2.5 — Visual Upgrade)
- `docs/BiteMeBaby_DEPLOYMENT.md` (env vars — AI Chat เท่านั้น)
- `docs/BiteMeBaby_USER_GUIDE.md` (ปุ่มสั่งซื้อใหม่)
- Supabase migration: `supabase/migrations/001_init_tables.sql`

---

## 11. Approval Gate

> ✅ **สถานะ: อนุมัติแล้ว — Implementasi Ready**
>
> `src/components/FoodMenuCard.tsx` พร้อมใช้งาน — Admin อัปโหลดรูปเองผ่าน Products Management ได้เลย (ดู §8 v3.0 + §15 v4.0)
>
---

## 12. CustomerReviewCard + Social Proof Review Feed (UI v4.0 — 2.5D/3D Hybrid Glassmorphism)

> เพิ่มเมื่อ 2026-09-17 ตาม Change Management (#91) — Architecture Target ล่าสุดคือ **2.5D/3D Hybrid Glassmorphism**
> เอกสารอ้างอิงหลัก: `README.md` #102 HOME PAGE LAYOUT FLOW (v4.0) · `src/lib/socialProofReviews.ts` · `src/components/CustomerReviewCard.tsx`

## 12.1 ตำแหน่งใน Section Layout Flow

```text
[1 Hero Mascot] -> [2 Delivery Rounds] -> [3 Social Proof Review Feed] -> [4 Same-Day Menu] -> [5 Pre-Order Menu] -> [6 Promotions/Viral]
```

- **Social Proof Review Feed** อยู่ต่อจาก **Delivery Rounds Selector** และ **ก่อน** โซนเมนูขาย (Same-Day Menu)
- แสดงรีวิวจริงจาก **Facebook / GrabFood** (curated) ผูกกับ `products.id` จริง (ดู seed: `prod-1`..`prod-6`)

## 12.2 Glassmorphism Spec (`CustomerReviewCard`)

| องค์ประกอบ | Spec |
|------------|------|
| **Background** | ภาพอาหาร WebP ความละเอียดสูงจาก `product.image_url` — `loading="lazy"` + `decoding="async"` |
| **Fallback** | Gradient ตาม brand + emoji 🍜 เมื่อไม่มีรูป (ไม่ block การเรนเดอร์) |
| **Glass Overlay** | `backdrop-filter: blur(14px) saturate(160%)` / background `rgba(255,251,245,0.72)` + border แนว glass |
| **Radius** | `rounded-2xl` (24px) มุมโค้งพรีเมียม |
| **Shadow** | `shadow-lg` → `hover:shadow-xl` ฟุ้งขึ้นเมื่อชี้ |
| **2.5D Tilt** | Hover (desktop): `transform: perspective(1100px) rotateX(3deg) rotateY(-3deg) translateY(-4px)` — ปิดเมื่อ `@media (hover: none)` |
| **Depth** | `transform-style: preserve-3d` + Mascot `translateZ(28px)` ลอยเหนือ glass layer |
| **Hover Image** | ขยาย `scale(1.02 → 1.08)` อย่างนุ่มนวล |
| **Source Badge** | โลโก้จริง `Facebook Logo.webp` / `Grab Food Logo.webp` (badge พื้นขาว) + ข้อความสี brand |

## 12.3 3D Star Rating — Asset `public/Star.webp` (CSS Micro-animation)

- 5 ดาว + ตัวเลขคะแนน (เช่น `5.0`) — icon ดาวจากไฟล์จริง **`public/Star.webp`** (ไม่ใช่ emoji)
- ใช้ class `.star-3d-img` กับ CSS Variables `--star-i` สำหรับ **staggered pop-in** (StarPop scale+rotate จาก 0) + `loading="lazy"`
- **Glow / Pulse:** keyframes `starPulse` — `drop-shadow` สว่างขึ้น + `scale(1.12)` กึ่งรอบ (2.4s infinite)
- ดาวที่ไม่ได้คะแนน → class `.is-empty` (grayscale + opacity 0.45, ไม่ pulse)
- เคารพ `prefers-reduced-motion: reduce` — ระบบหยุด animation ทั้งหมด

## 12.4 3D Mascot "น้อง Bite" จิ๋ว (MascotBadge pose="heart")

- ใช้ `<MascotBadge pose="heart" size="sm" className="mascot-mini" />` (ดู **§18 Mascot Asset System**) — ท่า Mini Heart มุมล่างการ์ดรีวิว
- `position: absolute; right/bottom` + `z-index` สูงสุด + `translateZ(28px)`
- Micro-animation: `mascotWobble` (ลอยขึ้นลง + หมุน -3deg/+3deg, 3.2s infinite)
- Asset ตัวจริง (`bite_badge_mini_heart.webp`) จะแทนที่ placeholder (`/mascot_Bite_Main.webp`) อัตโนมัติเมื่อทีมดีไซน์ส่งมา (fallback `onError`)

## 12.5 CTA — Deep Link ตรงเข้า Cart/Checkout ตาม Mode

| Mode | Deep Link | CTA Label | พฤติกรรม |
|------|-----------|-----------|----------|
| `same-day` | `/cart?mode=same-day` | 🛒 สั่งเมนูนี้ | `onCta` → `addItem(product, 1)` แล้วเข้า Cart → ไป Checkout วันนี้ |
| `pre-order` | `/checkout?mode=pre-order` | 📅 จองเมนูนี้ | `onCta` → `addItem(product, 1)` แล้วตรงเข้า Checkout แบบจองล่วงหน้า |

- CheckoutPage รองรับ query params (`mode`, `round`) — ตามสัญญา **README #48 DEEP LINK**
- Query parameter ไม่ใช่ Business Rule — ระบบต้อง validate ใหม่ที่จุดสั่งจริง

## 12.6 Props Interface (`CustomerReviewCardProps`)

```typescript
interface CustomerReviewCardProps {
  review: SocialProofReview;   // @/types — content แบบ Type-safe
  product?: Product;           // ผูกกับ products.id (สำหรับ image_url WebP + is_available)
  mode: OrderMode;             // 'same-day' | 'pre-order'
  deepLinkTo: string;          // เป้าหมาย Deep Link (คำนวณที่ HomePage ตาม Mode)
  ctaLabel?: string;
  onCta?: () => void;          // เตรียมของ (addItem) ก่อน navigate
}
```

- **ห้ามใช้ `any`** — ทุก prop Type-safe (ตรวจผ่าน `tsc --noEmit` = 0 errors)

## 12.7 Video Policy (Performance — LCP / Mobile)

```text
ห้ามวิดีโอในเซกชั่นรีวิว (Social Proof Review Feed)
↓
ภาพนิ่ง WebP เป็นหลัก (ภาพเดียวกับเมนูจริง)
↓
Short Video อนุญาตเฉพาะ "เมนู Highlight" ไม่เกิน 1-2 คลิป
   - ใช้ <LazyVideo /> (IntersectionObserver)
   - preload="none" + src ถูกใส่เมื่อ scroll มาถึงเท่านั้น (Lazy Streaming)
   - poster เป็น WebP — Data Saver (navigator.connection.saveData) → ไม่ autoplay
```

- Config คลิป: `MENU_HIGHLIGHT_CLIPS` ใน `src/lib/socialProofReviews.ts` — **เริ่มต้นว่าง = ไม่แสดง video section** (policy-safe)

## 12.8 Data Source

- `src/lib/socialProofReviews.ts` — `SOCIAL_PROOF_REVIEWS` (curated 6 รายการ, productId ตรง seed) + `getSocialProofReviews()`
- รูปเมนูอ่านจาก `products.image_url` ที่ runtime → สอดคล้องกับหลัก "Real API Data"

---

## 13. HomePage Section Layout Flow (v4.0)

> รายละเอียดเต็มใน `README.md` #102

```text
Section 1 — Hero Mascot              (hero-section เดิม)
Section 2 — Delivery Rounds          (รอบเช้า / กลางวัน / เย็น)
Section 3 — Social Proof Review Feed (CustomerReviewCard x6)
Section 4 — Same-Day Menu             (เมนูวันนี้ + Menu Highlight LazyVideo ≤ 2 คลิป)
Section 5 — Pre-Order Menu            (เมนูโหวต/จองล่วงหน้า)
Section 6 — Promotions / Viral        (โปรโมชั่น + Quick Actions + Share)
```

---

## 14. Acceptance Criteria — Social Proof Review Feed (v4.0)

- [ ] Social Proof Review Feed แสดงหลัง Delivery Rounds และก่อน Same-Day Menu
- [ ] `CustomerReviewCard` ใช้ Glassmorphism (`backdrop-filter: blur()`) + ภาพ WebP Lazy Loading
- [ ] 3D Star Rating มี Glow/Pulse micro-animation และเคารพ `prefers-reduced-motion`
- [ ] Mascot "น้อง Bite" จิ๋วแสดงมุมล่างการ์ด (translateZ ลอยเหนือ glass)
- [ ] CTA Deep Link ถูกต้องตาม Mode: same-day → `/cart?mode=same-day`, pre-order → `/checkout?mode=pre-order`
- [ ] ไม่มี `<video>` ในเซกชั่นรีวิวเด็ดขาด
- [ ] Menu Highlight ใช้ `LazyVideo` เท่านั้น และ ≤ 2 คลิป
- [ ] ไม่มี type `any` ใน `CustomerReviewCard.tsx` / `LazyVideo.tsx`
- [ ] `npm test` 19/19 PASS + `npm run build` PASS (ยืนยันแล้ว 2026-09-17)

---

## 15. File Impact Map (v4.0 — ทำแล้ว)

| ไฟล์ | การกระทำ | เนื้อหา |
|------|----------|---------|
| `src/types/index.ts` | EXTEND | `SocialProofReview`, `SocialProofSource`, `MenuHighlightClip` |
| `src/lib/socialProofReviews.ts` | 🆕 CREATE | curated reviews (6) + `MENU_HIGHLIGHT_CLIPS` + video policy |
| `src/components/CustomerReviewCard.tsx` | 🆕 CREATE | 2.5D/3D Glassmorphism review card + CTA Deep Link ตาม Mode |
| `src/components/MascotBadge.tsx` | 🆕 CREATE | Reusable Mascot Asset System — 8 poses + sizes (sm/md/lg/fluid) + vector fallback |
| `src/components/LazyVideo.tsx` | 🆕 CREATE | IntersectionObserver lazy streaming (menu highlight ≤ 2 คลิป) |
| `src/pages/HomePage.tsx` | REWRITE (sections) | ลำดับ v4.0 + Social Proof Review Feed + Same-Day/Pre-Order แยก section |
| `src/index.css` | EXTEND | `.review-card-3d`, `.review-card-glass`, `.star-3d`, `.mascot-mini`, `.lazy-video` |
| `src/pages/CheckoutPage.tsx` | EXTEND | รองรับ Deep Link `?mode=` / `?round=` |
| `README.md` | EXTEND | #102 HOME PAGE LAYOUT FLOW (v4.0) |
| `STATUS_TRACKER.md` | UPDATE | v9.1 + Phase 7 (UI v4.0) 100% |
| `BITEMEBABY_PRODUCT_REALITY_MAP.md` | UPDATE | UI-07 Social Proof Review Feed |

---

## 16. Work Plan — Closure 100% (v4.0)

| # | งาน | สถานะ |
|---|-----|--------|
| 1 | เพิ่ม Type Social Proof + MenuHighlightClip | ✅ DONE (tsc 0 errors) |
| 2 | สร้าง `socialProofReviews.ts` (curated reviews + video policy config) | ✅ DONE |
| 3 | สร้าง `CustomerReviewCard.tsx` (Glassmorphism + 3D stars + Mascot + CTA Deep Link) | ✅ DONE |
| 4 | สร้าง `LazyVideo.tsx` (Lazy Streaming) | ✅ DONE |
| 5 | Refactor `HomePage.tsx` เป็น Section Layout Flow v4.0 | ✅ DONE |
| 6 | CSS Glassmorphism Spec (`index.css`) | ✅ DONE |
| 7 | CheckoutPage รองรับ Deep Link params | ✅ DONE |
| 8 | ทดสอบ: `tsc --noEmit` 0 errors / vitest 19/19 / vite build PASS | ✅ DONE |
| 9 | อัปเดต docs ให้ตรงกัน (README #102, STATUS_TRACKER v9.1, Reality Map UI-07, เอกสารฉบับนี้) | ✅ DONE |
| 10 | Mascot Asset System — `MascotBadge.tsx` + `/public/assets/mascot/` mapping + วางตาม Pose Map (Hero/Rounds/Reviews/Menu/Random) | ✅ DONE |

> **เป้าหมาย: ปิดงาน UI v4.0 ให้ 100%** — ทุกรายการในแผนนี้ทำเสร็จและยืนยันด้วย test evidence แล้ว
---

## 17. Related Documents (v4.0 เพิ่มเติม)

- `README.md` (#48 DEEP LINK, #101 Normal Document Flow, #102 HOME PAGE LAYOUT FLOW v4.0)
- `src/lib/socialProofReviews.ts` (Social Proof Data + Video Policy)
- `STATUS_TRACKER.md` (Phase 7 — UI v4.0)
- `BITEMEBABY_PRODUCT_REALITY_MAP.md` (UI-07)

---

## 18. Mascot Asset System — ท่าทางน้อง Bite (Scale & Placement Guide)

> ตามคำสั่งเพิ่มเติม (Asset Mapping Directive) — Dev ต้องรู้ว่าท่าทางใดเก็บไว้ที่ใด และนำไปลดสเกลใช้บน UI จุดใด

### 18.1 ท่าทางน้อง Bite (Pose Concept) & จุดนำไปใช้งาน

| # | ท่าทาง (Pose Concept) | รายละเอียดท่าทาง (Visual Details) | จุดนำไปลดสเกลใช้งานบน UI (UI Placement) |
|---|------------------------|-----------------------------------|-------------------------------------------|
| 1 | Greeting & Welcome | ถือถาดอาหาร / กวักมือทักทาย ยิ้มสดใส | Hero Banner Header (README §39 / §40) และหน้า Splash Screen |
| 2 | Mini Heart / Love | ชูมือทำท่า Mini Heart สเกลขนาดจิ๋ว | Customer Review Cards (มุมขวาล่างของการ์ดรีวิว) |
| 3 | Thumbs Up / Guarantee | ยกนิ้วโป้งการันตีความอร่อย | Featured Menu Badges (ติดบนเมนูขายดี / เมนูแนะนำ) |
| 4 | Fast Delivery / Running | ถือกล่องอาหาร / วิ่งส่งของ | Delivery Round Cards (รอบเช้า/กลางวัน/เย็น) และหน้า Tracking |
| 5 | Pointing / Guide | ชี้นิ้วไปทางข้าง ๆ หรือชี้ลง | Call-to-Action Buttons (ชี้ไปที่ปุ่มสั่งซื้อ หรือปุ่มสุ่มเมนู) |
| 6 | Peeking / Corner | โผล่หน้าและมือมาจากขอบมุมการ์ด | Glassmorphism Overlay Cards (เกาะมุมกล่องรีวิว / โปรโมชั่น) |
| 7 | Thinking / Dice | ถือลูกเต๋า 3D ทำท่าครุ่นคิด | Random Menu Feature (ปุ่มสุ่มเมนูคิดไม่ออก) |
| 8 | Empty / Sad Bite | ทำหน้าหงอย หรือถือจานว่างเปล่า | Empty Cart / Sold Out State (เมื่อสินค้าหมด หรือตะกร้าว่าง) |

### 18.2 Asset Directory & Naming (Asset Mapping Directive)

```text
/public/assets/mascot/
├── bite_hero_greeting.webp      (Hero Header / Splash)
├── bite_badge_mini_heart.webp   (Review Card Badge — มุมล่างการ์ด)
├── bite_badge_thumbsup.webp     (Featured Product Badge)
├── bite_delivery_run.webp       (Delivery Rounds & Order Status / Tracking)
├── bite_pointing.webp           (CTA Buttons)
├── bite_peeking.webp            (Glassmorphism Overlay Cards)
├── bite_thinking.webp           (Random Menu)
└── bite_empty_sad.webp          (Empty Cart / Sold Out)
```

> ⚠️ **สถานะปัจจุบัน:** ทั้ง 8 ไฟล์เป็น **placeholder** = คัดลอกจากเวกเตอร์เดิม (`/mascot_Bite_Welcome|Main|Thinking|Good bye.webp`) เพื่อให้ UI ทำงานได้ทันที — เมื่อทีมดีไซน์ส่ง **3D render จริง** ให้ทับไฟล์ที่ชื่อเดียวกัน โค้ดจะใช้เองทันที (fallback `onError` ใน `MascotBadge`)

### 18.3 Reusable Component: `<MascotBadge />`

```typescript
export interface MascotBadgeProps {
  pose: MascotPose;                  // 8 poses — types/index.ts
  size?: 'sm' | 'md' | 'lg' | 'fluid'; // sm=52px, md=72px, lg=104px, fluid=ตาม container
  alt?: string;
  className?: string;                // ต่อท้าย เช่น `mascot-mini`, `mx-auto`, `w-full h-full`
  loading?: 'lazy' | 'eager';
}
```

```tsx
<MascotBadge pose="heart"    size="sm"    className="mascot-mini" />                      // review card มุมล่าง
<MascotBadge pose="running"  size="sm"    className="mx-auto mb-2" />                     // delivery rounds
<MascotBadge pose="thumbsup" size="sm" />                                                 // featured menu badge
<MascotBadge pose="thinking" size="sm"    className="mx-auto mb-2" />                     // random menu
<MascotBadge pose="greeting" size="fluid" className="w-full h-full object-contain" />     // hero banner
```

### 18.4 CSS Rules (บังคับ)

```css
.mascot-badge {
  pointer-events: none;   /* ⛔ ต้องไม่บดบังการกดปุ่ม Call-to-Action ของผู้ใช้ */
  user-select: none;
  filter: drop-shadow(...); /* 2.5D นุ่ม ๆ */
}
```

- ทุก `<MascotBadge />` เคารพ `prefers-reduced-motion: reduce`
- ห้ามใช้ `pointer-events: auto` บน badge — กันการบัง CTA
- การวางตำแหน่ง (absolute/มุมการ์ด) ควบคุมผ่าน `className` (เช่น `mascot-mini`) ไม่ใช่ภายใน component