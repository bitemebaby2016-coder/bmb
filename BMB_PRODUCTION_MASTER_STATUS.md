# BMB — PRODUCTION MASTER STATUS (เอกสารหลัก — เขียนทับฉบับ 2026-10-06)

**ประเภทเอกสาร:** STATUS / RECONCILIATION + MASTER WORK LIST — สะท้อนสถานะโค้ดจริง ณ วันที่อัปเดต (เขียนทับ ไม่ต่อท้าย)
**วันที่อัปเดต:** 2026-10-06 (รอบ 2 — migration 117 applied) · **Baseline:** HEAD == origin/main == `24506ab` (docs(g9): CLOSE G9 — Owner approved PASS)
**รอบนี้ (2026-10-06 รอบ 2):** IMPLEMENTATION = YES (repo, commit ตามหลังรอบนี้) · MIGRATION = **YES — 117 APPLIED (Owner อนุมัติ 2026-10-06, verify ผ่าน)** · DEPLOYMENT = NO · PRODUCTION MUTATION = YES (apply 117 + probe test orders ถูก cancel คืน — active = 0)
**สถานะ Stripe:** บัญชี **Review in progress (Stripe รีวิว 2–3 วัน)** — LIVE รับเงินจริงยังใช้ไม่ได้จนกว่าอนุมัติ · LIVE webhook register เมื่อบัญชีผ่าน (W-2.1)
**งานที่ยังไม่ commit ใน repo:** `supabase/migrations/117_channel_intake_repair.sql` (+ replay manifest) · `e2e/intakeDriftProbe.cjs` · `e2e/intake117Verify.cjs` · `e2e/wave2Lib.cjs` (env merge) · `e2e/g4CheckRealEvents.cjs` (เขียนใหม่) · `e2e/channelWebhookProbe.cjs` (แก้ page id จริง) — จะ commit หลังผ่าน gates ตามกฏ

Evidence priority: PRODUCTION DB → CURRENT CODE → MIGRATIONS/CONTRACTS → VERIFIED REPORTS → DOCS → OLD DOCS
Status legend: IMPLEMENTED · CONNECTED · DEPLOYED · RUNTIME VERIFIED · DOCUMENTED · READY · BLOCKED · MISSING · DEFERRED

---

## 1. BUSINESS MODEL (Owner ยืนยัน 2026-10-05) — ใช้เป็นเกณฑ์วัดทั้งเอกสาร

| หัวข้อ | Owner ระบุ | สถานะในระบบจริง |
|---|---|---|
| โหมดขาย | **PRE_ORDER** และ **SAME_DAY** | IMPLEMENTED — `orders.order_mode` + RPC `create_order_with_items` (`ERR_INVALID_ORDER_MODE`) |
| ขนส่งแบบ 1 | **Bite Drive** ส่งเองตามรอบของตัวเอง ระยะไม่เกิน 5 กม. **(แอดมินปรับได้)** | ✅ **IMPLEMENTED + CONFIGURABLE** — 5 กม. อ่านจาก `branches.service_radius_km` / `delivery_policy.bite_drive_radius_km` (112/114) — ไม่มี hardcode แล้ว |
| ขนส่งแบบ 2 | เรียกไรเดอร์ภายนอก | IMPLEMENTED ระดับ adapter (Grab/LINE MAN sandbox) — ยัง NOT CONNECTED (รอ key, W-3.x) |
| Admin | **ต้องปรับได้ทุกอย่าง** | ✅ **DONE** — ค่าปกครอง server-authority ครบ (112/113/114) + client hydrate — แก้ผ่าน `/admin/settings` |
| แพลตฟอร์ม | **White-label** ใช้ได้กับร้านไหนก็ได้ กี่สาขาก็ได้ | ระดับ schema พร้อม (tenants/brands/branches + tenant_id/branch_id) — runtime จริงยังมีแค่ 1/1/1 (W-5.1) |
| ร้านแรก | Bite Me Baby (ร้านจริง) | tenant `tenant-bmb-001` · brand `brand-bmb-main` · branch `branch-tenant-bmb-001-main` |
| โดเมน | **biteme-baby.com** | ✅ **CONNECTED** — NS Cloudflare · apex+www = 200 SSL · canonical/robots/sitemap ใช้โดเมนใหม่แล้ว (W-1.3) |

---

## 2. PRODUCTION EVIDENCE SNAPSHOT (2026-10-06, read-only)

```text
WEB      https://biteme-baby.com = 200 · deploy = auto-build จาก push main (source=github) ✅
         canonical/og:url = biteme-baby.com ถูกต้องแล้ว (W-1.3)
DOMAIN   ✅ CONNECTED — NS carlane/eoin.ns.cloudflare.com · apex + www = 200 (SSL Active ทั้งคู่)
TENANCY  tenants 1 · brands 1 · branches 1 (service_radius_km = 5.00, active, default)
ORDERS   ประวัติ = delivered 1 + cancelled 29 (ทดสอบถูกยกเลิกครบ ตาม D-02) · active ค้าง = 0
         ออเดอร์ที่มี source_channel = 146 (มาจาก trigger stamp MANUAL/PWA — ยังไม่มี channel ภายนอกจริง)
PAYMENT  Edge Functions สลับเป็น LIVE keys แล้ว (3a6cba3) · card flow Stripe.js LIVE (438217a)
         ⚠️ บัญชี Stripe = Review in progress (2–3 วัน) — รับเงินจริงยังไม่เปิด · live webhook รอหลังอนุมัติ
DELIVERY drivers 5 · zones 6 · rounds 26 · GAP A-1 (delivery loop) ปิดแล้ว — migration 116 + DeliveryManagement
RIDER    provider_orders = 0 · adapters: grab/lineman = sandbox · Bolt ยังไม่มี adapter (W-3.4)
NOTIFY   Web Push: migration 115 APPLIED + EF push-send deployed + probe 17/17 (config/auth layer)
         ⚠️ ยังไม่ได้ทดสอบส่งถึงเครื่องจริง · SMS: ยังไม่มี provider/credentials
META     แอป #2 = 1737887467512190 (LIVE) · Page token long-lived expires=never · scope ครบรวม pages_manage_posts
         social-publish-worker deployed · g9PublishJourney 6/6 (โพสต์จริง 2 + replay idempotent + audit)
         ✅ โพสต์ทดสอบ 3 รายการบนเพจถูกลบแล้ว (Owner 2026-10-06 — ยืนยันผ่าน Graph)
SOCIAL   social_events = แถวทดสอบจาก probe เท่านั้น (04:40Z) · comment จริงบนเพจ 3 รายการ (07:44–08:04Z)
         ยังไม่เข้า webhook — root cause ดู §5.2 · channel_page_bindings active 2 (page 862940416913026)
FUNCTIONS ACTIVE — channel-webhook v11 (ข้อความไทยขึ้น prod แล้ว W-1.5) · ai-proxy · social-ai-worker ·
         social-publish-worker · push-send · queue-enqueue/dispatcher · create-checkout · stripe-webhook
SECRETS  Stripe(LIVE)/OpenRouter/AUTOMATION_TOKEN/CHANNEL_WEBHOOK_*/META_* มีครบ · SMS/Grab/LINE MAN ยังไม่มี
         BMB_TEST_* (บัญชีทดสอบ) ยังค้างใน production secrets (W-1.6)
```

---
## 3. CORE SHOP STATUS

| Area | สถานะ | Evidence | ใช้จริงได้? | ติดอะไร | ประเภท gap |
|---|---|---|---|---|---|
| Web / PWA | ✅ DEPLOYED (ตรง main) | auto-build จาก push · biteme-baby.com = 200 | ได้ | — | — |
| Catalog / Menu | IMPLEMENTED + DEPLOYED | AdminProducts/MenuSchedule/Recipes; products_branch_overrides | ได้ | — | — |
| Order creation (SAME_DAY + PRE_ORDER) | RUNTIME VERIFIED (ระดับข้อมูลทดสอบ) | ออเดอร์ผ่าน `create_order_with_items` | ได้ | ยังไม่มีออเดอร์ลูกค้าจริง | evidence |
| Order lifecycle | IMPLEMENTED + PARTIAL RUNTIME | state machine + audit; delivered = 1 (PRE_ORDER); SAME_DAY delivered = 0 | ยังไม่พิสูจน์ครบ | ไม่มี SAME_DAY ที่ครบวงจร | evidence (W-2.2) |
| Payment — Stripe | ✅ LIVE keys ขึ้น EF แล้ว · card flow ครบ | 3a6cba3 + 438217a | รอพิสูจน์จริง | **register live webhook + live acceptance (W-2.1/W-2.2)** | Owner/external |
| Payment — PromptPay | IMPLEMENTED | intents มีจริง | ต้องตรวจ flow ยืนยันรับเงิน | reconcile manual | software/ops |
| Kitchen | IMPLEMENTED + DEPLOYED | AdminKitchen, production batching (027) | ได้ | ยังไม่มี runtime ของออเดอร์จริง | evidence |
| Dispatch (Bite Drive) | ✅ IMPLEMENTED + RUNTIME | drivers 5, zones 6, rounds 26 · **GAP A-1 ปิดแล้ว (migration 116 + DeliveryManagement override)** | ได้ | — | — |
| Delivery (Bite Drive) | IMPLEMENTED | RiderPWA (geofence 300 ม.), 036 driver→order sync | ได้ (แบบ self) | มี delivered จริงแค่ 1 | evidence |
| Delivery (ไรเดอร์ภายนอก) | IMPLEMENTED (adapter) · **NOT CONNECTED** | provider_orders = 0; ไม่มี secret | **ไม่ได้** | ไม่มี contract/API key; adapter ยังอยู่ฝั่ง client | **EXTERNAL** (W-3.1 ก่อนใส่ key) |
| Tracking | IMPLEMENTED | OrderTrackPage, OrdersPage | ได้ (เฉพาะสถานะในระบบ) | ไม่มี tracking ของไรเดอร์ภายนอก | depends on rider API |
| Notifications | in-app ✅ + Web Push (config/auth) ✅ | notification_dispatch succeeded · push-send probe 17/17 | in-app เท่านั้น (จริง) | push เครื่องจริงยังไม่ทดสอบ · SMS ไม่มี provider | external credential (W-2.3) |
| Failure handling | RUNTIME VERIFIED (automation) | G8 queue/retry; orders_stale_pending | ได้ | — | — |
| Channel intake (FB/Messenger → ออเดอร์) | ✅ **FIXED + RUNTIME VERIFIED** | migration 117 applied · `channelWebhookProbe` **15/15** (order intake + row tagged + duplicate idempotent + concurrent 1 order) · probe orders cancelled (active = 0) | ได้ (รอ real event จริงจาก G4) | — | — |

---

## 4. ADMIN-CONFIGURABILITY & WHITE-LABEL READINESS

### 4.1 ค่าที่ Owner ต้องการให้แอดมินปรับได้ — ✅ ปิดครบแล้ว (W-1.4/W-1.4b/W-1.4c, 114)

| ค่า | อยู่ที่ไหน (canonical) | แอดมินปรับได้? | หมายเหตุ |
|---|---|---|---|
| ระยะส่ง Bite Drive | `branches.service_radius_km` (override FC-3) · global = `delivery_policy.bite_drive_radius_km` · legacy `radius_km` RETIRED (114) | ✅ YES | `/admin/settings` (การ์ด Branch) → RPC บังคับทันที (probe C3/C4) |
| ค่าส่ง Bite Drive | `delivery_zones` (branch-scoped) · ไม่มี zone → `ERR_NO_DELIVERY_ZONE` | ✅ YES | การ์ด Delivery Zones (114) · probe B2 |
| markup 12% · free ship 300 · cutoff · quota | `delivery_policy.tier2_markup_pct` + `free_shipping_threshold` · `order_policy.cutoff_hours` + `daily_quota` (114) | ✅ YES | client hydrate ตอน boot · probe B1/C7/C8 |
| สวิต์ SAME_DAY + เลือกวิธีส่ง | `operating_hours.same_day_open` + `allow_external_within_radius`/`external_methods_enabled` (112) · `bite_drive_enabled` (114, gate `ERR_BITE_DRIVE_DISABLED`) | ✅ YES | probe C11/C5b/C6 · w14 T2/T5/T6 |
| รอบส่ง / zones | `delivery_rounds` / `delivery_zones` (branch_id) | YES | AdminRounds + zones card |
| เวลาทำการ / order policy | `business_settings` | YES | AdminSettings |
| ไรเดอร์ภายนอกที่เปิดใช้ | `delivery_policy.external_methods_enabled` | ✅ YES (112) | ยังไม่มี provider เปิดจริง (รอ key D-04) |
| แบรนด์ / ธีม glass | `brands.display_name` + `theme_tokens.glass` (114) · GlassCard อ่าน hydrated | ✅ YES (114) | การ์ด Brand · probe B3 |
| สาขา (รัศมี/เวลา) | `branches.service_radius_km` + `operating_hours` | ✅ YES (114) | การ์ด Branch · probe B4 |
| เปิด/ปิดรับออเดอร์ (mode) | `operating_hours.same_day_open` / `pre_order_open` / `round_open.*` | ✅ YES | trigger `enforce_operating_hours` (probe C5b) |

คงเหลือ (non-blocker): settings UI แบบ form สำหรับ JSON ซับซ้อน (แก้ผ่าน JSON editor ได้) — W-5.4

### 4.2 White-label / multi-branch

| หัวข้อ | สถานะ |
|---|---|
| Schema (tenant_id/brand_id/branch_id, RLS tenant-scoped) | IMPLEMENTED + RUNTIME VERIFIED (G3/G6 isolation probes) |
| Routing ออเดอร์ตามสาขา (TEN-07) | IMPLEMENTED |
| รองรับหลาย tenant บน runtime จริง | **NOT PROVEN** — production มีแค่ 1 tenant (W-5.1) |
| ค่า SEO/โดเมนต่อ tenant | ✅ โดเมนหลักถูกต้องทั้ง repo (W-1.3) · ต่อ tenant ยังทำไม่ได้ (W-5.2) |
| Onboarding ร้านใหม่ | ยังไม่มีหลักฐาน runtime (W-5.3) |

---
## 5. EXTERNAL DEPENDENCIES

### 5.1 Rider / ไรเดอร์ภายนอก

| หัวข้อ | สถานะ |
|---|---|
| Provider ที่รองรับ | Grab (`grab_rider`), LINE MAN (`linemen_rider`), Foodpanda (`foodpanda_rider`, Owner ไม่ใช้) + Bite Drive (`self_delivery`) · **Bolt ยังไม่มี adapter** |
| Code | IMPLEMENTED — `src/lib/providers/{grab,lineman,foodpanda,biteDrive}.ts` + registry; Grab มี OAuth/quote/dispatch ต่อ endpoint จริงไว้แล้ว |
| ตำแหน่งที่รัน | ⚠️ adapter ยังอยู่ **ฝั่ง client** ⇒ ต้องย้ายไป Edge Function (W-3.1) ก่อนใส่ key จริง |
| Credentials | MISSING — ไม่มีใน Supabase secrets |
| Production connection | NOT CONNECTED — `provider_orders = 0` |
| Blocker ที่แท้จริง | (1) **EXTERNAL**: สัญญา/API key (Grab ทำเรื่องแล้ว) (2) **SOFTWARE**: ย้าย adapter ไป server + webhook รับสถานะ |

### 5.2 Facebook / Meta — สถานะล่าสุด 2026-10-06

| หัวข้อ | สถานะ |
|---|---|
| แอป Meta | ✅ แอปใหม่ `1737887467512190` **LIVE** (แอปเดิมถูกลบระหว่าง flow) — scope ครบรวม `pages_manage_posts` (debug_token ยืนยัน) |
| Page token | ✅ long-lived `expires=never` · อยู่ใน EF secrets + `.env.local` (mirrored) |
| Page binding | RUNTIME VERIFIED — page `862940416913026` → tenant-bmb-001 (FACEBOOK + MESSENGER) |
| Publish (reply/post) | ✅ **RUNTIME VERIFIED จริง** — social-publish-worker deployed · negative probe 5/5 · g9PublishJourney 6/6 (โพสต์จริง 2 + replay idempotent + audit) · **เปิดตาม G9 ที่ Owner อนุมัติแล้ว** · โพสต์ทดสอบ 3 รายการรอ Owner ลบ |
| Webhook receive (G4 feed) | ⚠️ **HOLD — EXTERNAL (Meta lock ชั่วคราว)** · root cause ยืนยันแล้ว: Development mode ส่ง webhook เฉพาะ user ที่มี role ใน `GET /{app}/roles` (BM access/page role ไม่นับ) · **Meta ปิดสร้าง Test User + ล็อกการ add role ชั่วคราว** (roles = administrators เท่านั้น) · **ชดเชยแล้ว: simulated delivery ผ่าน endpoint ตรง = `g4SimulatedDelivery` 9/9** (Messenger postback + order message + FB feed comment + duplicate idempotent → social_events + orders + identities ครบ) |
| สิ่งที่ Owner ต้องทำ (G4) | **เมื่อ Meta ปลดล็อก:** add Pual เป็น **Tester** บน app-roles/ (Pual ติดสิทธิ์ Admin ครบอยู่แล้ว — Meta ล็อกไม่ให้เพิ่มบทบาทซ้ำ) → Pual คอมเมนต์/DM ใหม่ → รัน `node e2e/g4CheckRealEvents.cjs` (ยืนยันแล้วว่า script + intake→DB ทำงานถูกต้องกับ simulated rows) |
| Messenger receive (G4) | intake path ผ่าน simulated delivery แล้ว (postback + order message) · เหลือ real DM: re-issue token w/ `pages_messaging` → subscribe `messages`,`message_deliveries` → Pual DM → verify |
| ทำต่อได้โดยไม่รอ Meta | — (ที่ทำได้ทำแล้วหมด — simulated delivery ครอบคลุม receive path ทั้งหมด) |

### 5.3 อื่น ๆ

| Dependency | สถานะ |
|---|---|
| Stripe | ✅ LIVE keys ขึ้น EF (3a6cba3) · card flow Stripe.js (438217a) · ⚠️ **register live webhook + live acceptance ยังค้าง** |
| Web Push (notification) | ✅ migration 115 + EF push-send deployed · probe 17/17 · ⚠️ เครื่องจริงยังไม่ทดสอบ |
| SMS | MISSING — ไม่มี provider/credentials (schema เผื่อแล้ว `notification_prefs.sms_enabled`) |
| OpenRouter (AI) | CONNECTED (G5 PASS) |
| โดเมน | ✅ CONNECTED |

---

## 6. AI AUTOMATION — GATE STATUS

| Gate | IMPL | CONNECTED | DEPLOYED | RUNTIME VERIFIED | สถานะ | Evidence |
|---|---|---|---|---|---|---|
| G3 Social Events | ✅ | ✅ | ✅ | ✅ (isolated + prod probes) | **PASS** | BMB_G3_FINAL_REPORT.md |
| G4 Meta Security (receive) | ✅ | ⏳ binding ✅ / handshake ❌ | ✅ v11 | negative ✅ / real event ❌ | **HOLD — EXTERNAL (รอ Owner: Tester role)** | BMB_G4_PRODUCTION_CONNECTION_REPORT.md |
| G5 AI Routing | ✅ | ✅ | ✅ ai-proxy v19 | ✅ 6/6 | **PASS** | BMB_G5_FINAL_REPORT.md |
| G6 Auto-reply | ✅ | ✅ | ✅ social-ai-worker v2 | ✅ classify/draft | **PASS (capability)** · real Meta E2E = BLOCKED โดย G4 | BMB_G6_FINAL_REPORT.md |
| G7 Auto-post | ✅ | ✅ | ✅ social-post-worker v3 | ✅ | **COMPLETE** | BMB_G7_FINAL_REPORT.md |
| G8 Retry/Failure | ✅ | ✅ | ✅ queue-enqueue/dispatcher | ✅ 43/43 succeeded | **PASS** | BMB_G8_S5_FINAL_REPORT.md |
| G9 Social AI E2E | ✅ | ✅ | ✅ social-publish-worker | ✅ journey 11 stages · failure matrix 12/12 · publish จริง 6/6 | ✅ **CLOSED — PASS (Owner อนุมัติ 2026-10-06)** | BMB_G9_FINAL_REPORT.md |
| G10 True Production Closure | — | — | — | — | **NOT STARTED** (หลัง G4) | — |

ห้าม rerun: G3 · G5 · G6 · G7 · G8 · G8-S5 · G9 (ที่ปิดแล้ว)

---
## 7. CHANNEL-INTAKE DRIFT + FIX (ค้นพบ 2026-10-06 — งานใหม่รอบนี้)

**ปัญหา (ยืนยันจาก production ด้วย READ-ONLY probe `e2e/intakeDriftProbe.cjs`):**
- `create_order_with_items` บน production = **15-param signature จบที่ `p_branch_id`** — migration 089 (branch) เขียนทับ entry **หลัง** 048/049 ทำให้ trusted-channel wrapper (16→17-param + `p_customer_ref` service path) หายไป
- ผลกระทบ: EF `channel-webhook` ยิง `p_source_channel`/`p_external_ref_id`/`p_customer_ref` → RPC ไม่รับ → ออเดอร์จาก channel **ไม่มี channel tag ระดับ RPC, ไม่มี duplicate guard, service-role path ล่ม** (146 orders ที่มี channel มาจาก trigger stamp เท่านั้น)
- ส่วนที่ยังครบ: `create_order_with_items_core` (048/104 shape) · trigger `trg_orders_stamp_source_channel` · index `uq_orders_channel_extref` · columns

**ทางแก้ — ✅ APPLIED + VERIFIED (Owner อนุมัติ 2026-10-06):**
- **migration 117** `supabase/migrations/117_channel_intake_repair.sql` — single signature **18-param** (15 ของ 089 + `p_source_channel`/`p_external_ref_id`/`p_customer_ref`, defaults NULL → PWA/MANUAL เดิมไม่พัง) · body = 089 verbatim + 048 semantics (auth service_role-only สำหรับ customer_ref · channel regex · ext_ref ≤128 · duplicate guard ตั้งแต่ต้น + unique_violation recovery) · ตรวจแล้ว `e2e/intake117Verify.cjs` = เพี้ยนจาก 089 เฉพาะ 4 จุดที่ตั้งใจ
- **Apply ผ่าน Management API (2026-10-06) — HTTP 201** · `intakeDriftProbe` = **INTAKE SIGNATURE: OK** (single 18-param)
- **`channelWebhookProbe` = PASS 15/15** — messenger order intake ผ่าน RPC ใหม่ (BMB-20261006-154) · **row-tagged** (channel + external_ref_id ใน row จริง) · **duplicate idempotent** · **concurrent 2 → 1 order** · ไม่มี secret leak
- Probe fix ที่ค้นพบระหว่างทาง: setup เลือก round fallback อาจได้ round เก่า/cutoff ผ่าน → แก้ให้เลือก round วันนี้ที่ cutoff ยังไม่ผ่าน และ upsert test round (cutoff 23:59) ถ้าไม่มี
- **Hygiene (D-02):** ออเดอร์ทดสอบของ probe ถูกยกเลิกด้วย canonical `cancel_order` (`BMB-20261006-154`, `-798`) — **active = 0** (`e2e/intakeProbeCleanup.cjs`)
- replay manifest อัปเดตแล้ว · ⚠️ CLI history ยังล้าหลัง 106–116 (apply ผ่าน Management API ตาม precedent) — ห้าม `db push --include-all` จนกว่าจะ reconcile history

---

## 8. MASTER GAP MATRIX

| Area | Current Status | Evidence | Real Blocker? | Dependency | Next Action |
|---|---|---|---|---|---|
| Core Web | ✅ DEPLOYED (ตรง main) | auto-build จาก push | NO | — | — |
| Domain | ✅ CONNECTED | biteme-baby.com = 200 SSL | NO | — | — |
| Order | RUNTIME VERIFIED (test) | ออเดอร์ทดสอบครบ lifecycle เดี่ยว | NO | — | W-2.2 live acceptance |
| Payment | LIVE keys ขึ้น EF · card flow ครบ | 3a6cba3/438217a | **YES** (รับเงินจริงยังไม่พิสูจน์) | Owner: register live webhook | W-2.1/W-2.2 |
| Kitchen / Dispatch | IMPLEMENTED + RUNTIME (A-1 ปิด) | migration 116 | NO | — | ตรวจใน W-2.2 |
| Admin configurability | ✅ DONE ครบ | 112/113/114 + hydrate | NO | — | W-5.4 (form UI, non-blocker) |
| Channel intake | ✅ FIXED — migration 117 applied + probe 15/15 | channelWebhookProbe | NO | — | — |
| External Rider API | NOT CONNECTED | provider_orders 0 | NO สำหรับร้าน (≤5 กม. ใช้ Bite Drive) | **EXTERNAL**: Grab/LINE MAN key + ย้าย adapter | W-3.1→W-3.3 · Bolt = W-3.4 |
| Notifications | in-app ✅ · push config ✅ · SMS ⬜ | push-send probe 17/17 | NO (soft) | push เครื่องจริง · SMS credential | W-2.3 |
| Test data hygiene | ✅ RESOLVED | active = 0 (D-02) | NO | — | ลบโพสต์ทดสอบบนเพจ (Owner) |
| Facebook/Meta | G4 HOLD — EXTERNAL (Meta ปิด Test User + ล็อก add role ชั่วคราว) | roles = admins เท่านั้น · **simulated delivery 9/9 ชดเชยแล้ว** | YES เมื่อ Meta ปลดล็อก | Owner: add Pual Tester เมื่อปลดล็อก | W-4.2/W-4.3 |
| G3/G5/G6/G7/G8 | ✅ PASS/COMPLETE — ห้ามทำซ้ำ | reports | NO | — | — |
| G9 | ✅ **CLOSED — PASS (Owner อนุมัติ 2026-10-06)** | BMB_G9_FINAL_REPORT.md | NO | — | ห้าม rerun |
| G10 | NOT STARTED | — | — | G4 + Phase 1 | W-4.4 ท้ายสุด |

---

## 9. โดเมน biteme-baby.com — ✅ RESOLVED

CONNECTED แล้วทั้งระบบ: NS Cloudflare (carlane/eoin) · apex + www = 200 SSL Active · canonical/OG/robots/sitemap = โดเมนใหม่ทั้งหมด (W-1.3) · deploy = auto-build จาก push `main` (W-1.1) · Meta domain verification: แท็กอยู่บนเว็บแล้ว — Owner กด Verify ใน Meta ได้ตามสะดวก (W-4.2)

---

## 10. OWNER DECISIONS — RESOLVED (มติเดิม 2026-10-05 ยังใช้ได้ทั้งหมด)

| ID | คำถาม | มติ | สถานะปัจจุบัน |
|---|---|---|---|
| D-01 | Bite Drive ใช้กับ SAME_DAY? | ใช้ทั้งคู่ — PRE_ORDER เป็นหลัก; SAME_DAY ต้องมีสวิต์ + เลือกวิธีส่ง | ✅ DONE (112/114 + trigger) |
| D-02 | ออเดอร์ทดสอบ? | ยกเลิกแล้วทดสอบใหม่ | ✅ DONE (W-1.2 — active=0) |
| D-03 | ลำดับ G4/G9? | G9 ส่วนไม่ใช้ Meta ทำก่อน | ✅ DONE (G9 CLOSED 2026-10-06; เหลือ G4) |
| D-04 | ไรเดอร์ภายนอก? | Grab หลัก → LINE MAN รอง → Bolt กำลังทำเรื่อง | ⏳ EXTERNAL + Bolt adapter ยังไม่มี (W-3.4) |
| D-05 | แจ้งเตือน? | SMS + web notification ของเว็บเอง | in-app ✅ · push config ✅ (เครื่องจริงค้าง) · SMS ⬜ |
| D-06 | อนุมัติ deploy? | อนุมัติ (เว็บ + channel-webhook) | ✅ DONE (W-1.1/W-1.5) |

---
## 11. MASTER WORK LIST (สถานะจริง ณ 2026-10-06)

### PHASE 0 — เว็บ/โดเมน/ค่าปกครอง — ✅ ปิดครบ

| # | งาน | สถานะ | Evidence |
|---|---|---|---|
| W-1.1 | Deploy Cloudflare Pages | ✅ DONE 2026-10-05 | auto-build จาก push `main` (source=github) · biteme-baby.com = 200 |
| W-1.2 | ยกเลิกออเดอร์ทดสอบ (D-02) | ✅ DONE 2026-10-05 | active = 0 · trigger ครบ 11 ตัว |
| W-1.3 | แก้โดเมนในโค้ด | ✅ DONE 2026-10-05 | เหลือโดเมนเก่า = 0 · TSC=0 · LINT=0 · BUILD=0 |
| W-1.4(+b/c) | Admin configurability | ✅ DONE 2026-10-05 | migration 112/113/114 + platformConfigBootstrap · HARD STOP ปิดครบ · w14 probe PASS |
| W-1.5 | redeploy channel-webhook (ข้อความไทย) | ✅ DONE 2026-10-05 | v11 ACTIVE |
| W-1.6 | ลบ `BMB_TEST_*` ออกจาก production secrets | ⬜ OPEN (security) | secrets list สะอาด |

### PHASE 1 — เปิดร้านรับเงินจริง

| # | งาน | สถานะ | ใครทำ |
|---|---|---|---|
| W-2.1 | Stripe LIVE: keys ✅ (3a6cba3) · card flow ✅ (438217a) — **เหลือ register live webhook** | ⏳ ค้าง webhook | Owner + AI DEV |
| W-2.2 | Live acceptance: สั่งจริง → ครัว → Bite Drive → delivered → refund | ⬜ หลัง W-2.1 | Owner จ่าย + AI DEV ตรวจ |
| W-2.3 | แจ้งเตือน: SMS (D-05) — **Web Push ส่วน config/auth เสร็จ (115 + push-send)** เหลือทดสอบเครื่องจริง | ⏳ SMS รอ credential | Owner (SMS) + AI DEV |
| W-2.4 | เปิดร้านจริง (ประกาศ Open Shop) | ⬜ หลังข้อ 1–3 ผ่าน | Owner |

### PHASE 2 — ไรเดอร์ภายนอก (D-04)

| # | งาน | สถานะ |
|---|---|---|
| W-3.1 | ย้าย adapter → Edge Function + secret ฝั่ง server + webhook สถานะ | ⬜ ต้องทำก่อนใส่ key จริง |
| W-3.2 | Grab (หลัก): รอ API → ต่อ key → E2E | ⏳ EXTERNAL |
| W-3.3 | LINE MAN (รอง) | ⏳ EXTERNAL |
| W-3.4 | Bolt: เขียน adapter ใหม่ (โค้ดยังไม่มี) | ⬜ OPEN (software) |
| W-3.5 | foodpanda adapter: ปิด/defer | ตัดสินใจภายหลัง |

### PHASE 3 — Social AI

| # | งาน | สถานะ |
|---|---|---|
| W-4.1 | G9 ส่วนไม่ใช้ Meta | ✅ DONE — G9 CLOSED (Owner อนุมัติ 2026-10-06) |
| W-4.2 | Owner: Meta Verify & Save + domain verification ใน Meta | ⬜ EXTERNAL — Owner กดได้เลย |
| W-4.3 | G4 real event (feed → messenger) → G9 REAL EVENT ปิดสมบูรณ์ | ⬜ รอ Owner 3 ขั้น (ดู §5.2) |
| W-4.4 | G10 TRUE PRODUCTION CLOSURE | ⬜ ท้ายสุด |
| (ใหม่) | **migration 117 channel-intake repair** | ✅ **DONE 2026-10-06** — applied (Owner อนุมัติ) + probe 15/15 + test orders cancelled (ดู §7) |

### PHASE 4 — White-label hardening

| # | งาน |
|---|---|
| W-5.1 | runtime test ด้วย tenant 2 + สาขา 2 จริง |
| W-5.2 | SEO/domain/theme ต่อ tenant |
| W-5.3 | onboarding ร้านใหม่ครบจากหน้าแอดมิน |
| W-5.4 | Settings UI แบบ form (แทน JSON ดิบ) |

### DEFERRED (Owner ตั้งใจเลื่อน)
D4-3 timestamp freshness · D4-4 mention parser · `social_post_draft` (RESERVED) · physical delivery automation · cleanup `bmb/` stale copy · Lighthouse ≥ 90 (W-14)

### ALREADY CLOSED — ห้ามทำซ้ำ / ห้าม reopen
G3 · G5 · G6 (capability) · G7 · G8 (+S5) · G9 (2026-10-06) · G9 contract draft · mojibake fix · Stripe webhook TEST 6/6 + refund · RLS hardening WAVE 3 · migration drift 104–111 · deploy pipeline (W-1.1) · โดเมน (W-1.3) · admin configurability (W-1.4)

---

## 12. "ถ้าวันนี้จะเปิดให้ลูกค้าสั่งอาหารจริง BMB ขาดอะไร?"

1. **รับเงินจริงยังไม่พิสูจน์** — Stripe LIVE ขึ้น EF แล้วแต่ยังไม่ register live webhook + ยังไม่มี live acceptance (W-2.1/W-2.2)
2. **ไม่มีออเดอร์ลูกค้าจริงครบวงจร** (สั่ง → จ่าย → ครัว → ส่ง → delivered) — W-2.2
3. **SMS ยังไม่มี provider** (D-05) + **push เครื่องจริงยังไม่ทดสอบ**
4. ไม่ขวาง: G4/Meta (รับ event จาก channel) — ใช้เว็บ/PWA สั่งได้โดยไม่ต้องรอ
5. ไม่ขวาง: ไรเดอร์ภายนอก (≤5 กม. ใช้ Bite Drive ได้) · white-label tenant 2 (ขายแพลตฟอร์มค่อยว่ากัน)

---

## 13. NEXT REQUIRED ACTION

**ทำขนานกันได้ 3 ทาง:**
1. **Owner (G4):** รอ Meta ปลดล็อก → add Pual เป็น **Tester** บน app-roles/ → Pual คอมเมนต์/DM ใหม่ → รัน `node e2e/g4CheckRealEvents.cjs` (หมายเหตุ: Meta ปิดสร้าง Test User + ล็อก add role ชั่วคราว — ชดเชยด้วย simulated delivery 9/9 แล้ว ดู §5.1)
2. **Owner (Stripe):** รอบัญชีผ่าน Review (2–3 วัน) → register live webhook → live acceptance (W-2.1/W-2.2)
3. **AI DEV:** gates (TSC0/LINT0/VITEST/BUILD) → commit+push งานรอบนี้ (migration 117 + probes + env merge) — กำลังทำ

---

## 14. STATUS รวมย่อ (แทน EXEC LOG เดิมทั้งหมด)

- 2026-10-05: W-1.1..W-1.5 ปิด · G9 ส่วน non-Meta ทำได้ (D-03) · โดเมน + deploy pipeline พร้อม
- 2026-10-06: G9 CLOSED (Owner อนุมัติ PASS — journey 11 stages · failure matrix 12/12 · publish จริง 6/6 · gates TSC0/LINT0/VITEST 522/BUILD0) · Meta app#2 ใหม่ LIVE + page token long-lived · push 115 + EF push-send deployed (probe 17/17) · card flow Stripe.js LIVE · GAP A-1 ปิด (116) · **ค้นพบ channel-intake drift → migration 117 authored → Owner อนุมัติ → APPLIED + VERIFIED (probe 15/15, test orders cancelled)** · โพสต์ทดสอบบนเพจ Owner ลบแล้ว · **G4: Meta ปิด Test User + ล็อก add role ชั่วคราว → ชดเชยด้วย simulated delivery `g4SimulatedDelivery` 9/9** (postback + order + comment + duplicate → DB ครบ · g4CheckRealEvents เห็น rows) · **Stripe: บัญชี Review in progress 2–3 วัน — LIVE รออนุมัติ**
- **ค้างทั้งหมด:** G4 real event (รอ Meta ปลดล็อก) · Stripe review → live webhook + acceptance · push เครื่องจริง · SMS · Bolt adapter · W-1.6 test secrets · G10