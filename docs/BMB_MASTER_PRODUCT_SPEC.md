# BMB — MASTER PRODUCT SPECIFICATION (ข้อกำหนดผลิตภัณฑ์มาตรฐาน)

> **Canonical product requirements** ตาม protocol §2.5 — เอกสารนี้กำหนดขอบเขต ผลิตภัณฑ์ กติกาธุรกิจ ที่ได้รับอนุมัติแล้ว
> - ไม่แก้ไขได้โดยอัตโนมัติ — เปลี่ยนได้เฉพาะเมื่อมี **Owner explicit decision**
> - รวม: Product Vision, User Journeys, Business Rules, Approved Scope, Non-Functional Requirements
> - อ้างอิงจาก: README.md (current), BMB_CUSTOMER_JOURNEY_RECOVERY_GATE, BMB_OPENING_READINESS_MASTER, BMB_OWNER_LAUNCH_CHECKLIST

---

## 1. PRODUCT VISION & SCOPE

### 1.1 Product Identity
- **Name:** BITE ME BABY — แพลตฟอร์มสั่งอาหารพร้อม AI Waiter (PWA)
- **Business:** ร้าน Bite Me Baby (ครัวกลาง/Cloud Kitchen จันทบุรี)
- **Production URL:** https://biteme-baby.com (Cloudflare Pages auto-deploy from `main`)
- **Repository:** `D:\A PROJECT\Bite Me Baby` → `github.com:bitemebaby2016-coder/bmb`

### 1.2 Core Value Proposition
รวม 3 ระบบใน PWA เดียว:
1. **หน้าร้านลูกค้า** — ค้นเมนู ดูรอบจัดส่ง ใส่ตะกร้า ชำระเงิน ติดตามออเดอร์ (เส้นทางสั่งซื้อเส้นเดียว canonical ทั้ง same-day และ pre-order)
2. **Bite AI Waiter** — แชท/เสียงสั่งอาหารภาษาไทยจากข้อมูลร้านจริง (เมนู+ราคา รอบส่ง โปรโมชั่น สถานะออเดอร์) ผ่าน Edge Function `ai-proxy` (SSE) + AI Sales บนคอมเมนต์/แชท Facebook-LINE (EF `social-ai-worker`)
3. **Admin Dashboard** — จัดการออเดอร์ เมนู สต็อก รอบจัดส่ง ลูกค้า สื่อ โปรโมชั่น หลายสาขา พร้อม RLS isolation ซ้อน 2 ชั้น

### 1.3 Approved Scope (In Scope)
| Feature Area | Status | Notes |
|--------------|--------|-------|
| Same-day + Pre-order + Delivery Rounds | ✅ Production | RPC validated cutoff/capacity |
| Payment: Omise (Card) + QR PromptPay + COD | ✅ Production | Omise TEST card pending Owner verification |
| Stripe Fallback | ✅ Production | Legacy fallback while Omise not fully configured |
| AI Chat/Voice (Talk to Bite) | ✅ Production | SSE via `ai-proxy` EF |
| Food Theater (Home page carousel) | ✅ Production | 7-day rotating copy, real catalog signals |
| Admin Dashboard (26 pages) | ✅ Production | Multi-branch, RLS 2-layer |
| Delivery Zones / Fees / ETA / Driver Ops | ✅ Production | GPS matrix pending Owner test |
| Queue Dispatch + Automation Workers | ✅ Deployed | EF: queue-*, automation-*, social-* |
| PWA (Manifest, Offline, SW) | ✅ Enabled | vite-plugin-pwa |
| CRM Automation (Winback + Birthday) | ✅ Production | pg_cron, consent-gated (`crm_consent`) |
| BKK Date Guards (m190–193) | ✅ CI Enforced | Class `CURRENT_DATE` closed, 9 fn guarded |
| Social Omnichannel (Meta/LINE) | ✅ Deployed | EF `social-ai-worker` (R104), steps 3–5 done |
| Cross-channel Cart (Deep-link + Server Sync) | ✅ Production | R101–R104, R103 server sync |
| Background Music (File-based + RLS) | ✅ Production | Bucket `background_music`, m196 fixed |
| Sticker Printing (1/order, Bluetooth/QZ-Tray) | ✅ Production | `stickerQueue.ts` R63d consolidated |
| E2E Probes (Order journey 12/12, TTB 5/5) | ✅ Done | Conditions for launch = §10 |

### 1.4 Explicitly Out of Scope (Not Approved)
- Server-side cart sync for guest (R103: guest = deep-link only)
- LINE/IG in-app browser native support (hook ready, waiting for channel)
- Advanced CRM consent granularity (C-5 blocked)
- Coupon stacking business rules (C-3 blocked)
- Vote reward points integration (C-4 blocked — m208 explicitly does NOT touch points_ledger)
- Multi-branch delivery zone conflict resolution (C-2 blocked)
- Pre-order vs same-day cutoff overlap rules (C-1 blocked)
- Floating ad vs Mascot z-index priority (C-6 blocked)
- Google Maps key fix (Owner side — Leaflet/OSM fallback is approved PASS)

---

## 2. USER JOURNEYS (Canonical Flow)

### 2.1 Customer Journey (Verified from Code)
```
/ (TalkToBite landing) ─→ /shop (FoodTheater: picks จาก catalog จริง)
       │                      │
       │                 /menu (เมนูทั้งหมด + แท็บกรอง)
       ▼                      ▼
  แชทสั่งอาหาร ─────────→ ตะกร้าเดียว (cartStore, canonical)
                              │
                    /checkout?mode=same-day | pre-order
                    (รอบจัดส่ง + cutoff + capacity ตรวจที่ RPC)
                              │
              ชำระเงิน: บัตร Omise · QR PromptPay · เงินสดปลายทาง
                              │
              /track/:orderNumber → /orders (ประวัติ)
```

**Implementation Anchors:**
- `parseOrderIntent`/`applyOrderModify` (`src/lib/talkToBite.ts`) → `cartStore.addItem` เส้นเดียว
- `paymentGateway.createCheckout` (บัตรหลัก = Omise cutover, Stripe fallback)
- Webhook idempotent

### 2.2 Cross-Channel Journey (R101–R104)
- **Facebook IAB/WebView** → AI สรุปออเดอร์ → `?cart=` deep-link (v2 payload with mods/line_mode)
- **InAppBrowserBanner** ใช้ตะกร้าสด ณ เวลากด (`liveCart` subscription hook)
- **External Browser (Chrome/Safari)** → คัดลอกลิงก์ → ตะกร้าตรงทุกตัวเลข (H-1, I-5)
- **AI Reply Contract:** "1 reply = 1 ลิงก์ของระบบ" — AI ห้ามเขียน URL เอง ทุก reply มี CTA ร้านอันเดียว (R104)
- **Layout `?cart=` Semantics:** **"ตั้งตะกร้าตามลิงก์" (replace)** — resolve ก่อน clear, guard fingerprint dedup (R102/R104)

### 2.3 Cross-Device Cart Sync (R103)
- **Authenticated User:** Server-side sync via `cart_sessions.payload` (deterministic `csa-<customerId>`)
  - Login → auto restore from server (local empty = try server)
  - Logout/Login → server cart persists
  - Multi-device → same account = same cart (5-10s eventual consistency)
- **Guest:** No server sync (R63 posture) — deep-link `?cart=` only

### 2.4 Rider Journey
1. `/rider` → แท็บ "วันนี้" / เดือน / "วันส่ง/วันมอบหมาย" (R52 history tabs)
2. รับงาน → Check-in (GPS + POD) → "🛵 รับอาหารเพื่อเดินทางออกส่ง" (m212 hop chain)
3. Complete delivery → POD photo + timestamp → Customer sees real-time (5s polling when rider visible)
4. Error handling: retry button (kind !== 'state'), ErrorBoundary, structured logging

### 2.5 Admin Journey
- `/admin/marketing` — Control Center: โพสต์ 5 รูป + Studio picker tabs + Floating Ad config (R78/R79/R80)
- `/admin/delivery` — Dispatch queue + preparing badge + kitchen link + map (OSM)
- `/admin/settings` — Business settings, Background music, Floating ad, CRM kill-switch
- History/Audit panel (`getOrderStatusHistory` + `getOrderAuditTrail`)

---

## 3. BUSINESS RULES (Approved & Enforced)

### 3.1 Order & Cart Rules
| Rule ID | Rule | Enforcement |
|---------|------|-------------|
| **BR-CART-01** | 1 Cart = 1 Order (R5c invariant) | `cartStore` canonical, server sync via `cart_sessions` |
| **BR-CART-02** | Cross-device sync: authenticated only | R103: `cartSessionSync.ts` guest guard + `fetchLatestServerCart()` |
| **BR-CART-03** | Deep-link `?cart=` = REPLACE (not add) | R104: `Layout.tsx` resolve→clear→add, fingerprint guard |
| **BR-CART-04** | Guest cart: localStorage only, no server | R63 posture preserved, `cartSessionSync` returns null for anon |
| **BR-CART-05** | Cart payload: no prices/totals/PII | `serializeCartObject` — ids/qty/customizations/mode/coupon/referral only |

### 3.2 Order Lifecycle
| Rule ID | Rule | Enforcement |
|---------|------|-------------|
| **BR-ORD-01** | Same-day: cutoff enforced at RPC | `create_checkout` validates round cutoff |
| **BR-ORD-02** | Pre-order: round capacity enforced at RPC | `create_checkout` validates `capacity` |
| **BR-ORD-03** | Delivery status canonical hop chain | m212: `preparing → ready_for_dispatch → dispatched → in_transit → arrived → delivered` |
| **BR-ORD-04** | `preparing` cannot skip to `dispatched` | m212 guard: `pending/confirmed` raise `ERR_KITCHEN_NOT_READY` |
| **BR-ORD-05** | POD required for `delivered` | `driver_update_delivery_status` validates `proof_of_delivery_path` |
| **BR-ORD-06** | Admin close cycle: `admin_advance_delivery_status` | Canonical RPC with audit message |
| **BR-ORD-07** | Sticker: 1 per order (consolidated items) | R63d: `stickerRollForOrder` returns single element array |

### 3.3 Payment Rules
| Rule ID | Rule | Enforcement |
|---------|------|-------------|
| **BR-PAY-01** | Primary: Omise (server-side charge + 3DS) | EF `omise-create-checkout` + `omise-webhook` idempotent |
| **BR-PAY-02** | Fallback: Stripe (legacy) | EF `stripe-create-checkout` + `stripe-webhook` |
| **BR-PAY-03** | QR PromptPay + COD | `paymentGateway.ts` unified interface |
| **BR-PAY-04** | Webhook idempotency: `order_number` + `payment_intent_id` | All payment EFs |

### 3.4 AI Waiter Rules
| Rule ID | Rule | Enforcement |
|---------|------|-------------|
| **BR-AI-01** | Talk to Bite: state machine in `talkToBite.ts` | `parseOrderIntent` → `applyOrderModify` → `cartStore.addItem` |
| **BR-AI-02** | Memory: options/customizations persisted to cart/order | R73e–g: repeat "เหมือนเดิม" carries customizations + notes |
| **BR-AI-03** | "ขายดีช่วงนี้": ranked from real 30-day sales | No data = no decoration (no fake claims) |
| **BR-AI-04** | Help topics: 6 deterministic answers before LLM | `faqContent.ts` single source |
| **BR-AI-05** | Social AI: "1 reply = 1 system link" | R104: `stripBareShopLinks` + `social-ai-worker` default CTA |
| **BR-AI-06** | AI never writes bare shop URLs | `socialLinkFormat.ts` strips all `biteme-baby.com` variants |

### 3.5 CRM Automation Rules
| Rule ID | Rule | Enforcement |
|---------|------|-------------|
| **BR-CRM-01** | Winback: 45 days inactive | `automation-winback` EF, pg_cron daily |
| **BR-CRM-02** | Birthday: BKK date | `automation-birthday` EF, pg_cron daily |
| **BR-CRM-03** | Consent-gated: `customers.crm_consent` only | In-app notification only for consented users |
| **BR-CRM-04** | Kill-switch: `business_settings['crm_automation']` | Boolean flag disables all CRM automation |

### 3.6 Background Music Rules
| Rule ID | Rule | Enforcement |
|---------|------|-------------|
| **BR-MUS-01** | File-based only (no synth) | `createAudioFileEngine` HTMLAudioElement |
| **BR-MUS-02** | Master gate: `business_settings.ambient_music.enabled` | `AmbientMusicManager.toggle()` checks before play |
| **BR-MUS-03** | Ducking: 25% volume when Bite speaks | `ambientMusic.ts` ducking 0.25s ramp / restore 0.6s |
| **BR-MUS-04** | Bucket: `background_music` with RLS | m196: bucket_id literal policies (anon SELECT, admin INSERT/UPDATE/DELETE) |
| **BR-MUS-05** | Empty bucket = UI shows "ไม่มีเพลงใน bucket" | `AmbientMusicToggle` emptyBucket state, no synthetic fallback |

### 3.7 Delivery Rules
| Rule ID | Rule | Enforcement |
|---------|------|-------------|
| **BR-DEL-01** | Zone/fee: `deliveryRouter` + `routeOptimization` | Multi-branch, GPS matrix |
| **BR-DEL-02** | Rider assignment: `my_deliveries` v3 (m210/211) | Scheduled jobs, has_sched column |
| **BR-DEL-03** | Map fallback: Leaflet/OSM when Google key denied | Approved PASS condition (E-3, E-4, E-5) |
| **BR-DEL-04** | Rider polling: 5s when visible (dispatched/in_transit/arrived) | `OrderTrackPage` conditional polling |

### 3.8 Multi-Branch & RLS
| Rule ID | Rule | Enforcement |
|---------|------|-------------|
| **BR-RLS-01** | 2-layer RLS: org + branch isolation | All tables, migrations 001–213 |
| **BR-RLS-02** | Admin sees all branches, staff sees own | Role-based policies |
| **BR-RLS-03** | Customer data isolated by branch | `customers.branch_id` FK + RLS |

---

## 4. NON-FUNCTIONAL REQUIREMENTS

### 4.1 Performance
- **Build:** Vite 8 + PWA, target ES2022, code-splitting
- **Bundle:** ≤500KB initial JS (gzipped)
- **API:** Edge Functions <500ms p95 (Supabase)
- **Database:** Connection pooling (Supabase), indexes on FK + status columns

### 4.2 Reliability
- **CI/CD:** GitHub Actions — lint → test → build → deploy (Node 24)
- **Contract Testing:** Migration replay on ephemeral Postgres (CI) + legacy contracts 7/7 + BKK-date class guard
- **Error Boundaries:** React error boundaries on critical paths (Delivery, Payment, AI)
- **Retry Logic:** Exponential backoff on EF calls, idempotent webhooks

### 4.3 Security
- **Auth:** Supabase Auth (Email/Password, OAuth: Google/Facebook/LINE, Passkey)
- **RLS:** 2-layer on all tables (org + branch)
- **Secrets:** Supabase Secrets only (never in repo/.env)
- **CORS:** Configured per bucket/function (background_music, bmb-images)
- **Rate Limits:** Supabase built-in + custom on AI proxy

### 4.4 Accessibility (PWA)
- **Touch Targets:** Global min 48×48px (index.css)
- **Safe Area:** iOS notch/Android cutout (env-safe-area-inset)
- **Offline:** SW precache 165 entries, offline-first
- **Manifest:** `display: 'standalone'`, Apple PWA meta tags

### 4.5 Localization
- **Primary:** Thai (th-TH)
- **Date/Time:** Asia/Bangkok (UTC+7) enforced — BKK date guards (m190–193)
- **Currency:** THB (฿), no decimals
- **Copy:** 7-day rotating theater copy (business_settings `theater_daily_copy`)

---

## 5. TECHNICAL ARCHITECTURE (Approved Stack)

### 5.1 Frontend
| Layer | Technology | Version |
|-------|------------|---------|
| Framework | React | 19 |
| Language | TypeScript | 5.9 |
| Build | Vite | 8 |
| Styling | Tailwind CSS | 4 |
| PWA | vite-plugin-pwa | latest |
| Routing | react-router-dom | 7 |
| State | Zustand | latest |
| SEO/Metadata | react-helmet-async | latest |
| Testing | Vitest | latest (230 files / 2,521 tests) |
| E2E | Playwright | latest (probes in `e2e/`) |

### 5.2 Backend (Supabase)
| Component | Details |
|-----------|---------|
| Database | PostgreSQL 16 (Supabase) |
| Migrations | 213 files (001–213) in `supabase/migrations/` |
| RLS | 2-layer (org + branch) on all tables |
| Edge Functions | 24 deployed + `_shared` lib |
| Auth | Built-in + Custom OIDC (LINE) |
| Realtime | WebSocket for order tracking, rider location |
| Storage | Buckets: `bmb-images`, `background_music`, `Bite_Mascot` |
| Cron | pg_cron (CRM automation, queue scheduler) |

### 5.3 Edge Functions (24 Deployed)
| Function | Purpose |
|----------|---------|
| `ai-proxy` | SSE AI streaming (Talk to Bite) |
| `omise-create-checkout` / `omise-webhook` | Omise payment (primary) |
| `stripe-create-checkout` / `stripe-webhook` | Stripe fallback |
| `create-checkout` | Unified checkout orchestrator |
| `queue-dispatch` / `queue-retry` / `queue-scheduler` | Order dispatch automation |
| `sms-send` / `push-send` | Notifications |
| `voice-tts` | AI voice TTS |
| `channel-webhook` | Meta/LINE webhook receiver |
| `social-ai-worker` | AI order summary from social (R104) |
| `social-order-intake` | Shared lib for social cart footer |
| `automation-winback` / `automation-birthday` | CRM automation (m192/193) |
| `resolve-kitchen-point` | Kitchen location resolver |
| `rider-location-update` | Rider GPS updates |
| `delivery-status-sync` | Canonical delivery RPCs |
| `cart-session-sync` | Server-side cart sync (R103) |
| `background-music-upload` / `background-music-list` | Music management |
| `floating-ad-config` | Floating ad configuration |

### 5.4 CI/CD
- **Workflow:** `.github/workflows/ci.yml` — push `main`/PR → `npm ci` → lint → test → build
- **Deploy:** Cloudflare Pages auto-deploy from `main` (2-3 min)
- **Contract Tests:** `.github/workflows/contract-tests.yml` — migration replay + legacy contracts + BKK-date guard + nightly-sim

---

## 6. LAUNCH READINESS CRITERIA (§10)

**Product is NOT considered ready for real orders until ALL below are CLOSED:**

| # | Criterion | Status | Blocking Task |
|---|-----------|--------|---------------|
| 1 | Owner ทดสอบจริงบน production: Omise TEST card + GPS/delivery matrix + §R73h + §R67–§R73 + **กลุ่ม H/I** | ❌ BLOCKED | I-1..I-8, H-1..H-6, OMISE-TEST, T-A1..A6, T-D, T-E |
| 2 | **CONFLICT C-1..C-6** resolved by Owner | ❌ BLOCKED | C-1..C-6 |
| 3 | Runtime tests ด้วยอุปกรณ์/บัญชีจริง (test pack §T) | ❌ BLOCKED | T-A1..A6, T-D, T-E, CAP-10/11/13/14/18 |
| 4 | Omnichannel Meta/LINE live test (กลุ่ม H/I) | ❌ BLOCKED | I-1..I-8, H-1..H-6 |
| 5 | ✅ E2E order journey 12/12 (R67) | ✅ DONE | — |
| 6 | ✅ Chat-hang fixed | ✅ DONE | — |
| 7 | ✅ SEO routes complete | ✅ DONE | — |
| 8 | ✅ Production DB audit (R62–R68) | ✅ DONE | — |
| 9 | ✅ UTC-vs-BKK time-bomb closed (m190–193) | ✅ DONE | — |
| 10 | ✅ Background music RLS fixed + live verified (R105b) | ✅ DONE | — |
| 11 | ✅ Rider delivery sync (m212) + my_deliveries (m210/211) | ✅ DONE | — |

---

## 7. CHANGE CONTROL

### 7.1 Product Spec Changes
- **Only Owner explicit decision** can modify this document
- AI agents MUST NOT reduce, redefine, or reinterpret requirements to claim completion
- Any discrepancy between code and this spec = `DOC DRIFT` — flag and follow Source of Truth hierarchy (UNIVERSAL_MASTER_AI_RULES §2.1)

### 7.2 Version History
| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-11-24 | AI Consolidation | Initial canonical spec from README.md + BMB_MASTER_STATUS.md + Work Queue analysis |

---

## 8. RELATED CANONICAL DOCUMENTS

| Document | Purpose |
|----------|---------|
| `docs/BMB_MASTER_STATUS.md` | Current verified state (Source of Truth) |
| `docs/BMB_WORK_QUEUE.md` | All outstanding work (Live Tests + Blocked + Owner Decisions) |
| `docs/BMB_CHANGELOG.md` | Historical development records (all R-series) |
| `docs/BMB_AI_WORKING_STATE.md` | AI development instructions + protocol enforcement |
| `AI_ENTRYPOINT.md` | Mandatory bootstrap for all AI sessions |
| `UNIVERSAL_MASTER_AI_RULES.md` | Non-negotiable operating rules |
| `docs/BMB_REQUIREMENT_RECONCILIATION.md` | C-1..C-6 conflict details |
| `docs/BMB_PRODUCTION_TEST_PACK.md` | Production test pack §RG/§16/§T detail |
| `docs/BMB_OPENING_READINESS_MASTER.md` | Launch readiness master checklist |
| `docs/BMB_OWNER_LAUNCH_CHECKLIST.md` | Owner launch checklist |