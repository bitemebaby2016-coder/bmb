# BMB — WAVE 4 CLOSURE: IDEMPOTENCY PROPOSAL · PROJECT INVENTORY · RC-5
> Tier ระบุต่อรายการ: SOURCE / AUTOMATED-TEST / NON-PROD-E2E / PROD-RUNTIME · 2026-10-13

## C. Idempotency — findings & SMALLEST BACKWARD-COMPATIBLE MIGRATION PROPOSAL (NOT APPROVED · NOT APPLIED)

**Facts (source-verified):**
- `025_canonical_order_rpc.create_order_with_items`: order_number = `PO-/BMB-` + date + `random()` 3-digit (025:280-297), collision-retry ≤5 แล้ว `RAISE ERR_ORDER_NUMBER_EXHAUSTED`; `orders.order_number` UNIQUE (001:138) → ป้องกันเลขซ้ำ **แต่ไม่ป้องกันคำขอซ้ำ**.
- ไม่มีพารามิเตอร์/คอลัมน์ idempotency ฝั่ง client ใน RPC → retry คำขอเดิม = order ใหม่เสมอ.
- Transaction: PL/pgSQL exception ⇒ ทั้ง transaction abort ⇒ **`failed` (error ชัดเจน) = ไม่มี row เด็ดขาด → retry ชนิดนี้ปลอดภัยโดยไม่ต้องแก้ schema**.
- Payment intent: สร้าง client-side ต่อ `order_number` (CheckoutPage) → 1:1 ตาม order ปัจจุบัน.

**Proposal (migration 124 — รอ Owner approval อย่างชัดเจน; การอนุมัติ 123 ไม่ครอบคลุม):**
1. `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_submit_key text;` (nullable = backward-compatible, callers เก่าไม่กระทบ)
2. `CREATE UNIQUE INDEX IF NOT EXISTS orders_client_submit_key_key ON public.orders(client_submit_key) WHERE client_submit_key IS NOT NULL;`
3. `create_order_with_items(..., p_client_submit_key text DEFAULT NULL)` — INSERT เท่านั้น: ถ้า key ใหม่ → insert; **replay = `SELECT` คืน order เดิม** หลังตรวจ **ownership (`auth.uid()`/phone) + payload consistency (mode/round/date/item hash) ตรงกัน** จึงคืน — ถ้า key ซ้ำแต่คน/payload ต่าง → `RAISE ERR_IDEMPOTENCY_CONFLICT` (ห้ามคืนแถวมั่ว ๆ).
4. Rollback:  drop index+column (data เป็น optional) — ไม่มีการแปลงแถวเดิม.
5. Contract tests: duplicate request → order เดียว; ชนคนอื่น → conflict; retry หลัง timeout → คืน order เดิม — รันใน isolated DB (ยัง NOT EXECUTED).
**Hard stop:** ต้อง `OWNER APPROVAL REQUIRED` ก่อน apply; ระหว่างนี้ engine ปิดความเสี่ยงด้วย policy = ห้าม resubmit `ambiguous` (ไม่ต้องพึ่ง DB key).

## D. PROJECT-WIDE INVENTORY (source-verified; เฉพาะที่มี evidence)
| รายการ | Status | Source | Auto | NonProd | Prod |
|---|---|---|---|---|---|
| Storefront eligibility (matrix §3.1 canonical) | IMPLEMENTED+DEPLOYED | ✅ 3dd44ce | ✅ storefrontEligibility | ❌ | ❌ |
| Cart persistence + line_mode + stale guard | IMPLEMENTED | ✅ f20a6be,4902445 | ✅ 8 files | ❌ | ❌ |
| Checkout single-mode (3 payments) | IMPLEMENTED | ✅ CheckoutPage | ✅ orderApi tests | ❌ | ❌ |
| Checkout mixed split (M1 engine+UI) | IMPLEMENTED | ✅ e4543ee+m1Submit+CheckoutPage | ✅ engine/plan tests | ❌ | ❌ |
| Order RPC (eligibility/capacity/cutoff/state) | IMPLEMENTED | ✅ 025 | ✅ mode/contract tests | ❌ | ❌ |
| Idempotent per-child submit | **BLOCKED** → proposal ข้างบน | ⬜ ไม่มี | ⬜ | ❌ | ❌ |
| Payment enum/COD/intent 1:1 | IMPLEMENTED | ✅ 001/008/025 | ✅ | ❌ | ❌ |
| PromptPay card live charge | DEFERRED (manual QR) | ✅ paymentGateway | n/a | ❌ | ❌ |
| Admin weekly schedule + exactly-2 publish | IMPLEMENTED (prod 0 rows) | ✅ 3ab1636, M123 applied | ✅ menuSchedule* | ❌ contract | ⚠️ ไม่ได้ใช้จริง |
| Storefront schedule gate (mirror) | IMPLEMENTED | ✅ 039 + gate test | ✅ | ❌ | ❌ |
| Kitchen queue | IMPLEMENTED | ✅ | ✅ kitchen tests | ❌ | ❌ |
| Delivery manifest (read-only, actual date+round) | IMPLEMENTED | ✅ 4902445 | ✅ manifest tests | ❌ | ❌ |
| Tracking / failure recovery (runtime) | DOCUMENTED | ✅ views/RPC | partial | ❌ | ❌ RUNTIME รอ Owner |
| Auth/RLS/RPC boundary | IMPLEMENTED | ✅ supabase + codespace | ✅ security audit | ❌ | ❌ |
| Dead-letter/observability automation | MISSING (ไม่มีระบบ job) | ⬜ | ⬜ | ❌ | ❌ |
| RC-5 build→commit identity | **BLOCKED** (ดู §G) | ⬜ | ❌ | ❌ | ❌ |
| contracts_123 SQL | BLOCKED (ไม่มี isolated DB) | INSPECTED | ⬜ | ❌ | — |
| Mobile/loading/empty states | IMPLEMENTED | ✅ (part of tests) | partial | ❌ | ❌ |

## G. RC-5 — PRODUCTION BUILD IDENTITY (read-only)
- Probe `https://biteme-baby.com/` ผ่าน fetch: **ไม่เปิดเผย header build/commit ใด ๆ ให้ tool (ไม่มี `x-git-commit`/manifest endpoint สาธารณะ)** → HTML 200/asset filename/CI success = **ไม่ใช่** หลักฐาน commit (ห้าม equate).
- **สิ่งที่ยังขาด (ต้อง Owner):** access อ่านอย่างเดียวต่อ hosting deploy metadata (Cloudflare Pages deployment API / dashboard "Deployments → Commit SHA") **หรือ** endpoint ที่ serve build manifest (เช่น `/build-info.json` ฝั่ง origin) — ทั้งคู่ = `OWNER ACCESS/ACTION REQUIRED` (ห้ามแตะ DNS/CF/env เอง).
- เมื่อมี: จับคู่ `deployed asset hash ↔ local rebuild ของ commit` = proof ระดับ content-addressed.

## F. Recommended SINGLE ACCEPTance RUN sequence (เมื่อถึงเวลา)
1) full Vitest → tsc → eslint → brand+mojibake → build → CI 2) SQL contracts บน isolated DB 3) non-prod browser journey 1-14 (matrix ในคำสั่ง) 4) ถ้าผ่านทั้งหมด → ขอ Owner เปิด production acceptance (test orders จริง 2 โหมด → payment → kitchen → dispatch → delivery → tracking → failure recovery → open-shop)
