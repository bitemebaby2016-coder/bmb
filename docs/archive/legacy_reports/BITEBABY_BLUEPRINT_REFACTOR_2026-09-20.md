> **WARNING: HISTORICAL DESIGN RECORD (2026-09-20) -- NOT current state authority**

# Bite Me Baby -- MASTER UNIVERSAL BLUEPRINT REFACTOR (2026-09-20)

> **เอกสารนี้คือหลักฐานการออกแบบในอดีตเท่านั้น**
> แนวคิดในเอกสารนี้ได้ถูกนำไป implement ใน code แล้ว
> สถานะปัจจุบันต้องดูที่ `docs/BMB_CURRENT_STATE_2026-09-20.md`

---

## 1. สรุปสถานะจริง ณ วันนั้น (Historical, ไม่ใช้ประกาศสถานะปัจจุบัน)

```
$ npm test          -> Test Files 11 passed (11)    Tests 106 passed (106)
$ npm run build     -> tsc (0 errors) + vite build  built (PWA generateSW ok)
```

- Baseline เดิม (ก่อนงานนี้): **68 tests / 5 files** — หลังเพิ่มงานนี้: **106 tests / 11 files**
- selfprint อยู่คนละ repo ของตัวเอง — **ไม่ถูกแตะต้อง** ในงานนี้

---

## 2. สถาปัตยกรรมใหม่ที่สร้าง (ตาม Blueprint)

### Multi-Tenant Global Configuration Engine
`src/config/platformConfig.ts` — Config reactive via Zustand

### Stores (Zustand, Decoupled)
- `src/stores/useCartStore.ts` — Cart Isolation Engine
- `src/stores/useOrderStateMachine.ts` — State Machine reactive
- `src/stores/useDeliveryRouter.ts` — Hybrid Dispatch Hub
- `src/stores/useBiteAIStore.ts` — 4-Stages AI Mascot Stage Manager

### Pure Engines
- `src/lib/availabilityEngine.ts` — Truth Table availability
- `src/lib/orderStateMachine.ts` — Allow-list transitions
- `src/lib/deliveryRouter.ts` — Haversine + Two-Tier dispatch

---

## 3. Test Counts (Historical Only)

ตัวเลขเดิมจาก session 2026-09-20:
- **106 tests / 11 files** (npm test)
- **tsc 0 errors** (npm run build)

> ⚠️ **ตัวเลขเหล่านี้เป็นของ session เดิม และอาจไม่ตรงกับปัจจุบัน**
> Current reality ต้องอ่านจาก `docs/BMB_CURRENT_STATE_2026-09-20.md` เท่านั้น (ล่าสุด ตรวจ 2026-09-21: **163/163 PASS** @ HEAD `f03a0f7`, Build PASS, Lint 0 errors)

---

*Selfprint: separate repository, not touched in this work.*
