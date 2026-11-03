# BMB — Wave 2: M1 ADR · Evening-Round Audit · Production Readiness
Date: 2026-10-13 · Baseline: `3ab1636` (+ Wave-2 commit) · Owner directive: CONTINUOUS EXECUTION WAVE 2 · Status: **docs + 2B fix only — ไม่มี production write**

## A. M1 Architecture Decision Record (2C — M1 = selected, no re-choice)

### A1. Authoritative `order_mode` assignment (audit fact)
- `create_order_with_items` (`025:31-46`) = RPC เดียวทั้งสองโหมด; `p_order_mode` (default SAME_DAY) → `v_mode` (`025:95`) → INSERT `orders(order_mode, …scheduled_date)` (`025:312`) — **mode = parameter ที่ client ส่ง แต่ server validate ทุก gate**: round active+capacity `FOR UPDATE` (`025:112-155`) · SAME_DAY = round วันนี้+cutoff (`025:127-136`) · PRE_ORDER = date>today == round_date + lead (`025:137-150`) · per-item `is_available` → `ERR_PRODUCT_UNAVAILABLE` + mode gate `ERR_PRODUCT_MODE_NOT_ALLOWED` (`025:180-190`) · `trg_menu_gate` on-menu (`039:216`) · `trg_operating_hours` mode/round open (`039:254,262`)
- **1 order = 1 mode** โดย construction (orders.order_mode single column; `order_items` ไม่มี mode) → M1 ต้อง **split เป็นหลาย order** ไม่ใช่ item-level

### A2. M1 contract (แยก order · รวม plan)
- **Cart**: ปัจจุบันล็อกโหมดเดียว (`cartStore` OD-4 + pendingMode modal) → M1 อนุญาต cart ผสม; แต่ละ item คง canonical eligibility ของมันเอง
- **Checkout split**: cart ถูกแบ่งเป็น child orders ตาม mode+round group → เรียก `create_order_with_items` **ทีละ order** (sequential); order identity/payment/audit/state machine ต่อ order แยกกัน **ไม่มีการ merge** — `order_mode`/`scheduled_date`/`delivery_round_id` คงเป็นคนละ concept
- **Partial failure**: ไม่มี idempotency key ใน RPC (มีแค่ order_number retry `007:82-83`) → UX บังคับ: **submit lock ระหว่าง split + แสดงผลราย order (สำเร็จ/ล้มเหลว) + retry เฉพาะตัวที่ล้มเหลว** (order ที่สำเร็จแล้วห้าม resubmit) — ห้าม retry แบบรวม
- **Delivery manifest**: view อ่านอย่างเดียว group by `(scheduled_date, delivery_round_id)` ที่มีอยู่จริงใน orders — **ไม่เปลี่ยน status/ไม่ dispatch ผ่าน manifest** ไม่แตะ identity/payment/state
- **Duplicates**: client submit lock กัน double-click; ซ้ำจริง = ตัว RPC (ไม่มี idempotency) → plan ระยะถัดต้องเพิ่ม client-side ผลลัพธ์ต่อ order ก่อนคืน cart

### A3. Payment safety boundary (ห้ามฝ่า)
- ความสัมพันธ์ปัจจุบัน = **1 payment record ต่อ 1 order** (`payment_intents(order_number)` · `orders.payment_status/method`)
- **Mixed cart อนุญาตเฉพาะ `cash_on_delivery` ใน increment แรก** — PromptPay/credit_card ยังอยู่ในรูป single-mode checkout เท่านั้น: เหตุผล = ไม่มี allocation model ที่ traceable ว่า QR/intent เดียว cover 2 orders อย่างไร → ห้าม merge เงินแบบ silent (payment safety policy)
- **การเปลี่ยน schema/payment ใด ๆ ห้ามทำ** ก่อน design reconciliation ครบ — ไม่แตะ production payment config, ไม่สร้าง payment จริง/เทส
- Single customer-facing payment + auditable allocation = ประเมินแล้วยัง **ไม่ feasible ใน increment นี้** (ต้อง design ก่อน)

### A4. OD-4 supersession + tests ที่ต้องแก้ (contract changes สำหรับ 2D)
- OD-4 เดิม: "cart lock โหมดเดียว ห้ามเปลี่ยนเงียบ ๆ" → **ถูกแทนที่บางส่วน**: cart เปิดรับ mixed ได้; guard ใหม่ = split ตอน checkout + eligibility ต่อ item (Wave 2B `checkModeEligibility` แล้วเสร็จ) + confirmation UI ตอน split
- Tests ต้องปรับตอน 2D: `cartIsolationStore.test.ts` (lock semantics) · `cartPersistence.test.ts` · `canonicalOrderFlow.test.ts` (split path) · checkoutModeLock (mode picker ยังคง single-ส่งต่อ order ถูกต้อง)

## B. 2E — Evening-Round Consumer Audit (read-only, ไม่มีการปิด)
ผู้บริโภค `evening`: `types/index.ts:13` RoundPeriod · `aiService.ts:63` · `faqContent.ts:30` · `demandForecasting.ts:11,48,67,79,135` · `homeProviders.ts:148` · `AdminMenuSchedule.tsx:14` ROUND_KEY_OPTIONS · tests (`supabaseMock`, `canonicalOrderFlow:43`, `menuSchedule.test`, `preOrderQueue`) · migrations `001:54`, `039:285,291` (`evening_open` default true) · production: round rows active (42 rounds) + historical orders FK `delivery_round_id`
**ข้อเสนอ (ยังไม่ทำ — ต้อง authorization เฉพาะ):** (1) sweep copy/UI/options เอา evening ออกก่อน (code, รีวิวได้) → (2) ปิดผ่าน `business_settings.operating_hours.evening_open=false` (non-destructive lever `039:258-263`) → (3) **ห้ามลบแถว round/แก้ประวัติออเดอร์เด็ดขาด**

## C. 2F — Production Readiness Pack
| พื้นที่ | SOURCE | AUTOMATED-TEST | NON-PROD-E2E | PROD-RUNTIME |
|---|---|---|---|---|
| Weekly schedule + 2/day publish | ✅123+UI | ✅914 tests mirror | ❌ contract ยังไม่รัน | ❌ ไม่ได้ publish จริง |
| Product enable/disable propagation | ✅025+123+2B guard | ✅ incl. stale-cart | ❌ | ❌ |
| SAME_DAY eligibility | ✅025 gates | ✅canonicalOrderFlow | ❌ | ❌ |
| Mixed checkout / M1 | 📝 ADR เท่านั้น — **ยังไม่ implement** | ❌ | ❌ | ❌ |
| Payment correctness | ✅ model 1:1 คงเดิม | ✅payment tests เดิม | ❌ | ❌ ห้าม test payment |
| Kitchen/manifest | ✅ queue views เดิม (manifest ยังไม่มี) | partial | ❌ | ❌ |
| Rounds/capacity | ✅FOR UPDATE+trigger | ✅mock | ❌ | ❌ (evening คงเดิม) |
| Tracking/failure recovery | ✅เดิม | ✅ | ❌ | ❌ |
| **RC-5 build identity** | ❌ | ❌ | ❌ | **BLOCKED** |

**Production actions ที่ยังต้องขอ authorization (ยังไม่ทำ):** ① รัน `contracts_123` กับ non-prod DB (ต้อง Docker engine หรือ non-prod Supabase project — สิทธิ์/ทรัพยากรภายนอกต้อง Owner สร้าง) ② publish schedule วันแรกจริง (ME-05/06) ③ test order จริง 2 โหมด ④ any `operating_hours`/round change (รวม evening) ⑤ M1 เปิดใช้จริงหลัง 2D+tests ⑥ RC-5 SHA binding
**Evidence tiers ปัจจุบัน:** SOURCE ✅ · AUTOMATED-TEST ✅ · NON-PROD-E2E ❌ · PRODUCTION-RUNTIME ❌ (คงเดิม — ไม่มีการอ้าง runtime จาก mock/CI)
**2D = phase ถัดไปที่ authorized** (cart mixed → split + retry UX → manifest read-only → regression set) — ยังไม่เริ่มใน wave นี้