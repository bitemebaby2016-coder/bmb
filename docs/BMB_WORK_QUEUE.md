# BMB — WORK QUEUE (งานค้างทั้งหมดที่ยังไม่ปิด)

> **Canonical work queue** ตาม protocol §2.3 — เอกสารนี้คือแหล่งข้อมูลเดียวสำหรับงานค้าง
> - รวม: Remaining Live Tests + Blocked Tasks + Tasks Requiring Owner Decisions
> - ไม่มีงานที่ CODE_CLOSED อยู่ในนี้ (งานที่ปิดแล้วไปอยู่ CHANGELOG)
> - สถานะใช้: PLANNED / IN_PROGRESS / BLOCKED / LIVE_TEST_PENDING / LIVE_VERIFIED
> - อัปเดตจาก `docs/BMB_REMAIN_TESTS_LIVE_2026-11-23.md` (source) + `docs/BMB_MASTER_STATUS.md` + `docs/BMB_REQUIREMENT_RECONCILIATION.md`

---

## 📊 สรุปสถานะ Work Queue (2026-11-26 r5 — WP2 CODE_CLOSED + PUSHED)

| กลุ่ม | จำนวนข้อ | สถานะ | รายละเอียด |
|------|----------|-------|-----------|
| **Phase 2 WP1 (Schema 219-223)** | 5 migration | ✅ **ACCEPTED + PUSHED** | 1cd696a — RLS org/branch + 33 integration IDs ALL PASS |
| **Phase 2 WP2 (PO RPC 224 + API)** | 1 migration + API | ✅ **CODE_CLOSED + PUSHED** | R111 — `contracts_wp2_224.sql` 10 cases ALL PASS · replay 228 OK |
| **Phase 2 WP3 (PO UI / E2E)** | UI + E2E spec | ✅ **CODE_CLOSED + PUSHED** | R112 — PurchaseOrderPage in PurchaseHub (real API) · API 5 tests · E2E spec LIVE_TEST_PENDING |
| **Phase 2 WP4 (GRN DB/RPC/API)** | 1 migration + API | ✅ **CODE_CLOSED + PUSHED** | R113 — `contracts_wp4_225.sql` 8 cases ALL PASS · replay 229 OK |
| **Phase 2 WP5 (GRN UI / E2E)** | UI + E2E spec | ✅ **CODE_CLOSED + PUSHED** | R114 — GoodsReceivingPage · E2E LIVE_TEST_PENDING |
| **Phase 2 WP6 (WAVG posting/reversal)** | 1 migration + DB tests | ✅ **CODE_CLOSED + PUSHED** | R115 — `contracts_wp6_226.sql` 9 cases ALL PASS · replay 230 OK |
| **Phase 2 WP7+WP8 (Read APIs + Dashboard)** | 2 migrations + API + UI | ✅ **CODE_CLOSED + PUSHED** | R116 — `contracts_wp7_wp8_227_228.sql` 6 cases ALL PASS · replay 232 OK · Dashboard tab |
| **Phase 2 WP9-10** | 2 WP | ✅ **COMPLETE** | R117 — regression ALL GREEN + PHASE2_READINESS_WP10.md |
| **Staging Verification (WP3/WP5 E2E)** | E2E + workflow | ⏸️ **NOT PROVEN (Production-First)** | No staging (by policy). E2E NOT run. Will run on production ONLY after Owner deploy approval + test-data authorization. Specs ready (purchaseOrder/goodsReceiving). |
| **Production Deploy 219-228 + 233** | migration deploy | ✅ **DEPLOYED** | Applied by Owner + ledger repaired (`migration list` 001–233 all applied, no gaps/dups). Schema verified via fresh dump. Backup created+restore-tested. PITR still disabled (Owner). Live OCR/PO/GRN + regression = LIVE_TEST_PENDING. |
| **Contract Audit Closure** | 28 migration | ✅ **COMPLETE** | 311 tests PASS |
| **Phase 1 Contract Tests (214-218)** | 5 migration | ✅ **COMPLETE** | ALL GREEN in CI |
| **Live Tests E** | 7 | ✅ **LIVE_VERIFIED** | E-1..E-6 ผ่านหมด (E-7 diagnostic) |
| **Live Tests F** | 7 | ✅ **LIVE_VERIFIED** | F-1..F-4, F-7 ผ่านหมด (F-5, F-6 legacy) |
| **Live Tests G** | 7 | ⏸️ PARTIAL | G-1..G-5 ผ่าน · G-6, G-7 รอทดสอบ |
| **Live Tests H** | 6 | ⏸️ PARTIAL | H-3..H-6 ผ่าน · H-1, H-2 รอทดสอบ |
| **Live Tests I** | 8 | ⏸️ PAUSED | รอ Owner ทดสอบ (critical path) |
| **C-1..C-6** | 6 | ✅ **RESOLVED** | Owner decisions recorded |
| **Runtime Tests §T** | 13+ | ⚠️ BLOCKED | Production test pack — รออุปกรณ์/บัญชีจริง |
| **รวม** | **90+** | | |
| **R129 (Deploy EF image-gen 4 kinds — แก้ ERR_INVALID_KIND + ledger ตรง prod)** | 1 | ✅ **CODE_CLOSED + DEPLOYED + PUSHED (`ab388db`)** | deploy `image-gen` exit=0 · probe ก่อน/หลัง + smoke จริง kind=studio (qwen · cleanup แล้ว) · gates 4/4 (vitest 3,050) · ledger MATCH 233/233 · LIVE_TEST_PENDING: Owner สร้างภาพหมวด Studio บน /admin/marketing |
| **R128 (Theater mode badges — ประเภท/ปฏิทิน/ยังไม่ลงปฏิทิน)** | 1 | ✅ **CODE_CLOSED + PUSHED** | FoodTheater สืบทอดสิทธิ์โหมดจากเมนูจริง + ModeCornerBadge ทั้งสองการ์ด · เทสใหม่ 7 tests · gates green (tsc/lint/vitest 3,050/build) |
| **R127 (Toggle track 14→20px)** | 1 | ✅ **CODE_CLOSED + PUSHED** | Owner visual tune หลัง R126 — track 40×20 / knob 10×10 · gates green (tsc/lint/vitest 3,043/build) |
| **R126 (Toggle height fix — exempt 48px touch target)** | 1 | ✅ **CODE_CLOSED + PUSHED** | carve-out `min-height:0` + track 40×14 / knob 10×10 / translateX 26 · root-cause lock ใน test · gates green (tsc/lint/vitest 3,043/build) |
| **R125 (Toggle knob +50% / track สูง −50%)** | 1 | ✅ **CODE_CLOSED + PUSHED** | knob 5→7.5px · track 9→4.5px · translateX 31→28.5 · gates green (tsc/lint/vitest 3,043/build) |
| **R124 (Theater control → /admin/products + toggle −50%)** | 1 | ✅ **CODE_CLOSED + PUSHED** | `1124b2f` — ย้ายออกจาก /shop ไป /admin/products เหนือ 🔥 · toggle 9px · gates green (tsc/lint/vitest 3,043/build) |

---



## 🔨 กลุ่มใหม่ — Phase 2 WP1 Remediation (2026-11-26 — PENDING OWNER ACCEPTANCE)

> คำสั่ง Owner: "WP1 REMEDIATION & SCOPE CORRECTION" — แก้ DEFECT-1..5 + จัดขอบเขต WP ใหม่
> สถานะ: ✅ ACCEPTED + COMMITTED/PUSHED (1cd696a) — WP2 STARTED (Master Directive 2026-11-26)

| งาน | สถานะ | หลักฐาน |
|---|---|---|
| DEFECT-1..5 แก้ครบ (m219-223 + staged) | ✅ DONE | Defect Matrix §15.1 ใน `docs/PHASE2_DESIGN_REPORT.md` |
| จัดขอบเขต WP: ย้าย RPCs → staged_workflows (WP2/WP4/WP6/WP7/WP8) | ✅ DONE | `supabase/staged_workflows/` 5 ไฟล์ + README |
| RLS org/branch isolation (has_org_row_scope) ทั้ง 5 ตาราง | ✅ DONE | m223 + integration T223 (11 เคส) PASS |
| PostgreSQL replay: apply 001→223 | ✅ ALL GREEN 227/0 FAIL | `e2e/w2-replay-full-2026-11-25.log` |
| Phase 2 integration contracts (33 test IDs) | ✅ ALL PASS | `e2e/contracts_phase2_219_223.sql` |
| WP1 ACCEPTED + COMMIT/PUSH | ✅ DONE (1cd696a) | HEAD=origin/main ตรวจแล้ว |
| **WP2 (PO Workflow RPC 224 + API + tests)** | ✅ CODE_CLOSED + PUSHED | R111 · `e2e/contracts_wp2_224.sql` 10 cases ALL PASS · migration 224 |

**งาน staged ที่รอ WP เจ้าของ (ห้าม apply ก่อน WP นั้น):**

| ไฟล์ staged | WP | หมายเหตุ |
|---|---|---|
| ~~`wp2_po_workflow_rpc.sql`~~ | ~~WP2~~ | ✅ PROMOTED → migration 224 (R111) |
| `supabase/staged_workflows/wp4_grn_workflow_rpc.sql` | WP4 | GRN workflow RPC (สืบทอด org จาก PO) — งานถัดไปหลัง WP3 |
| `supabase/staged_workflows/wp6_wavg_posting_reversal.sql` | WP6 | WAVG post + reversal ใหม่ (DEFECT-2/3/4 แก้แล้ว) |
| `supabase/staged_workflows/wp7_price_history_read_api.sql` | WP7 | Read API — SECURITY INVOKER |
| `supabase/staged_workflows/wp8_po_dashboard_read_api.sql` | WP8 | Read API — SECURITY INVOKER |

**ลำดับถัดไป (Master Directive):** WP3 (PO UI/E2E) → WP4 (GRN DB) → WP5 (GRN UI) → WP6 (WAVG) → WP7 (Price History) → WP8 (PurchaseHub) → WP9 (Regression) → WP10 (Readiness)

---

**DONE 2026-11-25 r3 - Contract Audit Closure 124-213 COMPLETE: 67 files ALL GREEN (0 FAIL) in Docker replay (bmb_replay_w2, migrations 001-218 applied). 15 new contract files for 28 migrations (179-213) written + fixed until every case passes (311 tests). See BMB_MASTER_STATUS.md for the full fix list. Next: Owner audit review -> Live Test Groups E, F, G, H, I (35 cases).**

## 🔨 กลุ่มปัจจุบัน — Contract Audit Closure 124-213 (COMPLETE — 2026-11-25 r3)

**พื้นที่ที่พิสูจน์แล้ว (ห้ามทำซ้ำ):** suite 124-180 ALL GREEN บน fresh DB — replay 3 รอบ · commits `47a8860`, `5b33cd3`, `0785f36` · หลักฐาน `e2e/w2-replay-full-2026-11-25.log`

**งาน 28 migration → 15 ไฟล์เทส เสร็จสมบูรณ์ (311 tests PASS):**

| # | ไฟล์เทสใหม่ | ครอบ migration | หมายเหตุ |
|---|------------|----------------|----------|
| 1 | contracts_179_notification_hub | 179 | channel_identities + notification_outbox (แยกไฟล์เดี่ยว) |
| 2 | contracts_181_186_promotions | 181, 186 | addon margin + promotions BKK date |
| 3 | contracts_182_188_messages | 182, 183, 187, 188 | order messages + rider notify + dedup |
| 4 | contracts_189_197_rider_fallback | 189, 197 | claim fallback + rider loop fix |
| 5 | contracts_191_kitchen_bkk | 191 | kitchen BKK dates |
| 6 | contracts_192_193_crm | 192, 193 | CRM automation + consent |
| 7 | contracts_194_195_payment | 194, 195 | payment void enum + close-on-cancel |
| 8 | contracts_196_206_media_buckets | 196, 206 | music/mascot bucket policies |
| 9 | contracts_198_200_reviews | 198, 199, 200 | moderation + verified rules + anon read behavior |
| 10 | contracts_201_202_theater | 201, 202 | theater/carousel + approval_id |
| 11 | contracts_203_204_ai_memory | 203, 204 | AI grounding + user_post_context + order memory |
| 12 | contracts_205_social_actions | 205 | cancel_order_as_customer + social_timeline |
| 13 | contracts_207_211_rider_history | 207, 211 | my_deliveries dates + v4 return fix |
| 14 | contracts_212_delivery_sync_hop | 212 | preparing hop + admin_advance |
| 15 | contracts_213_cart_payload | 213 | cart_sessions payload + helpers |

**กติกา:** ทุกไฟล์ BEGIN...ROLLBACK · ห้าม shim ใหม่ · อ่าน migration จริงก่อนเขียนทุกครั้ง · replay ตรวจทุกกลุ่ม (`e2e/ci/w2_run_replay_full.bat`) · เพิ่ม CI step ต่อไฟล์ · จบด้วย replay สุดท้าย ALL GREEN ครบ 124-218 แล้วส่ง Owner

---

## ✅ Phase 1 — Smart Ingredient & Cost Management Foundation (2026-11-25)

**Owner Decision:** `OWNER DECISION — APPROVED WITH CONDITIONS` (2026-11-24)  
**Phase 1 Authorized:** 2026-11-24 | **Completed:** 2026-11-25 | **Gate Review:** Pending Owner

| Migration | Description | Owner Decision | Status |
|-----------|-------------|----------------|--------|
| **214** | `suppliers` table + RLS (is_inventory/is_kitchen/is_pos/is_finance from m146) | B5 (Supplier First) | ✅ APPLIED PROD |
| **215** | `inventory.supplier_id` FK + backfill from denormalized data (dry-run report) | B5 | ✅ APPLIED PROD |
| **216** | Inventory enriched: `prep_yield_factor`, `prep_waste_pct`, `purchase_unit`, `use_unit`, `conversion_factor`, `package_size`, `gross_weight`, `net_weight`, `wavg_cost`, `last_purchase_price`, `last_approved_price` | B1 (Cost Model), B2 (Unit Conversion), B3 (Yield/Waste) | ✅ APPLIED PROD |
| **217** | `supplier_products` mapping — 3 price states: committed (PO), realized (GRN), approved (policy) | B4 (Price States) | ✅ APPLIED PROD |
| **218** | `recipes` batch yield — `batch_yield_factor`, `batch_waste_pct`, `cost_per_unit`, `last_cost_calculated_at` | B3 | ✅ APPLIED PROD |

**API Layer:**
- `src/lib/bmbAdminApi_suppliers.ts` — Supplier CRUD (create/read/update/soft-delete/hard-delete)
- `src/lib/bmbAdminApi_supplierProducts.ts` — Mapping CRUD + 3 price state updates (`updateSupplierProductPrice`)

**Types Extended:**
- New: `Supplier`, `SupplierForm`, `SupplierProduct`, `SupplierProductForm`
- Extended `Ingredient`: `supplier_id`, `prep_yield_factor`, `prep_waste_pct`, `purchase_unit`, `use_unit`, `conversion_factor`, `package_size`, `gross_weight`, `net_weight`, `wavg_cost`, `last_purchase_price`, `last_approved_price`
- Extended `RecipeRow`: `batch_yield_factor`, `batch_waste_pct`, `cost_per_unit`, `last_cost_calculated_at`

**Contract Tests Fixed (CI):**
- `contract-tests.yml` now runs ALL migrations 001→latest (not stopping at 123)
- Removed skip for 214-218; added shims for Phase 1 migrations
- Migration 146 (Role Foundation) runs before 214 → `is_inventory()`/`is_kitchen()`/`is_pos()`/`is_finance()` available for RLS

**Local Gates (All Pass):**
- `tsc --noEmit` 0 errors
- `npm run lint` OK (598 files)
- `vitest run` 230 files / 2,521 tests PASS
- `npm run build` PASS (PWA v1.3.0)

**Next:** Owner Phase 1 Gate Review → Phase 2 Authorization

---

## ✅ Phase 2 — Design & Dependency Audit (2026-11-25)

**Owner Authorization:** Stage 1 (Design) authorized 2026-11-25 | **Status:** DESIGN COMPLETE — Report delivered

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Existing Data Flow Analysis | ✅ Complete | Verified from code: order flow, inventory deductions, Phase 1 schema |
| Database Schema Proposal | ✅ Complete | 4 new tables (PO, PO Lines, GRN, Price History) + inventory_tx extensions |
| PO/GRN State Machine | ✅ Complete | 8 PO states, 7 GRN states, transition rules, role matrix |
| Cost Calculation Specification | ✅ Complete | 5 price types, landed cost formula, allocation methods |
| Unit Conversion Specification | ✅ Complete | Conversion factor rules, GRN-time snapshot, edge cases |
| Stock Valuation Impact (WAVG) | ✅ Complete | Atomic GRN post, WAVG formula, race condition prevention |
| API/RPC Design | ✅ Complete | 9 new RPCs, TypeScript API layer |
| RLS/Permission Matrix | ✅ Complete | 10 policies using existing role functions (m146) |
| UI Screen/Workflow Spec | ✅ Complete | 6 PurchaseHub tabs with detailed screen specs |
| Test Matrix (J1/J2/J3) | ✅ Complete | 30+ DB tests, 18 E2E tests, 10 regression tests |
| Migration Plan | ✅ Complete | 7 migrations in sequence (219-225) |
| Rollback/Recovery Plan | ✅ Complete | Per-failure-point procedures + emergency scripts |

**Report File:** `docs/PHASE2_DESIGN_REPORT.md`

**Open Questions for Owner Decision:** 7 items (PO number format, approval workflow, variance tolerance, allocation method, WAVG correction, reversal window, backorder handling)

**Next:** Owner reviews Design Report → Approves/Requests Changes → Authorizes Stage 2 Implementation

---

## 🆕 กลุ่ม I — R102+R103+R104 (Server-side Cart Sync + FB IAB Guard + 1 Reply 1 Link)

**เงื่อนไขก่อนเริ่ม:** migration 213 APPLIED PROD ✓ · push `43121c3` + `d6f0a7b` + `47d2043` รอ Cloudflare deploy 2-3 นาที · hard reload (Ctrl+Shift+R) 1 ครั้ง · ล็อกอินลูกค้า/ไรเดอร์ตามต้องการ
**Gates โค้ด:** lint ✅ · vitest 229 ไฟล์ / 2501 tests PASS · build ✅ (PWA v1.3.1)
**EF Deployed:** ✅ `social-ai-worker` DEPLOYED (2026-11-24 · Owner deploy เอง exit=ok)

| Task ID | Test Case | Description | Pass Criteria | Status |
|---------|-----------|-------------|---------------|--------|
| **I-1** | Server-side cart sync — login cross-device (R103) | 1) ล็อกอินบัญชีเดียวกันบนอุปกรณ์ 2 เครื่อง 2) เพิ่มเมนูบนเครื่องแรก (≥2 รายการ รวม addOns/pre-order) 3) รอ 5-10 วินาที 4) รีเฟรชเครื่องที่ 2 → ดูตะกร้า | ตะกร้าบนเครื่องที่ 2 = **ตรงชนิดทุกตัวเลขกับเครื่องแรก** (บรรทัด/จำนวนชิ้น/ราคา/addOns/line_mode) · ไม่มีของซ้ำ/หาย · ไม่มี toast error | LIVE_TEST_PENDING |
| **I-2** | Server-side cart sync — server cart persists after logout/login (R103) | 1) ทำ I-1 สำเร็จ → เครื่องที่ 2 มีตะกร้า 2) ล็อกเอาท์เครื่องที่ 2 → ล็อกอินใหม่บัญชีเดียวกัน | ตะกร้ายังคงของเดิมครบ (ไม่หาย/ไม่ว่าง) · ไม่มี toast "ตะกร้าว่าง" · ไม่ต้องกดคัดลอกลิงก์ | LIVE_TEST_PENDING |
| **I-3** | Server-side cart sync — guest NOT synced (R103) | 1) เปิดเบราว์เซอร์ incognito (ไม่ล็อกอิน) → เพิ่มเมนู ≥2 รายการ 2) เปิดเบราว์เซอร์ incognito ใบใหม่ / เครื่องอื่น → เปิด biteme-baby.com | ตะกร้าว่าง (guest ไม่มี server sync · รักษา R63 posture) · deep-link `?cart=` ยังใช้ได้ตามปกติ | LIVE_TEST_PENDING |
| **I-4** | IAB double-add guard — กดลิงก์ซ้ำไม่เพิ่มของ (R102) | 1) เข้าแชท FB → สั่งเมนู 1-2 รายการ → ตะกร้ามีของ 2) กดลิงก์ AI เดียวกัน 5 ครั้ง / navigate กลับ `/shop` 5 ครั้ง | ตะกร้า **ไม่เพิ่มของ** ทุกครั้ง · toast แสดงครั้งเดียวครั้งแรก ("เปิดรายการที่สรุปไว้ให้แล้ว 🛒 N รายการ") · ไม่มี toast วาร์นซ้ำ | LIVE_TEST_PENDING |
| **I-5** | External copy live cart — IAB → Chrome (R102) | 1) ใน FB WebView เปิดลิงก์ AI → ตะกร้ามี ≥4 บรรทัด 2) กด "📋 คัดลอกลิงก์" (กล่องลิงก์เต็มโผล่ = กด "เลือกทั้งหมด" แล้วกดค้าง/Ctrl+C) 3) วางใน Chrome/Safari | ตะกร้าใน Chrome = **ตรงทุกตัวเลขกับ WebView** (บรรทัด/จำนวน/ราคา/addOns/line_mode) · ไม่มีของหาย/เพิ่มเอง | LIVE_TEST_PENDING |
| **I-6** | External copy payload integrity — double-encoded guard (R102) | 1) ทำ I-5 สำเร็จ → ตะกร้าใน Chrome ถูกต้อง 2) ตรวจ console / network ว่า URL ที่คัดลอกมี `?cart=` payload v2 (มี mods/line_mode) ไม่มี `fbclid` | URL ไม่มี `fbclid` · payload ถอดได้ผ่าน `normalizeCartParam` (v2 mods/lm รอด) · ไม่มี double-encode residue | LIVE_TEST_PENDING |
| **I-7** | กดลิงก์ AI หลายลิงก์ → ตะกร้า "ตั้งตามลิงก์" ไม่กอง (R104) | 1) ทัก AI ให้สรุปรายการ 2 รอบแตกต่างกัน (reply A = เมนู X, reply B = เมนู Y) 2) เปิดลิงก์ reply A → ตรวจตะกร้า 3) เปิดลิงก์ reply B → ตรวจตะกร้า 4) กดลิงก์ reply A ซ้ำ | ตะกร้าหลังเปิดลิงก์ A = **รายการของ A พอดี** (ไม่รวมของเดิม) · เปิดลิงก์ B = **รายการของ B พอดี** (ไม่กองกับ A) · **กดลิงก์ A ซ้ำ = ตะกร้าคงเดิม** (guard — ของที่เพิ่มเองหลังจาก A ไม่หาย) · toast "เปิดรายการที่สรุปไว้ให้แล้ว 🛒" | LIVE_TEST_PENDING |
| **I-8** | 1 reply = 1 ลิงก์ของระบบ (R104 — แก้ลิงก์เปล่า) | 1) ทัก AI ให้สรุปออเดอร์ → ดู reply (คอมเมนต์/ข้อความ) 2) ทักคุยทั่วไป (ไม่สั่งอะไร) → ดู reply | reply ออเดอร์ = **ลิงก์เดียว = ลิงก์ตะกร้าจริง (`?cart=`)** — ไม่มี `biteme-baby.com/shop` เปล่าปนมา · ไม่มีลิงก์ `?cart=<encoded>` template · reply คุยทั่วไป = มี CTA ร้าน "🛍️ เมนูทั้งหมดและสั่งซื้อ" ลิงก์เดียว · **กดลิงก์ที่ reply มี = ได้ของจริงทุกครั้ง** | LIVE_TEST_PENDING |

---

## 🆕 กลุ่ม H — R63 (FB Cart Bridge Live — สะพานตะกร้าสดข้ามช่องทาง) — ⏸️ PARTIAL

**เงื่อนไขก่อนเริ่ม:** push `9b913c9` รอ Cloudflare deploy 2-3 นาที · hard reload (Ctrl+Shift+R) 1 ครั้ง · ล็อกอินลูกค้า · เข้าแชท FB/Messenger ของเพจ Bite Me Baby
**Gates โค้ด:** lint ✅ · vitest 226 ไฟล์ / 2446 tests PASS (+1) · build ✅ (PWA v1.3.0)
**ผลทดสอบ (2026-11-25): H-3, H-4, H-5, H-6 ผ่าน · H-1, H-2 รอทดสอบ**

| Task ID | Test Case | Description | Pass Criteria | Status |
|---------|-----------|-------------|---------------|--------|
| **H-1** | ปุ่มคัดลอกพาตะกร้าสด (แก้ 17↔1 · R63b hotfix) | 1) เข้าแชท FB → สั่งเมนูหลายรายการจนตะกร้ามี ≥4 บรรทัด / ≥17 ชิ้น 2) ใน FB WebView เปิดลิงก์ AI ใหม่ → ตะกร้าเพิ่มขึ้น 3) กด "📋 คัดลอกลิงก์" (ถ้ากล่องลิงก์เต็มโผล่ = กด "เลือกทั้งหมด" แล้วกดค้าง/Ctrl+C) 4) วางใน Chrome/Safari เครื่องเดียวกัน | ตะกร้าใน Chrome = **ตรงชนิดทุกตัวเลขกับ WebView** (บรรทัด/จำนวนชิ้น/ราคา/addOns/line_mode) · toast "เปิดรายการที่สรุปไว้ให้แล้ว 🛒 N รายการ" | ⏸️ LIVE_TEST_PENDING |
| **H-2** | Snapshot หมดอายุ 30 นาที | ทำ H-1 สำเร็จ → ทิ้งแชทค้าง >30 นาที → เปิดเว็บเครื่องเดียวกัน (ไม่มี `?cart=`) | ไม่เติมตะกร้าเองจากของเก่า (one-shot + อายุ) | ⏸️ LIVE_TEST_PENDING |
| **H-3** | Cart page UX — ลบคูปอง/สรุปราคา เหลือปุ่มเดียว | เปิด /cart (มีของ ≥1 รายการ) → hard reload | **ไม่มี** card "🎟️ คูปอง/โปรโมชั่น" · **ไม่มี** card "💰 สรุปราคา" · **มี** ปุ่ม "ยืนยันสั่งซื้อ →" เดียวไป /checkout (gated stale pre-order) | ✅ LIVE_VERIFIED |
| **H-4** | Checkout PRE_ORDER — รอบปิด status=closed โชว์เทา/กดไม่ได้ | 1) แอดมินปิด 1 รอบ (เช่น "เย็น" status='closed') 2) เข้า checkout PRE_ORDER (มีเมนูปฏิทิน) | รายการรอบโชว์ **ทุกรอบ** · รอบปิด = radio disabled + opacity-60 + badge "ปิดรับ (แอดมิน)" · รอบเปิด = เลือกได้ปกติ · SAME_DAY auto-select คงเดิม | ✅ LIVE_VERIFIED |
| **H-5** | Sticker consolidation — 1 sticker/order (R63d) | 1) สั่งออเดอร์: เมนู A x2 + เมนู B x1 (รวม 3 กล่อง) 2) แอดมินกด "รับออเดอร์" → auto-print sticker | **พิมพ์ 1 ดวงเดียว** · ORDER LIST โชว์ "เมนู A x2 · เมนู B x1" (1-4 บรรทัดต่อเนื่อง) · QR/ราคา/ชื่อลูกค้าถูกต้อง · toast "สติกเกอร์ 1 ใบ — เครื่องยืนยันครบแล้ว" | ✅ LIVE_VERIFIED |
| **H-6** | Sticker — single item order | 1) สั่ง 1 เมนู qty 1 2) แอดมินรับออเดอร์ | พิมพ์ 1 ดวง · ORDER LIST โชว์ item เดียว · toast "สติกเกอร์ 1 ใบ — เครื่องยืนยันครบแล้ว" | ✅ LIVE_VERIFIED |

---

## 🆕 กลุ่ม G — R78/R79/R80 (Marketing Posts 5 Images + Studio Picker Tabs + Floating Ad Exact Clone) — ⏸️ PARTIAL

**เงื่อนไขก่อนเริ่ม:** m209 APPLIED PROD ✓ · push `4fc13a2` รอ Cloudflare deploy 2-3 นาที · hard reload (Ctrl+Shift+R) 1 ครั้ง · ล็อกอินแอดมิน
**Gates โค้ด:** lint ✅ · vitest 226 ไฟล์ / 2431 tests PASS (+9 จาก R78-R80) · build ✅ · CI 2/2 success (commit `71667e8`, `9d43386`, `4fc13a2`)
**ผลทดสอบ (2026-11-25): G-1..G-5 ผ่าน · G-6, G-7 รอทดสอบ**

| Task ID | Test Case | Description | Pass Criteria | Status |
|---------|-----------|-------------|---------------|--------|
| **G-1** | โพสต์การตลาดแนบได้ 5 รูป (R78) | /admin/marketing → แท็บสร้างโพสต์ → เลือกรูปจากอัลบั้ม AI 5 รูป (ปุ่ม "ใช้") → กดรูปที่ 6 | ตัวนับ "แนบรูปแล้ว 5/5 รูป" · กดรูปที่ 6 = toast "เลือกได้สูงสุด 5 รูป" + ปุ่ม disable · กด "เลิก" รูปที่เลือกแล้ว = หลุดจากชุด (toggle) · อัลบั้มไฮไลต์รูปที่เลือก (ขอบสี + ✓) | ✅ LIVE_VERIFIED |
| **G-2** | อัปโหลดหลายไฟล์จากเครื่อง ≤500KB (R78) | แท็บสร้างโพสต์ → "เลือกไฟล์สูงสุดจากเครื่อง" → เลือก 3-5 ไฟล์รูปใหญ่พร้อมกัน | อัปโหลดสำเร็จ + toast "ย่ออัตโนมัติ (ยาวสุด 1080px / ≤500KB)" · รูปเข้าชุด (ตัวนับเพิ่ม) · ไฟล์เกิน 5 = toast แจ้งข้าม · เช็ค Supabase → bucket `bmb-images` → `uploads/mk-<timestamp>-...` (ไฟล์ webp ≤500KB) | ✅ LIVE_VERIFIED |
| **G-3** | Studio picker แท็บตามหัวข้อครบทุกเมนู (R79) | แท็บสร้างโพสต์ → การ์ด "🍽️ เลือกจากเมนูทั้งหมด (แท็บตามหัวข้อ)" → กดสลับทุกแท็บ | แท็บ = หัวข้อเมนูจริง (ชื่อ + icon + จำนวน) **ตรงกับหน้า /shop** · แต่ละแท็บโชว์ **ครบทุกเมนูในหัวข้อ (ไม่มี "แสดง 20 รายการแรก")** · 🚫 = เมนูไม่มีรูป (กดไม่ได้) · ✓ = อยู่ในชุดแล้ว (disabled) · เมนูใหม่ที่เพิ่มในอนาคตเข้าแท็บเอง | ✅ LIVE_VERIFIED |
| **G-4** | Planner จิ้มเมนู = append รูป (R78) | แท็บวางแผน → จิ้มเมนู 2-3 ตัวติดกัน → กลับมาแท็บสร้างโพสต์ | หัวข้อ/เนื้อหาเติมตามเมนูสุดท้าย · รูปเมนู **เพิ่มเข้าชุดทีละรูป (ไม่ทับของเดิม)** จนครบ 5 · ลบเตือน "มีภาพเจน = ใช้ภาพเจนรูปเดียว" (R44 ยกเลิก — ภาพเจน+เมนู+อัปโหลดผสมกันได้) | ✅ LIVE_VERIFIED |
| **G-5** | Floating Ad ตั้งจากแอดมิน = โคลนข้อมูลตรง (R80 — เมนู) | /admin/products → แก้เมนู 1 ตัว → เปิด toggle "📌 Floating Ad" → บันทึก → hard reload /shop | การ์ดโฆษณาลอยโชว์ **เมนูที่เลือกพอดี** (badge "🍽️ เมนูแนะนำ") · title = ชื่อเมนู **ตรงๆ ไม่มี 🔥 นำหน้า** · description = คำอธิบายเมนู **เต็ม ไม่ตัด** · รูป = รูปเมนูจริง · ปุ่มบัตรในการ์ดมี badge "📌 Floating Ad" | ✅ LIVE_VERIFIED |
| **G-6** | Floating Ad ตั้งจากโพสต์ (R80 — โพสต์) | โพสต์การตลาดที่ published แล้ว 1 ใบ → /admin/marketing คิวอนุมัติ (แถว linked) → เปิด toggle "📌 Floating Ad" → hard reload /shop | การ์ดโฆษณาลอยโชว์ **โพสต์นั้นพอดี** (badge "📝 โพสต์") · title = หัวข้อโพสต์ **ตรงๆ ไม่มี 📣 นำหน้า ไม่มี "ประกาศจากร้าน"** · description = เนื้อหาโพสต์ **เต็ม** · รูป = รูปแรกของโพสต์ · ปิด toggle = การ์ดหาย | ⏸️ LIVE_TEST_PENDING |
| **G-7** | Floating Ad โปรโมชั่น (เดิม) ไม่พัง + สลับ 3 แหล่ง (R80) | ตั้ง is_banner=true ให้โปร 1 ตัว (มีรูป+มาสคอต) + เมนู 1 ตัว + โพสต์ 1 ใบ → ดู /shop | โชว์สูงสุด 3 การ์ด สลับชนิด โปร→เมนู→โพสต์ (R64) · การ์ดโปร = badge "🎁 โปรโมชั่น" + รูป banner + มาสคอต banner_mascot (R61 คงเดิม) · โค้ดคูปองแสดง + ปุ่ม "ดูดีลเลย" ไป /menu?coupon= · /admin/marketing → Floating Ad tab toggle "เปิด/ปิด โฆษณาลอยทั้งหมด" (R123i: single source `floating_ad_config.enabled` — ตัด kill switch `floating_ad_enabled` ซ้ำซ้อนออกแล้ว) ปิด = ทุกการ์ดหาย · checkbox sources (3 แบบใหม่) บันทึกได้ | ⏸️ LIVE_TEST_PENDING |

---

## 🔄 กลุ่ม F — R55 (Background Music + Mascot Badge Fix + OAuth/Passkey ALL READY) — ✅ LIVE_VERIFIED

**เงื่อนไขก่อนเริ่ม:** push R55 รอ Cloudflare deploy 2-3 นาที · hard reload (Ctrl+Shift+R) 1 ครั้ง · ทำบน https://biteme-baby.com
**Gates โค้ด:** lint ✅ 591 ไฟล์ · vitest 226 ไฟล์ / 2422 tests PASS (+42) · build ✅
**ผลทดสอบ (2026-11-25): F-1, F-2, F-3, F-4, F-7 ผ่านหมด · F-5, F-6 legacy verified (not re-tested)**

| Task ID | Test Case | Description | Pass Criteria | Status |
|---------|-----------|-------------|---------------|--------|
| **F-1** | มาสคอตลอยจริง + hover ไม่หลุดเฟรม (R55) | เปิดหน้าไหนก็ได้ → ดูน้อง Bite มุมขวาล่าง (light แล้ว dark) → เอาเมาส์ชี้/ชี้ค้างบนตัวมาสคอต → ลากไปวางที่อื่น → รีเฟรช | มาสคอตลอยขึ้นลงนุ่ม ๆ ตลอดเวลา · hover ขยาย 5% นุ่มไม่กระตุก ไม่หลุดกรอบ · ลากวางแล้วค้างตำแหน่งใหม่หลังรีเฟรช (ไม่สะดุ้งกลับที่เดิม) | ✅ LIVE_VERIFIED |
| **F-2** | ออกจากระบบจริง (R55) | ล็อกอิน → กด "ออก" มุมขวาบน (เดสก์ท็อป) → ทำซ้ำกับเมนูมือถือ "🚪 ออกจากระบบ" | ไปที่ /login ทันที · กดเข้าสู่ระบบใหม่ = เปิดฟอร์มให้กรอก (ไม่ดีดไป /shop เอง) · ล็อกอินด้วยบัญชีเดิมได้ | ✅ LIVE_VERIFIED |
| **F-3** | anon กดโหวต = UX ตรงสาเหตุ (R55) | **ไม่ล็อกอิน** → เปิด /vote → กดเลือกเมนูโหวต | toast "กรุณาเข้าสู่ระบบก่อนโหวตเมนูค่ะ" — **ห้ามขึ้น "ระบบโหวตขัดข้องชั่วคราว"** | ✅ LIVE_VERIFIED |
| **F-4** | โหวตจริงหลังล็อกอิน (ยืนยันคงเดิม) | ล็อกอิน → /vote → โหวตเมนูที่ยังไม่เคยโหวต | โหวตสำเร็จ · ตัวเลข/เปอร์เซ็นต์เปลี่ยนจริง · ป้าย "โหวตแล้ว ✓" ขึ้น · โหวตเมนูเดิมซ้ำ = "คุณโหวตเมนูนี้ไว้แล้วค่ะ" | ✅ LIVE_VERIFIED |
| **F-5** | ล็อกอินด้วยเบอร์โทร (R55 — ของเก่าเปิดใช้จริง) | /login → แท็บ "📱 เบอร์โทร" → กรอกเบอร์+รหัสผ่าน (บัญชีที่เคยตั้งรหัสผ่าน) | เข้าสู่ระบบได้ ไป /shop · เบอร์/รหัสผิด = "เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง…" | ✅ LEGACY VERIFIED (not re-tested) |
| **F-6** | OAuth ทั้ง 4 + Passkey (Owner ตั้งค่า Dashboard เสร็จแล้ว) | /login → hard reload → กดทีละปุ่ม: Google / Facebook / LINE / Passkey | เด้งไปหน้า provider → กลับมาล็อกอินสำเร็จ · LINE = Custom OIDC (Channel ID/Secret + Attribute Mapping sub/email/name/picture) · Passkey = RP ID + Origin | ✅ LEGACY VERIFIED (not re-tested) |
| **F-7** | เล่นเพลงพื้นหลัง (Background Music R55 + R105) | /admin/settings?tab=music → อัปโหลด 2-3 เพลง (MP3/WAV/OGG/WebM/AAC ≤20MB) → Enable toggle ON → กลับหน้าร้าน → กดปุ่ม ♪ (AmbientMusicToggle) | เพลงเล่นสุ่ม (shuffle queue) · กด ♪ อีกครั้ง = หยุด · Bite พูด (VoiceInterface) → เสียงลด 25% (ducking) → Bite จบพูด → คืนเสียง 0.6s · volume slider ปรับได้ · **bucket ว่าง/ปิด = UI แสดง "ไม่มีเพลงใน bucket" ไม่เล่น ไม่มี fallback synthetic** · Migration 196 APPLIED PROD ✓ · Master flag enabled ✓ · CORS OK ✓ | ✅ LIVE_VERIFIED |

---

## 🔄 กลุ่ม E — R44–R48b (Rider History Tabs + Maps 3 Sides) — ✅ LIVE_VERIFIED

**เงื่อนไขก่อนเริ่ม:** m180 + m207 APPLIED PROD แล้ว (Owner ยืนยัน) · push `15b5fc0` รอ Cloudflare deploy 2-3 นาที · hard reload (Ctrl+Shift+R) หรือล้าง storage PWA 1 ครั้ง
**หมายเหตุ:** Google Maps key ยังถูกปฏิเสธในเบราว์เซอร์ (รอเช็ค Google Cloud Console) — แผนที่ควรโชว์ผ่าน **OpenStreetMap (Leaflet)** ซึ่งถือว่า PASS ตามดีไซน์ · เมื่อแก้ key ผ่านแผนที่จะกลับเป็น Google เอง ไม่ต้อง retest
**ผลทดสอบ (2026-11-25): E-1..E-6 ผ่านหมด · E-7 diagnostic only**

| Task ID | Test Case | Description | Pass Criteria | Status |
|---------|-----------|-------------|---------------|--------|
| **E-1** | แท็บวันนี้/ย้อนหลัง (ไรเดอร์) | เปิด `/rider` (ล็อกอินไรเดอร์ พอล ไมท์ไดร์) → ดูแถบแท็บเหนือรายการงาน | แท็บ "📅 วันนี้" โชว์งานวันนี้เท่านั้น · กดแท็บเดือน (เช่น พฤศจิกายน 2569) = งานเดือนนั้นโผล่ · สลับ "วันส่ง/วันมอบหมาย" ผลเปลี่ยนตาม | ✅ LIVE_VERIFIED |
| **E-2** | งานมอบหมายล่วงหน้าไม่ปนวันนี้ | มีงาน scheduled วันพรุ่งนี้ (แอดมินมอบหมายล่วงหน้า) → เปิด /rider แท็บวันนี้ | งานพรุ่งนี้ไม่โชว์ในแท็บ "วันนี้" · โผล่เมื่อสลับ anchor เป็น "วันมอบหมาย" (ถ้า assigned วันนี้) หรือในแท็บเดือนของวันส่ง | ✅ LIVE_VERIFIED |
| **E-3** | แผนที่หน้าไรเดอร์ (งาน active) | เปิดงาน → ยืนยันส่ง (geo+POD) → ดูแผนที่จุดปัก | แผนที่โชว์ (OSM = มี © OpenStreetMap มุมล่าง) · จุดปลายทาง/GPS คุณ/ครัวครบ · ห้ามจอขาว + ข้อความเตือนค้าง | ✅ LIVE_VERIFIED |
| **E-4** | แผนที่หน้าลูกค้า /track | เปิด `/track/BMB-...` ที่มีไรเดอร์กำลังส่ง | แผนที่โชว์ · จุดไรเดอร์ + ป้าย "ล่าสุด HH:MM" · ถ้าไรเดอร์ปิดหน้า >10 นาที = จุดจาง + ป้าย "ตำแหน่งเก่า — รอไรเดอร์เปิดหน้าส่งพิกัดใหม่" | ✅ LIVE_VERIFIED |
| **E-5** | แผนที่ Dispatch หน้าแอดมิน | เปิด `/admin/delivery` | แผนที่โชว์ (OSM) · จุดไรเดอร์จริงเท่านั้น (ไม่มีจุด กทม. ปลอม) · จุดเก่าเทา/จาง + tooltip "ตำแหน่งเก่า" · polyline งานที่เลือกดูโชว์ | ✅ LIVE_VERIFIED |
| **E-6** | ปุ่มนำทาง + เว็บแผนที่ (PWA) | ใน /rider กด "🧭 เปิดนำทาง" และ "🌐 เปิดเว็บแผนที่" | นำทางเปิด Google Maps app ตรง (มี app) · เว็บแผนที่เปิดแผนที่จริงในแท็บเดียว — **ไม่โดนหน้า "ติดตั้งแอป"** | ✅ LIVE_VERIFIED |
| **E-7** | (diagnostic — ทำเฉพาะเมื่อแผนที่ไม่โชว์) | F12 → Console → คัดลอกบรรทัด `[GoogleMaps] loadGoogleMapsJS called, MAPS_KEY: …` + error แดงของ Google (ถ้ามี) | ส่งภาพ console กลับมา = ใช้ตัดสินว่าต้องแก้ที่ Google Cloud (Referer/Billing/Activated) จุดไหน — ไม่ใช่ FAIL ของระบบ | ✅ DIAGNOSTIC ONLY |

---

## ⚠️ RESOLVED: Requirement Conflicts (C-1..C-6) — Owner Decisions 2026-11-25

**Source:** `docs/BMB_REQUIREMENT_RECONCILIATION.md` §3

| Task ID | Conflict | Description | Decision | Implementation Note |
|---------|----------|-------------|----------|---------------------|
| **C-1** | Pre-order cutoff vs Same-day overlap | กติกา cutoff pre-order ชน same-day window | **ร้านเปิดรับออเดอร์ได้ 24 ชม** ใช้ร่วมได้ ร้านปิดรับออเดอร์ได้แค่ส่งไม่ได้ | Same-day = 24h ordering window; Pre-order cutoff applies only to delivery scheduling |
| **C-2** | Multi-branch delivery zone overlap | โซนจัดส่งสาขาต่างกันทับกัน | **สาขาที่ลงทะเบียนก่อนรับ** (first-registered wins) | Deterministic assignment via branch registration timestamp |
| **C-3** | Coupon stacking rules | `stackable` flag มีแต่ business rule ไม่ชัด | **อนุมัติ** — แนะนำ implement stacking policy | min-order / max-discount / per-user limit เพิ่มใน promotion schema |
| **C-4** | Points ledger vs Vote rewards | m208 `preorder_vote_cast` ไม่แตะ points_ledger | **Vote ให้แต้ม** — update m208 to write points_ledger | Points awarded per vote event |
| **C-5** | CRM consent granularity | `customers.crm_consent` boolean เดียว | **เพิ่ม granularity** — แยก winback/birthday/ช่องทาง | Schema migration needed for consent sub-fields |
| **C-6** | Floating ad priority vs Mascot | Floating ad (R80) + Mascot badge (R52) z-index conflict | **แก้ไปแล้ว** — layout adjusted | Mascot repositioned; Floating ad z-index managed |

---

## ⚠️ BLOCKED: Production Runtime Tests (§T)

**Source:** `docs/BMB_PRODUCTION_TEST_PACK.md` §RG/§16/§R67–R74-OMNI

| Task ID | Test Area | Description | Status | Blocker |
|---------|-----------|-------------|--------|---------|
| **T-A1..A6** | Order Journey (12/12 done, 6 remain) | Full order flow with real devices/accounts | BLOCKED | ต้องการอุปกรณ์/บัญชีจริง + production data |
| **T-D** | Rider POD + Delivery Sync | Real GPS + rider device + customer tracking | BLOCKED | ต้องการไรเดอร์จริง + GPS matrix |
| **T-E** | Admin Close Cycle | Full admin dispatch → rider → customer → admin close | BLOCKED | ต้องการข้อมูล production ครบวงจร |
| **CAP-10/11/13/14/18** | Capacity/Concurrency | Load/stress tests on production | BLOCKED | ต้องการ staging/production environment |

---

## ✅ RESOLVED: Omise TEST Card — Role Changed

| Task ID | Description | Status | Resolution |
|---------|-------------|--------|------------|
| **OMISE-TEST** | บัตร Omise TEST card บนเบราว์เซอร์จริง | **RESOLVED** | ไม่ถือเป็นบล็อกอีกต่อไป — QR code (Stripe) ใช้ได้เป็น primary, Omise เปลี่ยนเป็น fallback |

---

## 📋 บันทึกการทดสอบ Live (Test Execution Log)

> กรอกเมื่อทดสอบจริง — ใช้ร่วมกับ `docs/BMB_REMAIN_TESTS_LIVE_2026-11-23.md` ตารางบันทึกผล

| Task ID | Date | Device | Tester | PASS/FAIL | Evidence | Notes |
|---------|------|--------|--------|-----------|----------|-------|
| E-1..E-6 | 2026-11-25 | Desktop/Mobile | Owner | PASS | OSM maps verified, tabs working | E-7 diagnostic only |
| F-1..F-4, F-7 | 2026-11-25 | Desktop/Mobile | Owner | PASS | Mascot, logout, vote, music all working | F-5, F-6 legacy verified |
| G-1..G-5 | 2026-11-25 | Desktop | Owner | PASS | Marketing posts, studio, floating ad menu | G-6, G-7 pending |
| H-3..H-6 | 2026-11-25 | Desktop | Owner | PASS | Cart UX, checkout, stickers | H-1, H-2 pending |
| C-1..C-6 | 2026-11-25 | — | Owner | DECIDED | Decisions recorded in Work Queue | All resolved |
| OMISE-TEST | 2026-11-25 | — | Owner | RESOLVED | Stripe QR primary, Omise fallback | Not a blocker |

---

## 🔄 กติกา Work Queue (Enforced by Protocol)

1. **ไม่มีงาน CODE_CLOSED อยู่ใน Work Queue** — งานที่ปิดแล้วไป CHANGELOG
2. **LIVE_TEST_PENDING ≠ CODE_CLOSED** — ต้องมี Owner live test ผ่านจริง (evidence: ภาพ/copy verbatim) ถึงจะเป็น LIVE_VERIFIED
3. **BLOCKED tasks** ต้องระบุ blocker ชัดเจน + Owner decision ที่ต้องการ
4. **SKIPPED ≠ PASS** — ห้ามตัดข้อทิ้ง ห้ามเปลี่ยนสถานะโดยไม่มีหลักฐาน
5. **FAIL = จด defect ใหม่ลง AI_WORK_STATE + two-try rule** (UNIVERSAL_MASTER_AI_RULES §1.1)
6. **Work Queue อัปเดตทุก session** — ตาม protocol §3.5: "Update WORK_QUEUE: Remove completed tasks. Retain unfinished tasks. Record remaining Live Tests."

---

## 📌 Related Documents

- `docs/BMB_MASTER_STATUS.md` — Current verified state (Source of Truth)
- `docs/BMB_CHANGELOG.md` — Historical development records
- `docs/BMB_REMAIN_TESTS_LIVE_2026-11-23.md` — Detailed test procedures (point-in-time reference)
- `docs/BMB_REQUIREMENT_RECONCILIATION.md` — C-1..C-6 conflicts detail
- `docs/BMB_PRODUCTION_TEST_PACK.md` — Production test pack §T detail
- `AI_WORK_STATE.md` — Operational ledger (current session state)
