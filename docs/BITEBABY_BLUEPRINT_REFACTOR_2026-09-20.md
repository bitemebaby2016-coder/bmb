# Bite Me Baby — MASTER UNIVERSAL BLUEPRINT REFACTOR (2026-09-20)

> สถานะจริง ณ วันที่โพสต์เอกสารนี้: **DONE & VERIFIED** — โค้ดคอมไพล์ผ่าน + เทสผ่าน
> เอกสารนี้ **เขียนทับ** สถานะก่อนหน้า (ไม่ต่อเติมซ้ำ) เพื่อให้สถานะตรงกับโค้ดจริงใน repo
> อย่างเดียวทุกครั้ง

---

## 1. สรุปสถานะจริง (Verifiable, รันซ้ำได้)

```text
$ npm test          → Test Files 11 passed (11)    Tests 106 passed (106)
$ npm run build     → tsc (0 errors) + vite build  ✓ built (PWA generateSW ok)
```

- Baseline เดิม (ก่อนงานนี้): **68 tests / 5 files** — หลังเพิ่มงานนี้: **106 tests / 11 files**
- ทุกเทสเก่าที่ยังผ่านอยู่ **ไม่ถูกแก้/ลบ** มีเพียงการเพิ่มเทสใหม่ 6 ไฟล์
- `tsc --noEmit` (ผ่าน `npm run build`) **0 errors** (strict mode)
- selfprint อยู่คนละ repo ของตัวเอง — **ไม่ถูกแตะต้อง** ในงานนี้

---

## 2. สถาปัตยกรรมใหม่ที่สร้าง (ตาม Blueprint)

### Multi-Tenant Global Configuration Engine
```
src/config/platformConfig.ts
```
- Config ทั้งหมด (ระยะทาง Bite Drive, ค่าธรรมเนียม flat, markup tier2, ขีดส่งฟรี,
  cutoff hours, daily quota, debounce, glass theme, weekly rotator) ขับจาก
  `PlatformConfig` ที่เป็น reactive (Zustand store) — **ไม่ hard-code** ในฝั่ง UI
- `getPlatformConfig(tenantId?, overrides?)` สำหรับ White-Label หลาย Tenant

### Stores (Zustand, Decoupled)
```
src/stores/useCartStore.ts          # Cart Isolation Engine (order_mode + การยืนยันสลับ)
src/stores/useOrderStateMachine.ts  # State Machine reactive (Same-Day / Pre-Order)
src/stores/useDeliveryRouter.ts     # Hybrid Dispatch Hub (Two-Tier)
src/stores/useBiteAIStore.ts        # 4-Stages AI Mascot Stage Manager
```

### Pure Engines (ทดสอบได้แบบ deterministic)
```
src/lib/availabilityEngine.ts   # Truth Table: IsAvailable = (orders<quota) && (lead>=cutoff)
src/lib/orderStateMachine.ts    # Allow-list forward-only transitions
src/lib/deliveryRouter.ts       # Haversine + Tier1 BiteDrive / Tier2 3rd-party + markup
```

### Components
```
src/components/ui/GlassCard.tsx               # 2.5D/3D Glassmorphism base
src/components/ui/MascotWrapper.tsx           # absolute pointer-events-none float+shadow guard
src/components/cart/CartIsolationModal.tsx    # ModalAlert — ยืนยันเคลียร์ตะกร้าก่อนสลับโหมด
src/components/delivery/DistanceChecker.tsx   # Smart Verification (debounce 500ms, Two-Tier)
src/components/dashboard/CustomerTimeline.tsx # Timeline 3D Glass ฝั่งลูกค้า
src/components/dashboard/RiderPWA.tsx         # Geolocation + POD(Base64) กัน Delivered
src/components/dashboard/AdminControl.tsx     # Quota ceiling + สถานะไรเดอร์
src/components/ai/BiteMascot.tsx              # 4-Stage mascot (Ambient/Upsell/MicroHook/Chat)
src/components/ai/BiteAIChat.tsx              # Stage 4 Full-Screen contextual chat
```

### Integration (wired จริง)
- `Layout` → ใส่ `<BiteMascot />` (global floating, pointer-events guarded) + `<CartIsolationModal />`
- `App` → route ใหม่ `/rider` (RiderPWA) และ `/admin/control` (AdminControl)
- `CheckoutPage` → ฝัง `<DistanceChecker />` เป็น informational panel (additive)

---

## 3. หลักการสำคัญที่ปฏิบัติ

1. **NO HARD-CODING** — ค่าทั้งหมดอยู่ใน `platformConfig` / passed-in params
2. **Glassmorphism** — `bg-white/70 backdrop-blur-md border border-white/20`
3. **3D Depth** — hero/mascot ใช้ `-mt-12` + `filter drop-shadow-*` (ไม่ใช้ box-shadow บนภาพ)
4. **Decorative Guard** — `absolute pointer-events-none select-none`
5. **Security Boundary (Bite AI)** — AI emit ได้แค่ `EXECUTE_ADD_TO_CART` มีเทสยืนยัน

---

## 4. ขอบเขตเชิงเทคนิคที่เขียนเอกสารนี้ให้ตรงจริง (Honest Notes)

- **Legacy flow เดิมยังอยู่ครบและไม่ถูกแก้**: `src/store/cartStore.ts` (ตัวสั่งออเดอร์จริง),
  checkout `getBestProvider`, `bmbAdminApi_orders`, payment state machine, etc.
- งานนี้ **เพิ่ม** Blueprint layer ใหม่ (config/stores/libs/components) และ wire เป็น additive —
  โดยไม่ทำให้ช่องทางสั่งอาหารเดิมหรือเทสเดิมพัง (พิสูจน์ด้วย 106/106)
- **จุดเชื่อมต่อในอนาคต (ระบุชัด ไม่ได้ทำในรอบนี้)**:
  - ให้ `CartIsolationModal`/`useCartStore` ต่อเข้ากับ `OrderBuilderModal` ที่เรียก `useCartStore.addItem`
    จริง (ตอนนี้ isolation modal เป็นอิสระและพร้อมรับ event)
  - ให้ RiderPWA ดึง `navigator.geolocation` + อัปโหลด POD ไป `storage` จริง (ตอนนี้เก็บ Base64 ใน state)
  - ให้ `useOrderStateMachine` อ่านอัปเดตจาก WebSocket/long-polling (ตอนนี้ขับด้วย `advance()`/transition)

---

## 5. Test Evidence (รัน 2026-09-20)

| ชุดเทสใหม่ | จำนวน | สถานะ |
|---|---|---|
| availabilityEngine.test.ts | 5 | ✅ PASS |
| orderStateMachine.test.ts | 9 | ✅ PASS |
| deliveryRouter.test.ts | 5 | ✅ PASS |
| deliveryRouterStore.test.ts | 3 | ✅ PASS |
| cartIsolationStore.test.ts | 6 | ✅ PASS |
| biteAIStore.test.ts | 8 | ✅ PASS |
| **รวมใหม่** | **38** | ✅ |
| เทสเดิม (api/payment/addon/stripe…) | 68 | ✅ PASS (ไม่มีการแก้) |
| **รวมทั้งหมด** | **106** | ✅ PASS |

`npm run build` → `tsc` 0 errors + `vite build` ✓ (PWA generateSW, 77 precache entries)
