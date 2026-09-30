# BMB_05_OPERATIONAL_REALITY_AUDIT.md
**Phase 5 — Cross-System Operational Reality Audit: ORDER → PAYMENT → KITCHEN → DELIVERY → TRACKING**
**Audit date:** 2026-09-27 · HEAD `fdc7898` · Production `ivkdfognyiwjcmrhcnwz`
**Method:** READ-ONLY production SQL probes (22 queries, function-body level) + code trace + runtime จาก Phase 3/4 — **ไม่มี mutation/transaction ใด ๆ** (S-1/S-2 ไม่ถูกแตะ)
**Evidence:** `e2e/prod-phase5-operational.json` (+`prodAuditPhase5.cjs`) · ต่อยอด `prod-phase2-audit.json`, `prod-phase3-e2e.json`, `prod-phase4-admin.json`

## 1-2. ORDER CREATION / PRE-ORDER REALITY

**Path เดียว canonical สำหรับทั้งสอง mode** (ยืนยันซ้ำที่ function-body level บน production):

```
Customer UI (CheckoutPage.handlePlaceOrder)
  → client gates: SAME_DAY = cutoff_time/capacity (ICT assumption) · PRE_ORDER = lead-days
  → RPC create_order_with_items (def 13,523 chars, SECURITY DEFINER)
      ภายใน body จริง (position probe):
        max_capacity @2817 · current_count @2831 · cutoff_time @2862
        delivery_rounds @2970 · FOR UPDATE (row lock) @3025
        → capacity check = per date+round ด้วย SELECT ... FOR UPDATE (ป้องกัน race)
  → enforce_operating_hours (BEFORE trigger) — อ่าน business_settings.operating_hours
        mode gate: PRE_ORDER/same_day_open=false → ERR_ORDER_MODE_CLOSED
        round gate: (round_key||'_open')=false → ERR_ROUND_CLOSED
  → enforce_menu_gate (trigger) · enforce_pre_order_window (trigger, PRE_ORDER)
  → RLS orders_own_create (customer_ref = auth.uid())
  → orders row (order_mode enum, scheduled_date, status=pending, payment_status=pending)
  → order_items rows
```

- PRE_ORDER: `create_pre_order_with_items` / `quote_pre_order` / `validate_pre_order_delivery` มีจริง (pre_orders=1, orders mode=PRE_ORDER 1) — **READY (DB/RPC) · live E2E = NOT VERIFIED**
- Admin config → DB ✓ — **NOT VERIFIED AT ADMIN RUNTIME (Phase 4 S-2 + rate-limit)**

## 3. SAME-DAY REALITY

- Production rounds จริง (15 rows): morning cutoff 05:00-08:00 cap 60 · midday cutoff 09:00-10:30 cap 80 · evening cutoff 16:00 cap 100 (per-date)
- AFTER CUTOFF / CAPACITY EXCEEDED: **DB ปฏิเสธเอง** (body refs cutoff_time + FOR UPDATE row lock) — DB-proof ✓ · live runtime = NOT VERIFIED
- capacity data จริง: current_count ตรง orders ต่อรอบ (round-1/2/3 = 6/5/2) ✓

## 4-5. ORDER STATE MACHINE + ILLEGAL TRANSITIONS

Production body จริง `order_transition_allowed` (SECURITY DEFINER):
- Admin: linear allow-list pending→confirmed→preparing→ready_for_dispatch→dispatched→in_transit→arrived→delivered · cancel/failed จากทุก non-terminal · **ELSE → RETURN false (F-1/030 live)**
- Customer (owner): **pending→cancelled เท่านั้น**
- Enforced โดย BEFORE UPDATE trigger → **illegal transitions (completed→preparing, pending→completed, cancelled→preparing) = BLOCKED ที่ DB** (live destructive test = ห้ามทำ)
- Client UPDATE ถูก RLS block (orders_own_update using=false) · client orderStateMachine = DISPLAY-ONLY (ยืนยันซ้ำ)

## 6-7. PAYMENT AUTHORITY + CONSISTENCY

- `confirm_offline_payment` (production body): **is_admin() บรรทัดแรก → ERR_FORBIDDEN** · idempotent (paid → ok) · COD ต้อง delivered (ERR_COD_NOT_DELIVERED) → authority = DB RPC (admin) เท่านั้น ✓
- `record_payment_result` = webhook-side authority (service_role) + idempotency · Stripe webhook EF v41 เคยทำงานจริง (PI completed 5, refunded 1)
- Consistency (production จริง): delivered-not-paid=0 · cancelled+paid=0 · PI-without-order=0 · duplicate-PI=0 · orphan items=0 · paid-no-PI=2 (test artifacts 2026-09-19 เท่านั้น)

## 8. KITCHEN REALITY

- **AdminKitchen = DEAD (no route)** — ตรวจ surface อื่น: production_batches=0, production_batch_items=0, provider_orders=0
- get_kitchen_summary/create_production_batch มีใน DB แต่ **ไม่มี active caller ใน code**
- **VERDICT: Kitchen operational surface = MISSING/DEAD** (foundation schema+RPC มี แต่ไม่มี workflow — dashboard cards ไม่ใช่ Kitchen Command Center)

## 9. ROUND / CAPACITY REALITY

- capacity enforce **per date AND per round** จริง (FOR UPDATE + per-date rows) · ไม่พบ global/client capacity เป็น authority · ค่าจริง per-date ไม่ใช่ค่าตายตัวตามเอกสารเก่า

## 10-12. DELIVERY / DRIVER / EXTERNAL RIDER

- **driver_login (production body): เบอร์ไม่พบ → INSERT driver ใหม่ให้อัตโนมัติ** — ใคร authenticated ก็กลายเป็น driver ได้ → **rider identity = ไม่ trusted (HIGH)**
- driver_accept_assignment: identity = p_driver_phone → drivers lookup → assignment assigned→accepted (chain assigned→picked_up→in_transit→delivered ในตาราง)
- drivers=0 · assignments=0 · provider_orders=0 (ยืนยันซ้ำ)
- External rider: UI ยอมรับเอง MOCKUP/Sandbox — **FOUNDATION ONLY** · >5km contradiction คงเดิมที่ HEAD

## 13-14. TRACKING + STATE MODEL MAP

| State | แหล่งจริง | ประเภท |
|---|---|---|
| orders.status / payment_status | DB enum + trigger + RPC | **AUTHORITATIVE** |
| payment_intents.status | DB + webhook/admin RPC | AUTHORITATIVE |
| delivery_assignments.status | DB (driver RPC) | AUTHORITATIVE (0 rows) |
| provider_orders.status | DB | AUTHORITATIVE (0 rows) |
| client orderStateMachine | client allow-list | DISPLAY-ONLY |
| tracking timeline (/track) | client defaults + getOrder | DISPLAY-ONLY บางส่วน (M-3 คงเดิม) |
| admin dashboard cards | getDashboardStats | READ MODEL ✓ |

- M-2 ยืนยันซ้ำ: toast "สั่งซื้อสำเร็จ" = cart action copy เท่านั้น

## 15. ORDER HISTORY / AUDIT TRAIL

- **ไม่มี order status history table** (scan history/event/timeline = 0)
- audit_logs จริง 31 rows = user_login 23 · test 6 · user_register 1 · preorder_migrated 1 — **ไม่มี order lifecycle event เลย** (แม้ TEST-001 pending→confirmed ก็ไม่มี record)
- client writeAuditLog = CLIENT-ONLY · **VERDICT: order lifecycle audit trail = MISSING**

## 16. RLS / AUTHORITY CROSS-CHECK

| Write | ใครได้ | Protection |
|---|---|---|
| create order | authenticated owner | RPC + RLS check(customer_ref=auth.uid()) |
| status transition | admin allow-list / owner cancel pending | RPC + trigger + RLS(update=false) |
| mark paid offline | admin | is_admin() ใน SECURITY DEFINER RPC |
| mark paid card | service_role (webhook) | EF service key |
| driver actions | authenticated + เบอร์ใดก็ได้ (auto-register!) | RPC — **ช่องโหว่ identity** |
| settings/products/rounds | admin | RLS is_admin policies |

## 17. Production Data Reality (aggregate, ไม่มี PII)

orders=17 (9 pending/pending · 6 pending/paid · 1 pending/refund · 1 confirmed/paid) · items=14 · PI=13 · rounds=15 · drivers=0 · assignments=0 · provider_orders=0 · batches=0 · audit_logs=31 (ไม่มี order events)

## 18. CONTRADICTION MAP

```
CONTRA-A: Phase 2/4 กล่าว "มี audit trail (audit_logs)" → จริง = ไม่มี order lifecycle events → MISSING (audit_logs ≠ order history)
CONTRA-B: เอกสารเก่า MOCK_DRIVERS → จริง ณ HEAD = DB-driven drivers — เอกสาร CONTRADICTED
CONTRA-C: "kitchen มี AdminKitchen" → จริง = no route → DEAD
CONTRA-D: docs กล่าว PromptPay "production-verified" → จริง = promptpay paid จริง = 0 — CONTRADICTED
CONTRA-E: README "Stripe webhook verified 6/6" → DB evidence รองรับ (completed 5 + refunded 1) ✓ ตรง
CONTRA-F: S-2 ทำให้ "Admin แก้ X → ผล Y" ทุก flow = NOT VERIFIED AT ADMIN RUNTIME
```

## 19. MASTER MATRIX (ย่อ)

| Capability | Customer UI | Admin | RPC/API | DB | Runtime | Source of Truth | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| Order creation (2 modes) | ✓ | n/a | create_order_with_items | ✓ triggers | PARTIAL (live NV) | DB | READY (DB) | fn_create_order_head |
| Pre-order | ✓ | config ✓ | enforce_pre_order_window | ✓ | NOT VERIFIED live | DB | PARTIAL | fn body |
| Same-day | ✓ | — | enforce_operating_hours | ✓ | NOT VERIFIED live | DB | READY (DB) | fn body |
| Round/Cutoff/Capacity | ✓ | ✓ CRUD | ensure_rounds + FOR UPDATE | ✓ | NOT VERIFIED live | DB | READY (DB) | cap probe |
| Order state | display-only | ✓ | transition_order_status | trigger allow-list | ✓ | DB | READY (DB) | fn body |
| Illegal transitions | — | — | trigger | ELSE=false | DB-proof | DB | READY (DB) | fn body |
| Payment offline | submit TXN | ✓ verify | confirm_offline_payment | ✓ | NOT VERIFIED | DB | READY (DB) | fn body |
| Stripe | n/a | refund | webhook EF | ✓ | ✓ จริง 6 events | DB | READY | Phase 2 |
| Kitchen | — | DEAD | get_kitchen_summary (no caller) | 0 rows | ✗ | — | **MISSING/DEAD** | counts |
| Delivery ≤5km | ✓ | — | compute_delivery_fee_rpc | ✓ | NOT VERIFIED live | DB | READY (DB) | Phase 2 |
| Delivery >5km | ✗ BLOCKED | mockup | adapters | enum ✓ | ✗ | — | BLOCKED | Phase 3/4 |
| Driver | n/a | list | driver_login/accept | 0 rows | ✗ | DB | PARTIAL + SECURITY GAP | fn body |
| External rider | ✗ | MOCKUP | — | 0 rows | ✗ | — | DORMANT | Phase 4 |
| Tracking | ✓ timeline | — | getOrder + client machine | ✓ | ✓ render | DB (partial) | PARTIAL (M-3) | Phase 3 |
| Audit history | — | view | append_audit_log (client) | ไม่มี order events | ✓ rows | incomplete | **MISSING** | §15 |
| RLS/Auth | ✓ | ✓ | — | all tables ✓ | ✓ | DB | READY | Phase 2 |

## 20-22. ANSWERS + SEVERITY

1-4: Order creation = RPC `create_order_with_items` เดียวทั้งสอง mode · pre-order + enforce_pre_order_window · same-day + enforce_operating_hours · **round/cutoff/capacity enforce จริง per date+round (FOR UPDATE, DB-proof)**
5-6: **Order state authority = DB trigger allow-list (live)** · illegal transitions = BLOCKED ที่ DB
7-8: **Payment authority = DB** (record_payment_result / confirm_offline_payment) · webhook ผูกถูก order ผ่าน metadata + PI จริง 6 events ✓
9-10: **Kitchen surface = MISSING/DEAD** — kitchen state ไม่เชื่อม order state ในทางใช้งาน
11-13: Delivery↔Order = ผ่าน delivery_assignments (design ✓, 0 rows) · Driver↔Delivery = phone-identity RPC ⚠️ · >5km = ไม่ทำงานที่ใด
14-16: Tracking = DB บางส่วน + client defaults · client-only = cart, orderStateMachine, tracking timeline · DB-authoritative = orders/PI/assignments/provider_orders/rounds
17-18: RLS ทุกตาราง ✓ · Auth-blocked = admin pages (S-2), anon order writes, payment authority
19: mock/static/dormant = home menu lib, provider adapters, kitchen batches, provider_orders, content_approvals, 10 EF, order audit trail
20: CONTRA-A..F (§18)

**SEVERITY (ใหม่จาก Phase 5):**
- **CRITICAL:** OP-1 Order lifecycle audit trail MISSING
- **HIGH:** OP-2 driver auto-register (identity spoofable) · OP-3 kitchen surface DEAD ทั้งสายงาน
- **MEDIUM:** OP-4 tracking display-state (M-3) · OP-5 paid-no-PI artifacts ×2 (test origin)
- **LOW:** OP-6 audit_logs มี action='test' 6 แถวปน production

## 23. POST-AUDIT DEPENDENCY ORDER (เทคนิคล้วน ไม่ใช่ ranking)

```
1. Order status history table (server-side, trigger-filled)
2. Kitchen surface (route AdminKitchen หรือใหม่) — พึ่ง (1) สำหรับ history + RPC ที่มีอยู่แล้ว
3. Driver identity model (bind auth↔drivers) — ต้องมีก่อน assignment จริง
4. Delivery method selection ฝั่ง customer (≤5/>5) — พึ่ง (3) สำหรับ >5km dispatch
5. Payment offline E2E จริง — พึ่ง (1) + test account + admin runtime ที่ไม่ติด rate-limit
6. Home menu ← DB — ต้องมีก่อนพิสูจน์ "admin แก้ → customer เห็นครบ"
7. Live E2E ทั้ง flow — พึ่ง (5) + test account (+S-2 ถ้าต้องใช้ admin)
```

## 24. CARRY-FORWARD

- S-1/S-2: ไม่แตะตามคำสั่ง — admin runtime flows ทั้งหมด = NOT VERIFIED AT ADMIN RUNTIME
- ai-proxy: คง CRITICAL · H-1/H-2/M-1/M-2/M-4 คงเดิม · M-3 ยืนยันซ้ำ · DEAD CONFIG (hours/radius_km) ยัง suspect

## 25. STATUS

**PHASE 5 COMPLETE** (systematic read-only audit ครบ chain ระดับ function-body + data + runtime ที่ปลอดภัย)

NOT VERIFIED คงเหลือ: live order creation ทั้งสอง mode · live cutoff/capacity rejection · live driver assignment · admin mutation flows · destructive illegal-transition live (แทนด้วย DB-proof จาก function body)

**HARD STOP — รอคำสั่งถัดไป**