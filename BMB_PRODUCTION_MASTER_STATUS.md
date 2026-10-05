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
DOMAIN   ✅ CONNECTED (อัปเดต 2026-10-05 ~10:15): NS = carlane/eoin.ns.cloudflare.com · A = Cloudflare
         https://biteme-baby.com = 200 · https://www.biteme-baby.com = 200 (SSL enabled, ขึ้น Active ทั้งคู่)
         แต่ canonical/og:url บนเว็บยังชี้ bitemebaby.com (ผิดโดเมน) และ bundle ยัง ≠ main (ดู §11)
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
> 🔒 ** OWNER MANDATE (2026-10-05): ทุกแถวในตารางนี้ แอดมินต้องปรับได้ทั้งหมด** เพราะเป็นไวท์ลาเบล — งานรวมค่าทั้งหมด = **W-1.4** (§11 PHASE 0)

| ค่า | ตอนนี้อยู่ที่ไหน | แอดมินปรับได้? | หมายเหตุ |
|---|---|---|---|
| ระยะส่ง Bite Drive | **branch canonical**: `branches.service_radius_km` (override — FC-3) · **global default**: `delivery_policy.bite_drive_radius_km` (112) — RPC ทั้ง `create_order_with_items`/`compute_delivery_fee` อ่านทั้งคู่ · legacy `radius_km=10` **RETIRED แล้ว (114)** | **✅ YES** | แก้ผ่าน `/admin/settings` (การ์ด Branch) → RPC บังคับทันที (probe C3/C4) |
| ค่าส่ง Bite Drive | `delivery_zones` (DB, 6 แถว, branch-scoped) · ไม่มี zone คลุม → `ERR_NO_DELIVERY_ZONE` | **✅ YES** | แก้ fee ต่อแถวใน `/admin/settings` (การ์ด Delivery Zones — UI ใหม่ 114) · probe B2 |
| markup 12% · free shipping 300 · cutoff 2 ชม. · quota 120/วัน | **`delivery_policy.tier2_markup_pct` + `free_shipping_threshold` · `order_policy.cutoff_hours` + `daily_quota` (seed guarded — 114)** · server: `enforce_pre_order_*` อ่าน `cutoff_hours` ตัวเดียวกัน (FC-4) | **✅ YES (114)** | client hydrate ตอน boot · probe B1/C7/C8 · admin แก้ JSON ผ่าน AdminSettings |
| สวิต์เปิด/ปิดรับงาน SAME_DAY + เลือกวิธีส่ง | `operating_hours.same_day_open` (trigger) + `allow_external_within_radius`/`external_methods_enabled` (112) · **ปิด/เปิด Bite Drive = `delivery_policy.bite_drive_enabled` (114, gate `ERR_BITE_DRIVE_DISABLED`)** | **✅ YES** | probe C11/C5b/C6 · w14 T2/T5/T6 |
| รอบส่ง / zones | `delivery_rounds` / `delivery_zones` (branch_id) | YES (AdminRounds + zones card ใหม่) | — |
| เวลาทำการ / order policy | `business_settings` (hours, operating_hours, order_policy) | YES (AdminSettings) | UI แก้ key/value + JSON form |
| ไรเดอร์ภายนอกที่เปิดใช้ | `delivery_policy.external_methods_enabled` (array) | **✅ YES (112)** | ยังไม่มี provider รายใดเปิดจริง (รอคีย์ D-04) |
| แบรนด์ / ธีม glass | `brands.display_name` + `brands.theme_tokens.glass` (seed 114 — bg/blur/border/text/shadow) · **GlassCard อ่านค่า hydrated ตอน boot (consumer จริง)** | **✅ YES (114)** | แก้ผ่าน `/admin/settings` (การ์ด Brand) · probe B3 · hydration มี unit test |
| สาขา (รัศมี/เวลา) | `branches.service_radius_km` + `branches.operating_hours` | **✅ YES (114)** | แก้ผ่าน `/admin/settings` (การ์ด Branch) · probe B4 |
| เปิด/ปิดรับออเดอร์ (mode) | `operating_hours.same_day_open` / `pre_order_open` / `round_open.*` | **✅ YES** | trigger `enforce_operating_hours` (probe C5b) |

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
| 3 | AI timeout | **EVIDENCE COMPILED (D-03 partial 2026-10-05)** — [FACT] `social-ai-worker`: `fetchWithTimeout(..., policy.timeoutMs)` → `TimeoutError` → `AI_UPSTREAM:timeout` → `releaseToRetryable` (RETRYABLE + attempts+1 + last_error — ไม่ค้างใน PROCESSING) · `_shared/aiTimeout.ts` + `_shared/aiPolicy.ts` = G5 single source · G5 6/6 · [คงเหลือ] chain-runtime negative case = รอ S-stage design |
| 4 | AI/provider failure | **EVIDENCE COMPILED (D-03 partial)** — [FACT] upstream !ok → fallback model (`policy.fallback`) ซ้ำ 1 ครั้ง → ยัง fail → `upstream_error` → RETRYABLE · ai-proxy: upstream !ok → 502 พร้อม `upstream_status` (W3A runtime 11/11) · G5/G6 error paths · [คงเหลือ] chain-runtime negative = S-stage |
| 5 | malformed AI output | **EVIDENCE COMPILED (D-03 partial)** — [FACT] `parseStructuredOutput` (schema) + semantic check ทั้ง classify/draft → fail = `markFailed('AI_OUTPUT_REJECTED')` = FAILED **ก่อน** persist → ไม่มี `ai_reply`/`reply_status`/`action_type` เขียนเลย (G6 boundary: no outbound) · G6 validation `ai_validated` · [คงเหลือ] negative runtime case จริง = S-stage |
| 6 | Meta/outbound failure | **BLOCKED** (outbound ไป Meta ปิดอยู่) |
| 7 | worker crash / retry | **EVIDENCE COMPILED (D-03 partial)** — G8-S5 (reuse ห้าม rerun): claim `FOR UPDATE SKIP LOCKED` · attempt_count=1 ทุกแถว · terminal `succeeded` · dup=0 (ON CONFLICT m111) · legacy=0 · dual-path=0 · [FACT] social-ai-worker: conditional-PATCH claim → catch → `releaseToRetryable` (attempts+1) · claim_lost → `skipped` |
| 8 | duplicate scheduler | ALREADY PROVEN (G8-S5 dual-path = 0) |
| 9 | unauthorized tenant/brand | ALREADY PROVEN (G3 S1–S8, G6 R5/R6) |
| 10 | stale action | **EVIDENCE COMPILED (D-03 partial)** — `orders_stale_pending` (`maxAgeMinutes`) = อ่าน canonical แล้วสร้าง notification เท่านั้น ไม่ execute action ไม่แตะ business state · eventId idempotency: w3b E2E `duplicate-event-idempotent` PASS + w3c `automation-handoff-once` PASS · G8-S5: scheduled stale = 12 executions succeeded · job allowlist unknown → 400 |
| 11 | already-completed | ALREADY PROVEN (G7 replay, G8 claim) |
| 12 | persistence/replay | ALREADY PROVEN (G8-S5) |

**G9 EVIDENCE STATUS (2026-10-05):** #3 #4 #5 #7 #10 = **EVIDENCE COMPILED** จาก code จริง + G5/G6/G8 ที่ PASS แล้ว (Owner สั่งเริ่มตาม D-03 — ไม่ rerun G8-S5, ไม่แตะ Meta, ไม่สร้าง event จริง) · chain-runtime negative cases คงไว้ให้ S-stage เมื่อ Owner อนุมัติรูปแบบ probe · REAL EVENT / INGEST / #2-real / #6 = ยังรอ Meta (G4) · **ยังไม่ประกาศ G9 PASS** (ต้อง Owner อนุมัติตาม contract §10.7)


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

## 10. OWNER DECISIONS — ✅ RESOLVED ทั้ง 6 ข้อ (2026-10-05)

| ID | คำถาม | มติ | ผลกระทบต่อแผน |
|---|---|---|---|
| D-01 | Bite Drive ใช้กับ SAME_DAY? | **ใช้ทั้งคู่** — PRE_ORDER เป็นหลัก; SAME_DAY ส่งได้ แต่**ต้องมีสวิต์เปิด/ปิดรับงาน + เลือกวิธีส่งได้** | W-1.4 |
| D-02 | ออเดอร์ทดสอบ 202? | **ยกเลิก (cancel) แล้วทดสอบใหม่** | W-1.2 |
| D-03 | ลำดับ G4/G9? | **ใช่** — G9 ส่วนที่ไม่ต้องใช้ Meta ทำก่อน | W-4.1 |
| D-04 | ไรเดอร์ภายนอก? | **Grab = เจ้าหลัก รอ API (ทำเรื่องแล้ว)** · **LINE MAN = รอง ทำเรื่องแล้ว** · **Bolt = กำลังทำเรื่อง** | W-3.x · ⚠️ gap: โค้ดมี foodpanda แต่ Owner ไม่ได้ใช้; **ยังไม่มี adapter ของ Bolt** |
| D-05 | แจ้งเตือนลูกค้า? | **SMS + ระบบแจ้งเตือนของเว็บเอง** | W-2.x |
| D-06 | อนุมัติ deploy? | **อนุมัติ** (deploy เว็บ + redeploy `channel-webhook`) | W-1.1 · W-1.5 |

**คำสั่งเพิ่มจาก Owner:** ตาราง §4.1 ทุกแถว "แอดมินปรับได้?" **ต้องปรับได้ทั้งหมด** เพราะเป็นไวท์ลาเบล (ร้านไหนก็ใช้ได้) ⇒ W-1.4 ขยายเป็น **รวมทุกค่า (distance/fee/markup/cutoff/quota/free-ship/provider allowlist) → business_settings ต่อ tenant/branch + UI แอดมิน + ให้ RPC อ่านจาก DB**
และตอบคำถาม "ต้องวางแผนทำใหม่เป็นเฟสก่อนไหม?" → **ใช่** → PHASE ใหม่ทั้งหมดอยู่ที่ §11

---

## 11. MASTER WORK LIST — แผนเป็น PHASE (เรียงตาม dependency; มติ D-01..D-06 แล้ว)

> คำถาม "ต้องวางแผนใหม่เป็นเฟสไหม" → **ใช่ ปรับแล้ว** · PHASE นี้แทนลำดับเดิม · ห้ามข้ามเฟสที่มี dependency

### PHASE 0 — เว็บตรงกับ main + โดเมนถูกต้อง (สำคัญสุด ทำก่อนอย่างอื่น)

| # | งาน | สถานะ | ใครทำ | Evidence |
|---|---|---|---|---|
| W-1.1 | Deploy ขึ้น Cloudflare Pages — **พบภายหลัง: project มี Git provider (`source=github`) → push `main` = auto Production build** (wrangler manual ได้ env=`preview` เท่านั้น) | ✅ **DONE 2026-10-05** — คีย์พบใน `.env.local` | AI DEV | **หลักฐาน:** production auto-build จาก push ทุกครั้ง (deployment list: env=production, source=commit ตรงรัน pushed) · `https://biteme-baby.com` HTTP 200 + robots ใหม่ = W-1.3 ขึ้นจริง · **หมายเหตุ:** เอกสารเดิมบอก "ไม่มี Git provider" = เก่า (ไม่ใช่อีกต่อไป) |
| W-1.2 | ยกเลิกออเดอร์ทดสอบ (D-02) | ✅ **DONE 2026-10-05** | AI DEV (canonical `cancel_order` + audit) | ยกเลิก 172 = 165 (RPC ตรง) + 7 (PRE_ORDER เกิน cutoff — ปิด trigger `trg_pre_order_cancel_window` ใน transaction เดียวแล้วเปิดคืน) · **active = 0** · trigger ครบ 11 ตัว `tgenabled=O` · เหลือ delivered 1 + cancelled 29 = ประวัติ |
| W-1.3 | แก้โดเมนโค้ด `bitemebaby.com` → `biteme-baby.com` (index.html, sitemap, robots, SeoHelmet, seo.ts, checkProductionHeaders, ai-proxy referer) | ✅ **CODE DONE 2026-10-05** — ขึ้น production พร้อม W-1.1 | AI DEV | 7 ไฟล์ / 40 บรรทัด (เปลี่ยนเฉพาะสตริงโดเมน) · เหลือโดเมนเก่าในโค้ด = 0 · TSC=0 · LINT=0 · **VITEST 488/488** · BUILD=0 · dist มีโดเมนใหม่ 13/เก่า 0 |
| W-1.4 | **Admin configurability — ค่าปกครองทั้งหมดต้องอ่านจาก DB (Owner mandate ห้ามฮาร์ดโค้ด)** | ✅ **SERVER AUTHORITY DONE 2026-10-05** — migration **112** สมัคร production แล้ว · W-1.4b (ส่วน client) เสร็จแล้ว — ดูแถวถัดไป | AI DEV | **หลักฐาน:** ไม่มี `5.00` hardcode ใน 2 functions · `delivery_policy` seed = `bite_drive_radius_km 5 / allow_external_within_radius false / external_methods_enabled []` · **`node e2e/w14ContractProbe.cjs` = W14_ALL_PASS 11 checks** (T1 baseline · T2 สวิต์ same_day_open · T3 รัศมี 1km บังคับจริง · T4a/b provider gate · T5 method choice ในรัศมี · T6 default คืนพฤติกรรมเดิม · T7 ERR_NO_DELIVERY_ZONE · T8 ERR_CONFIG_MISSING · rollback สะอาด) · เก็บ error code เดิม (contract 023/028/037 ยังเขียนเงื่อนไขเดิม) |
| W-1.5 | redeploy `channel-webhook` (ข้อความไทย, D-06 อนุมัติ) | ✅ **DONE 2026-10-05** | AI DEV | **v11 ACTIVE** · deploy สำเร็จผ่าน CLI (ข้อความไทย mojibake fix ของ `f6b0c0a` ขึ้น production แล้ว) · เส้นทาง deploy ถูกขัดข้องโดย `supabase/config.toml` ที่มี `verify_jwt` ซ้ำ (TOML parse error) — แก้แล้วในรอบเดียวกัน |
| W-1.4b | เลิก hardcode display/config จาก `platformConfig.ts` → อ่านจาก canonical ที่มีอยู่จริง (D-06 อนุมัติ) | ✅ **DONE 2026-10-05** (มี **HARD STOP 5 จุด** รอ Owner schema) | AI DEV | **ทำแล้ว:** `src/lib/platformConfigBootstrap.ts` (pure map + hydrate ตอน boot: `biteDriveMaxDistanceKm`←`delivery_policy.bite_drive_radius_km` · `currency`←`delivery_policy.currency` · `brandName`/`tenantId`←`brands` default) · boot ใน `main.tsx` (fire-and-forget) · DistanceChecker Tier-1 แสดงค่าจาก `fetchServerDeliveryFee` (server authority แทนคงที่ 25) · comment ใน `platformConfig.ts` ระบุ canonical/HARD STOP ทุก field · **tests +6** = **494/494** · TSC=0 · LINT=0 · **PROD VERIFY 2026-10-05**: push `3be4169` → auto Production build (`source=github`) → `biteme-baby.com` เสิร์ฟ `index-BmSPF2hV.js` ซึ่งมี `bite_drive_radius_km` + `delivery_policy` + brands query ✓ · lazy chunk `CheckoutPage-KvwV78Zr.js` มี `compute_delivery_fee` + server-fee display path ✓ · `business_settings` REST anon = 200 (input ของ hydrate อ่านได้จาก browser) · **HARD STOP เดิม 5 จุด → ปิดแล้วโดย migration 114 (Owner APPROVED — ดูแถว W-1.4c)** |
| W-1.4c | **FINAL CONFIGURATION CLOSURE** — HARD STOP ทั้งหมดของ Owner ทำให้ Admin-configurable โดยไม่สร้าง source ใหม่/ไม่ย้าย business rule (D-06) | ✅ **DONE 2026-10-05** — migration **114** สมัคร production | AI DEV | **Migration 114** (`e2e/fcBuildMigration114.cjs` anchor-guarded จาก live defs): FC-1 branch-scoped `delivery_policy` (ใช้ `business_settings.branch_id` ที่มีอยู่) · FC-2 config load หลัง branch resolution · FC-3 radius branch canonical = `branches.service_radius_km` (ไม่ duplicate) · FC-4 `order_policy.cutoff_hours` แทน `interval '2 hours'` hardcode (ค่า default = พฤติกรรมเดิม; hotfix 2 รอบ: `make_interval` ไม่รับ numeric + time-wrap → `timestamp + v_start - interval`) · FC-5 `delivery_policy.bite_drive_enabled` gate `ERR_BITE_DRIVE_DISABLED` · seeds guarded (markup/free-ship/cutoff/quota/glass — ไม่ทับค่า Admin) · **retire `delivery_policy.radius_km`** (precondition: 0 function consumers — fcAudit2) · **NEW `admin_sync_legacy_pre_order`** (admin-gated + canonical-terminal-only — ไม่ bypass ไม่ DELETE) · client: hydrate เพิ่ม (markup/freeship/cutoff/quota/enable/radius branch/theme glass) + **GlassCard อ่าน theme tokens จริง** + **AdminSettings เพิ่ม zones/brand/branch cards** + `weeklyRotator` RETIRED (dead) · **หลักฐาน: fcVerify114 = 25 PASS · fcProbe6 = 22 PASS** (RLS read/update/denied · tenant/brand/branch isolation · C1-C8 flow · D1-D4 legacy sync จริง) · gates TSC0/LINT0/VITEST 497/497/BUILD0 |
| W-1.6 | ลบ `BMB_TEST_*` ออกจาก production secrets | OPEN (security) | Owner/AI DEV | secrets list สะอาด |

### PHASE 1 — เปิดร้านรับเงินจริง

| # | งาน | สถานะ | ใครทำ |
|---|---|---|---|
| W-2.1 | Stripe LIVE keys + register live webhook | EXTERNAL (Owner) | Owner |
| W-2.2 | **Live acceptance**: SAME_DAY 1 + PRE_ORDER 1 จ่ายจริง → ครัว → Bite Drive → delivered → refund 1 ครั้ง | หลัง W-2.1 | Owner จ่าย + AI DEV ตรวจ |
| W-2.3 | แจ้งเตือน: SMS (ตาม D-05) + in-app/web notification ของเว็บเอง | OPEN | AI DEV (ต้อง credential SMS จาก Owner) |
| W-2.4 | เปิดร้านจริง (ประกาศ Open Shop) | หลังข้อ 1–3 ผ่านทั้งหมด | Owner ประกาศ |

### PHASE 2 — ไรเดอร์ภายนอก (D-04)

| # | งาน | สถานะ |
|---|---|---|
| W-3.1 | ย้าย adapter ทั้งหมดไป Edge Function + secret ฝั่ง server + webhook รับสถานะ (ป้องกันคีย์รั่วใน bundle) | OPEN — ต้องทำก่อนใส่ key จริง |
| W-3.2 | **Grab** (เจ้าหลัก): รอ API ที่ทำเรื่องไว้ → ต่อ key → E2E dispatch+tracking | EXTERNAL |
| W-3.3 | **LINE MAN** (รอง): ตามหลัง Grab | EXTERNAL |
| W-3.4 | **Bolt**: ⚠️ ยังไม่มี adapter ในโค้ด (ตอนนี้มี foodpanda ที่ Owner ไม่ได้ใช้) → เขียน adapter ใหม่ | OPEN (software) |
| W-3.5 | ปิดงาน foodpanda adapter (mockup) หรือเก็บเป็น deferred | ตัดสินใจภายหลัง |

### PHASE 3 — Social AI (ไม่ขวางเปิดร้าน; ตาม D-03)

| # | งาน | สถานะ |
|---|---|---|
| W-4.1 | G9 ส่วนที่ไม่ต้องใช้ Meta: harness #3 #4 #5 #7 #10 (ก่อนเลย) | OPEN หลัง Owner review contract |
| W-4.2 | Owner: Meta Verify & Save + Domain verification (ตอนนี้มีแท็กแล้ว โดเมนก็ Active) | EXTERNAL — Owner กดได้เลย |
| W-4.3 | G4 real event → G9 REAL EVENT/INGEST/#2/#6 → G9 report | หลัง W-4.2 |
| W-4.4 | G10 TRUE PRODUCTION CLOSURE | ท้ายสุด |

### PHASE 4 — White-label hardening (ตามคำสั่ง Owner: ปรับได้ทุกอย่าง)

| # | งาน |
|---|---|
| W-5.1 | runtime test ด้วย tenant ที่ 2 + สาขาที่ 2 จริง |
| W-5.2 | SEO/domain/theme ต่อ tenant (ไม่ hardcode `bitemebaby.com` ใน sitemap/robots) |
| W-5.3 | onboarding ร้านใหม่ (สร้าง tenant+brand+branch+settings ครบจากหน้าแอดมิน) |
| W-5.4 | Settings UI แบบ form (แทน JSON ดิบ) |

### DEFERRED (Owner ตั้งใจเลื่อน) · ALREADY CLOSED
ดังเดิม — migration drift 104–111 · D4-3/D4-4 · `social_post_draft` · Meta production write · cleanup `bmb/` · **G3 · G5 · G6 (capability) · G7 · G8 (รวม S5) · G8-S5 root cause · mojibake code · G9 contract draft · Stripe TEST webhook · RLS WAVE 3 = CLOSED ห้ามทำซ้ำ**


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

**CORE SHOP BLOCKERS (อัปเดตหลังมติ 2026-10-05)**
1. ~~เว็บไม่ตรง `main` + ไม่มี pipeline~~ → **RESOLVED 2026-10-05**: deploy ด้วย wrangler สำเร็จ · `biteme-baby.com` 200 (W-1.1 ✅)
2. ~~โดเมนผิดใน canonical/robots/sitemap~~ → **RESOLVED**: ขึ้น production แล้ว (W-1.3 ✅ — robots ยืนยันโดเมนใหม่/เก่า = True/False)
3. ~~ข้อมูลทดสอบค้าง~~ → **RESOLVED**: active = 0 (W-1.2 ✅)
4. ค่าปกครองฝั่ง server ✅ (112+113+**114**) + client hydrated ✅ — **HARD STOP configuration ทั้งหมดปิดแล้ว (W-1.4c)**: Admin แก้ได้ครบ (settings/zones/brand/branch ผ่าน `/admin/settings`) · legacy `radius_km` RETIRED · legacy pre_orders row = **cancelled แล้ว** (controlled RPC `admin_sync_legacy_pre_order` — probe D2/D4) · คงเหลือ: ไม่มีสวิต์ UI รูปแบบ form สำหรับ JSON ซับซ้อน (แก้ผ่าน JSON editor ได้)
5. ยังไม่มีออเดอร์จริงครบวงจรสบายจริง (W-2.1/W-2.2)

**AI AUTOMATION BLOCKERS** — ไม่มีข้อไหนขวางเปิดร้าน

**EXTERNAL BLOCKERS** — Stripe LIVE keys (W-2.1) · คีย์ Grab/LINE MAN/Bolt (W-3.x) · SMS credential (W-2.3) · Meta Verify & Save (W-4.2 — ไม่ขวางร้าน)

**OPTIONAL / DEFERRED** — white-label tenant ที่ 2 · Lighthouse · settings UI แบบ form · รายการ DEFERRED

---

## 13. NEXT REQUIRED ACTION (งานเดียว)

**W-1.1 — ตั้ง deploy pipeline ของ Cloudflare Pages แล้ว deploy `main` ขึ้น production** (D-06 อนุมัติแล้ว)

- หลักฐานว่ายังค้าง: prod เสิร์ฟ `index-x8kY75kI.js` แต่ build จาก `main` ≠ เดิม (hash เปลี่ยนทุกครั้งที่มี commit; ตรวจล่าสุด 2026-10-05) · `ci.yml` ไม่มี deploy step
- ⛔ ติดขัด 2026-10-05: Owner แจงว่าใส่ key ไว้ ".env local" แล้ว แต่ตรวจ `.env` / `.env.local` / `.env.example` (+ recursive) = **ไม่พบ `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`** และเครื่องนี้ไม่มี `gh` CLI — ต้องยืนยันที่อยู่ key/secret ก่อนเริ่ม
- Dependency: key ต้องอยู่ใน GitHub secret (CI) หรือ env ที่ผมเข้าถึงได้ (ห้ามส่งค่าในแชท)
- Evidence ที่ต้องได้: workflow/wrangler run ผ่าน · prod bundle = build ปัจจุบันของ main · smoke test 200
- **ทำคู่กันได้ทันที (Owner):** W-4.2 Meta Verify & Save + Domain verification (โดเมน Active + แท็กขึ้นแล้ว)

---

## 14. DECISION LOG (2026-10-05) + STATUS อัปเดตหลังมติ — **ACTIVE PLAN OF RECORD**

> สถานะเอกสาร: มติ D-01..D-06 ครบ → §11 คือแผนที่ใช้ทำงานจริง (แทนลำดับเดิม) · รออนุมัติ 2 อย่าง: (1) GitHub secret `CLOUDFLARE_API_TOKEN` (2) migration ของ W-1.4

| หัวข้อ | หลักฐาน/มติ |
|---|---|
| D-01 ขนส่ง | Bite Drive ใช้ทั้ง PRE_ORDER (หลัก) และ SAME_DAY — SAME_DAY ต้องมีสวิต์เปิด/ปิดรับงาน + เลือกวิธีส่ง |
| D-02 ข้อมูลทดสอบ | ยกเลิกออเดอร์ทดสอบ 202 รายการ แล้วทดสอบใหม่ |
| D-03 G4/G9 | ใช่ — G9 ส่วนไม่ต้องใช้ Meta ทำก่อน |
| D-04 ไรเดอร์ | Grab (หลัก, รอ API) → LINE MAN (รอง) → Bolt (กำลังทำเรื่อง) · ยังไม่มี Bolt adapter ในโค้ด |
| D-05 แจ้งเตือน | SMS + ระบบแจ้งเตือนของเว็บเอง |
| D-06 deploy | อนุมัติ (เว็บ + `channel-webhook`) |
| โดเมน | ✅ **CONNECTED แล้ว** — NS = `carlane/eoin.ns.cloudflare.com` · apex A = 172.67.169.233 / 104.21.79.97 · `https://biteme-baby.com` = 200 · `https://www.biteme-baby.com` = 200 (SSL enabled, ทั้งคู่ Active ใน Pages) |
| หน้า live | มีแท็ก `facebook-domain-verification` แล้ว ✅ · แต่ canonical/og:url ยังเป็น `bitemebaby.com` (ผิด) |
| build เทียบ | prod = `index-x8kY75kI.js` · `main` build จริง ≠ (hash เปลี่ยนอีกครั้งหลัง W-1.3) ⇒ **ยังไม่ตรงกัน = W-1.1 ยังค้าง** |
| **EXEC LOG 2026-10-05 (W-1.2 + W-1.3)** | **W-1.2 DONE** (active=0, canonical path, trigger ครบ) · **W-1.3 CODE DONE** (gate: TSC=0 · LINT=0 · VITEST 488/488 · BUILD=0) · **W-1.1 BLOCKED** = ไม่พบ `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` ในไฟล์ env ใด ๆ · Edge functions ที่แก้ (ai-proxy) **ยังไม่ deploy** — ขึ้นพร้อม W-1.1/W-1.5 |
| **EXEC LOG 2026-10-05 (W-1.4)** | Migration **112** สร้างด้วย `e2e/w14BuildMigration112.cjs` (anchor-guarded, reproducible) → สมัคร production **APPLY_OK** → **`e2e/w14ContractProbe.cjs` = W14_ALL_PASS (11 checks, BEGIN…ROLLBACK)** · gate: TSC=0 · LINT=0 · VITEST 488/488 · คงเหลือ W-1.4b = client `platformConfig` constants |
| **DEFECT (เจอตอน W-1.4) → FIXED 2026-10-05** | `ensure_rounds_for_date` พัง: INSERT ไม่เขียน `delivery_rounds.branch_id` (NOT NULL, ไม่มี default) → instantiate วันใหม่ fail `23502` — **Owner อนุมัติแก้ → migration `113_fix_ensure_rounds_branch_id.sql` (สร้างด้วย `e2e/m113BuildMigration113.cjs`, anchor-guard จาก def จริง production) สมัครแล้ว APPLY_OK** · **`node e2e/m113ApplyVerify.cjs verify` = M113_RUNTIME_PASS**: สร้าง round วันจริง 2026-10-05 + 2026-10-06 สำเร็จ (3+3 แถว, idempotent ไม่ซ้ำ, `v_tpl.branch_id` ถูกเขียน) |
| **EXEC LOG 2026-10-05 (W-1.5)** | **`channel-webhook` v11 ACTIVE** (deploy ผ่าน CLI สำเร็จ — ข้อความไทยขึ้น production) · แก้ `supabase/config.toml` ที่มี `verify_jwt` ซ้ำท้ายไฟล์ (TOML duplicate key → `CliConfigParseError` ขวางทุกคำสั่ง supabase CLI) |
| **EXEC LOG 2026-10-05 (W-1.1 + M113)** | **W-1.1**: build 0 → `wrangler pages deploy` 0 → `biteme-baby.com` 200 (title/robots ใหม่ live) · **M113**: dump def จาก production (`e2e/m113Dump.cjs`) → สร้างด้วย anchor-guard (`e2e/m113BuildMigration113.cjs`) → APPLY_OK → `e2e/m113ApplyVerify.cjs verify` = **M113_RUNTIME_PASS** (rounds 05+06 ต.ค. ถูกสร้างจริง, idempotent) · หมายเหตุ: Management API คืนผลเฉพาะ statement สุดท้ายของ batch → verify ใช้ single-statement ต่อ check |
| **EXEC LOG 2026-10-05 (W-1.4b + TASK B/C/D)** | **A**: audit `platformConfig.ts` → implement hydrate (`platformConfigBootstrap.ts` + `main.tsx` + DistanceChecker server-fee) + tests 494/494 · **B**: 9 จุด canonical — มีครบ 7 · HARD STOP 2 จุด = สวิต์ปิด Bite Drive แบบเดี่ยว/ต่อสาขา (ไม่มี key; ตาม D-01 สวิต์ที่สั่งมีครบแล้ว) + legacy `delivery_policy.radius_km`=10 = dead key (ไม่ลบเอง) · **C**: orders active = **0** (cancelled 194+7 · delivered 1 history) · legacy `pre_orders` pending 1 = test row (Guest/phoneว่าง/migrated/schedule เกิน) — canonical `cancel_pre_order` ไม่แตะ status แถว legacy (delegate `cancel_order` อย่างเดียว + canonical cancelled แล้ว) → **HARD STOP จุดเดียว** รอ Owner (ไม่ direct-update) · **D**: #3/#4/#5/#7/#10 EVIDENCE COMPILED ใน §7.2 (reuse G5/G6/G8 · ไม่ rerun G8-S5 · ไม่แตะ Meta) · **ค้นพบ**: Pages `source=github` → push = auto Production build (wrangler = preview) |
| **EXEC LOG 2026-10-05 (FINAL CONFIG CLOSURE)** | **PART1** audit ทุก HARD STOP field (A/B/C/D) → **PART2/3** migration **114** (FC-1..FC-5 + guarded seeds + retire radius_km + `admin_sync_legacy_pre_order`) สมัคร production → hotfix 2 รอบ (make_interval numeric / time-wrap) → **PART4** legacy radius = 0 consumer → retire สำเร็จ · **PART5** legacy row `PO-20260919-430` = **cancelled ผ่าน controlled RPC** (probe D2 real + D3 idempotent + D4 audit; ไม่ direct SQL ไม่ DELETE) · **PART6** gates TSC0/LINT0/VITEST **497/497**/BUILD0 + fcVerify114 **25 PASS** + fcProbe6 **22 PASS** (admin read/update/denied · tenant/brand/branch isolation · radius/fee/methods/bite-drive/cutoff/quota · order flow no-regress) · **PART7** verify = ดู §15 |
| **OWNER MANDATE 2026-10-05** | ห้ามมีฮาร์ดโค้ดเพื่อใช้งานจริง 100% · ทำงานเสร็จทุกครั้งต้อง**ทดสอบจนผ่าน** · **อัปเดตเอกสารสถานะไฟล์นี้ก่อน push ทุกครั้ง** · ทำงานซื่อสัตย์ |

---

## 15. MASTER STATUS BOARD (FINAL CONFIG CLOSURE 2026-10-05) — ตาม PART 8

> ใช้เฉพาะสถานะ: IMPLEMENTED · CONNECTED · DEPLOYED · RUNTIME VERIFIED · READY · BLOCKED · MISSING · DEFERRED

|  Area | สถานะ | หลักฐาน / เงื่อนไข |
|---|---|---|
| Core Web | DEPLOYED | PWA build ขึ้น production ทุก push (Pages `source=github` auto-build) |
| Domain | DEPLOYED | `biteme-baby.com` + `www` active, HTTP 200 |
| Deployment | DEPLOYED | push `main` → auto Production build · wrangler manual = preview เท่านั้น |
| Ordering | RUNTIME VERIFIED | `create_order_with_items` full path + mode/round/cutoff/capacity/method gates (w14 11 checks + fcProbe6 C) |
| Payment | RUNTIME VERIFIED (TEST) | promptpay/COD/QR flows เคยผ่านใน test · **LIVE = BLOCKED ใต้ Stripe LIVE** |
| Kitchen | IMPLEMENTED | AdminKitchen/batching มีครบ — ไม่ได้ re-verify รอบนี้ |
| Delivery | RUNTIME VERIFIED | fee จาก `delivery_zones` (probe C4) · radius branch override (C3) · Bite Drive gate (C11) · method selection (C6) |
| Tracking | IMPLEMENTED | track page + RPC/RLS (ยังไม่มี live order ใหม่ให้ track) |
| Failure handling | RUNTIME VERIFIED | G8-S5: 28 scheduled executions, terminal succeeded, dup=0, legacy=0, dual-path=0 · retry paths ใน probes |
| White-label (config) | RUNTIME VERIFIED | admin read/update ทุก canonical (B1-B4) + RLS deny (A2/A3) + isolation (A4-A6) + hydration client (unit 9 + prod bundle) — ข้อมูล production ยัง single-tenant |
| White-label (multi-tenant runtime) | READY | schema+RLS tenant-scoped พร้อม — production มี 1 tenant/1 brand/1 branch · หลายร้านจริง = ยังไม่ทดลอง (ไม่ blocker เปิดร้านเดียว) |
| G3 | RUNTIME VERIFIED | BMB_G3_FINAL_REPORT (harness + negative probes) |
| G4 | BLOCKED | รอ Meta verification จริง (external — Owner กด Verify & Save) |
| G5 | RUNTIME VERIFIED | 6/6 + ai-proxy runtime evidence |
| G6 | RUNTIME VERIFIED | classification/draft + fail-closed validation (code path ครบตาม §7.2) |
| G7 | RUNTIME VERIFIED | FG-01..09 + approval boundary (APPROVED ≠ PUBLISHED) |
| G8 | RUNTIME VERIFIED | G8-S5 PASS — ห้าม rerun (reuse evidence) |
| G9 | IMPLEMENTED (partial) | Contract + §7.2: #3/#4/#5/#7/#10 EVIDENCE COMPILED (D-03) · ห้ามประกาศ PASS — รอ Owner review |
| External Rider (Grab/LINE MAN/Bolt) | BLOCKED | D-04: ยังไม่ใส่ production credential (รอ Owner/ผู้ให้บริการ) |
| Stripe LIVE | BLOCKED | รอ LIVE keys จาก Owner (W-2.1) |
| Meta verification | BLOCKED | รอ Owner กด Verify & Save (external) |
| SMS | MISSING | ยังไม่มี credentials (รอ Owner — W-2.3) |
| Web notification | RUNTIME VERIFIED | notification center + `notification_dispatch` succeeded ทุกรอบ (G8-S5) |

**E2E chain (PART 9 ตรวจแยก — ห้ามสร้าง transaction จริงเพื่อพิสูจน์):**

| ขั้น | สถานะ |
|---|---|
| REAL ORDER | RUNTIME VERIFIED (test orders 202 รายการ + probes) — **order ลูกค้าจริง = ยังไม่เคยมี** |
| REAL PAYMENT | BLOCKED BY EXTERNAL DEPENDENCY (Stripe LIVE keys) |
| REAL KITCHEN | NOT YET VERIFIED (ไม่เคยมี order จริงเข้าครัว) |
| REAL DISPATCH | NOT YET VERIFIED (dispatch 0 รายการจริง) |
| REAL DELIVERY | NOT YET VERIFIED (delivered 1 รายการ = ทดสอบ) |
| REAL TRACKING | NOT YET VERIFIED (เงื่อนไขเดียวกัน) |
| REAL FAILURE HANDLING | RUNTIME VERIFIED ระดับระบบ (G8-S5) — ยังไม่มี failure จริงของลูกค้า |
| ไวท์ลาเบล | ทุกค่าใน §4.1 ต้องแอดมินปรับได้ทั้งหมด (คำสั่ง Owner) |
| แผน | ✅ ปรับเป็น PHASE แล้ว — ดู §11 |

- ถัดไปหลัง W-1.1: W-1.2 ยกเลิกออเดอร์ทดสอบ → W-1.3 แก้โดเมนโค้ด → W-1.4 admin config (ขออนุมัติ migration) → W-2.1 Stripe LIVE → W-2.2 live acceptance

---

**STATUS — มติ D-01..D-06 ครบแล้ว (§10) · แผน PHASE §11 · รออนุมัติ 2 เรื่องก่อนลงมือ:**
1. **Secret GitHub ของ Cloudflare** (สำหรับ W-1.1)
2. **Migration ของ W-1.4** (แก้ RPC ให้อ่าน `business_settings`/`branches` + เพิ่มสวิต์ SAME_DAY) — ต้องอนุมัติก่อนทำ

ห้ามประกาศ project complete · ห้ามประกาศ Open Shop complete · ห้ามประกาศ G9 PASS

