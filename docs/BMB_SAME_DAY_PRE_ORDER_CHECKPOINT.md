# BMB — CHECKPOINT สถานะและเวลา ต่องาน (SAME_DAY / PRE_ORDER)

> **สร้าง:** 2026-10-13 (ICT) · **HEAD ณ สร้าง:** `fbe5ac6` = `origin/main` · **อนุมัติโดย:** Owner "PHASE 0 ACCEPTED → CONTROLLED EXECUTION"
> **หน้าที่:** เช็คพอยต์ให้ Owner ตรวจปิดเกตภาษาไทยได้ทุกจังหวะ — อัปเดตบรรทัดนี้ "ทุกครั้ง" ที่งานเริ่ม/จบ ห้ามทิ้งงานค้างโดยไม่มีสถานะ
> **เอกสารคู่:** `BMB_SAME_DAY_PRE_ORDER_MASTER_PLAN.md` · `PHASE_CONTRACTS.md` · `REGRESSION_MATRIX.md` · `EVIDENCE_LOG.md`

## 0. กติกาการใช้

- **สถานะที่ใช้ได้:** `DONE` (มีหลักฐานครบ) · `IN PROGRESS` (กำลังทำ) · `BLOCKED` (ติด hard stop / evidence — ต้องมีเหตุผล) · `DEFERRED` (เลื่อนตาม Owner decision) · `PENDING` (ยังไม่เริ่ม)
- เวลาเป็น **ICT (+07:00)** · เริ่ม = ลงมือทำจริง · จบ = gates ผ่าน + commit/push (ถ้ามี)
- หลักฐานอ้างด้วย `commit SHA` / `path:line` / `EV-xxx` เท่านั้น — **ห้ามอ้างความรู้สึก**
- อัปเดตด้วย editor/node (PowerShell พิมพ์ไทยเพี้ยน)

## 1. ตาราง Checkpoint ต่องาน

| # | งาน | สถานะ | เริ่ม (ICT) | จบ (ICT) | หลักฐาน / commit | หมายเหตุ |
|---|---|---|---|---|---|---|
| 0.1 | Phase 0 — audit + เอกสาร 5 ไฟล์ | **DONE** | 2026-10-13 (รอบ audit) | 2026-10-13 | EV-001..013 · ผล review = PASS ทุกหัวข้อ | Owner ACCEPTED |
| 0.2 | Phase 0 commit + push | **DONE** | 2026-10-13 09:06 | 2026-10-13 09:06 | `fbe5ac6` (5 ไฟล์ +430/−21) | HEAD == origin/main ✓ · worktree ✓ · stash ✓ |
| 0.3 | CI ของ `fbe5ac6` (ME-04) | **DONE** | 2026-10-13 09:06 | 2026-10-13 09:07 | GH Actions run #410 `completed/success` (updated 02:07:33Z) | ME-04 ปิดแล้ว |
| 3 | Phase 3 — AdminOrders filter wiring (RC-1) | **DONE** | 2026-10-13 09:11 | 2026-10-13 09:31 | commit `4cb22eb` · CI run #411 `completed/success` · `AdminOrders.tsx:70-79` + `adminOrdersModeFilter.test.ts` (6 tests) · EV-014 | gates 4/4 = 0 · 866/866 tests · regression พิสูจน์แล้ว (ถอด fix = 6/6 fail) · HEAD == origin/main ✓ |
| 1 | Phase 1 — Storefront eligibility (RC-2) | **DONE** | 2026-10-13 09:33 | 2026-10-13 09:44 | `talkToBite.ts` helpers + `homeProviders.ts` + `FoodTheater.tsx` + `HomePage.tsx` · `storefrontEligibility.test.ts` (8 tests) · EV-016 | gates 4/4 = 0 · 874/874 tests · proof: ถอด fix = 3 fail · caller survey: `handleReviewCta` แก้เพิ่ม · MenuPage/FoodMenuCard/homeShowcase ดีอยู่แล้ว |
| 2 | Phase 2 — Cart/Checkout consistency (RC-3) | **DONE** | 2026-10-13 09:50 | 2026-10-13 10:09 | commit `f20a6be` · CI run #413 `completed/success` · `HomePage.tsx` guard + `CheckoutPage.tsx:55-69` lock-wins · 2 test files (5 tests) · EV-017 | gates 4/4 = 0 · 879/879 · proof 2 ทาง · HEAD == origin/main ✓ |
| 4 | Phase 4 — ยุบ AdminPreOrders (RC-6) | **DONE** | 2026-10-13 10:12 | 2026-10-13 10:22 | commit `8bd6276` · CI run #414 `completed/success` · ลบ `AdminPreOrders.tsx` · `App.tsx:237-238` redirect · `adminUi.ts` ลบ 2 entry · `AdminOrders` preset `?mode=` · `adminPreOrdersConsolidation.test.ts` (7) · EV-018 | gates 4/4 = 0 · 886/886 · grep AdminPreOrders = 0 · nav invariant เดิมผ่าน · AdminKitchen/MenuSchedule/Rounds ไม่แตะ ✓ |
| 5A | Phase 5A — read-only production identity + RC-5 (OD-2) | **DONE** | 2026-10-13 10:44 | 2026-10-13 10:58 | `biteme-baby.com` read-only probe · entry `index-7UHx2Gky.js` · EV-019 | content markers P1-P4 ครบ = deployed ≈ f96ba33 ระดับ content · **SHA binding MISSING → RC-5 formal = BLOCKED** · DOM: mode sections ไม่มี dual ปุ่ม · dual มีแค่หมวดกลาง ๆ ของสินค้า dual-mode · ไม่แตะ production |
| 5B | Phase 5B — A1 implementation (RC-4/RC-5 UX) | **DONE** | 2026-10-13 11:05 | 2026-10-13 11:35 | mode prop chain + dedupe + 10 tests · EV-020 | tsc 0 · lint 0 · **896/896** · build 0 · proof ถอด fix = 5/10 fail · INV-16/INV-19 COVERED · A2 = DEFERRED (OD-1) ไม่เริ่ม · **RC-5 formal = BLOCKED คงเดิม** (EV-019) · source-level เท่านั้น — แยกจาก production result |
| 6 | Phase 6 — Canonical field audit (RC-7) | **DONE** | 2026-10-13 13:00 | 2026-10-13 13:16 | audit repo-wide + แก้ 2 UNSAFE + 5 tests · EV-021 | classification: CANONICAL 7 · COMPAT 7 · **UNSAFE 2 → แก้แล้ว** (MenuPage:169, VotePage:17) · STALE 0 · proof 2/5 fail · tsc 0 · lint 0 · **901/901** · build 0 · INV-18 COVERED · ไม่ลบ compatibility · ไม่แตะ schema |
| BM-1 | Business-model alignment audit (2 เมนู/วัน · 2 rounds · mixed plan) — documentation checkpoint | **DONE** | 2026-10-13 13:30 | 2026-10-13 13:45 | EV-022 + contract proposal (M1 vs M2, 2-menu enforcement, evening audit) ส่ง Owner review | **read-only เท่านั้น** — ไม่แก้ source/schema/data/config · conflicts C-1..C-5 บันทึกแล้ว · `menu_schedule` prod = 0 แถว · round `evening` active ใน prod ( consumers ไล่ครบใน EV-022) · **รอ Owner architecture review ก่อน implement business behavior ใหม่** · RC-5 = BLOCKED คงเดิม · ไม่ทำซ้ำ Phase 5A/5B/6 |
| W2 | Wave 2 — M123 accepted · 2A isolated-contract audit · 2B stale-cart guard · 2C M1 ADR · 2E evening audit · 2F readiness | **DONE** (2D = NOT STARTED) | 2026-10-13 15:40 | 2026-10-13 16:10 | EV-023 + `BMB_WAVE2_M1_AND_READINESS.md` | 2A = ไม่มี non-prod DB (contract NOT EXECUTED · prerequisite รายงาน) · 2B fix + 3 tests → **914/914** · tsc 0 · lint 0 · build 0 · M1 ADR = COD-only mixed, split per order, manifest read-only · ไม่มี production write · migration 123 ไม่ apply ซ้ำ · payment/rounds/settings ไม่แตะ · RC-5 BLOCKED คงเดิม |
| W2D | Wave 2D-1/2D-2/2D-4 + payment audit — CI #421 ✓ baseline | **DONE** (2D-3 = NOT STARTED, รอ idempotency/payment design) | 2026-10-13 16:30 | 2026-10-13 17:05 | EV-024 | payment audit: **COD มีจริง** (enum/UI/server) → mixed plan = COD-only enforced · cart `line_mode` ต่อ item (ไม่มี migration — optional persistence field) · OD-4 lock **superseded โดย M1** · `planSplitCheckout` deterministic ไม่เรียก RPC · `buildDeliveryManifest` read-only · **924/924** · tsc 0 · lint 0 · build 0 · ไม่มี production write/payment · RC-5 BLOCKED คงเดิม |
| W3 | Wave 3.0 baseline (CI #422 ✓) + 3.1 multi-order submission engine + idempotency investigation | **DONE** | 2026-10-13 18:10 | 2026-10-13 18:40 | EV-025 | idempotency: ไม่มีใน schema (`025:280-297` random suffix) → **migration proposal = ยังไม่ apply, รอ Owner** · `m1Submit.submitSplitOrders`: lock/conflict · retry เฉพาะ confirmed-failed · ambiguous → pending ห้าม resubmit · mixed ผิดวิธีชำระ = blocked ก่อน RPC · 7 tests → **931/931** · tsc 0 · lint 0 · brand OK · build 0 · CI **#423 = success** · ไม่มี production write · RC-5 BLOCKED คงเดิม |
| W4 | Wave 4: CheckoutPage M1 integration + closure docs (C/D/G) | **DONE** | 2026-10-13 19:30 | 2026-10-13 20:10 | EV-026 | mixed branch ใน `handlePlaceOrder`: COD-only pre-RPC gate · plan errors หยุดก่อน submit · engine lock ข้าม click · created/failed/ambiguous แยกชัด · partial = ไม่ clearCart ไม่ navigate · intent 1:1 ต่อ child · single-mode ไม่แตะ · `docs/BMB_CLOSURE_WAVE4.md` = proposal+inventory+RC-5 · gates 931/931 · tsc 0 · lint 0 · brand OK · build 0 · CI #424 = success |
| W5 | Owner sequence: step 1 = CI #425 ✓ + component-test gap ปิด | **step 1 DONE** | 2026-10-13 21:00 | 2026-10-13 21:30 | EV-027 | CI **#423/424/425 = success ครบ** · `checkoutMixedSplit.test.ts` 3 cases (pre-RPC reject / COD split+intent1:1+navigate / partial ไม่โกง) → **934/934** · tsc 0 · lint 0 · build 0 · brand OK 349 |
| W5B | Wave 5B: contract 124 ปิด + fresh-DB gap assessment + Owner review pack | **DONE — แต่ Owner ยังไม่รับรอง 124 (มีจุดเสี่ยงค้าง → W5C)** | 2026-10-13 21:45 | 2026-10-13 23:35 | EV-029 | contract 124 **EXECUTED & PASSED** (CI #18 `cdc79ac` = success ครั้งแรกของ workflow · #19 `a834cc6` = success รวม T8b · local Docker replica ALL_GREEN×3) · matrix ครบ 10 กรณี + concurrency 2 sessions จริง · แก้ฝั่ง contract 3 class (coords จาก `kitchen_location()`, ไม่มีคีย์ `ok`, T8 ผ่าน pg_temp helper) · **PROPOSED migration `orders.delivery_address`** (ยังไม่ apply) · root-cause matrix 035/065/067/070/077/081/107 · review pack `docs/BMB_WAVE5B_OWNER_REVIEW_PACK.md` · gates 934/934 · tsc 0 · lint 0 · build OK · brand 349 · **ไม่แตะ production/src/migration history** · ห้ามประกาศพร้อมเปิดร้านจน PRODUCTION-RUNTIME ผ่าน |
| W5C | ปิดจุดเสี่ยง contract 124 (Owner: "124 ยังไม่ให้ผ่าน") — R1 fingerprint scale, R2 key normalization, R3 stale replay + เติม test R4-R8/R14 | **PENDING** | — | — | EV-030 | แฮนออฟ `docs/BMB_WAVE5B_HANDOFF.md` = risk register R1-R15 + first actions · เกณฑ์ปิด: R1-R3 แก้จริง + R4-R8/R14 test ครบ + local/CI เขียว + Owner เซ็นรับรอง diff 124 · **ห้าม apply 124 ใน Production จนกว่าจะครบ** |
| 7 | Phase 7 — E2E / Production closure | **PENDING** | — | — | — | read-only ก่อน · ห้าม production mutation โดยไม่มี authorization เฉพาะ |

## 2. Baseline ที่ห้ามคลาดเคลื่อน (ตรวจอัตโนมัติก่อนเริ่มงานทุกครั้ง)

- `HEAD == origin/main` (ปัจจุบัน: `3bacfd9` — อัปเดตเมื่อมี commit ใหม่)
- untracked เดิม **13 ไฟล์** (png 10 + webp 3) อยู่ครบ + ไฟล์เพิ่มใหม่ในรอบนี้ (เช่นเอกสารนี้) ต้องระบุไว้ใน status
- stash `local-edits-before-sync-2026-09-21` ไม่ถูกแตะ
- Quality gates (fresh): `npx tsc --noEmit --incremental false` · `npm run lint` · `npm test` · `npm run build` = 0 ทุกตัว

## 3. บันทึกการแก้ไข

- 2026-10-13 — สร้างฉบับแรก (หลัง Owner authorization) — เวลาอ้างอิงจาก git log / GitHub API
