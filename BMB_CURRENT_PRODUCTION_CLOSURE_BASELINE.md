# BMB — CURRENT PRODUCTION CLOSURE BASELINE (WHOLE-PROJECT REBASELINE)

> **สร้างเมื่อ:** 2026-10-07 · **ประเภทงาน:** PHASE 0 — AUDIT + REBASELINE ONLY (ไม่มีการแก้ logic/migration/deploy/data ในรอบนี้)
> **หลักฐานเรียงลำดับ:** Production DB → Current Code → Migration/Contract → Verified Report → Docs → Assumptions
> **เอกสารนี้แทนที่เอกสารสถานะเก่า** เป็น current source of truth ชั่วคราวจนกว่า Owner จะ review และสั่ง phase ถัดไป — **ยังไม่ overwrite `BMB_PRODUCTION_MASTER_STATUS.md`**
> คำสถานะที่ใช้: IMPLEMENTED · CONNECTED · DEPLOYED · RUNTIME VERIFIED · DOCUMENTED · MISSING · BLOCKED · DEFERRED (ไม่ใช้ COMPLETE/READY/OPEN SHOP โดยไม่มี evidence)

---

## A. REAL GIT STATE (ตรวจจาก Git จริง ไม่เชื่อเอกสาร)

```
CURRENT HEAD    = db5c32a0301a021f7b300bdd4a1e78ddb717610d
ORIGIN/MAIN     = db5c32a0301a021f7b300bdd4a1e78ddb717610d
HEAD == origin  = TRUE (sha ตรงกันเป๊ะ)
WORKTREE        = CLEAN (0 changes)
LATEST COMMIT   = db5c32a docs(handoff): add layer-B automation status table (2.1)
```

`git log --oneline -20` (เรียงใหม่ → เก่า): db5c32a → 32335af → 465306a → d38ece3 → cd382c2 → 3ab9403 → df4a621 → 43b2092 → 89d2051 → d66d176 → 162d319 → 6be437b → 4b3cc7b → eb9b2b8 → 6c7af5f → bb7d523 → c2aaa3d → ffdef88 → 56a43dc (รอบ 8k) → c23f91c (รอบ 8j · M119)

**Production deploy จริง (Cloudflare Pages API, github integration, อ่าน read-only):**
- project `bitemebaby` · deployment ล่าสุด `093bd901` = **commit `db5c32a` (= HEAD) env=production สร้าง 2026-10-07T14:00:52Z**
- ก่อนหน้า: 32335af (13:53Z), d38ece3 (12:49Z) — auto-build ทุก push ทำงาน
- **สรุป: frontend production == HEAD == origin/main ทุกชั้น**

---

## B. REAL PRODUCTION DB STATE (`ivkdfognyiwjcmrhcnwz` — query จริง 2026-10-07)

### B.1 Migration history
- `supabase_migrations.schema_migrations` = **001 … 119 ครบ ไม่มีช่องว่าง** (count=119, max=119) — **ตรงกับ repo** (repo มีไฟล์ 001–119 + 2 ไฟล์ `PROPOSED_*` ที่ยังไม่ apply — ถูกต้อง)
- ไฟล์ `PROPOSED_wave1_profiles_grant.sql` / `PROPOSED_wave2_history_backfill.sql` = **DEFERRED** (ยังไม่ apply)

### B.2 Schema / RLS / authority
| รายการ | ค่าจริง |
|---|---|
| tables (public) | 50 |
| tables เปิด RLS | **50/50 (100%)** |
| policies (public) | 134 |
| functions (public) | 145 |
| triggers บน `orders` | **11 ตัว** (ดู B.3) |

### B.3 Authority functions/triggers ที่ verify จริง (SECURITY DEFINER ทุกตัว)
- `create_order_with_items` — **18-param signature** (089's 15 + `p_source_channel`/`p_external_ref_id`/`p_customer_ref`) = **M117 live** ✓
- `record_payment_result(p_order_number, p_payment_intent_id, p_amount, p_currency, p_status, p_failure_reason)` — **GRANT EXECUTE = service_role + postgres เท่านั้น** (ไม่มี anon/authenticated) ✓
- `confirm_offline_payment` · `submit_offline_payment_reference` · `create_payment_intent_record` · `mark_payment_failed` · `transition_order_status` · `order_transition_allowed` · `cancel_order` · `is_admin` · `is_branch_admin` · `claim_automation_jobs` — **ทั้งหมดมีอยู่จริง** ✓
- `compute_delivery_fee` / `compute_delivery_fee_rpc` — มี **`p_branch_id` arg** (FC ของ 112/114) ✓
-  triggers บน orders (11): `orders_guard_status_transition`(guard_order_status_transition) · `trg_orders_stamp_source_channel` · `orders_ensure_deduct_on_confirm`(inventory) · `orders_increment_round` / `orders_release_round_capacity` · `trg_orders_status_history` · `trg_pre_order_window` / `trg_pre_order_cancel_window` / `trg_pre_order_address_check` · `trg_operating_hours` · `orders_updated_at` — **status/inventory/capacity/history authority ยังอยู่ครบ ไม่มี regression** ✓
- Storage `bmb-images` policies (M119): `bmb_images_public_read` · `bmb_images_authenticated_upload` · `bmb_images_admin_update` · `bmb_images_admin_delete` — **4 ตัว live, อ้าง `bucket_id='bmb-images'` literal** ✓

### B.4 FC markers ในตัว `create_order_with_items` ปัจจุบัน (prosrc จริง)
- `ERR_BITE_DRIVE_DISABLED` (FC-5) ✓ · `service_radius_km` (FC-3) ✓ · `external_methods_enabled` ✓ · `p_source_channel` (18-param) ✓ · **ไม่มี literal `5.00`** (hardcoded zone ถูกแทนด้วย settings แล้ว) ✓

### B.5 Business data snapshot (2026-10-07)
| ข้อมูล | ค่าจริง |
|---|---|
| orders: payment_status | paid **30** · pending 167 · refund 8 · partially_refunded 1 |
| orders: status | delivered **1** · cancelled 205 · (active/confirmed = 0) |
| payment_intents | stripe: completed 28 / refunded 8 / partial 1 / pending 10 · promptpay: completed 2 / pending 4 / processing 3 · **omise: 0 แถว** · cod: 0 แถว |
| automation_queue | succeeded **407** · dead 13 · สร้างใน 48 ชม. = **310** (runtimes จริงต่อเนื่อง) |
| audit_logs | 2,896 แถว |
| branches / tenants | 1 / 1 (ร้านเดียว) |
| delivery_zones | 6 · delivery_rounds 33 · products 11 · media_assets 10 |
| business_settings | 6 แถว |
| push_subscriptions | **0** (ยังไม่มี device ลงทะเบียน) |
| orders policies / payment_intents policies | 4 / 5 |
---

## C. CURRENT ARCHITECTURE (อ่าน implementation จริง ไม่ใช่ชื่อไฟล์)

| ชั้น | โครงสร้างจริง (หลักฐาน) |
|---|---|
| Frontend/PWA | React+Vite+PWA (workbox injectManifest `src/sw.ts`) · routes: `/` (Landing Talk-to-Bite), `/shop`, `/checkout`, `/payment/:orderNumber`, `/track/:orderNumber`, `/orders`, `/admin/*` 12 หน้า · deploy อัตโนมัติ Cloudflare Pages ทุก push (API ยืนยัน) |
| Auth | Supabase Auth (JWT session) — `authStore` P0-2: identity เป็นของ backend เท่านั้น · role จาก `profiles.role` (RLS) · quick-login ผ่าน EF `phone-auto-login` |
| Tenant/Brand | `brandResolver` (TEN-05) resolve tenant/brand จาก slug/subdomain · `is_branch_admin` RLS · production = 1 tenant/1 branch/1 brand |
| Catalog/Media | `products`(11)/`media_assets`(10)/menu_sections/categories · upload ผ่าน storage `bmb-images` (M119 policies) + `media_assets` RLS |
| Cart | `src/store/cartStore.ts` canonical — `addItem(product, qty, customizations)` เป็นทางเดียว (Talk-to-Bite ไม่มี write authority — header `talkToBite.ts` ยืนยัน) |
| Order creation | client ส่ง **เฉพาะ input** (ไม่มีราคา/ค่าส่ง — `OrderInput` ระบุ "intentionally NO price/…") → RPC `create_order_with_items` 18-param re-derive ทุกอย่างจาก DB |
| SAME_DAY / PRE_ORDER | `order_mode` + `scheduled_date` ใน RPC · triggers `trg_pre_order_window/cancel_window/address_check` กัน pre-order ผิดกฎ |
| MANUAL/Channel | `p_source_channel` regex + `p_external_ref_id` dedupe + `trg_orders_stamp_source_channel` (PWA/MANUAL) — M117 |
| Order lifecycle | allow-list `order_transition_allowed` + trigger `guard_order_status_transition` (UPDATE ตรงถูกบล็อก) + `transition_order_status` + `write_order_status_history` |
| Payment | 4 เส้น: **Omise** (TEST MODE — code+EF+probe แล้ว แต่ยังไม่มีแถวใน DB) · **Stripe** (fallback เดิม; LIVE keys อยู่ใน EF ตาม master status แต่บัญชีสถานะ review/paused) · **PromptPay** (TXN → admin confirm · completed=2) · **COD** · webhook idempotent = RPC `record_payment_result` (fix 010) |
| Refund | EF `stripe-refund` (refund จริง 172 THB test-verified 2026-09-19) + EF `omise-refund` (deployed, ledger guard) — client `refundPayment` ปฏิเสธเสมอ (SERVER_SIDE_ONLY) |
| Kitchen | `kitchenService` wrap RPC 019 · ready-to-make gate (054) · inventory deduct trigger `ensure_inventory_deducted_on_confirm` |
| Dispatch/Delivery | `deliveryRouter` 2-tier (Bite Drive ≤รัศมี vs 3rd party) pure functions · `delivery_assignments`/drivers (020) · **external provider = ไม่มี key (provider_orders 0)** |
| Zones/Fees | `delivery_zones` 6 · fee = `compute_delivery_fee(_rpc)` **settings + branch-driven (FC-1/3) — ไม่มี hardcoded 5.00** (prosrc ยืนยัน) |
| Delivery rounds | `delivery_rounds` 33 · `ensure_rounds_branch_id` (113) · `createDeliveryRound` ต้อง `branch_id` (RLS `is_branch_admin`) |
| Notifications | in-app + Web Push (m.115 + EF `push-send` ACTIVE, probe 17/17 แต่ **push_subs=0**) + **SMS จริง** (`sms-send` → thsms.org, probe 3/3, owner ยืนยันเครื่องจริง) |
| Meta/Channel intake | EF `channel-webhook` — GET verify + POST `X-Hub-Signature-256` + dedupe + RPC 18-param path (อ่านจริง) · **event จริงยังไม่มี (G4 HOLD)** |
| Talk-to-Bite | `TalkToBite.tsx` + `talkToBite.ts` pure (11 สถานะ, parse/modify/customize) + `useBiteAIStore` + `aiVoice` (STT/TTS) + `aiServerMemory` · rounds 9–13 |
| AI proxy/routing | EF `ai-proxy` (อ่านจริง): verify_jwt + server-side `aiPolicy` allowlist + rate limiter 20/60s + timeout + fallback 1 ครั้ง · `OPENROUTER_API_KEY` server-only |
| Automation | GHA `automation-scheduler.yml` (single-path enqueue→queue→dispatch→worker, legacy direct ลบแล้ว — อ่านจริง) + `ci.yml` · EF `queue-enqueue`/`queue-dispatcher`/`automation-worker` ACTIVE |
| External boundary | Meta (HMAC ✓, real event ✗) · Omise/Stripe (webhook sig ✓/✓) · thsms (X-API-Key ✓) · Google Maps/Routes · Grab/LINE MAN = **ไม่มี credential** |
| Failure/retry/idempotency | queue claim SKIP LOCKED + identity + ON CONFLICT (m.111) + dead-letter (13) · payment RPC 010 + unique index · channel dedupe · replay windows 300 วิ |
| Audit/replay | `audit_logs` 2,896 แถว · status history trigger · READ-ONLY probe scripts ครบทุกชุด |
---

## D. CURRENT FEATURE MATRIX (feature หลัง Closure เดิม)

| Feature | CURRENT CODE | PRODUCTION DEPLOYED | RUNTIME VERIFIED | OWNER VERIFIED | REMAINING GAP |
|---|---|---|---|---|---|
| Talk-to-Bite (Landing/Conversation/Floating) | ✅ rounds 9–13 (อ่านจริง) | ✅ CF = `db5c32a` | ⚠️ unit tests ผ่าน · ไม่มี E2E อัตโนมัติ | ⚠️ owner ใช้จริงระหว่าง rounds | E2E เต็มเส้น (P2) |
| Voice (STT/TTS/auto-TTS) | ✅ `aiVoice` + auto-speak round 13 | ✅ | ⚠️ `aiVoice` tests ผ่าน · device บางส่วน | ⚠️ บางส่วน | continuous-listen (P2) |
| Memory (7-day/returning) | ✅ `aiServerMemory` + `buildBiteGreeting` | ✅ | ✅ tests + RPC `get/save_ai_memory` | ⚠️ | — |
| Order-again + NL modify | ✅ `parseOrderIntent`/`applyOrderModify` r12 | ✅ | ✅ tests | ⚠️ | — |
| NL customize → real cart | ✅ `extractCustomizers` → `cartStore.addItem(customizations)` r13 | ✅ | ✅ tests 4 | ⚠️ | canonical key mapping (P1) |
| Canonical cart | ✅ `cartStore` (Talk-to-Bite ไม่มี write authority) | ✅ | ✅ tests | ✅ | migrate `useCartStore` shim 3 importer (P1) |
| **Omise payment** | ✅ code ครบ (EF 3 + client + 28 tests) | ✅ EF 3 ACTIVE + CF | ✅ probes 3/3 (sig→RPC, API 200) · **browser ยังไม่ทดสอบ · omise rows=0** | ❌ ยังไม่ได้จ่ายจริง | จ่ายบัตร test ใน browser (P0) |
| **SMS** | ✅ `smsTransport` + EF `sms-send` | ✅ ACTIVE | ✅ w23SmsProbe 3/3 + credits ลดจริง | ✅ **ยืนยันเครื่องจริง 3 หมายเลข (รอบ 8k)** | — |
| Meta/Channel intake | ✅ M117 18-param + EF channel-webhook | ✅ ACTIVE + M117 live | ⚠️ `intakeDriftProbe` OK (รอบ 8) · event จริงยังไม่มี | ❌ | Meta real event = external (P2) |
| Migration 118 (FC restore) | ✅ repo file | ✅ **APPLIED (history)** | ✅ prosrc markers ครบวันนี้ + fcProdVerify 9/9 · fcVerify114 25/25 (รอบ 8) | ✅ owner สั่ง apply | — |
| Migration 119 (storage) | ✅ | ✅ **APPLIED (history)** | ✅ 4 policies live + ADMIN_CRUD 20/20 | ✅ **ยืนยันอัปโหลดรูปผ่าน (รอบ 8k)** | — |
| Admin delivery round branch | ✅ `resolveAdminBranchId` + branch_id | ✅ | ✅ probe insert/update/delete | ✅ (รอบ 8j/8k) | — |
| Automation queue (G8) | ✅ scheduler + 3 EF | ✅ ACTIVE | ✅ G8-S5 + 407 succeeded / 310 ใน 48 ชม. | ✅ | เก็บ dead 13 แถว (P1) |
| Backup | ✅ `e2e/dbBackup.cjs` + Docker | n/a | ✅ dump 3 × 4.67 MB (รอบ 5) | ✅ | **สำรองอัตโนมัติตามเวลา = ยังไม่มี (P1)** |
---

## E. CURRENT GATE MATRIX (G1–G10 + W/A workstreams)

หลักการ: ห้ามเปลี่ยน PASS→FAIL เพราะไม่มีเอกสารใหม่ · ห้ามคง PASS ถ้า production ปัจจุบันพิสูจน์ regression — รอบนี้ตรวจซ้ำจาก DB/code จริง

| Gate | CODE STATUS | PRODUCTION STATUS | RUNTIME EVIDENCE | EXTERNAL | OWNER DECISION | สรุป |
|---|---|---|---|---|---|---|
| G1 (foundation era) | DOCUMENTED | DOCUMENTED | **MISSING** — ไม่พบรายงาน G1 เฉพาะในรอบตรวจ | — | ยืนยัน scope (P3) | **DEFERRED (evidence ไม่พบ)** |
| G2 (asset/brand control) | IMPLEMENTED | DEPLOYED | ✅ `BMB_GATE2_ASSET_BRAND_CONTROL_REPORT.md` + `BMB_POST_G2_SECURITY_REMEDIATION_REPORT.md` (historic) | — | — | **DOCUMENTED (historic, ไม่ rerun)** |
| G2-RV (review) | IMPLEMENTED | DOCUMENTED | ⚠️ `BMB_G2RV_PROPOSALS.md` = ข้อเสนอ — หลักฐานปิดไม่พบรอบนี้ | — | ยืนยัน (P3) | **DEFERRED** |
| G3 social events | ✅ | ✅ m109 + EF | ✅ prod probes (report) | — | — | **PASS (คงไว้ ไม่ rerun)** |
| G4 Meta receive | ✅ code + EF v11 | ✅ deployed | ⚠️ negative ✓ · **event จริง ✗** (simulated 9/9) | **BLOCKED BY EXTERNAL** (Meta roles/Test User) | เปิด Test User/roles ใหม่ | **HOLD — EXTERNAL** |
| G5 AI routing | ✅ | ✅ ai-proxy ACTIVE (อ่านจริง) | ✅ 6/6 (report) | — | — | **PASS (คงไว้)** |
| G6 auto-reply | ✅ | ✅ social-ai-worker v2 | ✅ classify/draft · real Meta E2E ขึ้น G4 | ขึ้น G4 | — | **PASS (capability)** |
| G7 auto-post | ✅ | ✅ social-post-worker v3 | ✅ | — | — | **PASS (report)** |
| G8 retry/failure queue | ✅ | ✅ 3 EF ACTIVE | ✅ G8-S5 + **DB วันนี้ 407 succeeded / 310 รอบ 48 ชม.** | — | — | **PASS (มีหลักฐานใหม่ยืนยัน)** |
| G9 social AI E2E | ✅ | ✅ social-publish-worker | ✅ journey 11 stages · publish 6/6 | — | ✅ CLOSED (Owner 2026-10-06) | **CLOSED — PASS** |
| **G10 True Production Closure** | ⚠️ evidence pack + FC fix (118) | ⚠️ 117/118/119 applied + DB verified วันนี้ | ⚠️ fcProdVerify 9/9 · fcVerify114 25/25 (รอบ 8) · **checklist 6 ข้อ = ข้อ 1–4 ยังไม่ผ่าน** (`BMB_G10_FINAL_REPORT.md`) | Stripe review + Meta | sign-off หลัง P0 | **IN PROGRESS — NOT CLOSED** |

**Workstreams (W/A):**
| WS | สถานะ |
|---|---|
| W-1.1 deploy pipeline / W-1.3 domain / W-1.6 token (`bmb-dev-2026-10` exp 05 Nov 2026) | ✅ DONE (มีผลวันนี้: CF auto-deploy + Management API ใช้ได้) |
| W-2.1/W-2.2 Stripe LIVE webhook + acceptance | **BLOCKED BY OWNER/EXTERNAL** (บัญชี review/paused) |
| W-2.3 SMS | ✅ **DONE + OWNER VERIFIED** (round 8h/8k) |
| W-3.x external rider (Grab/LINE MAN) | **BLOCKED BY EXTERNAL PROVIDER** — ไม่บล็อก first shop (≤5 กม. Bite Drive) |
| W-4.1 G9 | ✅ DONE |
| W-4.4 G10 closure | ⏳ IN PROGRESS → ขึ้นกับ P0/P1 + Owner sign-off |
| Backup (เดิม BLOCKED) | ✅ manual dump ทำงานแล้ว (รอบ 5) · auto-schedule = ยังไม่มี (P1) |

---

## F. PAYMENT STATUS (rebaseline ใหม่ — ห้ามประกาศ REAL PAYMENT READY)

### F.1 Stripe
- **code:** ยังครบและเป็น fallback อัตโนมัติเมื่อ Omise key ไม่ถูกตั้ง (`paymentGateway` env-driven) — อ่านจริง
- **env/config:** `VITE_STRIPE_PUBLISHABLE_KEY_LIVE` + `rk_live…` ใน `.env.local` · EF มี LIVE keys (master status)
- **webhook:** EF `stripe-webhook` ACTIVE · HMAC code อ่านจริง · **live webhook ยังไม่ register** (master status)
- **LIVE readiness:** ❌ **BLOCKED BY OWNER/EXTERNAL** — บัญชี "Paused soon" + tasks in review (dashboard 2026-10-07)
- **runtime evidence:** TEST webhook 6/6 (2026-09-19) · refund จริง 172 THB (test mode) · DB: stripe completed 28 / refunded 8

### F.2 Omise
- **code:** ✅ ครบ (EF 3 + `paymentGateway` + `OmiseCardForm` + tests 28) — อ่านจริง (commits `cd382c2`/`465306a`)
- **test mode:** ✅ key จริงใน `.env.local` + `supabase secrets set` แล้ว (วันนี้) · EF 3 ACTIVE
- **webhook:** ✅ deploy + **probe พิสูจน์จริง**: ไม่มี sig → 400 · sig ถูก → ผ่าน HMAC → เรียก RPC → 400 ERR_ORDER_NOT_FOUND (chain ครบ ไม่มี side effect)
- **signature validation:** ✅ t/v1 HMAC-SHA256 + กรอบ 300 วิ + constant-time (โค้ด + probe)
- **charge:** ✅ Omise API `GET /charges` 200 (key ใช้ได้) · **charge จริงในระบบ = 0** (omise rows = 0)
- **refund:** ⚠️ EF deployed + logic tests · **ยังไม่มี runtime จริง**
- **browser checkout:** ❌ **ยังไม่ได้ทดสอบ** (P0)
- **LIVE readiness:** ❌ DEFERRED — ยังไม่สมัคร live (test ผ่านก่อน = กฏ)
- **runtime evidence:** probes 3/3 เท่านั้น — **ยังไม่พอสำหรับ REAL PAYMENT READY**

### F.3 PromptPay
- **production path:** ✅ `create_payment_intent_record` → TXN → `submit_offline_payment_reference` → admin `confirm_offline_payment` → paid (อ่านโค้ด + RPC จริง)
- **runtime evidence:** DB: completed 2 · pending 4 · processing 3 (ยืนยันแล้วในยุค closure เดิม)

### F.4 COD
- **production path:** ✅ RPC → admin confirm หลัง `delivered` เท่านั้น (กฎใน RPC)
- **runtime evidence:** ⚠️ ไม่มีแถว cod ใน payment_intents ตอนนี้ — **IMPLEMENTED, RUNTIME EVIDENCE อ่อน**

> **สรุป F: ยังไม่มี provider ใดผ่านเกณฑ์ REAL PAYMENT READY** — ต้องมี browser test จริงบน Omise (P0) + ตัดสินใจ LIVE (Owner)
---

## G. REAL SHOP ACCEPTANCE STATUS (North Star)

| ขั้น | CODE READY | PRODUCTION READY | RUNTIME VERIFIED | OWNER VERIFIED | BLOCKER |
|---|---|---|---|---|---|
| REAL ORDER | ✅ RPC 18-param + triggers (อ่านจริง) | ✅ deployed (CF = HEAD) | ⚠️ มี orders 206 แถวใน production แต่ **active=0 และเป็นชุดทดสอบ/ปิดงวด** — **ยังไม่มี organic order จากลูกค้าจริง** | ❌ | ต้องเปิดรับ order จริง + owner acceptance run |
| REAL PAYMENT | ✅ 4 provider paths | ⚠️ PromptPay/COD ใช้ได้ · card = test mode เท่านั้น | ⚠️ Stripe TEST 6/6 + refund test · Omise probes เท่านั้น · **ยังไม่มีบิล card ที่จ่ายจริงผ่าน acceptance** | ❌ | **P0: Omise browser test + เลือก LIVE provider** |
| REAL KITCHEN | ✅ RPC 019 + triggers inventory | ✅ deployed | ⚠️ inventory deduct trigger live · ready-to-make gate live · **ไม่มี evidence การทำอาหารจริงจาก order จริงรอบล่าสุด** | ❌ | ผูกกับ acceptance run |
| REAL DISPATCH | ✅ queue + `delivery_assignments` + admin advance (m.116) | ✅ deployed | ⚠️ automation queue runtime ชัดเจน (407) · dispatch ของ order จริง = ไม่มีหลักฐานรอบล่าสุด | ❌ | ผูกกับ acceptance run |
| REAL DELIVERY (Bite Drive) | ✅ drivers/rounds/zones + FC-5 gate | ✅ deployed | ❌ **delivered=1 (เก่า/test) · Bite Drive pilot ยังไม่ทำ** | ❌ | **P0: owner pilot 1 เที่ยว** |
| REAL TRACKING | ✅ `OrderTrackPage` + `track_order` RPC + status history | ✅ deployed | ✅ w5h1 tests + ใช้ได้จริงตามรายงานก่อนหน้า | ⚠️ | — |
| REAL FAILURE HANDLING | ✅ G8 queue + `mark_payment_failed` + `cancel_order` + refund ledger | ✅ deployed | ✅ G8-S5 + cancel tests + refund ledger 8 แถว | ⚠️ | ทดสอบ failure/cancel/refund ใน acceptance run |

> ตาม `BMB_G10_FINAL_REPORT.md` §checklist: รายการ 1–4 (site จริง/จ่ายเงิน LIVE/สั่งซื้อจริง/Bite Drive pilot) = **ยังไม่ผ่าน** · 5–6 = ผ่านแล้ว — baseline นี้ยืนยันว่า **ข้อ 5–6 ยังคงผ่าน** (118/119 + DB markers วันนี้) และ **ข้อ 1–4 ยัง BLOCKED เหมือนเดิม + มี Omise เป็นหนทางใหม่ของข้อ 2**

---

## H. EXTERNAL DEPENDENCIES

| Dependency | สถานะ | จัดหมวด |
|---|---|---|
| Meta approval / real event (Test User + roles) | ยังไม่เปิด — simulated 9/9 ใช้แทนไม่ได้ตามกฏ acceptance | **BLOCKED BY OWNER + EXTERNAL** |
| Payment provider LIVE activation | Stripe = review/paused · Omise live = ยังไม่เริ่ม (ตามกฏ test-first) | **BLOCKED BY OWNER** (KYC/ตัดสินใจ provider) |
| External rider provider (Grab/LINE MAN) | ไม่มี sandbox credentials | **BLOCKED BY EXTERNAL PROVIDER** — *ไม่จำเป็นสำหรับ first shop* (Bite Drive ≤5 กม.) |
| SMS provider (thsms.org) | LIVE + owner ยืนยันแล้ว | **READY** |
| Domain/DNS (biteme-baby.com) | NS Cloudflare · apex+www 200 SSL | **READY** |
| Cloudflare deploy pipeline | auto-build ทุก push — ยืนยันวันนี้ (`db5c32a` = production) | **READY** |
| Production credentials | SUPABASE_ACCESS_TOKEN ใช้ได้ (exp 05 Nov 2026) · CF token ใช้ได้ · DB backup ทำได้ | **READY** |
| Device/browser acceptance | Omise browser test ยังไม่ทำ · push device = push_subs 0 | **BLOCKED BY OWNER** (ทดสอบเอง) |
| Google Maps/Routes key | มีใน env | **READY** (ไม่ได้ re-probe รอบนี้) |
---

## I. SECURITY / AUTHORITY STATUS (ไม่พบ regression ในรอบนี้)

| หัวข้อ | หลักฐานจริง (2026-10-07) | สถานะ |
|---|---|---|
| RLS | tables public เปิด RLS **50/50** · policies 134 · orders 4 / payment_intents 5 | ✅ ไม่ถูก clobber |
| RPC authority | `record_payment_result` GRANT = **service_role+postgres เท่านั้น** · `is_admin`/`is_branch_admin`/`transition_order_status`/`cancel_order` ครบ + SECURITY DEFINER | ✅ |
| Admin-only ops | EF `omise-refund`/`stripe-refund` เช็ค `is_admin()` server-side (อ่านจริง) · storage UPDATE/DELETE = admin policies (M119) | ✅ |
| Payment authority | client ไม่ส่งราคา (`OrderInput`) · EF re-derive จาก DB · refund server-side-only · ไม่มี omise rows ปลอม | ✅ |
| Order status authority | trigger `orders_guard_status_transition` + allow-list ยังอยู่จริง (query วันนี้) | ✅ |
| Price/stock/fee authority | price = RPC · stock = `ensure_inventory_deducted_on_confirm` trigger · fee = `compute_delivery_fee(_rpc)` settings+branch (ไม่มี 5.00 hardcode) | ✅ |
| Cancellation/refund authority | `cancel_order` RPC (audit+release+restore ใน transaction ตามโค้ด) · refund ledger guard | ✅ |
| **AI authority boundary** | grep จริง: AI files แตะ RPC เดียว = `get_ai_memory`/`save_ai_memory` · ai-proxy = read-only inference, no authority tools, guardrail ฝั่ง server | ✅ **AI ไม่ใช่ business authority** |
| Webhook signature | Omise: HMAC t/v1 + 300s — **probe จริงผ่าน** · Stripe: code อ่านแล้ว · channel: `X-Hub-Signature-256` | ✅ |
| Idempotency | RPC 010 (terminal replay guard) + unique index `payment_intent_id` · queue ON CONFLICT m.111 · channel dedupe | ✅ |
| Replay safety | webhook windows 300 วิ · queue identity allowlist | ✅ |
| Secrets exposure | dist leak check วันนี้: `pkey` client-safe เท่านั้น · `skey`/webhook secret = **0** · `.env.local`/`secrets.local.env` gitignored · service keys server-only | ✅ |

---

## J. TEST / BUILD STATUS (baseline ปัจจุบัน)

**ผลที่ใช้เป็น baseline (รันวันนี้ 2026-10-07 บน tree เดียวกับ HEAD):**
```
tsc --noEmit = 0 · eslint . = 0 · vitest run = 55 files / 589 tests PASS (exit 0) · npm run build = 0
```
**เหตุผลที่ไม่ rerun ซ้ำในรอบนี้ (ตาม §12):** `git diff 465306a..HEAD -- src supabase` = **0 บรรทัด** — code ปัจจุบัน identical กับรอบที่ gates ผ่าน (หลัง gates มีแต่การแก้ `.md` เท่านั้น) · rerun เฉพาะเมื่อมี code change

**Production probes ที่รันวันนี้ (จำเป็นต่อ baseline):**
- EF list (Management API): **19 ACTIVE** (รวม omise 3 ตัวใหม่)
- Omise webhook probes 3/3 (ไม่มี sig→400 · sig ถูก→RPC chain · API 200)
- CF Pages: production = commit `db5c32a` (= HEAD)
- DB queries: migrations 001–119 · FC markers · grants · triggers · data snapshot (ทั้ง read-only)

**ไม่ได้ rerun (มีเหตุผล):** Meta/channel live probes (external blocked — evidence ล่าสุด = G4/W3) · `fcProdVerify`/`fcVerify114` (round 8 — static markers ยืนยันซ้ำวันนี้แทน) · payment browser test (ยังไม่เกิด = P0 ของ owner)

---

## K. DOCUMENT CONFLICTS (ห้ามแก้จนกว่า Owner จะ approve baseline นี้)

| DOCUMENT | CLAIM | CURRENT REAL EVIDENCE | STALE/VALID | ACTION |
|---|---|---|---|---|
| `BMB_PRODUCTION_MASTER_STATUS.md` | Baseline HEAD == `3094c5d` | HEAD == origin == `db5c32a` | **STALE** | แทนที่/merge หลัง approve |
| `BMB_PRODUCTION_MASTER_STATUS.md` §5.3 | "SMS — MISSING ไม่มี provider" | SMS LIVE thsms.org + owner verified (8h/8k) | **STALE** | แก้หลัง approve |
| `BMB_PRODUCTION_MASTER_STATUS.md` §6 | "G10 = NOT STARTED" | G10 IN PROGRESS + evidence pack (ไฟล์เดียวกัน §8) + 118 applied | **STALE (ขัดแย้งภายในไฟล์เดียวกัน)** | แก้ |
| `BMB_PRODUCTION_MASTER_STATUS.md` | "118 authored PENDING" | history = 118 APPLIED + markers ครบ (query วันนี้) | **STALE** | แก้ |
| `BMB_PRODUCTION_MASTER_STATUS.md` | "ค้าง: SMS credential / backup" | ทั้งคู่ทำแล้ว (8h / รอบ 5) | **STALE** | แก้ |
| `BMB_PRODUCTION_MASTER_STATUS.md` | gates 527/561 | ปัจจุบัน 55 files/589 | **STALE** | แก้ |
| `BMB_G10_FINAL_REPORT.md` | "NOT CLOSED · checklist 1–4 ยังไม่ผ่าน" | ตรงกับ evidence วันนี้ (5–6 ยังผ่านด้วย) | **VALID** | เก็บเป็น authority ของ G10 |
| `BMB_G10_FINAL_REPORT.md` | gates 527 · orders cancelled 30 · กรอบ payment = Stripe ล้วน | 589 · cancelled 205 · มี Omise cutover แล้ว | **STALE (as-of date)** | ระบุ as-of หลัง approve |
| `README.md` | "ระบบชำระเงิน Stripe" / "Stripe Checkout + Webhook" | dual provider: Omise (primary เมื่อ key ตั้ง) + Stripe (fallback) | **STALE** | แก้หลัง approve |
| `docs/01_SYSTEM_ARCHITECTURE.md` · `docs/02_API_INTEGRATIONS.md` | Stripe-only payment path | มี `omise-checkout/webhook/refund` แล้ว | **STALE** | แก้หลัง approve |
| `BMB_HANDOFF_NEXT_SESSION_2026-10-06/07.md` | สถานะรอบ 7–8j | superseded โดย rounds 9–15 | **STALE (as current)** | เก็บเป็น history |
| `docs/BMB_HANDOFF_AI_AUTOMOTION_AUDIT_2026-10-07.md` | สถานะ round 15 + §2.1 | ตรงกับ HEAD/evidence วันนี้ | **VALID** | — |
| `BMB_TALK_TO_BITE_STATUS/CONTEXT.md` | ถึง round 15 | ตรง | **VALID** | — |
| `bmb/` worktree copy + `.kilo/` | stale snapshot | ไม่ใช่ canonical (มี warning ใน STATUS แล้ว) | **STALE** | ห้ามอ้างเป็น current |
| `e2e/prod-phase2-audit.json` | `record_payment_result` 6 args | DB จริง 6 args ตรง | **VALID** | — |

---

## L. REMAINING BLOCKERS (แยกชนิด)

**FIRST-SHOP BLOCKERS (P0):**
1. ยังไม่มี **browser checkout จริงบน Omise** (omise rows=0, ไม่เคยจ่ายผ่านฟอร์มใหม่)
2. ยังไม่มี **real customer order → payment → delivery 1 รอบสมบูรณ์** ที่ owner verify (acceptance §G)
3. ยังไม่มี **Bite Drive pilot 1 เที่ยว** (delivered=1 เป็นของเดิม/test)
4. ยังไม่ได้ **เลือก/เปิด LIVE payment provider** (Stripe = paused · Omise live = ยังไม่เริ่ม)

**EXTERNAL BLOCKERS:**
5. Meta (Test User/roles) — G4 real event
6. Grab/LINE MAN credentials — *ไม่บล็อก first shop*

**OWNER DECISION BLOCKERS:** ดู §N
**Regression จาก migration ใหม่: ไม่พบ** — authority functions/triggers ครบ · FC markers ครบ · policies ครบ · gates เดิมยัง PASS ตามหลักฐาน
---

## M. REMAINING WORK
**รายละเอียด + ลำดับ dependency อยู่ที่ §14** — สรุป: **P0 = 4 ข้อ** (Omise browser test → LIVE provider → acceptance run → ตรวจรอบ/เวลาเปิดร้าน) · **P1 = 8 ข้อ** (docs reconcile, G10 sign-off, push device, auto-backup, customization mapping, queue dead rows, cart shim, Stripe policy) · **P2 = 5 ข้อ** · **P3 = 4 ข้อ** — **ยังไม่เริ่ม implement ใด ๆ ในรอบนี้**

---

## N. OWNER DECISIONS REQUIRED

1. **Approve baseline นี้** เป็น current source of truth + สั่ง phase ถัดไป (ห้ามทำก่อนได้รับคำสั่ง)
2. **เลือก LIVE payment provider** — Omise-first (ต่อจาก cutover) / รอ Stripe ปลดล็อก / คู่กัน → หลัง browser test ผ่าน (P0-1)
3. **กำหนดวัน Acceptance Run จริง** (order→payment→kitchen→Bite Drive→delivery→tracking) + ผู้รับผิดชอบ
4. **Meta**: เปิด Test User/roles เมื่อไหร่ — ถ้าไม่ใช้ช่องทาง Meta ตอนเปิดร้าน = ไม่บล็อก
5. **ยืนยัน scope G1 / G2-RV** (evidence เฉพาะไม่พบในรอบตรวจ)
6. **นโยบาย Stripe**: เก็บเป็น fallback ถาวร หรือ ปลดหลัง Omise live
7. **อนุมัติงาน P1 ที่ให้ AI ทำต่อ** (เอกสาร reconcile + งานเทคนิคขนาดเล็ก) — หลัง review รอบนี้

---

## O. EVIDENCE INDEX (ทุกอย่างที่อ้างในเอกสารนี้)

| # | Evidence | วิธีได้มา | วันที่ |
|---|---|---|---|
| O1 | Git state (HEAD/origin/status/log-20) | `git rev-parse`/`log` จริง | 2026-10-07 |
| O2 | CF Pages production = `db5c32a` | Cloudflare API (read-only) | 2026-10-07 |
| O3 | EF 19 ACTIVE | Supabase Management API | 2026-10-07 |
| O4 | migrations 001–119 ไม่มี gap | `schema_migrations` query | 2026-10-07 |
| O5 | 50/50 RLS · 134 policies · 145 funcs | pg catalog query | 2026-10-07 |
| O6 | 18-param + FC markers + ไม่มี 5.00 | `pg_proc.prosrc` query | 2026-10-07 |
| O7 | `record_payment_result` grants = service_role+postgres | `routine_privileges` query | 2026-10-07 |
| O8 | orders 11 triggers (guard/history/inventory/capacity/preorder) | `pg_trigger` query | 2026-10-07 |
| O9 | storage bmb-images 4 policies (M119) | `pg_policies` query | 2026-10-07 |
| O10 | data snapshot (orders/pi/queue/zones/…) | SQL aggregate queries | 2026-10-07 |
| O11 | Omise probes 3/3 (sig→RPC chain) | POST signed/unsigned + API GET | 2026-10-07 |
| O12 | dist leak check (skey/webhook = 0) | grep dist | 2026-10-07 |
| O13 | Gates TSC0/LINT0/VITEST 55/589/BUILD0 | `npx` ทั้ง 4 ตัว (exit 0) | 2026-10-07 |
| O14 | code ≡ gates tree (`git diff` = 0) | `git diff 465306a..HEAD -- src supabase` | 2026-10-07 |
| O15 | อ่านโค้ดจริง 15+ ไฟล์ (payment ทั้งเส้น, order/kitchen/delivery, AI/channel/automation, migrations 117–119) | `read_files`/grep | 2026-10-07 |
| O16 | G8-S5 PASS (28 exec, 0 dup) | `BMB_G8_S5_FINAL_REPORT.md` | 2026-10-05 |
| O17 | G9 CLOSED (Owner) | `BMB_G9_FINAL_REPORT.md` + master status | 2026-10-06 |
| O18 | G10 NOT CLOSED + checklist 1–4 ยังไม่ผ่าน | `BMB_G10_FINAL_REPORT.md` | 2026-10-07 |
| O19 | SMS live + owner verify 3 หมายเลข | master status 8h/8k + `BMB_W23_SMS_DELIVERY_DIAGNOSTIC.md` | 2026-10-07 |
| O20 | FC verify scripts (9/9 · 25/25 · intake OK) | `e2e/fcProdVerify.cjs` `fcVerify114.cjs` `intakeDriftProbe.cjs` (รอบ 8) | 2026-10-07 |
| O21 | Stripe test 6/6 + refund 172 THB | รายงานยุค closure (test mode) | 2026-09-19 |
| O22 | Backup 3 × 4.67 MB | master status รอบ 5 | 2026-10-06 |
---

## §14 REMAINING WORK — DO NOT IMPLEMENT YET (เรียงตาม dependency จริง)

### P0 — BLOCKS FIRST REAL SHOP (ต้องเสร็จก่อนเปิดรับลูกค้าจริง)
| # | งาน | ขึ้นกับ |
|---|---|---|
| P0-1 | **ทดสอบ Omise card checkout ใน browser จนจบเส้น** (`npm run dev` → บัตร test `4242…` → charge → webhook → `orders.payment_status='paid'` จริง) | Owner ทำในเครื่อง (AI ซัพพอร์ต debug) |
| P0-2 | **เลือก + เปิด LIVE payment provider** (Omise live KYC หรือปลดล็อก Stripe) → หลัง P0-1 ผ่านเท่านั้น (กฏ test-first) | Owner + ผู้ให้บริการ |
| P0-3 | **Acceptance Run 1 รอบจริง**: real order → payment → kitchen → dispatch → **Bite Drive 1 เที่ยว** → tracking → spot-check failure/cancel/refund | Owner + AI (preparation) |
| P0-4 | **ตรวจ config วันเปิดร้าน**: round ของวันแรก + `operating_hours` + zone/รัศมี + สาขา (ทุกตัวมีใน DB แล้ว — verify ไม่ใช่สร้างใหม่) | Owner + AI (read-only verify) |

### P1 — REQUIRED FOR PRODUCTION CLOSURE
1. **เอกสาร reconcile** (README · docs/01 · docs/02 · master status บรรทัด stale) → หลัง approve เท่านั้น
2. **G10 evidence pack refresh + Owner sign-off** (checklist ข้อ 1–4 = P0 ด้านบน)
3. **Push บนเครื่องจริง** (ปัจจุบัน `push_subscriptions=0`) — หรือตัดสินใจย้าย push ออกจากรายการเปิดร้าน
4. **Auto-backup schedule** (Docker/pg_dump ทำงานแล้ว — ขาดเฉพาะการตั้งเวลา)
5. **ตาราง customization canonical ↔ Thai** (`extra_egg`/`spicy`/`no_ice`) + ต่อ customizations เข้า order-again
6. **กวาด `automation_queue` dead 13 แถว** + ตรวจ job ที่ตาย (observability)
7. **Cart shim migration** (`useCartStore` 3 importer → canonical) + ลบ dead exports
8. **นโยบาย Stripe fallback** (คงถาวร / ถอดหลัง Omise live) — ตาม N.6

### P2 — POST-OPEN / NON-BLOCKING
1. Meta G4 re-test event จริง (external)
2. External rider integration (Grab/LINE MAN) — นอก first shop
3. Talk-to-Bite E2E (Playwright: landing → conversation → order → checkout)
4. Continuous-listen + voice states ใน Bite Hero
5. Recommendation อิงออเดอร์จริง (real-based trend)

### P3 — FUTURE / ENHANCEMENT
1. LLM safe tool-calling design (ยังไม่เริ่ม)
2. Trend ranking/personalization ขั้นสูง
3. สร้าง/กู้ evidence ของ G1 และ G2-RV (scope ต้อง owner ยืนยันก่อน)
4. Enhancements อื่น ๆ (multi-branch scale, provider abstraction ฯลฯ)

---
*จัดทำโดย Cline (AI) — PHASE 0 AUDIT + REBASELINE ONLY · ไม่มีการแก้ code/migration/deploy/data ในรอบนี้ · รอ Owner Review*