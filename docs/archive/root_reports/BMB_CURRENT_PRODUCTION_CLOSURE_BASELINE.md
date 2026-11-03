# BMB — CURRENT PRODUCTION CLOSURE BASELINE (WHOLE-PROJECT REBASELINE)

> **RE-AUDIT:** 2026-10-14 (READ-ONLY — ไม่มีการแก้ code/migration/config/data/deploy/commit ในรอบนี้)
> **PART 1 (ข้างล่างนี้) = current truth ณ HEAD `64faf6b`** · **PART 2 = baseline 2026-10-07** (เก็บเป็น history — ข้อความขัด PART 1 ให้ยึด PART 1)
> คู่กับ `docs/BMB_OPENING_READINESS_MASTER.md` (สถานะหลักของ track เปิดร้าน 2026-10-14) — **ไม่แข่งกัน**: master = สถานะงานเปิดร้านราย gate · เอกสารนี้ = มุมทั้งโปรเจกต์ (audit baseline)
> **หลักฐานเรียงลำดับ:** Production DB → Deploy/Git จริง → Current Code → Contracts → Reports → Assumptions
> คำสถานะ: IMPLEMENTED · CONNECTED · DEPLOYED · RUNTIME VERIFIED · DOCUMENTED · MISSING · BLOCKED · DEFERRED
> **การเข้าถึงที่ใช้ (audit channels):** Supabase Management API `database/query`/`functions`/`secrets` (อ่านอย่างเดียว — SELECT/GET, ช่องทางเดียวกับ `e2e/push115*.cjs` ที่ repo ใช้ทำ audit เดิม) · PostgREST anon + Dedicated Test Admin (GET) · Cloudflare Pages API (GET) · `git`/ไฟล์ใน repo — **ไม่แตะ service_role key / ไม่ใช้ key มีค่าในรายงาน**

---

# PART 1 — RE-AUDIT 2026-10-14 (CURRENT TRUTH)

## 1. Verified Git + Deployment baseline [FACT — ตรวจจริง 2026-10-14]

```
REPO            = D:/A PROJECT/Bite Me Baby (git toplevel) → origin git@github.com-bmb:bitemebaby2016-coder/bmb.git
HEAD            = 64faf6b26fdf96d70af8d62339517745f15e2b7e (main)
ORIGIN/MAIN     = 64faf6b... (เท่ากันเป๊ะ — ไม่มี local-only commit, ไม่มี commit จาก session อื่น)
ANCESTRY        = 4e0453e → 06a697b(W5C) → 7f808ce(admin) → 34385c7(cart) → 8075f5d(docs) → 3926254/93f7e0e/64faf6b(docs รอบ audit-ก่อน)
WORKTREE        = ไม่มี staged · tracked change = SVG drinks/snacks 10 ไฟล์ถูก session ภายนอก "ลบ" (uncommitted — ห้ามกู้/commit ตามคำสั่ง Owner) · untracked = screenshots/webp/pre-order/same day (protected) · stash@{0} local-edits-before-sync-2026-09-21 คงเดิม
```

**Deployment (Cloudflare Pages API — read-only):**
- project `bitemebaby` · production deployment ล่าสุด `09b4f220` = **commit `64faf6b` สร้าง 2026-10-14T09:50:00Z** → **deployed commit == HEAD == origin/main** [FACT]
- chain ตรง git: 4e0453e (00:18Z) → 3926254 (07:42Z) → 93f7e0e (08:04Z) → 64faf6b (09:50Z)
- **Served assets จริง (GET):** `assets/index-0s4lXvhI.js` + `assets/index-BMJYc1f5.css` — marker scan (2026-10-14 เช้า, รอบก่อน audit): `__line_key`/`context_blocked`/`needs_confirmation`/`bmb-cart-v1`/`line_mode` + `admin-product-customer-hidden` (AdminProducts chunk) + `visibilitychange` (MenuPage chunk) ครบ = release code ของ 4 commits อยู่ใน build จริง

**Reconciliation ของ "รายงานล่าสุด" (Owner report 2026-10-14):**

| ข้อที่รายงาน | ตรวจจริง | สรุป |
|---|---|---|
| Push 4 commits + deploy | HEAD/origin/CF chain ตรง + marker scan ครบ | **VERIFIED** |
| Category Option A execute | DB ปัจจุบัน: cat-1 active+รับ prod-3, cat-2 archived, test product archived, order_items 141 = baseline (§2) | **VERIFIED** (ไม่ re-apply) |
| CI 972/972 · tsc/lint/build 0 | รันจริง 2026-10-14 เช้าบน tree `8075f5d`; `git diff 8075f5d..64faf6b` = **docs 2 ไฟล์เท่านั้น** → src/supabase identical | **VERIFIED (tree identity)** |
| Smoke 9/9 (client-side) | เป็น run ของ session ก่อน — **ไม่ได้ re-run ในรอบ audit นี้** | **REPORTED + partially re-verified** (visibility gate re-check ผ่าน anon+UI ในรอบ Option A verify) |

## 2. Production schema / migration reconciliation [FACT — DB read-only 2026-10-14]

| รายการ | ค่าจริง 2026-10-14 | เทียบ 2026-10-07 |
|---|---|---|
| migrations applied | **count=123, max=123** (001–123) | 119 → +4 (120–123) |
| migration files ใน repo | 127 = 001–124 + `PROPOSED_wave1/wave2/wave5` ×3 | +5 |
| **migration 124** | **NOT APPLIED** — probe: `order_submissions`=null, `order_submit_canonical_jsonb`=null | คง NOT AUTHORIZED ✓ |
| `PROPOSED_wave5_orders_delivery_address` | ยังไม่ apply — คอลัมน์ `orders.delivery_address` **ไม่มีจริง** · RPC `create_order_with_items` map `p_delivery_address` → คอลัมน์ `dropoff_detail` (verified ใน prosrc) = ข้อมูลไม่หาย | DEFERRED ตามมติ W5B |
| tables public / RLS | **51 / 51 เปิดครบ (RLS off = 0)** · policies 134 · functions 145 | 50 → 51 |
| `create_order_with_items` | **18-param signature จริง** (p_items…p_customer_ref) re-derive ราคา/fee/stock จาก DB (`FOR UPDATE` + `compute_addons_price`) | ตรง |
| `record_payment_result` grants | **service_role + postgres เท่านั้น** (ไม่มี anon/authenticated) | ตรง |
| triggers บน `orders` | **11 ตัวครบ** (guard_status_transition, ensure_deduct_on_confirm, increment_round, release_round_capacity, status_history, pre_order_window/cancel_window/address_check, operating_hours, stamp_source_channel, updated_at) | ตรง — ไม่มี regression |
| queue | `automation_queue` 1452 rows = succeeded 1439 · **dead 13 (`notification_dispatch`)** | dead 13 คงเดิม (ยังไม่เก็บ) |
| data invariants | orders 206 (cancelled 205 + delivered 1 — ไม่มี active) · order_items 203 · products 19 · payment_intents 56 (stripe 47 / promptpay 9 / **omise 0**) · push_subscriptions **0** · provider_orders **0** · notifications 338 · order_status_history 454 | สอดคล้องเดิม + เติบโตตามรอบทดสอบ |

**Ops data (read-only):** audit_logs **3,937** · drivers **5** · delivery_assignments **10** · delivery_zones **6** · delivery_rounds **42**

## 3. Journey matrix (entry → authority → evidence → status) [อ่านโค้ดจริง + DB/EF จริง]

| Journey | Entry → Authoritative side effect | Failure/retry | Runtime evidence จริง | สถานะ |
|---|---|---|---|---|
| **A. Login/identity** | `LoginPage`/`locationLogin` → Supabase Auth (JWT) · quick-login → EF `phone-auto-login` (server ตรวจ GPS/locationPolicy + rate limit SF-01) · guest → EF `otp-send` + `guest-checkout-session` (ออก session ให้ RPC authenticated) | rate limit มี test · OTP fail path = toast (UI) | SMS/OTP EF ACTIVE + SMS runtime รอบ 8k (owner เครื่องจริง) · **guest OTP E2E ใหม่ยังไม่จบเส้น** | IMPLEMENTED/CONNECTED · guest E2E = MISSING |
| **A2. Location/radius** | `locationStore` GPS → `compute_delivery_fee(p_branch_id)`/`delivery_zones` 6 zones · 5 กม. self-delivery gate | denied path = UI block (มี launch-03/04 evidence เดิม) | radius gate = contract tests + harness | IMPLEMENTED/DEPLOYED · device = บางส่วน |
| **B. Catalog/Admin** | `/admin/products` → `bmbAdminApi_products` (create/update/archive/move) → RLS `is_tenant_admin` → `products`/`product_categories` → customer `getProducts/getCategories` (active only) + `buildCatalogGroups` | save guard (null → error + คงฟอร์ม) · visibility badge | **Option A verify วันนี้ (§2)** · admin save live write-test = ยังไม่เคยทำ | IMPLEMENTED/DEPLOYED · live write round-trip = MISSING |
| **C. Cart/checkout** | ทุก entry (MenuPage/HomePage/TalkToBite/FoodTheater/theater cards) → `cartStore.addItem` ทางเดียว → `lineKeyFor` identity → `cartPersistence` (`bmb-cart-v1`) → revalidate → `CheckoutPage` → `m1Submit.submitSplitOrders` (shared in-flight lock → `conflict`) → **RPC `create_order_with_items` 18-param ทางเดียว** (rpc inventory ยืนยัน — ไม่มี legacy caller) | submit lock · AddToCartResult gate · revalidate drop · unique_violation recovery ใน RPC | smoke 9/9 (session ก่อน) + unit 972/972 | IMPLEMENTED/DEPLOYED · RUNTIME VERIFIED (client path) |
| **D. SAME_DAY/PRE_ORDER/MANUAL** | `order_mode`/`scheduled_date` → triggers `trg_pre_order_window/cancel_window/address_check/operating_hours` · menu schedule (`set_menu_schedule/publish_menu_schedule`) · cutoff `bangkokTime` (Bangkok) · horizon ≤50 วัน (023/038) | cutoff gate pre-RPC (กันก่อนยิง) + server raise | contract tests + harness isolated | IMPLEMENTED/DEPLOYED · live scheduling run = MISSING |
| **E. Order integrity** | RPC re-derive ราคา/fee/addons จาก DB · row lock (capacity `increment_round`) · idempotency: channel dedupe (unique `external_ref_id`) + advisory lock (124 = ยังไม่ apply) · `order_status_history` 454 rows · allow-list + guard trigger | 118 failure paths = all-RAISE (หลักฐาน W5B) · replay window 300s | prosrc + triggers ตรวจวันนี้ · canonical tests | IMPLEMENTED/DEPLOYED · concurrent replay runtime = MISSING |
| **F. Payment** | `create_payment_intent_record` → 4 เส้น: PromptPay manual (txn → `submit_offline_payment_reference` → `confirm_offline_payment`) · COD (confirm หลัง delivered) · Omise (EF checkout/webhook → `record_payment_result`) · Stripe (fallback) · **client refund บล็อกถาวร** (`REFUND_SERVER_SIDE_ONLY`) | webhook idempotent (RPC 010 + unique payment_intent_id) · `mark_payment_failed` · exceptions page | DB: stripe 47 (completed 28/refunded 8+1 partial) · promptpay 9 (completed 2) · **omise 0** · omise probes 3/3 (sig) | PromptPay = RUNTIME (historic) · Omise = CONNECTED แต่ **browser checkout NOT RUN** · LIVE = BLOCKED |
| **G. Kitchen/dispatch/delivery** | `kitchen_queue`/`get_kitchen_summary`/`order_ready_to_make` → `assign_driver`/`driver_accept_assignment`/`driver_update_delivery_status`/`admin_advance_delivery_status` → `track_order`/`my_deliveries` | dead-letter queue · restore_inventory/cancel path | delivered=1 (historic) · assignments 10 · **Bite Drive pilot = ไม่เคยจบ 1 เที่ยวจริง** · provider_orders=0 (3P frozen) | IMPLEMENTED/DEPLOYED · end-to-end runtime = MISSING |
| **H. Notifications/tracking** | `create_notification` → `notification_dispatch` queue → EF `push-send`/`sms-send` · push register RPC | **dead 13 แถวค้าง** (notification_dispatch) | notifications 338 · SMS ยืนยันแล้ว (8k) · **push_subs = 0** (ไม่มี device ลงทะเบียน) | SMS = RUNTIME VERIFIED · Push = CONNECTED แต่ device = MISSING · 13 dead = ค้าง |
| **I. Failure/recovery** | queue claim SKIP LOCKED + lease · dead-letter · payment replay guard · unique_violation recovery · `record_system_error` | dead 13 = ตัวอย่าง fail ที่ยังไม่ recover (ไม่มี runbook เก็บ) | หลักฐาน W5B A1/A2/A3 + tests | IMPLEMENTED · operational recovery runbook = MISSING |
| **J. Admin/Ops** | `/admin/orders` (`adminOrderDisplay` — ชี้ทาง canonical เท่านั้น) · kitchen/dispatch screens · payment exceptions · audit_logs 3,937 · `e2e/dbBackup.cjs` dump ทำงาน | roles RLS (`is_admin`/`is_branch_admin`) | screens ใช้ RPC จริง (ไม่ใช่ mock — mock อยู่ใน `__tests__` เท่านั้น) | IMPLEMENTED/DEPLOYED · auto-backup schedule = MISSING |
| **K. AI/social (G1–G10/W-A)** | ดู §4 | — | — | ดู §4 |
| **L. Security** | ดู §6 | — | — | ดู §6 |
| **M. UI/mobile** | responsive + sticky bar contract (D02) | — | Playwright 390×844 (session ก่อน) · **อุปกรณ์จริง = NOT VERIFIED** | MISSING (device) |

## 4. Gate G1–G10 / W-A reconciliation (อัปเดต 2026-10-14 — คง PASS เดิมเว้นแต่ regression ซึ่ง**ไม่พบ**)

| Gate | ตรวจซ้ำ 2026-10-14 | สรุป (คงจาก baseline 10-07 เว้นมีหลักฐานใหม่) |
|---|---|---|
| G1 foundation | ยังไม่พบรายงานเฉพาะ | **DEFERRED** (owner ยืนยัน scope — P3) |
| G2 / G2-RV | ไม่ rerun (historic) | **DOCUMENTED (historic)** · G2-RV = DEFERRED |
| G3 social events | ไม่ rerun | **PASS (คงไว้)** |
| G4 Meta receive | EF `channel-webhook` ACTIVE + HMAC · provider_orders=0 · ไม่มี event จริง | **HOLD — EXTERNAL** (Meta roles/Test User) |
| G5 AI routing | EF `ai-proxy` ACTIVE | **PASS (คงไว้)** |
| G6 auto-reply | EF `social-ai-worker` ACTIVE (classify/draft) | **PASS (capability — draft-only คงไว้)** |
| G7 auto-post | EF `social-post-worker` ACTIVE | **PASS (report)** |
| G8 queue/retry | EF `queue-enqueue/dispatcher/automation-worker` ACTIVE · queue 1452/1439 succeeded/13 dead | **PASS + หลักฐานใหม่** · dead 13 = P1 ค้าง |
| G9 social E2E | EF `social-publish-worker` ACTIVE | **CLOSED — PASS (Owner 2026-10-06)** |
| G10 true closure | checklist ข้อ 1–4 เดิม: browser payment test / LIVE provider / acceptance run / rounds+เวลาเปิดร้าน — **ยังไม่ผ่านทั้งหมด** | **IN PROGRESS — NOT CLOSED** |
| W-2.x Stripe LIVE | บัญชี paused/review (external) · EF stripe-* ACTIVE · webhook live ยังไม่ register | **BLOCKED OWNER/EXTERNAL** |
| W-2.3 SMS | EF `sms-send` ACTIVE (updated 2026-10-11) · owner ยืนยันเครื่องจริงรอบ 8k | **DONE + RUNTIME VERIFIED** |
| W-3.x Grab/LINE MAN | ไม่มี credential | **BLOCKED EXTERNAL** (ไม่บล็อก first shop) |
| **W5A/B/C (120–124 era)** | 120–123 = **applied แล้ว (count 123)** · **124 = NOT APPLIED (probe วันนี้)** · `_i`/idempotency 124 = ไม่ wire · unique_violation branch = no runtime coverage · **R9/R12 = OPEN (Owner decision)** · R10 = BLOCKED (เดิม — prod precheck ของ 124, ยังไม่เริ่มเพราะ 124 ยังไม่อนุมัติ) · R11 = OPEN (staging pgbouncer) | **124 = NOT AUTHORIZED คงเดิม** |

**EF inventory จริง (management API GET, 2026-10-14): 20 ฟังก์ชัน ACTIVE ครบ** — create-checkout · stripe-webhook · stripe-refund · phone-auto-login · ai-proxy · automation-worker · channel-webhook · voice-tts · social-ai-worker · social-post-worker · social-publish-worker · queue-enqueue · queue-dispatcher · push-send · sms-send · omise-checkout · omise-webhook · omise-refund · otp-send · guest-checkout-session (EF secrets มีชื่อครบ — **Omise มีแค่ `_TEST_MODE` ไม่มี live key**, Stripe keys อยู่แต่บัญชี paused ตาม §6)

## 5. Duplication / dead-work audit (ทุกชิ้น = พิสูจน์แล้ว ไม่ตัดสินจากชื่อ)

| รายการ | หลักฐาน | คำตัดสิน |
|---|---|---|
| Cart store | `store/cartStore.ts` = canonical · `stores/useCartStore.ts` = delegating shim (พิสูจน์ใน CartIsolation tests) — importers ฝั่ง prod เหลือ 2 (`BiteMascot.tsx`, `CartIsolationModal.tsx`) | **ไม่ใช่ store ซ้ำ** — shim ใช้งานจริง · P3: migrate 2 importers แล้วลบ shim |
| Order creation | `rpc('create_order_with_items')` = ทางเดียวทั้ง app (inventory ทุก `.rpc(` ใน src — ไม่มี legacy `createOrder`/`createPreOrder` RPC) | **canonical เดียว ไม่มี dual authority** |
| `createPreOrder` | เหลือแค่ **comment เก่า** `HomePage.tsx:10`, `MenuPage.tsx:97` — ไม่มีโค้ด/ไม่มี caller | **dead reference** — P3 แก้ comment (ห้ามกู้ function กลับ) |
| Payment providers | Omise (primary เมื่อ key) + Stripe (fallback) = `paymentGateway` env-driven — **ตั้งใจไว้ 2 เส้น** | **not duplication** — intentional dual-path · เอกสาร README/docs 01-02 ยังเขียน Stripe-only = STALE (P3) |
| Price/fee | client ไม่มี `computeDeliveryFee`/`DELIVERY_FEE` เลย (grep 0 hits) — fee มีแต่ `compute_delivery_fee(_rpc)` ฝั่ง server | **single definition** ✓ |
| supabaseMock | import โดย `src/__tests__/*` เท่านั้น (23 ไฟล์) | **test-only** — ไม่มีใน production path ✓ |
| Workers/jobs | queue path เดียว (scheduler GHA → enqueue → dispatcher → worker) · social workers แยกตาม gate (G6/G7/G9) ไม่ซ้ำหน้าที่ | **ไม่พบ duplicate worker/legacy job** |
| Migrations | 001–124 + PROPOSED ×3 · ไม่มีไฟล์ซ้ำ/ย้อนศร · 124 แยก gate | ปกติ · PROPOSED = deferred queue ไม่ใช่ของซ้ำ |
| Docs | `BMB_PRODUCTION_MASTER_STATUS.md`/README/docs 01-02 = STALE ตาม PART 2 §K (เดิม) · `bmb/` (chat worktree) = stale copy ห้ามอ้าง | **doc drift P3** — reconcile หลัง Owner approve |

## 6. Domain status: Payment · Security · Fulfillment · Recovery (2026-10-14)

**Payment (ห้ามประกาศ REAL PAYMENT READY):**
- PromptPay manual = RUNTIME (completed 2, historic) · COD = IMPLEMENTED (runtime evidence อ่อน) · Stripe = test-era 47 rows (completed 28, refunded 8+1) — **บัญชี LIVE paused/review (external)** · **Omise = test probes 3/3 เท่านั้น — browser checkout ไม่เคยรันจริง (omise rows = 0) · EF secrets มีแค่ `_TEST_MODE`**
- Authority ครบ: client ไม่ส่งราคา · `record_payment_result` grant คุม · refund = EF admin-only (`is_admin`) + client บล็อก · webhook HMAC + replay guard (300s) + idempotent unique `payment_intent_id`

**Security/privacy:** RLS 51/51 · 11 triggers authority · AI ไม่มี business tools (memory RPC เท่านั้น — คงเดิม) · secrets: ไม่พบใน git/dist (รายงานนี้ไม่มี secret) · ช่องทางที่ audit ใช้ = read-only ทั้งหมด · PII ในรายงาน = ไม่มี
- ข้อควรระวังที่ทราบ (คงเดิม): session ใน localStorage = Supabase pattern (server คุม authorization จริงผ่าน RLS/JWT) · `guest-checkout-session`/`phone-auto-login` = server-issued session (rate limit SF-01 + locationPolicy)

**Kitchen/dispatch/delivery:** RPC + screens ครบ (kitchen_queue, ready-to-make gate 054, inventory deduct trigger, assign/driver/advance, Bite Drive ≤5 กม. + 3P boundary) — **แต่ยังไม่มีรอบจริงสมบูรณ์ในยุคปัจจุบัน**: delivered=1 = ของเก่า/test · **Bite Drive pilot 1 เที่ยว = ไม่เคยเกิด** · 3P = provider_orders 0 (frozen)

**Tracking/notifications:** `track_order` + customer tracking (w5h1) · notifications 338 · SMS RUNTIME VERIFIED · **push = 0 device** · **dead queue 13 (notification_dispatch) ค้างโดยไม่มี runbook**

**Recovery/backup:** dead-letter ทำงาน (มี 13 แถวเป็นหลักฐาน fail ค้าง) · `e2e/dbBackup.cjs` dump สำเร็จ (รอบ 5) · **auto-backup ตามเวลา = ยังไม่มี** · restore drill = ไม่มีหลักฐานรอบใหม่

## 7. P0–P3 backlog (re-audit — เรียงตาม dependency)

| ID | ระดับ | เรื่อง (ที่อยู่จริง) | ชนิด | ผลกระทบ | งานที่มีแล้ว (ห้ามทำซ้ำ) | Action ถัดไป | ปิดเมื่อ | Owner? |
|---|---|---|---|---|---|---|---|---|
| F-01 | **P0** | ยังไม่มี **real order → payment → delivery ครบ 1 รอบ** ที่ Owner verify | missing runtime | เปิดร้านจริงไม่ได้ | harness/contract + smoke client-side แล้ว | กำหนด **Owner Acceptance Run** (test plan ยืนยัน) | runtime ทุกขั้น + Owner sign-off | ✅ |
| F-02 | **P0** | ไม่มี **LIVE payment provider** (Omise live ไม่มี key · Stripe paused/review) | external blocker | รับเงินจริงไม่ได้ | Omise test path + probes 3/3 | browser test (test mode) ก่อน → cutover | keys live + webhook register | ✅ |
| F-03 | **P0** | Omise **browser checkout ไม่เคยรันจริง** (omise rows=0) | missing runtime | เส้นจ่ายบัตรหลักไม่เคยใช้จริง | code+EF+28 tests+sig probes | รัน test-mode 1 ครั้งใน test plan F-01 | charge test 1 แถว + webhook เข้า RPC | ✅ |
| F-04 | P1 | **dead queue 13 (`notification_dispatch`)** ค้าง ไม่มี runbook | incomplete ops | แจ้งเตือนหายเงียบบางส่วน | dead-letter ทำงานแล้ว | runbook เก็บ/replay + ตรวจ 13 แถว | dead=0 หรือมีบันทึกทุกแถว | ✅ |
| F-05 | P1 | **push_subs=0** — ไม่เคยลงทะเบียนบนอุปกรณ์จริง | missing runtime | PWA push ใช้ไม่ได้จริง | EF push-send + VAPID + tests | ลงทะเบียน 1 เครื่อง + ยืนยันรับ 1 ข้อความ | push row + delivery proof | ✅ |
| F-06 | P1 | **auto-backup + restore drill ไม่มี** | incomplete ops | กู้ภัยไม่ได้ตามเวลา | `dbBackup.cjs` manual ใช้ได้ | ตั้ง schedule + restore drill 1 ครั้ง | dump อัตโนมัติ + restore สำเร็จ | ✅ |
| F-07 | P1 | **guest OTP E2E** (EF ใหม่ 2026-10-11) ยังไม่จบเส้นจริง | missing runtime | ลูกค้า guest สั่งไม่ได้ถ้า OTP พัง | unit + rate limit + smoke เห็น gate | E2E เครื่องจริง (test number ที่อนุมัติ) | OTP → session → order draft สำเร็จ | ✅ |
| F-08 | P1 | **admin save → customer visibility live round-trip** ไม่เคยทดสอบ (write) | missing runtime | admin→ลูกค้า = unit เท่านั้น | save guard+badge+tests+smoke read | test plan → เขียนค่าเดิม 1 รายการ → refetch | before/after evidence | ✅ |
| F-09 | P2 | W5C **R9/R12** ยังไม่มีมติ | owner decision | 124 accept ไม่ได้ | W5B review pack | Owner ตัดสิน 2 ข้อ | มีมติบันทึก | ✅ |
| F-10 | P2 | **staging ยังไม่มี** · R11 pgbouncer | incomplete | E2E ต้องระวังทุกครั้ง | docker harness บางส่วน | ตัดสินใจลงทุน staging | มี env ไม่แตะลูกค้า | ✅ |
| F-11 | P2 | **G4 Meta real event** (roles/Test User) | external | ช่องทาง Meta ใช้จริงไม่ได้ | intake+HMAC+dedupe ครบ | owner เปิด roles เมื่อพร้อม | event จริง 1 ใบ | ✅ |
| F-12 | P2 | **อุปกรณ์จริง**: sticky cart vs BottomNav + responsive | missing runtime | UX มือถือไม่ยืนยัน | D02 contract + Playwright | owner ตรวจบนมือถือจริง | บันทึกผลบนอุปกรณ์ | ✅ |
| F-13 | P2 | `orders.delivery_address` normalize + 124 idempotency | deferred design | ข้อมูลอยู่ `dropoff_detail` (ไม่หาย) | W5B compat strategy | ทำหลัง 124 อนุมัติ + R9–R12 ปิด | migration ผ่าน isolated + prod gate | ✅ |
| F-14 | P3 | stale docs + `createPreOrder` comments + cart shim 2 importers | doc/cleanup | สับสนผู้สืบทอดงาน | PART 2 §K inventory | reconcile ทีเดียวหลัง approve | docs ตรง PART 1 | ✅ |
| F-15 | P3 | G1/G2-RV scope ไม่มี evidence เฉพาะ | unknown | ไม่กระทบเปิดร้าน | — | owner ยืนยัน scope/ปิดตก | มีมติ | ✅ |

## 8. Open-Shop Acceptance Matrix — REAL ORDER → OWNER ACCEPTANCE (ไม่รันระหว่าง audit)

| ขั้น | Entry/caller | Authority (RPC/ตาราง) | Config/ภายนอก | Happy-path evidence | Failure/retry evidence | Tests ที่มี | Runtime proof (เวลา/build) | ช่องว่าง | สถานะ |
|---|---|---|---|---|---|---|---|---|---|
| REAL ORDER | `CheckoutPage` → `m1Submit` | `create_order_with_items` (18-param) + triggers ×11 | catalog/rounds ตั้งค่าแล้ว | smoke S2–S5 (client) + 206 orders (test-era) | all-RAISE 118 paths · unique recovery | canonicalOrderFlow · catalogGate · 972/972 | **ยังไม่มีรอบปัจจุบัน** (ล่าสุด = test-era) | order จริง 1 ใบโดย Owner | **IMPLEMENTED/DEPLOYED · RUNTIME = MISSING** |
| REAL PAYMENT | CardForm/checkout → EF omise-*/stripe-* · PromptPay manual | `record_payment_result` (service_role only) · `confirm_offline_payment` | **Omise test keys · Stripe paused · ไม่มี LIVE** | promptpay completed 2 · stripe completed 28 (historic) · omise probes 3/3 | idempotent replay tests · `mark_payment_failed` | paymentStateMachine · omise 28 tests | **omise rows = 0 — browser ไม่เคยรัน** | F-02/F-03 | **BLOCKED (LIVE) · test-path = NOT RUNTIME VERIFIED** |
| REAL KITCHEN | `kitchen_queue`/admin kitchen | `order_ready_to_make` · inventory trigger | — | delivered=1 (historic) | dead-letter · restore_inventory | kitchenControl/preOrderQueue tests | รอบปัจจุบัน = ไม่มี | อยู่ใน F-01 | **IMPLEMENTED · RUNTIME = MISSING** |
| REAL DISPATCH | `assign_driver`/`driver_accept_assignment` | `delivery_assignments` (10 rows) · drivers 5 | Bite Drive ≤5 กม. · 3P frozen | assignments 10 (เก่า) | failed-assign path = code | dispatchContract | **Bite Drive pilot = ไม่เคย** | F-01 | **IMPLEMENTED · RUNTIME = MISSING** |
| REAL DELIVERY | `driver_update_delivery_status` | orders status + history | — | delivered=1 (เก่า) | exception paths = code | phases5_7 | รอบปัจจุบัน = ไม่มี | F-01 | **IMPLEMENTED · RUNTIME = MISSING** |
| REAL TRACKING | `track_order` (customer) | orders (RLS read) | — | w5h1 + harness (เก่า) | — | w5h1Tracking | ไม่มีรอบปัจจุบัน | F-01 | **IMPLEMENTED · RUNTIME = MISSING** |
| REAL FAILURE HANDLING | queue/payment/webhook | dead-letter · replay guard | — | **dead 13 = fail ค้างจริง (ยังไม่ recover)** | หลักฐาน W5B A1–A3 | paymentExceptions · concurrency 124 (isolated) | partial | F-04 runbook | **PARTIAL** |
| OWNER ACCEPTANCE | — | — | — | — | — | — | — | F-01 test plan + sign-off | **MISSING** |

## 9. Existing work ที่ต้อง **ห้ามทำซ้ำ** (พิสูจน์แล้วว่าผ่าน/มีอยู่)

- 4 commits `06a697b`/`7f808ce`/`34385c7`/`8075f5d` + docs 3 ใบ — **deployed + marker verified** (ห้ามรื้อ)
- Category Option A — **execute แล้ว + verify แล้ว (§2)** — ห้าม re-apply
- W5A/B/C code (`124` remediation R1/R2/R3 + harness) — ผ่าน isolated ×2 — ห้ามเขียนซ้ำ · **ห้าม apply 124 โดยไม่ผ่าน gate เดิม**
- P0 admin/menu/cart fixes + tests 38 ตัว (2026-10-14) · cart canonical (`lineKeyFor`, `cartPersistence`, `m1Submit` lock)
- G2–G9 gates ที่ PASS/CLOSED แล้ว (§4) · G8 single-path queue · G9 CLOSED
- Omise EF 3 ตัว + probes · SMS runtime · M117 18-param + channel dedupe · M119 storage policies · FC restore (118)
- `e2e/dbBackup.cjs` · smoke harness scripts · รายงาน/หลักฐานใน `docs/` + `BMB_*` ทั้งหมด (PART 2 §K = inventory ความขัดแย้ง)

## 10. Runtime evidence gaps + exact safe verification plan (ทุกขั้นต้องมี Owner-approved test plan)

| # | ช่องว่าง (อ้าง F-ID) | แผนพิสูจน์ที่ปลอดภัย (เรียงลำดับ) | ความเสี่ยงที่ต้องอนุมัติ |
|---|---|---|---|
| 1 | F-03 Omise browser | ① test-mode card checkout 1 ครั้งบน staging-less production **ด้วยสินค้าราคาต่ำสุด + ผู้ทดสอบภายใน** → ② ตรวจ `payment_intents` (provider=omise, status=completed) + webhook → `record_payment_result` (audit_logs) → ③ refund ผ่าน `omise-refund` (admin) | **สร้าง order+charge test-mode จริง 1 ใบ** — ต้องอนุมัติ test plan |
| 2 | F-01 Acceptance Run | order เดียวจบ: สั่ง (same-day) → จ่าย (เลือก path ที่ทดสอบ) → kitchen → dispatch (Bite Drive 1 เที่ยว) → delivered → tracking → ทดสอบ cancel/refail 1 จุด | order จริง 1 ใบ + การเปลี่ยนสถานะโดยผู้มีอำนาจ (ไม่ใช่ AI) |
| 3 | F-07 guest OTP | OTP test number ที่ Owner กำหนด → session → draft order (ยังไม่ submit) | SMS จริง 1 ข้อความ (เครดิตลด) |
| 4 | F-08 admin write round-trip | admin บันทึกสินค้า **ค่าเดิม** 1 รายการ → ลูกค้า refetch เห็น → ยืนยัน audit_logs | production write (ค่าเดิม = ความเสี่ยงต่ำ) |
| 5 | F-05 push device | ลงทะเบียน push 1 เครื่อง → trigger `create_notification` → ยืนยันได้รับ | push 1 ข้อความ |
| 6 | F-04 dead 13 | อ่าน 13 แถว (read-only) → จำแนก → replay เฉพาะที่ปลอดภัย หรือ mark ด้วยเหตุผล | replay อาจส่งซ้ำ = ต้องอนุมัติ |
| 7 | F-12 device UI | owner ตรวจมือถือจริงตาม checklist (sticky cart/BottomNav/OTP/checkout) | none (read-only) |
| 8 | F-06 backup | ตั้ง schedule + restore drill บน isolated | infra change |

**กติกาคงเดิมทุกข้อ:** ห้ามใช้ AI เป็นผู้มีอำนาจเปลี่ยนสถานะธุรกิจ/เงิน · ห้าม apply migration 124 · ห้ามแตะ protected artifacts · ทุก test plan ต้อง Owner ยืนยัน · ผลทุกอย่าง = PASS/FAIL + เวลา + build identity

## 11. Open Shop recommendation (2026-10-14)

### 🔴 **NOT READY — ยังไม่พร้อมเปิดร้านจริง**

**เหตุผลด้วยหลักฐาน (ไม่ใช่ความรู้สึก):**
1. **ไม่มีรอบ REAL ORDER → REAL PAYMENT → REAL DELIVERY แม้แต่รอบเดียวในยุคปัจจุบัน** — orders 206 = cancelled 205 + delivered 1 (test-era) · acceptance matrix §8 = RUNTIME MISSING เกือบทุกขั้น (F-01)
2. **รับเงินจริงไม่ได้** — ไม่มี LIVE payment provider (Omise ไม่มี live key ใน EF secrets · Stripe บัญชี paused/review) (F-02) และ **เส้นจ่ายบัตรหลัก (Omise) ไม่เคยรันใน browser จริง** (omise rows = 0) (F-03)
3. **Bite Drive ไม่เคยส่งจริง 1 เที่ยว** · push 0 device · guest OTP รอบใหม่ไม่จบเส้น (F-05/F-07)
4. ความพร้อมระบบฐานล่าง = **ดี**: deployed==HEAD, RLS 51/51, authority/triggers ครบ, tests 972/972, Option A แล้วเสร็จ, ไม่พบ defect ใหม่/regression — **แต่หลักฐานเหล่านี้ไม่ทดแทน runtime จริงตามกติกา**

**เปิดร้านได้เมื่อ:** F-01 (acceptance run + Owner sign-off) · F-02/F-03 (payment test-mode ผ่าน + LIVE cutover) · F-04/F-05/F-07 (notification + guest path ยืนยัน) ปิดครบ — และ checklist `docs/BMB_OPENING_READINESS_MASTER.md` §8 ผ่านจริงทุกข้อ

---
---

# PART 2 — BASELINE 2026-10-07 (HISTORY — superseded โดย PART 1 เมื่อขัดกัน; เก็บเป็นหลักฐานเดิม)

> ⚠️ ทุกอย่างด้านล่างนี้ = สถานะ ณ **2026-10-07** (HEAD `db5c32a` ตอนนั้น) — ตัวเลข/ตารางบางส่วนล้าสมัยแล้ว (ดู PART 2 §K เดิม = document conflicts)






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