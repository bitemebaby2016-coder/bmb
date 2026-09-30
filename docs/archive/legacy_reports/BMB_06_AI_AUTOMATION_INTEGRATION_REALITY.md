# BMB_06_AI_AUTOMATION_INTEGRATION_REALITY.md

> ⚠️ **OWNER CORRECTION (2026-09-27, W3-B):** ข้อความใด ๆ ในเอกสารนี้ที่อ่านแล้วเข้าใจว่า
> "Make.com เป็น automation engine / dependency ของ BMB" = **INVALID ASSUMPTION**
> (ตาม Owner Decision ในคำสั่ง W3-B Native Automation) · ตารางด้านล่างที่ระบุ
> "Make.com = MISSING" ยังเป็นความจริงทาง code แต่ **MISSING ไม่ใช่ GAP ที่ต้องแก้ด้วย
> Make.com** — Automation ของ BMB = Native (Supabase Edge Functions + DB) เท่านั้น
> ดู `BMB_W3B_NATIVE_AUTOMATION_EVIDENCE.md` และ `docs/AUTOMATION_ARCHITECTURE.md`
**Phase 6 — Automation / AI / Omnichannel / External Integration / Failure Reality Audit (FINAL AUDIT PHASE)**
**Audit date:** 2026-09-27 · HEAD `fdc7898` · Production `ivkdfognyiwjcmrhcnwz`
**Method:** READ-ONLY — live EF endpoint probes + production bundle secret scan + code scans · ไม่ deploy/configure/trigger ใด ๆ
**Evidence:** `e2e/prod-phase6-integration.json` (+6b, +6c scripts) · code scans · ต่อยอด Phase 1-5

## 1-4. AI SURFACE + AI-PROXY RECHECK (RUNTIME PROVEN)

### Live endpoint probe บน production (2026-09-27)

| Endpoint (functions/v1) | ผลจริง | ตีความ |
|---|---|---|
| **ai-proxy (GET + POST)** | **404 "Requested function was not found"** | **NOT DEPLOYED — Bite AI chat BROKEN (พิสูจน์สด)** |
| stripe-webhook (GET) | 200 {"ok":true} | deployed + external-active |
| create-checkout (GET) | 401 UNAUTHORIZED_NO_AUTH_HEADER | deployed + JWT ✓ |
| stripe-refund (GET) | 401 UNAUTHORIZED | deployed + JWT ✓ |
| phone-auto-login (GET) | 405 | deployed (POST-only) |
| daily-report / vote-menu / generate-rewards | 404 | ไม่ deploy (10/14 ใน repo = 404) — DORMANT |

### AI paths จริง

| Path | UI | Service | Transport | Provider | Status |
|---|---|---|---|---|---|
| Bite AI chat | ✓ routed (login) | aiService → invoke('ai-proxy') | EF→OpenRouter | OpenRouter (key server-side) | **BROKEN (EF 404)** |
| Voice demo (/voice-demo, routed) | ✓ | aiVoice.ts | **direct client fetch ด้วย VITE_OPENROUTER_API_KEY** (aiVoice.ts:93-96) | OpenRouter | **RISK — key ฝั่ง client (§20)** |
| Tool calling | ใน chat | read-only tools | — | — | DORMANT |
| AI memory | ✓ | aiMemory + RPC get/save_ai_memory | DB | — | PARTIAL |
| Customer intelligence | Admin | server RPC customer_intelligence | DB | — | PARTIAL/UNKNOWN consumer |
| Content automation | Admin (0 rows) | contentAutomation → approval gate | — | — | DORMANT |
| AI recommendations | home hint | availabilityEngine + aiService | — | — | DORMANT |
| AI voice intent | /voice-demo | aiVoice | direct OpenRouter | OpenRouter | PARTIAL (key-risk) |

- Provider จริง: **OpenRouter เท่านั้น** (Model A = nvidia/nemotron-3-ultra free · fallback qwen3.7-flash — aiModels.ts:8-9) · **DeepSeek = ไม่มีใน code**
- Retry: client fallback 1 ครั้ง (aiService.ts:72-75) · EF = single call · ไม่มี timeout/circuit-breaker

## 3. AI AUTHORITY BOUNDARY

- AI tools = **read-only** (get_menu/get_order/get_product/get_reviews/get_categories) ✓
- Content AI ผ่าน approval gate (canPublish) ✓
- **ไม่พบ AI write path ต่อ price/payment/stock/refund/cancel/fee/order state** → boundary ถูกต้อง ✓

## 5-9. AUTOMATION / OMNICHANNEL REALITY

| Channel | Code | Config | DB | Runtime | Status |
|---|---|---|---|---|---|
| **Make.com** | ไม่มีใน src/functions | ไม่มี | ไม่มี | — | **MISSING** |
| **Facebook** | แค่ social link footer | ไม่มี webhook/creds | ไม่มี channel field | — | **MISSING (acquisition เท่านั้น)** |
| **Messenger** | ไม่มี | ไม่มี | ไม่มี | — | MISSING |
| **LINE** | แค่ social link (phone-auto-login ไม่ใช่ LINE) | ไม่มี | ไม่มี | — | MISSING |
| **Unified omnichannel order_id** | order_number เดียว — ไม่มี source_channel/external-message-id | — | ไม่มี enum channel | — | **MISSING** |
| Events/queue/cron | ไม่มี scheduler/queue/dead-letter | — | ไม่มี event table | — | MISSING |
| Notifications | client store/service + notifications/notification_prefs tables | — | tables ✓ | in-app เท่านั้น | **PARTIAL — ไม่มี email/LINE/Messenger/SMS/push** |

**VERDICT: BMB = single-channel PWA จริง** — ไม่มี inbound channel ใดเชื่อม order intake

## 13-16. WEBHOOK / IDEMPOTENCY / RETRY / FAILURE BOUNDARY

- Webhook production-active เดียว: stripe-webhook — HMAC verify → 400 (permanent) / 500 (Stripe retry backoff) · idempotency = record_payment_result replay guard (**DB-enforced**, 010) · duplicate → ok (prod dup_pi=0)
- ไม่มี external event path อื่นเลย (FB/LINE/Make = N/A)
- Failure boundary: order/payment authority = BMB DB เสมอ — ไม่พบ false-success path ✓

## 17-19. PROVIDER / DRIVER / AUDIT CARRY-FORWARD

- External delivery provider: adapters + provider_orders = **FOUNDATION ONLY** (0 rows, UI บอก MOCKUP เอง)
- **OP-2:** driver identity ไม่ถูกใช้โดย external automation ใด (ไม่มี automation) — เสี่ยงในขอบเขต rider console
- **OP-1 ยืนยัน:** ไม่มีระบบใด record lifecycle events → gap ชัดเจน

## 20. SECURITY / SECRETS (runtime bundle proven)

| พาธ | ผลตรวจจริง | สถานะ |
|---|---|---|
| Production initial bundle | 0 secret hits | CLEAN ณ ปัจจุบัน |
| Production lazy chunks (9 chunks จาก /voice-demo) | sb_secret 1 hit = **false positive** (supabase-js key-prefix check code) | CLEAN |
| **Local build dist VoiceDemoPage-*.js** | **openrouter_key = TRUE (sk-or-... ฝังจริง)** | **RUNTIME RISK** — ถ้า build env มี VITE_OPENROUTER_API_KEY → leak ทันที |
| src reads | VITE_OPENROUTER_API_KEY (aiVoice.ts:95) | **CONTRADICTED** กับ SEC-02 "client ไม่อ่าน key" (scan เก่าพลาด lazy chunk) |
| `.env` (local) | ยังมี VITE_SERVICE_ROLE_KEY / VITE_STRIPE_SECRET / VITE_WEBHOOK_SECRET | CONFIGURATION RISK คงเดิม (src ไม่อ่านแล้ว) |
| `.env.example`/docs | ยังสอน VITE_*SECRET* | DOCUMENTATION RISK ณ HEAD |

## 21. DUPLICATE / DORMANT SURFACE

- EF ไม่ deploy 10/14 = DORMANT · aiVoice = DUPLICATE AI transport (ขนาน ai-proxy) · customerIntelligence (client localStorage) vs customerIntelligenceServer (RPC) = DUPLICATE · content system DORMANT (0 rows) · /voice-demo routed แต่ effectively BROKEN (production ไม่มี key config)

## 22. MASTER MATRIX

| Capability | UI | Frontend | Edge/API | External | DB | Auth/RLS | Runtime | Failure Handling | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| AI chat (Bite) | ✓ | aiService | **ai-proxy 404** | OpenRouter unreachable | ai tables | login | ✗ | client error | **BROKEN** | p6 probe |
| AI Proxy | source ✓ | — | ไม่ deploy | — | — | — | 404 จริง | — | NOT DEPLOYED | phase6-integration |
| OpenRouter | — | aiVoice direct | ai-proxy (source) | OpenRouter | — | — | EF=404 · direct=ไม่มี key | fallback 1 ครั้ง | PARTIAL/RISK | aiVoice.ts:95 |
| DeepSeek | ไม่มี | ไม่มี | ไม่มี | ไม่มี | ไม่มี | — | — | — | MISSING | scan |
| Make.com | ไม่มี | ไม่มี | ไม่มี | ไม่มี | ไม่มี | — | — | — | MISSING | scan |
| Facebook | footer link | — | ไม่มี | ไม่มี | ไม่มี channel | — | — | — | MISSING | scan |
| Messenger | ไม่มี | — | — | — | — | — | — | — | MISSING | scan |
| LINE | footer link | — | — | — | — | — | — | — | MISSING | scan |
| Omnichannel order id | — | — | — | — | ไม่มี channel field | — | — | — | MISSING | schema |
| Customer Intelligence | Admin | client+server RPC | customer_intelligence | — | table ✓ | is_admin/own | PARTIAL | — | PARTIAL/UNKNOWN | Phase 2 |
| Content generation | Admin (0 rows) | contentAutomation | approval RPC | — | content_approvals | is_admin | ไม่เคยใช้ | gate ✓ | DORMANT | Phase 5 |
| Notifications | in-app | store/service | — | ไม่มี external transport | notifications+prefs ✓ | ✓ | in-app ✓ | — | PARTIAL (in-app only) | schema |
| Webhooks | — | — | stripe-webhook 200 | Stripe | PI | HMAC ✓ | ACTIVE | 400/500 + retry | READY | p6 probe |
| Idempotency | — | — | record_payment_result | Stripe | replay guard | service_role | ✓ | dup→ok | DB-enforced | Phase 5 |
| Retries | — | AI fallback 1 ครั้ง | Stripe backoff | — | — | — | partial | — | PARTIAL | code |
| Delivery provider | ✗ | adapters | — | MOCKUP/Sandbox | provider_orders=0 | — | ✗ | — | DORMANT | Phase 4 |
| Driver integration | rider PWA | driverService | driver RPCs | — | drivers=0 | phone-identity ⚠️ | ไม่เคยใช้ | — | PARTIAL + GAP | Phase 5 |

## 24. FINAL ANSWERS (ตรง 22 คำถาม)

1. **AI paths ที่ทำงานจริง:** ไม่มีเส้นทาง AI ใดทำงานจริงบน production (chat=EF 404 · voice=ไม่มี key config บน prod build)
2. **ai-proxy deployed/reachable?** ไม่ — 404 จริงทั้ง GET/POST
3. **Provider active จริง:** ไม่มี (OpenRouter = source-config เท่านั้น)
4. **AI แตะ transaction authority?** ไม่ — read-only tools + approval gate
5. **Make.com connected?** ไม่ — MISSING · **6. Facebook?** ไม่ (footer link เท่านั้น) · **7. Messenger?** ไม่ · **8. LINE?** ไม่
9. **Unified omnichannel order identity?** ไม่มี (ไม่มี source channel field)
10. **Customer Intelligence active?** PARTIAL/UNKNOWN (table+RPC มี · consumer/rows ไม่ชัด)
11. **AI content generation active?** ไม่ (DORMANT, 0 approvals)
12. **Notifications:** in-app PWA จริง (DB tables) — ไม่มี external transport
13. **Webhooks production-active:** stripe-webhook เท่านั้น · **14. Signature:** ✓ HMAC whsec
15. **Idempotency:** Stripe = DB-enforced ✓ · อื่น ๆ N/A · **16. Retry:** Stripe backoff + AI client fallback
17. **Provider failure:** payment = ไม่มี fake success · AI = client error
18. **Duplicate events:** Stripe → idempotent ok (design+010, prod dup=0)
19. **Delivery provider active?** ไม่มี (MOCKUP/Sandbox)
20. **Dormant/dead/duplicate:** 10 EF, kitchen pages, omnichannel ทั้งหมด, aiVoice (duplicate), customerIntelligence (duplicate), content system
21. **Client secret risks:** aiVoice อ่าน VITE_OPENROUTER_API_KEY (code path; prod bundle CLEAN ณ วันนี้ — lazy-chunk scan) · .env/.env.example/docs ยังมี VITE_*SECRET*
22. **Transaction authority boundary:** Supabase PostgreSQL (RPC+trigger+RLS) เสมอ

## 25. SEVERITY (ใหม่จาก Phase 6)

- **CRITICAL:** AI-1 ai-proxy ไม่ deploy → AI surface ทั้งหมดใช้ไม่ได้บน production (404 สด)
- **HIGH:** AI-2 aiVoice client-key path (local build leak พิสูจน์; prod clean ณ ปัจจุบัน) · AI-3 omnichannel ไม่มีแม้ foundation field
- **MEDIUM:** AI-4 10 EF ไม่ deploy · AI-5 notifications ไม่มี external transport
- **LOW:** AI-6 VITE_*SECRET* documentation/config risk

## 26. CROSS-PHASE CONTRADICTION CHECK

```
C6-1: Phase 2 "ai-proxy ไม่ deploy (Management API)" vs Phase 6 live probe 404 → ตรงกัน (upgrade เป็น runtime-proven)
C6-2: SEC-02 "client ไม่อ่าน AI key, bundle 0 hits" vs aiVoice.ts:95 + local dist chunk มี key → CONTRADICTED (scan เก่าพลาด lazy chunks)
C6-3: docs omnichannel (FB/LINE/Messenger/Make) vs code = ไม่มีเลย — เอกสารกล่างเกิน (MISSING)
C6-4: เอกสารเก่า D16/D12 vs HEAD code — CONTRADICTED (ยืนยันซ้ำ)
```

## 27. PRE-REALITY-FREEZE FINDING REGISTER (deduplicated)

| ID | Severity | Layer | Evidence | Status | Dependency | Surface |
|---|---|---|---|---|---|---|
| S-1 | CRITICAL | Auth | login ด้วย public demo creds สำเร็จ (P4 runtime) | UNRESOLVED | ก่อน verify admin flows ทั้งหมด | Admin |
| S-2 | HIGH | Auth | /admin/* reload → /login 16/16 (P4) | UNRESOLVED | ก่อน deep-link/automation | Admin |
| CRIT-AI | CRITICAL | Deployment | ai-proxy 404 live (P6) | UNRESOLVED (ห้าม deploy) | ก่อน AI ทุก feature | Customer AI |
| AI-2 | HIGH | Frontend/security | aiVoice อ่าน VITE key; local dist ฝัง key; prod bundle clean ณ วันนี้ | UNRESOLVED | พึ่ง CRIT-AI | /voice-demo, build |
| OP-1 | CRITICAL | DB/data | ไม่มี order history (P5) | UNRESOLVED | ก่อน kitchen/ops/automation forensics | Orders/Kitchen/Admin |
| OP-2 | HIGH | Identity | driver auto-register (P5 body) | UNRESOLVED | ก่อน assignment จริง | Rider/delivery |
| OP-3 | HIGH | Ops | Kitchen workflow DEAD (P4/5) | UNRESOLVED | พึ่ง OP-1 | Kitchen |
| H-1 | HIGH | Frontend | cart ไม่ persist (P3 runtime) | UNRESOLVED | — | Customer PWA |
| H-2 | HIGH | Data source | Home menu static ≠ DB (P2/3) | UNRESOLVED | — | Home |
| M-1 | MEDIUM | Frontend | >5km blocked (P3) | UNRESOLVED | พึ่ง OP-2 | Checkout |
| M-2 | MEDIUM | UX copy | misleading toast (P3) | UNRESOLVED | — | PWA |
| M-3 | MEDIUM | Display | tracking client-state (P3/5) | UNRESOLVED | พึ่ง OP-1 | Tracking |
| M-4 | MEDIUM | UX label | ป้ายจองล่วงหน้าไม่ตรง (P3) | UNRESOLVED | — | Menu |
| OP-5 | MEDIUM | Data | paid-no-PI ×2 (test artifacts) | อธิบายได้ | cleanup | orders/PI |
| OP-6 | LOW | Data | audit_logs action='test' ×6 | UNRESOLVED | — | audit_logs |
| L-1 | LOW | Copy | tracking typos | UNRESOLVED | — | Tracking |
| L-3 | LOW | UI | snacks section ไม่ render | UNRESOLVED | H-2 | Home |
| AI-3 | HIGH | Schema | ไม่มี omnichannel field | UNRESOLVED | ก่อนเชื่อม channels | Orders schema |
| AI-4 | MEDIUM | Deployment | 10 EF ไม่ deploy | UNRESOLVED | keep/drop ก่อน | Automation |
| AI-5 | MEDIUM | Notifications | ไม่มี external transport | UNRESOLVED | พึ่ง AI-3 | Customer comms |
| AI-6 | LOW | Config/docs | VITE_*SECRET* patterns | UNRESOLVED | — | Build/setup |
| DEAD-CONFIG | MEDIUM(suspect) | Wiring | hours + radius_km ไม่มี consumer | UNRESOLVED | trace ต่อ | Settings |

## 28. POST-AUDIT DEPENDENCY ORDER (เทคนิคล้วน)

```
1. Secret hygiene (rotate demo admin creds / purge VITE_*SECRET*)
2. Admin session persistence (S-2) — พึ่ง (1)
3. Order status history (OP-1) — ไม่พึ่งใคร; ก่อน forensics/automation
4. Driver identity model (OP-2) — ก่อน assignment จริง
5. EF deployment decision (CRIT-AI + AI-4) — ก่อน AI ทุก feature + AI-2 transport
6. Omnichannel order identity field (AI-3) — ก่อนเชื่อม FB/LINE/Make
7. Kitchen surface (OP-3) — พึ่ง (3)
8. Home menu ← DB (H-2) + cart persist (H-1)
9. Delivery method UI (M-1) — พึ่ง (4)
10. Live E2E ทั้ง flow — พึ่ง (2)(5)(9) + test account
```

## 29. STATUS

**PHASE 6 COMPLETE** (live endpoint probes + bundle scan + code scans ครบ)

NOT VERIFIED คงเหลือ: error shape จริงของ aiVoice direct path บน production · customer_intelligence rows/consumers

**REALITY FREEZE READY — HARD STOP รอคำสั่งถัดไป**