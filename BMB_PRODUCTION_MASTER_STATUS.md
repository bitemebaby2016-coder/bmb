# BMB — PRODUCTION MASTER STATUS (เอกสารหลัก — เขียนทับฉบับ 2026-10-06)

**ประเภทเอกสาร:** STATUS / RECONCILIATION + MASTER WORK LIST — สะท้อนสถานะโค้ดจริง ณ วันที่อัปเดต (เขียนทับ ไม่ต่อท้าย)
**วันที่อัปเดต:** 2026-10-07 (รอบ 8 — migration 118 APPLIED + Meta token long-lived + SMS ไปเบอร์ Owner) · **Baseline:** HEAD == origin/main == `3094c5d` (docs: master status round 7)
**รอบนี้ (2026-10-07 รอบ 8):** IMPLEMENTATION = YES (build-script fix เท่านั้น) · MIGRATION = **YES — `118_restore_fc_gates_after_117.sql` APPLIED บน production + recorded (118/118)** · DEPLOYMENT = NO (แตะเฉพาะ secrets) · PRODUCTION MUTATION = YES (apply 118 ตาม Owner approval · set secrets `META_PAGE_ACCESS_TOKEN` เป็น long-lived + `SMS_*` · ส่ง SMS ทดสอบไปเบอร์ Owner (`094***9269` รอบแรก → Owner แจ้งไม่ได้รับ → **ส่งใหม่ `082***8546` รอบ 8b ผ่าน EF + THSMS ตรง**))
**สถานะ Stripe:** **ยังไม่อนุมัติ** — ภาพ dashboard 2026-10-07 = "Paused soon" (Payments) + 2 tasks In review → W-2.1/W-2.2 ค้างต่อ · LIVE webhook register เมื่อบัญชีผ่าน (W-2.1)
**งานที่ยังไม่ commit ใน repo (รอบ 8):** docs (master status รอบ 8 · `BMB_G10_FINAL_REPORT.md` · `BMB_G10_DEFECT_117_FC_ROLLBACK.md` · handoff) · `118_restore_fc_gates_after_117.sql` (regenerated — เติม `;` ปิดฟังก์ชัน) · `m118BuildFromLive.cjs` (tail fix) · e2e scripts ใหม่ (`fcApply118` `m118StateProbe` `metaTokenDiag` `metaPageTokenExtend` `migHistory` `smsPhoneLookup` `w23SmsSendOwner` `whoIs`) — commit หลัง gates ผ่านตามกฏ

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
| Webhook receive (G4 feed) | ✅ **CLOSED (Owner ยอมรับ 100% จาก simulated delivery 2026-10-06)** — `g4SimulatedDelivery` **9/9** (Messenger postback + order message + FB feed comment + duplicate idempotent → social_events + orders + identities ครบ) · real event เลื่อนไว้ในอนาคต (Meta ปิด Test User + ล็อก add role ชั่วคราว — ไม่ block อีกต่อไป) | simulated (Owner-approved) |
| สิ่งที่ Owner ต้องทำ (G4) | — (ย้ายไป backlog อนาคต) เมื่อ Meta ปลดล็อก: add Pual เป็น Tester → Pual คอมเมนต์/DM จริง → รัน `node e2e/g4CheckRealEvents.cjs` (script ยืนยันทำงานถูกต้องแล้ว) |
| Messenger receive (G4) | intake path ผ่าน simulated delivery แล้ว (postback + order message) · real DM ค้างเฉพาะ token `pages_messaging` (backlog อนาคต) |
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
| G10 | ⏳ **IN PROGRESS — verification รอบ 2026-10-07** · พบ **defect 117 clobber FC** (112/114) → 118 authored PENDING · evidence pack = `BMB_G10_FINAL_REPORT.md` (**NOT CLOSED**) | g10 snapshot + probes + gates | YES (defect จริง) | Owner อนุมัติ 118 · page token · SMS เข้าเครื่อง · Stripe | W-4.4 |

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
| W-1.6 | ลบ `BMB_TEST_*` ออกจาก production secrets | ✅ **DONE 2026-10-06** — verified clean: 22 secrets ทั้งหมดจำเป็น (Stripe/Meta/Channel/VAPID/automation) ไม่มี BMB_TEST_* หลงเหลือ (`e2e/w16TestSecretsClean.cjs`) |

### PHASE 1 — เปิดร้านรับเงินจริง

| # | งาน | สถานะ | ใครทำ |
|---|---|---|---|
| W-2.1 | Stripe LIVE: keys ✅ (3a6cba3) · card flow ✅ (438217a) — **เหลือ register live webhook** | ⏳ ค้าง webhook | Owner + AI DEV |
| W-2.2 | Live acceptance: สั่งจริง → ครัว → Bite Drive → delivered → refund | ⬜ หลัง W-2.1 | Owner จ่าย + AI DEV ตรวจ |
| W-2.3 | แจ้งเตือน: SMS — ✅ **LIVE + DELIVERED (thsms.org, 2026-10-07)**: secrets 6/6 (`SMS_PROVIDER=thsms_org` · `SMS_API_URL=https://api.thsms.org/v1/sms/send` · `SMS_API_KEY` · `SMS_SENDER_NAME=SMSOTP` · `SMS_MESSAGE_TYPE=standard`) · EF deploy ผ่าน CLI · **`w23SmsProbe` 3/3** · **`credits_used:1`/ข้อความ** (`standard`; `express`=2 · `superfast`=3) | ✅ **Owner ยืนยัน SMS เข้าเครื่องจริงทั้ง 3 เบอร์ (2026-10-07)** — W-2.3 DELIVERY CONFIRMED |
| W-2.4 | เปิดร้านจริง (ประกาศ Open Shop) | ⬜ หลังข้อ 1–3 ผ่าน | Owner |
| A-1 | แอดมิน: เพิ่มรูป/แก้ไข/สร้างรอบส่ง — ✅ **แก้ครบ + ผ่านจริง (2026-10-07)**: Migration **119** APPLIED+VERIFIED (storage policy `bucket_id='bmb-images'` แทน subquery `storage.buckets` ที่ RLS ซ่อน) + `createDeliveryRound` ใส่ `branch_id` (RLS `is_branch_admin`) · **ADMIN_CRUD 20/20 PASS** (categories/products/menu_sections/delivery_rounds/promotions/media_assets/storage upload) · M119 6/6 | ✅ **Owner ยืนยัน: แมสเสจ SMS ผ่าน · เพิ่มรูปเมนูผ่าน** · ⏳ ขนส่งยังไม่ได้ลองใน UI | AI DEV |

### PHASE 2 — ไรเดอร์ภายนอก (D-04)

| # | งาน | สถานะ |
|---|---|---|
| W-3.1 | ย้าย adapter → Edge Function + secret ฝั่ง server + webhook สถานะ | ⬜ ต้องทำก่อนใส่ key จริง |
| W-3.2 | Grab (หลัก): รอ API → ต่อ key → E2E | ⏳ EXTERNAL |
| W-3.3 | LINE MAN (รอง) | ⏳ EXTERNAL |
| W-3.4 | Bolt: เขียน adapter ใหม่ | ❌ **ตัดออก (Owner decision 2026-10-06: ไม่ใช้ Bolt แล้ว)** — Grab/LINE MAN sandbox + Bite Drive เพียงพอ |
| W-3.5 | foodpanda adapter: ปิด/defer | ตัดสินใจภายหลัง |

### PHASE 3 — Social AI

| # | งาน | สถานะ |
|---|---|---|
| W-4.1 | G9 ส่วนไม่ใช้ Meta | ✅ DONE — G9 CLOSED (Owner อนุมัติ 2026-10-06) |
| W-4.2 | Owner: Meta Verify & Save + domain verification ใน Meta | ⬜ EXTERNAL — Owner กดได้เลย |
| W-4.3 | G4 real event (feed → messenger) → G9 REAL EVENT ปิดสมบูรณ์ | ⬜ รอ Owner 3 ขั้น (ดู §5.2) |
| W-4.4 | G10 TRUE PRODUCTION CLOSURE | ⏳ IN PROGRESS — evidence pack แล้ว (`BMB_G10_FINAL_REPORT.md`) · **NOT CLOSED** — รอ Owner: อนุมัติ apply 118 · exchange page token · ยืนยัน SMS เข้าเครื่อง · Stripe review |
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

**ทำขนานกันได้:**
1. **Owner (ด่วน — 2026-10-07):** (ก) **อนุมัติ apply migration 118** (FC rollback defect — `BMB_G10_DEFECT_117_FC_ROLLBACK.md` §5) (ข) **exchange Page token ใหม่** — ตัวปัจจุบันหมดอายุ 2026-10-07 01:00 UTC (`node e2e/metaTokenExchange.cjs exchange` หรือ Owner สร้างใหม่ → set secret ด้วย `e2e/w23SetSmsSecrets.cjs` ส่วน META_PAGE_ACCESS_TOKEN) (ค) ยืนยันว่าได้รับ SMS ทดสอบ (`[W-2.3 TEST]...` → `090***1544`) → ปิด W-2.3
2. **Owner (G4):** รอ Meta ปลดล็อก → add Pual เป็น Tester → รัน `node e2e/g4CheckRealEvents.cjs` (เดิม — simulated 9/9 ชดเชยแล้ว)
3. **Owner (Stripe):** รอบัญชีผ่าน review (ยังไม่อนุมัติ — Paused soon/In review) → register live webhook → live acceptance (W-2.1/W-2.2)
4. **AI DEV:** **HARD STOP** — รอ Owner ข้อ 1–3 (รอบ 7 ทำหมดแล้ว: SMS runtime verified · page token secrets + scope ✓ · G10 evidence pack ✓ · 118 authored + 16/16 ✓)
5. **Owner/AI DEV (backup):** ✅ ทำงานได้แล้ว (2026-10-06): `node e2e\dbBackup.cjs` → `e2e\dbDump.cmd` (dump จริง 3 ไฟล์ × 4.67 MB · `SUPABASE_DB_URL` เก่า = stale ห้ามใช้ ใช้ `BMB_DB_PASSWORD`) · Free plan ไม่มี auto backup — dump รายสัปดาห์หรืออัปเกรด Pro (ดู §13 เดิม)

---

## 14. STATUS รวมย่อ (แทน EXEC LOG เดิมทั้งหมด)

- 2026-10-05: W-1.1..W-1.5 ปิด · G9 ส่วน non-Meta ทำได้ (D-03) · โดเมน + deploy pipeline พร้อม
- 2026-10-06: G9 CLOSED (Owner อนุมัติ PASS — journey 11 stages · failure matrix 12/12 · publish จริง 6/6 · gates TSC0/LINT0/VITEST 522/BUILD0) · Meta app#2 ใหม่ LIVE + page token long-lived · push 115 + EF push-send deployed (probe 17/17) · card flow Stripe.js LIVE · GAP A-1 ปิด (116) · **ค้นพบ channel-intake drift → migration 117 authored → Owner อนุมัติ → APPLIED + VERIFIED (probe 15/15, test orders cancelled)** · โพสต์ทดสอบบนเพจ Owner ลบแล้ว · **G4: Meta ปิด Test User + ล็อก add role ชั่วคราว → ชดเชยด้วย simulated delivery `g4SimulatedDelivery` 9/9** (postback + order + comment + duplicate → DB ครบ · g4CheckRealEvents เห็น rows) · **Stripe: บัญชี Review in progress 2–3 วัน — LIVE รออนุมัติ**
- **ค้างทั้งหมด:** Stripe review → live webhook + acceptance · push เครื่องจริง · SMS credential · backup อัตโนมัติ (เครื่อง dev ไม่มี Docker/pg_dump — ดูตัวเลือกใน §13) · G10
- 2026-10-06 (รอบ 4): Owner สร้าง access token ใหม่ (`bmb-dev-2026-10` exp 05 Nov 2026) → **W-1.6 DONE** (secrets verified clean ไม่มี BMB_TEST_*) · **migration history RECONCILED 117/117** (เติม 035+104–117 หลัง verify objects จริงใน prod → `db push` ปลดล็อก) · **`sms-send` DEPLOYED + runtime verified** (W-2.3)
- 2026-10-06 (รอบ 6): **ADMIN FULL AUDIT + FIX** — สำรวจ 28 หน้า admin ครบ (`AdminNav` 26 items + BranchSwitcher; `AdminRoute` ตรวจ role จาก DB `profiles`/`is_admin()` ไม่ใช้ localStorage) · **พบ gap จริง: `/admin/pre-orders`, `/admin/kitchen`, `/admin/recipes` มี page + nav link แต่ไม่มี route (กดแล้ว unreachable) → เพิ่ม 3 routes ใน App.tsx** (commit `12640ab`) · gates หลังแก้: TSC 0 / VITEST 527/527 / BUILD 0 · **ส่วนที่ยังไม่สมบูรณ์ (ติด "รอ Owner" ทั้งหมด ตาม HARD STOP):** (ก) SMS key · Stripe live review · push เครื่องจริง · ไรเดอร์ภายนอก key (ข) Asset Registry รอ Owner decision → OG/hero/สติกเกอร์/ไอคอนหมวดเปลี่ยนผ่าน admin ไม่ได้ (build-time) · Brand routing flag OFF · AI Studio ตั้งเวลาโพสต์ = ไม่โพสต์อัตโนมัติ (G4 HOLD) · หน้า Brand & Assets รวมยังไม่มี · E2E admin session จริง (Test A–J) NOT VERIFIED (ค) white-label runtime 1/1/1 · pre-order ราคา = price×qty เท่านั้น
- **2026-10-07 (รอบ 7): G10 verification เริ่มจริง → ค้นพบ DEFECT: migration 117 clobber FC gates 112/114 ใน `create_order_with_items`** (`fcProdVerify` FAIL `rpc_fc1_fc5_live` · `fcVerify114` FAIL `create_fc1_branch_scoped_policy` · live def = FC markers หายหมด + hardcode `5.00` กลับมา + fee ไม่รับ branch — ทั้งหมดมีเฉพาะใน 114 เท่านั้น · live body == 117 file 225 บรรทัด — รายละเอียด `BMB_G10_DEFECT_117_FC_ROLLBACK.md`) → **migration 118 authored** (anchor-guarded: live/117 body + FC blocks verbatim จาก 114) + **`m118Verify` 16/16 ALL PASS — PENDING Owner approval, ห้าม apply** · **W-2.3 SMS = RUNTIME VERIFIED (THSMS)** — secrets ตั้ง (HTTP 201) · THSMS `/api/me` = success credit 10.00 · EF deploy ผ่าน CLI 2 ไฟล์ (Management API multipart = 400 ใช้ไม่ได้) · **`w23SmsProbe` 3/3** ส่งจริง `ok:true provider_status:200 to_masked=090***1544` · normalize `66xx→0xx` ทำงานจริง (+2 unit cases) · **Page token ใหม่ (USER token app#2, scope มี `pages_messaging`) set EF secret แล้ว + `metaTokenScopeCheck` ผ่านเพจ BmB 200 — ⚠️ หมดอายุ 2026-10-07 01:00 UTC ต้อง exchange ใหม่** (ผล `/me` = "P Jin Pao" = identity เจ้าของเพจ ไม่ใช่เพจผิด) · **Stripe = ยังไม่อนุมัติ** (Paused soon + 2 tasks In review ตามภาพ Owner) · gates: **TSC 0 / LINT 0 / VITEST 527/527 / BUILD 0** · reports: `BMB_G10_FINAL_REPORT.md` (NOT CLOSED) + `BMB_G10_DEFECT_117_FC_ROLLBACK.md`
- **ค้างใหม่ (HARD STOP รอ Owner):** ~~อนุมัติ apply 118~~ ✅ done · ~~exchange page token~~ ✅ done (long-lived) · **ยืนยัน SMS เข้าเครื่องจริงที่ `094***9269`** · (เดิม: Stripe review → live webhook + acceptance · push เครื่องจริง · Asset Registry · brand flag · G4 Meta)
- **2026-10-07 (รอบ 8): Owner อนุมัติ → ปิด 3 งานค้างรอบ 7** — (1) **migration 118 = APPLIED**: พบ build defect ตอน apply ครั้งแรก (`pg_get_functiondef` ไม่รวม `;` → `syntax error 42601 at REVOKE` LINE 280 · transaction rollback อัตโนมัติ prod ไม่ถูกแก้ ยืนยัน `m118StateProbe`) → แก้ `m118BuildFromLive.cjs` tail ขึ้นต้นด้วย `;` → regenerate + `m118Verify` 16/16 → `fcApply118` **APPLY118_OK** → `fcVerify114` **25/25** · `fcProdVerify` **9/9** (`no_active_orders`=0) · `intakeDriftProbe` **18-param OK** (ไม่ regress) · `migHistoryReconcile --write` → history **118/118** (2) **Meta page token = LONG-LIVED**: `fb_exchange_token` (grant_type) ด้วย page token → token ใหม่ type=PAGE **expires_at=0 (NEVER)** · app Bite Me Baby · scope มี `pages_messaging` · `/me`+เพจ `862940416913026`=200 · set secret (201) · `publishWorkerProbe` **5/5** · (user token ใน env ที่หมดอายุ → `metaTokenExchange` ล้ม step1 code190/467 = ไม่ใช้ ไม่ overwrite token ที่ไม่ verified) (3) **SMS ไปเบอร์ Owner `0942649269`**: `w23SmsSendOwner` (ตั้ง profiles.phone บัญชีทดสอบ `ae12e10b` ชั่วคราว→ส่ง→คืนค่าเดิมเสมอ) → **HTTP 200 · `ok:true` · `provider_status:200` · `to_masked=094***9269`** · **เหลือ Owner ยืนยันเข้าเครื่องจริง** · gates: **TSC 0 / LINT 0 / VITEST 527/527 / BUILD 0** · **G10 = ยัง NOT CLOSED** (Stripe + real payment + real shop acceptance ยังค้าง)
- **2026-10-07 (รอบ 8b): Owner แจ้ง SMS ไป `094***9269` ไม่ถึง → เปลี่ยนทดสอบเป็น `082***8546`** — ยืนยันจาก **code ตัวอย่างทางการ THSMS** (gist ที่ thsms.com ฝังในหน้า docs: `POST https://thsms.com/api/send-sms` + `Authorization: Bearer` + `{"sender":"...","msisdn":["089xxxxxxx"],"message":"..."}`) ว่า **รูปแบบเบอร์ที่ถูกต้อง = นำหน้าด้วย 0** (`089xxxxxxx`) → EF ส่ง `0826378546` ถูกต้องแล้ว · `thsmsDirectProbe` ยิงตรง 2 format (`082…`+`668…`) = **HTTP 200 `{"success":true,"code":200}` + หักเครดิตจริง** (`credit_usage:2`, remaining 10→3) · `w23SmsSendOwner 0826378546` ผ่าน EF = **HTTP 200 `ok:true provider_status:200 to_masked=082***8546`** · ผู้ใช้ THSMS=pual (bitemebaby2016@gmail.com) · **เหลือ Owner ยืนยันเข้าเครื่องจริง** · ไม่เปลี่ยน architecture
- **2026-10-07 (รอบ 8c): ปรับข้อความทดสอบให้สั้น ≤70 ตัวอักษร (Owner สั่ง — ให้กิน 1 เครดิต)** — `MSG='[W-2.3 TEST] Bite Me Baby SMS - safe to ignore'` (51 ตัวอักษร ASCII ล้วน) + assert `>70` throw ใน `w23SmsSendOwner`/`thsmsDirectProbe` · `thsmsDirectProbe 0826378546` → **`{"success":true,"code":200,"data":{"credit_usage":1,"remaining_credit":0}}`** = ยืนยัน **ข้อความ ≤70 กิน 1 เครดิตจริง** (ก่อนหน้าข้อความยาว ~90 ตัว กิน 2) · **⚠️ THSMS wallet credit หมด (0.00)** → ส่งต่อไม่ได้ · EF ตอนเครดิตหมด = **HTTP 502 / `provider_status:422`** (EF สะท้อนสถานะจริงจาก THSMS — ตอนมีเครดิต = 200) · **⚠️ Owner ระบุ 082+094 ถูกต้องทั้งคู่แต่ไม่ได้รับ → ข้อสงสัยปลายเหตุ: `SMS_SENDER_NAME="Direct SMS"` มีเว้นวรรค (alphanumeric Sender ID ปกติห้ามมีเว้นวรรค/ยาว ≤11) อาจทำให้ carrier ไม่รับ โดย THSMS ยังตอบ success** — **HARD STOP รอ Owner: (ก) เติมเครดิต THSMS (ข) ยืนยัน Sender Name ที่ลงทะเบียนจริง**
- **2026-10-07 (รอบ 8d): Owner ยืนยัน Sender Name + เติมเครดิต → ส่งซ้ำใหม่** — Owner ยืนยันในแผง THSMS: **`Direct SMS` = สาธารณะ / อนุญาตใช้งาน / ใช้งาน** → **ล้างข้อสงสัยเรื่องเว้นวรรค (sender ถูกต้อง)** · เติมเครดิตแล้ว → wallet **502.00** (`thsmsMe`) · ส่งใหม่ผ่าน EF ทั้ง **`082***8546` และ `094***9269`** = **HTTP 200 `ok:true provider_status:200`** (เบอร์ทดสอบคืนค่าเดิม `true`) · ข้อความสั้น ≤70 ตัว (`credit_usage:1`) · **เหลือ Owner ยืนยันรับ SMS จริง** — ถ้ายังไม่ถึงทั้งที่ sender ถูก + เครดิตพอ + format ตรง docs → แนะนำติดต่อ THSMS support (095-961-2240) พร้อมเวลา/เบอร์ปลายทาง
- **2026-10-07 (รอบ 8e): BRAINSTORM ปัญหา SMS ไม่ถึง (Owner สั่ง "ก่อนแก้ไข")** — เอกสารวิเคราะห์ครบ: **`BMB_W23_SMS_DELIVERY_DIAGNOSTIC.md`** · ข้อเท็จจริง E1–E10 (EF→THSMS ถูกต้อง 100% · รับงาน+หักเครดิตทุกครั้ง · control test ไปเบอร์บัญชีเอง `0817847992` ก็ 200 เหมือนกัน) · ตัดออกแล้ว 6 ข้อ · สมมติฐานอันดับ 1 = **H1 sender-id "Direct SMS" ไม่ผ่าน whitelist ระดับค่าย (carrier drop เงียบ โดย gateway ยังตอบ success)** · เอเย่น 4 มุม (gateway/carrier-DLT/integration/data) · แผนทดสอบ T1–T6 · **ยังไม่แก้โค้ด/ไม่แตะ production — รอ Owner/เอเย่นยืนยันสาเหตุ**
- **2026-10-07 (รอบ 8f): ทดสอบด้วยคีย์ใหม่ (Owner เปลี่ยน env → KEY `thsms_75c77a7589bb…3dbbe8` · SENDER `SMSOTP`)** — ยิงตรง 3 เบอร์เดิม (`0826378546`/`0942649269`/`0817847992`): **ทุกเบอร์ `/api/me` + `/api/send-sms` = 404 `{"success":false,"status_code":404,"error":"Not Found","message":"User Not Found"}`** → คีย์ใหม่ไม่เป็นที่รู้จัก (auth-level) **ยังไม่ส่ง/ไม่หักเครดิต** · format คีย์ถูก (`^thsms_[0-9a-f]{64}$` len 70) → เป็นที่ค่าคีย์ · คีย์ที่เคยใช้ได้ resolve = user id 112612 / `pual` · **ต้องให้ Owner คัดลอกคีย์จากแผง THSMS ใหม่ + ยืนยัน sender `SMSOTP` ลงทะเบียน** (รายละเอียด §8 ใน `BMB_W23_SMS_DELIVERY_DIAGNOSTIC.md`)
- **2026-10-07 (รอบ 8g): ย้ายผู้ให้บริการ SMS thsms.com → thsms.org (Owner: คีย์เดิมเป็นคนละบัญชี · แอดมิน SMS แนะนำเปลี่ยนเว็บใหม่)** — เว็บใหม่ `https://thsms.org/dashboard` · API `https://api.thsms.org/v1` (auth `X-API-Key` · `POST /sms/send` {sender_name,recipient,message,message_type} · `GET /credits`) · **โค้ด**: EF `sms-send` เพิ่ม provider switch `SMS_PROVIDER=thsms_org` (header `X-API-Key` + body ใหม่) คง legacy `thsms` (Bearer/msisdn) · เพิ่ม secret `SMS_MESSAGE_TYPE` (default `superfast`) · `w23SetSmsSecrets.cjs` ชี้ thsms.org · สคริปต์ใหม่ `e2e/thsmsOrgProbe.cjs` · **gates TSC0/LINT0/VITEST 527/527/BUILD0** · ⏳ **รอ Owner: API key (thsms.org) + sender_name ที่ลงทะเบียน** → แล้วรัน probe 3 เบอร์เดิม + ตั้ง secrets + deploy EF
- **2026-10-07 (รอบ 8h): thsms.org ทำงานจริง — EF SMS LIVE บน provider ใหม่ ✅** — คีย์เดิม (`thsms_75c7…bbe8`) ใช้ได้กับ **thsms.org** (คนละแพลตฟอร์มกับ .com → นี่คือคีย์ของบัญชี .org) · **ยิงตรง 3 เบอร์**: `GET /credits` 200 (available 511→505) · `POST /sms/send` 200 `{credits_used:3, messages_queued:1, status:"queued", success:true, valid_count:1}` ทุกเบอร์ (sender `SMSOTP`) · **secrets prod ตั้งแล้ว 6/6** (SMS_PROVIDER=thsms_org · SMS_API_URL=.../v1/sms/send · KEY · SENDER=SMSOTP · MESSAGE_TYPE=superfast · META_PAGE_ACCESS_TOKEN) · **EF `sms-send` deployed** (`Deployed Functions ... sms-send`) · `w23SmsProbe` **3/3 PASS** (provider=thsms_org) · `w23SmsSendOwner` 200 ok · ⚠️ **3 เครดิต/ข้อความ** · ✅ **Owner ยืนยัน SMS เข้าเครื่องจริงทั้ง 3 เบอร์ (2026-10-07) — W-2.3 ผ่านสมบูรณ์ (ส่งถึงจริง)**
- **2026-10-07 (รอบ 8i): ตั้ง `message_type=standard` = 1 เครดิต/ข้อความ + ล้าง token ซ้ำ** — thsms.org คิดเครดิตตาม **`message_type`** (ไม่ใช่ความยาวข้อความ): `standard`=**1** · `express`=2 · `superfast`=3 (ยืนยันด้วย probe จริง) → เปลี่ยน `SMS_MESSAGE_TYPE=standard` (default ในโค้ด + secret + `THSMS_MESSAGE_TYPE` ใน `.env.local`) · re-set secrets (HTTP 201) + redeploy EF · `w23SmsProbe` 3/3 · EF send 200 · **`credits_used:1`** ✅ · **แก้ token ซ้ำ**: `.env.local` มี `SUPABASE_ACCESS_TOKEN` 2 บรรทัด (ตัวเก่า `sbp_fcf…` มีเว้นวรรคก่อน `=` ถูกดึงก่อน → 401) → comment ปิดตัวเก่า เหลือตัวถูก `bmb-dev-2026-10` (`sbp_fceb…1936`)
- **2026-10-07 (รอบ 8j): ตรวจระบบแอดมินละเอียด + แก้ "เพิ่มรูปไม่ได้/แก้ไขไม่ได้" — ผ่านจริง ✅** — รายงาน: **`BMB_ADMIN_AUDIT_2026-10-07.md`** · **root cause #1** = storage.objects INSERT policy ใช้ subquery `(SELECT id FROM storage.buckets WHERE name='bmb-images')` ซึ่ง RLS ซ่อนแถวจาก `authenticated` → NULL → **42501** (probe: `STORAGE_UPLOAD ERR new row violates row-level security policy`) · **root cause #2** = `createDeliveryRound()` ไม่ใส่ `branch_id` แต่ RLS = `is_branch_admin(branch_id)` → ปฏิเสธ · **แก้**: **Migration 119 APPLIED + VERIFIED 6/6** (`bucket_id='bmb-images'` literal) + `resolveAdminBranchId()` · **ADMIN_CRUD 20/20 PASS** (categories · products(+รูป base64) · menu_sections · delivery_rounds · promotions · media_assets · storage upload/publicUrl) · security ยังสมบูรณ์ (tenant_null→42501 · category='global'→23514 ตามออกแบบ) · **Gates: TSC 0 · LINT 0 · VITEST 49 files/527 · BUILD 0** · โปรดทราบ: `search_codebase` สแกน workspace `chat\bmb` (สำเนาเก่า) ไม่ใช่ repo จริง `D:\A PROJECT\Bite Me Baby`
- **2026-10-07 (รอบ 8k): Owner ยืนยันผลจริง + เคลียร์ worktree/stage + อัปเดตแฮนด์ออฟ** — ✅ **"แมสเสจเข้าแล้วเทสผ่าน" (SMS)** · ✅ **"รูปเมนูเพิ่มได้ผ่าน" (Admin image)** · ⏳ ขนส่ง (delivery rounds) ยังไม่ได้ลองใน UI (โค้ดแก้แล้ว + probe ผ่าน) · **worktree clean**: `openapi-paths.txt` (0 bytes) ลบทิ้ง · `Dockerfile`/`docker-compose.yml`/`.dockerignore` commit · **แฮนด์ออฟอัปเดต**: `BMB_HANDOFF_NEXT_SESSION_2026-10-07.md` เพิ่ม §0 สถานะปิดเซสชัน (8g–8j) + แก้ rule 10 (token ซ้ำ) + §4 untracked 4 ไฟล์ DONE · **A-1 status** → SMS+รูปเมนู CONFIRMED · พร้อมพัฒนาต่อที่แชทหน้า
- **2026-10-07 (รอบ 9 — Talk to Bite):** Implement "Talk to Bite" AI-Waiter ครบวงจร ชุดเดียว — **Homepage + Conversation + Floating Bite + Voice + Memory + Menu + Cart/Order ระบบเดียวกัน** · ใหม่: `src/lib/talkToBite.ts` (state+pickTopAvailable+order-again resume logic) · `src/components/ai/TalkToBite.tsx` (UI คอมเมิร์ซบทสนทนาเดียว: menu card→cartStore, order draft+confirm, quick actions จริง, voice reuse) · `ProductCard.tsx` · `TalkToBitePage.tsx` (route `/talk-to-bite` public; `/ai-chat`→redirect) · `useBiteAIStore.biteState` (state เดียว) · BiteHero=Talk-to-Bite home · Floating Bite ลาก+snap+safe-area+จำตำแหน่ง · **ลบ** `BiteAIChat.tsx`/`AiChatPage.tsx` (ตัด duplicate chat) · BottomNav เหลือ Home|Menu|Orders|Account · **Gates: TSC 0 · LINT 0 · VITEST 50 files/539 · BUILD 0** · docs: `BMB_TALK_TO_BITE_STATUS.md` + `BMB_TALK_TO_BITE_CONTEXT.md` · ยังค้าง: Owner ยืนยัน runtime จริง + ต่อ memory hydrate ใน UI ใหม่

- 2026-10-06 (รอบ 5): **BACKUP WORKING** — Docker Desktop ติดตั้งแล้ว (Owner) → pg_dump ผ่าน temp container postgres:17-alpine (ไม่แตะ supabase stack ของ selfprint ที่รันอยู่) · DB password rotated ×2 + secret `BMB_DB_PASSWORD` (201) — `SUPABASE_DB_URL` เก่า platform-managed ลบไม่ได้ = stale ห้ามใช้ · dump จริง 3 × 4.67 MB ใน `backups/` (gitignored) · scripts: `e2e/dbBackup.cjs` + `e2e/dbDump.cmd`
- 2026-10-06 (รอบ 3): **G4 CLOSED** (Owner ยอมรับ simulated 9/9 — Meta unblock/Test User เลื่อน backlog) · **W-3.4 Bolt ตัดออก** (Owner: ไม่ใช้แล้ว) · **W-1.6 BLOCKED** (SUPABASE_ACCESS_TOKEN หมดอายุ — รอ Owner token ใหม่; script `w16TestSecretsClean.cjs` พร้อม) · **หน้าแรก: หมวดที่แอดมินเพิ่มโชว์เสมอ** — CategorySections เรนเดอร์หมวด active ทุกหมวดตาม sort_order ก่อนเซกชันรีวิว, หมวดที่ยังไม่มีสินค้าแสดง empty "เร็ว ๆ นี้" (แก้: หมวด "สินค้าสำเร็จรูป" เคยถูกซ่อนเพราะ 0 สินค้า) + tests 3/3 · **W-2.3 โค้ด SMS วางเตรียม**: EF `sms-send` + `_shared/sms.ts` + tests (รอ credentials) · gates TSC0/LINT0/VITEST 527/BUILD0