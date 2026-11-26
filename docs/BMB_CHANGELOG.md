# BMB â€” CHANGELOG (à¸à¸²à¸£à¹Œà¸”/à¸•à¸²à¸¡à¹€à¸§à¸¥à¸²/à¸¢à¸à¹€à¸¥à¸´à¸/à¸„à¸±à¸”à¸à¸£à¸­à¸‡); RAISE only inside DO blocks; UPDATE has no ON CONFLICT (INSERT only)
- business_settings rows need upsert (INSERT ... ON CONFLICT (key)) not bare UPDATE when the row may not exist
- cancel_order_as_customer: service_role only + RAISES exception -> tests must catch with nested block and clear JWT claims before service_role calls
- create_production_batch/get_kitchen_summary defaults fire only when params are OMITTED (passing NULL is NOT the default)
- PRE_ORDER orders need scheduled_date >= today BKK + dropoff_detail (m038/m143b); create_order_with_items has 18 params incl. p_promotion_code (11th)
- reviews unique partial idx_reviews_order_product(order_number, product_id) WHERE order_number IS NOT NULL -> test fixtures use separate product/order ids

---

## R111 â€” 2026-11-26 â€” PHASE 2 WP2: PO WORKFLOW RPC (MIGRATION 224) + API + DB INTEGRATION TESTS

## R116 — 2026-11-26 — PHASE 2 WP7+WP8: PRICE HISTORY + PO DASHBOARD READ APIs (227/228) + DASHBOARD UI

- **Task:** PHASE2-WP7/WP8 (Owner Master Directive continuous execution)
- **Migrations 227/228 (TEST DB only):** get_purchase_price_history + get_po_dashboard — both SECURITY INVOKER (RLS m223 enforced, branch/tenant scoped). REMEDIATION: wrapped jsonb_agg subqueries (staged nested-aggregate/GROUP BY bug)
- **API + UI:** src/lib/bmbAdminApi_purchaseAnalytics.ts + types PurchasePriceHistory/PODashboard; src/pages/admin/PurchaseDashboardPage.tsx (KPI + action lists, real RPC) as first PurchaseHub tab
- **Tests:** DB e2e/contracts_wp7_wp8_227_228.sql 6 cases ALL PASS (INVOKER + RLS branch isolation price history + dashboard, admin cross-branch, filters) · static 5 + API 3 · wired replay
- **Gates:** replay 001-228 migrations=232 OK/0 FAIL + all contracts ALL GREEN · vitest 3,014 · lint 0 · tsc 0 · build PASS · production untouched (218)
- **Next:** WP9 (Full regression / security / performance)

## R115 — 2026-11-26 — PHASE 2 WP6: WAVG POSTING + REVERSAL (MIGRATION 226) + DB INTEGRATION TESTS

- **Task:** PHASE2-WP6 (Owner Master Directive continuous execution)
- **Scope:** Inventory integration — promote staged wp6 to migration 226 + DB tests (no new UI)
- **Migration 226 (TEST DB only):** calculate_grn_line_landed_cost + compute_grn_payload_hash + post_goods_receipt_line + post_goods_receipt + reverse_grn — FOR UPDATE lock order, WAVG from accepted_qty + landed cost, idempotency (key+payload hash / ERR_IDEMPOTENCY_CONFLICT / ERR_ALREADY_POSTED), line double-post guard, reversal positive-mirror + reversal_of (unique once) + itx type=out + correction entry, PO received/status transitions, audit
- **WP6 REMEDIATION:** removed non-existent has_staff_branch_scope; Asia/Bangkok date (m190 gate)
- **Tests:** DB e2e/contracts_wp6_226.sql 9 cases ALL PASS (post+WAVG stock24/wavg11, idempotent retry no double, hash conflict, already posted, staff role gate, reversal stock0/out/correction/orig reversed, double-reversal reject, line double-post guard) · static 10 · wired replay
- **Gates:** replay 001-226 migrations=230 OK/0 FAIL + phase1+phase2+wp2+wp4+wp6 ALL GREEN · vitest 256/3,006 · lint 0 · tsc 0 · build PASS · production untouched (218)
- **Next:** WP7 (Price History read API)

## R114 — 2026-11-26 — PHASE 2 WP5: GOODS RECEIVING UI + E2E SPEC

- **Task:** PHASE2-WP5 (Owner Master Directive continuous execution)
- **Scope:** GRN UI in existing PurchaseHub (no duplicate hub) — real WP4 API (migration 225), no mock
- **UI:** src/pages/admin/GoodsReceivingPage.tsx — select receivable PO → enter actual qty → auto good/rejected split → save draft → approve (inventory/admin) + detail modal; responsive
- **Nav:** AdminHubs.tsx — new "รับสินค้า (Goods Receiving)" tab
- **Tests:** src/__tests__/goodsReceiptsApi.test.ts 3 API-wiring tests PASS · e2e/goodsReceiving.spec.ts Playwright create→approve — LIVE_TEST_PENDING (staging + DB 225 + auth)
- **Gates:** tsc 0 · lint 0 · vitest 255/2,996 · build PASS · production untouched (218)
- **Next:** WP6 (WAVG posting/reversal + idempotency)

## R113 — 2026-11-26 — PHASE 2 WP4: GRN WORKFLOW RPC (MIGRATION 225) + API + DB INTEGRATION TESTS

- **Task:** PHASE2-WP4 (Owner Master Directive continuous execution)
- **Scope:** GRN Backend — promote staged wp4 to migration 225 + API + DB tests (UI = WP5)
- **Migration 225 (TEST DB only):** generate_grn_number (grn_number_seq + BKK) + create_grn_draft (partial/multi, over-receive guard cumulative committed, accepted+rejected=received, conversion/price/lot snapshot, inherited org, audit) + approve_grn (inventory/admin + draft gate) + has_org_row_scope in-body
- **WP4 REMEDIATION:** removed non-existent has_staff_branch_scope; Asia/Bangkok date (m190); create gate = is_staff OR is_inventory
- **API:** src/lib/bmbAdminApi_goodsReceipts.ts + types GoodsReceipt/Line/Form + GRNStatus
- **Tests:** DB e2e/contracts_wp4_225.sql 8 cases ALL PASS · static 8 · wired replay
- **Gates:** replay 001-225 migrations=229 OK/0 FAIL + phase1+phase2+wp2+wp4 ALL GREEN · vitest 254/2,993 · lint 0 · tsc 0 · build PASS · production untouched (218)
- **Next:** WP5 (GRN UI / E2E)

- **Task:** PHASE2-WP2 (Owner Master Directive 2026-11-26: "WP2 APPROVED TO START AFTER WP1 PUSH VERIFIED" â†’ continuous execution)
- **Scope:** PO Backend à¸ˆà¸£à¸´à¸‡ â€” promote staged `wp2_po_workflow_rpc.sql` à¹€à¸›à¹‡à¸™ migration 224 + TypeScript API + DB integration tests (UI = WP3)
- **Migration 224_purchase_order_rpcs.sql (applied to TEST DB only â€” production ledger stays 218):**
  - `generate_po_number()` â€” po_number_seq (m219) + format PO-YYYYMMDD-{seq:04d} + Asia/Bangkok date
  - `create_purchase_order(...)` â€” draft + lines, supplier active/conversion>0/qty>0 validation, price fallback last_approved_price, branch guard (ERR_FORBIDDEN_BRANCH), audit
  - `update_purchase_order(...)` â€” optimistic lock (p_version, ERR_VERSION_MISMATCH) + status gate (draft/submitted) + has_org_row_scope + audit
  - `submit_purchase_order(...)` â€” draftâ†’submitted + line checks + audit
  - `approve_purchase_order(...)` â€” finance/admin only (ERR_FORBIDDEN_APPROVER) + submitted gate + writes supplier_products.last_committed_price (Owner B4) + audit
  - SECURITY DEFINER à¸•à¸£à¸§à¸ˆ role + has_org_row_scope à¸ à¸²à¸¢à¹ƒà¸™à¸•à¸±à¸§à¹€à¸­à¸‡à¸—à¸¸à¸ function (Owner C); GRANT EXECUTE authenticated
- **WP2 REMEDIATION:** à¸¥à¸š `has_staff_branch_scope()` à¸—à¸µà¹ˆà¹„à¸¡à¹ˆà¸¡à¸µà¸­à¸¢à¸¹à¹ˆà¹ƒà¸™ migration à¹ƒà¸” (runtime defect à¹ƒà¸™à¸•à¸±à¸§ staged) â€” redundant à¸à¸±à¸š has_org_row_scope (m223); à¹ƒà¸Šà¹‰ Asia/Bangkok date à¹à¸—à¸™ CURRENT_DATE (à¸à¸±à¸™ m190 BKK gate)
- **API:** `src/lib/bmbAdminApi_purchaseOrders.ts` (create/update/submit/approve + reads à¸œà¹ˆà¸²à¸™ supabase.rpc/tables à¸ˆà¸£à¸´à¸‡ à¹„à¸¡à¹ˆ mock) Â· types `PurchaseOrderHeader/Line/Form` + `POStatus` (à¹à¸¢à¸à¸ˆà¸²à¸ legacy PurchaseOrder à¹€à¸”à¸´à¸¡)
- **Tests:**
  - DB integration `e2e/contracts_wp2_224.sql` â€” 10 cases (number-gen, validation, optimistic lock, duplicate submit, invalid transition, role gate, branch scope, audit) ALL PASS à¸šà¸™ real Postgres
  - Static `src/__tests__/contracts_224_po_rpcs.test.ts` â€” 17 tests PASS
  - Wired à¹€à¸‚à¹‰à¸² `e2e/ci/w2_fresh_replay_full.sh`
- **Gates (all green):** Docker replay 001â†’224 `migrations=228 OK / 0 FAIL` + phase1 + phase2(219-223) + wp2(224) contracts ALL GREEN Â· vitest 252 files/2,980 tests Â· lint 0 Â· tsc 0 Â· build PASS (PWA v1.3.0)
- **Next:** WP3 (PurchaseHub PO UI / E2E) â€” extend existing PurchaseHub (AdminHubs.tsx), real API, no mock

## R110 â€” 2026-11-26 â€” PHASE 2 WP1: SCHEMA MIGRATIONS 219-223 (REMEDIATED + OWNER ACCEPTED + COMMIT)

- **Task:** PHASE2-WP1-SCHEMA (Owner directive 2026-11-26: "WP1 REMEDIATION & SCOPE CORRECTION" â†’ Final Reconciliation â†’ "à¸„à¸­à¸¡à¸¡à¸´à¸—à¸žà¸¸à¸Šà¹ƒà¸«à¹‰ à¸œà¹ˆà¸²à¸™à¹€à¸‚à¸µà¸¢à¸§à¸«à¸¡à¸”")
- **Scope:** WP1 = Schema/Constraints/Indexes/RLS/Contract à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ â€” Workflow RPCs à¸¢à¹‰à¸²à¸¢à¹„à¸› `supabase/staged_workflows/` (wp2/w4/w6/w7/w8, à¹„à¸¡à¹ˆ apply)
- **Migrations 219-223 (additive, idempotent, NOT applied to production):**
  - 219 purchase_orders + purchase_order_lines + po_number_seq (contract PO-YYYYMMDD-{seq})
  - 220 goods_receipts + lines â€” idempotency_key + payload_hash (uq), reversal_of linkage (uq once, no-idem CHECK, no self-link), grl_acceptance_balance CHECK, à¸¥à¸š price_variance generated col (DEFECT-1)
  - 221 purchase_price_history append-only (trigger + SELECT/INSERT grants), à¸¥à¸š package_size (DEFECT-5), landed_cost à¸™à¸´à¸¢à¸²à¸¡à¹ƒà¸™ COMMENT (DEFECT-4), +tenant_id/branch_id
  - 222 inventory_transactions ext (po_id/grn_id/grn_line_id/unit_cost/conversion_snapshot + COMMENT)
  - 223 RLS org/branch isolation â€” has_org_row_scope (platform/tenant/branch à¸•à¸²à¸¡ m065/071/088/090/146) + 17 policies
- **DEFECT-1..5 fixed & proven on real Postgres** (à¸•à¸²à¸¡ matrix Â§15.1 à¹ƒà¸™ `docs/PHASE2_DESIGN_REPORT.md`)
- **Gates (all green):** Docker replay fresh DB `OK=227 FAIL=0` (ledger 223 versions) + Phase 1 contracts (214-218) + regression 124-213 ALL GREEN Â· NEW `e2e/contracts_phase2_219_223.sql` 33 test IDs ALL PASS Â· static 6 files/132 tests (full suite 251 files/2,963 tests) Â· lint 0 Â· tsc 0
- **Fix during session:** replay grep extraction (NOTICE prefix) Â· test-count reconciliation 36â†’33
- **Blocked/next:** WP2 (à¸•à¹‰à¸­à¸‡à¹„à¸”à¹‰ Owner à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¢à¸) â€” à¸”à¸¹ `supabase/staged_workflows/README.md`

## R109 â€” 2026-11-25 r4 â€” LIVE TEST RESULTS + OWNER DECISIONS (E/F LIVE_VERIFIED, G/H PARTIAL, C-1..C-6 RESOLVED, OMISE RESOLVED)

**Status:** CODE_CLOSED + GATES PASS â€” All gates green: lint OK, tsc 0, vitest 2830 tests (245 files). Contract suite 67 files ALL GREEN.

### Live Test Results (2026-11-25):

| Group | Tests | Result | Details |
|-------|-------|--------|---------|
| **E** (Rider History + Maps) | 7 | âœ… **LIVE_VERIFIED** | E-1..E-6 PASS. OSM fallback verified. E-7 diagnostic. |
| **F** (Background Music + Mascot + OAuth) | 7 | âœ… **LIVE_VERIFIED** | F-1..F-4, F-7 PASS. F-5, F-6 legacy verified. |
| **G** (Marketing + Studio + Floating Ad) | 7 | â¸ï¸ **PARTIAL** | G-1..G-5 PASS (5 tests). G-6, G-7 pending. |
| **H** (FB Cart Bridge) | 6 | â¸ï¸ **PARTIAL** | H-3..H-6 PASS (4 tests). H-1, H-2 pending. |
| **I** (Server Cart + FB IAB + 1 Reply) | 8 | â¸ï¸ **PAUSED** | Critical path, awaiting Owner test. |

### Owner Decisions â€” C-1..C-6 RESOLVED (2026-11-25):

| Conflict | Decision | Implementation |
|----------|----------|----------------|
| **C-1** Pre-order cutoff vs Same-day | Same-day = 24h ordering; Pre-order cutoff for delivery only | Logic already supports both |
| **C-2** Multi-branch zone overlap | First-registered branch wins | Deterministic assignment via registration timestamp |
| **C-3** Coupon stacking | Approved â€” implement min-order/max-discount/per-user limits | Add to promotion schema |
| **C-4** Vote rewards points | **Vote gives points** â€” update m208 to write points_ledger | Migration needed for points_ledger entry |
| **C-5** CRM consent granularity | **Add granularity** â€” winback/birthday/channel sub-fields | Schema migration for consent sub-fields |
| **C-6** Floating ad vs Mascot | **Already fixed** in layout | Mascot repositioned; Floating ad z-index managed |

### Omise TEST Card â€” RESOLVED:
- Not a blocker. Stripe QR = primary payment, Omise = fallback.

### Verification:
- `npx vitest run` â€” 2830 tests PASS (245 files)
- `npm run lint` â€” OK
- `npx tsc --noEmit` â€” 0 errors

### Next Steps (per Owner order):
1. Owner audit review of 67 contract files
2. Complete Live Test Groups G-6, G-7, H-1, H-2, I-1..I-8
3. Owner Gate Phase 1 â†’ Phase 2
4. Phase 1-6 all PAUSED per Owner order

---

### R108 â€” 2026-11-25 r3 â€” CONTRACT AUDIT CLOSURE 124-213 COMPLETE (15 FILES, 311 TESTS ALL GREEN)

**Status:** CODE_CLOSED + GATES PASS â€” 15 new contract test files covering 28 remaining migrations (179, 181-189, 191-207, 211-213) all passing (311 tests). Combined with existing 52 contract files = 67 files ALL GREEN (0 FAIL) on fresh DB.

### Contract Test Files Created (15 files, 311 tests):
1. `contracts_179_notification_hub.test.ts` (24 tests) â€” channel_identities + notification_outbox + 4 RPCs + feature flags + bmb_notify_http
2. `contracts_181_186_promotions.test.ts` (13 tests) â€” addon margin rules + promotions BKK date gates
3. `contracts_182_188_messages.test.ts` (40 tests) â€” order messages + notifications + rider notify + dedup
4. `contracts_189_197_rider_fallback.test.ts` (24 tests) â€” claim fallback + rider loop fix
5. `contracts_191_kitchen_bkk.test.ts` (13 tests) â€” kitchen BKK date functions
6. `contracts_192_193_crm.test.ts` (22 tests) â€” CRM automation + consent
7. `contracts_194_195_payment.test.ts` (10 tests) â€” payment void enum + close-on-cancel
8. `contracts_196_206_media_buckets.test.ts` (13 tests) â€” background_music + mascot bucket policies
9. `contracts_198_200_reviews.test.ts` (23 tests) â€” review moderation + verified rules + anon read behavior
10. `contracts_201_202_theater.test.ts` (14 tests) â€” theater carousel + approval_id on promotions
11. `contracts_203_204_ai_memory.test.ts` (29 tests) â€” AI grounding + user_post_context + order memory + review_content sync
12. `contracts_205_social_actions.test.ts` (16 tests) â€” cancel_order_as_customer + social_timeline_for_web
13. `contracts_207_211_rider_history.test.ts` (21 tests) â€” my_deliveries v3 dates + v3-fixed RETURN fix
14. `contracts_212_delivery_sync_hop.test.ts` (26 tests) â€” preparing -> ready_for_dispatch hop + ERR_KITCHEN_NOT_READY guard (3 RPCs)
15. `contracts_213_cart_payload.test.ts` (6 tests) â€” cart_sessions payload + select_own RLS

### Key Patterns Enforced:
- Every test file = `BEGIN ... ROLLBACK` single transaction, runs on fresh DB, no new shims
- `?raw` import with flexible substring/regex matching (handles truncation)
- Fixture: auth.users â†’ trigger `handle_new_user` (006) creates profile `customer`; role upgrade via `UPDATE profiles` BEFORE setting JWT (guard 014 bootstrap)
- `set_config('request.jwt.claims', ..., true)` persists for entire transaction
- `now()` = transaction timestamp; test trigger updated_at requires separate DO blocks (2 transactions)
- GRANT/REVOKE don't affect superuser; test role permissions via `SET LOCAL ROLE anon/authenticated`
- PRE_ORDER fixtures need `dropoff_detail` + real `delivery_round_id` + `pre_order_cutoff` '23:59'
- Time comparisons via `LIKE 'HH:MM%'` (format 15:00:00)
- 148 supersedes 145 (`same_day_cutoff` = DROPPED); 198/199 supersede 157 (`reviews_anon_read` = DROPPED) â€” tests pin current state
- NEVER call `bmb_tick_http` real (production EF) â€” verify function exists only

### Verification:
- `npx vitest run src/__tests__/contracts_*.test.ts` â€” 15 test files, 311 tests PASS
- All 15 files follow atomic execution (one file at a time), no macro-prompts, no placeholders
- Documentation synchronized per Protocol Â§0.3: MASTER_STATUS, WORK_QUEUE, AI_WORKING_STATE, CHANGELOG updated

### Next Steps (per Owner order via commit 9221626):
1. Owner audit review of 67 contract files
2. Live Test Groups E, F, G, H, I (35 cases total) â€” Sprint: F+E week 3-4 â†’ G+H week 5-6 â†’ I week 7-8
3. WAIT for Owner Gate Phase 1 â†’ Phase 2 after I-1/I-2 pass
4. Phase 1-6 all PAUSED per Owner order

---

### R107 r2 - Lint fix (commit 1c2f749 "Edit doc BOM") - CI GREEN AGAIN
- Root cause 1: UTF-8 BOM on BMB_AI_WORKING_STATE / BMB_CHANGELOG / BMB_MASTER_STATUS / BMB_WORK_QUEUE (PowerShell Set-Content -Encoding UTF8 always adds BOM in PS 5.1) - rewritten without BOM via Node fs
- Root cause 2: Admin_User_Manual_TH.md foreign chars 5 spots (Arabic/Chinese/Hebrew/Chinese = à¸à¸²à¸£à¹Œà¸”/à¸•à¸²à¸¡à¹€à¸§à¸¥à¸²/à¸¢à¸à¹€à¸¥à¸´à¸/à¸„à¸±à¸”à¸à¸£à¸­à¸‡) - fixed to proper Thai
- Gates after fix: lint OK (languageSanity 2,054 files clean) - tsc 0 - vitest 230 files/2,519 tests PASS
- New rule: never write .md via PowerShell Set-Content (BOM); use Node fs or Write tool - languageSanity rejects BOM/foreign chars

## R106 â€” 2026-11-25 â€” PHASE 1 (Smart Ingredient Foundation) + CONTRACT AUDIT r1-r3 (PAUSED/HANDOFF)

**Status:** CODE_CLOSED (Phase 1) + IN_PROGRESS (Audit â€” à¸„à¸£à¸­à¸šà¸–à¸¶à¸‡ 180 Â· à¹€à¸«à¸¥à¸·à¸­ 28) â€” pushed

### Phase 1 â€” Migrations 214-218 applied prod (Owner Decisions B1-B5)
- 214 suppliers + RLS (is_inventory/is_kitchen/is_pos/is_finance à¸ˆà¸²à¸ m146) Â· 215 inventory.supplier_id FK + backfill Â· 216 inventory enriched (prep_yield/purchase_unit/use_unit/conversion_factor/package/weights/wavg_cost/last_purchase_price/last_approved_price) Â· 217 supplier_products (3 price states: committed/realized/approved) Â· 218 recipes batch yield + cost_per_unit
- APIs: `bmbAdminApi_suppliers.ts` + `bmbAdminApi_supplierProducts.ts` Â· Types: Supplier*/SupplierProduct*/extended Ingredient+RecipeRow
- Gates: tsc 0 Â· lint OK Â· vitest 230 files/2519 tests Â· build PASS

### CI root cause (à¸žà¸´à¸ªà¸¹à¸ˆà¸™à¹Œ â€” à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆ migration)
- commit `a592521` "Big clean doc" à¸¥à¸š BMB_G6/G7_CONTRACT.md à¹à¸•à¹ˆ `src/__tests__/g6g7OrderBoundary.test.ts` à¸¢à¸±à¸‡ `import ?raw` â†’ suite à¸¥à¹‰à¸¡à¸—à¸±à¹‰à¸‡à¹„à¸Ÿà¸¥à¹Œ â†’ CI à¸žà¸±à¸‡à¸—à¸¸à¸à¸£à¸­à¸š
- à¹à¸à¹‰: à¸–à¸­à¸” import + doc-alignment block (boundary à¸¢à¸±à¸‡ pin à¸„à¸£à¸š 10 à¹€à¸„à¸ªà¸”à¹‰à¸§à¸¢ source-scan à¹‚à¸„à¹‰à¸”à¸ˆà¸£à¸´à¸‡ Â§2.1)

### Rules à¹ƒà¸«à¸¡à¹ˆ (UNIVERSAL_MASTER_AI_RULES.md)
- Â§17.5 à¸«à¹‰à¸²à¸¡ Shims/Mocks à¸«à¸¥à¸­à¸à¹€à¸¥à¸µà¹ˆà¸¢à¸‡ schema fix Â· Â§17.6 à¸—à¸¸à¸ migration à¸•à¹‰à¸­à¸‡à¸¡à¸µ Contract Test Â· Â§17.7 à¸šà¸±à¸‡à¸„à¸±à¸š audit 124-213

### Contract-tests.yml â€” à¸£à¸±à¸™ 001â†’latest à¹„à¸¡à¹ˆà¸¡à¸µ skip
- à¸–à¸­à¸” skip 124-218 + orphan steps (125/132/185/208) Â· W-2 Docker replay tool: `e2e/ci/w2_fresh_replay_full.sh` + `w2_run_replay_full.bat`

### Contract Audit r1-r3 (ALL GREEN à¸šà¸™ fresh DB â€” replay 3 à¸£à¸­à¸š Â· `e2e/w2-replay-full-2026-11-25.log`)
- à¹ƒà¸«à¸¡à¹ˆ 7 à¸Šà¸¸à¸”: 126 Â· 134+145+150-152 Â· 157+158 Â· 159-162 Â· 164-168 (rider à¸§à¸‡à¸ˆà¸£à¹€à¸•à¹‡à¸¡+multi-job) Â· 170-174 Â· 175-180
- 172/173 = à¸„à¸£à¸­à¸šà¹‚à¸”à¸¢ contract 153 G2/G5/G8 à¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§ (à¸¢à¸·à¸™à¸¢à¸±à¸™)
- State à¸ˆà¸£à¸´à¸‡à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡ pin: 148 supersede 145 (same_day_cutoff DROPPED) Â· 198/199 supersede 157 (reviews_anon_read DROPPED) Â· guard 014 (à¸¢à¸ role à¸•à¹‰à¸­à¸‡à¸à¹ˆà¸­à¸™à¸•à¸±à¹‰à¸‡ JWT) Â· trigger timestamp = transaction-scoped (à¹à¸¢à¸ DO block)
- **à¹€à¸«à¸¥à¸·à¸­ 28 migration** (179, 181-189, 191-207, 211-213) â†’ 15 à¹„à¸Ÿà¸¥à¹Œ â€” à¹à¸œà¸™à¹ƒà¸™ `PHASE1_PENDING_TEST_CLEARANCE_PLAN.md` Â· Active Task: CONTRACT-AUDIT-CLOSURE-124-213

### Owner Decisions à¸šà¸±à¸™à¸—à¸¶à¸
- 2026-11-25: à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ Roadmap Phase 1-6 + à¹€à¸£à¸´à¹ˆà¸¡ Phase 1 à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ (Phase Gate à¸—à¸µà¸¥à¸° Phase Â· à¸«à¹‰à¸²à¸¡ auto-advance) â†’ à¸«à¸¥à¸±à¸‡à¸ˆà¸š Phase 1 à¸ªà¸±à¹ˆà¸‡ "à¸žà¸±à¸à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” Â· à¹€à¸„à¸¥à¸µà¸¢à¸£à¹Œà¹€à¸—à¸ª 124-213 à¹ƒà¸«à¹‰à¹€à¸›à¹‡à¸™à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¸à¹ˆà¸­à¸™" â†’ 2026-11-25 à¸›à¸´à¸”à¹€à¸‹à¸ªà¸Šà¸±à¸™: à¸¢à¸à¸‡à¸²à¸™à¸—à¸µà¹ˆà¹€à¸«à¸¥à¸·à¸­à¹„à¸›à¹€à¸‹à¸ªà¸Šà¸±à¸™à¸–à¸±à¸”à¹„à¸›

---

## R105c â€” 2026-11-24 â€” README REWRITE (Documentation Only)

**Status:** CODE_CLOSED â€” à¹€à¸­à¸à¸ªà¸²à¸£à¹€à¸”à¸µà¸¢à¸§ à¹„à¸¡à¹ˆà¸¡à¸µ code change à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¸£à¸±à¸™ code gates

**Work:**
- Owner à¸•à¸±à¸”à¸ªà¸´à¸™à¹„à¸¡à¹ˆà¹€à¸­à¸²à¹€à¸§à¸­à¸£à¹Œà¸Šà¸±à¸™à¹à¸£à¸à¹à¸šà¸š "à¸žà¸£à¸µà¹€à¸‹à¸™à¸•à¹Œà¸™à¸±à¸à¸¥à¸‡à¸—à¸¸à¸™" ("à¸•à¸²à¸¢à¸«à¹ˆà¸² à¹‚à¸«à¸¥à¸¢à¹‚à¸—à¹ˆà¸¢à¸¡à¸²à¸")
- à¸à¸¹à¹‰à¹‚à¸„à¸£à¸‡ README à¹€à¸”à¸´à¸¡ (R74-OMNI style) à¸à¸¥à¸±à¸šà¸¡à¸²à¸„à¸£à¸šà¸—à¸¸à¸ section
- à¸­à¸±à¸›à¹€à¸”à¸•à¹à¸šà¸šà¸›à¸à¸•à¸´à¸•à¸²à¸¡à¸Ÿà¸µà¹€à¸ˆà¸­à¸£à¹Œà¸ˆà¸£à¸´à¸‡à¸ªà¸–à¸²à¸™à¸°à¹‚à¸„à¹‰à¸”à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™:
  - à¸ªà¸–à¸²à¸™à¸°à¸«à¸±à¸§à¹„à¸Ÿà¸¥à¹Œ R74-OMNIâ†’R105b
  - Â§1 à¹€à¸žà¸´à¹ˆà¸¡ server cart sync + social-ai-worker
  - Â§3 à¹€à¸žà¸´à¹ˆà¸¡à¸šà¸£à¸£à¸—à¸±à¸”à¸‚à¹‰à¸²à¸¡à¸Šà¹ˆà¸­à¸‡à¸—à¸²à¸‡ R101â€“R104
  - Â§4 à¹€à¸žà¸´à¹ˆà¸¡ Background Music R55â†’R105b
  - Â§5 à¸•à¸²à¸£à¸²à¸‡ +4 à¹à¸–à¸§à¹ƒà¸«à¸¡à¹ˆ (à¸•à¸°à¸à¸£à¹‰à¸²à¸‚à¹‰à¸²à¸¡à¸Šà¹ˆà¸­à¸‡à¸—à¸²à¸‡/à¹€à¸žà¸¥à¸‡à¸šà¸£à¸£à¹€à¸¥à¸‡/à¸ªà¸•à¸´à¸à¹€à¸à¸­à¸£à¹Œ R63d) + social omnichannel à¸­à¸±à¸›à¹€à¸”à¸• "EF deployed R104 Â· à¹€à¸«à¸¥à¸·à¸­ live test H/I" + rider m210â€“212
  - Â§6 migration 197â†’213 (001â€“213) + EF 24 + vitest 212â†’230 à¹„à¸Ÿà¸¥à¹Œ/2,521 tests
  - Â§7 à¸•à¸±à¸§à¹€à¸¥à¸‚à¹‚à¸Ÿà¸¥à¹€à¸”à¸­à¸£à¹Œ
  - Â§10 à¹€à¸žà¸´à¹ˆà¸¡ live test H/I + à¸›à¸´à¸”à¹à¸¥à¹‰à¸§à¹€à¸žà¸´à¹ˆà¸¡ R105b/R82/R64
  - Â§11 +AI_WORK_STATE row + à¸à¸•à¸´à¸à¸² bootstrap/16.3

**Evidence:** App.tsx (routes à¸„à¸£à¸š Â· admin hubs Â· onboarding/billing) Â· package.json (à¸ªà¹à¸•à¸ + niimbot/qz-tray/qrcode) Â· supabase/functions = 24 EF + _shared Â· migrations 001â€“213 (à¸•à¸£à¸§à¸ˆ ledger 196 à¹à¸¥à¹‰à¸§à¹ƒà¸™ R105b) Â· vitest **230 à¹„à¸Ÿà¸¥à¹Œ/2521 tests** (à¸§à¸±à¸”à¸ˆà¸£à¸´à¸‡ 2026-11-24) Â· à¸ªà¸–à¸²à¸™à¸° LIVE à¸£à¸²à¸¢à¸à¸¥à¸¸à¹ˆà¸¡à¸¡à¸²à¸ˆà¸²à¸ R51â€“R105b à¹ƒà¸™ ledger à¸™à¸µà¹‰ + BMB_MASTER_STATUS (Source of Truth)

---

## R105b â€” 2026-11-24 â€” BACKGROUND MUSIC RLS HOTFIX

**Status:** CODE_CLOSED + GATES PASS (tsc 0 Â· lint OK Â· vitest 230 à¹„à¸Ÿà¸¥à¹Œ/2521 tests Â· build OK) + PUSHED `b5ac4bd` + SESSION CLOSED + **LIVE VERIFIED**

**Root Cause (à¸ˆà¸²à¸ m119 probe à¸ˆà¸£à¸´à¸‡ 2026-10-07):**
- `196_background_music_bucket_policies.sql` (à¹€à¸”à¸´à¸¡ = m103) à¹ƒà¸Šà¹‰ subquery `(SELECT id FROM storage.buckets WHERE name='background_music') = bucket_id` à¸—à¸±à¹‰à¸‡ 4 policies
- RLS à¸‚à¸­à¸‡ `storage.buckets` à¸‹à¹ˆà¸­à¸™à¹à¸–à¸§ bucket à¸ˆà¸²à¸ `anon`/`authenticated` â†’ subquery à¸„à¸·à¸™ **NULL** â†’ `NULL = bucket_id` = NULL â†’ policy fail à¸—à¸¸à¸à¸‚à¹‰à¸­
- à¸œà¸¥: `.list('')` à¸„à¸·à¸™ [] (à¸›à¸¸à¹ˆà¸¡à¹‚à¸Šà¸§à¹Œ "à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸žà¸¥à¸‡à¹ƒà¸™ bucket") + `.upload()` à¹‚à¸”à¸™ 42501 "new row violates row-level security policy"

**Fix (2 à¹„à¸Ÿà¸¥à¹Œ):**
1. `196_background_music_bucket_policies.sql` â€” à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸—à¸±à¹‰à¸‡ 4 policies à¹€à¸›à¹‡à¸™ `bucket_id = 'background_music'` literal (SELECT/INSERT/UPDATE/DELETE Â· subquery à¸šà¸™ public.profiles à¸„à¸‡à¹€à¸”à¸´à¸¡ â€” m119 à¸¢à¸·à¸™à¸¢à¸±à¸™à¸§à¹ˆà¸²à¸—à¸³à¸‡à¸²à¸™) Â· idempotent
2. `AmbientMusicToggle.tsx` `handleToggle()` â€” à¹€à¸”à¸´à¸¡à¸à¸” "à¸«à¸¢à¸¸à¸”à¹€à¸žà¸¥à¸‡" (toggle à¸„à¸·à¸™ false) à¸à¹‡à¸•à¸±à¹‰à¸‡ `emptyBucket=true` à¹‚à¸Šà¸§à¹Œà¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸«à¸¥à¸­à¸ "à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸žà¸¥à¸‡à¹ƒà¸™ bucket" â†’ à¹à¸à¹‰à¹€à¸›à¹‡à¸™ `setEmptyBucket(!started && !wasPlaying)`

**Gates:** `tsc --noEmit` 0 Â· `npm run lint` OK Â· `vitest run` **230 à¹„à¸Ÿà¸¥à¹Œ / 2521 tests PASS** (ambientMusic 21 Â· backgroundMusic 13 Â· rXXBackgroundMusicAdmin 13 Â· r44UiTheater 6) Â· `npm run build` PASS

**Production Verification (Owner 2026-11-24):**
- Migration 196 **à¸•à¸±à¸§à¹à¸à¹‰ (bucket_id literal)** APPLIED PROD à¸œà¹ˆà¸²à¸™ SQL Editor âœ“ (Owner à¸¢à¸·à¸™à¸¢à¸±à¸™ "196 à¸£à¸±à¸™à¸œà¹ˆà¸²à¸™")
- RECORD LEDGER âœ“ â€” `supabase_migrations.schema_migrations` à¸¡à¸µ `196_background_music_bucket_policies` à¸ˆà¸£à¸´à¸‡ (probe `e2e/_r105bRecord196.cjs` â†’ `e2e/_r105b_record196.json` Â· gate: policies 4/4 pattern à¹ƒà¸«à¸¡à¹ˆ Â· pattern à¹€à¸ªà¸µà¸¢ 0 Â· bucket public âœ“ Â· objects 5 âœ“ Â· à¸à¸Ž 16.3 à¸„à¸£à¸š)
- **LIVE TEST PASS âœ“** (Owner: "à¹‚à¸®à¹€à¸„à¸—à¸”à¸ªà¸­à¸šà¹à¸¥à¹‰à¸§à¹„à¸”à¹‰ à¸œà¹ˆà¸²à¸™à¹à¸¥à¹‰à¸§à¸”à¸µà¸¡à¸²à¸") â€” list à¹€à¸«à¹‡à¸™à¹„à¸Ÿà¸¥à¹Œ + à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¹„à¸”à¹‰ + à¸›à¸¸à¹ˆà¸¡ â™« à¹€à¸¥à¹ˆà¸™à¹„à¸”à¹‰

**Commit:** `b5ac4bd` fix: background music RLS â€” bucket_id literal per m119 (list à¸§à¹ˆà¸²à¸‡ + upload 42501) + à¹„à¸¡à¹ˆà¹‚à¸Šà¸§à¹Œà¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸žà¸¥à¸‡à¸•à¸­à¸™à¸à¸”à¸«à¸¢à¸¸à¸” Â· frontend live à¸œà¹ˆà¸²à¸™ Cloudflare auto-deploy

---

## R105 â€” 2026-11-24 â€” BACKGROUND MUSIC FIX (State Sync + Master Gate + Import Hardening)

**Status:** CODE_CLOSED + GATES PASS (vitest 2516 tests Â· tsc 0 Â· lint OK Â· build OK) + PUSHED `94d9958`

**Root Cause:**
- `AmbientMusicManager.toggle()` à¸•à¸±à¹‰à¸‡ `playing = true` à¸—à¸±à¸™à¸—à¸µ à¹‚à¸”à¸¢à¹„à¸¡à¹ˆà¸£à¸­ `engine.start()` à¹€à¸£à¸´à¹ˆà¸¡à¹€à¸¥à¹ˆà¸™à¸ˆà¸£à¸´à¸‡ â†’ engine async à¸–à¹‰à¸² bucket à¸§à¹ˆà¸²à¸‡ / list error / `audio.play()` fail â†’ engine à¹ƒà¸Šà¹‰ `isPlaying = false` à¸ à¸²à¸¢à¹ƒà¸™ à¹à¸•à¹ˆ manager à¹„à¸¡à¹ˆà¸£à¸¹à¹‰ â†’ UI à¸„à¹‰à¸²à¸‡ "à¸à¸³à¸¥à¸±à¸‡à¹€à¸¥à¹ˆà¸™" (â¸) à¸•à¸¥à¸­à¸”à¹„à¸›
- à¹„à¸¡à¹ˆà¸¡à¸µ master gate à¹€à¸Šà¹‡à¸„ `business_settings.ambient_music.enabled` â†’ à¹à¸­à¸”à¸¡à¸´à¸™à¸›à¸´à¸”à¹ƒà¸™ settings à¸à¹‡à¹€à¸¥à¹ˆà¸™à¹„à¸”à¹‰
- External URL import à¸„à¸§à¸²à¸¡à¸™à¹ˆà¸²à¹€à¸Šà¸·à¹ˆà¸­à¸–à¸·à¸­à¹„à¸¡à¹ˆà¸¡à¸±à¹ˆà¸™: `fetch()` à¹„à¸¡à¹ˆà¸¡à¸µ CORS mode / à¹„à¸¡à¹ˆ validate MIME / à¹„à¸¡à¹ˆà¸¡à¸µ progress indicator / error message à¸à¸£à¸­à¸š

**Fix (Phase 1â€“2 à¸•à¸²à¸¡à¹à¸œà¸™ `.kilo/plans/1795450079061-background-music-bugfix-and-import-hardening.md`):**
1. `ambientMusic.ts`: `AmbientEngine.start()` à¸„à¸·à¸™ `Promise<boolean>` (resolve `true` à¸•à¸­à¸™à¹€à¸¥à¹ˆà¸™à¸ˆà¸£à¸´à¸‡) Â· `toggle()` await engine result à¸à¹ˆà¸­à¸™à¸•à¸±à¹‰à¸‡ `playing` + à¸­à¹ˆà¸²à¸™ `business_settings.ambient_music.enabled` à¹€à¸›à¹‡à¸™ master gate (disabled = à¸„à¸·à¸™ false à¸—à¸±à¸™à¸—à¸µ) Â· import `supabase`
2. `AmbientMusicToggle.tsx`: state `emptyBucket` + `useEffect` à¸Ÿà¸±à¸‡ `MUSIC_EVENT` â€” à¸–à¹‰à¸² `playing && volume===0` = bucket à¸§à¹ˆà¸²à¸‡ â†’ à¹à¸ªà¸”à¸‡ "à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸žà¸¥à¸‡à¹ƒà¸™ bucket â€” à¹‚à¸›à¸£à¸”à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¹ƒà¸™à¹à¸­à¸”à¸¡à¸´à¸™" à¹à¸—à¸™ slider
3. `BackgroundMusicSettingsPage.tsx`: `onImportUrl()` â€” `fetch(url, {mode:'cors'})` + validate `content-type` à¹€à¸£à¸´à¹ˆà¸¡ `audio/` + progress indicator "à¸à¸³à¸¥à¸±à¸‡à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸” â†’ à¸šà¸µà¸šà¸­à¸±à¸” (Opus 128kbps) â†’ à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¹€à¸‚à¹‰à¸² bucketâ€¦" + error message à¸Šà¸±à¸”à¹€à¸ˆà¸™ (HTTP status / MIME / CORS)
4. Tests: `ambientMusic.test.ts` mock `supabase` + async `FakeEngine.start()` + await `manager.toggle()`

**Migration:** `196_background_music_bucket_policies.sql` (renumbered from 103 conflict) â€” bucket `background_music` + policies: public read (anon SELECT) / admin write (authenticated + role='admin') / idempotent

**Admin Steps (à¹€à¸ªà¸£à¹‡à¸ˆà¹à¸¥à¹‰à¸§ 2026-11-24):**
- Migration 196 APPLIED PROD âœ“
- `business_settings.ambient_music.enabled = true` âœ“
- Bucket CORS allow `biteme-baby.com` âœ“ (à¸¡à¸µà¸•à¸±à¹‰à¸‡à¹à¸•à¹ˆ R55)

**Gates:** `tsc --noEmit` 0 Â· `vitest run` **2516 tests PASS** (ambientMusic 16/16 Â· backgroundMusic 13/13) Â· `npm run lint` OK Â· `npm run build` PASS (PWA v1.3.0)

**Commit:** `94d9958` fix: background music state sync + master gate + URL import hardening

---

## R104 â€” 2026-11-24 â€” "1 REPLY = 1 à¸¥à¸´à¸‡à¸à¹Œà¸‚à¸­à¸‡à¸£à¸°à¸šà¸š + à¹€à¸›à¸´à¸” ?cart= = à¸•à¸±à¹‰à¸‡à¸•à¸°à¸à¸£à¹‰à¸²"

**Status:** CODE_CLOSED + GATES PASS (vitest 2516 tests Â· tsc 0 Â· lint OK Â· build OK) + PUSHED `47d2043` Â· âœ… EF social-ai-worker DEPLOYED (2026-11-24 Â· Owner deploy à¹€à¸­à¸‡ exit=ok)

**Root Cause 2 à¸‚à¸² (à¸—à¸µà¹ˆ R102 à¸›à¸´à¸”à¹„à¸¡à¹ˆà¸„à¸£à¸š):**
- RC-A (à¸•à¸°à¸à¸£à¹‰à¸²à¹‚à¸•à¹€à¸£à¸·à¹ˆà¸­à¸¢ à¹†): Layout à¹€à¸›à¸´à¸” `?cart=` à¹à¸¥à¹‰à¸§ **à¹€à¸•à¸´à¸¡** payload à¸—à¸±à¸šà¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸”à¸´à¸¡ (`addItem` merge à¹€à¸¡à¸™à¸¹à¹€à¸”à¸´à¸¡+à¸•à¸±à¸§à¹€à¸¥à¸·à¸­à¸à¹€à¸”à¸´à¸¡ = à¸šà¸§à¸à¸ˆà¸³à¸™à¸§à¸™) â€” à¸à¸”à¸¥à¸´à¸‡à¸à¹Œà¸ˆà¸²à¸à¸«à¸¥à¸²à¸¢ reply (payload à¸„à¸™à¸¥à¸° fingerprint) = à¸à¸­à¸‡à¸‹à¹‰à¸³à¹„à¸¡à¹ˆà¸£à¸¹à¹‰à¸ˆà¸š Â· guard R102 à¸à¸±à¸™à¹„à¸”à¹‰à¹à¸„à¹ˆ payload à¹€à¸”à¸´à¸¡à¸‹à¹‰à¸³
- RC-B (à¸¥à¸´à¸‡à¸à¹Œà¹€à¸›à¸¥à¹ˆà¸²): prompt à¹€à¸”à¸´à¸¡ (DRAFT_SYSTEM/BITE_MESSENGER_SYSTEM) **à¸ªà¸±à¹ˆà¸‡ AI à¹€à¸‚à¸µà¸¢à¸™ `https://biteme-baby.com/shop` à¹€à¸›à¹‡à¸™à¸¥à¸´à¸‡à¸à¹Œà¸‚à¸­à¸‡à¸•à¸±à¸§à¹€à¸­à¸‡** + template `?cart=<encoded>` à¸—à¸µà¹ˆ AI à¸„à¸³à¸™à¸§à¸“à¹„à¸¡à¹ˆà¹„à¸”à¹‰ â†’ à¸—à¸¸à¸ reply à¸¡à¸µà¸¥à¸´à¸‡à¸à¹Œà¹€à¸›à¸¥à¹ˆà¸²à¸—à¸µà¹ˆà¹€à¸”à¹ˆà¸™à¸à¸§à¹ˆà¸²à¸¥à¸´à¸‡à¸à¹Œà¸ˆà¸£à¸´à¸‡ â†’ à¸¥à¸¹à¸à¸„à¹‰à¸²à¸à¸” = à¹€à¸ˆà¸­à¸•à¸°à¸à¸£à¹‰à¸²à¸§à¹ˆà¸²à¸‡à¹ƒà¸™ Chrome

**Fix (Owner à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ "à¹‚à¸­à¹€à¸„à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´"):**
1. `Layout.tsx`: à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸„à¸§à¸²à¸¡à¸«à¸¡à¸²à¸¢ `?cart=` à¸ˆà¸²à¸ "à¹€à¸•à¸´à¸¡" â†’ **"à¸•à¸±à¹‰à¸‡à¸•à¸°à¸à¸£à¹‰à¸²à¸•à¸²à¸¡à¸¥à¸´à¸‡à¸à¹Œ" (replace)** â€” à¸•à¸£à¸‡à¸„à¸³à¸ªà¸±à¸à¸à¸²à¸‚à¸­à¸‡ AI "à¹ƒà¸ªà¹ˆà¸•à¸°à¸à¸£à¹‰à¸²à¹ƒà¸«à¹‰à¹à¸¥à¹‰à¸§ à¸à¸”à¸¥à¸´à¸‡à¸à¹Œà¹€à¸žà¸·à¹ˆà¸­à¸”à¸¹à¸•à¸°à¸à¸£à¹‰à¸²" Â· **resolve à¸à¹ˆà¸­à¸™à¹à¸•à¸°à¸•à¸°à¸à¸£à¹‰à¸²** (à¸£à¸²à¸¢à¸à¸²à¸£à¹„à¸¡à¹ˆà¸¡à¸µà¸­à¸°à¹„à¸£à¹ƒà¸Šà¹‰à¹„à¸”à¹‰à¹€à¸¥à¸¢ = à¸«à¹‰à¸²à¸¡à¸—à¸³à¸¥à¸²à¸¢à¸•à¸°à¸à¸£à¹‰à¸²à¹€à¸”à¸´à¸¡ + toast à¹€à¸”à¸´à¸¡) Â· guard R102 à¸„à¸‡à¸­à¸¢à¸¹à¹ˆ = à¸à¸”à¸¥à¸´à¸‡à¸à¹Œà¹€à¸”à¸´à¸¡à¸‹à¹‰à¸³à¹„à¸¡à¹ˆà¹à¸•à¸°à¸•à¸°à¸à¸£à¹‰à¸² (à¸‚à¸­à¸‡à¸—à¸µà¹ˆà¹€à¸žà¸´à¹ˆà¸¡à¹€à¸­à¸‡à¸«à¸¥à¸±à¸‡à¸ˆà¸²à¸à¸¥à¸´à¸‡à¸à¹Œà¸™à¸±à¹‰à¸™à¹„à¸¡à¹ˆà¸«à¸²à¸¢) Â· toast à¸œà¸¥à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¸„à¸‡à¹€à¸”à¸´à¸¡
2. `socialLinkFormat.ts`: `stripBareShopLinks(draft)` à¹ƒà¸«à¸¡à¹ˆ â€” draft à¸«à¹‰à¸²à¸¡à¸¡à¸µà¸¥à¸´à¸‡à¸à¹Œà¸£à¹‰à¸²à¸™à¹€à¸­à¸‡à¸—à¸¸à¸à¸£à¸¹à¸›à¹à¸šà¸š (à¹€à¸›à¸¥à¹ˆà¸²/checkout/orders/template `<encoded>`) â†’ à¹à¸—à¸™à¸”à¹‰à¸§à¸¢ "à¸¥à¸´à¸‡à¸à¹Œà¸—à¹‰à¸²à¸¢à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡ (à¸£à¸°à¸šà¸šà¹à¸™à¸šà¹ƒà¸«à¹‰)" Â· regex à¹€à¸‰à¸žà¸²à¸° `STRIP_URL_RE` (path class à¹€à¸žà¸´à¹ˆà¸¡ `<>` à¸ˆà¸±à¸š template à¸„à¸£à¸š) Â· PURE
3. `social-ai-worker`: à¸à¸Ž **"1 reply = 1 à¸¥à¸´à¸‡à¸à¹Œà¸‚à¸­à¸‡à¸£à¸°à¸šà¸š"** â€” prompt à¸—à¸±à¹‰à¸‡ 2 persona + REPLY_GROUNDING_RULES + intake/order-action notes à¸«à¹‰à¸²à¸¡à¹€à¸‚à¸µà¸¢à¸™ URL à¹€à¸­à¸‡à¸—à¸¸à¸à¸à¸£à¸“à¸µ (à¸­à¹‰à¸²à¸‡ "à¸¥à¸´à¸‡à¸à¹Œà¸—à¹‰à¸²à¸¢à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡" à¹à¸—à¸™) Â· `finalText` = strip(draft) + footers + **default CTA `ðŸ›ï¸ à¹€à¸¡à¸™à¸¹à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¹à¸¥à¸°à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­: https://biteme-baby.com/shop`** à¹€à¸¡à¸·à¹ˆà¸­à¹„à¸¡à¹ˆà¸¡à¸µ footer à¹ƒà¸”à¸¡à¸µà¸¥à¸´à¸‡à¸à¹Œ â†’ à¸—à¸¸à¸ reply à¸¡à¸µà¸¥à¸´à¸‡à¸à¹Œà¸£à¹‰à¸²à¸™à¸—à¸µà¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡à¸­à¸±à¸™à¹€à¸”à¸µà¸¢à¸§à¹€à¸ªà¸¡à¸­
4. à¹€à¸—à¸ªà¸•à¹Œ `r104OneLinkOneCart.test.ts`: stripBareShopLinks pure à¸—à¸¸à¸à¹€à¸„à¸ª (à¹€à¸›à¸¥à¹ˆà¸²/template/checkout/orders/à¸§à¸£à¸£à¸„à¸•à¸­à¸™/à¸•à¹ˆà¸²à¸‡à¹‚à¸”à¹€à¸¡à¸™/idempotent/pipeline à¸à¸±à¸š normalize) + worker contracts (à¹„à¸¡à¹ˆà¸¡à¸µ template Â· draftTextClean Â· defaultShopFooter) + Layout replace contracts (resolve à¸à¹ˆà¸­à¸™ clear Â· clear à¸à¹ˆà¸­à¸™ add Â· guard/toast/retry à¸„à¸‡à¹€à¸”à¸´à¸¡) Â· r75 test à¸­à¸±à¸›à¹€à¸”à¸•à¸•à¸²à¸¡à¸‚à¹‰à¸­à¹€à¸—à¹‡à¸ˆà¸ˆà¸£à¸´à¸‡ (AI worker à¸«à¹‰à¸²à¸¡à¹€à¸‚à¸µà¸¢à¸™ URL â€” post worker à¸„à¸‡à¸à¸Žà¹€à¸”à¸´à¸¡)

**Gates:** `tsc --noEmit` 0 Â· `vitest run` **2516 tests PASS** (à¸£à¸§à¸¡ r75/r57/g6/socialAiContinuity pin à¹€à¸”à¸´à¸¡à¸„à¸£à¸š) Â· `npm run lint` OK (brandNameGuard + languageSanity â€” à¸ˆà¸±à¸š U+FFFD à¸ˆà¸²à¸ edit à¹à¸¥à¹‰à¸§à¹à¸à¹‰à¸„à¸£à¸š) Â· `npm run build` PASS

**Deploy:** `social-ai-worker` à¸•à¸±à¸§à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¸šà¸™ prod à¹à¸¥à¹‰à¸§ (R104 prompt/assembly) Â· frontend (Layout/socialLinkFormat) = Cloudflare auto-deploy à¸ˆà¸²à¸ push Â· **à¹€à¸«à¸¥à¸·à¸­à¹à¸•à¹ˆ Owner live test à¸à¸¥à¸¸à¹ˆà¸¡ I (8 à¸‚à¹‰à¸­) à¸•à¸²à¸¡ `docs/BMB_REMAIN_TESTS_LIVE_2026-11-23.md`**

**Commit:** `47d2043`

---

## R103 â€” 2026-11-24 â€” SERVER-SIDE CART SYNC v1

**Status:** CODE_CLOSED + GATES PASS (vitest 229 à¹„à¸Ÿà¸¥à¹Œ/2501 tests Â· tsc 0 Â· lint OK Â· build OK) Â· âœ… MIGRATION 213 APPLIED PROD (2026-11-24 Â· Owner à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´)

**Scope (à¸•à¹ˆà¸­à¸¢à¸­à¸” R102 â€” deep-link à¹à¸à¹‰ guest à¸‚à¹‰à¸²à¸¡à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¹„à¸”à¹‰à¹à¸¥à¹‰à¸§ Â· R103 à¹à¸à¹‰ "à¸¥à¹‡à¸­à¸à¸­à¸´à¸™à¹à¸¥à¹‰à¸§à¸•à¸°à¸à¸£à¹‰à¸²à¸•à¸²à¸¡à¸‚à¹‰à¸²à¸¡à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸ˆà¸£à¸´à¸‡"):**

1. `supabase/migrations/213_cart_sessions_payload.sql`: ADD COLUMN `payload JSONB` à¹ƒà¸«à¹‰ `cart_sessions` (à¹€à¸™à¸·à¹‰à¸­à¸•à¸°à¸à¸£à¹‰à¸²à¸ˆà¸£à¸´à¸‡ â€” à¸£à¸¹à¸›à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸š localStorage `bmb-cart-v1`: ids/qty/customizations/mode/coupon/referral Â· **à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸²à¸„à¸²/à¸¢à¸­à¸”à¸£à¸§à¸¡/PII** â€” server re-derive à¸•à¸­à¸™ RPC 025 à¹€à¸ªà¸¡à¸­) + RLS **`cart_sessions_select_own`** FOR SELECT TO authenticated (m180 à¸‚à¸²à¸”à¸™à¹‰à¸­à¸‡à¸™à¸µà¹‰ â€” à¹€à¸‚à¸µà¸¢à¸™à¹„à¸”à¹‰à¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰) Â· ADDITIVE ONLY re-run à¸›à¸¥à¸­à¸”à¸ à¸±à¸¢

2. `cartSessionSync.ts` (R49 telemetry â†’ R103 sync à¸ˆà¸£à¸´à¸‡): upsert **`id = 'csa-' + customerId`** (deterministic â€” 1 à¹à¸–à¸§/1 à¸¥à¸¹à¸à¸„à¹‰à¸² Â· à¸­à¸±à¸›à¹€à¸”à¸•à¸ˆà¸²à¸à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¹„à¸«à¸™à¸à¹‡à¹à¸–à¸§à¹€à¸”à¸´à¸¡ Â· à¸šà¸±à¸à¸Šà¸µà¸•à¹ˆà¸²à¸‡à¸à¸±à¸™ = à¹à¸–à¸§à¸•à¹ˆà¸²à¸‡à¸à¸±à¸™ = intent R68 à¸¢à¸±à¸‡à¸„à¸£à¸š) + `payload: serializeCartObject(state)` (à¸•à¸°à¸à¸£à¹‰à¸²à¸§à¹ˆà¸²à¸‡ = payload null) + `customerId` cache à¸•à¹ˆà¸­ uid + **`fetchLatestServerCart()`** à¹ƒà¸«à¸¡à¹ˆ (select payload à¸•à¸²à¸¡ customer_id Â· latest updated_at Â· à¸œà¹ˆà¸²à¸™ `parseStoredCart` strict validate Â· guest/anon = null à¹€à¸‡à¸µà¸¢à¸š à¹† R63 posture à¸„à¸‡à¹€à¸”à¸´à¸¡)

3. `cartPersistence.ts`: hydration path à¹€à¸žà¸´à¹ˆà¸¡ restore à¸ˆà¸²à¸ server â€” à¸à¸Žà¹€à¸”à¸µà¸¢à¸§: **local à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸²à¸¢à¸à¸²à¸£ = à¸¥à¸­à¸‡ server** (local à¸¡à¸µà¸‚à¸­à¸‡ = local à¸Šà¸™à¸° â€” à¹„à¸¡à¹ˆ surprise merge Â· à¹„à¸¡à¹ˆà¸¢à¸¸à¹ˆà¸‡ flow `?cart=` à¸‚à¸­à¸‡ Layout/R102) Â· dynamic import `cartSessionSync` (à¸à¸±à¸™ cycle) Â· restore à¹€à¸ªà¸£à¹‡à¸ˆà¸à¹ˆà¸­à¸™ `setHydrated()` (à¸¥à¸³à¸”à¸±à¸š deterministic â€” Layout `?cart=` à¸£à¸­ isHydrated)

4. à¹€à¸—à¸ªà¸•à¹Œ `r213CartServerSync.test.ts` (15 cases): migration contract (payload/select_own/à¹„à¸¡à¹ˆà¹à¸•à¸° policy à¹€à¸”à¸´à¸¡) Â· guest guard à¸à¹ˆà¸­à¸™ upsert (r49/r63 pin à¸„à¸‡à¸­à¸¢à¸¹à¹ˆ) Â· deterministic id Â· payload round-trip (à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸²à¸„à¸²à¸«à¸¥à¸¸à¸” Â· strict parse) Â· à¸¥à¸³à¸”à¸±à¸š restoreâ†’setHydrated Â· boot wiring à¸„à¸£à¸š Â· **R68 test contract à¸­à¸±à¸›à¹€à¸”à¸•à¸•à¸²à¸¡à¸‚à¹‰à¸­à¹€à¸—à¹‡à¸ˆà¸ˆà¸£à¸´à¸‡** (sessionId localStorage â†’ csa-<customerId> â€” intent "à¹„à¸¡à¹ˆà¸—à¸±à¸šà¸‚à¹‰à¸²à¸¡à¸šà¸±à¸à¸Šà¸µ" à¸¢à¸±à¸‡à¸„à¸£à¸š + pin à¹ƒà¸«à¸¡à¹ˆ à¸¢à¸´à¸‡à¸¢à¸·à¸™à¸¢à¸±à¸™ identity à¸ˆà¸²à¸ auth.uid())

**Gates:** `tsc --noEmit` 0 Â· `vitest run` 229 à¹„à¸Ÿà¸¥à¹Œ / 2501 tests PASS Â· `npm run lint` OK (3 gates) Â· `npm run build` PASS (PWA)

**Production:** Migration 213 APPLIED PROD âœ“ (2026-11-24 Â· Owner à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´) â€” `cart_sessions.payload` + `cart_sessions_select_own` RLS live à¸šà¸™ production â€” client sync à¸—à¸³à¸‡à¸²à¸™à¹€à¸•à¹‡à¸¡à¸£à¸¹à¸›à¸—à¸±à¸™à¸—à¸µ

**Cross-device Result:** à¸¥à¹‡à¸­à¸à¸­à¸´à¸™ = server sync (R103 à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´ à¸‚à¹‰à¸²à¸¡à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸—à¸¸à¸à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸—à¸µà¹ˆà¸¥à¹‡à¸­à¸à¸­à¸´à¸™à¸šà¸±à¸à¸Šà¸µà¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™) Â· guest = deep-link `?cart=` (R101/R63b/R102 â€” à¸žà¸´à¸ªà¸¹à¸ˆà¸™à¹Œ live à¹à¸¥à¹‰à¸§)

---

## R102 â€” 2026-11-24 â€” FB IAB CART DOUBLE-ADD + EXTERNAL COPY EMPTY CART

**Status:** CODE_CLOSED + GATES PASS (vitest 228 à¹„à¸Ÿà¸¥à¹Œ/2486 tests Â· tsc 0 Â· lint OK Â· build OK)

**à¸­à¸²à¸à¸²à¸£à¸ˆà¸²à¸ live test:**
1. **IAB (à¹ƒà¸™à¹à¸­à¸›à¹€à¸Ÿà¸‹)**: à¸à¸”à¸¥à¸´à¸‡à¸à¹Œ AI (à¹ƒà¸•à¹‰à¹‚à¸žà¸ª/à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡) à¸«à¸¥à¸²à¸¢à¸„à¸£à¸±à¹‰à¸‡ / navigate à¸à¸¥à¸±à¸š `/shop` â†’ à¸™à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²à¹€à¸žà¸´à¹ˆà¸¡à¸—à¸¸à¸à¸„à¸£à¸±à¹‰à¸‡ (24 â†’ 26 â†’ 26 à¸Šà¸´à¹‰à¸™)
2. **External (Chrome/Safari à¸œà¹ˆà¸²à¸™à¹à¸šà¸™à¹€à¸™à¸­à¸£à¹Œà¸„à¸±à¸”à¸¥à¸­à¸)**: à¸„à¸±à¸”à¸¥à¸­à¸à¸¥à¸´à¸‡à¸à¹Œà¸ˆà¸²à¸ IAB â†’ à¹€à¸›à¸´à¸”à¹ƒà¸™ Chrome â†’ à¸•à¸°à¸à¸£à¹‰à¸²à¸§à¹ˆà¸²à¸‡ / à¹„à¸¡à¹ˆà¸•à¸£à¸‡à¸à¸±à¸š WebView

**Root Cause à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™:**
- RC1: `history.replaceState` **à¸¥à¹‰à¸¡à¹€à¸«à¸¥à¸§à¹ƒà¸™ FB IAB** â†’ `?cart=` à¸„à¹‰à¸²à¸‡à¹ƒà¸™ URL â†’ navigate à¸à¸¥à¸±à¸š `/shop` (à¹à¸¡à¹‰à¹ƒà¸™ SPA) â†’ Layout effect à¸£à¸±à¸™à¹ƒà¸«à¸¡à¹ˆ â†’ decode `?cart=` à¸‹à¹‰à¸³ â†’ `addItem` à¸‹à¹‰à¸³ â†’ à¸™à¸±à¸šà¸‹à¹‰à¸³
- RC2: à¸¥à¸´à¸‡à¸à¹Œà¸—à¸µà¹ˆà¸„à¸±à¸”à¸¥à¸­à¸à¸¡à¸²à¸ˆà¸²à¸ IAB à¸¡à¸µ `?cart=` **à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢ (double-encoded / payload à¹à¸žà¸°à¸ˆà¸²à¸à¸šà¸±à¹Šà¸ IAB)** â†’ `normalizeCartParam` à¸–à¸­à¸”à¹„à¸¡à¹ˆà¹„à¸”à¹‰ â†’ `return` à¹„à¸¡à¹ˆà¹€à¸•à¸´à¸¡à¸‚à¸­à¸‡

**Fix 4 à¸ˆà¸¸à¸”:**
1. `cartDeepLink.ts`: à¹€à¸žà¸´à¹ˆà¸¡ `cartParamFingerprint(raw)` â€” FNV-1a 32-bit + à¸„à¸§à¸²à¸¡à¸¢à¸²à¸§ (pure, sync, dedup à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™) Â· **à¹€à¸«à¸•à¸¸à¸œà¸¥à¸ªà¸³à¸„à¸±à¸: à¸«à¹‰à¸²à¸¡à¹ƒà¸Šà¹‰ prefix slice** â€” à¹€à¸—à¸ªà¸•à¹Œà¸ˆà¸±à¸š collision à¸ˆà¸£à¸´à¸‡: b64url à¸‚à¸­à¸‡ JSON `{"id":"p-a"` vs `p-b` à¸¡à¸µ 12 à¹„à¸šà¸•à¹Œà¹à¸£à¸à¹€à¸«à¸¡à¸·à¸­à¸™à¸à¸±à¸™ â†’ prefix 16 à¸•à¸±à¸§à¹ƒà¸«à¹‰ key à¹€à¸”à¸´à¸¡ = **à¸šà¸¥à¹‡à¸­à¸à¸¥à¸´à¸‡à¸à¹Œà¹ƒà¸«à¸¡à¹ˆà¸œà¸´à¸”**
2. `Layout.tsx` (effect ?cart=): sessionStorage guard `bmb:cart-processed-<fingerprint>` â€” check à¸à¹ˆà¸­à¸™ side effect à¸—à¸¸à¸à¸­à¸¢à¹ˆà¸²à¸‡ (à¸à¹ˆà¸­à¸™à¹€à¸‚à¸µà¸¢à¸™ snapshot) â†’ à¹€à¸„à¸¢ process à¹à¸¥à¹‰à¸§ return à¸—à¸±à¸™à¸—à¸µ Â· mark `=== '1'` à¸«à¸¥à¸±à¸‡ `added > 0` **à¸à¹ˆà¸­à¸™** `replaceState` (à¸à¸±à¸™ race â€” IAB strip fail à¸à¹‡ mark à¹à¸¥à¹‰à¸§) Â· wrap try/catch à¸•à¸²à¸¡ house style
3. `InAppBrowserBanner.tsx` (`buildLiveHandoffUrl`): strip `fbclid` **à¸à¹ˆà¸­à¸™** fallback chain + live cart à¸šà¸±à¸‡à¸„à¸±à¸šà¹ƒà¸Šà¹‰à¹€à¸ªà¸¡à¸­à¹€à¸¡à¸·à¹ˆà¸­à¸¡à¸µà¸‚à¸­à¸‡ (fallback snapshot/resume à¹€à¸‰à¸žà¸²à¸° `!enc`) + `u.searchParams.set('cart', enc)` = **à¹€à¸‚à¸µà¸¢à¸™à¸—à¸±à¸š payload à¹à¸žà¸°à¹€à¸”à¸´à¸¡à¹ƒà¸™ URL à¹€à¸ªà¸¡à¸­** + `data-testid="inapp-live-cart-count"`
4. Test à¹ƒà¸«à¸¡à¹ˆ `fbCartBridgeIAB.test.ts` (16 cases): v2 round-trip (mods+lm) Â· mangle 1/2/3 à¸Šà¸±à¹‰à¸™à¸–à¸­à¸”à¹„à¸”à¹‰ (à¹€à¸„à¸ª copy à¸‚à¹‰à¸²à¸¡ WebView) Â· URLSearchParams round-trip Â· garbage=null Â· v1 back-compat Â· payload>1800 â†’ truncated Â· source contracts (guard à¸à¹ˆà¸­à¸™ side-effect, mark à¸à¹ˆà¸­à¸™ replaceState, fbclid à¸à¹ˆà¸­à¸™ chain, live-cart priority) Â· behavioral guard à¹ƒà¸Šà¹‰ fingerprint à¸ˆà¸£à¸´à¸‡ (à¸à¸” 5 à¸„à¸£à¸±à¹‰à¸‡ â†’ à¸­à¸™à¸¸à¸à¸²à¸• 1 Â· à¸¥à¸´à¸‡à¸à¹Œà¹ƒà¸«à¸¡à¹ˆ = à¸„à¸™à¸¥à¸° fingerprint = à¸œà¹ˆà¸²à¸™)

**Gates:** `tsc --noEmit` 0 error Â· `vitest run` 228 à¹„à¸Ÿà¸¥à¹Œ / 2486 tests PASS (à¸£à¸§à¸¡ r101 contract à¹€à¸”à¸´à¸¡à¹„à¸¡à¹ˆà¸žà¸±à¸‡) Â· `npm run lint` OK (eslint + brandNameGuard + languageSanity â€” à¸ˆà¸±à¸š U+FFFD 2 à¸ˆà¸¸à¸”à¸ˆà¸²à¸à¸à¸²à¸£ edit à¹à¸¥à¹‰à¸§à¹à¸à¹‰) Â· `npm run build` PASS (PWA precache 165 entries)

---

## R64 â€” 2026-11-23 â€” DELIVERY SYNC FIX

**Status:** CODE_CLOSED + GATES PASS (vitest 226 à¹„à¸Ÿà¸¥à¹Œ/2447 tests Â· tsc 0 Â· lint OK Â· build OK) + MIGRATION 212 APPLIED + PUSHED

**à¸­à¸²à¸à¸²à¸£à¸ˆà¸²à¸ live test (à¸£à¸¹à¸› 18:34â€“20:07):**
1. à¹„à¸£à¹€à¸”à¸­à¸£à¹Œà¸à¸” "à¸£à¸±à¸šà¸­à¸²à¸«à¸²à¸£à¹€à¸žà¸·à¹ˆà¸­à¹€à¸”à¸´à¸™à¸—à¸²à¸‡à¸­à¸­à¸à¸ªà¹ˆà¸‡" â†’ `ERR_DELIVERY_SYNC_BLOCKED: order PO-20261124-544 cannot advance preparing -> <NULL> (target dispatched)` â€” à¸§à¸‡à¸ˆà¸£à¸•à¸±à¸™
2. à¸¥à¸¹à¸à¸„à¹‰à¸²à¸—à¸¸à¸à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸„à¹‰à¸²à¸‡à¸—à¸µà¹ˆ "à¸ˆà¸±à¸”à¸—à¸³à¸£à¸­à¸šà¸žà¸£à¸µà¸­à¸­à¹€à¸”à¸­à¸£à¹Œ" à¹„à¸—à¸¡à¹Œà¹„à¸¥à¸™à¹Œà¹„à¸¡à¹ˆà¸‚à¸¢à¸±à¸š
3. à¹à¸œà¸™à¸—à¸µà¹ˆà¸£à¸§à¸¡à¹„à¸£à¹€à¸”à¸­à¸£à¹Œà¹ƒà¸Šà¹‰à¹„à¸”à¹‰ Â· à¹à¸œà¸™à¸—à¸µà¹ˆà¸£à¸²à¸¢à¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¸‚à¸²à¸§ 1 à¹ƒà¸š (multi-instance Leaflet init race)
4. Error à¹à¸¥à¹‰à¸§à¹à¸œà¸‡ POD à¸›à¸´à¸”à¹€à¸­à¸‡ (à¸”à¸¹à¹€à¸«à¸¡à¸·à¸­à¸™à¸›à¸´à¸”à¸‡à¸²à¸™ à¹à¸•à¹ˆà¸‡à¸²à¸™à¸¢à¸±à¸‡ accepted + POD à¹à¸™à¸šà¸„à¸£à¸¶à¹ˆà¸‡à¸—à¸²à¸‡)
5. à¹à¸­à¸”à¸¡à¸´à¸™ "ðŸ à¹à¸­à¸”à¸¡à¸´à¸™à¸›à¸´à¸”à¸§à¸‡à¸ˆà¸£" à¸•à¸±à¸™à¸ˆà¸¸à¸”à¹€à¸”à¸´à¸¡
6. à¸«à¸™à¹‰à¸²à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¸¥à¸¹à¸à¸„à¹‰à¸²: Google Maps à¹‚à¸«à¸¥à¸”à¹„à¸¡à¹ˆà¹„à¸”à¹‰ (key à¸–à¸¹à¸à¸›à¸à¸´à¹€à¸ªà¸˜) + à¸à¸¥à¹ˆà¸­à¸‡à¸žà¸´à¸à¸±à¸”à¹à¸¡à¸™à¸™à¸§à¸¥à¹à¸”à¸‡à¸—à¸±à¹‰à¸‡à¸—à¸µà¹ˆ GPS à¸¢à¸·à¸™à¸¢à¸±à¸™à¹à¸¥à¹‰à¸§

**Root Cause:**
- RC1: 3 RPC canonical (`driver_update_delivery_status` m197, `admin_advance_delivery_status` m116, `driver_checkin_arrival` m166) à¸¡à¸µ hop chain à¹€à¸£à¸´à¹ˆà¸¡à¹à¸„à¹ˆ `ready_for_dispatch` â†’ à¸­à¸­à¹€à¸”à¸­à¸£à¹Œ `preparing` à¸•à¸±à¸™à¸„à¹‰à¸²à¸‡ (R87b pattern)
- RC2: `driverErrorText` à¹„à¸¡à¹ˆà¸¡à¸µ mapping ERR_DELIVERY_SYNC_BLOCKED/ERR_KITCHEN_NOT_READY â†’ à¹‚à¸Šà¸§à¹Œà¸­à¸±à¸‡à¸à¸¤à¸©à¸”à¸´à¸š + kind='state' à¸‹à¹ˆà¸­à¸™à¸›à¸¸à¹ˆà¸¡ retry
- RC3: `completeDelivery` finally à¹€à¸„à¸¥à¸µà¸¢à¸£à¹Œ `activeOrder` à¹à¸¡à¹‰ error â†’ à¹à¸œà¸‡ POD à¸›à¸´à¸”à¸•à¸±à¸§à¹€à¸­à¸‡
- RC4: `RiderMiniMap` à¸ªà¸£à¹‰à¸²à¸‡/à¸—à¸³à¸¥à¸²à¸¢à¹à¸œà¸™à¸—à¸µà¹ˆà¸‹à¹‰à¸³à¸—à¸¸à¸à¸„à¸£à¸±à¹‰à¸‡ GPS/pin à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™ + init race + Google leak â†’ à¸‚à¸²à¸§à¸šà¸²à¸‡à¹ƒà¸š
- RC5: `DeliveryMapPicker` à¹„à¸¡à¹ˆà¸¡à¸µ Leaflet fallback + UX à¸à¸¥à¹ˆà¸­à¸‡à¹à¸¡à¸™à¸™à¸§à¸¥à¸«à¸¥à¸­à¸
- RC6: warning à¸¡à¸­à¸šà¸«à¸¡à¸²à¸¢à¸‹à¹‰à¸³à¹„à¸¡à¹ˆà¸•à¸£à¸‡ (busy = multi-job OK)

**Fix à¹à¸šà¹ˆà¸‡ 5 à¹€à¸Ÿà¸ª (à¸•à¸²à¸¡à¹à¸žà¸¥à¸™ `.kilo/plans/1795441113954-delivery-sync-fix-plan.md`):**
- **Phase A (m212):** à¸•à¹ˆà¸­ hop chain â€” à¹€à¸žà¸´à¹ˆà¸¡ `preparing â†’ ready_for_dispatch` + guard `pending/confirmed` raise `ERR_KITCHEN_NOT_READY` (à¹„à¸—à¸¢à¸Šà¸±à¸”) à¹ƒà¸™ 3 RPC Â· audit message à¸£à¸°à¸šà¸¸ auto-hop
- **Phase B:** `driverService.ts` à¹€à¸žà¸´à¹ˆà¸¡ mapping à¹„à¸—à¸¢ 2 error Â· `RiderPwaPage.tsx` completeDelivery à¹„à¸¡à¹ˆà¹€à¸„à¸¥à¸µà¸¢à¸£à¹Œ activeOrder à¸•à¸­à¸™ error + `podAttachDoneRef` skip re-upload Â· order_status chip à¹ƒà¸™à¸à¸²à¸£à¹Œà¸” + à¸›à¸¸à¹ˆà¸¡ label "ðŸ›µ à¸£à¸±à¸šà¸­à¸²à¸«à¸²à¸£à¹€à¸žà¸·à¹ˆà¸­à¹€à¸”à¸´à¸™à¸—à¸²à¸‡à¸­à¸­à¸à¸ªà¹ˆà¸‡"
- **Phase C:** `DeliveryManagement.tsx` warning copy à¹à¸¢à¸ busy/offline Â· preparing badge + kitchen link à¹ƒà¸™à¸„à¸´à¸§ dispatch
- **Phase D:** `RiderMiniMap` restructure: single init + imperative marker update + invalidateSize + ResizeObserver + stable keys Â· `DeliveryMapPicker` à¹€à¸žà¸´à¹ˆà¸¡ Leaflet/OSM fallback + à¸‹à¹ˆà¸­à¸™à¸à¸¥à¹ˆà¸­à¸‡à¹à¸¡à¸™à¸™à¸§à¸¥à¹€à¸¡à¸·à¹ˆà¸­à¸¡à¸µ candidate
- **Phase E:** Test source-contract (r212DeliverySyncPreparingHop + updates) + gates à¸œà¹ˆà¸²à¸™ + docs updated

**Migration:** `212_delivery_sync_preparing_hop.sql` (REVOKE PUBLIC / GRANT authenticated à¹€à¸—à¹ˆà¸² baseline Â· 3 à¸Ÿà¸±à¸‡à¸à¹Œà¸Šà¸±à¸™ canonical verbatim + hop à¹ƒà¸«à¸¡à¹ˆ + guard)

**Out of scope:** state machine / assignment structure / server-side cart / Google Maps key (à¸à¸±à¹ˆà¸‡ Owner)

---

## R63d â€” 2026-11-23 â€” STICKER CONSOLIDATION

**Status:** CODE_CLOSED + GATES PASS (vitest 226 à¹„à¸Ÿà¸¥à¹Œ/2447 tests Â· tsc 0 Â· lint OK Â· build OK) + PUSHED `d67bf47` Â· frontend only (Cloudflare auto-deploy)

**Root cause:** `stickerRollForOrder()` split 1 à¸­à¸­à¹€à¸”à¸­à¸£à¹Œ = 1 à¸”à¸§à¸‡/à¸Šà¸´à¹‰à¸™ Ã— qty â†’ 3 à¸à¸¥à¹ˆà¸­à¸‡ = 3 à¸ªà¸•à¸´à¸à¹€à¸à¸­à¸£à¹Œ Â· `stickerForm.ts` (R66) à¸£à¸­à¸‡à¸£à¸±à¸š ORDER LIST 4 à¸šà¸£à¸£à¸—à¸±à¸”à¸•à¹ˆà¸­à¹€à¸™à¸·à¹ˆà¸­à¸‡ `~24 à¸•à¸±à¸§à¸­à¸±à¸à¸©à¸£/à¹à¸–à¸§` à¸„à¸±à¹ˆà¸™ ` Â· ` à¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§

**Fix (`d67bf47`):** `stickerRollForOrder` à¸„à¸·à¸™ `[data]` (1 element = à¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¹€à¸•à¹‡à¸¡) à¹à¸—à¸™ split per item â†’ `printStickerRoll` render PNG 1 à¸£à¸¹à¸› â†’ Bluetooth 1 job

**Test lock:** `stickerQueueR31.test.ts` contract à¹ƒà¸«à¸¡à¹ˆ â€” `roll.length === 1` Â· items à¸„à¸‡ quantity à¸ˆà¸£à¸´à¸‡ (`x2`, `x1`) Â· special_request à¸£à¸±à¸à¸©à¸²à¹„à¸§à¹‰

**AdminOrders.tsx:** toast `${roll.length} à¹ƒà¸š` â†’ `1 à¹ƒà¸š`

**Impact:** 1 à¸­à¸­à¹€à¸”à¸­à¸£à¹Œ/1 à¸¥à¸¹à¸à¸„à¹‰à¸² = 1 à¸ªà¸•à¸´à¸à¹€à¸à¸­à¸£à¹Œ (à¸ªà¸­à¸”à¸„à¸¥à¹‰à¸­à¸‡ R5c 1 cart = 1 order) Â· à¹„à¸¡à¹ˆà¸¡à¸µ migration

---

## R63c â€” 2026-11-23 â€” CART UX + CLOSED ROUNDS

**Status:** CODE_CLOSED + GATES PASS (vitest 226 à¹„à¸Ÿà¸¥à¹Œ/2447 tests Â· tsc 0 Â· lint OK Â· build OK) + PUSHED `9f5f517` Â· frontend only (Cloudflare auto-deploy 2-3 à¸™à¸²à¸—à¸µ)

**CartPage:** à¸¥à¸š card ðŸŽŸï¸ à¸„à¸¹à¸›à¸­à¸‡/à¹‚à¸›à¸£à¹‚à¸¡à¸Šà¸±à¹ˆà¸™ (R10 à¸„à¸‡à¸„à¸¹à¸›à¸­à¸‡à¹„à¸§à¹‰à¸«à¸™à¹‰à¸² checkout) + à¸¥à¸š card ðŸ’° à¸ªà¸£à¸¸à¸›à¸£à¸²à¸„à¸² (à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”) â†’ à¹€à¸«à¸¥à¸·à¸­à¸£à¸²à¸¢à¸à¸²à¸£à¸ªà¸´à¸™à¸„à¹‰à¸² + AddonCrossSellStrip + (stale pre-order warning) + à¸›à¸¸à¹ˆà¸¡ "à¸¢à¸·à¸™à¸¢à¸±à¸™à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­ â†’" à¹€à¸”à¸µà¸¢à¸§à¹„à¸› /checkout (gated `hasStalePreOrder`)

**CheckoutPage:** PRE_ORDER fetch rounds à¹ƒà¸Šà¹‰ `getRoundsForDateAdmin` (all non-archived) à¹à¸—à¸™ `listRoundsForDate` (active-only) â†’ à¸£à¸­à¸šà¸—à¸µà¹ˆà¹à¸­à¸”à¸¡à¸´à¸™à¸›à¸´à¸” `status='closed'` à¹‚à¸Šà¸§à¹Œà¹à¸•à¹ˆ **disabled/à¹€à¸—à¸² + badge "à¸›à¸´à¸”à¸£à¸±à¸š (à¹à¸­à¸”à¸¡à¸´à¸™)"** Â· logic: `closed = r.status==='closed' || roundBookability!=='open'` Â· SAME_DAY auto-select à¸„à¸‡à¹€à¸”à¸´à¸¡

**Tests updated:** `checkoutModeLock`, `checkoutMixedSplit`, `r65PickupHoursNotRounds` â€” mock `getRoundsForDateAdmin` à¸„à¸·à¸™ `status='active'` Â· pins `go-checkout` testid à¸„à¸‡à¸­à¸¢à¸¹à¹ˆ

**Migration check:** à¹„à¸¡à¹ˆà¸¡à¸µ migration à¹ƒà¸«à¸¡à¹ˆ â€” à¸£à¸°à¸šà¸š `delivery_rounds.status` ('active'/'closed') + RLS public read `status='active'` à¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§à¸–à¸¹à¸à¸•à¹‰à¸­à¸‡

---

## R63b â€” 2026-11-23 â€” HOTFIX (Cart Bridge Stale Closure)

**Status:** CODE_CLOSED + GATES PASS (vitest 226 à¹„à¸Ÿà¸¥à¹Œ/2447 tests +1 Â· tsc 0 Â· lint OK Â· build OK) + PUSHED `f6e4022` Â· frontend only

**Root cause:** `InAppBrowserBanner.tsx:140` à¸­à¹ˆà¸²à¸™ `useCartStore.getState().items` à¹ƒà¸™ render body = à¸„à¹ˆà¸²à¸„à¹‰à¸²à¸‡ mount (à¹„à¸¡à¹ˆ subscribe) â€” à¸¥à¸¹à¸à¸„à¹‰à¸²à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸¡à¸™à¸¹à¹ƒà¸™ WebView à¹à¸¥à¹‰à¸§ banner à¹„à¸¡à¹ˆà¸£à¸¹à¹‰ â†’ à¸›à¸¸à¹ˆà¸¡à¸„à¸±à¸”à¸¥à¸­à¸/à¸à¸¥à¹ˆà¸­à¸‡à¸¥à¸´à¸‡à¸à¹Œà¹ƒà¸Šà¹‰à¸•à¸°à¸à¸£à¹‰à¸²à¸¡OUNT à¹€à¸à¹ˆà¸² (payload AI summary) à¹€à¸ªà¸¡à¸­ à¸—à¸±à¹‰à¸‡à¸—à¸µà¹ˆ `encodeLiveCartParam` v2 + Layout restore v2 à¸–à¸¹à¸à¸•à¹‰à¸­à¸‡à¹à¸¥à¹‰à¸§

**Fix:** â‘  `liveCart = useCartStore((state) => state.items)` â€” subscription hook à¸ˆà¸£à¸´à¸‡ (banner re-render à¸—à¸¸à¸à¸à¸²à¸£à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸•à¸°à¸à¸£à¹‰à¸² â†’ URL à¸—à¸¸à¸à¸—à¸²à¸‡à¸ˆà¸²à¸à¸•à¸°à¸à¸£à¹‰à¸²à¸ªà¸” à¸“ à¹€à¸§à¸¥à¸²à¸à¸”) â‘¡ à¸•à¸±à¸” dead code `handoffUrl` (mount snapshot URL â€” à¸•à¹‰à¸™à¸—à¸²à¸‡à¹à¸™à¸§à¸„à¸´à¸”à¹€à¸à¹ˆà¸²) â€” à¸„à¸±à¸”à¸¥à¸­à¸à¸—à¸¸à¸à¸—à¸²à¸‡à¸œà¹ˆà¸²à¸™ `buildLiveHandoffUrl` à¹€à¸”à¸µà¸¢à¸§

**Test lock:** R63b à¹ƒà¸™ `r101CartHandoffFix.test.ts` (selector hook + à¸«à¹‰à¸²à¸¡ getState().items + à¸«à¹‰à¸²à¸¡ handoffUrl)

**à¸£à¸­ Owner retest:** H-1/H-2 (à¹à¸—à¹‡à¸šà¹€à¸¥à¹‡à¸•: FB WebView à¸ªà¸±à¹ˆà¸‡ â‰¥4 à¸šà¸£à¸£à¸—à¸±à¸” â†’ à¸„à¸±à¸”à¸¥à¸­à¸à¸¥à¸´à¸‡à¸à¹Œ â†’ à¸§à¸²à¸‡à¹ƒà¸™à¹€à¸šà¸£à¸²à¸§à¹Œà¹€à¸‹à¸­à¸£à¹Œà¸ à¸²à¸¢à¸™à¸­à¸ = à¸•à¸°à¸à¸£à¹‰à¸²à¸•à¸£à¸‡à¸—à¸¸à¸à¸•à¸±à¸§à¹€à¸¥à¸‚)

---

## R63 â€” 2026-11-23 â€” BMB-FB-CART-BRIDGE-LIVE Phase 1â€“3

**Status:** SESSION CLOSED â€” CODE_CLOSED + PUSHED (`9b913c9`) + EF `social-ai-worker` DEPLOYED exit=0 + SMOKE http=200 boot_ok=true

**à¸›à¸±à¸à¸«à¸²:** à¹ƒà¸™ Facebook WebView à¸•à¸°à¸à¸£à¹‰à¸²à¸¡à¸µ **4 à¸šà¸£à¸£à¸—à¸±à¸” / 17 à¸Šà¸´à¹‰à¸™ / à¸¿1,313** à¹à¸•à¹ˆà¸à¸” "à¸„à¸±à¸”à¸¥à¸­à¸à¸¥à¸´à¸‡à¸à¹Œ â†’ à¸§à¸²à¸‡à¹ƒà¸™ Chrome" à¹à¸¥à¹‰à¸§à¹„à¸”à¹‰à¹€à¸žà¸µà¸¢à¸‡ **1 à¸£à¸²à¸¢à¸à¸²à¸£ à¸¿79** (= payload à¸‚à¸­à¸‡à¸¥à¸´à¸‡à¸à¹Œ AI à¸ªà¸£à¸¸à¸›à¸£à¸­à¸šà¸„à¸¸à¸¢à¸¥à¹ˆà¸²à¸ªà¸¸à¸”)

**Root Cause 4 à¸Šà¸±à¹‰à¸™:**
1. AI à¸ªà¸£à¹‰à¸²à¸‡ `?cart=` à¸ˆà¸²à¸ **à¸£à¸²à¸¢à¸à¸²à¸£ matched à¸‚à¸­à¸‡à¸£à¸­à¸šà¸„à¸¸à¸¢à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™** â€” `supabase/functions/_shared/socialOrderIntake.ts:555-561` (`cartFooterForMatch`) â€” server à¹„à¸¡à¹ˆà¸¡à¸µà¸•à¸°à¸à¸£à¹‰à¸²à¸à¸±à¹ˆà¸‡à¸¥à¸¹à¸à¸„à¹‰à¸²à¹ƒà¸«à¹‰à¸­à¹ˆà¸²à¸™
2. à¸›à¸¸à¹ˆà¸¡à¸„à¸±à¸”à¸¥à¸­à¸à¸ªà¹ˆà¸‡à¸•à¹ˆà¸­ **à¸ªà¹à¸™à¸›à¸Šà¸­à¸• mount à¸„à¸£à¸±à¹‰à¸‡à¹€à¸”à¸µà¸¢à¸§ / `bmb:cart-resume` à¸—à¸µà¹ˆà¹„à¸¡à¹ˆà¸¡à¸µ TTL** â€” `src/components/InAppBrowserBanner.tsx:62-70, 131-159` â€” à¹„à¸¡à¹ˆà¸¡à¸µà¹‚à¸„à¹‰à¸”à¹ƒà¸” serialize à¸•à¸°à¸à¸£à¹‰à¸²à¸ªà¸”à¸¥à¸‡à¸¥à¸´à¸‡à¸à¹Œ
3. `Layout.tsx:136-141` strip `?cart=`/`?s=` à¸«à¸¥à¸±à¸‡ restore (Â§T-A) â†’ à¸¥à¸´à¸‡à¸à¹Œà¸—à¸µà¹ˆà¸„à¸±à¸”à¸¥à¸­à¸à¸žà¸² payload à¹€à¸à¹ˆà¸²à¹€à¸ªà¸¡à¸­
4. Restore à¸—à¸±à¹‰à¸‡à¸ªà¸­à¸‡ path **hardcode `addItem(p, q, {}, 'SAME_DAY')`** â†’ à¸—à¸´à¹‰à¸‡ add-ons + line_mode â€” `Layout.tsx:125, 199`

**Fix Phase 1â€“3 (à¸•à¸²à¸¡à¹à¸žà¸¥à¸™ `.kilo/plans/1795399498532-fb-cart-bridge-live-plan.md`):**
- **Phase 1 â€” `cartDeepLink.ts` payload v2 (pure lib):** à¹€à¸žà¸´à¹ˆà¸¡ `encodeLiveCartParam(lines)` â†’ `{v:2, items:[{id,q,mods?,lm?}]}`; caps: 30 items, 50 qty/item, payload â‰¤1800 chars; downgrade: à¸•à¸±à¸” mods à¸à¹ˆà¸­à¸™ (droppedMods) à¹à¸¥à¹‰à¸§à¸„à¹ˆà¸­à¸¢à¸•à¸±à¸”à¸šà¸£à¸£à¸—à¸±à¸” (truncated); v1 API à¹€à¸”à¸´à¸¡à¹„à¸¡à¹ˆà¹à¸•à¸° (server mirror)
- **Phase 2 â€” à¸›à¸¸à¹ˆà¸¡à¸„à¸±à¸”à¸¥à¸­à¸à¸žà¸²à¸•à¸°à¸à¸£à¹‰à¸²à¸ªà¸”:** `copyHandoff` à¸ªà¸£à¹‰à¸²à¸‡ URL à¸“ à¹€à¸§à¸¥à¸²à¸à¸”à¸ˆà¸²à¸ `encodeLiveCartParam(useCartStore.getState().items)` â€” live cart; fallback chain: live cart â†’ cartHandoff.raw (mount) â†’ readCartResume (TTL 30 à¸™à¸²à¸—à¸µ); banner count à¹ƒà¸Šà¹‰à¸ˆà¸³à¸™à¸§à¸™à¸•à¸°à¸à¸£à¹‰à¸²à¸ªà¸” + à¹à¸ˆà¹‰à¸‡ truncated/droppedMods à¸•à¸²à¸¡à¸ˆà¸£à¸´à¸‡; strip `fbclid` à¹ƒà¸™ handoffUrl; hooks-before-return (R90) à¸„à¸‡à¹€à¸”à¸´à¸¡; à¸«à¹‰à¸²à¸¡ intent:// (R92 à¸–à¸²à¸§à¸£)
- **Phase 3 â€” à¸„à¸§à¸²à¸¡à¸ˆà¸£à¸´à¸‡à¸—à¸¸à¸à¸Šà¹ˆà¸­à¸‡à¸—à¸²à¸‡ (server shared lib):** `socialOrderIntake.ts` `buildCartSummaryFooter`: à¹€à¸•à¸´à¸¡à¸šà¸£à¸£à¸—à¸±à¸” scope disclosure à¸ˆà¸£à¸´à¸‡ â€” "â„¹ï¸ à¸¥à¸´à¸‡à¸à¹Œà¸™à¸µà¹‰à¸žà¸²à¹€à¸‰à¸žà¸²à¸°à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸„à¸¸à¸¢à¸à¸±à¸™à¹ƒà¸™à¸£à¸­à¸šà¸™à¸µà¹‰ â€” à¸‚à¸­à¸‡à¸—à¸µà¹ˆà¹€à¸žà¸´à¹ˆà¸¡à¹€à¸­à¸‡à¸šà¸™à¹€à¸§à¹‡à¸šà¸¢à¸±à¸‡à¸­à¸¢à¸¹à¹ˆà¸à¸±à¸šà¹€à¸§à¹‡à¸šà¸‚à¸­à¸‡à¸„à¸¸à¸“ (à¹ƒà¸™à¸«à¸™à¹‰à¸²à¹€à¸§à¹‡à¸šà¸à¸”à¸„à¸±à¸”à¸¥à¸­à¸à¸¥à¸´à¸‡à¸à¹Œ = à¸žà¸²à¸•à¸°à¸à¸£à¹‰à¸²à¹€à¸•à¹‡à¸¡à¹„à¸›à¸”à¹‰à¸§à¸¢)" (`cartFooterForMatch` R92 à¸„à¸‡à¸žà¸¤à¸•à¸´à¸à¸£à¸£à¸¡)
- **Phase 4 â€” Tests + Gates:** à¸­à¸±à¸›à¹€à¸”à¸• `cartDeepLink.test.ts` (v2 round-trip, caps/downgrade, back-compat v1, double-encode), `r101CartHandoffFix.test.ts` (banner contract à¹ƒà¸«à¸¡à¹ˆ: live-cart-at-click + fallback + TTL + testids), `socialOrderIntake.test.ts` + `socialAiContinuity.test.ts` (scope line) â€” **à¹€à¸à¸•à¸œà¹ˆà¸²à¸™à¸„à¸£à¸š: `tsc` 0 errors Â· `npm run lint` OK Â· `npm run test` 226 files / 2446 tests PASS Â· `npm run build` PASS (PWA v1.3.0)**

**Deploy:** `social-ai-worker` à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ (importer à¹€à¸”à¸µà¸¢à¸§à¸‚à¸­à¸‡ intake footer) â€” **DEPLOYED exit=0** (2026-11-23 05:21:08Z) Â· SMOKE PASS: http=200 + boot_ok=true

**Out of scope:** Server-side/account cart (à¸‹à¸´à¸‡à¸à¹Œà¸‚à¹‰à¸²à¸¡à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸ˆà¸£à¸´à¸‡) â€” future; à¸„à¸¹à¸›à¸­à¸‡/referral/à¸„à¹ˆà¸²à¸ªà¹ˆà¸‡à¹ƒà¸™à¸¥à¸´à¸‡à¸à¹Œ; LINE/IG à¹€à¸‰à¸žà¸²à¸°à¸—à¸²à¸‡

---

## R62 â€” 2026-11-22 â€” BMB-ADMIN-FOCUS-LOOP-FOLLOWUP

**Status:** CODE_CLOSED + LOCAL GATES PASS + CI #1015 âœ… + CONTRACT #589 âœ… + ANNOTATIONS à¸§à¹ˆà¸²à¸‡ + PUSHED

**à¸•à¹‰à¸™à¸•à¸­:** `src/__tests__/r15DeliveryLiveRefresh.test.ts:45` â€” source-contract test `"?focus= = refetch à¹€à¸ªà¸¡à¸­ + scrollIntoView"` à¸¢à¸¶à¸”à¸žà¸¤à¸•à¸´à¸à¸£à¸£à¸¡à¹€à¸à¹ˆà¸²à¸—à¸µà¹ˆ Owner à¸ªà¸±à¹ˆà¸‡à¸¥à¸š (à¸£à¸­à¸š 61) â†’ `AssertionError` â†’ Unit tests step à¸¥à¹‰à¸¡

**à¸šà¸—à¹€à¸£à¸µà¸¢à¸™ (à¸œà¸´à¸”à¸à¸Ž evidence-based):** à¸£à¸­à¸š 61 à¸£à¸²à¸¢à¸‡à¸²à¸™ "vitest PASS" à¹‚à¸”à¸¢à¸—à¸µà¹ˆ run à¹‚à¸”à¸™ shell timeout à¸•à¸±à¸”à¸—à¸µà¹ˆ 120 à¸§à¸´à¸à¹ˆà¸­à¸™à¸ˆà¸š â€” à¹„à¸¡à¹ˆà¹€à¸„à¸¢à¹€à¸«à¹‡à¸™ summary à¸ˆà¸£à¸´à¸‡ â†’ à¸•à¹‰à¸­à¸‡à¸£à¸±à¸™à¹€à¸•à¹‡à¸¡à¸£à¸­à¸š (185.19s) + à¸­à¹ˆà¸²à¸™ `Test Files 226 passed / Tests 2445 passed` à¸à¹ˆà¸­à¸™à¸­à¹‰à¸²à¸‡ PASS à¹€à¸ªà¸¡à¸­

**Fix:**
- Test contract à¹ƒà¸«à¸¡à¹ˆ (`r15DeliveryLiveRefresh.test.ts:43-52`): `?focus=` = à¹„à¸®à¹„à¸¥à¸•à¹Œà¸­à¸¢à¹ˆà¸²à¸‡à¹€à¸”à¸µà¸¢à¸§ â€” à¸¢à¸·à¸™à¸¢à¸±à¸™ `data-focus-row >= 2` + ring (à¸„à¸´à¸§ dispatch) + bg tint (à¸•à¸²à¸£à¸²à¸‡ en-route) à¸„à¸£à¸š + **regression guard**: `not.toContain('scrollIntoView')` + `not.toContain('scrolledFocusRef')`
- `ci.yml`: `actions/checkout@v4â†’v5` + `actions/setup-node@v4â†’v5` (node-version 24 à¸„à¸‡à¹€à¸”à¸´à¸¡) â€” à¹à¸à¹‰ warning

**Gates:** TSC âœ… Â· Lint âœ… Â· Unit Tests âœ… 226 files / 2445 tests passed Â· Build âœ… Â· CI #1015 âœ… Â· Contract #589 âœ… Â· Annotations à¸§à¹ˆà¸²à¸‡

---

## R61 â€” 2026-11-22 â€” BMB-RIDER-NOTIF-FIX Phase 1â†’2â†’3

**Status:** CODE_CLOSED + BUILD+LINT+TSC+VITEST ALL PASS + PUSHED

**Phase 1 â€” Rider Complete Fix:**
- Error Boundary + Structured Logging (`DeliveryErrorBoundary` à¸„à¸£à¸­à¸š `PodDeliveryPanel`)
- `toBlob` à¹à¸—à¸™ `toDataURL` (canvas memory ~20MB â†’ ~1MB)
- `activeOrder` Sync à¹ƒà¸™ `refresh()` (server à¹„à¸¡à¹ˆà¸¡à¸µ order à¸™à¸±à¹‰à¸™ = `setActiveOrder(null)`)
- Hardened finally block (à¸šà¸±à¸‡à¸„à¸±à¸š `setDeliverBusy(false)`, `setDeliverStep(null)`, `setActiveOrder(null)` à¸—à¸¸à¸à¸à¸£à¸“à¸µ)
- Retry button (à¹‚à¸Šà¸§à¹Œà¹€à¸¡à¸·à¹ˆà¸­ `kind !== 'state'` à¹ƒà¸Šà¹‰ `lastPhotoRef`)

**Phase 2 â€” Toast Layout Fix:**
- Fixed positioning + responsive max-width + safe-area inset
- SW notification options: vibrate + requireInteraction

**Phase 3 â€” 3-User Experience Hardening:**
- Riderâ†’Customer Sync: `OrderTrackPage` polling 20s â†’ **5s** à¹€à¸¡à¸·à¹ˆà¸­ rider visible + POD photo + timestamp
- Admin Visibility: `adminAdvanceDelivery` + History/Audit panel
- Mobile/PWA Compliance: iOS PWA meta + global min 48Ã—48px touch targets + manifest display: 'standalone'

**Gates:** TSC âœ… Â· Lint âœ… Â· Build âœ… Â· Unit Tests âœ… 226 files / 2445 tests PASS

---

## R60 â€” 2026-11-22 â€” BMB-ADMIN-FOCUS-LOOP (Remove auto-scroll + refetch loop)

**Status:** CODE_CLOSED + BUILD+LINT+TSC+VITEST ALL PASS + PUSHED

**Root Cause:** `DeliveryManagement.tsx:154-168` â€” `useEffect` deps `[focusOrder, load, orders]` â†’ à¸—à¸¸à¸à¸„à¸£à¸±à¹‰à¸‡ `load()` à¹€à¸ªà¸£à¹‡à¸ˆ â†’ `setOrders(new array)` â†’ effect à¸£à¸±à¸™à¹ƒà¸«à¸¡à¹ˆ â†’ `void load(true)` â†’ **à¸§à¸™à¸¥à¸¹à¸›à¹‚à¸«à¸¥à¸” + scrollIntoView à¹„à¸¡à¹ˆà¸£à¸¹à¹‰à¸ˆà¸š**

**Fix:** à¸¥à¸š effect scroll à¸—à¸´à¹‰à¸‡à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” (à¸šà¸£à¸£à¸—à¸±à¸” 154-168) à¸£à¸§à¸¡ `scrolledFocusRef` Â· à¹€à¸à¹‡à¸š visual ring highlight à¹„à¸§à¹‰à¸—à¸µà¹ˆà¸šà¸£à¸£à¸—à¸±à¸” 534/674

---

## R55 â€” 2026-11-20 â€” Background Music + Mascot Badge Fix + OAuth/Passkey ALL CONFIGURED

**Status:** CODE_CLOSED + PUSHED Â· vitest 226 files / 2422 tests PASS (+42)

**Background Music (file-based engine):**
- `lib/backgroundMusic.ts` à¹ƒà¸«à¸¡à¹ˆ â€” validate/compress/upload/delete/list + shuffle queue
- `lib/ambientMusic.ts` rewrite â€” HTMLAudioElement engine (`createAudioFileEngine`) + shuffle queue + ducking 25% + volume persist
- `pages/admin/BackgroundMusicSettingsPage.tsx` à¹ƒà¸«à¸¡à¹ˆ â€” Admin UI: bucket list + preview + file upload + URL import + enable toggle + delete/copy URL
- `components/admin/AdminHubs.tsx` â€” à¹€à¸žà¸´à¹ˆà¸¡ tab `music` à¹ƒà¸™ SettingsHub
- `supabase/migrations/103_background_music_bucket_policies.sql` â€” RLS: public read + admin write + idempotent bucket create

**Mascot Badge Fix (F-1):** `index.css` `.section-float-mascot` à¸¥à¸š `border-radius: 50%` + à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™ `floatLogo` â†’ `float` (translateY only) Â· 7 à¸ˆà¸¸à¸” overflow fix

**OAuth/Passkey â€” à¸—à¸±à¹‰à¸‡ 4 à¸Šà¹ˆà¸­à¸‡à¸—à¸²à¸‡à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸ˆà¸£à¸´à¸‡ (Owner à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸² Dashboard à¹€à¸ªà¸£à¹‡à¸ˆà¹à¸¥à¹‰à¸§):**
- Google (built-in), Facebook (built-in), LINE (Custom OIDC), Passkey (built-in)

**Gates:** Lint âœ… (591 à¹„à¸Ÿà¸¥à¹Œ + brandNameGuard + languageSanity) Â· vitest 226 files / 2422 tests PASS (+42) Â· Build âœ…

---

## R54 â€” 2026-11-20 â€” à¸¡à¸²à¸ªà¸„à¸­à¸•à¸¥à¸­à¸¢à¸ˆà¸£à¸´à¸‡ + logout à¸ˆà¸£à¸´à¸‡ + à¹‚à¸«à¸§à¸• UX + login à¹€à¸šà¸­à¸£à¹Œà¹‚à¸—à¸£

**Status:** CODE_CLOSED + PUSHED Â· vitest 224 files / 2391 tests PASS (+3)

**à¸¡à¸²à¸ªà¸„à¸­à¸•à¸¥à¸­à¸¢/à¸«à¸¥à¸¸à¸”à¹€à¸Ÿà¸£à¸¡:** `.animate-float` à¹€à¸›à¹‡à¸™ **dead class** â†’ à¹à¸à¹‰ 3 à¸Šà¸±à¹‰à¸™: â‘ à¸™à¸´à¸¢à¸²à¸¡ `.animate-float` bind `@keyframes float` â‘¡à¸¥à¸­à¸¢à¸¢à¹‰à¸²à¸¢à¸¡à¸²à¸—à¸µà¹ˆ div à¹€à¸™à¸·à¹‰à¸­à¸«à¸²à¹ƒà¸™ BiteMascot â‘¢wrapper à¸–à¸­à¸” animate-float

**Logout à¸ˆà¸£à¸´à¸‡:** `await logout()` à¸ˆà¸£à¸´à¸‡ + `finally` à¸žà¸²à¹„à¸› `/login` à¹€à¸ªà¸¡à¸­

**à¸£à¸°à¸šà¸šà¹‚à¸«à¸§à¸• "à¸‚à¸±à¸”à¸‚à¹‰à¸­à¸‡":** `preorder_vote_cast` (anon) = **HTTP 401 body à¸§à¹ˆà¸²à¸‡** = **m208 à¸•à¸´à¸” prod à¸„à¸£à¸š REVOKE anon** â†’ à¸ªà¸²à¹€à¸«à¸•à¸¸à¸ˆà¸£à¸´à¸‡ = à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰**à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸¥à¹‡à¸­à¸à¸­à¸´à¸™** â†’ **Fix:** `castPreorderVote` à¹€à¸Šà¹‡à¸„ session à¸à¹ˆà¸­à¸™à¸¢à¸´à¸‡ RPC + map 401 â†’ signed_out

**Login à¹€à¸šà¸­à¸£à¹Œà¹‚à¸—à¸£:** à¹€à¸›à¸´à¸”à¸‚à¸­à¸‡à¹€à¸à¹ˆà¸² `authStore.loginByPhone(phone, password)` (synthetic email `<phone>@phone.bmb.local`) à¹ƒà¸«à¹‰à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸ˆà¸£à¸´à¸‡

**Gates:** Lint âœ… Â· vitest 224 files / 2391 tests PASS (+3) Â· Build âœ…

---

## R53 â€” 2026-11-18 â€” OWNER VERIFIED âœ“ (Vote + Random Menu + Promotions Real Data)

**Status:** CODE_CLOSED Â· m208 APPLIED PROD âœ“ Â· vitest 2388/2388 Â· Docker contract replay ALL_GREEN Â· CI 2/2 success

**à¸«à¸™à¹‰à¸²à¹‚à¸«à¸§à¸•:** à¸¥à¸š hardcode à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” + à¹‚à¸«à¸§à¸•à¸ˆà¸£à¸´à¸‡à¸œà¹ˆà¸²à¸™ server RPC `preorder_vote_cast` (m208) + à¸œà¸¥à¹‚à¸«à¸§à¸•à¸ˆà¸²à¸à¸•à¸²à¸£à¸²à¸‡ `preorder_votes` + à¹€à¸žà¸”à¸²à¸™/à¸ªà¸–à¸²à¸™à¸°à¸ˆà¸²à¸ `vote_policy` (business_settings) + à¹à¸–à¸š "à¹‚à¸›à¸£à¹‚à¸¡à¸Šà¸±à¹ˆà¸™à¸—à¸µà¹ˆà¸à¸³à¸¥à¸±à¸‡à¸£à¸±à¸™" à¸ˆà¸£à¸´à¸‡à¸ˆà¸²à¸à¹à¸­à¸”à¸¡à¸´à¸™

**à¸«à¸™à¹‰à¸²à¸ªà¸¸à¹ˆà¸¡à¹€à¸¡à¸™à¸¹:** à¸ªà¸¸à¹ˆà¸¡à¸ˆà¸²à¸ `getProducts()` à¸ˆà¸£à¸´à¸‡ (!archived && is_available) Â· à¸£à¸¹à¸›/à¸£à¸²à¸„à¸²à¸ˆà¸£à¸´à¸‡ Â· à¸›à¸¸à¹ˆà¸¡à¹„à¸›à¸ªà¸±à¹ˆà¸‡ = `/menu?category=<id>` Â· à¹à¸ªà¸”à¸‡à¹‚à¸›à¸£à¹‚à¸¡à¸Šà¸±à¸™à¸ˆà¸£à¸´à¸‡à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¸à¸±à¸šà¹€à¸¡à¸™à¸¹à¸™à¸±à¹‰à¸™à¹„à¸”à¹‰

**à¸«à¸™à¹‰à¸²à¹‚à¸›à¸£à¹‚à¸¡à¸Šà¸±à¸™:** à¹à¸ªà¸”à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡à¸„à¸£à¸šà¸•à¸²à¸¡à¹à¸­à¸”à¸¡à¸´à¸™à¸•à¸±à¹‰à¸‡ â€” à¸ à¸²à¸žà¹à¸šà¸™à¹€à¸™à¸­à¸£à¹Œ Â· à¹€à¸¡à¸™à¸¹à¸£à¹ˆà¸§à¸¡à¸£à¸²à¸¢à¸à¸²à¸£ Â· à¹€à¸žà¸”à¸²à¸™ max_discount_amount Â· à¸ªà¸´à¸—à¸˜à¸´à¹Œà¸„à¸‡à¹€à¸«à¸¥à¸·à¸­ Â· stackable

**m208 (APPLIED PROD âœ“):** `preorder_vote_status()` (anon) Â· `preorder_vote_cast` (authenticated Â· advisory lock Â· ALREADY à¸à¹ˆà¸­à¸™ LIMIT Â· !archived Â· Asia/Bangkok day Â· audit à¸—à¸¸à¸à¸„à¸£à¸±à¹‰à¸‡ Â· **à¹„à¸¡à¹ˆà¹à¸•à¸° points_ledger**) Â· seed `vote_policy {"enabled":true,"daily_limit":1}` Â· unique index identity + dedup

---

## R52 â€” 2026-11-17 â€” MASCOT BADGE + RIDER HISTORY TABS + MAP 3 SIDES

**Status:** CODE_CLOSED Â· m180 + m207 APPLIED PROD âœ“ Â· vitest 2379/2379

**Mascot Badge:** `BiteMascot.tsx` draggable badge à¸¡à¸¸à¸¡à¸‚à¸§à¸²à¸¥à¹ˆà¸²à¸‡ + localStorage persist position Â· z-index 50 Â· tidak conflict with floating ad

**Rider History Tabs:** à¹à¸—à¹‡à¸š "à¸§à¸±à¸™à¸™à¸µà¹‰" / à¹€à¸”à¸·à¸­à¸™ / "à¸§à¸±à¸™à¸ªà¹ˆà¸‡/à¸§à¸±à¸™à¸¡à¸­à¸šà¸«à¸¡à¸²à¸¢" à¹ƒà¸™ `/rider` Â· `my_deliveries` v2 (m207) Â· scheduled jobs à¹à¸¢à¸à¹„à¸”à¹‰

**Map 3 Sides:** `/rider` (OSM) + `/track/:orderNumber` (OSM + rider marker + stale handling) + `/admin/delivery` (OSM + real rider markers + polyline) â€” Google Maps key à¸–à¸¹à¸à¸›à¸à¸´à¹€à¸ªà¸˜ â†’ à¹ƒà¸Šà¹‰ Leaflet/OSM fallback à¸‹à¸¶à¹ˆà¸‡à¸–à¸·à¸­à¸§à¹ˆà¸² PASS à¸•à¸²à¸¡à¸”à¸µà¹„à¸‹à¸™à¹Œ

---

## R51 â€” 2026-11-16 â€” OMNI-CHANNEL PHASE 3â€“5 (Social AI Worker + Meta/LINE)

**Status:** CODE_CLOSED Â· EF `social-ai-worker` DEPLOYED (exit=0) Â· vitest 2368/2368

**Omnichannel Social (Meta/LINE) à¸‚à¸±à¹‰à¸™ 3â€“5:**
- `social-ai-worker` EF: AI à¸ªà¸£à¸¸à¸›à¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¸ˆà¸²à¸ comment/message â†’ `cartFooterForMatch` + `buildCartSummaryFooter` Â· `?cart=` deep-link
- `channel-webhook`: receive Meta/LINE events â†’ `resolveKitchenPoint` Â· `socialOrderIntake` contracts
- `socialOrderIntake.ts` shared lib: `cartFooterForMatch` (AI reply scope) Â· `buildCartSummaryFooter` (full cart disclosure)

**Gates:** vitest 2368/2368 PASS Â· tsc 0 Â· lint OK Â· build OK Â· EF deploy exit=0 Â· smoke http=200 boot_ok=true

---

## Earlier R-series (R1â€“R50)

R1â€“R50 à¸„à¸£à¸­à¸šà¸„à¸¥à¸¸à¸¡: à¹‚à¸„à¸£à¸‡à¸ªà¸£à¹‰à¸²à¸‡à¹‚à¸›à¸£à¹€à¸ˆà¸à¸•à¹Œ, Database schema + RLS, Authentication (OAuth/Passkey), Product Catalog, Cart + Checkout (same-day/pre-order), Payment (Omise/Stripe/QR/COD), Admin Dashboard (26 à¸«à¸™à¹‰à¸²), Delivery zones + routing, Rider PWA, AI Waiter (Talk to Bite + Voice), Food Theater, CRM Automation, Background Music (synthâ†’file-based), Sticker printing, PWA, CI/CD, Contract testing, v1.0.0 release preparation.

à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸” R1â€“R50 à¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡à¹„à¸”à¹‰à¸ˆà¸²à¸ `AI_WORK_STATE.md` ledger entries à¸à¹ˆà¸­à¸™ R51 à¹à¸¥à¸° `docs/BMB_MASTER_STATUS.md` entries à¸à¹ˆà¸­à¸™ R51

---

## Migration Ledger Summary (001â€“213)

| Range | Description | Applied Prod |
|-------|-------------|--------------|
| 001â€“100 | Core schema: branches, products, orders, cart, customers, auth, delivery, payments | âœ… |
| 101â€“150 | RLS hardening, admin features, rider ops, AI context, CRM | âœ… |
| 151â€“190 | Delivery sync, queue automation, social omnichannel, background music bucket (m103â†’m196) | âœ… |
| 191â€“200 | Vote system (m192/193 CRM), BKK date guards (m190â€“193), floating ad (m209) | âœ… |
| 201â€“213 | m208 vote_cast, m209 is_floating_ad, m210/211 rider my_deliveries, **m212 delivery preparing hop**, **m213 cart_sessions payload + select_own** | âœ… (all) |

**Verified:** `supabase_migrations.schema_migrations` has all 213 entries Â· prod history 208 from 213 repo files (ledger backfill R80) Â· rule 16.3 enforced (probe marker â†’ apply â†’ record)

---

## Edge Functions Deployed (24)

1. `ai-proxy` â€” SSE AI streaming
2. `omise-create-checkout` â€” Omise server-side charge
3. `omise-webhook` â€” Omise idempotent webhook
4. `stripe-create-checkout` â€” Stripe fallback
5. `stripe-webhook` â€” Stripe webhook
6. `create-checkout` â€” Unified checkout orchestrator
7. `queue-dispatch` â€” Order dispatch queue
8. `queue-retry` â€” Failed dispatch retry
9. `queue-scheduler` â€” Scheduled queue jobs
10. `sms-send` â€” SMS notifications
11. `push-send` â€” Push notifications
12. `voice-tts` â€” AI voice TTS
13. `channel-webhook` â€” Meta/LINE webhook receiver
14. `social-ai-worker` â€” AI order summary from social (R104 deployed 2026-11-24)
15. `social-order-intake` â€” Shared lib for social cart footer
16. `automation-winback` â€” CRM winback (m192)
17. `automation-birthday` â€” CRM birthday (m193)
18. `resolve-kitchen-point` â€” Kitchen location resolver
19. `rider-location-update` â€” Rider GPS updates
20. `delivery-status-sync` â€” Delivery status canonical RPCs
21. `cart-session-sync` â€” Server-side cart sync (R103)
22. `background-music-upload` â€” Music file upload
23. `background-music-list` â€” Music bucket list
24. `floating-ad-config` â€” Floating ad configuration

---

## Test Suite Evolution

| Milestone | Files | Tests | Notes |
|-----------|-------|-------|-------|
| R51 | 218 | 2368 | Omnichannel phase 3â€“5 |
| R52 | 220 | 2379 | Mascot + Rider tabs + Maps |
| R53 | 222 | 2388 | Vote + Random Menu real data |
| R54 | 224 | 2391 | Mascot float + Logout + Vote UX + Phone login |
| R55 | 226 | 2422 | Background Music + Mascot fix + OAuth |
| R60 | 226 | 2445 | Admin focus loop removed |
| R61 | 226 | 2445 | Rider notif fix |
| R62 | 226 | 2445 | CI fix + test contract |
| R63 | 226 | 2446 | FB Cart Bridge (+1) |
| R63b | 226 | 2447 | Hotfix (+1) |
| R63c | 226 | 2447 | Cart UX + Closed rounds |
| R63d | 226 | 2447 | Sticker consolidation |
| R64 | 226 | 2447 | Delivery sync (m212) |
| R102 | 228 | 2486 | FB IAB double-add guard |
| R103 | 229 | 2501 | Server-side cart sync (m213) |
| R104 | 230 | 2516 | 1 reply = 1 link |
| R105 | 230 | 2516 | Background music state sync |
| **R105b** | **230** | **2521** | **RLS hotfix (current)** |
| R105c | 230 | 2521 | README rewrite (docs only) |

**Current (2026-11-24 R105c):** 230 files / 2,521 tests Â· All gates pass Â· 24 EF deployed Â· 213 migrations applied prod
