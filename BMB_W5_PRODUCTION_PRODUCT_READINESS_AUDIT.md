# BMB_W5_PRODUCTION_PRODUCT_READINESS_AUDIT.md
**W5-0 — REAL PRODUCTION PRODUCT AUDIT (AUDIT ONLY — READ-ONLY)**
วันที่: 2026-09-28 · HEAD `c0cb1a7` (== origin/main, WORKTREE CLEAN) · CI GREEN
Production: https://bitemebaby-5f7.pages.dev (Cloudflare Pages `bitemebaby`) · Supabase `ivkdfognyiwjcmrhcnwz`
Method: production runtime probes สด (`e2e/w5-prod-probes.json` + `e2e/w5ProdProbes.cjs`) + black-box customer browse สด (`e2e/prodAuditPhase3.cjs` → `prod-phase3-e2e.json`, 5/5 probes, 0 console errors) + code trace + DB probes (anon REST, read-only) + prior runtime-verified evidence (Wave 1–4, Phase 2–6 audits)
กติกา: ห้ามเอา "มี code/field/UI" = PASS · ทุก status ระบุ evidence source (CODE/DATABASE/RUNTIME/E2E/ADMIN UI/CUSTOMER PWA)

## 1. Executive Status

```text
W5-0 GATE = STOP & REPORT (พบ HIGH blocker 2 รายการ — ไม่มี CRITICAL ใหม่)

ระบบที่ RUNTIME VERIFIED / DEPLOYED จริง (2026-09-28 สด):
- Production PWA 200 สร้างได้ · manifest 200 (RUNTIME)
- Edge Functions ควบคุมสิทธิ์ครบ: ai-proxy 401(deployed✓) · stripe-webhook 400
  ERR_INVALID_SIGNATURE (บังคับ signature✓) · create-checkout/stripe-refund 401 ✓
  · automation-worker 401 ✓ · phone-auto-login 400 ✓ (RUNTIME)
- daily-report = 404 NOT_FOUND (ไม่ได้ deploy — DEFERRED / pg_cron FROZEN)
- S-1 (demo admin cred): admin@bmb.co.th/admin123 → 400 invalid_credentials
  = ยืนยันซ้ำว่ายังปิดอยู่ (RUNTIME สด)
- Anon RLS deny จริง: pre_orders / business_settings / order_status_history /
  drivers / payment_intents = 401 permission denied หมด ✓ (DATABASE+RUNTIME)

สิ่งที่ยังไม่เคยพิสูจน์บน production จริง:
- Real order→payment→delivered end-to-end — production orders = 23 rows,
  status=cancelled ทั้งหมด, SAME_DAY ทั้งหมด (test artifacts จาก Wave 2)
  → order creation/payment ถูกต้อง "ตาม contract probes + RPC ERR-control"
  แต่ lifecycle 13–17 ไม่เคยรันจริงด้วยข้อมูลจริง (NOT VERIFIED — ไม่ใช่ FAIL)
```

**HIGH (STOP & REPORT):**
- **W5-H1: Anon อ่าน PII ของ orders (delivered/cancelled) ได้จริง** — policy
  `orders_anon_read` (migration 006:177-179) `USING (status IN ('delivered','cancelled'))`
  ไม่จำกัดคอลัมน์ → probe สดอ่าน `customer_name, customer_phone, dropoff_detail,
  dropoff_latitude` ได้ = HTTP 200 พร้อมข้อมูล (บน prod ตอนนี้เป็น W2 Test Data เท่านั้น
  — ยังไม่มี PII ลูกค้าจริงโดนเปิด แต่ทันทีที่มี real delivered/cancelled order = PII
  ลูกค้าสาธารณะทันที) Evidence: DATABASE + RUNTIME สด
- **W5-H2: ไม่มี real production transaction เคยสำเร็จถึง paid/delivered** —
  ต้องการ 1 TEST-ORDER end-to-end ด้วย qa account (ตาม D-12 boundary) เพื่อพิสูจน์
  journey 10→12→13→17 จริง Evidence: DATABASE (lifecycle สด) + Phase 2–4 audits

## 2. Master Customer Journey Matrix (22 ขั้น)

| # | Journey | สถานะ | Evidence |
|---|---|---|---|
| 1 | Landing/Menu | READY — prod 200, 0 console errors, menu จาก DB + menu gate 039 | CUSTOMER PWA (probe สด 2026-09-28) |
| 2 | Product selection | READY — OrderBuilder/การ์ดแยกปุ่ม same-day/pre-order | CUSTOMER PWA |
| 3 | Cart | PARTIAL — in-session ok แต่ไม่ persist หลัง refresh (H-1 เดิม ยังไม่แก้) | CUSTOMER PWA+CODE (cartStore ไม่มี persist) |
| 4 | PRE-ORDER | IMPLEMENTED — ปุ่มแยก → RPC `create_pre_order_with_items` (server-authoritative) · real-order runtime NOT VERIFIED | CODE+DATABASE(RPC deployed)+PWA |
| 5 | SAME-DAY | IMPLEMENTED — RPC create order (007/016) · real-order runtime NOT VERIFIED | เดียวกัน |
| 6 | Scheduled date | IMPLEMENTED — trigger `enforce_pre_order_window` (ต้องอนาคต, Asia/Bangkok) + client lead-days gate | DATABASE(def สด Phase5)+CODE |
| 7 | Delivery round | IMPLEMENTED — per-date rounds โดย `ensure_rounds_for_date`; probe สดเห็น rounds 2026-09-28 ครบ 3 รอบ | DATABASE+RUNTIME สด |
| 8 | Zone/fee | IMPLEMENTED — `compute_delivery_fee_rpc` server-authoritative (SQL contracts 29/29) · >5km frontend ยัง locked (M-1) | DATABASE+E2E |
| 9 | Customer information | IMPLEMENTED — Supabase Auth + phone-auto-login EF (400 control สด) + customers location columns (015) | RUNTIME+CODE |
| 10 | Order creation | IMPLEMENTED — RPC server-authoritative: re-derive ราคา/fee/discount/total ฝั่ง DB + audit log · ไม่มี direct client INSERT (RLS own_update=false) | DATABASE+CODE |
| 11 | Order confirmation | IMPLEMENTED — order_number + /track timeline · display-state = client machine (M-3 เดิม) | CODE+PWA |
| 12 | Payment | IMPLEMENTED (contract) — Stripe: create-checkout EF re-derive amount + webhook idempotent; PromptPay: intent RPC + admin confirm · real payment NOT VERIFIED (ห้ามใช้เงินจริง) | CODE+E2E(contracts)+RUNTIME(EF สด) |
| 13 | Kitchen preparation | IMPLEMENTED — transition RPC + inventory deduct-on-confirm trigger + kitchen queue RPC · หน้า AdminKitchen DEAD (ไม่มี route) — ใช้ผ่าน /admin/orders ได้ | DATABASE+CODE |
| 14 | Ready/dispatch | IMPLEMENTED — state machine allow-list (def สด: ready_for_dispatch→dispatched) · runtime NOT VERIFIED | DATABASE |
| 15 | Delivery assignment | IMPLEMENTED — Bite Drive (020) + driver identity JWT (041, 14/14) · provider_orders จริง = 0 rows | DATABASE+E2E(W2)+RUNTIME |
| 16 | Out for delivery | IMPLEMENTED — driver_update_delivery_status + GUC sync + Rider PWA · runtime NOT VERIFIED (REAL-WORLD PILOT ค้าง) | DATABASE+CODE |
| 17 | Delivered | IMPLEMENTED (state + COD confirm ต้อง delivered) · runtime NOT VERIFIED | DATABASE |
| 18 | Order tracking | PARTIAL — /track เปิดได้, timeline แสดง; unauth เห็นเฉพาะ public statuses ตาม design | CUSTOMER PWA+DATABASE |
| 19 | Order history | READY — /orders + getOrdersPaged (W4-A, server-side pagination) | CODE+E2E(W4) |
| 20 | Admin operational | PARTIAL — ดู §5 (หลายงานใช้จนจบได้จริง · Kitchen/PreOrders/Recipes DEAD) | ADMIN UI+CODE+E2E(W1 25/25) |
| 21 | Cancellation | IMPLEMENTED — owner cancel เฉพาะ pending (allow-list def สด) + `cancel_pre_order` (window + capacity refund) + trg_pre_order_cancel_window · runtime NOT VERIFIED | DATABASE+CODE |
| 22 | Error/recovery | PARTIAL — explicit ERR_* contracts ทุก RPC · AdminErrorsPage+errorReporter มีจริง · ไม่มี runtime recovery drill | CODE+DATABASE |

## 3. PRE-ORDER vs SAME-DAY Matrix

| จุดตรวจ | ผล | Evidence |
|---|---|---|
| UI แยกชัด | PASS — ปุ่ม/ป้ายแยก 2 ชุด + CartIsolationModal ล็อกโหมดตะกร้า | CUSTOMER PWA (สด) + CODE (useCartStore isolation) |
| order_mode server-authoritative | PASS — enum order_mode (SAME_DAY/PRE_ORDER) · client แก้ orders ไม่ได้ (RLS update=false) | DATABASE (006:192) |
| Client cart mode isolation | PASS — SAME_DAY/PRE_ORDER + mode-switch confirm (unit tests 6) | CODE+E2E(unit) |
| Pre-order scheduled_date | PASS — enforce_pre_order_window (def สด: ต้องอนาคต, reject today/past) | DATABASE (RUNTIME def 2026-09-27) |
| Round binding | PASS — delivery_round_id FK + orders_increment_round trigger | DATABASE |
| **Runtime real order ทั้ง 2 โหมด** | NOT VERIFIED — ห้ามสร้าง order จริงใน audit (ต้อง owner approve TEST-ORDER) | — |

## 4. Customer PWA Matrix

| หน้า | สถานะ | Evidence |
|---|---|---|
| Home | READY (0 errors, mobile+desktop) — drinks/snacks ยัง STATIC lib (H-2 เดิม: admin แก้ไม่มีผลที่ home) | CUSTOMER PWA สด + CODE (DrinksSection/SnacksSection) |
| Menu | READY — 7 items จาก DB, gate 039 กรองถูกตาม design weekly-menu | CUSTOMER PWA สด |
| Cart | PARTIAL — in-session ✓; **ไม่ persist reload (H-1 เดิม ยังไม่แก้)** | PWA สด + CODE |
| Checkout | IMPLEMENTED — auth-gate ✓; delivery_method hardcode self_delivery (M-1) | CODE (CheckoutPage:99,201) |
| Payment | IMPLEMENTED — EF control สดถูกต้อง (401/signature) · real bill NOT VERIFIED | RUNTIME+CODE |
| PaymentConfirmation | IMPLEMENTED — PromptPay flow + mascot bye | CODE |
| Tracking | PARTIAL — timeline client machine + copy typos (L-1 เดิม) | PWA สด |
| Orders history | READY (W4 pagination) | CODE+E2E(W4) |
| PWA install | READY — manifest 200 + SW registered | RUNTIME สด |
| Loading/Empty/Error states | PARTIAL — empty states + mascot ✓ · offline cache = NOT VERIFIED | PWA |

## 5. Admin Operations Matrix ("ทำจนจบได้จริง?")

| งาน | ตอบ | Evidence |
|---|---|---|
| Login/session | ทำจนจบจริง ✓ (W1 fix: reload/deep-link 25/25 บน production) | E2E(W1 production) |
| Orders (ดู/เปลี่ยนสถานะ) | ✓ ผ่าน transition RPC + state machine | ADMIN UI+DATABASE |
| Payments (confirm/refund) | ✓ confirm_offline_payment/stripe-refund + refund จริง 1 ครั้ง (Phase 2) | DATABASE+E2E |
| Kitchen status | ✗ หน้า Kitchen DEAD (ไม่มี route) — ทำได้แค่ผ่าน /admin/orders | CODE (App.tsx:37) |
| Delivery | ✓ DeliveryManagement + Bite Drive + driver identity JWT | CODE+E2E(W2 14/14) |
| Customers | ✓ /admin/customers + stats (W4 aggregated) | CODE+E2E(W4) |
| Notifications | ✓ /admin/notifications (W3-D E2E 24/24) | E2E(W3-D) |
| Audit logs | ✓ /admin/audit-log — rows จริง (31+) | ADMIN UI+DATABASE |
| Errors | ✓ /admin/errors + errorReporter | CODE (runtime feed NOT VERIFIED) |
| Identity (admin/driver) | ✓ qa-admin + driver JWT binding | E2E(W1/W2 production) |
| Operational recovery | PARTIAL — ไม่มี drill/procedure runtime | — |
| DEAD routes: AdminPreOrders/AdminKitchen/AdminRecipes | ✗ import แต่ไม่มี route เข้าไม่ได้ (ยังไม่แก้) | CODE (App.tsx:36-38) |

## 6. Order Lifecycle Matrix
- State machine (DB enum + trigger `orders_guard_status_transition` + `order_transition_allowed` def สด): pending→confirmed→preparing→ready_for_dispatch→dispatched→in_transit→arrived→delivered (+cancelled/failed) — **IMPLEMENTED (DATABASE, def probe สด)** · allow-list เข้ม: off-list = false
- History: `order_status_history` append-only trigger (040) — verified 12/12 production (E2E W2) · backfill เดิมยังไม่ทำ (DEFERRED owner)
- **ข้อมูลจริงบน production (สด 2026-09-28): 23 orders = cancelled ทั้งหมด, SAME_DAY ทั้งหมด (test artifacts)** → lifecycle preparing→delivered ไม่เคยรันจริง (NOT VERIFIED)
- Payment state: pending→paid (+refund) — guards 008/010 idempotent + amount-match — IMPLEMENTED

## 7. Payment Matrix (existing flow เท่านั้น)
| จุด | สถานะ | Evidence |
|---|---|---|
| checkout (card) | IMPLEMENTED — create-checkout EF 401-control สด + re-derive amount ฝั่ง server | RUNTIME สด+CODE |
| webhook | DEPLOYED — 400 ERR_INVALID_SIGNATURE สด = บังคับ signature จริง | RUNTIME สด |
| paid state | IMPLEMENTED — record_payment_result RPC · client mark-paid ไม่ได้ (Single Payment Authority = DB RPC) | DATABASE+CODE |
| failed state | IMPLEMENTED (explicit error contract) | CODE |
| refund | IMPLEMENTED — stripe-refund EF 401-control สด + refund จริง 1 ครั้ง (Phase 2) | RUNTIME+DATABASE |
| idempotency | IMPLEMENTED (008/010 webhook idempotent + amount-match) | DATABASE |
| PromptPay/offline | IMPLEMENTED — intent RPC + submit ref + admin confirm_offline_payment | CODE+DATABASE |
| admin visibility | IMPLEMENTED — payment_intents + AdminOrders | ADMIN UI |
| real bill/card loop | NOT VERIFIED — ไม่มี bill จริง (ต้อง owner จ่ายจริง 1 รายการ) | — |
| Payment Events feed | FROZEN/DEFERRED ตามคำสั่ง — ไม่ตรวจ/ไม่ออกแบบใหม่ | — |

## 8. Delivery Matrix
| จุด | สถานะ | Evidence |
|---|---|---|
| ≤5 km self | IMPLEMENTED — fee server rule (30+4/km+2/item cap 9999) + zones (020: city 25/suburb 45) | DATABASE+E2E(contracts) |
| >5 km external | IMPLEMENTED ฝั่ง backend (grab/linemen/foodpanda fee rules + provider_orders) · **frontend locked (M-1)** · provider_orders = 0 rows (ไม่เคยใช้จริง) | DATABASE+CODE |
| Round | IMPLEMENTED — 3 rounds/day per-date (สด: 2026-09-28 ครบ morning/midday/evening) | RUNTIME สด |
| Assignment/status | IMPLEMENTED — Bite Drive 020 + 041 JWT binding (14/14 production) | DATABASE+E2E |
| Admin visibility | IMPLEMENTED — DeliveryManagement | ADMIN UI |
| Customer visibility (external tracking) | PARTIAL — D-05 กำหนดแสดงใน /track · frontend ยังไม่เปิดใช้ | CODE |
| Config anomaly: round-20260928-morning cutoff=23:59:59 (ควร ~06:00) | LOW → backlog | RUNTIME สด |
| Providers ใหม่ | ไม่เพิ่ม (ตามคำสั่ง) | — |

## 9. Backend Contract Matrix
| จุด | สถานะ | Evidence |
|---|---|---|
| PWA → canonical RPC | PASS — create order/pre-order/fee ผ่าน RPC เท่านั้น | CODE+DATABASE |
| Admin → canonical mutation | PASS — ผ่าน RLS is_admin + transition RPC | DATABASE |
| No direct order INSERT (client bypass) | PASS — own_create ต้อง customer_ref=uid; business writes ผ่าน RPC SECURITY DEFINER | DATABASE |
| No business-rule bypass | PASS — ราคา/fee/discount/total re-derive ฝั่ง DB ทุก path | DATABASE |
| RLS | PASS (ยกเว้น W5-H1) — anon deny จริง: pre_orders/settings/history/drivers/payment_intents | RUNTIME สด |
| Auth | PASS — Supabase Auth + qa-admin + driver JWT | E2E |
| service_role boundary | PASS — ไม่มี service key ฝั่ง client (W1: 0 hits 73 ไฟล์ deployed) | E2E+RUNTIME |
| ACL | PASS — profiles_guard_mutation + REVOKE | DATABASE |

## 10. AI / Automation Boundary
| จุด | สถานะ | Evidence |
|---|---|---|
| AI = Intelligence/Assistance ONLY | PASS — TOOLS registry = getMenu/getOrder/getProduct/getReviews/getCategories (read-only ทั้งหมด) | CODE (aiToolCalling.ts:23-77) |
| AI ห้ามมี authority: ราคา/จ่ายเงิน/สต็อก/สถานะ order/ยกเลิก-คืนเงิน | PASS — ไม่มี write tool ใดใน registry + guardrails libs แยกชั้น | CODE |
| AI transport | DEPLOYED — ai-proxy EF 401-control สด (ผล 404 จาก phase6 เดิม = ก่อน Wave 3A deploy — ปัจจุบัน deployed แล้ว) | RUNTIME สด |
| Automation = native BMB | DEPLOYED — automation-worker 401-control สด + GitHub Actions scheduler success ต่อเนื่อง (ล่าสุด 2026-09-28) | RUNTIME สด+CI |
| Supabase = Source of Truth | PASS | DATABASE |
| daily-report EF | 404 สด = ไม่ deploy (D-03 KEEP — DEFERRED; pg_cron FROZEN) | RUNTIME สด |

## 11. Security Boundary
- S-1 (demo admin cred): **ยืนยันซ้ำสด 2026-09-28 = ยังปิดอยู่** (400 invalid_credentials) — PASS (RUNTIME)
- **W5-H1 (anon PII read)**: OPEN — HIGH (ดู §1) — DATABASE+RUNTIME สด
- Secrets: 0 ใน deployed bundle (W1, 73 ไฟล์) + 0 ใน tracked src/dist (W4-E-1) — PASS
- Admin session persistence: PASS (W1 production 25/25) — E2E
- Driver identity: PASS (W2 production 14/14) — E2E
- หมายเหตุ (LOW): `adminUi.ts` ยังมี legacy email fallback (admin@/owner@bmb.co.th) ใน `shouldShowAdminLink` — เป็นการแสดงลิงก์ UI เท่านั้น ไม่ใช่ authority (authority = profiles.role + is_admin()) → backlog: ตัด fallback

## 12. Known Limitations
W5-H1 anon PII (HIGH) · W5-H2 no real transaction (HIGH evidence gap) · H-1 cart ไม่ persist (HIGH UX) · H-2 home drinks/snacks static (HIGH) · M-1 >5km frontend locked · M-3 tracking display-state client · dead admin routes 3 หน้า · daily-report 404 · morning cutoff config anomaly · offline cache NOT VERIFIED · L-1 copy typos · legacy email fallback

## 13. Frozen / Deferred Items (ไม่แตะ — ตามคำสั่ง)
OTP/SMS · P1-1 race · Meta real E2E · Facebook Group · Payment Events · Web Push/VAPID · Email/SMS/LINE · pg_cron · Supabase Pro/PITR (Owner accepted risk) · new delivery providers · D2 admin client-write (MEDIUM future) · backfill order history · REAL-WORLD delivery pilot

## 14. Owner Decisions Required
1. **W5-H1**: อนุมัติ migration แก้ `orders_anon_read` (006) — (a) ปิด anon read ทั้งหมด (/track ใช้ order_number+phone verification) หรือ (b) เปิดเฉพาะ id/status columns ผ่าน view — RECOMMENDED: (a) หรือ (b) แล้วแต่ design ของ /track ที่ต้องพิสูจน์ก่อน
2. **W5-H2**: อนุมัติ 1 real TEST-ORDER end-to-end (qa account + หน้าต่างเวลา owner) เพื่อพิสูจน์ lifecycle 10→17 จริงและปิด NOT VERIFIED
3. M-1: ยืนยันเวลา unlock >5km frontend (D-05 อนุมัติแนวทางแล้ว — แต่ต้องแตะ provider path = คิวถัดไปเท่านั้น)
4. Dead admin routes: เพิ่ม route (kitchen/pre-orders/recipes) หรือลบ nav items

## 15. Production Blockers
- **HIGH #1: W5-H1** — PII exposure policy 006 (fix = 1 policy migration — ต้อง owner approve ก่อน เพราะแตะ RLS จริง)
- **HIGH #2: W5-H2** — ไม่มี proof ว่า real customer ซื้อสำเร็จถึง delivered ได้จริง (contract ถูกทุกชั้นแต่ unproven live)
- CRITICAL ใหม่ = ไม่พบ (ai-proxy เดิม 404 หมดอายุ — deployed แล้วยืนยันสด)

## 16. Non-blocking Improvements (backlog)
cart persist (zustand persist middleware) · home menu → DB · tracking typos · /track auth-consistency · morning cutoff config แก้ผ่าน AdminRounds (ไม่ต้อง migration) · AdminErrors runtime feed drill · offline cache verification · ตัด legacy email fallback · dead routes · daily-report deploy (เมื่อ unfreeze pg_cron)

## 17. Final Readiness Verdict

```text
W5-0 = AUDIT COMPLETE — RESULT: STOP & REPORT (HIGH ×2, CRITICAL 0)

CORE PRODUCT = FUNCTIONALLY READY ตาม contract ทุกชั้น — RPC/state machine/
payment/delivery/RLS ตรวจสอบได้จริงด้วย probes สด (2026-09-28) — แต่ PRODUCTION
READINESS สำหรับลูกค้าจริงถูก 2 HIGH กั้นอยู่:
  (1) ช่อง PII ทาง policy 006 — ต้อง patch ก่อนเปิดรับ real order
  (2) ยังไม่มี 1 real transaction พิสูจน์ lifecycle จนจบ

ห้าม implement ใน W5-0 (ตามคำสั่ง) — ทุก fix รอ Owner decision
```

**HARD STOP — AUDIT ONLY · 0 code change · 0 migration · 0 provider config**
Evidence ใหม่: `e2e/w5-prod-probes.json` · `e2e/prodAuditPhase3.cjs` rerun สด 2026-09-28 (5/5, 0 console errors)