# BMB_MASTER_REALITY_FREEZE.md
**BITE ME BABY — REALITY FREEZE / MASTER GAP MAP (Single Source of Truth for post-freeze remediation)**
**Freeze date:** 2026-09-27 · **HEAD:** `fdc7898` · **Production Supabase:** `ivkdfognyiwjcmrhcnwz` · **PWA:** `bitemebaby-5f7.pages.dev`
**Basis:** Reconcile BMB_00–BMB_06 (12 เอกสาร) + evidence artifacts ทั้งหมด (prod-phase2-audit.json, prod-phase3-e2e.json, prod-phase4-admin.json +4b, prod-phase5-operational.json, prod-phase6-{integration,bundle-scan,voicechunk}.json, p3-*/p4-* screenshots, npm test run 358/358)
**Rule:** READ-ONLY ABSOLUTE — ไม่มี code/DB/config/RLS/auth/secret/deploy mutation ใด ๆ จนกว่า Owner สั่ง
**Evidence Priority (ตัดสินทุก contradiction):** 1.Runtime/executed test → 2.Production DB/Config → 3.Source code → 4.RPC/EF/RLS → 5.Migrations → 6.Architecture docs → 7.README → 8.AI assumptions
**Status vocabulary เท่านั้น:** READY · PARTIAL · BLOCKED · BROKEN · MISSING · DORMANT · DUPLICATE · CONTRADICTED · UNKNOWN · NOT VERIFIED

---

## 1. CURRENT SYSTEM REALITY (A — สิ่งที่ระบบเป็นอยู่ตอนนี้)

BMB = Supabase-centric PWA (React 19/Vite/Zustand + 39/39 migrations live + 4/14 Edge Functions deployed) · Order/price/fee/status/payment authority = PostgreSQL RPC+trigger+RLS 100% (runtime-proven) · Customer PWA ใช้ได้ระดับ browse/cart/track · Admin login ทำงาน (ด้วย public demo creds) แต่ session ไม่ทน reload · AI ทั้งหมด BROKEN (ai-proxy 404 สด) · ไม่มี external channel/automation integration ใด ๆ · Order lifecycle จริงเคยวิ่งแค่ pending/confirmed · drivers/kitchen/provider_orders = 0 rows

**Runtime-proven READY:** order create (RPC + capacity FOR UPDATE + triggers) · status transition allow-list (DB-blocked illegal) · Stripe webhook + idempotency (PI จริง 6 events, dup=0) · delivery fee RPC+zones · rounds/cutoff/capacity per-date · RLS ทุกตาราง (anon write residue=0) · PWA SW/manifest · 0 console errors

## 2. MASTER FINDING REGISTER (deduplicated — 23 findings จริง)

| ID | Sev | Domain | Layer | Finding | Evidence | Status | Dependency | Surface |
|---|---|---|---|---|---|---|---|---|
| F-01 (S-1) | CRITICAL | Security/Auth | auth+config | Demo admin creds (admin@bmb.co.th/admin123) ใช้ได้จริง + แสดงบน public login page | Phase 4 runtime login สำเร็จ (p4-after-login.png) | BROKEN | ก่อน verify admin flows ทุกตัว | Admin ทั้งหมด |
| F-02 (S-2) | HIGH | Auth/Session | auth | Session ไม่ทน reload → /admin/* deep-link redirect 16/16 | Phase 4 prod-phase4-admin.json | BROKEN | ก่อน admin automation | Admin ทุกหน้า |
| F-03 (CRIT-AI) | CRITICAL | AI/Edge | deployment | ai-proxy ไม่ deploy — GET+POST = 404 จริง | Phase 6 live probe | BROKEN | ก่อน AI ทุก feature | AI chat/memory/recommendations |
| F-04 (AI-2) | HIGH | Security/Secrets | frontend build | aiVoice.ts:95 อ่าน VITE_OPENROUTER_API_KEY → key ฝัง lazy chunk ใน local build; production bundle ณ วันนี้ CLEAN (lazy-chunk scan) | Phase 6 voicechunk + dist scan | PARTIAL (prod ไม่มี key config → path ตาย) | พึ่ง F-03 | /voice-demo, build pipeline |
| F-05 (OP-1) | CRITICAL | Observability | DB schema | ไม่มี order lifecycle history — audit_logs ไม่มี order events | Phase 5 fn-body + data | MISSING | ก่อน kitchen/ops forensics + eventing | Orders/Kitchen/Tracking truth |
| F-06 (OP-2) | HIGH | Driver/Identity | RPC identity | driver_login auto-register จาก client-supplied phone — ไม่มี JWT binding | Phase 5 fn body | BROKEN | ก่อน assignment จริง + >5km dispatch | Rider PWA, assignments |
| F-07 (OP-3) | HIGH | Kitchen | routing | AdminKitchen ไม่มี route (DEAD) + production_batches=0 + get_kitchen_summary ไม่มี caller | Phase 4 App.tsx:36-38 + Phase 5 | MISSING | พึ่ง F-05 | Kitchen operations |
| F-08 (H-1) | HIGH | Customer PWA | frontend state | Cart ไม่ persist หลัง reload | Phase 3 runtime (p3-cart.png) | BROKEN | — | Customer PWA |
| F-09 (H-2) | HIGH | Menu/Product | data source | Home drinks/snacks = static lib ≠ DB | Phase 2/3 ยืนยันซ้ำ | CONTRADICTED | — | Home |
| F-10 (M-1) | MEDIUM | Delivery | frontend | >5km external rider block ที่ frontend (hardcode self_delivery) ทั้งที่ DB/RPC/enum รองรับ | CheckoutPage.tsx:99,201 + Phase 2 | BLOCKED | พึ่ง F-06 (>5km dispatch) | Checkout |
| F-11 (M-2) | MEDIUM | Customer PWA | UX copy | Toast "สั่งซื้อสำเร็จ" ตอน add-to-cart = misleading | Phase 3 runtime | BROKEN | — | PWA |
| F-12 (M-3/OP-4) | MEDIUM | Tracking | display state | /track no-login + timeline = client state machine อาจ drift จาก DB truth | Phase 3/5 | PARTIAL | พึ่ง F-05 | Tracking |
| F-13 (M-4) | MEDIUM | Menu | UX label | ป้าย "จองล่วงหน้า (2)" ไม่ตรงการ์ดจริง | Phase 3 runtime | BROKEN | — | Menu |
| F-14 (AI-3) | HIGH | Omnichannel | DB schema | ไม่มี source_channel/external-message-id — ไม่มี unified omnichannel order identity | Phase 6 schema scan | MISSING | ก่อนเชื่อม channel ใด ๆ | Orders schema |
| F-15 (AI-4) | MEDIUM | Edge Functions | deployment | 10/14 EF ไม่ deploy (บางตัวไม่มี caller เลย) | Phase 2 API + Phase 6 probe 404 | DORMANT | keep/drop ต่อตัว | Automation/AI/misc |
| F-16 (AI-5) | MEDIUM | Notifications | integration | in-app PWA เท่านั้น — ไม่มี email/LINE/Messenger/SMS/push | Phase 6 code+DB scan | PARTIAL | พึ่ง F-14 | Customer comms |
| F-17 (AI-6) | LOW | Security/Config | docs/env | .env/.env.example/docs ยังมี VITE_*SECRET* (.env มี SERVICE_ROLE/STRIPE_SECRET/WEBHOOK_SECRET — src ไม่อ่าน) | Phase 0 + PROD-CONTRA-3 + Phase 6 | CONTRADICTED (กับ SEC-02) | — | Build/setup docs |
| F-18 | MEDIUM | Security/RLS | DB policy | drivers auth_read using=true (authenticated อ่านได้ทุกคน) + recipes anon SELECT=true — grant กว้าง พึ่ง policy กรอง | Phase 2 RLS audit | PARTIAL (by design?) | ต้อง live-verify | RLS |
| F-19 | MEDIUM | Kitchen/Delivery | runtime usage | Order lifecycle จริงเคยไปถึงแค่ pending/confirmed — preparing→delivered ไม่เคยรันจริง | Phase 2 data_sanity + Phase 5 | PARTIAL | พึ่ง F-05/F-07 | Order spine ops |
| F-20 | LOW | Data | DB hygiene | paid-no-PI ×2 (test artifacts) · audit_logs action='test' ×6 · 3 orders ไม่มี round | Phase 2/5 | PARTIAL (อธิบายได้) | cleanup เมื่ออนุญาต | orders/audit_logs |
| F-21 (L-2) | LOW | Security | UX | Login page แสดง demo creds สาธารณะ — **merged → F-01** | Phase 3 capture | BROKEN | = F-01 | Login |
| F-22 (L-1/L-3) | LOW | Customer PWA | copy/UI | Tracking typos (กำลังงทำ/ส่งสำเรจ) · Snacks section ไม่ render | Phase 3 runtime | BROKEN | L-3 พึ่ง F-09 | Home/Tracking |
| F-23 (DEAD-CONFIG) | MEDIUM(suspect) | Config wiring | consumer | business_settings.hours + delivery_policy.radius_km ไม่มี consumer ที่ยืนยันได้ | Phase 2 settings | UNKNOWN | trace ต่อ | Settings |

**สรุป:** ปัญหาจริงค้างอยู่ = **23 เรื่อง** (CRITICAL 3 · HIGH 6 · MEDIUM 10 · LOW 4 — merge: L-2→F-01, OP-4→F-12; ไม่มีการ inflate count)

## 3. A / B / C SEPARATION (Current → Target → Remediation)

| ID | A. Current Reality | B. Required Target | C. Remediation |
|---|---|---|---|
| F-01 | demo creds usable + public | admin identity ปลอดภัย ไม่มี public creds | TBD |
| F-02 | session ตายเมื่อ reload | session ทน reload + deep-link ใช้ได้ | TBD |
| F-03 | ai-proxy 404 | AI path มี secure server-side provider boundary ที่ active | TBD |
| F-04 | key ฝัง client ใน build ที่มี env | ไม่มี provider secret ใดใน client bundle | TBD |
| F-05 | ไม่มี order status history | lifecycle history authoritative ฝั่ง DB | TBD |
| F-06 | phone = identity | identity ผูกกับ auth ที่ verify ได้ | TBD |
| F-07 | kitchen ไม่มี route, 0 data | kitchen surface ใช้ได้กับ lifecycle จริง | TBD |
| F-08 | cart ใน memory | cart ทน reload/session loss | TBD |
| F-09 | home = static lib | customer ทุกจุดอ่าน DB เดียวกับ admin | TBD |
| F-10 | >5km ไม่มี UI | delivery method เลือกได้ตาม backend capability | TBD |
| F-11/F-13/F-22 | copy/label ผิด | copy ตรงความจริง | TBD |
| F-12 | tracking = client defaults | tracking = DB truth (หลังมี history) | TBD |
| F-14 | ไม่มี channel identity | unified order identity multi-channel | TBD |
| F-15 | 10 EF ไม่ deploy | ทุก EF active หรือถูกลบอย่างมีเหตุผล | TBD |
| F-16 | in-app only | transport ตาม business scope | TBD |
| F-17 | secret patterns ใน env/docs | docs/env ไม่สอน VITE_*SECRET* | TBD |
| F-18 | grant กว้าง | grant ตรง policy intent | TBD |
| F-19 | lifecycle ใช้จริงบางส่วน | lifecycle เดินครบจริง | TBD |
| F-20/F-23 | artifacts / dead config | production สะอาด มี consumer | TBD |

หมายเหตุ: **ห้ามเขียน code plan ใน Freeze** — Remediation คง TBD ระดับ dependency (ตามคำสั่ง §12)

## 4. CONTRADICTION RESOLUTIONS (ตัดสินด้วย Evidence Priority)

| หัวข้อ | Claim เก่า | Runtime proof | FINAL STATE |
|---|---|---|---|
| ai-proxy | "may be dormant" (P1/P2 inference) | GET+POST = **404** สด (P6) | **BROKEN — runtime-proven** |
| OpenRouter secret | SEC-02 "client clean, bundle 0 hits" | aiVoice.ts:95 + local dist lazy chunk มี key จริง; prod bundle clean ณ วันนี้ | **F-04 คงอยู่** — earlier scan did not inspect the relevant lazy chunk and therefore was insufficient. ห้ามเลือกผลที่ "ดูดีกว่า" |
| Admin guard | "มี guard = ปลอดภัย" (docs) | login ด้วย demo creds สำเร็จ + session ตายเมื่อ reload (P4) | **F-01/F-02 คง severity** — Route guard ≠ secure usable admin session |
| Audit trail | audit_logs มี 31 rows | ไม่มี order events + lifecycle จริงแค่ pending/confirmed | **OP-1 = MISSING (F-05)** |
| Driver identity | driver RPC "ครบ" (P2 correction) | identity = p_driver_phone ไม่มี JWT binding | **OP-2 = HIGH / identity spoofing risk (F-06)** |
| README | 34/34 migrations, 179/163 tests | จริง 39/39 + npm test 358/358 (44 files = 22 จริง + 22 worktree duplicates) | README = STALE/CONTRADICTED (historical — marked STALE, ไม่นับเป็น finding ใหม่) |
| Stripe | ".env.example: BLOCKED" vs README "6/6" | webhook ACTIVE v41 + PI จริง 6 events | **Stripe = READY (runtime-proven)** — เอกสารเก่า STALE |

**Stale / superseded (marked, ไม่นับ):** README counts (P0) · worktree copy (P0, DUPLICATE — ห้ามใช้ evidence) · src/counter.ts + main.ts (dead code) · D16/D12 เอกสารเก่า (localStorage admin, MOCK_DRIVERS — superseded โดย HEAD code) · Phase 1 "ai-proxy active" (superseded โดย P6 runtime)

## 5. MASTER DOMAIN STATUS MAP (22 domains)

| Domain | Status | หมายเหตุ / findings |
|---|---|---|
| 1 Security/Secrets | PARTIAL | F-01, F-04, F-17 |
| 2 Auth/Authorization | PARTIAL | F-01, F-02 · RLS ทุกตาราง ✓, anon write=0 ✓ |
| 3 Customer PWA | PARTIAL | F-08, F-11, F-13, F-22 · browse/menu/track ✓ 0 console errors |
| 4 Order Spine | READY (authority) / PARTIAL (ops) | authority DB ✓ runtime-proven · F-05, F-19 |
| 5 Payment | READY (card/refund) · PARTIAL (PromptPay/COD live) | webhook+idempotency ✓ จริง · offline live = NOT VERIFIED |
| 6 Delivery | PARTIAL | fee/zones ✓ · F-10, provider DORMANT |
| 7 Driver/Rider | PARTIAL + gap | F-06, drivers=0, rider session localStorage |
| 8 Kitchen Operations | MISSING | F-07, F-19 |
| 9 Admin | BROKEN (session) | F-01, F-02 · dashboard/CRUD ✓ ผ่าน is_admin RLS |
| 10 Menu/Product | PARTIAL | F-09, F-13, L-3 · MenuPage=DB ✓ + gate 039 ✓ |
| 11 AI | BROKEN | F-03, F-04 · authority boundary ✓ (read-only) |
| 12 Edge Functions | PARTIAL | 4/14 deployed (reachable+verified) · F-15 |
| 13 Automation | MISSING | ไม่มี scheduler/queue/event path |
| 14 Omnichannel | MISSING | F-14 · FB/Messenger/LINE/Make ไม่มี implementation |
| 15 Webhooks | READY | stripe-webhook เดียว — HMAC+idempotency ✓ จริง |
| 16 Notifications | PARTIAL | F-16 · in-app + tables ✓ |
| 17 Customer Intelligence | PARTIAL/UNKNOWN | table+RPC มี · rows/consumers ไม่ได้นับ |
| 18 Content Generation | DORMANT | content_approvals=0 · approval gate ✓ design |
| 19 Observability/Audit | PARTIAL | F-05, F-20 |
| 20 E2E/QA | PARTIAL | 358/358 (44 files ปน worktree) · live E2E = NOT VERIFIED |
| 21 Architecture Debt | PARTIAL | store ×2, menu 2 แหล่ง, worktree, dead code, F-23 |
| 22 Dormant/Duplicate/Dead | PARTIAL | 10 EF · 3 dead admin pages · dup libs · aiVoice dup transport |

## 6. READY / PARTIAL / BLOCKED / BROKEN / MISSING / DORMANT MAP

- **READY (runtime-proven):** order create RPC+triggers · status allow-list enforcement · Stripe webhook+idempotency · delivery fee RPC+zones · rounds/cutoff/capacity per-date · RLS coverage · PWA install · admin unauth guard · menu gate 039 · MenuPage DB source
- **PARTIAL:** PromptPay/COD (DB ✓, live NOT VERIFIED) · preorder (1 order) · notifications (in-app) · tracking · RLS breadth (F-18) · test suite · customer intelligence · weekly menu schedule (backend ✓ ไม่มี admin UI)
- **BLOCKED:** >5km UI (F-10) · checkout/payment live E2E (ไม่มี test account + ห้าม mutation) · admin per-page automation (F-02 + rate-limit)
- **BROKEN:** AI chat (F-03) · admin session reload (F-02) · cart reload (F-08) · demo creds (F-01) · copy/labels (F-11/13/22)
- **MISSING:** order history (F-05) · omnichannel identity (F-14) · kitchen ops (F-07) · automation · Make/FB/Messenger/LINE · external notification transport
- **DORMANT:** 10 EF (F-15) · content generation · provider adapters/provider_orders · dead admin pages · duplicate libs

## 7. SECURITY / SECRET / AUTHORITY REGISTER

**Confirmed (runtime-proven):**
- F-01 demo admin creds ใช้ได้จริงบน production + public (Phase 4 login สำเร็จ)
- F-02 admin session ไม่ทน reload (16/16 redirect)
- F-04 code path อ่าน provider key ฝั่ง client + local build ฝัง key จริง (prod bundle clean ณ วันนี้)
- anon write residue = 0 · orders UPDATE block (using=false) · payment authority = DB RPC เท่านั้น · AI tools read-only · webhook HMAC + idempotency จริง (PI 6 events, dup=0)

**Risk (ยืนยัน pattern แล้ว ยังไม่พิสูจน์ exploit — ไม่เรียก confirmed vulnerability):**
- F-06 driver identity spoofing (fn body = client phone ไม่มี JWT binding — live spoof test ห้ามทำ)
- F-17 VITE_*SECRET* ใน .env/docs (src ไม่อ่าน → ไม่ leak ณ ปัจจุบัน)
- F-18 drivers/recipes read breadth (policy กรองอยู่ — ไม่ได้ live-test)

**Not Verified:**
- live cross-customer access · anon orders_read filter live · driver spoof live · offline payment live · search_path ของ 103 functions · byte-level diff function bodies · RLS policy live bypass

## 8. EXTERNAL INTEGRATION MATRIX

| Integration | Source | Provider | Auth | Runtime | DB | Idempotency | Retry | Failure Boundary | Status |
|---|---|---|---|---|---|---|---|---|---|
| Stripe | stripe-webhook EF v41 | Stripe API | HMAC whsec ✓ | **ACTIVE จริง** (PI 6 events) | PI + replay guard | ✓ DB-enforced | Stripe backoff | ไม่มี fake success ✓ | READY |
| OpenRouter | ai-proxy (source) + aiVoice (client) | OpenRouter | server key (EF) / client key ⚠️ | EF 404 · voice ไม่มี key config | ai tables | — | client fallback 1 ครั้ง | client error | BROKEN/PARTIAL |
| DeepSeek | ไม่มี | — | — | — | — | — | — | — | MISSING |
| ai-proxy | source ✓ | — | JWT (source) | 404 จริง | — | — | — | — | DORMANT/404 |
| Make.com | ไม่มี | — | — | — | — | — | — | — | MISSING |
| Facebook / Messenger | footer link เท่านั้น | — | — | — | — | — | — | — | MISSING |
| LINE | footer link เท่านั้น (phone-auto-login ไม่ใช่ LINE) | — | — | — | — | — | — | — | MISSING |
| Delivery provider | adapters ×4 | MOCKUP/Sandbox | — | ✗ | provider_orders=0 | — | — | — | DORMANT |
| Notifications (external) | ไม่มี | — | — | — | notifications/prefs ✓ | — | — | — | PARTIAL (in-app only) |

**MISSING integrations → Business Decision Required = YES** (Owner ต้องตัดสิน scope: Make.com, FB/Messenger, LINE, delivery provider, DeepSeek) — ห้าม AI DEV ตัดสินว่า "ไม่จำเป็น"

## 9. EDGE FUNCTION MATRIX (14/14)

| Edge Function | Source | Deployed | Reachable | Used By | Auth | Production Evidence | Status |
|---|---|---|---|---|---|---|---|
| create-checkout | ✓ | ✓ v33 | ✓ | paymentGateway.ts:66 | JWT | 401 live | ACTIVE |
| stripe-webhook | ✓ | ✓ v41 | ✓ | Stripe (external) | HMAC | 200 live + PI จริง | ACTIVE |
| stripe-refund | ✓ | ✓ v3 | ✓ | bmbAdminApi_orders.ts:264 | JWT | 401 live | ACTIVE |
| phone-auto-login | ✓ | ✓ v1 | ✓ | UNKNOWN caller | none | 405 live | ACTIVE (caller unknown) |
| ai-proxy | ✓ | ✗ | 404 จริง | aiService.ts:53 | — | 404 GET+POST | 404/DORMANT |
| ai-daily-report, daily-report, generate-rewards, inventory-reorder, random-menu-draw, track-share, vote-menu | ✓ | ✗ | 404 | ไม่พบ caller | — | 404 | Source-only/DORMANT |

รวม: **Active 4** · **Source-only/DORMANT 10** · บางตัวอาจตั้งใจให้ cron เรียกภายนอก = NOT VERIFIED (ไม่พบ cron ใน Supabase probe)

## 10. FINAL CUSTOMER JOURNEY REALITY (Landing → … → Delivery)

| Stage | Runtime | Backend | Frontend | Evidence | Blocking finding |
|---|---|---|---|---|---|
| Landing | ✓ render | — | home sections ผสม DB/static | p3-home | F-09, L-3 |
| Menu | ✓ 7 items | DB + gate 039 ✓ | ✓ | p3-menu | F-13 (label) |
| Product | ✓ | — | ✓ | probe | — |
| Cart | ✓ in-session | — | ✗ ไม่ persist | p3-after-add/cart | **F-08** |
| Checkout | gate ✓ | fee RPC ✓ | ✗ >5km ไม่มี | p3-checkout-gate | F-10 |
| Payment | NOT VERIFIED (ห้ามจ่ายจริง) | EF+DB READY | UI ✓ | — | ไม่มี test account |
| Order | NOT VERIFIED live | RPC READY ✓ | ✓ | Phase 2/5 | — |
| Tracking | ✓ render | getOrder ✓ | client-state timeline | p3-track | F-05, F-12 |
| Delivery | ✗ | assignments design ✓ 0 rows | ✗ | Phase 5 | F-06, F-10 |

**ห้ามเรียก "end-to-end complete"** — มี gap: cart persistence, >5km UI, order/payment live, order history, delivery ops

## 11. FINAL ADMIN JOURNEY REALITY (Login → … → Settings)

| Stage | Status | Evidence |
|---|---|---|
| Login | BROKEN-in-security (demo creds ใช้ได้) | Phase 4 login สำเร็จ |
| Session | **BROKEN** (reload → /login 16/16) | prod-phase4-admin.json |
| Dashboard | reachable ✓ (DB-driven) | p4-after-login |
| Orders/Payment/Refund | reachable (RPC authority ✓) — per-page browse BLOCKED (S-2 + rate-limit) | Phase 4 |
| Kitchen | **DEAD** (ไม่มี route) | App.tsx:36-38 |
| Menu (products) | reachable — runtime mutation NOT VERIFIED | Phase 4 §3 |
| Recipes | **DEAD** (AdminRecipes ไม่มี route) | App.tsx |
| Delivery | reachable — dispatch ไม่เคยใช้ (0 rows), MOCKUP | Phase 4 |
| Settings | reachable — hours/radius_km consumer UNKNOWN (F-23) | Phase 2 |
| PreOrders admin | **DEAD** (AdminPreOrders ไม่มี route) | App.tsx |

## 12. FINAL AI JOURNEY REALITY (User → … → Intelligence)

`User → AI UI → AI Service → Proxy/API → Provider → Response → DB/Intelligence`

- **Bite AI chat:** UI ✓ (routed, login) → aiService ✓ → **ai-proxy = 404 (จบตรงนี้)** → Provider unreachable → Response ✗ → Intelligence (ai tables มีแต่ไม่มี event ใหม่) — **BROKEN ทั้ง chain หลัง UI**
- **AI Voice (/voice-demo):** UI ✓ → aiVoice.ts direct fetch → ไม่มี VITE_OPENROUTER_API_KEY บน prod build → client error (shape = NOT VERIFIED) — **PARTIAL/RISK (F-04)**
- **OpenRouter:** provider เดียวใน code (Model A nemotron free + fallback qwen) — ไม่ active จริงที่ใด
- **DeepSeek:** MISSING ทุก layer
- **ai-proxy:** NOT DEPLOYED — runtime-proven 404
- **Tool calling / recommendations / content AI:** DORMANT (อยู่หลัง chat ที่พัง / approval=0)

## 13. MASTER DEPENDENCY GRAPH (verified จาก evidence — ไม่ใช่ ranking)

```text
F-01/F-02 Security / Secret / Admin Auth-Session Boundary
        ↓ (ต้องแก้ก่อน: ทุก verification ที่ต้องใช้ admin runtime + กัน mutate evidence ระหว่างแก้)
F-05 Order Lifecycle Audit (server-side history)      [เทคนิคไม่พึ่ง F-01 — ทำขนานได้]
        ↓ (kitchen/ops/tracking truth ต้องอ่าน history จากที่นี่)
F-07 Kitchen Operations surface
F-06 Driver Identity (bind auth↔drivers)
        ↓ (>5km dispatch ต้องมี identity ที่เชื่อถือได้)
F-10 Delivery UI (≤5/>5km) + F-19 lifecycle ใช้จริง
F-03 AI/Edge Function Deployment Decision (+F-04 secret boundary ตัดสิน transport)
        ↓ (AI features ทุกตัว + AI-transport decision)
F-14 Omnichannel Order Identity (schema) → F-15 EF keep/drop → F-16 notification transport
F-08/F-09/F-11/F-13/F-22 Customer PWA (cart/home/copy)  [เทคนิคอิสระ — ไม่พึ่ง backend chain]
        ↓
Full Production E2E (ต้องมี test account + admin session แก้แล้ว + order history + EF ตัดสินแล้ว)
```

## 14. RECONCILIATION ของ DEPENDENCY ORDER เดิม (Phase 6)

| Old order (P6) | Evidence-based check | New relationship |
|---|---|---|
| 1 secret hygiene → 2 admin session → 3 order history → 4 driver identity → 5 EF decision → 6 omnichannel field → 7 kitchen → 8 home/cart → 9 delivery UI → 10 live E2E | order history (F-05) ไม่มี technical dependency ต่อ secret hygiene — **ทำขนานได้** (old: sequential) | F-05 ถอดออกจากลูกโซ่ S-1→S-2 |
| | home/cart (F-08/F-09) ไม่พึ่ง EF deployment หรือ omnichannel field — **อิสระ** | ถอดออกจากลูกโซ่ |
| | kitchen (F-07) พึ่ง F-05 (history) เท่านั้น ไม่พึ่ง driver identity | kitchen ← F-05 เท่านั้น |
| | delivery UI (F-10) พึ่ง F-06 เฉพาะ >5km; ≤5km UI แก้ได้ก่อน | แยก ≤5 / >5 |
| | omnichannel field (F-14) ไม่พึ่ง EF deployment decision (schema ก่อน deploy เสมอได้) | F-14 ก่อน/ขนาน F-03 decision ได้ |

**ลูกโซ่บังคับจริงที่ยืนยันได้:** F-01/F-02 → (ทุก admin-runtime verification) · F-05 → F-07, F-12 · F-06 → F-10(>5km) · F-03 → F-04 → AI features · F-14 → F-16, channels

## 15. REMEDIATION WAVES — PLAN ONLY (ห้าม implement ใน Freeze)

**WAVE 1 — Security/Authority:** F-01, F-02, F-17 (+F-21 merge) · Precondition: Owner อนุมัติ rotate creds · Verify: login ด้วย creds ใหม่จาก private channel + session reload 16/16 ผ่าน

**WAVE 2 — Identity/Order Audit:** F-05, F-06, F-18 live-verify · Precondition: Wave 1 (สำหรับ admin ฝั่ง verify) · Verify: transition จริงถูก record + spoofed-phone reject

**WAVE 3 — AI/Edge/Integration:** F-03, F-04, F-14, F-15, F-16 (+Missing integrations ตาม Owner decision) · Precondition: F-04 decision (client-key ห้ามคงอยู่) + F-14 schema · Verify: live ai-proxy 200 + bundle lazy-chunk scan 0 hits + channel probe

**WAVE 4 — Kitchen/Menu/Cart/Delivery:** F-07, F-08, F-09, F-10, F-11, F-13, F-19, F-22, F-20, F-23 · Precondition: F-05 · Verify: admin แก้เมนู → customer เห็นครบทุกจุด + kitchen batch เดินต่อ order จริง

**WAVE 5 — Full E2E/Regression:** ทุก journey §10–12 · Precondition: Waves 1–4 + test account + owner อนุมัติ mutation บน test rows · Verify: live E2E pass ทั้ง customer/admin/AI

ชื่อ Wave ไม่ใช่ final — ถ้า evidence ใหม่ขัด dependency ให้เปลี่ยนตาม §13

## 16. OWNER DECISION REQUIRED (AI DEV ห้ามตัดสินเอง)

1. deploy/rebuild `ai-proxy` หรือเปลี่ยน AI architecture · 2. OpenRouter vs DeepSeek policy · 3. Make.com adoption · 4. FB/Messenger/LINE scope · 5. delivery provider scope (external rider >5km) · 6. driver model (identity binding) · 7. kitchen operating model · 8. PromptPay/offline payment policy · 9. omnichannel order source model · 10. AI content automation scope · 11. keep/drop 10 dormant EF · 12. rotate demo admin creds + สร้าง test account (จำเป็นต่อ Wave 1/5) · 13. F-18 RLS breadth "by design?" · 14. F-20 test-data cleanup

## 17. TRACE FILE

`e2e/master-reality-freeze.json` — machine-readable register + evidence map (สร้างแล้ว, read-only artifact)

## 18. ACCEPTANCE

- Phase 0–6 reconciled ✓ · findings deduplicated (23 จริง, merge L-2→F-01, OP-4→F-12) ✓ · contradictions resolved ตาม evidence priority ✓ · 23 Phase-6 findings traced ✓ · stale/superseded marked ✓ · current reality ≠ target architecture แยกชัด (§3 A/B/C) ✓ · dependency graph มี evidence (§13–14) ✓ · waves = plan only ✓ · owner decisions แยกอยู่ (§16) ✓ · **ไม่มี mutation ใด ๆ** ✓

**REALITY FREEZE = READY**

HARD STOP — รอคำสั่งจาก Owner เท่านั้น (ห้ามเริ่ม Wave 1 / remediation / implementation)