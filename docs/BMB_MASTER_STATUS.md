# BMB — MASTER STATUS (เอกสารสถานะหลักเดียวของโปรเจกต์)

> **เอกสารนี้คือ canonical current state ไฟล์เดียว** ตาม Owner directive 2026-10-26
> (WHOLE-REPO RECONCILIATION · CODE CLOSURE · LEAN PRODUCTION ACCEPTANCE)
> ไฟล์อื่นที่มีวันที่ในชื่อ = **รายงาน ณ วันนั้น** ห้ามใช้แทนไฟล์นี้ ถ้าขัดกันให้ถือโค้ด/หลักฐาน (DOC DRIFT)


**SESSION 2026-11-26 (PRODUCTION BACKUP GATE PASSED + MIGRATION 219–228+233 APPLIED — ledger repaired; 001–233 all applied)**
- **Existing backup (Management API, read-only):** `pitr_enabled=false`, `backups=[]`, `physical_backup_data={}` → **no restorable backup existed** before this session. On-demand API backup = 404 (not supported).
- **Backup created:** `supabase db dump --linked` (login role, no DB password) → `D:\A PROJECT\backups\backup_pre233_2026-11-26.sql` (708,421 B · SHA-256 `36209070…FF736` · 75 tables + data · pre-219 state confirmed).
- **Restore test (Docker postgres:16, non-prod):** 77 public tables restored; key tables present; only environmental errors (auth schema / PG17 `maintain` / supabase_realtime). Public schema clean.
- **APPLIED (Owner push) + ledger repaired:** fresh dump confirmed schema of 219–228+233 present; ledger was blank (drift) → `supabase migration repair --status applied 219 220 221 222 223 224 225 226 227 228 233` → `migration list` now **001–233 all applied, no gaps/dups**. PITR still DISABLED (Owner decision).
- **Remaining:** live OCR/PO/GRN + regression = LIVE_TEST_PENDING (Owner). Evidence: `docs/BACKUP_GATE_RECORD_2026-11-26.md`, `docs/PROD_DEPLOYMENT_RECORD_2026-11-26.md`.

**SESSION CLOSE 2026-11-26 r14 (PHASE 2 WP9+WP10 — FULL REGRESSION ALL GREEN + READINESS/HANDOFF — PUSHED)**

- **WP9 Full regression:** Docker replay 001→228 `migrations=232 OK / 0 FAIL` + Phase 1 (124-213, 214-218) + Phase 2 (219-223, 224, 225, 226, 227/228) contracts ALL GREEN · vitest 256/3,014 · lint 0 · tsc 0 · build PASS
- **WP10 Readiness:** `docs/PHASE2_READINESS_WP10.md` (scope, evidence, security, remediations, limitations, next) · WORKING_STATE handoff r14
- **Phase 2 (WP2-WP9) COMPLETE + PUSHED** · Production NOT deployed (ledger 218) — Owner approval required
- **Next:** Owner review → staging deploy 219-228 → run E2E (WP3/WP5) → production approval

**SESSION CLOSE 2026-11-26 r13 (PHASE 2 WP7+WP8 — PRICE HISTORY + PO DASHBOARD READ APIs 227/228 + DASHBOARD UI — CODE_CLOSED + PUSHED)**

- **Phase 2 WP7 (Price History Read) + WP8 (PO Dashboard Read + Hub integration):** ✅ **CODE_CLOSED + PUSHED** (R116)
  - **227_price_history_read_api.sql:** get_purchase_price_history (SECURITY INVOKER — RLS m223 enforced; filters + pagination)
  - **228_po_dashboard_read_api.sql:** get_po_dashboard (SECURITY INVOKER aggregates; RLS branch-scoped). REMEDIATION: wrapped jsonb_agg subqueries (staged nested-aggregate/GROUP BY bug)
  - **API + UI:** `src/lib/bmbAdminApi_purchaseAnalytics.ts` + types; `src/pages/admin/PurchaseDashboardPage.tsx` (KPI + action lists, real RPC) as first PurchaseHub tab
  - **DB integration:** `e2e/contracts_wp7_wp8_227_228.sql` — **6 cases ALL PASS** (INVOKER + RLS branch isolation price history + dashboard, admin cross-branch, filters) · static 5 + API 3
  - **Gates:** Docker replay 001→228 `migrations=232 OK / 0 FAIL` + all contracts ALL GREEN · vitest 3,014 · lint 0 · tsc 0 · build PASS
  - **Production:** NOT touched (ledger 218)
- **Next:** WP9 (Full regression / security / performance)

**SESSION CLOSE 2026-11-26 r12 (PHASE 2 WP6 — WAVG POSTING + REVERSAL 226 + DB INTEGRATION TESTS — CODE_CLOSED + PUSHED)**

- **Phase 2 WP6 (Inventory Integration):** ✅ **CODE_CLOSED + PUSHED** (R115)
  - **Migration 226_wavg_posting_reversal.sql (TEST DB only):** calculate_grn_line_landed_cost + compute_grn_payload_hash + post_goods_receipt_line + post_goods_receipt + reverse_grn — FOR UPDATE lock order, WAVG from accepted_qty + landed cost, idempotency (key+hash/conflict/already-posted), line double-post guard, reversal positive-mirror + reversal_of (unique once) + itx type=out + correction, PO received/status transitions, audit
  - **WP6 REMEDIATION:** removed non-existent has_staff_branch_scope; Asia/Bangkok date (m190)
  - **DB integration:** `e2e/contracts_wp6_226.sql` — **9 cases ALL PASS** (post+WAVG stock24/wavg11, idempotent retry, hash conflict, already posted, role gate, reversal stock0/out/correction, double-reversal reject, line double-post) · static 10 tests
  - **Gates:** Docker replay 001→226 `migrations=230 OK / 0 FAIL` + phase1+phase2+wp2+wp4+wp6 contracts ALL GREEN · vitest 256 files/3,006 · lint 0 · tsc 0 · build PASS
  - **Production:** NOT touched (ledger 218)
- **Next:** WP7 (Price History read API — promote staged wp7)

**SESSION CLOSE 2026-11-26 r11 (PHASE 2 WP5 — GOODS RECEIVING UI + E2E SPEC — CODE_CLOSED + PUSHED)**

- **Phase 2 WP5 (GRN UI):** ✅ **CODE_CLOSED + PUSHED** (R114)
  - `src/pages/admin/GoodsReceivingPage.tsx` — select receivable PO → enter actual qty → auto good/rejected split → save draft → approve (inventory/admin) + detail modal; real WP4 API (225); responsive; no mock
  - `src/components/admin/AdminHubs.tsx` — new "รับสินค้า (Goods Receiving)" tab in PurchaseHub
  - `src/__tests__/goodsReceiptsApi.test.ts` — 3 API-wiring tests PASS
  - `e2e/goodsReceiving.spec.ts` — Playwright E2E create→approve — **LIVE_TEST_PENDING** (staging + DB 225 + inventory/admin auth)
  - Gates: tsc 0 · lint 0 · vitest 255 files/2,996 · build PASS · production untouched
- **Next:** WP6 (WAVG posting/reversal + idempotency — promote staged wp6)

**SESSION CLOSE 2026-11-26 r10 (PHASE 2 WP4 — GRN WORKFLOW RPC 225 + API + DB INTEGRATION TESTS — CODE_CLOSED + PUSHED)**

- **Phase 2 WP4 (GRN Backend):** ✅ **CODE_CLOSED + PUSHED** (R113)
  - **Migration 225_grn_workflow_rpcs.sql (TEST DB only):** generate_grn_number (grn_number_seq + BKK) + create_grn_draft (partial/multi-receipt, over-receive guard via cumulative committed qty, accepted/rejected balance, conversion/price/lot snapshot, inherited org) + approve_grn (inventory/admin + draft gate) + audit; SECURITY DEFINER role + has_org_row_scope gates
  - **WP4 REMEDIATION:** removed non-existent has_staff_branch_scope; Asia/Bangkok date (m190); create gate = is_staff OR is_inventory (receiver = inventory)
  - **API:** `src/lib/bmbAdminApi_goodsReceipts.ts` + types GoodsReceipt/Line/Form + GRNStatus
  - **DB integration:** `e2e/contracts_wp4_225.sql` — **8 cases ALL PASS** · static 8 tests
  - **Gates:** Docker replay 001→225 `migrations=229 OK / 0 FAIL` + phase1+phase2+wp2+wp4 contracts ALL GREEN · vitest 254 files/2,993 · lint 0 · tsc 0 · build PASS
  - **Production:** NOT touched (ledger 218)
- **Next:** WP5 (GRN UI / E2E) — Goods Receiving tab in PurchaseHub

**SESSION CLOSE 2026-11-26 r9 (PHASE 2 WP3 — PO UI in PurchaseHub + E2E SPEC — CODE_CLOSED + PUSHED)**

- **Phase 2 WP3 (PO UI):** ✅ **CODE_CLOSED + PUSHED** (R112)
  - `src/pages/admin/PurchaseOrderPage.tsx` — PO list + create/edit (draft/submitted) + submit + approve (finance/admin) + detail modal; real WP2 API (migration 224) via supabase.rpc; responsive; no mock
  - `src/components/admin/AdminHubs.tsx` — new "ใบสั่งซื้อ (Purchase Order)" tab in existing PurchaseHub (no duplicate hub)
  - `src/__tests__/purchaseOrdersApi.test.ts` — 5 API-wiring tests PASS
  - `e2e/purchaseOrder.spec.ts` — Playwright E2E create→submit→approve — **LIVE_TEST_PENDING** (needs staging server + DB 219-224 + admin auth)
  - Gates: tsc 0 · lint 0 · vitest 253 files/2,985 · build PASS · production untouched
- **Next:** WP4 (GRN DB/RPC/API — promote staged wp4)

**SESSION CLOSE 2026-11-26 r8 (PHASE 2 WP2 — PO WORKFLOW RPC 224 + API + DB INTEGRATION TESTS — CODE_CLOSED + PUSHED)**

- **Phase 2 WP2 (PO Backend):** ✅ **CODE_CLOSED + PUSHED** (R111) — Master Directive 2026-11-26 continuous execution
  - **Migration 224_purchase_order_rpcs.sql (TEST DB only — production ledger still 218):** generate_po_number (po_number_seq + Asia/Bangkok) + create/update/submit/approve_purchase_order — SECURITY DEFINER role + has_org_row_scope gates, optimistic lock (version), status gates, validation, audit (append_audit_log), grants
  - **WP2 REMEDIATION:** removed non-existent `has_staff_branch_scope()` (staged runtime defect; redundant with has_org_row_scope) + Asia/Bangkok date (no CURRENT_DATE per m190 gate)
  - **API:** `src/lib/bmbAdminApi_purchaseOrders.ts` (real supabase.rpc) + types PurchaseOrderHeader/Line/Form + POStatus
  - **DB integration:** `e2e/contracts_wp2_224.sql` — **10 cases ALL PASS** (number-gen, validation, optimistic lock, duplicate submit, invalid transition, role gate, branch scope, audit)
  - **Static:** `src/__tests__/contracts_224_po_rpcs.test.ts` — 17 tests PASS
  - **Gates (all green):** Docker replay 001→224 `migrations=228 OK / 0 FAIL` + phase1 + phase2(219-223) + wp2(224) contracts ALL GREEN · vitest 252 files/2,980 tests · lint 0 · tsc 0 · build PASS
  - **Production:** NOT touched (ledger 218) · 219-223 unchanged
- **Next:** WP3 (PurchaseHub PO UI / E2E) — extend existing PurchaseHub (AdminHubs.tsx), real API, no mock

**SESSION CLOSE 2026-11-26 r7 (PHASE 2 WP1 ACCEPTED BY OWNER + COMMIT/PUSH — ALL GREEN)**

- **Phase 2 WP1 (Schema / Migrations / Contract Tests):** ✅ **ACCEPTED by Owner 2026-11-26** after Remediation + Final Reconciliation
  - **Migrations 219-223 (schema-only, remediated):** 219 purchase_orders(+po_number_seq) · 220 goods_receipts(+idempotency key/hash + reversal linkage, −price_variance generated col) · 221 purchase_price_history(append-only, −package_size, +tenant/branch) · 222 itx ext(+COMMENT) · 223 RLS org/branch isolation (has_org_row_scope, 17 policies) — **NOT applied to Production** (production ledger still 218)
  - **Workflow RPCs re-scoped to staged reference (NOT applied):** `supabase/staged_workflows/` wp2 (PO), wp4 (GRN), wp6 (WAVG posting+reversal — DEFECT-2/3/4/5 fixed design), wp7/wp8 (read APIs, SECURITY INVOKER)
  - **DEFECT-1..5 all fixed + proven on real Postgres:** Docker replay fresh DB `OK=227 FAIL=0` (ledger 223 versions; 227 = files incl. 4 legacy duplicate-version pairs 180/183/203/204 untouched) + Phase 1 contracts + regression 124-213 ALL GREEN
  - **New integration contracts:** `e2e/contracts_phase2_219_223.sql` — **33 test IDs ALL PASS** (count corrected from wrong "36"; Final Reconciliation 2026-11-26)
  - **Static contracts:** 6 new Vitest files, 132 tests PASS (full suite 251 files / 2,963 tests) · lint + tsc 0
  - **RLS proof:** 5-account cross-branch matrix (read/write denial both directions, admin/owner per m088 model, platform bypass) — ALL PASS
  - **Evidence:** `e2e/w2-replay-full-2026-11-25.log(+jsonl,+p1,+p2)` (run 2026-11-26) · `docs/PHASE2_DESIGN_REPORT.md` §15
- **Next (BLOCKED — ต้องได้ Owner อนุมัติแยก):** WP2 (PO workflow RPC จาก staged) → WP4 → WP6 → WP7 → WP8 ตามแผน §15 ของ design report

**SESSION CLOSE 2026-11-25 r4 (LIVE TEST RESULTS + OWNER DECISIONS — E/F LIVE_VERIFIED, G/H PARTIAL, C-1..C-6 RESOLVED, OMISE RESOLVED)**

- **Live Test Groups Results:**
  - **Group E (Rider History + Maps):** ✅ **LIVE_VERIFIED** — E-1..E-6 PASS (7 tests), OSM fallback verified. E-7 diagnostic only.
  - **Group F (Background Music + Mascot + OAuth):** ✅ **LIVE_VERIFIED** — F-1..F-4, F-7 PASS (5 tests). F-5, F-6 legacy verified.
  - **Group G (Marketing + Studio + Floating Ad):** ⏸️ **PARTIAL** — G-1..G-5 PASS (5 tests). G-6, G-7 pending.
  - **Group H (FB Cart Bridge):** ⏸️ **PARTIAL** — H-3..H-6 PASS (4 tests). H-1, H-2 pending.
  - **Group I (Server Cart + FB IAB + 1 Reply):** ⏸️ **PAUSED** — Critical path, awaiting Owner test.
- **Requirement Conflicts (C-1..C-6) — ALL RESOLVED by Owner 2026-11-25:**
  - C-1: Same-day = 24h ordering; Pre-order cutoff for delivery only
  - C-2: First-registered branch wins zone overlap
  - C-3: Coupon stacking approved — implement min-order/max-discount/per-user limits
  - C-4: Vote rewards points — update m208 to write points_ledger
  - C-5: CRM consent granularity — add winback/birthday/channel sub-fields
  - C-6: Floating ad vs Mascot — already fixed in layout
- **Omise TEST Card — RESOLVED:** Not a blocker. Stripe QR = primary, Omise = fallback.
- **Contract Coverage Complete (001-218):**
  - **124-213:** 15 Vitest files in `src/__tests__/contracts_*.test.ts` (311 tests)
  - **214-218 (Phase 1):** 1 SQL file `e2e/contracts_phase1_214_218.sql` (covers suppliers, inventory enrichment, supplier_products, recipes batch yield) — runs in CI
- **Next:** Owner audit review of 67 contract files → Complete Live Test Groups G-6, G-7, H-1, H-2, I-1..I-8 → Owner Gate Phase 1 → Phase 2.
- **Phase 1-6 all = paused per Owner order** (Phase 1 Gate Review pending).

**SESSION CLOSE 2026-11-25 r3 (CONTRACT-AUDIT-CLOSURE-124-213 COMPLETE — 15 FILES, 311 TESTS ALL GREEN)**

- **Contract Audit Closure COMPLETE:** 15 new contract test files for 28 remaining migrations (179, 181-189, 191-207, 211-213) written and all passing (311 tests). Combined with existing 52 contract files = 67 files ALL GREEN (0 FAIL) on fresh DB.
- **Test files created:** contracts_179_notification_hub.test.ts (24), contracts_181_186_promotions.test.ts (13), contracts_182_188_messages.test.ts (40), contracts_189_197_rider_fallback.test.ts (24), contracts_191_kitchen_bkk.test.ts (13), contracts_192_193_crm.test.ts (22), contracts_194_195_payment.test.ts (10), contracts_196_206_media_buckets.test.ts (13), contracts_198_200_reviews.test.ts (23), contracts_201_202_theater.test.ts (14), contracts_203_204_ai_memory.test.ts (29), contracts_205_social_actions.test.ts (16), contracts_207_211_rider_history.test.ts (21), contracts_212_delivery_sync_hop.test.ts (26), contracts_213_cart_payload.test.ts (6).
- **Full suite verified:** `npx vitest run src/__tests__/contracts_*.test.ts` — 15 test files, 311 tests PASS.
- **Next:** Owner audit review → Live Test Groups E, F, G, H, I (35 cases total) per `docs/PHASE1_PENDING_TEST_CLEARANCE_PLAN.md` L54-65. Sprint order: F+E week 3-4 → G+H week 5-6 → I week 7-8. WAIT for Owner Gate Phase 1 → Phase 2 after I-1/I-2 pass.
- **Phase 1-6 all = paused per Owner order** (Phase 1 Gate Review pending - DO NOT start Phase 2 on your own).

**SESSION CLOSE 2026-11-25 r2 (CI GREEN AGAIN + LINT FIX - HANDOFF TO NEXT SESSION: LIVE TEST GROUPS E-I)**

- **CI GREEN confirmed:** commit `1c2f749` (Edit doc BOM) - Lint OK (brandNameGuard + languageSanity 2,054 files clean), Unit tests 230 files/2,519 tests PASS, Typecheck tsc 0 error. Owner confirmed "เขียวหมด".
- **Lint root cause fixed:** (1) UTF-8 BOM on 4 docs files (BMB_*.* written by PowerShell Set-Content -Encoding UTF8 = always BOM in PS 5.1) - rewritten without BOM via Node fs; (2) foreign chars in Admin_User_Manual_TH.md 5 spots (Arabic (Arabic/Chinese/Hebrew/Chinese = การ์ด/ตามเวลา/ยกเลิก/คัดกรอง) - fixed to proper Thai.
- **RULE FOR NEXT SESSIONS: NEVER use PowerShell Set-Content/Out-File to write .md files (adds BOM + ANSI mojibake risk). Use Node fs.writeFileSync(..., "utf8") or the Write tool. languageSanity rejects BOM/foreign chars in ALL files.**
- **Contract suite 124-213 COMPLETE: 67 files ALL GREEN (0 FAIL)** (Docker bmb_replay_w2, migrations 001-218 applied). 15 new files for 28 migrations (179-213) + fixed 033 (anon SELECT allowlist + suppliers/supplier_products per m214/m217) + 036 (G4 accepts ERR_KITCHEN_NOT_READY).
- **NEXT SESSION TASK (Owner order via commit `9221626` "check audit closure start Live Test Groups p1 wait"): START LIVE TEST GROUPS E, F, G, H, I (35 cases total) - then WAIT for Owner Gate Phase 1 -> Phase 2.**
- Live Test Groups (from `docs/PHASE1_PENDING_TEST_CLEARANCE_PLAN.md` L54-65): **E** Rider History + Maps (7, AI+Owner) · **F** Background Music + Mascot + OAuth (7, Owner config) · **G** Marketing Posts + Studio + Floating Ad (7, Owner) · **H** FB Cart Bridge R63 (6, Owner) · **I** Server Cart + FB IAB + 1 Reply (8, Owner - CRITICAL PATH). Sprint order: F+E week 3-4 -> G+H week 5-6 -> I week 7-8.
- **Phase 1-6 all = paused per Owner order** (Phase 1 Gate Review pending - DO NOT start Phase 2 on your own).

**SESSION CLOSE 2026-11-25 (CONTRACT-AUDIT-CLOSURE-124-213 DONE - CONTRACT SUITE ALL GREEN 67 FILES)**

- **Result:** Contract suite **67 files ALL GREEN (0 FAIL)** in Docker container bmb_replay_w2 (DB bmb_replay / migrations 001-218 applied)
- **15 new contract files for 28 migrations (179-213) complete + fixed until every case passes:**
  - contracts_179_notification_hub.sql (8 cases) - contracts_181_186_promotions.sql (6) - contracts_182_188_messages.sql (6) - contracts_189_197_rider_fallback.sql (5) - contracts_191_kitchen_bkk.sql (4) - contracts_192_193_crm.sql (7) - contracts_194_195_payment.sql (5) - contracts_196_206_media_buckets.sql (6) - contracts_198_200_reviews.sql (8) - contracts_201_202_theater.sql (4) - contracts_203_204_ai_memory.sql (6) - contracts_205_social_actions.sql (5) - contracts_207_211_rider_history.sql (5) - contracts_212_delivery_sync_hop.sql (5) - contracts_213_cart_payload.sql (5)
- **Key fixes found during audit:** fixture orders missing customer_name/customer_phone (NOT NULL); branches missing code/slug/address/lat/lon; delivery_rounds missing display_name/delivery_end; invalid UUIDs (uid-cXXX -> 210aXXX-...); m131 trigger auto-creates customers id=user_id conflicting with fixture id; PL/pgSQL EXCEPTION written twice in one block (207.5); RAISE outside DO block (192.6/212.6); UPDATE ... ON CONFLICT invalid syntax (192.4); business_settings crm_automation needs upsert not bare UPDATE; cancel_order_as_customer RAISES EXCEPTION - catch with nested block + clear JWT claims before service_role calls; create_production_batch/get_kitchen_summary must omit params (passing NULL does not trigger DEFAULT); PRE_ORDER needs scheduled_date >= today + dropoff_detail (m038/m143b); 199.5 fixture conflicts idx_reviews_order_product -> use separate product/order ids
- **Old files fixed:** contracts_033_table_acl.sql allowlist + suppliers/supplier_products (m214/m217 grant anon SELECT by design); contracts_036_driver_status_sync.sql G4 accepts ERR_KITCHEN_NOT_READY as valid blocked-sync error
- **Phase 1-6 all = paused per Owner order** (Phase 1 Gate Review pending - DO NOT start Phase 2 on your own)

**🔒 SESSION PAUSED 2026-11-25 (HANDOFF — CONTRACT AUDIT กลางทาง) · Owner สั่งปิดเซสชัน + ยกงานไปเซสชันหน้า**

- **ทำเสร็จพิสูจน์แล้วในเซสชันนี้:**
  - **CI root cause** (g6g7 test อ้างเอกสารที่ถูกลบใน a592521) — แก้ที่ตัวเทส · 230 ไฟล์/2,519 tests PASS
  - **กฎใหม่ §17.5-17.7** ใน UNIVERSAL_MASTER_AI_RULES.md (ห้าม skip เทส · ห้าม shim หลอกเลี่ยง schema · ทุก migration ต้องมี Contract Test)
  - **contract-tests.yml** รัน migrations 001→latest ไม่มี skip + orphan steps (125/132/185/208)
  - **Contract suite 124-180 ALL GREEN** (Docker replay 3 รอบ · 222 migrations OK/0 FAIL · `e2e/w2-replay-full-2026-11-25.log`) — ไฟล์ใหม่ 7 ชุด + Phase 1 contracts 214-218
  - Commits: `a2528fc` → `47a8860` → `5b33cd3` → `0785f36` → `1dd2f84` (pushed)
- **งานที่ยกไปเซสชันหน้า (Active Task: CONTRACT-AUDIT-CLOSURE-124-213):**
  - เขียน Contract Test อีก **28 migration** (179, 181-189, 191-207, 211-213) = 15 ไฟล์ — รายการเต็ม + กฎที่พบ: `docs/PHASE1_PENDING_TEST_CLEARANCE_PLAN.md` + `BMB_AI_WORKING_STATE.md §1`
  - จบแล้ว → Owner ตรวจรับ audit closure → จึงเริ่ม Live Test Groups E, F, G, H, I (35 เคส)
- **Phase 1-6 ทั้งหมด = พักตามสั่ง Owner** (Phase 1 Gate Review รออยู่ · ห้ามเริ่ม Phase 2 เอง)

**🔒 SESSION CLOSE 2026-11-25 (PHASE 1 COMPLETE + CI ROOT CAUSE FIXED — Smart Ingredient & Cost Management Foundation) · **CODE_CLOSED + GATES PASS (tsc 0 · lint OK · vitest 230 ไฟล์/2519 tests · build OK) + CONTRACT REPLAY ALL_GREEN (222 migrations + Phase 1 contracts) + PUSHED**

- **CI Root Cause (พิสูจน์จากการรัน vitest ในเครื่อง — ไม่ใช่ migration 214-218):** commit `a592521` "Big clean doc" (2026-11-24) ลบ `BMB_G6_CONTRACT.md` + `BMB_G7_CONTRACT.md` แต่ `src/__tests__/g6g7OrderBoundary.test.ts` ยัง `import ...?raw` ไฟล์ทั้งสอง → Vite import-analysis โยน "Failed to resolve import" ตอน transform → suite ล้มทั้งไฟล์ → CI "Test + Lint + Build" พังทุกรอบตั้งแต่นั้น · **แก้:** ถอด import + describe "Doc-code alignment" ออก (boundary ยังถูก pin ครบ 10 เคสด้วย source-scan โค้ดจริง — Actual Code > Documentation §2.1) · เทสผ่าน 10/10, ชุดเต็ม 230 ไฟล์/2519 tests PASS
- **Contract-tests.yml (ตามสั่ง ห้าม skip):** รัน migration ครบ 001→latest แบบไดนามิก · ถอด skip 124-218 ทิ้ง · ถอด shims 214-218 ที่ไม่จำเป็นออก (ตามกฎ §17.5 ที่เพิ่งเพิ่ม — migration เหล่านี้ไม่อ้าง auth.users/profiles) · **พิสูจน์ด้วย Docker replay จริง:** 222 ไฟล์ OK / 0 FAIL บน fresh DB + `contracts_phase1_214_218.sql` PASS ทุกเคส (หลักฐาน `e2e/w2-replay-full-2026-11-25.log` + `e2e/ci/w2_fresh_replay_full.sh` + `w2_run_replay_full.bat`)

- **Phase 1: Ingredient Master Enrichment + Supplier Master + Supplier Mapping** — ✅ COMPLETE
  - Migrations 214-218 applied to production (Rule 16.3: Probe → Apply → Verify Ledger)
  - 214: `suppliers` table + RLS (is_inventory/is_kitchen/is_pos/is_finance from m146)
  - 215: `inventory.supplier_id` FK + backfill from denormalized data (dry-run report for Owner review)
  - 216: Inventory enriched — `prep_yield_factor`, `prep_waste_pct`, `purchase_unit`, `use_unit`, `conversion_factor`, `package_size`, `gross_weight`, `net_weight`, `wavg_cost`, `last_purchase_price`, `last_approved_price` (Owner Decisions B1, B2, B3)
  - 217: `supplier_products` mapping table — 3 price states: committed (PO), realized (GRN), approved (policy) (Owner Decision B4)
  - 218: `recipes` batch yield — `batch_yield_factor`, `batch_waste_pct`, `cost_per_unit`, `last_cost_calculated_at` (Owner Decision B3)
  - API: `bmbAdminApi_suppliers.ts` (CRUD), `bmbAdminApi_supplierProducts.ts` (mapping + 3 price states)
  - Types: `Supplier`, `SupplierForm`, `SupplierProduct`, `SupplierProductForm`, extended `Ingredient`, `RecipeRow`
  - All local gates pass: `tsc --noEmit` 0, `npm run lint` OK, `vitest run` 230 files/2519 tests PASS, `npm run build` PASS

- **Contract Tests for Phase 1 (ตามกฎใหม่ §17.6)** — ✅ `e2e/contracts_phase1_214_218.sql`: schema + indexes + RLS enabled + policies + Admin CRUD + is_inventory/is_kitchen/is_pos/is_finance + updated_at triggers + FK + backfill + constraint behavior (mixed unit states rejected) + 3 price state columns · พิสูจน์บน fresh DB ผ่านทุกเคส

**🔒 SESSION CLOSE 2026-11-24 (R105c · README REWRITE — เวอร์ชันแรกแบบพรีเซนต์นักลงทุนถูก Owner ตัดสินไม่เอา → กู้โครงเดิม R74-OMNI กลับมา อัปเดตแบบปกติตามฟีเจอร์จริงล่าสุด) · **CODE_CLOSED — เอกสารเดียว ไม่มี code change ไม่ต้องรัน code gates**

- **งาน:** กู้ README โครงเดิม (R74-OMNI style) ครบทุก section → อัปเดตแบบปกติ: สถานะหัวไฟล์ R105b · §3 +บรรทัดข้ามช่องทาง R101–R104 · §4 +Background Music R55→R105b · §5 +4 แถว (ตะกร้าข้ามช่องทาง/เพลงบรรเลง m196 RLS/สติกเกอร์ R63d) + social "EF deployed R104 · เหลือ live test H/I" + rider m210–212 · §6 migrations 197→213 + EF 24 + vitest 230 ไฟล์/2,521 tests · §7 ตัวเลขโฟลเดอร์ · §10 live test H/I + ปิดแล้ว +R105b/m212/R82 · §11 +AI_WORK_STATE + กติกา bootstrap/16.3
- **หลักฐานที่ยึด:** App.tsx · package.json · supabase/functions · migrations 001–213 · vitest 230 ไฟล์/2521 tests (วัดจริง 2026-11-24) · สถานะ LIVE จาก R51–R105b ใน ledger — ไม่มีข้อความอวดโดยไม่มีโค้ด · ค้างงานระบุตรง (Omise TEST card · live test H/I · §T)

---

**🔒 LIVE VERIFIED 2026-11-24 (R105b · BACKGROUND MUSIC RLS HOTFIX — Owner live test: "โฮเคทดสอบแล้วได้ ผ่านแล้วดีมาก" · Migration 196 (ตัวแก้) APPLIED PROD + RECORD LEDGER ✓) · **CODE_CLOSED + GATES PASS (tsc 0 · lint OK · vitest 230 ไฟล์/2521 tests · build OK) + PUSHED `b5ac4bd` + SESSION CLOSED**

- **Root Cause (พิสูจน์จาก m119 ของโปรเจกต์เอง — probe จริง 2026-10-07):** m196 (เดิม m103) ใช้ subquery `(SELECT id FROM storage.buckets WHERE name='background_music') = bucket_id` ทั้ง 4 policies → RLS ของ `storage.buckets` ซ่อนแถว bucket จาก `anon`/`authenticated` → subquery = NULL → policy fail ทุกข้อ → `.list('')` คืน [] (ปุ่มโชว์ "ไม่มีเพลงใน bucket") + `.upload()` 42501 — ตรงอาการ live ทั้งสอง · m119 เคยแก้บั๊กเดียวกันให้ bmb-images (bucket_id literal) — m103→m196 เลื่อนชื่อแล้วคง pattern พังเดิม = คำตอบ "เลื่อนชื่อ migration เกี่ยวไหม" → **เกี่ยว**
- **การแก้ (2 ไฟล์):** ① `196_background_music_bucket_policies.sql` — 4 policies เป็น `bucket_id = 'background_music'` literal (subquery public.profiles คงเดิม — m119 ยืนยันว่าทำงาน) · idempotent ② `AmbientMusicToggle.tsx` `handleToggle()` — กด "หยุดเพลง" (toggle คืน false) ไม่ตั้ง emptyBucket แล้ว (`setEmptyBucket(!started && !wasPlaying)`) — เดิมโชว์ "ไม่มีเพลงใน bucket" หลอก
- **เกต (ผลจริง):** `tsc --noEmit` 0 · `npm run lint` OK · `vitest run` **230 ไฟล์ / 2521 tests PASS** (ambientMusic 21 · backgroundMusic 13 · rXXBackgroundMusicAdmin 13 · r44UiTheater 6 รวมชุดเต็ม) · `npm run build` PASS
- **✅ Owner Steps ครบ + LIVE VERIFIED (2026-11-24):** 1) Migration 196 ตัวแก้ APPLIED PROD (SQL Editor — Owner ยืนยัน "196 รันผ่าน") 2) RECORD LEDGER ✓ — `schema_migrations` มี `196_background_music_bucket_policies` (probe `e2e/_r105bRecord196.cjs` → `e2e/_r105b_record196.json`: policies 4/4 pattern ใหม่ · pattern เสีย 0 · bucket public ✓ · objects 5 ✓ · กฎ 16.3 ครบ) 3) **LIVE TEST PASS ✓** (Owner: "โฮเคทดสอบแล้วได้ ผ่านแล้วดีมาก") — list เห็นไฟล์ + อัปโหลดได้ + ปุ่ม ♫ เล่นได้
- **Commit:** `b5ac4bd` fix: background music RLS — bucket_id literal per m119 (list ว่าง + upload 42501) + ไม่โชว์ไม่มีเพลงตอนกดหยุด

---

**🔒 LIVE STATE 2026-11-24 (R105 · BACKGROUND MUSIC FIX — "เปิดเพลงแล้วแต่ไม่มีเสียง / UI แสดงกำลังเล่นแต่เงียบ" · Migration 196 APPLIED PROD + Master Flag ENABLED + CORS OK) · **CODE_CLOSED + GATES PASS (vitest 2516 tests · tsc 0 · lint OK · build OK) + PUSHED `94d9958`**

- **Root Cause (พิสูจน์จากโค้ดจริง):**
  - `AmbientMusicManager.toggle()` ตั้ง `playing = true` ทันที โดยไม่รอ `engine.start()` เริ่มเล่นจริง → engine async (`void ensureQueue().then(...)`) ถ้า bucket ว่าง / list error / `audio.play()` fail → engine ใช้ `isPlaying = false` ภายใน แต่ manager ไม่รู้ → UI ค้าง "กำลังเล่น" (⏸) ตลอดไป
  - ไม่มี master gate เช็ค `business_settings.ambient_music.enabled` → แอดมินปิดใน settings ก็เล่นได้
  - External URL import (มีอยู่แล้วใน R55) ความน่าเชื่อถือไม่มั่น: `fetch()` ไม่มี CORS mode / ไม่ validate MIME / ไม่มี progress indicator / error message กรอบ

- **การแก้ (เฟส 1–2 ตามแผน `.kilo/plans/1795450079061-background-music-bugfix-and-import-hardening.md`):**
  1. **`ambientMusic.ts`**: `AmbientEngine.start()` คืน `Promise<boolean>` (resolve `true` ตอนเล่นจริง) · `toggle()` await engine result ก่อนตั้ง `playing` + อ่าน `business_settings.ambient_music.enabled` เป็น master gate (disabled = คืน false ทันที) · import `supabase`
  2. **`AmbientMusicToggle.tsx`**: state `emptyBucket` + `useEffect` ฟัง `MUSIC_EVENT` — ถ้า `playing && volume===0` = bucket ว่าง → แสดง "ไม่มีเพลงใน bucket — โปรดอัปโหลดในแอดมิน" แทน slider
  3. **`BackgroundMusicSettingsPage.tsx`**: `onImportUrl()` — `fetch(url, {mode:'cors'})` + validate `content-type` เริ่ม `audio/` + progress indicator "กำลังดาวน์โหลด → บีบอัด (Opus 128kbps) → อัปโหลดเข้า bucket…" + error message ชัดเจน (HTTP status / MIME / CORS)
  4. **Tests**: `ambientMusic.test.ts` mock `supabase` + async `FakeEngine.start()` + await `manager.toggle()`

- **Migration:** `196_background_music_bucket_policies.sql` (renumbered from 103 conflict) — bucket `background_music` + policies: public read (anon SELECT) / admin write (authenticated + role='admin') / idempotent
- **Admin Steps (เสร็จแล้ว 2026-11-24):**
  - Migration 196 APPLIED PROD ✓
  - `business_settings.ambient_music.enabled = true` ✓
  - Bucket CORS allow `biteme-baby.com` ✓ (มีตั้งแต่ R55)

- **Gates:** `tsc --noEmit` 0 · `vitest run` **2516 tests PASS** (ambientMusic 16/16 · backgroundMusic 13/13) · `npm run lint` OK · `npm run build` PASS (PWA v1.3.0)
- **Commit:** `94d9958` fix: background music state sync + master gate + URL import hardening

---

**🔒 LIVE STATE 2026-11-24 (R104 · "1 REPLY = 1 ลิงก์ของระบบ + เปิด ?cart= = ตั้งตะกร้า" — Owner live "อาการที่แก้ไม่หายสักอาการ": ตะกร้าโต 26→32→34 (+6 ชิ้น × ฿79 = +฿474 เป๊ะ) และเปิดข้ามเบราว์เซอร์แล้วว่าง (URL = biteme-baby.com/ ไม่มี query)) · **CODE_CLOSED + GATES PASS (vitest 2516 tests · tsc 0 · lint OK · build OK) + PUSHED `47d2043` · ✅ EF social-ai-worker DEPLOYED (2026-11-24 · Owner)**
- **Root Cause 2 ขา (ที่ R102 ปิดไม่ครบ):** RC-A = Layout เปิด `?cart=` แล้ว "เติม" payload ทับรายการเดิม (addItem merge บวกจำนวน) → กดลิงก์จากหลาย reply = กองซ้ำ (guard R102 กันแค่ payload เดิมซ้ำ) · RC-B = prompt เดิมสั่ง AI เขียน `https://biteme-baby.com/shop` เอง + template `?cart=<encoded>` ที่ AI คำนวณไม่ได้ → ทุก reply มีลิงก์เปล่าเด่นกว่าลิงก์จริง
- **การแก้:** ① Layout `?cart=` = **"ตั้งตะกร้าตามลิงก์" (replace)** — resolve ก่อนแตะตะกร้า (ไม่มีของใช้ได้ = ห้ามทำลายตะกร้าเดิม) · guard R102 คงอยู่ = กดลิงก์เดิมซ้ำไม่แตะตะกร้า ② `stripBareShopLinks(draft)` ใหม่ — draft ห้ามมีลิงก์ร้านเองทุกรูปแบบ (regex จับ template `<encoded>` ครบ) ③ worker กฎ **"1 reply = 1 ลิงก์ของระบบ"** — prompt/notes ห้ามเขียน URL · finalText = strip(draft) + footers + **default CTA** เมื่อไม่มี footer มีลิงก์ → ทุก reply มีลิงก์ร้านถูกต้องอันเดียวเสมอ
- **เกต (ผลจริง):** tsc 0 · vitest **2516 tests PASS** (r75 pin อัปเดตตาม R104 — post worker คงกฎเดิม) · lint OK (U+FFFD จาก edit แก้ครบ) · build PASS
- **Deploy (เสร็จแล้ว):** `social-ai-worker` ✅ DEPLOYED (Owner 2026-11-24 exit=ok) · frontend = Cloudflare auto-deploy — **เหลือแต่ Owner live test กลุ่ม I (8 ข้อ) ตาม `docs/BMB_REMAIN_TESTS_LIVE_2026-11-23.md`**

---

**🔒 LIVE STATE 2026-11-24 (R103 · SERVER-SIDE CART SYNC v1 — Owner: "เตรียมทำ Server-side cart sync ต่อให้สมบูรณ์") · **CODE_CLOSED + GATES PASS (vitest 229 ไฟล์/2501 tests · tsc 0 · lint OK · build OK) · ⚠️ MIGRATION 213 APPLIED PROD (2026-11-24 · Owner อนุมัติ):**

- **ขอบเขต (ต่อยอด R102 — deep-link แก้ guest ข้ามเครื่องได้แล้ว · R103 แก้ "ล็อกอินแล้วตะกร้าตามข้ามเครื่องจริง"):**
  1. **`supabase/migrations/213_cart_sessions_payload.sql`**: ADD COLUMN `payload JSONB` ให้ `cart_sessions` (เนื้อตะกร้าจริง — รูปเดียวกับ localStorage `bmb-cart-v1`: ids/qty/customizations/mode/coupon/referral · **ไม่มีราคา/ยอดรวม/PII** — server re-derive ตอน RPC 025 เสมอ) + RLS **`cart_sessions_select_own`** FOR SELECT TO authenticated (m180 ขาดน้องนี้ — เขียนได้อ่านไม่ได้) · ADDITIVE ONLY re-run ปลอดภัย
  2. **`cartSessionSync.ts`** (R49 telemetry → R103 sync จริง): upsert **`id = 'csa-' + customerId`** (deterministic — 1 แถว/1 ลูกค้า · อัปเดตจากเครื่องไหนก็แถวเดิม · บัญชีต่างกัน = แถวต่างกัน = intent R68 ยังครบ) + `payload: serializeCartObject(state)` (ตะกร้าว่าง = payload null) + `customerId` cache ต่อ uid + **`fetchLatestServerCart()`** ใหม่ (select payload ตาม customer_id · latest updated_at · ผ่าน `parseStoredCart` strict validate · guest/anon = null เงียบ ๆ R63 posture คงเดิม)
  3. **`cartPersistence.ts`**: hydration path เพิ่ม restore จาก server — กฎเดียว: **local ไม่มีรายการ = ลอง server** (local มีของ = local ชนะ — ไม่ surprise merge · ไม่ยุ่ง flow `?cart=` ของ Layout/R102) · dynamic import `cartSessionSync` (กัน cycle) · restore เสร็จก่อน `setHydrated()` (ลำดับ deterministic — Layout `?cart=` รอ isHydrated)
  4. **เทสต์ `r213CartServerSync.test.ts` (15 cases)**: migration contract (payload/select_own/ไม่แตะ policy เดิม) · guest guard ก่อน upsert (r49/r63 pin คงอยู่) · deterministic id · payload round-trip (ไม่มีราคาหลุด · strict parse) · ลำดับ restore→setHydrated · boot wiring ครบ · **R68 test contract อัปเดตตามข้อเท็จจริง** (sessionId localStorage → csa-<customerId> — intent "ไม่ทับข้ามบัญชี" ยังครบ + pin ใหม่ ยิงยืนยัน identity จาก auth.uid())

- **เกต (เห็นผลจริงทั้งหมด):** `tsc --noEmit` 0 · `vitest run` 229 ไฟล์ / 2501 tests PASS · `npm run lint` OK (3 gates) · `npm run build` PASS (PWA)

- **ผลลัพธ์ข้ามเครื่อง ณ ปิดงานนี้ (ครบทั้ง 2 แนวทาง):** ล็อกอิน = server sync (R103 อัตโนมัติ ข้ามเครื่องทุกเครื่องที่ล็อกอินบัญชีเดียวกัน) · guest = deep-link `?cart=` (R101/R63b/R102 — พิสูจน์ live แล้ว)

---

**🔒 LIVE STATE 2026-11-24 (R102 · FB IAB CART DOUBLE-ADD + EXTERNAL COPY EMPTY CART — Owner: "IAB กดลิงก์ซ้ำนับเพิ่มทุกครั้ง + คัดลอกไป Chrome ตะกร้าว่าง") · **CODE_CLOSED + GATES PASS (vitest 228 ไฟล์/2486 tests · tsc 0 · lint OK · build OK):**

- **อาการจาก live test (รูป 4 ภาพ FB Post/Comment + WebView + Chrome):**
  1. **IAB (ในแอปเฟซ)**: กดลิงก์ AI (ใต้โพส/ข้อความ) หลายครั้ง / navigate กลับ `/shop` → นับสินค้าเพิ่มทุกครั้ง (24 → 26 → 26 ชิ้น)
  2. **External (Chrome/Safari ผ่านแบนเนอร์คัดลอก)**: คัดลอกลิงก์จาก IAB → เปิดใน Chrome → ตะกร้าว่าง / ไม่ตรงกับ WebView

- **Root Cause เดียวกัน (พิสูจน์จากโค้ดจริง):**
  - RC1: `history.replaceState` **ล้มเหลวใน FB IAB** → `?cart=` ค้างใน URL → navigate กลับ `/shop` (แม้ใน SPA) → Layout effect รันใหม่ → decode `?cart=` ซ้ำ → `addItem` ซ้ำ → นับซ้ำ
  - RC2: ลิงก์ที่คัดลอกมาจาก IAB มี `?cart=` **เสียหาย (double-encoded / payload แพะจากบั๊ก IAB)** → `normalizeCartParam` ถอดไม่ได้ → `return` ไม่เติมของ

- **การแก้ไข 4 จุด:**
  1. **`Layout.tsx` (effect ?cart=)**: เพิ่ม **sessionStorage guard** `bmb:cart-processed-<hash16>` check ก่อน `runAdd` → เคย process แล้วข้ามทันที + mark flag หลัง `added > 0` → กัน double-add แม้ `replaceState` fail
  2. **`InAppBrowserBanner.tsx` (`buildLiveHandoffUrl`)**: **strip `fbclid` ก่อน fallback chain** + **บังคับ live cart เสมอเมื่อมีของ** (ไม่ fallback mount snapshot/resume ที่อาจเก่า) + เพิ่ม `data-testid="inapp-live-cart-count"`
  3. **`cartDeepLink.ts`**: `cartParamFingerprint(raw)` — FNV-1a 32-bit + ความยาว (ห้าม prefix slice: b64url ของ JSON ต่างกันแต่ prefix เดียวกัน = key เดิม → บล็อกลิงก์ใหม่ผิด — เทสต์จับ collision จริง)
  4. **Test ใหม่ `fbCartBridgeIAB.test.ts` (16 cases)**: IAB double-add guard (navigate 5 ครั้ง → addItem 1 ครั้ง) + External copy decode (double-encoded + fbclid → ผ่าน)

- **เกต (เห็นผลจริงทั้งหมด):** `tsc --noEmit` 0 error · `vitest run` 228 ไฟล์ / 2486 tests PASS · `npm run lint` OK (eslint + brandNameGuard + languageSanity — จับ U+FFFD 2 จุดจากการ edit แล้วแก้) · `npm run build` PASS (PWA)

- **Out of Scope (ไม่ทำในแผนนี้):**
  - Server-side/account cart (ต้อง architecture ใหม่ — งานแยก sprint) ← **แก้แล้วใน R103**
  - LINE/IG in-app browser (hook รองรับแล้ว รอ channel จริง)
  - PWA install flow (ทำงานอยู่แล้ว)

---

**🔒 LIVE STATE 2026-11-23 (R64 · DELIVERY SYNC FIX — "ไรเดอร์กดรับอาหารเพื่อเดินทางออกส่งไม่ได้ ตัน preparing → NULL chain + แผนที่รายออเดอร์ขาว + ลูกค้า Map โหลดไม่ได้") · **CODE_CLOSED + GATES PASS (vitest 226 ไฟล์/2447 tests · tsc 0 · lint OK · build OK) + PUSHED + MIGRATION 212 APPLIED**:**

- **อาการจาก live test (23/11/2569 · รูป 18:34–20:07):**
  1. ไรเดอร์กด "รับอาหารเพื่อเดินทางออกส่ง" → `ERR_DELIVERY_SYNC_BLOCKED: order PO-20261124-544 cannot advance preparing -> <NULL> (target dispatched)` — วงจรตัน
  2. ลูกค้าทุกเครื่องค้างที่ "จัดทำรอบพรีออเดอร์" ไทม์ไลน์ไม่ขยับ
  3. แผนที่รวมไรเดอร์ใช้ได้ · แผนที่รายออเดอร์ขาว 1 ใบ (multi-instance Leaflet init race)
  4. Error แล้วแผง POD ปิดเอง (ดูเหมือนปิดงาน แต่งานยัง accepted + POD แนบครึ่งทาง)
  5. แอดมิน "🏁 แอดมินปิดวงจร" ตันจุดเดิม
  6. หน้าที่อยู่ลูกค้า: Google Maps โหลดไม่ได้ (key ถูกปฏิเสธ) + กล่องพิกัดแมนนวลแดงทั้งที่ GPS ยืนยันแล้ว

- **Root cause (พิสูจน์จากโค้ดจริง):**
  - RC1: 3 RPC canonical (`driver_update_delivery_status` m197, `admin_advance_delivery_status` m116, `driver_checkin_arrival` m166) มี hop chain เริ่มแค่ `ready_for_dispatch` → ออเดอร์ `preparing` ตันค้าง (R87b pattern)
  - RC2: `driverErrorText` ไม่มี mapping ERR_DELIVERY_SYNC_BLOCKED/ERR_KITCHEN_NOT_READY → โชว์อังกฤษดิบ + kind='state' ซ่อนปุ่ม retry
  - RC3: `completeDelivery` finally เคลียร์ `activeOrder` แม้ error → แผง POD ปิดตัวเอง (S5)
  - RC4: `RiderMiniMap` สร้าง/ทำลายแผนที่ซ้ำทุกครั้ง GPS/pin เปลี่ยน + init race + Google leak → ขาวบางใบ
  - RC5: `DeliveryMapPicker` ไม่มี Leaflet fallback + UX กล่องแมนนวลหลอก
  - RC6: warning มอบหมายซ้ำไม่ตรง (busy = multi-job OK)

- **การแก้ไขแบ่ง 5 เฟส (Migration 212 + Code):**
  - **Phase A (m212):** ต่อ hop chain — เพิ่ม `preparing → ready_for_dispatch` + guard `pending/confirmed` raise `ERR_KITCHEN_NOT_READY` (ไทยชัด) ใน 3 RPC · audit message ระบุ auto-hop
  - **Phase B:** `driverService.ts` เพิ่ม mapping ไทย 2 error · `RiderPwaPage.tsx` completeDelivery ไม่เคลียร์ activeOrder ตอน error + `podAttachDoneRef` skip re-upload · order_status chip ในการ์ด + ปุ่ม label "🛵 รับอาหารเพื่อเดินทางออกส่ง"
  - **Phase C:** `DeliveryManagement.tsx` warning copy แยก busy/offline · preparing badge + kitchen link ในคิว dispatch
  - **Phase D:** `RiderMiniMap` restructure: single init + imperative marker update + invalidateSize + ResizeObserver + stable keys · `DeliveryMapPicker` เพิ่ม Leaflet/OSM fallback + ซ่อนกล่องแมนนวลเมื่อมี candidate
  - **Phase E:** Test source-contract (r212DeliverySyncPreparingHop + updates) + gates ผ่าน + docs updated

- **Migration:** `212_delivery_sync_preparing_hop.sql` (REVOKE PUBLIC / GRANT authenticated เท่า baseline · 3 ฟังก์ชัน canonical verbatim + hop ใหม่ + guard)
- **Out of scope:** state machine / assignment structure / server-side cart / Google Maps key (ฝั่ง Owner)

---

**🔒 LIVE STATE 2026-11-23 (R63d · STICKER CONSOLIDATION — "ออเดอร์ 3 กล่อง (2+1 เมนู) พิมพ์สติกเกอร์ออกมา 3 ดวง → แก้เป็น 1 ดวงรวมทุกเมนู") · **CODE_CLOSED + GATES PASS (vitest 226 ไฟล์/2447 tests · tsc 0 · lint OK · build OK) + PUSHED `d67bf47` · frontend only (Cloudflare auto-deploy)**:**

- **Root cause:** `stickerQueue.ts:stickerRollForOrder()` วน split ออเดอร์เป็น 1 ดวงต่อ 1 ชิ้น × quantity (qty 2 = 2 ใบ) → ออเดอร์ 3 กล่อง = 3 สติกเกอร์ · `stickerForm.ts` (R66) รองรับ ORDER LIST 4 บรรทัดต่อเนื่องอยู่แล้ว
- **แก้ (`d67bf47`):** `stickerRollForOrder` คืน `[data]` (1 element = ออเดอร์เต็ม) แทน split per item → `printStickerRoll` render PNG 1 รูป → Bluetooth queue 1 job
- **Test lock:** `stickerQueueR31.test.ts` R31 contract ใหม่ — `expect(roll).toHaveLength(1)` · items คง quantity จริง (`x2`, `x1`) · special_request รักษาไว้
- **AdminOrders.tsx:** toast messages เปลี่ยน `${roll.length} ใบ` → `1 ใบ`
- **Impact:** 1 ออเดอร์/1 ลูกค้า = 1 สติกเกอร์ (R5c invariant) · ไม่มี migration / DB change

---

**🔒 LIVE STATE 2026-11-23 (R63c · CART UX + CLOSED ROUNDS — "หน้าตะกร้าลงลึกเหลือปุ่มเดียว + Checkout โชว์รอบปิด status=closed เทา/กดไม่ได้") · **CODE_CLOSED + GATES PASS (vitest 226 ไฟล์/2447 tests · tsc 0 · lint OK · build OK) + PUSHED `9f5f517` · frontend only (Cloudflare auto-deploy)**:**

- **CartPage (R10/R63c):** เอาเซกชั่น 🎟️ คูปอง/โปรโมชั่นออก · เอาส่วนรายละเอียด 💰 สรุปราคา (สินค้า/ส่วนลด/ค่าจัดส่ง/รวม) ออก → เหลือรายการสินค้า + cross-sell strip + (ถ้ามี stale pre-order → warning) → ปุ่ม **"ยืนยันสั่งซื้อ →"** เดียวไป /checkout (gated `hasStalePreOrder`) · คูปอง/ราคาสรุปย้ายไปหน้า checkout อยู่แล้ว (R10)
- **CheckoutPage (R63c):** รอบที่แอดมินปิด (`status='closed'`) ต้อง **แสดงแต่เทา/กดไม่ได้** — เปลี่ยน PRE_ORDER fetch ใช้ `getRoundsForDateAdmin` (all non-archived rounds) แทน `listRoundsForDate` (active-only) · `closed = r.status==='closed' || roundBookability!=='open'` · badge "ปิดรับ (แอดมิน)" สำหรับรอบปิด · SAME_DAY auto-select คงเดิม
- **Tests:** อัปเดต mocks (`checkoutModeLock`, `checkoutMixedSplit`, `r65PickupHoursNotRounds`) → mock `getRoundsForDateAdmin` คืน `status='active'` · pins `go-checkout` testid คงอยู่
- **Migration check:** ไม่มี migration ใหม่ในรอบนี้ — ระบบรอบส่ง/สถานะอยู่แล้ว (`delivery_rounds.status` 'active'/'closed', RLS public read กรอง `status='active'`)

---

**🔒 LIVE STATE 2026-11-23 (R63b · HOTFIX จาก live test — "คัดลอกลิงก์ → เปิดเบราว์เซอร์ภายนอก (แท็บเล็ต) ได้ตะกร้าเก่าที่กู้คืน ไม่มีของใหม่") · **CODE_CLOSED + GATES PASS (vitest 226 ไฟล์/2447 tests +1 · tsc 0 · lint OK · build OK) + PUSHED `f6e4022` · frontend only (ไม่ต้อง deploy EF)**:**

- **Root cause (พิสูจน์จากโค้ด):** `InAppBrowserBanner.tsx` อ่านตะกร้าด้วย `useCartStore.getState().items` **ใน render body** = อ่านครั้งเดียวตอน mount แล้วค้าง (stale closure — `.getState()` ไม่ subscribe store) → ลูกค้าเพิ่มเมนูต่อใน WebView (17 ชิ้น) แต่ banner ยังถือตะกร้า mount (1 รายการจาก AI summary) → ปุ่มคัดลอก/กล่องลิงก์ทุกทางพา `?cart=` **เก่า** เสมอ
- **แก้ (`f6e4022`):** ① `liveCart` = `useCartStore((state) => state.items)` — subscription hook จริง: banner re-render ทุกครั้งที่ตะกร้าเปลี่ยน → `buildLiveHandoffUrl`/`copyHandoff`/`linkBoxUrl` ใช้ตะกร้าสด **ณ เวลากด** ทุกทาง ② ตัด dead code `handoffUrl` (URL จาก mount snapshot — ต้นตอเดิมที่ค้างมาจากแนวคิดเก่า) — คัดลอกทุกทางผ่าน fallback chain เดียว (live → mount → resume TTL 30 น.)
- **Test lock:** `r101CartHandoffFix.test.ts` เพิ่ม R63b — assert banner ใช้ selector hook + ห้าม `getState().items` + ห้าม dead `handoffUrl` กลับมา
- **จำนวนชิ้น/ราคาที่หาย:** encoding v2 (mods + line_mode) ถูกต้องมาก่อน — ตะกร้าเก่าที่เห็น = ปัญหาเดียวกัน 2 ชั้น (R63 stale ชั้นนี้ + payload v1 เดิม) — R63b ปิดชั้น stale สุดท้าย

**🔒 LIVE STATE 2026-11-23 (รอบ 63 · BMB-FB-CART-BRIDGE-LIVE-2026-11-23 — สะพาน "ตะกร้าสด" ข้ามช่องทาง Facebook → เบราว์เซอร์จริง Phase 1–3) · **SESSION CLOSED — CODE_CLOSED + PUSHED (`9b913c9`) + EF `social-ai-worker` DEPLOYED exit=0 + SMOKE http=200 boot_ok=true (เขาทุกกก 2026-11-23 05:21Z · `e2e/_r74_deploy.log` + `_r82_smoke.json`) · เหลือแต่ Owner live test กลุ่ม H (6 ข้อ) + กลุ่ม G/F ค้างเดิม**:**

- **ปัญหาที่ Owner ชี้ (พิสูจน์จากรูป 08:48–08:52 + โค้ดจริงแล้ว):**
  ใน Facebook WebView ตะกร้ามี **4 บรรทัด / 17 ชิ้น / ฿1,313** แต่กด "คัดลอกลิงก์ → วางใน Chrome" แล้วได้เพียง **1 รายการ ฿79** (= payload ของลิงก์ AI สรุปรอบคุยล่าสุด) — ข้อมูลไม่ตรงกันทุกช่องทาง

- **Root cause 4 ชั้น (ที่ตรวจจาก Actual Code):**
  1. AI สร้าง `?cart=` จาก **รายการ matched ของรอบคุยเท่านั้น** — `supabase/functions/_shared/socialOrderIntake.ts:555-561` (`cartFooterForMatch`) — server ไม่มีตะกร้าฝั่งลูกค้าให้อ่าน
  2. ปุ่มคัดลอกส่งต่อ **สแนปชอต mount ครั้งเดียว / `bmb:cart-resume` ที่ไม่มี TTL** — `src/components/InAppBrowserBanner.tsx:62-70, 131-159` — ไม่มีโค้ดใด serialize ตะกร้าสดลงลิงก์
  3. `Layout.tsx:136-141` strip `?cart=`/`?s=` หลัง restore (§T-A) → ลิงก์ที่คัดลอกพา payload เก่าเสมอ
  4. Restore ทั้งสอง path **hardcode `addItem(p, q, {}, 'SAME_DAY')`** → ทิ้ง add-ons + line_mode — `Layout.tsx:125, 199`

- **ข้อเท็จจริงที่เปิดทางแก้:** `customizations = { addOns: [{ addonId, selections, note }] }` — เก็บแค่ id/ตัวเลือก/โน้ต **ไม่มีราคา ไม่มี PII** (ราคา server re-derive) → ฝังลงลิงก์ได้ปลอดภัย (`src/lib/addonDisplay.ts:66-79`, `src/types/index.ts:822-825`)

- **การแก้ไข Phase 1–3 (ตามแพลน `.kilo/plans/1795399498532-fb-cart-bridge-live-plan.md`):**
  - **Phase 1 — `cartDeepLink.ts` payload v2 (pure lib):** เพิ่ม `encodeLiveCartParam(lines)` → `{v:2, items:[{id,q,mods?,lm?}]}`; caps 30 items/50 qty/item/payload ≤1800 chars + downgrade (ตัด mods ก่อน แล้วค่อยตัดบรรทัด); `decodeCartParam`/`normalizeCartParam`/`readCartParam` รองรับ v1+v2 back-compat
  - **Phase 2 — ปุ่มคัดลอกพาตะกร้าสด (`InAppBrowserBanner.tsx` + `Layout.tsx`):** `copyHandoff` ใช้ `encodeLiveCartParam(liveCart)` ณ เวลากด + fallback chain (live cart → mount snapshot → `bmb:cart-resume` **TTL 30 นาที**); banner count ใช้จำนวนตะกร้าสด; strip `fbclid`; เคลียร์ `bmb:cart-resume` หลัง restore; Layout restore ทั้ง 2 path ส่ง `mods`/`lm` เข้า `addItem` จริง (เลิก hardcode); addOns ที่ addonId ไม่พบ = ตัดออก (fail-safe)
  - **Phase 3 — ความจริงทุกช่องทาง (server shared lib):** `socialOrderIntake.ts` `buildCartSummaryFooter` เพิ่ม scope disclosure line: `"ℹ️ ลิงก์นี้พาเฉพาะรายการที่คุยกันในรอบนี้ — ของที่เพิ่มเองบนเว็บยังอยู่กับเว็บของคุณ (ในหน้าเว็บกดคัดลอกลิงก์ = พาตะกร้าเต็มไปด้วย)"` (`cartFooterForMatch` R92 คงพฤติกรรม)
  - **Phase 4 — Tests + Gates:** อัปเดต `cartDeepLink.test.ts` (v2 round-trip, caps/downgrade, back-compat v1, double-encode), `r101CartHandoffFix.test.ts` (banner contract ใหม่: live-cart-at-click + fallback + TTL + testids), `socialOrderIntake.test.ts` + `socialAiContinuity.test.ts` (scope line) — **เกตผ่านครบ: `tsc` 0 errors · `npm run lint` OK · `npm run test` 226 files / 2446 tests PASS · `npm run build` PASS (PWA v1.3.0)**

- **Deploy (Owner อนุมัติ 2026-11-23 05:02 และ 05:19):** `social-ai-worker` เท่านั้น (intake footer ถูก import ที่นี่อย่างเดียว — channel-webhook ใช้ `resolveKitchenPoint` ซึ่งไม่เปลี่ยน) — **DEPLOYED exit=0** (2026-11-23 05:21:08Z · `npx supabase functions deploy social-ai-worker --project-ref ivkdfognyiwjcmrhcnwz` · พิสูจน์ boot: smoke fake event_id → http=200 + "no RECEIVED social events")

- **Out of scope (ประกาศชัด):** Server-side/account cart (ซิงก์ข้ามเครื่องจริง) — future; คูปอง/referral/ค่าส่งในลิงก์; LINE/IG เฉพาะทาง

**🔒 LIVE STATE 2026-11-22 (รอบ 62 · BMB-ADMIN-FOCUS-LOOP-FOLLOWUP — แก้ CI #1014 แดง: source-contract test ยึดพฤติกรรมเก่า + Node 20 warning) · **CODE_CLOSED + LOCAL GATES PASS + CI #1015 ✅ + CONTRACT #589 ✅ + ANNOTATIONS ว่าง + PUSHED**:**

- **R81 Floating Ad Tab (Owner รายงาน "งงกับระบบเลือกรูป ... ทับซ้อนข้อมูลมั่ว"):** เพิ่มแท็บจัดการโฆษณาลอยใน **หน้าหลักที่แอดมินใช้งานจริง** (AdminMarketing.tsx → `/admin/marketing`):
  - Types + JSONB config + fallback migration (floating_ad_enabled/sources/image → floating_ad_config)
  - `src/components/admin/FloatingAdTab.tsx` (ใหม่): Overview (enabled/maxCount/sources maxItems/bg) + Card Management (reorder/toggle/override/remove) + Available Pool + Preview iframe
  - `src/pages/admin/AdminMarketing.tsx` — **เพิ่ม tab `floating_ad` label "🫘 Floating Ad" ใน Control Center (หน้าหลัก `/admin/marketing`)**
  - `src/components/home/FloatingAdBanners.tsx` — badge `text-[9px]` → `text-xs` + ข้อความไทย 3 ชนิด + config prop
  - `src/pages/HomePage.tsx` — อ่าน `floating_ad_config` สร้าง promos + sourceType
  - `src/components/admin/ContentTab.tsx` — ลบ floating ad UI เก่า (state/toggle/sources/guide/switch)
  - **แก้ผิดจากครั้งก่อน:** ครั้งแรกเพิ่มไปที่ AdminMarketingPromotions.tsx (หน้าที่ไม่ได้ในเมนูหลัก) — ตอนนี้ย้ายมาที่ AdminMarketing.tsx แล้ว (commit b31234c)

- **Gates:** lint ✅ · tsc ✅ · build ✅ (tsc + vite + PWA) · floatingAdBanners.test.ts ✅ (7 tests PASS) · **รอ Owner ทดสอบ live กลุ่ม G 7 ข้อ + gate ใหม่ (floating ad)**

**🔒 LIVE STATE 2026-11-20 (รอบ 56 — R78+R79+R80 · โพสต์การตลาด 5 รูป + Studio picker แท็บหัวข้อ + Floating Ad Exact Clone · **m209 APPLIED PROD ✓ + ledger backfill 186/205/206/207/208** · vitest 2431/2431 · CI 2/2 success × 3 commits · CODE_CLOSED + PUSHED · รอ Owner ทดสอบ live กลุ่ม G):**
- **R78 โพสต์การตลาด 5 รูป (ยกเลิก R44 gen-single ตามสั่ง):** แนบผสมได้ เมนู+ภาพเจน+อัปโหลด สูงสุด 5 รูป (ตัวนับ N/5 · toggle เลือก/เลิก · dedupe) · อัปโหลด multi-file ย่ออัตโนมัติ 1080px/≤500KB ขึ้น `bmb-images/uploads/mk-*` · FB worker attached_media 4→5 · ตาม commit `71667e8`
- **R79 Studio picker แท็บหัวข้อเมนูครบทุกเมนู:** จัดแท็บด้วย `buildHeadingGroups` ตัวเดียวกับ /shop และ /menu (icon+ชื่อ+จำนวน) · ไม่มีเพดาน 20 · 🚫 เมนูไม่มีรูป · ✓ อยู่ในชุด · ข้อมูลจาก `getProducts()`+`getCategories()` (canonical TEN-06) — เมนู/หัวข้อใหม่อนาคตเข้าอัตโนมัติ · ตาม commit `9d43386`
- **R80 Floating Ad Exact Clone (Owner: "ต้องก๊อปปี้ซิ้งกับข้อมูลให้ตรงกับที่สร้าง ตามที่แอดมินจิ้มเลือก"):** แหล่งเดิม auto-select (popular/marketing_feed_posts + prefix 📣🔥🎁 + fallback) → **ใหม่ 3 explicit sources** ที่แอดมินติ๊กเอง: `floating_promotions` (promotions.is_banner) · `floating_products` (products.is_floating_ad — m209) · `floating_posts` (marketing_posts.is_floating_ad — m209 + published) · โชว์ title/description/รูป **ตรงต้นฉบับ ไม่มี prefix ไม่มี fallback ไม่ตัดคำ** · badge เงียบ 3 ชนิด · R64 สลับ โปร→เมนู→โพสต์ cap 3 · toggle: AdminProducts (ฟอร์ม+badge) · AdminMarketing (โพสต์ published) · ContentTab (sources 3 แบบ) · R61 mascot คงเดิม · ตาม commit `4fc13a2`
- **Migrations บน prod (Owner อนุมัติ "apply ที่ขาดรวม 209" · ผ่าน Management API):** พิสูจน์ READ-ONLY ก่อน (`e2e/_r80DeployProbe.cjs` + `_r80Probe207.cjs`) → 209 = หายจริง (cols 0/0) ส่วน 186/205/206/207/208 = **apply อยู่แล้วแต่ไม่เคย record** (schema พิสูจน์: 186=Asia/Bangkok · 205=2 fn · 206=bucket Bite_Mascot · 207=my_deliveries v3 has_sched · 208=2 fn) → **apply 209 + record 6/6** (`e2e/_r80Apply209.cjs` ALL verify ผ่าน · `e2e/_r80_verify_ledger.json` · prod history รวม **208** จาก 213 ไฟล์ repo)
- **Gates:** lint ✅ · **vitest 226 files / 2431 tests PASS** (+9 จาก R78-R80) · build ✅ (tsc + vite + PWA) · **CI จริง 2/2 success ทั้ง 3 commits** (`71667e8`/`9d43386`/`4fc13a2`) — **รอ Owner ทดสอบ live กลุ่ม G 7 ข้อ** (ตาราง BMB_REMAIN_TESTS_LIVE_2026-11-20.md)

**🔒 LIVE STATE 2026-11-20 (R55 — Background Music file-based engine + Mascot badge fix + OAuth/Passkey ALL CONFIGURED · vitest 2422/2422 · CODE_CLOSED + PUSHED · รอ Owner ทดสอบ live กลุ่ม F):**
- **Background Music (file-based engine ทดแทน WebAudio synth ทั้งหมด — bucket `background_music`):** 
  - `lib/backgroundMusic.ts` ใหม่ — validate/compress/upload/delete/list + shuffle queue (`createShuffleQueue` ใช้หมดทุกเพลงก่อนวน) · `compressAudioForMusic` จริง: WebM Opus 128kbps mono via AudioContext + MediaRecorder ≤2MB target (fallback original)
  - `lib/ambientMusic.ts` rewrite — HTMLAudioElement engine (`createAudioFileEngine`) + shuffle queue + ducking 25% (0.25s ramp) + restore 0.6s + volume persist `bmb-music-volume` + no autoplay
  - `pages/admin/BackgroundMusicSettingsPage.tsx` ใหม่ — Admin UI: bucket list + `<audio controls>` preview + file upload (accept="audio/*" + drag-drop) + URL import (fetch→compress→upload) + enable toggle (`business_settings.ambient_music.enabled`) + delete/copy URL
  - `components/admin/AdminHubs.tsx` — เพิ่ม tab `music` ใน SettingsHub
  - `supabase/migrations/103_background_music_bucket_policies.sql` — RLS: public read (anon SELECT) + admin write (authenticated + role='admin') + idempotent bucket create (CI-safe)
- **Mascot Badge Fix (F-1):** `index.css:1173-1182` `.section-float-mascot` ลบ `border-radius: 50%` + เปลี่ยน `floatLogo` → `float` (translateY only) · 7 จุด overflow fix (`HomePage`, `ReviewPage`, `MenuPage`, `CategorySections`, `PromotionStrip`, `VerifiedReviewsSection`) — `min-w-0` + `truncate`
- **OAuth/Passkey — ทั้ง 4 ช่องทางพร้อมใช้งานจริง (Owner ตั้งค่า Dashboard เสร็จแล้ว):**
  - **Google** (built-in) — Client ID/Secret ✅
  - **Facebook** (built-in) — App ID/Secret + Public ✅
  - **LINE** (Custom OIDC) — Channel ID/Secret + Attribute Mapping (sub/email/name/picture) ✅
  - **Passkey** (built-in) — RP ID + Origin ✅
- **Gates:** lint ✅ (591 ไฟล์ + brandNameGuard + languageSanity) · **vitest 226 files / 2422 tests PASS** (+42: 13 backgroundMusic + 16 ambientMusic rewrite + 13 rXXBackgroundMusicAdmin) · build ✅ (tsc + vite + PWA) — **CODE_CLOSED + PUSHED + รอ Owner ทดสอบ live กลุ่ม F**

**🔒 LIVE STATE 2026-11-20 (R54 — มาสคอตลอยจริงไม่หลุดเฟรม + logout จริง + โหวต UX ตรงสาเหตุ + login เบอร์โทร · vitest 2391/2391 · CODE_CLOSED + PUSHED · รอ Owner ทดสอบ live กลุ่ม F):**
- **มาสคอตลอย/หลุดเฟรม (Owner: "ปรับปรุง hover ของมาสคอต มีหลายตัวเคลื่อนไหวแล้วหลุดเฟรม"):** พบจากโค้ดจริง — `.animate-float` เป็น **dead class** (ไม่มีนิยามทั้ง repo ทั้ง theme token และ CSS class — MascotBadge R52 ยกเว้น `.animate-float` ไว้ให้ลอยเองแต่ลอยไม่ได้) → **แก้ 3 ชั้น:** ①นิยาม `.animate-float` bind `@keyframes float` ที่มีอยู่ (index.css) ②ลอยย้ายมาที่ div เนื้อหาใน BiteMascot — ปุ่มเหลือ `hover:scale-105/active:scale-95` ล้วน (transform เดียวต่อองค์ประกอบ — เดิมปุ่มมี animate-float ชน hover ทับกัน) ③wrapper ถอด animate-float (เดิม animation บนชั้นที่ลากด้วย transform inline = ชนกันแล้วมาสคอตหลุดจากตำแหน่งที่ลากไว้)
- **Logout จริง (Owner: "ทุกผู้ใช้งานกดออกแล้วไม่ออกไปเข้าระบบใหม่จริง"):** เดิม `handleLogout()` เรียก `logout()` โดยไม่ await แล้ว `window.location` ทันที → `supabase.auth.signOut()` ยังไม่เสร็จก่อนหน้าโหลดใหม่ → session ค้าง กลับมา login เจอ session เดิมไม่เปิดฟอร์ม → **แก้:** `await logout()` จริง + `finally` พาไป `/login` เสมอ (ทั้งปุ่มเดสก์ท็อปและเมนูมือถือ)
- **ระบบโหวต "ขัดข้อง" (Owner รายงานจากภาพ live 11/20 — probe ของจริง กฎ 16.3):** `preorder_vote_status` (anon) = **200 OK** + tallies จริง · `preorder_vote_cast` (anon) = **HTTP 401 body ว่าง** = **m208 ติด prod ครบ REVOKE anon ทำงานถูก** → สาเหตุจริง = ผู้ใช้**ไม่ได้ล็อกอิน** — PostgREST กัน EXECUTE ก่อนถึงตัวฟังก์ชัน → `error.message` ว่าง ไม่มี `ERR_*` ให้แมป → voteClient เคยตก `load_failed` ("ระบบโหวตขัดข้อง") ทั้งที่ปัญหาคือยังไม่ล็อกอิน → **แก้:** `castPreorderVote` เช็ค session ก่อนยิง RPC (ไม่มี session → "กรุณาเข้าสู่ระบบก่อนโหวตเมนูค่ะ" ไม่ยิง RPC) + map 401 ว่าง/JWT/permission → signed_out — guard ฝั่ง server คงอยู่ครบ
- **Login เบอร์โทร (Owner: "เพิ่มวิธีเข้าระบบด้วยเบอร์โทรด้วย มีของเก่าเอามาใช้อยู่ที่แท๊บเข้าสู่ระบบด่วน"):** เปิดของเก่า `authStore.loginByPhone(phone, password)` (synthetic email `<phone>@phone.bmb.local` — ใช้ได้กับบัญชีที่เคยตั้งรหัสผ่าน) ให้ผู้ใช้จริง — แท็บ 3 ปุ่ม (📧 อีเมล · 📱 เบอร์โทร · ⚡ ด่วน) + ฟอร์มเบอร์+รหัสผ่าน → loginByPhone → finishLogin · error สงวนของหน้า (loginByPhone ไม่ตั้ง lastLoginError)
- **OAuth/Passkey ตรวจแล้ว (Owner: "ต้องใช้ได้"):** โค้ดฝั่ง client พร้อมทุกช่องทางตั้งแต่ R25 — Google/Facebook = built-in Supabase · LINE = Custom OIDC (รอ api line ตามสั่ง) · Passkey = browser detect — **BLOCKED รอ Owner ใส่ Client ID/Secret ใน Supabase Dashboard** (ฝั่ง server — ไม่ใช่งานโค้ด · ปุ่มแจ้งข้อความไทยไม่พังแม้ยังไม่ตั้งค่า)
- **Gates:** lint ✅ (587 ไฟล์ + brandNameGuard + languageSanity) · **vitest 224 files / 2391 tests PASS** (+3 R54: ไม่มี session ไม่ยิง RPC · 401 ว่าง/JWT → signed_out) · build ✅ (tsc + vite + PWA) — **รอ Owner ทดสอบ live กลุ่ม F (ตาราง BMB_REMAIN_TESTS_LIVE)**

**🔒 LIVE STATE 2026-11-18 (R53 — OWNER VERIFIED ✓ โหวตเมนู+สุ่มเมนู ซิงก์เมนูจริงและระบบโปรโมชันจากแอดมิน (ห้ามฮาร์ดโค้ด — ดึงของจริงทั้งหมด) · m208 APPLIED PROD ✓ · vitest 2388/2388 · Docker contract replay ALL_GREEN · CI 2/2 success):**
- **หน้าโหวต (Owner: "ห้ามมีฮาร์ดโค้ด ทุกอย่างลิ้งค์ดึงจากของจริงเท่านั้น"):** เดิม 3 บั๊กข้อมูลจริง — ①โหวต 1 ครั้ง = `createProduct()` สร้างสินค้าซ้ำใน DB ②% โหวตคำนวณจาก `prep_minutes` ปลอม ("0 โหวต (3%)" ในภาพ live) ③แต้มปลอม addPoints + สัญญา "5 แต้ม/แลกคูปอง" ที่ระบบไม่มี → **แก้:** ลบทั้งหมด + โหวตจริงผ่าน server RPC `preorder_vote_cast` (m208 ใหม่ ตามเจตนา m058) + ผลโหวตจริงจากตาราง `preorder_votes` + เพดาน/สถานะจาก `vote_policy` (business_settings — แอดมินคุม daily_limit) + แถบ "โปรโมชั่นที่กำลังรัน" จริงจากแอดมิน
- **หน้าสุ่มเมนู:** เดิมเมนู hardcode 6 ชิ้น + รูป unsplash (ไม่ใช่เมนูร้าน) → **แก้:** สุ่มจาก `getProducts()` จริง (!archived && is_available) · รูป/ราคาจริง · ปุ่มไปสั่ง = `/menu?category=<id>` (ถึงหมวดเมนูที่สุ่มได้) · แสดงโปรโมชันจริงที่ใช้กับเมนูนั้นได้ (scope ตามแอดมิน)
- **หน้าโปรโมชัน:** แสดงข้อมูลจริงครบตามแอดมินตั้ง — ภาพแบนเนอร์ (banner_image) · เมนูร่วมรายการ (attachPromotionScope — "เฉพาะเมนู: ชื่อจริง") · เพดาน max_discount_amount · สิทธิ์คงเหลือ (usage_limit−usage_count) · stackable — คง contract R12 (min-h/line-clamp)
- **m208 (APPLIED PROD ✓ — Owner ยืนยัน 2026-11-19):** `preorder_vote_status()` (anon ดูผลได้) · `preorder_vote_cast` (authenticated · advisory lock · ALREADY ก่อน LIMIT · !archived · Asia/Bangkok day · audit ทุกครั้ง · **ไม่แตะ points_ledger**) · seed `vote_policy {"enabled":true,"daily_limit":1}` (แอดมินปรับเพดานได้ที่ business_settings) · unique index identity + dedup · VERIFY_R208_OK ผ่านบน postgres:16 local
- **Gates:** lint ✅ · **vitest 224 files / 2388 tests PASS** (+32) · build ✅ · **Docker r48 replay ✅ R48_FULL_ALL_GREEN** (migrations 001-208 + contracts รวม 208 ใหม่) · **CI จริง 2/2 success** (Contract Tests #561 + CI #987) — **Owner live test ผ่าน ✓ (ยืนยัน 2026-11-19 "โอเคผ่าน Apply m208 ลง prod ให้แล้ว"): โหวตจริงบน prod · สุ่มเมนูจริง + deep link · โปรโชว์ครบทั้ง 3 หน้า**

**🔒 LIVE STATE 2026-11-18 (R52 — OWNER VERIFIED ✓ ตัวแบ่งแท็บ = หมวดจองล่วงหน้า · แท็บจองล่วงหน้าเฉพาะเมนูจองล่วงหน้า · vitest 2356/2356):**
- **แก้ผิดจากรอบ 51 (Owner: "จองล่วงหน้ามันจะไม่โชว์เมนูที่ไม่ใช่จองล่วงหน้า"):** R51 ตีความผิด "แสดงทั้งหมด" = ทุกเมนู → หมวด "ส่งวันนี้ / Same Day" ปนในแท็บจองล่วงหน้า · **R52:** ตัวแบ่งแท็บ = **หมวดจองล่วงหน้า** (`saleModeOfCategory` ตามชื่อหมวดที่แอดมินตั้ง) — แท็บจองล่วงหน้า = เมนูหมวดจองล่วงหน้าทั้งหมด (รวมยังไม่ลงปฏิทิน — ป้ายวันขึ้นเองเมื่อลง) · แท็บวันนี้ = เมนูหมวดอื่น — ทุกมุมมองกรองด้วยหมวดเดียวกัน (ชิป/รายการ/หัวข้อ/ตัวเลขแท็บ = ชุดเดียว `menuTabItems(..., categories)`)
- **แบนเนอร์ "จองล่วงหน้า (เมนูรอบพิเศษ)" อ่านไม่ออก (Owner: "สีขาวตรงปฏิทินมันอ่านไม่ออก"):** พื้นขาว hardcode `bg-blue-50` + ตัวอักษรฟ้าเข้ม → dark override พื้นฟ้าโปร่ง + ตัวอักษรฟ้าสว่าง (`preorder-banner` #93C5FD/#BFDBFE)
- **เทส:** menuTopTabs +2 (R52 แบ่งแท็บด้วยหมวด · contract MenuPage ส่ง categories) — เทสรวม 222 ไฟล์ / 2356
- **Gates:** lint ✅ (584 ไฟล์) · **vitest 222 files / 2356 tests PASS** · build ✅ — **Owner live test ผ่าน ✓ (ยืนยัน 2026-11-18 "โอเคผ่านแล้วปิดเซสซั่นได้"): แท็บจองล่วงหน้าเฉพาะเมนูจองล่วงหน้า · แท็บวันนี้ไม่มีเมนูจองล่วงหน้าปน · แบนเนอร์อ่านออกใน dark**

**🔒 LIVE STATE 2026-11-18 (R51 — แท็บจองล่วงหน้าแสดงทั้งหมด แทน R77 · vitest 2354/2354):**
- **แท็บจองล่วงหน้าว่าง (0) ทั้งที่มีเมนู 33 (Owner live):** R77 เดิมกรองแท็บจองล่วงหน้า = เฉพาะเมนูปฏิทิน + fallback วันแรก → ร้านไม่ลงปฏิทิน = แท็บว่าง ชิปหายเหลือ "ทั้งหมด" เดียว — **แก้ตามสั่ง R51:** แท็บจองล่วงหน้า = ทุกเมนูขายได้ รวมที่ยังไม่ลงปฏิทิน (การ์ดบอกสถานะเอง · พอแอดมินลงวัน/แก้เมนูใหม่ ป้ายวันขึ้นอัตโนมัติ) · `activeDay` เลิก fallback วันแรก (ยังไม่เลือก = ทั้งหมด) · เพิ่มชิป "🗓️ ทุกวัน" เลิกกรองกลับได้ (เดิมเลือกวันแล้วกลับไม่ได้)
- **เมนูป้ายปฏิทินไม่โชว์ซ้ำแท็บวันนี้ (คง R50):** same-day = เฉพาะไม่มีป้าย · จองล่วงหน้า = ทุกเมนู (สูตรเดียว list = ตัวเลขแท็บ — `menuTabItems` R51)
- **เทส:** menuTopTabs — เทส R77 แทนด้วย R51 + เทส R51 (ไม่มี isCalendar filter · activeDay ตรง · ชิปทุกวัน)
- **Gates:** lint ✅ (584 ไฟล์) · **vitest 222 files / 2354 tests PASS** · build ✅ — **รอ Owner live test (dark): แท็บจองล่วงหน้า (33) เมนูครบทุกหมวด + ชิปครบ + ชิป "ทุกวัน"**

**🔒 LIVE STATE 2026-11-18 (R50 — dark theme แท็บ/ชิปหน้าเมนูอ่านออก + หมวดหมู่แท็บกับชิปเป็นชุดเดียวกันทั้งหน้า · vitest 2353/2353):**
- **dark theme แท็บ/ชิปมองไม่เห็น (Owner รายงาน "เวลาเมาส์ไปจิ้มตัวอักษรอ่านไม่ออก" + รูปแท็บจองล่วงหน้าดำบนดำ):** แท็บใหญ่ inactive ไม่มี dark override เลย + ชิป hover เป็น `bg-orange-50` พื้นสว่าง hardcode → เพิ่ม dark/graphite override: `.menu-tab:not(.text-white)` (พื้นขาวจางโปร่ง + ตัวอักษร #F5F5F5 — active ไม่โดน) · `.category-chip:hover/:active` พื้นโปร่ง (ทับ Tailwind hover สว่างด้วย specificity ของ `html[theme] .class:hover`) · ปุ่มปิด InAppBrowserNotice hover → token `bg-brand-bg`
- **หมวดหมู่แสดงไม่เหมือนกัน (Owner: "จัดแยกหมวดหมู่สินค้าพรีออเดอร์กับเซมเดย์ให้ถูกต้องเหมือนกันทั้งหมด"):** สองช่องโหว่ — ① เดิมแท็บโหมดกรองเฉพาะมุมมอง "ทั้งหมด" (กฎ 2026-10-18) → กดเลือกหมวดแล้วเมนูปฏิทินหลุดไปแท็บวันนี้ ② `chips` อิงสินค้าทั้งแคตตาล็อก → หมวด "จองล่วงหน้า / Pre-Order" โชว์ในชิปทั้งที่แท็บนับ 0 (จุดที่เห็นใน 2 รูป) → **แก้:** แท็บโหมดกรองทุกมุมมอง + `chips = headingChips(categories, ordered)` อิงสินค้าในแท็บจริง — ชิป/รายการ/หัวข้อด้านล่างเป็นชุดเดียวกันทั้งหน้า
- **เทส regression +3:** menuTopTabs contract R50 (chips จาก ordered + tab filter ทุกมุมมอง) · themeCss +2 (menu-tab inactive override · chip hover พื้นโปร่ง) — เทสกฎเก่า 2026-10-18 ถูกแทนด้วยกฎ R50
- **ไม่แตะ:** Footer (เรียง displayRank L-7 ถูกแล้ว) · BottomNav · `menuTabItems` (สูตรนับแท็บ R77)
- **Gates:** lint ✅ (584 ไฟล์) · **vitest 222 files / 2353 tests PASS** (+3 จาก 2350) · build ✅ — **รอ Owner live test (dark): แท็บจองล่วงหน้าตัวอักษรขาวชัด · hover ชิปอ่านออก · เมนูป้ายปฏิทินไม่หลุดหมวดอื่นตอนแท็บวันนี้**

**🔒 LIVE STATE 2026-11-17 (R49 — UI fix 2 จุด: ลบเธียเตอร์ซ้ำ /shop + dark theme ปุ่ม ✕ และข้อความมองเห็นได้ · vitest 2350/2350):**
- **ลบเธียเตอร์ซ้ำก่อนโปรโมชั่น (Owner สั่ง):** เซกชัน "🍽️ Bite เลือกเมนูให้แล้ววันนี้" (`home-sec-bite-picks` จากรอบ 42) ซ้ำกับ FoodTheater ลำดับ 1 ของ /shop (หัวเดิม + popularItems ชุดเดียวกัน) → **ถอดออกแล้ว** + ลบ dead CSS `.mascot-pick-accent` — โรงละครเหลือจุดเดียว · ตรวจแล้วไม่มีเทส/scroll-target อื่นอ้าง id นี้
- **dark theme ปุ่ม ✕ ปิดมองไม่เห็นทุกจุด (Owner รายงาน):** `.flad-close` (แบนเนอร์โฆษณาลอย) + `.ob-close` (หน้าสั่งซื้อ OrderBuilder) เดิมตัวอักษร #1C1917 บนพื้นเข้ม #1B1B20 = ดำบนดำ ไม่มี dark override → เพิ่ม dark/graphite override พื้น rgba(255,255,255,0.16) + ตัวอักษร #F5F5F5 (hover แดงคงเดิม) · **ข้อความอ่านไม่ออก:** `.flad-notice` #B45309 → #FBBF24 + พื้น/เส้น amber โปร่ง · `.flad-coupon` chip พื้นหาย → พื้นโปร่ง + สีตามธีม · จุดที่ตรวจแล้วปกติไม่แตะ: theater-toggle (token สว่าง) · review-gallery-close (พื้นขาว) · ttb-close (btn-outline ส้ม)
- **เทส regression +4 ใน `themeCss.test.ts`:** dark/graphite ต้องมี override 4 คลาส + ห้ามสีดำ #1C1917 ใน override · /shop ห้ามมี home-sec-bite-picks/mascot-pick-accent กลับมา + FoodTheater ต้องอยู่
- **Gates:** lint ✅ (584 ไฟล์) · **vitest 222 files / 2350 tests PASS** (+4 จาก 2346) · build ✅ — **รอ Owner live test:** /shop เธียเตอร์จุดเดียว · dark: ✕ แบนเนอร์ลอย + ✕ หน้าสั่งซื้อเห็นชัด

**🔒 LIVE STATE 2026-11-17 (R44–R48b — แผนที่ทั้ง 3 ฝั่ง + ระบบพิกัดจริง + Rider history tabs · m207 APPLIED PROD · CI GREEN · รอ Owner live test กลุ่ม E):**
- **แผนที่ทั้ง 3 ฝั่งใช้งานได้จริงบน prod:** ① RiderMiniMap (ไรเดอร์+ลูกค้า /track) — บั๊ก render-order (mapRef=null ตอน Google init) แก้แล้ว (`4a38b8e`) + Leaflet/OSM fallback ทำงานจริง ② AdminLiveMap — เพิ่ม Leaflet/OSM fallback ตามต้นแบบ (`7110b7c` · `leafletLoader` lib กลาง SRI) — Google ล้มในเบราว์เซอร์ (key ถูกปฏิเสธ — ยังรอ Owner เช็ค Google Cloud Console ตามรอบ 45) ทั้ง 3 ฝั่งรอดด้วย OSM · เมื่อ key ผ่านกลับเป็น Google อัตโนมัติ ③ ปุ่ม "🌐 เปิดเว็บแผนที่" 2 จุดถอด `target="_blank"` (ไม่โดนหน้าติดตั้งแอป PWA) — Owner live ยืนยัน "นำทางกูเกิ้ลmap ใช้ได้แล้ว"
- **ระบบพิกัดจริงร่วมกัน 3 ฝั่ง (m180 APPLIED PROD):** ลบไรเดอร์ทดสอบจุด กทม. · `list_drivers()` กรอง tenant + คืน `last_seen_at` · ทุกจุดบอกอายุตำแหน่ง (เก่า >10 นาที = จาง/เทา ไม่อวด live · `positionFreshness.ts`) · Owner ยืนยันไรเดอร์จริง "พอล ไมท์ไดร์" ทำงานถูกต้อง (พิกัดใกล้ครัว สด) · **ไม่มีพิกัดฮาร์ดโค้ดใน production code** (ครัว = config/DB เดียว · ไรเดอร์ = GPS heartbeat จริง · ลูกค้า = RPC m174 ตรวจสิทธิ์) — audit หลักฐานครบใน AI_WORK_STATE รอบ 46
- **Rider history tabs (Owner 2026-11-17):** หน้า /rider แสดงเฉพาะงานวันนี้ + แท็บรายเดือนย้อนหลัง + สลับ anchor วันส่ง (scheduled) / วันมอบหมาย (assigned) ได้ · m207 APPLIED PROD (`my_deliveries` v3 — `scheduled_date` จาก `delivery_rounds` + filter params) · timezone-safe (Date.UTC)
- **⚠️ บทเรียน CI (R48b):** push รอบ 48 ล้ม CI Contract 135 (run 44086503471) เพราะ `CREATE OR REPLACE` คนละ signature = overload ambiguous (42725) + อวด "Gates 4/4" โดยไม่รัน SQL contracts — **แก้ + พิสูจน์จริง:** m207 (5 params REQUIRED + DROP 5-arg เก่า + verification กันเกม) · เครื่องมือใหม่ `e2e/ci/r48_contract_repro.sh` = replica CI ครบบน Docker postgres:16 ท้องถิ่น — รอบ 1 ล้ม 135+020 (evidence) รอบ 2 = **ALL_GREEN 30 contract** · **CI จริงหลัง push `15b5fc0`: Contract Tests + CI = success ทั้งคู่** · กติกาใหม่: แก้ RPC/SQL ต้องรัน r48_contract_repro.sh ก่อน push เสมอ
- **Gates:** lint ✅ (584 ไฟล์) · **vitest 222 files / 2346 tests PASS** · build ✅ · SQL contracts 30/30 (local replica) · CI 2/2 success
- **รอ Owner live test = กลุ่ม E ใน `docs/BMB_REMAIN_TESTS_LIVE_2026-11-15.md`** (rider tabs 5 ข้อ + แผนที่/นำทาง 2 ข้อ) — รายการเดิมรอบ 2 (A-4R/B-3/4/5) คงอยู่

**🔒 LIVE STATE 2026-11-15 รอบ 2 (R101-fix — A-4 hotfix · Owner live test รอบ 1 = 12/17 ผ่าน):**
- **ผล live รอบ 1 (Owner verified):** ✅ 12 ข้อ = A-1/2/3 · **B-1/2/6/7 (R97 ทำงานจริงครบ — history/cancel/guard)** · **C-1/2/3 (server timeline ข้ามเครื่องครบ)** · D-1/2 · ❌ **A-4 FAIL** (copy ปุ่มสีส้ม → Chrome ไม่มีตะกร้า) — หลักฐาน Owner: "เคยมีสินค้าแต่ในเบราว์เซอร์เฟซเอง" = Layout decode ถูกแล้วทั้งคู่ฝั่ง → ปัญหา = clipboard ข้าม WebView + payload โดน encode มั่ว
- **HOTFIX (Owner อนุมัติ):** ① Banner copy 3 ชั้น (clipboard→execCommand→**prompt**) + **กล่องลิงก์เต็มคัดลอกเองได้ทุก WebView** (`inapp-link-box`/`inapp-select-link`) ② `normalizeCartParam` (cartDeepLink) ถอด `%` มั่วถึง 3 ชั้น ใช้ทั้ง Layout+Banner ③ R43 B6/R61/§T-1 contract อัปเดต (เข้มขึ้น — ไม่อ่อนลง)
- **Gates หลัง hotfix:** tsc ✅ lint ✅ **vitest 217 ไฟล์ / 2291 tests PASS** (test ใหม่ `r101CartHandoffFix` 14 ข้อ) · build ✅ · **frontend only** (ไม่ต้อง deploy EF)
- **รอบ 2 = 5 ข้อ:** A-4R (retest) · A-5 · B-3/4/5 — คู่มือ = `docs/BMB_REMAIN_TESTS_LIVE_2026-11-15.md` (รายการเดียว แทน 11-08/09/10)

**🔒 LIVE STATE 2026-11-16 (R207b — ตัวลอยไม่วาดภาพนิ่งก่อนรู้ผล override · R207 ยืนยัน live แล้วจาก bundle จริง · vitest 2295/2295):**
- **R207b CODE_CLOSED + PUSHED:** ตัวลอย BiteMascot เดิมวาดภาพนิ่ง `bite_sad/empty_sad` (ชุดร้านปิด) เป็น src แรกแล้วสลับเป็น GIF แอดมินเมื่อ override โหลดเสร็จ = "ภาพนิ่ง sad → มาสคอตแอดมิน" ทุกครั้งที่เปิดหน้า (Owner ชี้ 2026-11-16) → **แก้:** `overrideSettled` — ยังไม่รู้ผล override = ไม่วาดภาพ (placeholder) · settle: มี override = รูปแอดมินเฟรมแรก · ไม่มี = ภาพนิ่งตามชุดท่า (ดีไซน์ร้านปิดเดิม)
- **R207 ยืนยัน live แล้วจากหลักฐานจริง:** bundle `index-D7hQ6ryX.js` บน https://biteme-baby.com มี LoadingSpinner = spinner ล้วน (ไม่มี MascotBadge) — จอโหลดกลางจอที่เห็นในภาพ 12:23 = build เก่าจาก service worker → ต้อง hard refresh / SW update
- **Gates 4/4** — tsc ✅ lint ✅ **vitest 217 files / 2295 tests PASS** (`e2e/_r207b_vitest_full.log`) · build ✅

**🔒 LIVE STATE 2026-11-16 (R207 — ถอด mascot ภาพนิ่งออกจากจอโหลด · R206 ผ่าน live แล้ว · vitest 2294/2294):**
- **R207 CODE_CLOSED + PUSHED:** จอโหลด (`LoadingSpinner` App.tsx — Suspense/auth-init ทุก route) เคยเรนเดอร์ `MascotBadge pose="ready"` + `animate-bounce` = ภาพนิ่งเด้ง → สลับเป็นรูปแอดมินเมื่อ override โหลดเสร็จ (กระพริบผิดตา · Owner รายงาน 2026-11-16) → **ถอด mascot + import ออก** เหลือ spinner (`animate-spin`) + ข้อความเดิม · mascot ทุกตัวแสดงหลังโหลดเสร็จเสมอ · test lock 3 ข้อใหม่ (r206 file) · call site/testid เดิมครบ
- **R206 ยืนยัน live แล้ว (Owner: "ทำได้แล้ว")** — Mascot Self-Service ใช้งานจริง: bucket `Bite_Mascot` + preview + upload + live refresh
- **Gates 4/4** — tsc ✅ lint ✅ **vitest 217 files / 2294 tests PASS** (`e2e/_r207_vitest_full.log`) · build ✅

**🔒 LIVE STATE 2026-11-15 (R206 — Mascot Self-Service ใช้งานได้จริง: bucket `Bite_Mascot` APPLIED PROD + preview/upload/live-refresh · vitest 2277/2277):**
- **R206 ปิดครบ + M206 APPLIED PROD (verified=true · bucket_public=1 · policy_count=4):** บั๊กจริงจากภาพจอ Owner — bucket `Bite_Mascot` (Owner สร้างเอง + อัปโหลด Bite_main.gif) ไม่มี policies ในโค้ด · หน้าแอดมินบันทึกแล้ว fail เงียบ (ไม่เช็คผล RPC) · ไม่มี preview · mascot โหลด URL ไม่ได้ = silent-fallback รูปเดิม
- **แก้:** Migration 206 (bucket public + mime GIF/PNG/WebP/JPG ≤15MB + policies 4 ตัว pattern 119 — public read · admin-only write) · `mascotService.ts` (MASCOT_BUCKET + validateMascotFile + uploadMascotAsset + listMascotBucketFiles + event live-refresh · withDeadline ครบ 4) · MascotBadge/BiteMascot ฟัง event เปลี่ยนรูปทันทีไม่ต้อง deploy · MascotSettingsPage (preview + error state + save feedback ✅/❌ + อัปโหลดตรง + ↩ ค่าเริ่มต้น + quick-pick)
- **Gates 4/4** — tsc ✅ lint ✅ **vitest 216 files / 2277 tests PASS** (`e2e/_r206_vitest_full.log`) · build ✅ · Evidence: `e2e/_r206_apply.json` · สคริปต์ `e2e/_r206Apply.cjs`
- **รอ Owner live test:** อัปโหลด GIF จาก /admin/settings → preview → 💾 → mascot หน้าร้านเปลี่ยนทันที (ไม่ต้อง deploy)

**🔒 LIVE STATE 2026-11-15 (R101 — R96/R97 ปิดครบ + M205 APPLIED PROD + EF deployed · "รวมใช้บริบทเดียวกันทุกช่องทางและรับต่อเนื่องกัน" ตามคำสั่ง Owner):**
- **R97 (Order memory + cancel/modify ผ่าน AI) — ปิดครบ + APPLIED PROD + DEPLOYED:** พิสูจน์จากโค้ดว่า **R97 เดิมไม่เคยทำงานจริง** (ยิง PSID ที่ `orders.customer_id` = auth uuid ไม่ match + select คอลัมน์ไม่มีจริง `items/total/order_id` = 400 ตาย 3 ชั้น · cancel PATCH ตรง bypass canonical · modify มี heuristic อันตราย "ชื่อเมนูในคำตอบ → ทับ x1") → **แก้+ออกแบบใหม่:** **Migration 205 APPLIED PROD** (`cancel_order_as_customer` = identity-guarded + เรียก canonical `cancel_order` 025/195 ภายใต้ JWT claims ลูกค้า = release capacity/inventory/void/audit ครบ · `social_timeline_for_web` = บริบทข้ามช่องทางฝั่งเว็บ) · `orderMemory.ts` ใหม่ (resolve PSID→customer_ref ผ่าน 046 + query ถูก schema + order_items จริง + **ลบ modifyOrder**) · worker: history + cancel (order_number · เฉพาะ pending ล่าสุด) + `runModifyIntake` (extract→match→ยืนยัน→cancel+สร้างใหม่ผ่าน intake — แนวเดียวกับเว็บ) + แจ้งแอดมินเมื่อ cancel สำเร็จแต่ create fail (ห้ามลูกค้าไม่มีออเดอร์เงียบหาย)
- **R96 P2 (เว็บรับบริบทต่อเนื่องจาก server) — ปิดครบ:** `socialTimelineClient.ts` (RPC `social_timeline_for_web` · fail = []) + TalkToBite โหลด server timeline เมื่อล็อกอิน → **ทุกเครื่องเห็นบริบทเดียวกัน** (เดิมมีแค่ sessionStorage ของเครื่องเดียว)
- **G6 contract อัปเดต (Owner 2026-11-15 · เข้มขึ้นไม่ใช่อ่อนลง):** ห้ามเรียก `cancel_order` ตรง — ผ่าน wrapper 205 เท่านั้น + บังคับ resolve identity ก่อน history + pending-only + graph URLs ห้ามมี order fields
- **Evidence:** `e2e/_r205_apply.json` (http=201 + verify functions) · `_r205_verify_grants.json` (grants ถูกต้อง — wrapper=service_role เท่านั้น) · `_r205_probe.json` (**PROBE_OK=true** — runtime guard จริง) · `_r205_live_check.json` (**R205_LIVE_CHECK_OK=true** — EF `social-ai-worker` **v86 ACTIVE** + DB ตรวจซ้ำครบ) · deploy exit=0
- **Gates 4/4** — tsc ✅ lint ✅ **vitest 215 ไฟล์ / 2257 tests PASS** (`e2e/_r97_vitest_full2.log`) · build ✅
- **OMNI-5 ปลด BLOCKED แล้ว** (Owner 2026-11-15 ยืนยันยกเลิกหลายครั้ง · ผ่าน live มาแล้วตามบล็อก 2026-11-08)
- **รอ Owner live test = `docs/BMB_REMAIN_TESTS_LIVE_2026-11-15.md` (ฉบับเดียว แทน 11-08/09/10)** — กลุ่ม A (§T-A/R100 5 ข้อ) · B (R97 7 ข้อ) · C (R96 P2 เว็บ 3 ข้อ) · D (grounding สด 2 ข้อ) + ตารางบันทึกผลพร้อมกรอก

**🔒 LIVE STATE 2026-11-14 (R100e + R100d + R100c):** R100e — แบนเนอร์ in-app ปิดมีอายุ 24 ชม. + ลิงก์ `?cart=` ใหม่แจ้งเสมอ · R100d — copy ลิงก์จาก FB in-app ไป Chrome มีตะกร้าเสมอ (snapshot localStorage + แบนเนอร์ fallback + guardrail `cart_link_missing`) · R100c — การ์ดรีวิวลดความสูง + avatar ทึบ · CODE_CLOSED + PUSHED (`67edd6a`/`733b220`/`4e86e0b`) · vitest 214 files / 2238 tests PASS · รอ Owner live test (ย้ายไป test pack 2026-11-15)

**🔒 LIVE STATE 2026-11-13 (R98 + R96 + Migrations 203/204 APPLIED PROD):**
- **R98** — InAppBrowserBanner ปรับข้อความ + ปุ่มติดตั้งแอป PWA: **CODE_CLOSED + DEPLOYED + LIVE TEST 5/5 PASS** (2026-11-13 08:41) · Gates 4/4 ✅
- **R96** — AI Grounding + Cross-Channel Context + Data Freshness: **CODE_CLOSED + DEPLOYED + MIGRATIONS 203/204 APPLIED PROD** (2026-11-13 09:15) · Gates 4/4 ✅ (214 files / 2238 tests PASS)
  - Phase 1: `socialGroundingData.ts` (fetchGroundingData 30s cache) · `social-ai-worker` เรียกทุกครั้ง · `grounding_data` + `reply_draft` columns (mig 203)
  - Phase 2: `socialHandoff.ts` (`ExtendedSocialHandoff` + `timeline`) · `user_post_context` table (mig 203)
  - Phase 3: `productCache.ts` (7-min TTL + `invalidateProductCache()`) · AdminProducts เรียก invalidate
- **Migration 203**: `social_events.grounding_data` (jsonb), `reply_draft` (text), `user_post_context` table
- **Migration 204**: `social_events.customer_id`, `last_order_id`, `order_history` (jsonb), `review_content` sync marketing_posts
- **Edge Functions**: `social-ai-worker` DEPLOYED exit=0

**🔒 LIVE STATE 2026-11-12 รอบ 19 (R95 — โฟลตติ้งข้อความอ่านได้ + รูปไดคัทโปร่ง):** CODE_CLOSED + PUSHED — Gates 4/4 ผ่าน (vitest ✅ 7 tests) · **R95:** `.flad-card` พื้นหลังต้องไม่โปร่ง (ข้อความอ่านได้) · `.flad-media` ปล่อยโปร่ง (รูปไดคัท) · push `3f07160..f44fb09` · **รอ owner:** Hard Refresh (`Ctrl+Shift+R`) หรือรอ deploy

**🔒 LIVE STATE 2026-11-12 รอบ 17 (R93 · คิวอนุมัติว่างเงียบ + โพสต์รออนุมัติ แก้ไข/ลบ):** CODE_CLOSED + PUSHED — Gates 4/4 ผ่าน (tsc/lint/vitest **2237 tests**/build ✓) · **root cause พิสูจน์ DB จริง** (`e2e/_r93_probe2.cjs`): `content_approvals` ไม่มีคอลัมน์ `reviewer_id` (จริง = `reviewed_by`) — listContentApprovals select ผิด → 400 เงียบ → **กล่องอนุมัติว่างเสมอ** → อนุมัติไม่ได้ → ตั้งเวลาไม่ได้ (RPC บังคับ approved ถูกต้องตาม G1-G3) · **แก้:** ① select/interface → `reviewed_by` + ไม่กลืน error เงียบ (console.warn) ② ปุ่มใหม่ **"✏️ แก้ไข" + "🗑 ลบ"** (confirm + ลบคู่คิวอนุมัติ) ในแท็บตรวจ&อนุมัติ (แถว pending ที่ผูกโพสต์) + แท็บตั้งเวลาเผยแพร่ (pending_approval/draft) · แก้ไข = โหลดกลับฟอร์ม (แถบกำลังแก้ไข + ยกเลิกได้) บันทึกแล้ว **ยังรออนุมัติเหมือนเดิม** ห้ามเลี่ยงคิว · ห้ามลบ/แก้ scheduled/published · ฟังก์ชันใหม่ adminMarketing: deleteMarketingPost/updateMarketingPostDraft/updateContentApprovalDraft (RLS admin write มีอยู่ — ไม่ต้อง migration) · แก้ผู้ใช้ interface 2 จุด (ApprovalHistoryTab/ContentTab "ตรวจโดย") · **รอ deploy + owner live test:** คิวโชว์ "ข้าวลาบอกไก่ไข่ต้ม" → อนุมัติ → ตั้งเวลาได้จริง → แก้ไข/ลบใช้ได้

**🔒 LIVE STATE 2026-11-11 รอบ 16 (R92 · ลิงก์โซเชียลใช้ได้จริง + บริบทเดียวกัน 3 ช่องทาง โพส/ข้อความ/เว็บ):** CODE_CLOSED + **EF `social-ai-worker` DEPLOYED exit=0** (`e2e/_r92_deploy.log`) — Gates 4/4 ผ่าน (tsc/lint/vitest **2234 tests**/build ✓) · **Step 0 หลักฐานจริง** (`e2e/_r92_step0.md`): สะกดเพี้ยน = โมเดล deepseek เขียนเอง (แคตตาล็อกถูกหมด — task แยก aiPolicy) · reply ไม่มี ?cart= = branch unmatched>0 ยืนยันจาก social_events จริง · **Step 1**: ลบ intent:// ออกจากแบนเนอร์ถาวร (ภาพ 3 ERR_UNKNOWN_URL_SCHEME — ห้ามกลับมาใส่ R76/R79/R81-B2) ปุ่มหลักเดียว = "📋 คัดลอกลิงก์ · เปิดใน Chrome / Safari" + guide 3 เส้นทาง (Messenger/iOS/Android FB) + สำรองทุกเครื่อง "วางใน Chrome / Safari" · **Step 2**: `cartFooterForMatch` — ลิงก์ตะกร้าติดทุก reply ที่จับคู่ได้บางส่วน (ลิงก์เฉพาะรายการ matched + ระบบแจ้งของที่ยังไม่รวม + AI ถามยืนยัน ห้ามสั่งแทน) · **Step 3**: `?s=` บริบท "ระบบเขียน" (ช่องทาง+โหมด+ชื่อ matched ≤200 · reject URL) — `buildSocialSummary`/`encodeContextParam` (server) ↔ `decodeSocialContextParam` (web) — Layout จับก่อน strip → TalkToBite inject "ต่อจากที่คุยกันในMessenger: <summary>" · **Step 4**: ห้าม register SW ใน in-app browser + unregister/ล้าง caches ทั้งหมดที่นั่น (`injectRegister:'manual'` + guard ใน main.tsx) = เฟสโหลด build ใหม่เสมอ (แก้ "UI เก่าค้างถาวร" 2026-10-26) · **Step 5**: regression guard ห้าม intent:// + เทสต์ round-trip ?s= ครบ · **รอ owner live test:** ① โพส→ลิงก์ไม่พัง→คัดลอก→Chrome→ตะกร้า ② Messenger→reply มี ?cart= เมื่อจับคู่ได้ ③ Bite AI เว็บพูดต่อจาก FB ได้ ④ ในเฟส build ใหม่เสมอ

**🔒 LIVE STATE 2026-11-11 รอบ 15 (R91 · Messenger escape + บริบท FB → Bite AI เว็บ):** CODE_CLOSED + PUSHED (`e3c0be7`) — Gates 4/4 ผ่าน (tsc/lint/vitest 214 files / 2224 tests PASS/build ✓) · owner live test: เม้นใต้โพส ✅ ออกได้+ตะกร้าเติม, ข้อความ Messenger ❌ ออกไม่ได้ → **แก้:** แบนเนอร์เพิ่มปุ่ม 📋 คัดลอกลิงก์ (clipboard→textarea fallback) + แผงแนะนำทางเฉพาะ Messenger (intent:// โดนบล็อกในนั้น → เมนู ⋯ "เปิดในเบราว์เซอร์"/แชร์→Safari, JS force-escape ไม่ได้ = ข้อจำกัด platform พิสูจน์แล้ว §R81), rename "เปิดใน Chrome" → **"เปิดใน Chrome / Safari"** ตามสั่ง · **context ต่อเนื่อง:** lib ใหม่ `socialHandoff.ts` — Layout จับ `?cart=`+referrer/UA → sessionStorage, TalkToBite inject "ต่อจากที่คุยบน Facebook/Messenger + รายการที่สรุปไว้ (ชื่อจากตะกร้าจริงเท่านั้น)" เข้า runtimeContext ทุกข้อความ · test ใหม่ socialHandoff.test.ts + contract r46LinkOut · **รอ owner live test: ทัก Messenger → กดลิงก์ → คัดลอก/⋯ ออก Chrome/Safari → เปิด Bite AI ถามต่อ ต้องรู้เรื่องที่เคยคุย**

**🔒 LIVE STATE 2026-11-11 รอบ 14 (R90-hotfix · ลิงก์ AI จาก Facebook → เว็บพัง React #310):** CODE_CLOSED + PUSHED — Gates 4/4 ผ่าน (tsc/lint/vitest: 213 files / 2216 tests PASS · build ✓) · **ยอมรับ:** R90 ตัวแรก (`1f50e05`) วาง `useState`/`useEffect` หลัง early return ของ InAppBrowserBanner → hook count ไม่เท่ากันระหว่าง render = **Minified React error #310 พังทั้งเว็บทันทีที่ลูกค้ากดลิงก์** (ตรงกับภาพ owner: โพสต์ "ไก่ตอน" ลิงก์ ?cart= → จอ error) · **แก้:** hooks ทุกตัวไว้ก่อนทุก return (กฎถาวร + regression test ใหม่ใน r46LinkOut assert ลำดับ hooks + ห้าม `atob(`), อ่าน ?cart= ตอน mount ด้วย lazy useState initializer (ก่อน Layout strip) ผ่าน `decodeCartParam` ตัวเดียวกับ Layout, intent URL/openExternally สร้างจาก handoff URL ที่ใส่ `?cart=` กลับถ้าถูก strip (FB WebView↔Chrome ไม่แชร์ localStorage — ลิงก์คือสะพานเดียว), ลบ console.log ใน render · owner ทดสอบ live: กดลิงก์จากโพสต์ → หน้าต้องไม่ขาว → กด "เปิดใน Chrome" → ตะกร้าตามไป

**🔒 LIVE STATE 2026-11-11 รอบ 13 (AdminMarketing Tab Restructure):** CODE_CLOSED + PUSHED — Gates 4/4 ผ่าน (lint/tsc/build/vitest: 213 files / 2215 tests PASS) · **แก้ไข:** เปลี่ยน tab types/IDs (`calendar`→`schedule`, ลบ `ai`): ปรับ labels ทั้งหมดเป็นภาษาไทยธรรมชาติ, approval list แสดง typeIcon/typeLabel (📝 โพสต์ทั่วไป, 🎁 โปรโมชั่น, 🖼️ แบนเนอร์, 📢 ประกาศ), schedule tab header ลบศัพท์เทคนิค E5/E6/CNT-01, อัพเดท toast messages หลังสร้างโพสต์/อนุมัติ, เพิ่มปุ่ม "⏰ ตั้งเวลาเลย" ใน approval card เมื่ออนุมัติแล้วแต่ยังไม่มี scheduled_for, test pack อัพเดท "หน้า 6 แท็บ" (ลบ ai, rename calendar→schedule) · รอ production deploy และ owner ทดสอบ live

**🔒 LIVE STATE 2026-11-11 รอบ 12 (InAppCart Continuity Plan):** CODE_CLOSED — **push แล้ว + deploy เสร็จ** · Gates 4/4 ผ่าน (lint/tsc/build/vitest: 213 files / 2215 tests PASS) · Fixes: FloatingAdBanners comment `max 2→3` · useInAppBrowser.ts ขยาย UA detection LINE/IG + InAppPlatform type + iOS alert→toast DOM · InAppBrowserBanner.tsx เพิ่ม ?cart= decode + UX messages (X รายการในตะกร้า/แนะนำลิงก์) + debug console.log · **§T-A เดิม (cart retry)** ยังรอ hard reload retest บน live (`https://biteme-baby.com`)

**⏳ LIVE RETEST 2026-11-11:** **§T-A เดิม (cart retry 2.5s `c9f77aa`)** ยังรอ hard reload retest บน live (`https://biteme-baby.com`) — โค้ด deploy แล้วตั้งแต่ 2026-11-10 แต่เจ้าของยังไม่ได้ retest ยืนยันผล

**⚡ LIVE-TEST 2026-11-10 (Owner verified 16:37 · `BMB_REMAIN_TESTS_LIVE_2026-11-10.md` · HEAD `2263b67` · bundle `assets/index-Bh_24aFF.js`):** ✅ **PASS 7/7** = IMG-GEN ✅ · D4 ✅ · R91 ✅ · R92-G ✅ · **D2 ✅** (SAME_DAY prompt fix) · **D5 ✅** (post day/round details) · **R92-S ✅** (auto-compress 300×300/100KB) — **เหลือ Live Retest: §T-A เท่านั้น** (cart retry 2.5s · `Layout.tsx` · hard reload `https://biteme-baby.com`) · Migration 201 APPLIED PROD · Edge Functions `social-ai-worker` DEPLOYED exit=0 · gates 4/4 (tsc/lint/vitest/build = 0) · **RT-8 ยังห้ามปิด** (meta-rule: นับเมื่อ RT-1..7 จบ) · ของปิดแล้ว/มีหลักฐานผ่าน = ไม่อยู่ในนี้

**LIVE-TEST 2026-11-08 บ่าย (RT-INTAKE · ผล Owner จากหน้าร้าน + ภาพแนบ · บันทึกครบใน `docs/BMB_REMAIN_TESTS_LIVE_2026-11-08.md` ตารางผลรายข้อ):** **PASS 16 ข้อ** = RT-1.1/1.2/1.3 (retest R82g ทางคอมเมนต์+แชต+lead time) · RT-2.1 (พิมพ์ 4 ใบ) · RT-3.1/3.2/3.3/3.5/3.6/3.7 (Manage Orders + จบโซ่โพสต์) · RT-5.2 (draft ไม่สร้างออเดอร์) · **§T-B/C/D/E ผ่านหมด** · **CAP-10 ยืนยันรันได้** · **OMNI-5 ผ่านบน live = ปลด BLOCKED** (follow-up: ตรวจรายการใหม่ให้ตรงจริง) — **D1 ปิดครบทุกชั้น: R83 แผง (`d305dc7`) + R84 โค้ด void (`5573d2b` · gates 4/4 — `e2e/_r84c_gates.log`) + R85 APPLIED ลง PROD (Owner อนุมัติ · verify จริงครบ: enum มี `void` · 4 ใบ = `void` · stale = 0 · `cancel_order` มี void-close — หลักฐาน `e2e/_r85_apply.log`):** ต้นตอ = แผงไม่กรองออเดอร์ `status='cancelled'` + `cancel_order` ไม่แตะ `payment_status` (ค้าง `pending` = pill โกหก) (guard `162_admin_reject_payment.sql:25` `ERR_ORDER_CLOSED` คงเดิม ห้ามทำให้อ่อน) → **R83 = filter `o.status !== 'cancelled'` ที่ `AdminOrders.loadOrders` + `SlipReviewPanel` (`delivered` คงอยู่ = COD) · R84 = เพิ่ม enum `payment_status='void'` (mig 194) + `cancel_order` ตั้ง void ตอนยกเลิกเมื่อไม่มีหลักฐานเงินเข้า + backfill (mig 195) + badge/label/classify ทุกจุดแสดง "void — ยกเลิก ไม่เก็บเงิน" (kind `OK_VOID` attention:false) · R85 = ยิง 194→195 ผ่าน Management API `POST /database/query` (PAT `.env.local` · equivalent กับ SQL Editor) · เทสต์ใหม่ 5 ข้อรวม · **⚠️ สถานะนี้เก่าแล้ว — ดู 2026-11-10 ข้างต้น** · **FAIL 3 ข้อ open = D2–D4 (two-try รอแชทหน้า) → ✅ ปิดแล้ว 2026-11-10** · **ยังไม่รัน ≠ PASS (อัปเดตค่ำ: RT-5.5–5.7 + CAP-11 = PASS ปิด · §T-A = FAIL → โค้ด deploy แล้ว รอ retest):** RT-4 · RT-6 · CAP-14+7/8/13/16/17/19...

**รอบนอกเวลาทำการ 2026-11-08 ค่ำ (~20:56–21:30 น. · RT-INTAKE · Owner รันเอง + ภาพแนบ · ผลรายข้อครบ = `docs/BMB_REMAIN_TESTS_LIVE_2026-11-08.md` หัวข้อ "รอบนอกเวลาทำการ"):** ✅ **ปิดรอบนี้: D1 (RT-3.4 retest = 4 ใบ void · แผงว่าง) · D3 (จำนวนถูก · ออเดอร์ทดสอบยกเลิกแล้ว = งานบ้านปิด) · RT-1.4 (ช่วงปิดร้าน — ปิด DEFERRED) · R86+R87 ①–⑥ retest · RT-5.5–5.7 + CAP-11 (Owner: "ผ่านแล้ว อนุมัติปิดงาน")** · ⛔ **Owner waived: RT-6.1 E1 ("ไม่เป็นไรไม่ต้องทำ") = ไม่นับเป็น PASS** · ❌ **FAIL ค้าง = D2 (SAME_DAY ยังผิด "รอบเดียว 11:00-15:00 น." · PRE_ORDER ถูกแล้ว) · D4 (ลิงก์ยังเปิด in-app ทั้ง DM/คอมเมนต์) · D5 (โพสต์ไม่มีรายละเอียดวัน/รอบ) · §T-A (ลิงก์ `?cart=` ยังในบราวเซอร์เฟซ + ไม่มีสินค้าใส่ตะกร้า) · D9 ✅ ปิด (m200 ทำงานจริง — 23:37 น. ส่งรีวิวสำเร็จ + คิวแอดมินขึ้นจริง · history 200) · D7 ✅ · D8 ✅ · **D6 ✅ ปิด (Owner "ผ่านตามรูป" 23:40 — ⑦⑧⑨⑩ ผ่าน) · **R89b 🟡 แก้ถูกหน้าแล้ว (2026-11-09 ต่อแฮนออฟ)**: ตัด `<VerifiedReviewsSection>` ออกจาก `HomePage.tsx` (`/shop`) + ยุบเข้า `ReviewCarouselSection` ตามมติ Owner **"ข้อ ก = รวมทั้งสองเซต"** (curated + DB อนุมัติแล้ว · กรอง `status='approved'` · กันการ์ดซ้ำ) · การ์ดทุกใบมี **โลโก้ `/Logo_Sticker_Circle.webp` + ดาว `Star.webp` 3D จริง** · **gates 4/4 รันครั้งเดียว = tsc 0 · lint 0 · vitest 0 · build 0** (`e2e/_r88_final_gates.log` · `dist` 11:23:57) — **ยังไม่ปิด: รอ push + Owner hard reload `/shop` รีเทสต์** · เดิมทำแล้ว (ยุบ 2 เซคชันรีวิวเป็น "📸 รีวิวจริงจากลูกค้า" + โลโก้/ดาวในการ์ด · แก้บั๊ก `\u2B50` ค้าง · รอรีเทสต์)** · ⏳ **ยังไม่รัน: RT-4 · RT-HOURS · RT-6.2 · RT-6.3 · RT-6.4B2 (~11:00) · CAP-14 + CAP 7·8·13·16·17·19** · **RT-8 = ยังห้ามปิด (มี FAIL ค้าง)** · Next = **สถานะ 2026-11-09 จบครบชุด**: ① R89b/c (ยุบรีวิว + รีวิวอนุมัติขึ้นก่อนสุด + จิ้มสั่งได้) ② **FIX verified ไม่ขึ้น = root cause `RPC ไม่คืน field status` → filter กรองทิ้ง 100%** (แก้แล้ว · commit `d9e975d` · gates 4/4 · frontend deploy `index-Di6k-coL.js`) — ไม่ใช่ migration (m199 apply แล้ว พิสูจน์ด้วย Management API: มีรีวิว approved จริง 1 ใบ) ③ two-tr...

**R88 (2026-11-08 ค่ำ · ปิด D6 ทั้งเส้น + คำสั่งใหม่ Owner เรื่องคิวอนุมัติ · CODE_CLOSED · gates 4/4):** probe prod READ-ONLY 4 รอบ (`e2e/_r88_probe*.cjs`) เจอ **ต้นตอ 2 ชั้น** — ① `ReviewPage.tsx` path ไม่มี productId คืนก่อน `setLoading(false)` → `/reviews` ค้าง + ไม่มี path โหลดฟีดทั้งหน้า ② **prod `reviews` = 8 คอลัมน์ 0 แถว — ไม่มี `order_number`/`branch_id`/`product_name_display`** (m093 อยู่ใน history แต่ ALTER ไม่เคยถูก execute → m099/m198 RPC พังตอนรัน) · `admin_portfolio_items` = 0 แถว (ไม่ใช่ RLS) · ไม่มีตาราง `portfolio` · **ระบบแต้มจริงทำงานอยู่** (trigger loyalty + `points_ledger` 4 แถว + catalog 4 → D6e ของเดิมพอ) → **แก้:** D6a `loadReviewsFeed` (โยน error = R21d) + หน้ารวมจบโหลด · D6b state จริง (toast คิวอนุมัติ · badge pending · reply จากร้าน) · D6c อัลบั้ม = `REAL_REVIEW_PHOTOS` 32 ใบจริง (คอลัมน์ `photo_url` ไม่มีจริง) · D6d CTA track → `/reviews/<product_id>` ต่อรายการ · **D6f ใหม่ = `supabase/migrations/199_review_moderation.sql`** (คอลัมน์ที่หาย + `status`/`reply` + RLS เฉพาะ approved/ของตัวเอง + drop UPDATE-own + batch RPC เฉพาะ approved + submit คงกติกา m198 ครบ + `status='pending'` + ชื่อเมนู) + **หน้า `/admin/reviews`** (แท็บคิว + อนุมัติ/ปัดตก/ลบ/ตอบ · `bmbAdminApi_reviews.ts` + nav `⭐ อนุมัติรีวิว`) · **เทสต์ใหม่ 13 ข้อ (`r88ReviewModeration`) · gates = tsc 0 · lint 0 · vitest 223 ไฟล์/2,280 tests 0 fail (`e2e/_r88_vitest.log`) · build 0 (`_r88_build.log`)** · **✅ APPLIED m199 ลง prod แล้ว (Owner อนุมัติ · verify ALL_OK · history 197/198/199 · legacy policy 4 ตัวหละหลวมถูก drop: `reviews_anon_read`/`reviews_public_read`/`reviews_own_update`/`reviews_own_insert`) + push `d20a0e8`/`236efbf` → live 5/5 markers (`e2e/_r88_live_check.cjs`) → Owner retest ⑦⑧⑨⑩ ได้ทันที** (`docs/BMB_REMAIN_TESTS_LIVE_2026-11-08.md`)

**SESSION CLOSED 2026-11-08 เย็น (Owner สั่ง "ห้ามโค้ดแล้วเคลียร์งาน ปิดเซสชัน อัพเดทเอกสาร วางแผนให้แชทหน้าทำต่อโดยไม่หลุด/ไม่ทำซ้ำ"):** **R87b = CI Contract Tests ซ่อมแล้ว** — บั๊กจริง: m197 คัดลอก fn แล้วทำ `WHILE v_hop_from <> v_target` หล่น → ไร้ bound → `ERR_DELIVERY_SYNC_BLOCKED delivered -> <NULL>` (contract 163 จับได้ · prod เสีย ~40 นาที) → fix + regression test + re-apply ลง prod + verify `bounded_loop=true` + push **`0b0a6a0` GREEN ทั้ง Contract/CI** (`d0d17b4` = incident log) · **D6 เปิดใหม่ (R87 retest ล้ม): หน้า `https://biteme-baby.com/reviews` ค้าง "Loading reviews..." ถาวร (`ReviewPage.tsx` `if (!productId) return` คืนก่อน `setLoading(false)`) + verified list/รูปอัลบั้มผลงาน/Admin Portfolio ว่าง + ปุ่ม "เขียนรีวิว" หน้า track ลิงก์ไปหน้าไม่มีข้อมูล + Owner อยากผูก "เมนู + ระบบโปรโมชั่น"** → **งาน R88 (แชทหน้า) = probe prod READ-ONLY (นับแถว `reviews`/`admin_portfolio_items`/`portfolio` + RLS) → แก้ path หน้ารวม + display ข้อมูลจริง + เช็ก CTA ทุกทางเข้า + ถาม Owner เรื่องผูกโปรโมชั่น 1 ข้อ — ห้ามสร้างระบบรีวิว/โปรโมชั่นใหม่ซ้ำ (ของเดิมครบ: `reviewApi` · RPC m099 · m198 · G&R m150–156 · `/rewards`)** · แผนเต็ม = `AI_WORK_STATE.md` หัวไฟล์ "⛔ R88 PLAN" · retest list = `docs/BMB_REMAIN_TESTS_LIVE_2026-11-08.md` (⑦⑧⑨) · carried: D2→D3→D4 (two-try) · D5 · RT-1.4 (ปิดร้าน) · RT-4/5.5–5.7/6 · §T-A · CAP-11/14+7/8/13/16/17/19 · RT-8 ห้ามปิด


**R82 (2026-11-08 · ผล Owner ทดสอบ live: "เอไอตอบเม้นไม่มีเตือนถึงลูกค้า(มีแค่แอดมิน) · ข้อมูลยังผิด ไก่ทอดเลยรอบพรีออเดอร์แล้วแต่ใส่ตะกร้าให้ · ถ้าเลยรอบให้แนะนำเมนูที่ยังสั่งได้" · commit `6b55407`):** **CODE_CLOSED · gates 4/4 (tsc 0 · lint 0 · vitest 220 ไฟล์/2,239 tests 0 fail · build 0 — `e2e/_r82_gates.log`) · EF DEPLOY 4 ฟังก์ชัน exit=0 (`_r82_deploy.log` 03:30Z) + smoke 200 (`_r82_smoke.json`)** — **Evidence READ-ONLY 5 ชุด** (`_r81b/_r81c/_r81d/_r81e/_r82f_evidence.json`): **A = บั๊กจริง 2 ชั้น** — ① query R81 **ขาด `eq.`** → PostgREST `400 PGRST100` → `unresolved_identity` ปลอม (side-by-side: มี `eq.` = 200/1 แถว) ② ต่อให้ผ่าน = บัญชี `ext-…@channels.bmb.internal` ที่ identity ชี้ **ไม่มี push subscription เลย** (อุปกรณ์ที่สมัครจริง = บัญชีอื่น · Siam Portal Android สำเร็จ 7 พ.ย.) ③ สายแชตถูกข้าม (`dm_ok` ไม่ยิง web push) → **แก้:** `eq.` + หา identity ไม่ผูก channel (PSID เดียวกันคอมเมนต์/แชต) + **เช็ค subscription ก่อน** (`no_subscription` รายงานตรง ๆ) + **แจ้งทั้งคอมเมนต์และแชต** · **B = AI ไม่เคยเช็ค cutoff** (คอมเมนต์ 09:58 BKK "ยังสั่งได้"+ตะกร้า ทั้งที่ cutoff 09:00 ผ่าน · `menu_schedule` ครอบคลุม 24/35 สินค้า → ต้อง mirror เว็บ R5/R141/R77 เป๊ะ) → **แก้:** **`_shared/orderWindow.ts` ใหม่** (mirror `roundBookability` PRE_ORDER + port `isPreOrderDayPassed`/`pickNextScheduleDates` · ZERO-FAKE) + **intake gate: เมนูเลยรอบ = ไม่มีลิงก์ตะกร้า + เหตุผล + แนะนำเมนูที่ยังสั่งได้** (คอมเมนต์/แชต/กันออเดอร์ reject) + `resolveActiveRound` mode PRE_ORDER กรองรอบเลย cutoff + **ORDER WINDOW block ใน prompt** (แยก SAME_DAY vs PRE_ORDER · เมนูเลยรอบ vs ยังจองได้ · RULE Owner) + store status ป้าย "ปิดรับพรีออเดอร์" ต่อรอบ · tests `r82OrderWindow` ใหม่ 18 ข้อ + `r81NotifyGap`/`g6Security` อัปเดต · **เหลือ Owner: retest A2' (เครื่องดัง ≤5 นาที) + B8' (เลยรอบ→ไม่มีตะกร้า+แนะนำเมนูอื่น) + B9' (เวลา/ประเภทถูก) + ตอบว่าเครื่อง log in บัญชีไหน** (ทีมพร้อมผูก identity — script `_r82LinkIdentity.cjs` = DRY RUN รอคำสั่ง) · รายละเอียด `AI_WORK_STATE.md` บล็อก R82 · วิธีเทสต์ ...

**R82g retest รอบ 2 (2026-11-08 ~10:57-11:02 BKK ผล Owner → evidence `_r82g_evidence.json` → แก้ + RE-DEPLOY 04:41Z exit=0 + smoke 200):** **A2 = push ฝั่งเซิร์ฟฯ พิสูจน์ส่งครบ** (`push_notify=queued` ทุกแถว · outbox `status=sent` `last_error=null` ถึงเครื่อง Siam Portal 11:00-11:05 น. — ภาพ Owner 10:59 น. = ก่อน cron ยิง ≤5 นาที) → Owner เช็คแถบแจ้งเตือน/คอมเมนต์ทดสอบใหม่ · **B8/B9 = คำตอบ "ปิดรับ 16:00 น." ผิด = `assessProductWindows` เอา max cutoff ของทุกรอบรวมรอบเย็น `status=closed` (แอดมินปิดรอบเย็น · lead 2 ชม. = 05:00/09:00/16:00)** → แก้: นับเฉพาะรอบที่ `isRoundPreOrderOpen` · scan วันทีละวัน (ทุรอบปิด = ข้าม) · prompt ห้ามอ้างรอบที่ปิด + RULE (เที่ยงส่ง 11:00 = ปิดรับ 09:00 · รอบเย็นปิด = สั่งไม่ได้ · SAME_DAY ไม่มีปิดรอบ) · tests `r82OrderWindow` = 21 ข้อ · **gates 4/4 รอบ 2 = tsc 0 · lint 0 · vitest 220 ไฟล์/2,242 tests 0 fail · build 0** → **เหลือ Owner retest B8'/B9'** · docs: `AI_WORK_STATE` (Status+Blocked) + `TEST PACK` บล็อก R82 อัปเดตแล้ว

**R81 (2026-11-08 · "อ่านเอกสารที่เกี่ยวข้องและปิดงานทั้งหมดตามแผนเพื่อรอ owner ทดสอบบน live จริง" · commit `f3c8986`):** **ปิดงานตามแผน R81 = CODE_CLOSED · gates 4/4 (tsc 0 · lint 0 · vitest 219 ไฟล์/2,221 tests 0 fail · build 0 — `e2e/_r81_gates.log`)** — **A (B6 แจ้งเตือนไม่ถึงลูกค้า) = evidence production READ-ONLY ตัดสมมติฐานได้ชัด** (`e2e/_r81_a1*.json`): `POST /{comment_id}/private_replies` = `http_400 Unsupported post request. Object … does not exist` **5/5 แถวคอมเมนต์จริง** (คำตอบสาธารณะต่อ id เดียวกัน = `reply_status=sent` 5/5) → **DM ของเฟซตาย = สาเหตุจริง** · แถว `failed` 14 = **test residue `r74cmt-*`** ไม่ใช่ลูกค้าจริง (H3 ไม่ยืนยัน) → แก้: `fbReason` (error จริงของเฟซ) + กันซ้ำ DM 1/คอมเมนต์ (`dm_attempted_at`) + **web push ลูกค้า m179** (`enqueue_notification` ผ่าน `customer_channel_identities`→`customers.id` · บันทึก `flags.push_notify` รายงานสถานะ) + **admin alert `social-reply-fail-*` ทันทีเมื่อตอบสาธารณะ fail** · **B (A3/A4/C9 = ซ่อมมา 6 รอบ R46→R79 ไม่หาย) = เปลี่ยนเป้าหมายให้ถูก**: Smart Escape ใหม่ = ปุ่มเดียว คัดลอก+guide · **ห้าม auto-share** · **ลบปุ่ม intent ทั้งหมด** · share = ปุ่มที่สองชื่อชัด · guide ตาม platform (iOS=Safari / Android=Chrome + `target=_blank` เท่านั้น) · debug capture `?r81debug=1` (B1 · เก็บ UA+ผลกดปุ่ม) · in-app ซ่อนปุ่ม GPS + toast "แตะเลือกบนแผนที่/พิมพ์ค้นหา" + ช่องค้นหาที่อยู่ใน `DeliveryMapPicker` (B5) · footer 2 จุดเลิกสัญญา "แตะแล้วยืนยันเปิด" (B6) · tests คู่กัน (r79 เขียนใหม่ · `r81NotifyGap` ใหม่ · r57/g6/r77/r46/r76/r44 อัปเดต — g6-09 allowlist ขยายเฉพาะ GET identity/customer) → **เหลือ Owner ทดสอบ live = A2 (คอมเมนต์จริง→web push ≤5 นาที) + B1 (debug capture) + B7 (acceptance 2 เครื่อง)** — วิธี+เกณฑ์ผ่านใน test pack บล็อก "🔧 R81" · รายละเอียด `AI_WORK_STATE.md` บล็อก R81


**R78 (2026-11-07 หกโมงเย็น · ปิดงานค้าง R77 → พร้อม Owner ทดสอบ live · docs+evidence เท่านั้น ไม่แตะ src):** ① **ปุ่ม 🌐 เปิดภายนอก = Owner เลือกคงไว้** ("ไม่ต้องเอาออก มีปุ่มกากบาทไว้ให้ปิดพอ") — ไม่แก้โค้ด ② **CI เขียวทุก SHA R75–R77** (`e2e/_r78_ci_runs.json` = ALL_GREEN · `d420951` CI #42365923184 + Contract #42365923213 · ปิด pending "CI 9db6664") ③ **OMNI flow 18:19 = 19/19 ALL PASS** (`_r74_omni_flow.json`) ④ **live = R77 ครบยืนยันด้วย marker** (`_r78_live_check.json` = 4/4 · สแกน 102 chunks · shared assets 19/19 byte-identical) ⑤ **DB สะอาด: CLEANUP_DONE + RESIDUE_DONE · leftover 0 ทุกตาราง · orders = 16 = ลูกค้าจริง** ⑥ เหลืออย่างเดียว = **Owner เทสต์มือถือ 15 ข้อ TEST PACK ใน `AI_WORK_STATE.md` บล็อก R78**

**R74-OMNI (2026-11-06 ค่ำ · omnichannel ขั้น 3–5 · COMMITTED · งานที่ทำได้ครบ+verified):** ① **ยิง webhook จริงซ้ำ (signed → production channel-webhook)** = raw message→intake แถวใหม่+ยิงซ้ำไม่ซ้ำ · structured order→ออเดอร์จริง+idempotent · `order_submissions` (m124) submit+replay=1 ออเดอร์ ② **NL parse→draft→ยืนยัน (no auto-order = Owner เลือก แบบ ก ณ แชทนี้)** — live EF: ไม่มีเคสไหนสร้างออเดอร์ก่อนยืนยัน (B1/B2/B4) + **NL harness (LLM จริง+prompt ใหม่) 7/7** (ออปชันเข้า note ไม่เป็นเมนู · ยืนยันตามหลังสนทนาดึง thread · "เมนูนี้"→เมนูจริง · qty ภาษาพูด) ③ **parse dictionary ปรับจากข้อความจริง** (`ORDER_EXTRACT_SCHEMA`+prompt 5 กติกา · note→`customizations.notice` คีย์สติกเกอร์ · corpus-lock 6 test) ④ **เจอ production bug: fallback พิกัดเก่าใน EF = ออเดอร์ social ไม่มี GPS โดน 5KM gate ทุกใบ (สั่งไม่ได้จริงมาตลอด)** → แก้ `resolveKitchenPoint()` (อ่าน `business_settings.kitchen_location`) — verify A6 สร้างออเดอร์ด้วยพิกัดครัวจริง ⑤ gates: tsc=0 · lint=0 · **vitest 212/212 ไฟล์** · build=0 · tests 79/79 · **ติดแค่ mgmt auth สำหรับ deploy EF (`sbp_` PAT ถูกยกเลิก — ค้างอย่างเปิดเผย · คำสั่ง deploy ให้ด้วยทำไม่สำเร็จ) — คีย์ที่ระบบใช้ทุกวันผ่านครบ (page token never-expire · `sb_secret_` · ขนส่ง LINE MAN/Grab มีใน `.env`) · คีย์ยกเลิก: `META_USER_ACCESS_TOKEN` + `SUPABASE_ACCESS_TOKEN` · งานทดสอบ live ทั้งหมดโอนไปแชทหน้า (§7.3 closure)** — รายละเอียด test pack §R74-OMNI

**R74-OMNI session 3 (2026-11-07 · คำสั่ง "1 ร้านเปิดแล้ว รันสคริปด้วย 2 ok 3 รอคนใหม่ลงทะเบียนผู้พัฒนาก่อน + อัปเดตเอกสารรวม closure report + บันทึก key + สอน owner ทำรายการทดสอบที่ค้าง"):** **OMNI flow = `19/19 ALL PASS` บน production จริง (รอบ 4 · 09:04)** — "ยืนยัน → ออเดอร์จริง" B3 = `BMB-20261107-471` + B3b idempotent + no-auto-order + A-suite ครบ + A5b `ledger_rows=1` · **เจอ+แก้ production bug ใหม่: `shopContext` query `delivery_rounds` ไม่กรองวันที่ (หน้าต่างพลาดของปัจจุบัน → LLM บอก "ปิดรับวันนี้" ทั้งที่ร้านเปิด → ยืนยันแล้วไม่สร้างออเดอร์)** → แก้ + gates เขียว (vitest 212 ไฟล์/2,162 tests) + **deploy 3 ฟังก์ชัน** (เพิ่ม `social-post-worker`) · คู่มือสอน Owner = **test pack §R75** (ชุด ก R73h · ชุด ข R74-OMNI · ชุด ค §RG) · **Key Registry = closure report §8.1** · ค้าง 2 = ① OMNI-5 (รอคนใหม่ลงทะเบียนผู้พัฒนา) ② Owner เทสต์ live ตาม §R75

**test-data cleanup (2026-11-07 · คำสั่ง "ออเดอร์ทดสอบที่เอไอทุกตัวทำค้างไว้ แดชบอร์ดรกมาก เครียล์ให้ด้วย"):** เคลียร์ซากเทสต์จากทุกเซสชั่น AI หมดแล้ว — **ออเดอร์เทสต์ 26 ใบ + child 134 แถว + test round + social_events 58 + identities 29 + customers เทสต์ 42 + notifications 154 + auth users เทสต์ 13** ถูกลบ (ผูกหลักฐานทุกใบ) · **orders เหลือ 16 = ลูกค้าจริงทั้งหมด ไม่ถูกแตะ** · เครื่องมือ reuse ได้ `e2e/_r74Clean*.cjs` · รายละเอียด closure report **§8.2** · ไม่แตะ: `cart_sessions` เก่า 16 แถว (ปนลูกค้าจริงได้ · รอ Owner ตัดสิน)

**session 6 (2026-11-07 · "เครียล์ข้อมูลเทสต์ + อนุมัติลบ -548 + All modes เฉพาะวันปัจจุบัน + แท็บเดือน"):** ① ข้อมูลเทสต์ = 0 (สะอาด) ② **`BMB-20261101-548` ถูกลบแล้ว** (ใบสั่ง Owner · ค้างสลิป/ส่งของแล้ว · backup แล้ว · orders เหลือ **15 = ลูกค้าจริง**) ③ **UI หน้า Manage Orders: "🗓 วันนี้" = แสดงเฉพาะวันปัจจุบันทุกโหมด + แท็บเดือน (อดีต) บรรทัดเดียวกัน** (union scheduled/created = ไม่ซ่อนออเดอร์จริง) — gates 4/4 เขียว · คู่มือเช็ก = test pack **§R75.4 ชุด ง** · รายละเอียด closure **§8.2–8.3**

**session 7 (2026-11-07 · "ทดสอบระบบออโต้เมชั่น ตั้งแต่โพสบนเฟซ เคยเจนรูปได้ ทำไมเออเร่อแล้ว"):** ① **แก้แล้ว — image-gen ERR_FORBIDDEN** = บั๊ก `isAdmin()` เช็ค `rows[0]` จาก query ไม่ filter ตัวเอง (RLS `profiles_public_read` คืนทุกแถว · ลำดับ heap เปลี่ยนหลังเครียล์ข้อมูล) → แก้ filter ตัวเอง + รับ role ตาม canonical `is_admin()` · deploy · ยิงจริงผ่าน (เจนภาพติดโมเดลแรก) ② **ทดสอบ automation ครบโซ่**: flow probe **19/19** (webhook → AI → ออเดอร์) · `poll_comments` ไม่ตอบซ้ำ 9/9 · `social-post-worker` สร้าง draft จริงเข้าคิว **Approval** ("สุกี้แห้งกุ้ง…" · รอ Owner กดอนุมัติ = โพสต์ขึ้นเฟซอัตโนมัติ) ③ เครียล์ test data = 0 ทุกตาราง · รายละเอียด closure **§8.4**

**session 8 (2026-11-07 · "เจนรูปสร้างโพสบนเฟส มีเอไอตอบเมนูถูกต้อง แต่ลิ้งที่เอไอสร้างใช้ไม่ได้เลยสักลิ้ง ต่อออกภายนอกก็ไม่ได้ แก้ด้วย"):** **R75 = แก้ลิงก์ AI ทุกท่อ · DEPLOYED + LIVE_VERIFIED 8/8** — root cause (หลักฐาน `ai_reply_text` จริง 10 แถว): ทุกลิงก์ที่ AI เขียน = โดเมนเปล่า `biteme-baby.com/shop` **ไม่มี https://** (prompt สอนผิดรูปเอง) = Facebook ไม่ทำเป็นลิงก์ แตะไม่ได้ เปิดออกภายนอกไม่ได้ · โพสต์มีบรรทัด "🔗 ลิงก์เปิดเว็บภายนอก…" โดยไม่มี URL จริง → แก้ ① `_shared/socialLinkFormat.ts` (ใหม่) `normalizeAiTextLinks()` bare/www/http→`https://` · markdown→plain · idempotent ② ใช้ทั้ง `social-ai-worker` (reply) + `social-post-worker` (draft) + `social-publish-worker` (`POST_CTA_FOOTER` มี URL จริงทั้ง 2 บรรทัด) ③ prompt ทุกตัวสอนเขียน https:// URL เต็ม/ห้าม markdown · gates 4/4 (tsc/lint/vitest เต็ม/build) · live probe (signed webhook→EF production) comment+message = ลิงก์ทุกตัว `https://biteme-baby.com/…` · deploy 3 EF · เหลือ Owner เทสต์บนมือถือจริง (โพสต์ใหม่ + คอมเมนต์) — รายละเอียด `AI_WORK_STATE.md` บล็อก R75

**session 9 (2026-11-07 · "อาการเดิมเลย" + "เวลาเอไอตอบโพสหรือข้อความ ต้องมีแจ้งเตือนเฟซบุ้คให้ลูกค้าด้วย"):** **R76 = ลิงก์จากเฟซต้องเปิดได้จริง + เอไอตอบแล้วลูกค้าได้แจ้งเตือน · LIVE_VERIFIED 11/11** — ① root cause "อาการเดิม": ลิงก์ R75 เป็น https:// แตะได้แล้ว (ภาพจริง = ลิงก์สีน้ำเงิน) แต่ `InAppBrowserNotice` (R57/R64) เรียก `window.location.replace(intent://…)` บังคับออก Chrome → FB WebView บางเครื่องไม่รู้จัก intent:// → **ERR_UNKNOWN_URL_SCHEME กลืนทั้งหน้า** = ทุกลิงก์ตายที่ปลายทาง → แก้: **ห้ามนำทางหน้าปัจจุบันไป intent://** · เปิดผ่าน `window.open` แบบไม่ทำลายหน้า + แถบวิธีเปิดด้วยเมนู ⋮ (หน้าเว็บใช้งานได้เสมอ) ② แจ้งเตือนลูกค้า: `social-ai-worker` ส่ง **private reply** (`POST /{comment_id}/private_replies`) เข้า Messenger ทุกครั้งที่ตอบคอมเมนต์ + ฝั่ง Messenger = ข้อความที่ส่งคือการแจ้งเตือนเอง · หลักฐาน `dm_reply_id`/`dm_error` ใน `ai_guardrail_flags` · พิสูจน์แล้ว: `private_replies` ยังอยู่ (comment ลูกค้าจริง `can_reply_privately=true`) · live probe โพสต์ unpublished+คอมเมนต์จริง = `reply_status=sent` + pipeline แจ้งเตือนยิงจริง + cleanup 0 ซาก · targeted 33/33 · gates 4/4 · deploy `social-ai-worker` + frontend (git push) · เหลือ Owner เทสต์มือถือจริง — รายละเอียด `AI_WORK_STATE.md` บล็อก R76

**session 10 (2026-11-07 · "ใส่ปุ่มปิดป้อบอัพ + ปุ่มเปิดบราวเซอร์ภายนอก error + use my location error + เมนูพรีออเดอร์เลยรอบ"):** **R77 = ป๊อปอัพเปิดภายนอก (ปุ่มปิด X + `<a href>` เฟรมเดียว ไม่ error) + GPS จากลิงก์เฟซบอกทางออก/พาปักหมุด + เมนูเลยรอบไม่โชว์ (เมนูยอดนิยมสะอาด) + แท็บ 7 วันเมนู** — ① ปุ่มเดิม `window.open(intent://)` = หน้า error/ไม่เด้ง (Owner ยืนยัน) → เปลี่ยนเป็น anchor เฟรมเดียว + ปุ่มปิดป๊อปอัพ (✕ · จำต่อแท็บ) + เลิกยิง intent อัตโนมัติ/เลิกใช้ window.open(intent) ② "Use my location" ในแอปเฟซ = geolocation ถูกบล็อก → ข้อความบอกทางออกชัด (⋮ → เปิดภายนอก / ปักหมุดแผนที่ด้านล่าง) + เลื่อนลงแผนที่ปักหมุดอัตโนมัติ + timeout GPS 10s→25s ③ `isPreOrderDayPassed` (mirror `roundBookability` แบบวัน — วันนี้ที่ cutoff/window ผ่านทุกรอบ = เลยรอบ · ไม่มีรอบ = กฎ "ยังไม่ลงปฏิทิน" เดิม) + `pickNextScheduleDates` ข้ามวันนี้ที่เลยรอบ → เมนูยอดนิยม/หน้าเมนูสะอาดอัตโนมัติ (กฎ R34 เดิมทำงานต่อเอง) + MenuPage แถบเลือก **7 วันที่มีเมนู** (ผูกกับป้ายวัน R5 — ไม่ขัดระบบล็อกวัน) — targeted 53/53 · gates 4/4 · frontend only (deploy = push) · เหลือ Owner เทสต์มือถือจริง — รายละเอียด `AI_WORK_STATE.md` บล็อก R77

**session 10 update (ปิดเซสชั่น 2026-11-07 · "ห้ามโค้ด"):** ยืนยันปุ่มกากบาท (✕) ปิดป๊อปอัพ = ตรงตามความหมาย Owner ✓ · "7 วันที่มีเมนู" = Owner โอเค ✓ · **ค้าง: ปุ่ม "เปิดในเบราว์เซอร์ภายนอก" ยัง error บนเครื่อง Owner (FB WebView ไม่รับ intent:// ทุกช่องทาง — ทั้ง window.open และ `<a href>`) — รอบหน้าเลือก: คัดลอกลิงก์+วิธีใช้เมนู ⋮ / เอาปุ่มออก / คงไว้เผื่อเครื่องอื่น** · ปิดเซสชั่นด้วย TEST PACK 15 ข้อให้ Owner ทดสอบทั้งหมด (รายงานที่แชท) — งานผ่าน/ค้าง + test pack เต็ม = `AI_WORK_STATE.md` บล็อก SESSION CLOSE

**R74-OMNI session 2 (2026-11-06 ดึก · ต่อเนื่อง):** ปิดงานฝั่ง AI ครบ → **พร้อมรอทดสอบ live (Owner)** · ① deploy EF ลองใหม่พร้อมหลักฐานใหม่ (Docker Desktop เปิดแล้ว = เงื่อนไข bundle) = **401 "Invalid access token" จาก management API ทั้ง 2 fn (`e2e/_r74_deploy.log`) = ติด Management auth ไม่ใช่ Docker** (ตรวจทั้งเครื่องไม่มี auth ใหม่) ② **OMNI-5 = ไม่มี Meta Test User ในแอป (accounts/test-users = 0) + thread เพจ 3 ราย = ลูกค้าจริงทั้งหมด = ไม่ส่งข้อความถึงใคร (ห้ามแตะลูกค้าจริง)** · สร้างเครื่องมือพร้อมรัน `e2e/_r74Omni5Live.cjs` (DRY-RUN default · blocklist ชื่อลูกค้าจริง · `--fire` = ส่งจริง+pipeline จริง+cleanup) ③ **DB verify harness (Docker) = `R73E_VERIFY_ALL_GREEN`** (replay 001–193 + NIGHTSIM + CRM consent/kill-switch + legacy 0/7 · `e2e/_r73e_verify.log`) — **อัปเดตปิดงาน 22:32–22:35: ① deploy EF = สำเร็จแล้ว (คีย์ใหม่ `bmb_PAT_SUPABASE_ACCESS_TOKEN` ที่ Owner วางใน `.env.local` 22:05 → `node e2e\_r74DeployRun.cmd` = DEPLOY_OK 2/2 fn) — โค้ดแก้ขึ้น production จริง ② flow ซ้ำหลัง deploy = B2b เขียว (draft cart link) + note extraction ถูก + no-auto-order ผ่าน · รวม 11/19 = ทุก fail คือ `ERR_STORE_CLOSED` (ร้านปิด 20:00 · รัน 22:35) ไม่ใช่บั๊กโค้ด → **เหลือ re-run ตอนร้านเปิด = คาด 19/19 (B3 confirm→ออเดอร์จริง = UNVERIFIED ต่อ)** ③ OMNI-5 = ค้างไว้ก่อน (คำสั่ง Owner) — พร้อมทดสอบ live ตาม §R73h/§R74-OMNI/§RG · รายละเอียด test pack §R74-OMNI (ผลการรับช่วงต่อ)

**R73h (2026-11-06 บ่าย · UI วันเกิด+consent + m193 — COMMITTED `518f7f4` · CI 3/3 GREEN · พร้อมทดสอบ):** การ์ด "วันเกิด & ข้อความพิเศษ" ในหน้าบัญชี (วันเกิด + ยินยอม + บันทึก · validate วันในอดีตเท่านั้น) + **m193 `customers.crm_consent` (default false)** + `crm_winback_scan`/`crm_birthday_scan` **ส่งเฉพาะคนยินยอม** = ปิดความเสี่ยง "เริ่มส่งทันที" ของ m192 · ถอนได้ทุกเมื่อ · verify: `CRM_CONSENT_FILTER_OK` (คนไม่ยินยอม = ไม่ได้รับข้อความใด ๆ) + dedupe/kill-switch/legacy 7/7 = `R73E_VERIFY_ALL_GREEN` · tests 78/78 · **omnichannel: env/secret+Test User มีใน local แล้ว + เคยยิง webhook ผ่าน SMS ถึง `order_submissions` (token ใน env local) — เหลือขั้น 3–5 (parse→draft cart→ปรับ dictionary) = ยกไปแชทหน้า (แผน §R74-OMNI)** · **ปิดเซสชั่น 2026-11-06 ค่ำ: README เขียนใหม่จากโค้ดจริง + closure report §7 + test pack §R73h/§R74-OMNI แล้ว**

**R73g (เดิม — ปิดเรื่องค้างทั้งหมด · COMMITTED `f1444ff`+`9e74b03` · CI 3/3 GREEN · E2E live 5/5):** ① **kitchen UTC ปิดทั้งคลาส** — m191 (3 fn ครัว defaults+COALESCE → BKK + table defaults 2 ตาราง) · audit ทั้ง schema residue=0 (guard 9 fn + `pg_get_functiondef` class check เข้า CI แล้ว) ② **CRM automation (m192 · ราง pg_cron m177/178 เดิม ไม่แตะ EF)** — `crm_winback_scan` (หายไป 45 วัน → แจ้งเตือน in-app 1 ครั้ง/สัปดาห์/คน) + `crm_birthday_scan` (วันเกิดตามวัน BKK) + `crm_segment_summary` + `menu_sales_stats` + kill-switch `crm_automation` · behavioral verify ครบ (dedupe/segments/kill-switch) — **หมายเหตุ:** เริ่มส่งแจ้งเตือนอัตโนมัติทันทีที่ apply (in-app · ปิดได้ทันที) · birthday ยังไม่มี UI เก็บข้อมูล ③ **AI gap fills** — "ขายดีช่วงนี้" จัดอันดับจากยอดขายจริง 30 วัน (fallback ไม่ปลอม) + contextual help 6 หัวข้อ deterministic ก่อน LLM · tests 74/74 + tsc/lint 0 ④ **E2E `e2e/ttbFlow.cjs`** = 5/5 บน `biteme-baby.com` (เมนูจริงขึ้น + help ตอบจริง ~2 วิ) — **ถัดไป: Owner เทสต์ §R73 + help/ขายดี/คิวครัวดึก บน live**

**R73b (2026-11-06 เช้า · ซ่อม CI Contract Tests ของ R73 — ไม่แตะโค้ดผลิตภัณฑ์):** annotation จริง (`e2e/_r73_ci_ann.json`) = `Legacy contracts failed: 1/7` → `contracts_017_018.sql:106 SKIP no future open round with capacity` = **time bomb วันที่คลาส R68** (seed 095 `CURRENT_DATE + 1` TZ=UTC vs `scheduled_date > CURRENT_DATE` TZ=BKK — ระเบิด 00:00–07:00 ICT · R73 push 00:18 น.) → แก้ = fallback fixture รอบ "พรุ่งนี้ BKK" ด้วย `ensure_rounds_for_date` ใน txn ROLLBACK (assertion คงเดิม 100%) · verify บน replay (`e2e/_r73_verify_progress.log`): repro error จริง EXIT=3 · แก้แล้วผ่านทั้ง night/normal · legacy batch **7/7** = `R73_VERIFY_ALL_GREEN` · **รอ CI เขียว (probe ครั้งเดียว) + Owner เทสต์ §R73** → **CI 3/3 เขียวแล้ว** (`234135b` · probe 08:56 น.: Contract Tests · Test+Lint+Build · Deploy) — **รอ Owner เทสต์ §R73 (6 ข้อ)**


**R73 (2026-11-05 ดึก 2 · Owner สั่งสติกเกอร์ 3 ข้อ: ช่องไฟ 15 บรรทัดก่อน QR เท่ากัน / เส้นคั่นทับ delivery+total / NOTICE ไม่ปริ้นข้อมูลลูกค้าจากลิงก์จริง):** **① ช่องไฟ** = ตารางแถวเดิม brand→tag→Date นอกจังหวะ (Δ28/Δ44) → grid ใหม่ baseline ห่างกันคงที่ 30px ทุกบรรทัด (ใต้ brand = 15 บรรทัด · test บังคับ Δ30 ทุก offset) **② เส้นทับอักษร** = เส้นคั่น 2/3 วาดที่ `y−15` = กลางตัวอักษรแถวถัดไป (band 20–21px) → ย้ายกลางช่องว่าง `nextY − nextSize − 2` (test: ไม่มีเส้นคร่อม band ตัวอักษรใด) **③ NOTICE** = เดิมรับเฉพาะ `special_instructions` → ใบจริงพิมพ์ `NOTICE : -` เสมอ → `collectOrderNotices` รวม special_instructions + โน้ตแชตลูกค้า (order_messages) + โน้ตรายเมนู (special_request/customizations.notice) · `withCustomerChatNotes` เติมในทุกเส้นทางพิมพ์ (auto/manual/POS/BT) · tests r73 8 ข้อ (59/59 รวม contract เดิม = สัญญา sticker ไม่แตะ) · test pack **§R73 = 6 ข้อ** รอ Owner เทสต์ (เริ่มที่แชทหน้า)

**R72 (2026-11-05 ดึก · Owner ทดสอบ §R71 แล้วสั่ง 7 ข้อ: เด้งตอนเปิดแอพ/แจ้งเตือนซ้ำ/มุมจอต้องบอกเรื่องข้อความ/คูปองเช็คเอาท์/เซมเดย์นอกเวลา(ผ่าน)/เส้นทางจัดส่งหาย+สถานะค้าง/รับงานไม่ได้):** **① แจ้งเตือนออเดอร์ซ้ำ 2 เท่า** = trigger m161 (id `notif-<ts>-<rand>`) + automation-worker (id `evt-ord-<order>-<status>`) คนละ id → **m188** ให้ trigger ใช้ id เดียวกับ worker + ON CONFLICT = เหลือแถวเดียว (smoke 5/5) **② กระดิ่งไรเดอร์ซ้ำ** = กระดิ่งมุมจอ (Header) + RiderBell ซ้อนกัน → ถอด RiderBell (กระดิ่งมุมจอเดียวทุก role = บอกเรื่องข้อความครบ ร้าน/ไรเดอร์/ลูกค้า) **③ เด้งตอนเปิดแอพ** = ปลด `document.hidden` gate (กระดิ่ง+แชตเด้งทุกครั้ง) **④ คูปอง** = โค้ดจริง `HALLOW10` หมดอายุ 11-04 (ไม่ใช่ HALLOWEEN10) → ต่ออายุถึง 30 พ.ย. + การ์ดโปรหน้าร้านเช็กช่วงวันที่แบบ dropdown (โปรเพิ่มทีหลังขึ้นอัตโนมัติ) **⑤ สถานะค้างหลังยืนยันรอบ** = พรีออเดอร์วันถัดไปไม่ขึ้นคิวครัว (กรอบวันที่) → คิวครัวโชว์ทุกวันที่ **⑥ เส้นทางแจ้งเตือนจัดส่ง** = DRIVER_* ตก map → เพิ่มเข้า `/admin/delivery?focus=` **⑦ รับงานไม่ได้** = แอดมินมอบหมายแล้วไรเดอร์กด "รับงานประกาศ" เด้ง ERR_OFFER_NOT_AVAILABLE → **m189** fallback เป็น accept (smoke: accepted จริง) · tests r72 8 ข้อ (51/51 รวม regression) · test pack **§R72 = 8 ข้อ** รอ Owner เทสต์ · บทเรียน: apply/verify ต้องเช็กค่าจริง (รอบแรกสำเร็จปลอมจากเศษบรรทัด+verify เช็กชื่อ key) — แก้แล้ว

**R71 (2026-11-05 ค่ำ · Owner หลังทดสอบ live: "ฝั่งไดร์เวอร์ไม่มีแจ้งเตือนไม่มีหน้าต่างแชทโต้ตอบไม่ได้ ทำให้ถูกต้อง · กระดิ่งเตือนจริง"):** **root cause = m183 ใช้ id แจ้งเตือน `'msgn-'||v_id` ซ้ำกันสองแถว** (notifications.id เป็น PK) → **ไรเดอร์ส่งข้อความ = unique violation → rollback ทั้งก้อน = ส่งไม่ได้จริง** (ลูกค้า/แอดมินรอดเพราะเขียนแถวเดียว — ตรงกับที่ Owner เห็นทุกประการ) + ไม่มีแถวรอรับของไรเดอร์เลย + /rider ไม่มีกระดิ่ง (ไม่มี Header) + แชตรายงานพับอยู่ — **① m187 APPLIED (`_r71Apply187-result.json` ALL_PASS 5/5):** `send_order_message` v3 = id แยก suffix ต่อผู้รับ (`-c`/`-a`/`-r`) + แจ้งไรเดอร์ (user_id = drivers.user_id · RLS own) + แยกชื่อผู้ส่ง · **production smoke 6/6** (`_r71_smoke.json` · assignment จริง): ไรเดอร์ส่ง ok:true (เคสที่เคยพัง) + แถวรอรับครบ + ไม่มี echo ทั้งสองฝั่ง **② RiderBell ใหม่** (กระดิ่ง /rider: poll+เสียง+ป้าย+browser notification+อ่านทั้งหมด server) + แชตรายงานทุกงาน `<details open>` **③ กระดิ่งเดิม "เตือนจริง":** มาร์กอ่าน server ทุกแถว (ป้ายไม่กลับมาหลัง reload — เดิมเฉพาะ evt-*/auto-*) + เด้งเดสก์ท็อปตอนหน้าไม่โฟกัส + ไอคอน 💬 · tests `r71RiderChatBell` 8 ข้อ (31/31 รวม regression) · test pack **§R71 = 7 ข้อ** (R71-1..7) รอ Owner เทสต์ · ⚠️ push ตอนปิดแอปของไรเดอร์ (ข้อความแชต) = follow-up dispatcher คีย์ด้วย user/audience
