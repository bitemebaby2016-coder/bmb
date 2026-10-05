# BMB — PRODUCTION MASTER STATUS (เอกสารหลัก)

**ประเภทเอกสาร:** STATUS / RECONCILIATION + MASTER WORK LIST — ไม่ใช่ architecture, ไม่ใช่ contract ใหม่
**วันที่ตรวจ:** 2026-10-05 · **Baseline:** HEAD == origin/main == `2ad683f` (ก่อนเพิ่มเอกสารนี้)
**วิธีตรวจ:** READ-ONLY ทั้งหมด (Supabase Management API SELECT, functions/secrets list = ชื่อเท่านั้น, HTTP GET เว็บ production, DNS lookup, code/report ใน repo)
**รอบนี้:** IMPLEMENTATION = NO · MIGRATION = NO · DEPLOYMENT = NO · PRODUCTION MUTATION = NO

Evidence priority: PRODUCTION DB → CURRENT CODE → MIGRATIONS/CONTRACTS → VERIFIED REPORTS → DOCS → OLD DOCS
Status legend: IMPLEMENTED · CONNECTED · DEPLOYED · RUNTIME VERIFIED · DOCUMENTED · READY · BLOCKED · MISSING · DEFERRED

---

## 1. BUSINESS MODEL (Owner ยืนยัน 2026-10-05) — ใช้เป็นเกณฑ์วัดทั้งเอกสาร

| หัวข้อ | Owner ระบุ | สถานะในระบบจริง |
|---|---|---|
| โหมดขาย | **PRE_ORDER** และ **SAME_DAY** | IMPLEMENTED — `orders.order_mode` + RPC `create_order_with_items` (`ERR_INVALID_ORDER_MODE`) |
| ขนส่งแบบ 1 | **Bite Drive** ส่งเองตามรอบของตัวเอง ระยะไม่เกิน 5 กม. **(แอดมินปรับได้)** | IMPLEMENTED แต่ **ยังปรับไม่ได้จริง** — 5 กม. hardcode ใน RPC (ดู §4.1) |
| ขนส่งแบบ 2 | เรียกไรเดอร์ภายนอก | IMPLEMENTED แค่ระดับ adapter (sandbox/mock) — ยังไม่ได้ CONNECTED |
| Admin | **ต้องปรับได้ทุกอย่าง** | PARTIAL — มี 25 หน้าแอดมิน แต่ค่าหลักหลายตัว hardcode (ดู §4.1) |
| แพลตฟอร์ม | **White-label** ใช้ได้กับร้านไหนก็ได้ กี่สาขาก็ได้ | ระดับ schema พร้อม (tenants/brands/branches + tenant_id/branch_id) — ข้อมูลจริงมีแค่ 1/1/1 |
| ร้านแรก | Bite Me Baby (ร้านจริง) | tenant `tenant-bmb-001` · brand `brand-bmb-main` · branch `branch-tenant-bmb-001-main` |
| โดเมน | **biteme-baby.com** (Owner ซื้อแล้ว) | **ยังไม่ CONNECTED** — DNS = NXDOMAIN; โค้ดอ้างถึง `bitemebaby.com` (ไม่มีขีด) |

⚠️ **ข้อขัดแย้งที่ต้องให้ Owner ตัดสิน (ยังไม่แก้):** RPC ปัจจุบันบังคับว่า `ระยะ ≤ 5 กม. ⇒ ต้องเป็น self_delivery` และ `> 5 กม. ⇒ ต้องเป็นไรเดอร์ภายนอก` **ทั้งสองโหมดขาย** แต่ Owner บอกว่า Bite Drive ใช้กับ **พรีออเดอร์** ⇒ ต้องตอบให้ชัดว่า SAME_DAY ที่อยู่ในระยะ ≤ 5 กม. ใช้ Bite Drive ด้วยไหม (ดู §10 D-01)

---

## 2. PRODUCTION EVIDENCE SNAPSHOT (2026-10-05, read-only)

```text
WEB      https://bitemebaby-5f7.pages.dev = 200 · bundle assets/index-DphkYgGq.js
         ไม่มี facebook-domain-verification (repo มีแล้วตั้งแต่ commit 882feab) ⇒ production = build เก่า
         Cloudflare Pages project = "bitemebaby" · deploy แบบ manual (wrangler direct upload)
         cache ฝั่ง wrangler ล่าสุด 2026-09-27 ⇒ main นำหน้าไปแล้ว 207 commits · ci.yml ไม่มี deploy step
DOMAIN   biteme-baby.com / www = NXDOMAIN (ยังไม่มี nameserver) · bitemebaby.com = NXDOMAIN
TENANCY  tenants 1 · brands 1 · branches 1 (service_radius_km = 5.00, active, default)
ORDERS   202 รายการ (2026-09-17 → 2026-09-28; ไม่มีออเดอร์ใหม่มา 7 วัน) · delivery_method = self_delivery 202/202
         SAME_DAY: pending 150 · cancelled 29 · ready_for_dispatch 8 · dispatched 5 · confirmed 2
         PRE_ORDER: pending 5 · dispatched 2 · delivered 1
PAYMENT  payment_intents 56 — stripe completed 28 / refunded 8 / pending 10 / partial 1; promptpay 9
         livemode=true ใน metadata = 0 รายการ ⇒ ยังไม่มีหลักฐาน Stripe LIVE
DELIVERY drivers 5 · delivery_assignments 10 (assigned 6 / accepted 4) · zones 6 · rounds 26
RIDER    provider_orders = 0 · adapters: grab/lineman = sandbox, foodpanda = mockup_pending
SOCIAL   social_events 0 · content_approvals 0 · channel_page_bindings active 2 (page 862940416913026)
QUEUE    automation_queue 43 = succeeded 43 (failed/ค้าง = 0)
FUNCTIONS ACTIVE 12/12 — channel-webhook v10 (deploy 2026-10-02 ⇒ ข้อความไทยที่แก้ mojibake ใน f0907c7 ยังไม่ขึ้น prod)
SECRETS (ดูแค่ชื่อ) Stripe/OpenRouter/AUTOMATION_TOKEN/CHANNEL_WEBHOOK_* มีครบ
         ไม่มี secret ของ Grab/LINE MAN/Foodpanda · ไม่มี credential ส่ง notification (push/SMS/email/LINE)
         มี BMB_TEST_* (บัญชีทดสอบ) ค้างอยู่ใน production secrets
```

---

## 3. CORE SHOP STATUS

| Area | สถานะ | Evidence | ใช้จริงได้? | ติดอะไร | ประเภท gap |
|---|---|---|---|---|---|
| Web / PWA | DEPLOYED (build เก่า) | 200 OK; bundle ไม่ตรง main | ได้ แต่เป็นโค้ดเก่า | ไม่มี deploy pipeline · โดเมนยังไม่ต่อ | software/ops |
| Catalog / Menu | IMPLEMENTED + DEPLOYED | AdminProducts/MenuSchedule/Recipes; products_branch_overrides | ได้ | — | — |
| Order creation (SAME_DAY + PRE_ORDER) | RUNTIME VERIFIED (ระดับข้อมูลทดสอบ) | 202 orders ผ่าน `create_order_with_items` | ได้ | ยังไม่มีออเดอร์ลูกค้าจริง | evidence |
| Order lifecycle | IMPLEMENTED + PARTIAL RUNTIME | state machine + audit; delivered = 1 (PRE_ORDER); SAME_DAY delivered = 0 | ยังไม่พิสูจน์ครบ | ไม่มี SAME_DAY ที่ครบวงจร | evidence |
| Payment — Stripe | RUNTIME VERIFIED **TEST** | webhook 6/6, refund 172 THB (M1 09-24); livemode = 0 | **ยังไม่ได้ (live)** | ยังไม่ยืนยัน live key + ชาร์จจริง | Owner/external |
| Payment — PromptPay | IMPLEMENTED | 9 intents (completed 2) | ต้องตรวจ flow ยืนยันการรับเงิน | การ reconcile manual | software/ops |
| Kitchen | IMPLEMENTED + DEPLOYED | AdminKitchen, production batching (Migr 027) | ได้ | ยังไม่มี runtime ของออเดอร์จริง | evidence |
| Dispatch (Bite Drive) | IMPLEMENTED + PARTIAL RUNTIME | drivers 5, assignments 10, rounds 26, zones 6 | ได้ | assignment ค้าง assigned/accepted | evidence/data |
| Delivery (Bite Drive) | IMPLEMENTED | RiderPWA (geofence 300 ม.), Migr 036 driver→order sync | ได้ (แบบ self) | มี delivered จริงแค่ 1 | evidence |
| Delivery (ไรเดอร์ภายนอก) | IMPLEMENTED (adapter) · **NOT CONNECTED** | provider_orders = 0; ไม่มี secret | **ไม่ได้** | ไม่มี contract/API key; dispatch ใน adapter = id แบบ mock | **EXTERNAL** |
| Tracking | IMPLEMENTED | OrderTrackPage, OrdersPage | ได้ (เฉพาะสถานะในระบบ) | ไม่มี tracking ของไรเดอร์ภายนอก | depends on rider API |
| Notifications | IMPLEMENTED (queue/in-app) | notification_dispatch ใน G8 = succeeded | in-app เท่านั้น | ไม่มี channel ส่งออก (LINE/SMS/push) | external credential |
| Failure handling | RUNTIME VERIFIED (automation) | G8 queue/retry; orders_stale_pending | ได้ | — | — |

---

## 4. ADMIN-CONFIGURABILITY & WHITE-LABEL READINESS

### 4.1 ค่าที่ Owner ต้องการให้แอดมินปรับได้ — สถานะจริง

| ค่า | ตอนนี้อยู่ที่ไหน | แอดมินปรับได้? | หมายเหตุ |
|---|---|---|---|
| ระยะส่ง Bite Drive (5 กม.) | **hardcode `5.00` ใน RPC `create_order_with_items` + `compute_delivery_fee`** · `branches.service_radius_km` = 5.00 (มี column แต่ RPC ไม่อ่าน) · `platformConfig.biteDriveMaxDistanceKm = 5` (ฝั่ง client) · `business_settings.delivery_policy.radius_km = 10` (ไม่ตรงกัน) | **NO** | มีค่าเดียวกันอยู่ 4 ที่และไม่ตรงกัน ⇒ ต้องรวมให้เหลือแหล่งเดียว (server authority) |
| ค่าส่ง Bite Drive (25 บาท flat) | `platformConfig` (client) + `delivery_zones.fee` (DB) | zones ปรับได้ใน DB / client ปรับไม่ได้ | ต้องยืนยันว่าแหล่งไหนเป็นตัวจริง |
| markup ไรเดอร์ภายนอก 12% · free shipping 300 · cutoff 2 ชม. · quota 120/วัน | `DEFAULT_PLATFORM_CONFIG` (hardcode ฝั่ง client) | **NO** | client-only ⇒ ไม่ใช่ server authority |
| รอบส่ง / zones | `delivery_rounds` / `delivery_zones` (DB, มี branch_id) | YES (AdminRounds, DeliveryManagement) | — |
| เวลาทำการ / order policy | `business_settings` (hours, operating_hours, order_policy) | YES (AdminSettings = ตัวแก้ JSON แบบ generic) | UI ยังเป็นการแก้ key/value ดิบ |
| ไรเดอร์ภายนอกที่เปิดใช้ | allowlist ใน RPC (`grab_rider/linemen_rider/foodpanda_rider`) + client registry | **NO** | การเพิ่ม/ปิด provider ต้องแก้โค้ด |
| แบรนด์ / ธีม / โลโก้ | brands + AdminBrands/AdminMedia; theme ใน `platformConfig` = hardcode | PARTIAL | — |
| สาขา | branches + BranchSwitcher | PARTIAL | ยังไม่มีหน้า CRUD สาขาโดยเฉพาะ (ต้องตรวจ AdminTenants) |

### 4.2 White-label / multi-branch

| หัวข้อ | สถานะ |
|---|---|
| Schema (tenant_id/brand_id/branch_id, RLS tenant-scoped) | IMPLEMENTED + RUNTIME VERIFIED (G3/G6 isolation probes) |
| Routing ออเดอร์ตามสาขา (TEN-07: branch จาก delivery_round) | IMPLEMENTED |
| รองรับหลาย tenant บน runtime จริง | **NOT PROVEN** — production มีแค่ 1 tenant; `DEFAULT_PLATFORM_CONFIG.tenantId` = fallback hardcode |
| ค่า SEO/โดเมนต่อ tenant | **MISSING** — `index.html`, `sitemap.xml`, `robots.txt` hardcode `bitemebaby.com` |
| Onboarding ร้านใหม่ (สร้าง tenant+brand+branch+settings) | ต้องตรวจ AdminTenants — ยังไม่มีหลักฐาน runtime |


---

## 5. EXTERNAL DEPENDENCIES

### 5.1 Rider / ไรเดอร์ภายนอก

| หัวข้อ | สถานะ |
|---|---|
| Provider ที่สถาปัตยกรรมรองรับ | Grab (`grab_rider`), LINE MAN (`linemen_rider`), Foodpanda (`foodpanda_rider`) + Bite Drive (`self_delivery`) |
| Code | IMPLEMENTED — `src/lib/providers/{grab,lineman,foodpanda,biteDrive}.ts` + registry; Grab มี OAuth/quote/dispatch ที่ต่อ endpoint จริงไว้แล้ว |
| ตำแหน่งที่รัน | ⚠️ adapter อยู่ **ฝั่ง client** (`VITE_GRAB_SANDBOX_CLIENT_SECRET`) ⇒ ถ้าใส่ live secret ใน `VITE_*` จะหลุดไปอยู่ใน bundle — **ต้องย้ายไป Edge Function ก่อนใส่ key จริง** |
| Credentials | MISSING — ไม่มีใน Supabase secrets (ดูแค่ชื่อ); env ที่ docs ระบุ = sandbox |
| Production connection | NOT CONNECTED — `provider_orders = 0` |
| Blocker ที่แท้จริง | (1) **EXTERNAL**: สัญญา/API key กับ provider (2) **SOFTWARE**: ย้าย adapter ไปฝั่ง server + webhook รับสถานะ/tracking จาก provider |

### 5.2 Facebook / Meta

| หัวข้อ | สถานะ |
|---|---|
| Page binding | RUNTIME VERIFIED — page `862940416913026` → tenant-bmb-001 (FACEBOOK + MESSENGER) |
| Domain verification | **BLOCKED (เราเอง)** — แท็กอยู่ใน repo แล้ว แต่เว็บ production ไม่มี (build เก่า) + โดเมนยังไม่ต่อ |
| Webhook (`channel-webhook` v10) | DEPLOYED + RUNTIME VERIFIED (HMAC 401 / verify-token 403 / allowlist) |
| Handshake Verify & Save | **MISSING — Owner action** (G4 report: "เฟซยังไม่อัพเดท") |
| Real event | MISSING — `social_events = 0` |
| Production write (reply/post) | **ปิดอยู่ตามกฎ** — ห้ามเปิด |
| ทำต่อได้โดยไม่ต้องรอ Meta | deploy เว็บให้มีแท็ก · ต่อโดเมน · redeploy channel-webhook (ข้อความไทย) · harness ของ G9 failure cases ที่ไม่ต้องใช้ real event |

### 5.3 อื่น ๆ

| Dependency | สถานะ |
|---|---|
| Stripe LIVE | ยังไม่ verified (livemode = 0) — Owner ต้องยืนยัน key + register webhook ของ live |
| Notification channel (LINE OA / SMS / push) | MISSING credentials |
| Domain biteme-baby.com | ซื้อแล้ว · DNS ยังไม่ตั้ง (ดู §9) |
| OpenRouter (AI) | CONNECTED (secret มี; G5 PASS) |

---

## 6. AI AUTOMATION — GATE STATUS

| Gate | IMPL | CONNECTED | DEPLOYED | RUNTIME VERIFIED | สถานะ | Evidence |
|---|---|---|---|---|---|---|
| G3 Social Events | ✅ | ✅ | ✅ | ✅ (isolated + prod probes) | **PASS** | BMB_G3_FINAL_REPORT.md |
| G4 Meta Security | ✅ | ⏳ binding ✅ / handshake ❌ | ✅ v10 | negative ✅ / real event ❌ | **HOLD — EXTERNAL** | BMB_G4_PRODUCTION_CONNECTION_REPORT.md |
| G5 AI Routing | ✅ | ✅ | ✅ ai-proxy v19 | ✅ 6/6 | **PASS** | BMB_G5_FINAL_REPORT.md |
| G6 Auto-reply | ✅ | ✅ | ✅ social-ai-worker v2 | ✅ classify/draft | **PASS (capability)** · real Meta E2E = BLOCKED | BMB_G6_FINAL_REPORT.md |
| G7 Auto-post | ✅ | ✅ | ✅ social-post-worker v3 | ✅ | **COMPLETE** | BMB_G7_FINAL_REPORT.md |
| G8 Retry/Failure | ✅ | ✅ | ✅ queue-enqueue/dispatcher v1 | ✅ 28 executions; queue 43/43 | **PASS** | BMB_G8_S5_FINAL_REPORT.md |
| G9 Social AI E2E | — | — | — | — | **CONTRACT DRAFT · NOT STARTED** | BMB_G9_CONTRACT.md |
| G10 True Production Closure | — | — | — | — | **NOT STARTED** | — |

**G8-S5 EXISTING EVIDENCE = CONFIRMED** (production queue 43/43 succeeded ณ วันตรวจ) — ห้าม rerun

⚠️ **SPINE CONFLICT (ต้องให้ Owner ตัดสิน):** G9 ต้องการ REAL EVENT แต่ real event ต้องรอ Meta handshake (G4) และ spine วาง G4 Real Meta Verification ไว้ *หลัง* G9 ⇒ ส่วน REAL EVENT/INGEST/#6 ของ G9 ปิดไม่ได้ก่อน G4 (D-03)

---

## 7. G9 EVIDENCE RECONCILIATION (baseline = BMB_G9_CONTRACT.md)

### 7.1 Journey

| Stage | สถานะ | Evidence เดิม |
|---|---|---|
| REAL EVENT | **BLOCKED** | social_events = 0 (รอ Meta) |
| INGEST | PARTIALLY PROVEN | G3/G4 harness + negative probes บน prod; ยังไม่มี event จริง |
| CLASSIFY | ALREADY PROVEN | G6 `social_comment_classify` RUNTIME VERIFIED |
| ROUTE | ALREADY PROVEN | G5 6/6 |
| GENERATE | ALREADY PROVEN | G6 `social_reply_draft` · G7 post draft |
| AUTHORIZE | ALREADY PROVEN | G3/G6 tenant/brand derive · G7 approval (APPROVED ≠ PUBLISHED) |
| ACTION | PARTIALLY PROVEN | G7/G8 queue path ✅ · outbound ไป Meta = ปิดอยู่ |
| RESULT | ALREADY PROVEN | G8-S5 terminal `succeeded` |
| PERSISTENCE | ALREADY PROVEN | G8-S5 audit traces |
| REPLAY SAFETY | ALREADY PROVEN | G6-15 duplicate no-op · G7 replay → ERR_APPROVAL_NOT_PENDING · G8 dup=0 |
| FAILURE RECOVERY | PARTIALLY PROVEN | G8 สำหรับ job ของ scheduler; ยังไม่มีบน social chain แบบ end-to-end |

### 7.2 Failure matrix 12/12

| # | Item | สถานะ |
|---|---|---|
| 1 | invalid webhook | ALREADY PROVEN (G3/G4: 401/403) |
| 2 | duplicate webhook | ALREADY PROVEN ระดับ DB (UNIQUE + ON CONFLICT; G6-15) · real redelivery = BLOCKED |
| 3 | AI timeout | PARTIALLY PROVEN (G5 timeout behavior; ยังไม่ทดสอบใน chain) |
| 4 | AI/provider failure | PARTIALLY PROVEN (G5/G6 error paths) |
| 5 | malformed AI output | PARTIALLY PROVEN (G6 validation `ai_validated`; ไม่มี negative runtime case) |
| 6 | Meta/outbound failure | **BLOCKED** (outbound ไป Meta ปิดอยู่) |
| 7 | worker crash / retry | PARTIALLY PROVEN (G8 queue; ยังไม่มีบน social worker) |
| 8 | duplicate scheduler | ALREADY PROVEN (G8-S5 dual-path = 0) |
| 9 | unauthorized tenant/brand | ALREADY PROVEN (G3 S1–S8, G6 R5/R6) |
| 10 | stale action | NOT PROVEN (สำหรับ social action) |
| 11 | already-completed | ALREADY PROVEN (G7 replay, G8 claim) |
| 12 | persistence/replay | ALREADY PROVEN (G8-S5) |

**G9 TRUE EVIDENCE GAP:** #3 #4 #5 #7 #10 (ทำได้เลยด้วย harness/probe — ไม่ต้องรอ Meta) · REAL EVENT / INGEST / #2-real / #6 (ต้องรอ Meta)


---

## 8. MASTER GAP MATRIX

| Area | Current Status | Evidence | Real Blocker? | Dependency | Next Action |
|---|---|---|---|---|---|
| Core Web | DEPLOYED (build เก่า) | bundle ≠ main; ไม่มีแท็ก FB | **YES** | Cloudflare access | W-01 deploy pipeline + deploy main |
| Domain | MISSING | biteme-baby.com NXDOMAIN | **YES** (สำหรับเปิดร้านด้วยแบรนด์) | Owner: registrar → Cloudflare | W-02 ต่อโดเมน (§9) |
| Order | RUNTIME VERIFIED (test) | 202 orders | NO | — | W-06 live order test |
| Payment | TEST verified · LIVE ไม่ verified | livemode = 0 | **YES** | Owner: Stripe live keys | W-05 |
| Kitchen | IMPLEMENTED | AdminKitchen/batching | NO | — | ตรวจใน W-06 |
| Dispatch | PARTIAL RUNTIME | assignments 10 | NO | — | ตรวจใน W-06 |
| Delivery (Bite Drive) | IMPLEMENTED · delivered 1 | orders | NO (มี evidence ไม่พอ) | — | W-06 |
| Admin configurability | PARTIAL | 5 กม. hardcode 4 ที่ | **YES** (ตาม requirement Owner) | D-01 | W-04 |
| Tracking | IMPLEMENTED (ภายใน) | OrderTrackPage | NO | rider API | — |
| External Rider API | NOT CONNECTED | provider_orders 0 | NO สำหรับเปิดร้าน (ส่ง ≤ 5 กม. ด้วย Bite Drive ได้) · YES สำหรับ > 5 กม. | **EXTERNAL**: สัญญา provider | W-10 |
| Notifications | in-app only | no credentials | NO (soft) | credential LINE/SMS | W-11 |
| Test data hygiene | 150 SAME_DAY pending (test) | orders | **YES** (ปนกับครัวจริง) | D-02 | W-03 |
| Facebook/Meta | HOLD | social_events 0 | NO สำหรับร้าน · YES สำหรับ G4/G9 | Owner: Verify & Save | W-07 |
| G3 | PASS | report | NO | — | ห้ามทำซ้ำ |
| G4 | HOLD — EXTERNAL | report | YES (สำหรับ real event) | Meta | W-07 |
| G5 | PASS | 6/6 | NO | — | ห้ามทำซ้ำ |
| G6 | PASS (capability) | report | NO | — | ห้ามทำซ้ำ |
| G7 | COMPLETE | FG-01..09 | NO | — | ห้ามทำซ้ำ |
| G8 | PASS | G8-S5 + queue 43/43 | NO | — | ห้ามทำซ้ำ / ห้าม rerun |
| G9 | CONTRACT DRAFT | BMB_G9_CONTRACT.md | ส่วนหนึ่ง BLOCKED โดย Meta | Owner review + D-03 | W-08 |
| G10 | NOT STARTED | — | — | ทุกข้อด้านบน | หลัง G4 |

---

## 9. คู่มือ: ต่อโดเมน biteme-baby.com เข้ากับ Cloudflare Pages (Owner ทำเอง)

> ข้อเท็จจริง: Cloudflare Pages project ชื่อ **`bitemebaby`** (URL `bitemebaby-5f7.pages.dev`) · DNS ของ biteme-baby.com ยังไม่มี nameserver เลย

**ขั้นที่ 1 — เพิ่มโดเมนเข้า Cloudflare (แนะนำ เพราะ apex domain ใช้กับ Pages ได้ง่ายที่สุด)**
1. เข้า https://dash.cloudflare.com → **Add a domain** → พิมพ์ `biteme-baby.com` → เลือกแพ็กเกจ **Free**
2. Cloudflare จะให้ nameserver มา 2 ตัว (เช่น `xxx.ns.cloudflare.com`)
3. เข้าเว็บที่ซื้อโดเมน (registrar) → ส่วน **Nameservers** → เปลี่ยนเป็น 2 ตัวนั้น → บันทึก
4. รอสถานะใน Cloudflare เป็น **Active** (ส่วนใหญ่ไม่กี่นาที แต่อาจนานถึง 24 ชม.)

**ขั้นที่ 2 — ผูกโดเมนกับ Pages project**
1. Cloudflare → **Workers & Pages** → เลือก **bitemebaby** → แท็บ **Custom domains** → **Set up a custom domain**
2. ใส่ `biteme-baby.com` → Continue → Activate (Cloudflare จะสร้าง DNS record ให้เอง)
3. ทำซ้ำกับ `www.biteme-baby.com`
4. (แนะนำ) ตั้ง Redirect Rule ให้ `www` → `https://biteme-baby.com` แบบ 301
5. SSL/TLS → โหมด **Full** · เปิด **Always Use HTTPS**

**ขั้นที่ 3 — สิ่งที่ AI DEV ต้องทำต่อหลังโดเมน Active (W-02b; ต้องได้รับอนุมัติก่อน)**
- เปลี่ยน `bitemebaby.com` → `biteme-baby.com` ใน `index.html` (canonical/OG/JSON-LD), `public/sitemap.xml`, `public/robots.txt` (สะกดผิดอยู่ทุกที่)
- อัปเดต `HTTP-Referer` ใน ai-proxy, success/cancel URL ของ Stripe checkout, Supabase Auth → Site URL/Redirect URLs
- Meta: เพิ่มโดเมนใน Business Settings → Brand Safety → Domains แล้วกด Verify (ต้องหลัง deploy ที่มีแท็ก)

ห้ามแปะ API token ของ Cloudflare ลงในแชท ถ้าต้องให้ AI DEV deploy ผ่าน CLI ให้ตั้งเป็น env หรือ GitHub secret เอง


---

## 10. OWNER DECISIONS REQUIRED

| ID | คำถาม | ทำไมต้องถาม |
|---|---|---|
| D-01 | Bite Drive ใช้กับ **SAME_DAY** ด้วยไหม หรือใช้กับ **PRE_ORDER** เท่านั้น? ถ้า SAME_DAY ≤ 5 กม. จะส่งด้วยอะไร? | RPC ตอนนี้บังคับว่า ≤ 5 กม. ต้องเป็น self_delivery ทั้งสองโหมด — ขัดกับที่ Owner อธิบาย |
| D-02 | ออเดอร์ทดสอบ 202 รายการ (pending 155) จะ archive/cancel หรือเก็บไว้? | ถ้าเปิดร้านทั้งที่ยังมี pending ค้าง ครัวจะเห็นปนกับของจริง — ต้องได้อนุมัติก่อนแตะ production data |
| D-03 | ลำดับ G4 กับ G9: จะให้ G9 ปิดส่วนที่ไม่ต้องใช้ Meta ก่อน แล้วทำส่วน real event หลัง G4 ไหม? | spine conflict §6 |
| D-04 | ไรเดอร์ภายนอก: เจ้าไหนก่อน (Grab / LINE MAN / Foodpanda) และมีสัญญาหรือยัง? | ต้องมี API key จริงก่อน |
| D-05 | ช่องทางแจ้งเตือนลูกค้า (LINE OA / SMS / ไม่ใช้)? | ไม่มี credential |
| D-06 | อนุมัติให้ AI DEV deploy เว็บ (W-01) และ redeploy `channel-webhook` (ข้อความไทย)? | เป็น production deployment |

---

## 11. MASTER WORK LIST — เรียงตาม dependency (ห้ามข้ามลำดับ)

ประเภท: **BLOCKER** · **EXTERNAL BLOCKER** · **REQUIRED NEXT** · **NON-BLOCKER** · **DEFERRED** · **ALREADY CLOSED**

### PHASE A — เปิดร้านจริง (Bite Me Baby @ biteme-baby.com)

| # | งาน | ประเภท | ใครทำ | Evidence ที่ต้องได้ |
|---|---|---|---|---|
| W-01 | ระบุสถานะ deploy ของ Pages แล้วตั้ง **deploy pipeline** (GitHub Actions → Cloudflare Pages) → deploy main | **REQUIRED NEXT** | AI DEV (+ Owner ใส่ `CLOUDFLARE_API_TOKEN` เป็น GitHub secret) | bundle บน prod = build ของ main · มีแท็ก FB · deploy record |
| W-02 | ต่อโดเมน biteme-baby.com (§9 ขั้น 1–2) | BLOCKER | **Owner** | DNS resolve + HTTPS 200 |
| W-02b | แก้โดเมนในโค้ด/SEO/Stripe/Auth/ai-proxy → `biteme-baby.com` | BLOCKER | AI DEV | grep `bitemebaby.com` = 0 · Auth redirect ใช้งานได้ |
| W-03 | จัดการข้อมูลทดสอบ (ตาม D-02) | BLOCKER | AI DEV หลัง Owner อนุมัติ | orders ที่ active = 0 ก่อนเปิดร้าน |
| W-04 | **Admin-configurable delivery**: รวมระยะ Bite Drive เป็นแหล่งเดียว (`branches.service_radius_km` ต่อสาขา) + ให้ RPC อ่านค่านี้ + UI แอดมิน + ย้ายค่าที่ client hardcode (markup/cutoff/quota/free-ship) เป็น settings ต่อ tenant/branch | BLOCKER (ตาม requirement Owner) | AI DEV หลัง D-01 (ต้องมี migration — ต้องอนุมัติ) | ปรับ 5→3 กม. ในแอดมินแล้ว RPC บังคับตามจริง · tests |
| W-05 | Stripe LIVE: ใส่ live keys + register live webhook | EXTERNAL BLOCKER | **Owner** | livemode=true ใน payment_intents |
| W-06 | **Live acceptance**: ออเดอร์จริง SAME_DAY 1 + PRE_ORDER 1 (จ่ายจริง) → ครัว → Bite Drive → delivered → (refund 1 ครั้ง) | BLOCKER | Owner จ่าย + AI DEV ตรวจ read-only | lifecycle ครบ + audit + payment reconcile |
| W-06b | redeploy `channel-webhook` (ข้อความไทย) | NON-BLOCKER | AI DEV หลัง D-06 | v11 active |
| W-06c | ลบ `BMB_TEST_*` ออกจาก production secrets | NON-BLOCKER (security hygiene) | Owner/AI DEV หลังอนุมัติ | secrets list ไม่มี BMB_TEST_* |

### PHASE B — Social AI (ไม่ขวางการเปิดร้าน)

| # | งาน | ประเภท | ใครทำ |
|---|---|---|---|
| W-07 | Meta: Verify & Save webhook + Domain verification (หลัง W-01/W-02) | EXTERNAL BLOCKER | **Owner** |
| W-08 | G9 ส่วนที่ไม่ต้องใช้ Meta: harness สำหรับ #3 #4 #5 #7 #10 (หลัง Owner review contract + D-03) | REQUIRED (หลัง review) | AI DEV |
| W-09 | G4 real event → G9 ส่วน REAL EVENT/INGEST/#2/#6 → G9 final report | EXTERNAL-dependent | AI DEV หลัง W-07 |


### PHASE C — ขยาย / White-label

| # | งาน | ประเภท |
|---|---|---|
| W-10 | ไรเดอร์ภายนอก: ย้าย adapter ไป Edge Function + secret ฝั่ง server + webhook สถานะ + tracking (หลัง D-04 + มี key) | EXTERNAL BLOCKER → REQUIRED |
| W-11 | ช่องทางแจ้งเตือนลูกค้า (หลัง D-05) | NON-BLOCKER |
| W-12 | White-label: SEO/domain/theme ต่อ tenant (ไม่ hardcode), runtime test ด้วย tenant ที่ 2 + สาขาที่ 2, onboarding flow | NON-BLOCKER สำหรับร้านแรก · BLOCKER สำหรับขายแพลตฟอร์ม |
| W-13 | หน้า Settings แอดมินแบบมี form (แทน JSON ดิบ) สำหรับทุก settings | NON-BLOCKER |
| W-14 | Lighthouse ≥ 90 บน prod | NON-BLOCKER |
| W-15 | G10 TRUE PRODUCTION CLOSURE | หลัง G4 + Phase A |

### DEFERRED (Owner ตั้งใจเลื่อน)
migration drift 104–111 · D4-3 timestamp freshness · D4-4 mention parser · `social_post_draft` (RESERVED) · Meta production write · physical delivery automation · cleanup `bmb/` stale copy

### ALREADY CLOSED — ห้ามทำซ้ำ / ห้าม reopen
G3 · G5 · G6 (capability) · G7 (S0–S4-R2) · G8 (S0–S5, T1, T2) · G8-S5 root cause (3310601 + e244f90) · mojibake ใน code (f0907c7) · G9 contract draft (2ad683f) · Stripe webhook 6/6 + refund (TEST) · RLS hardening WAVE 3

---

## 12. "ถ้าวันนี้จะเปิดให้ลูกค้าสั่งอาหารจริง BMB ขาดอะไร?"

**CORE SHOP BLOCKERS**
1. เว็บ production เป็น build เก่า ไม่มี deploy pipeline (W-01)
2. โดเมน biteme-baby.com ยังไม่ต่อ และโค้ดอ้างโดเมนผิด (W-02/W-02b)
3. ข้อมูลทดสอบค้าง 155 pending (W-03)
4. ระยะส่ง Bite Drive แอดมินยังปรับไม่ได้ (W-04 — ตาม requirement Owner; ถ้ายอมใช้ 5 กม. ตายตัวไปก่อน ข้อนี้ลดเป็น NON-BLOCKER)
5. ยังไม่มีออเดอร์จริงที่ครบวงจรด้วยการจ่ายจริง (W-06)

**AI AUTOMATION BLOCKERS** — ไม่มีข้อไหนขวางการเปิดร้าน (Social AI ไม่ใช่ dependency ของหน้าร้าน)

**EXTERNAL BLOCKERS** — Stripe LIVE keys (W-05) · Meta Verify & Save (W-07, ไม่ขวางร้าน) · สัญญาไรเดอร์ภายนอก (W-10, ขวางเฉพาะการส่งไกลกว่า 5 กม.)

**OPTIONAL / DEFERRED** — notifications · white-label tenant ที่ 2 · Lighthouse · settings UI แบบ form · รายการใน DEFERRED

---

## 13. NEXT REQUIRED ACTION (งานเดียว)

**W-01 — ตั้ง deploy pipeline ของ Cloudflare Pages แล้ว deploy `main` ขึ้น production** (ต้องให้ Owner อนุมัติ + ใส่ `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` เป็น GitHub secret)

- **ทำไมต้องทำก่อน:** ทุกงานถัดไป (ต่อโดเมน, Meta domain verify, live order test, การแก้ทุกอย่างหลังจากนี้) ต้องมีเว็บที่ตรงกับ `main` ก่อน ตอนนี้ main นำหน้า prod ~207 commits
- **ถ้าไม่ทำ:** ทดสอบออเดอร์จริงบนโค้ดเก่า · Meta domain verification ไม่ผ่าน · แก้อะไรไปก็ไม่ขึ้น prod
- **Dependency:** Owner สร้าง Cloudflare API token (สิทธิ์ Cloudflare Pages: Edit) แล้วใส่เป็น GitHub secret เอง (ห้ามส่งในแชท)
- **Evidence ที่ต้องได้:** workflow run สำเร็จ · bundle hash บน `bitemebaby-5f7.pages.dev` = ผล build ของ main · HTML มีแท็ก `facebook-domain-verification` · smoke test home/menu/checkout = 200
- **ทำคู่กันได้ทันที (Owner):** W-02 ต่อโดเมน (§9) — ไม่ต้องรอ W-01
- **ถัดไปหลัง W-01:** W-02b → ตอบ D-01/D-02 → W-03 + W-04 → W-05 → W-06

---

**HARD STOP — รอ Owner review เอกสารนี้ + ตอบ D-01..D-06**
ห้ามประกาศ project complete · ห้ามประกาศ Open Shop complete · ห้ามประกาศ G9 PASS

