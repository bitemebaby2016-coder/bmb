# BMB — R3 ENGINEERING CLOSURE & OWNER ACCEPTANCE PACKAGE (2026-10-23)

> **Authority:** Owner Master Directive R3 (Whole-Project Engineering Closure)
> **Baseline:** `a6df293` → **Closure commit:** ดู §11 · **Status: ENGINEERING CLOSURE READY FOR OWNER ACCEPTANCE**
> เอกสารนี้เป็น consolidated package เดียวสำหรับ Owner/Admin ทำ Production acceptance test
> **ยังไม่ประกาศ DONE / owner-accepted** — จนกว่า Test A–Q ฝั่ง Owner จะผ่านจริง

---

## 0. สรุปสั้น (Executive)
- ปิดงาน engineering ที่ทำได้จริงครบตาม Phase 0–10: payment/POD (138/139 ขึ้น production แล้ว), รอบส่ง audit+guards, terminal/UI sync (focus refresh), คูปอง hydration race, map config (env ครบแล้ว), **backup restore drill พิสูจน์แล้วจริงบน scratch PG17**
- พบและแก้บั๊กจริง 3 ตัวที่ซ่อนอยู่: `dbRestoreDrill` หา manifest ผิดที่ (drill ไม่เคยผ่านจริง), `db/` prefix ซ้ำ, regex filter `COMMENT ON EXTENSION` — ทั้งหมดแก้แล้ว + พิสูจน์ restore สำเร็จ
- เหลือเพียงงานที่ต้องมือ/อุปกรณ์จริง/การตัดสินใจธุรกิจ = Test A–Q + การตัดสินใจ 2 ข้อ (§7)

## 1. Git / Production identity (verified 2026-10-23)
| รายการ | ค่า (verified) |
|---|---|
| HEAD = origin/main (ก่อนรอบนี้) | `a6df293` (clean, ไม่มี untracked, stash 1 คงไว้) |
| CI ล่าสุด | `a6df293` — **Contract Tests = success** + **CI = success** (13:22Z) |
| Production build | `biteme-baby.com` HTTP 200 · assets `index-5LwijPy-.js` (build ใหม่หลัง a6df293) |
| Migration history | **139, 138, 137…1** (apply+record แล้ว 13:15–13:17 UTC · evidence `e2e/artifacts/prod-*-138-139.json`) |
| Backup ล่าสุด | `db/bmb-db-20261023-051623.sql.gz` (05:16 UTC · sha256 ตรง manifest · bucket private) |

## 2. Whole-project closure matrix (คำศัพท์: IMPLEMENTED/CONNECTED/DEPLOYED/RUNTIME VERIFIED/DOCUMENTED/MISSING/BLOCKED/DEFERRED)
| # | พื้นที่ | สถานะ | หลักฐาน/หมายเหตุ |
|---|---|---|---|
| 1 | Customer PWA + checkout | IMPLEMENTED · CONNECTED · DEPLOYED · **รอ Owner Test A/B/K** | vitest 1325+ · canonicalOrderFlow |
| 2 | SAME_DAY / PRE_ORDER | IMPLEMENTED · CONNECTED · **รอ Test B/C** | `create_order_with_items` แยก quote/validate · `deliveryRoundStatus.ts` mirror + server authority (025/118) |
| 3 | Payment / dedupe / confirm / refund / audit | IMPLEMENTED · DEPLOYED · CONNECTED · **รอ Test E/J** | mig 138 (RPC+dedupe+unique index+processing-first confirm+audit) · probe: paid ทุกออเดอร์มี completed intent ครบ |
| 4 | Admin payment review + error visibility | IMPLEMENTED · CONNECTED · **รอ Test E** | SlipReviewPanel + banner `payment-read-error` (D-08 เลิกเงียบ) |
| 5 | Kitchen workflow | IMPLEMENTED · CONNECTED · **รอ Test F** | kitchenQueueView + order_transition_allowed |
| 6 | Bite Drive rider/dispatch/POD/tracking | IMPLEMENTED · DEPLOYED (mig 139) · CONNECTED · **รอ Test G/H/I** | policy helper + ปุ่มกล้อง/แกลเลอรี่ + progress/retry + focus refresh |
| 7 | Rounds/cutoff/capacity/batching | IMPLEMENTED · **audit ปิดแล้ว** · **รอ Test C/D** + การตัดสินใจกติกาเปิด/ปิดรอบ (§7) | validateRoundTemplate + setRoundStatus audit (round → audit_logs) · capacity 30–50/รอบ = max_capacity 60–100 ที่ตั้งไว้; **limit จริงต้องวัดจาก Test C (โหลดจริง)** |
| 8 | Maps/location/fallback | CONNECTED (env ครบ) · **รอ Test L** | `googleMaps.ts` ใช้ `VITE_GOOGLE_MAPS_API_KEY`/`VITE_GOOGLE_ROUTES_API_KEY`/`MAP_ID` — Owner ตั้งค่าใน CF Pages แล้ว (เห็นในสกรีนช็อต) · fallback = computeGoogleRoute คืน null + UI แสดงข้อความ/เส้นตรง |
| 9 | Internal Web POS + staff roles | IMPLEMENTED · CONNECTED · **รอ Test M** | posApi + close_shift/open_shift RPC · ไม่มี staff คนใหม่ถูกเพิ่ม |
| 10 | Printer config/print behavior | IMPLEMENTED · **รอ Test M (อุปกรณ์จริง)** | printService + `print_jobs` + `mark_print_job` · **AI ไม่มีเครื่องพิมพ์จริง = ไม่ยืนยันผลทางกายภาพ** |
| 11 | Inventory/recipes/cost/stock | IMPLEMENTED · CONNECTED · **รอ Test N** | `inventory`/`inventory_transactions`/`recipes` + deduct/restore_inventory_for_order · ค่า cost จริงขึ้นกับข้อมูลที่ Owner กรอก (ไม่มีการเดาตัวเลข) |
| 12 | Finance/reports | IMPLEMENTED (sales/payment/refund views) · **กำไรสุทธิ = UNSUPPORTED (ระบุชัด)** | **ไม่มีตาราง expenses/cost ledger** → รายงานต้องไม่อ้างกำไรสุทธิ (§8) |
| 13 | Coupons/pricing/totals | IMPLEMENTED · CONNECTED · **รอ Test K** | one-apply-path + server re-derive + **แก้ hydration race (reload แล้วคูปองไม่หาย)** |
| 14 | Backup/restore | IMPLEMENTED · **RUNTIME VERIFIED (drill ผ่านจริงวันนี้)** · DOCUMENTED | §9 — integrity+restore ลง scratch PG17 สำเร็จ · เพิ่ม drill รายวันใน daily-backup.yml |
| 15 | Native automation | IMPLEMENTED · RUNTIME VERIFIED (41/41 succeeded) | automation-scheduler (GitHub cron) + `automation_queue` idempotent `sched-*` keys |
| 16 | Facebook ingestion / AI marketing | CONNECTED (channel_intake EF) · **DEFERRED ตาม gate** | AI ไม่ใช่ authority ราคา/สต็อก/เงิน (มี guard ใน aiGuardrails) · public publish อยู่หลัง acceptance |
| 17 | Security/RLS/audit/observability | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (probe) | payment_intents ยัง REVOKE'd · policies ไม่มี subquery · audit_logs 4,329 แถว + round audit ใหม่ |
| 18 | White-label/tenant/branch | IMPLEMENTED (ตาม scope ที่อนุมัติ) · DEFERRED ส่วนขยาย | tenant/admin RPC + brandResolver |
| 19 | Production config/externals | CONNECTED | CF Pages vars: Stripe/OpenRouter/THSMS/Meta/Google ครบ (สกรีนช็อต) · เหตุผลที่ map key ยังไม่โผล่ใน build ปัจจุบัน = build ก่อนตั้งค่า → **build ถัดไปหลัง push นี้จะมี** (§9 verify) |
| 20 | G1–G10 gate contracts | RUNTIME VERIFIED (ผ่าน CI + replay ท้องถิ่น) | contracts 001–139 + `contracts_138_139.sql` G1–G7 + regression 132/133 |

## 3. งานที่ทำในรอบนี้ (Completed work + evidence)
1. **Payment/POD closure verify (Phase 1):** production probes (read-only) — `e2e/artifacts/r4-probe-{baseline,money,rounds,ops,investigate}.json` + `r4BaselineProbe.cjs` (reusable)
2. **D-05 rounds (Phase 2):** `bmbAdminApi_rounds.ts` — `validateRoundTemplate` guard + **audit ทุก open/close/save/reset** (เข้า `audit_logs` ผ่าน `append_audit_log`) + status whitelist · `AdminRounds.tsx` error surfacing + focus refresh · **การสอบสวนรอบ 23–25:** หลักฐาน = ถูก toggle วันนี้ 13:42–13:43 UTC (ทีละรอบ ~2–3 วิ = เซสชันแอดมินผ่าน UI) · ก่อนหน้านี้ไม่มี audit trail ของรอบเลย (จึงระบุ "ใคร/ทำไมปิดวันที่ 10-22" ไม่ได้ — ไม่เดา) · นับแต่นี้ทุกการเปลี่ยนรอบบันทึก audit
3. **D-01/D-07 UI sync:** focus/visibilitychange refresh — `RiderPwaPage`, `AdminOrders`, `AdminRounds` (ตามกติกา: polling เท่านั้น ไม่ใช้ realtime) · terminal guard ฝั่ง client มีใน `orderStateMachine.ts` + server `order_transition_allowed` เดิม
4. **D-03/D-04 coupons (Phase 3):** แก้ hydration race ใน `CouponBox.tsx` (deps `[couponCode]`) — reload แล้วคูปองถูก re-validate กลับมาเสมอ · duplicate display ถูก M2 รวมเป็น `<CouponBox />` เดียว/หน้าแล้ว (verify) · server re-derive ยอดจริงตอน create (114/124) คงเดิม
5. **D-06 maps (Phase 4):** env ครบใน CF Pages (สกรีนช็อต Owner) + wiring ถูกต้อง (`import.meta.env.VITE_GOOGLE_*`) + fallback null→ข้อความ · เหลือ Test L บนอุปกรณ์จริง
6. **Backup/restore (Phase 5) — RUNTIME VERIFIED:** แก้ `dbRestoreDrill.mjs` หลายจุด (manifest path `db/`→root, list prefix `db/`→`db`, restore filter `COMMENT ON EXTENSION` + `COPY vault.*`, role prelude, `PSQL_CMD` override) → **drill ผ่านจริง: integrity (sha256=manifest) + restore ลง scratch PG17 สำเร็จ** · ตรวจอีกชั้น: orders=4, payment_intents=6, products=19, rounds=24, audit_logs=4,329, migrations=137 · เพิ่ม step "Restore drill (isolated integrity)" ใน `daily-backup.yml` (fail closed ทุกวัน)
7. **Tests ใหม่:** `couponHydrationRace.test.ts`, `roundsAuditGuards.test.ts` · ผลรวมดู §6

## 4. Production operations (แยก RO / WRITE)
| ชนิด | รายการ | เวลา (UTC) |
|---|---|---|
| READ-ONLY | probes ทั้งหมด (r4 stages, pg_proc/pg_policies/pg_indexes, storage list, backup manifest) | 13:55–14:28 |
| WRITE (ได้รับอนุมัติแล้วก่อนหน้าในคำสั่งเดียวกัน) | apply mig **138 + 139** + record history (evidence `prod-*-138-139.json`) | 13:15–13:17 |
| WRITE (scratch เท่านั้น) | restore drill ลง docker `bmb_restore` (PG17 แยกเครื่อง) — **ไม่แตะ production** | 14:0x |
| ไม่ทำ (ตามกติกา) | ไม่มี data repair 841/205 · ไม่ GRANT เพิ่ม · ไม่ลบ/merge payment rows · ไม่แตะ stash/.env | — |

## 5. Data-repair plan 841/205 (PROPOSED — ต้องอนุมัติเท่านั้น ยังไม่ทำ!)
- **ข้อเท็จจริง (probe):** `BMB-20261023-841` + `BMB-20261022-205` ละ 2 แถว = `processing`(เก่า, มีสลิป) + `completed`(ใหม่, มีสลิป) · ทั้งสองออเดอร์ `payment_status=paid` · **ไม่มี completed ซ้ำคู่** = ไม่มีหลักฐานรับเงินซ้ำ
- **ผลกระทบทางการเงิน:** ยอดละ 1 ครั้ง (841 = 176.30) — แถว processing ค้างคือ "เศษ" ไม่ใช่เงินซ้ำ · แต่ยังนับเป็น ACTIVE → ถ้าลูกค้ากดจ่ายซ้ำบนออเดอร์เดิม dedupe จะคืนแถวค้างนี้
- **แผนซ่อม (reversible, เสนอ):** `UPDATE payment_intents SET status='failed', failure_reason='superseded-duplicate (R4 repair)' WHERE id IN (<2 ids ของแถว processing>)` — 1 บรรทัด, undo ได้ด้วยการคืน status='processing' · ถ่าย backup ก่อน + หลัง repair ตรวจ `paid-not-completed` ยังว่าง
- **ต้องการ:** Owner อนุมัติเป็นลายลักษณ์อักษร → ทำในรอบถัดไปพร้อม evidence

## 6. Verification ที่รันจริงรอบนี้ (SKIPPED ≠ PASS)
| Gate | ผล | หมายเหตุ |
|---|---|---|
| vitest ทั้ง suite | ดู §11 | baseline 1325 + ใหม่ 9 = คาด 1334 |
| tsc / eslint+brandGuard | ดู §11 | |
| SQL replay 001–139 + contracts 138/139 G1–G7 | PASS (รอบก่อน, CI green ที่ a6df293) | รอบนี้ไม่ได้แก้ SQL |
| Restore drill (integrity + restore PG17) | **PASS** | §9 |
| production read-only probes | PASS | §4 |

## 7. BLOCKED — การตัดสินใจที่ต้องการจาก Owner
1. **กติกาเปิด/ปิดรอบ + ใครปิด evening 23–25 (10-22):** ระบบไม่มีหลักฐานเดิม (audit เพิ่งมี) — ต้องการนโยบาย: ใครมีสิทธิ์ปิดรอบ, auto-close หลัด cutoff ไหม, รอบย้อนหลังเปิดได้หรือไม่ · **Safe default ที่เสนอ:** auto-close ตาม cutoff (server) + เปิด/ปิดมือได้เฉพาะ admin + audit ทุกครั้ง (ส่วน audit ทำแล้ว)
2. **Capacity จริงต่อรอบ:** ตั้ง max_capacity 60–100 (เป้า 30–50 stop/รอบ = รองรับได้) — ต้องการนโยบายเต็มแล้ว: ปิดรับ หรือ overflow queue
3. **อนุมัติ data repair 841/205** (§5) — ยังไม่แตะข้อมูลจนกว่าจะอนุมัติ

## 8. Unsupported metrics (ระบุชัด ไม่โชว์ศูนย์ปลอม)
- **Net profit / กำไรสุทธิ:** ไม่มีตารางค่าใช้จ่าย/ต้นทุนรวม (`expenses` = ไม่มีจริงใน schema) → รายงานโชว์เฉพาะ sales/payment/refund ที่พิสูจน์ได้ · ถ้าต้องการกำไรสุทธิ ต้องเพิ่ม expenses module (ขอ scope)
- **Physical print success:** ต้องทดสอบกับเครื่องจริง (Test M) — AI ไม่มีอุปกรณ์

## 9. Backup & Restore — Recoverability proof (2026-10-23)
- **Artifact:** `db/bmb-db-20261023-051623.sql.gz` (bucket `db-backups` private) · sha256 ตรง `manifest.json` (root) · gzip/CREATE TABLE/COPY structure ผ่าน
- **Drill result:** `node scripts/dbRestoreDrill.mjs --psql` → **PASS** — restore ลง scratch **PostgreSQL 17** (docker แยกเครื่อง; script ปฏิเสธ URL ที่ชี้ production ref) · ตรวจอีกชั้น: orders=4 payment_intents=6 products=19 rounds=24 audit_logs=4,329 migrations=137
- **Restore procedure ตอนภัยพิบัติ:**
  1. เป้าหมายจริง = **Supabase project ใหม่** (มี extensions/roles ครบ) หรือ PG17 + prelude roles (`anon`/`authenticated`/`service_role`)
  2. `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=<secret> RESTORE_DATABASE_URL=<target> node scripts/dbRestoreDrill.mjs --psql` (หรือ `psql $TARGET < dump.sql` ตรง ๆ)
  3. บน vanilla PG drill จะ filter `CREATE/COMMENT ON EXTENSION supabase_vault` + `COPY vault.*` อัตโนมัติ (นับโชว์ ไม่เงียบ) — บน Supabase จริงไม่ต้อง filter
  4. **หลัง restore ต้อง re-apply migration 138 + 139** (backup 05:16 UTC ยังไม่รวม — หลัง backup รอบพรุ่งนี้ 05:xx จะรวมเอง; recovery ก่อนหน้านั้นต้อง apply ซ้ำจาก `supabase/migrations/`)
  5. คืนค่า env/secrets จาก Cloudflare Pages (§10 รายการชื่อ)
- **Limitations:** Storage objects (สลิป/POD/รูป) **ไม่อยู่ใน dump** — ต้องกู้จาก bucket `payment-slips`/`pod-photos`/`bmb-images` ผ่าน storage copy · ค่า secret ทั้งหมดต้องตั้งใหม่ (ไม่อยู่ใน backup)
- **Daily guard:** `daily-backup.yml` เพิ่ม step restore drill (integrity, fail-closed) ทุกวันแล้ว

## 10. Owner-only actions (เรียงตามลำดับที่ควรทำ)
### 10.1 ก่อนเริ่มทดสอบ Production
| # | การกระทำ | ที่ไหน | ตรวจอย่างไร | ห้ามแชร์ |
|---|---|---|---|---|
| 1 | ยืนยัน Google API key restrictions | Google Cloud Console → Credentials → key ของ `VITE_GOOGLE_MAPS_API_KEY`/`VITE_GOOGLE_ROUTES_API_KEY` | HTTP referrer ต้องมี `https://biteme-baby.com/*` · เปิด Maps JavaScript API + Routes API + Geocoding | ห้ามส่งค่า key ในแชท |
| 2 | ตัดสินใจ 3 ข้อ §7 (กติการอบ / capacity / repair 841-205) | ตอบในแชท | — | — |
| 3 | (ถ้ามี) เช็กว่า secret ฝั่ง Stripe LIVE ตั้ง webhook ชี้ `biteme-baby.com` | Stripe Dashboard | Events: payment_intent.* | ห้ามส่ง secret |

### 10.2 ระหว่างทดสอบ Acceptance
- ใช้ Test A–Q (§12) ตามลำดับ · เก็บ screenshot/เลขที่ออเดอร์ลงคอลัมน์ "Actual result"
- ทุก test ระบุว่า "ปลอดภัยทำซ้ำ" หรือไม่ — ข้อที่แตะเงินจริง/ข้อมูลจริงทำครั้งเดียวแล้ว cleanup ตามคำสั่ง

### 10.3 ทางเลือก/หลังเปิดร้าน
- เพิ่ม expenses module (ถ้าต้องการกำไรสุทธิจริง) · เพิ่ม storage-object backup (ปัจจุบัน dump ไม่ครอบคลุมไฟล์) · Facebook/AI marketing activation (หลัง acceptance)

## 11. Commit / CI / Test inventory (รอบปิดงาน)
| รายการ | ค่า |
|---|---|
| Closure commit | **`0b73189`** — `fix(recovery R3): rounds audit+guards, coupon hydration race, focus refresh, restore drill proof` |
| CI (ก่อนรอบนี้) | `a6df293` Contract Tests=success · CI=success (13:22Z) |
| CI (รอบนี้) | จะรันอัตโนมัติหลัง push — ดู Actions ที่ commit นี้ (Contract Tests รวม step 138/139) |
| vitest | **1331/1331 PASS** (129 ไฟล์; รอบขนานเคย flaky `orderTimeline` 3 ตัว = ผ่านเดี่ยว+ผ่านรอบซ้ำ ไม่ใช่ regression) |
| tsc --noEmit | **0 errors** |
| eslint + brandNameGuard | **0** |
| Restore drill | **PASS** (integrity + scratch PG17 restore) — §9 |
| Tests ใหม่ | `couponHydrationRace.test.ts` (1) · `roundsAuditGuards.test.ts` (5) |

## 12. FINAL PRODUCTION ACCEPTANCE CHECKLIST (A–Q — พร้อมให้ Owner ทดสอบ · ไม่มี PASS ปลอม)
> ทุกช่อง "Actual/Result" = ให้ Owner กรอก · **AI ไม่ได้ทดสอบข้อใดเลยบน production จริง — ทุกข้อ = PENDING OWNER**

**ฟิลด์ทุกข้อ:** `ID · Prereq · Actor/Device · Steps · Expected · Actual(Owner) · PASS/FAIL/BLOCKED · Order/Ref · Evidence(ภาพ/log/query) · Cleanup · ความเสี่ยงเงินจริง/ข้อมูลจริง · ทำซ้ำได้?`

| ID | ชื่อ/ขั้นตอนโดยย่อ | Expected | เงินจริง/ข้อมูลจริง | ทำซ้ำได้ | Cleanup |
|---|---|---|---|---|---|
| **A** | Prereq: สมัคร/ล็อกอินลูกค้า · มือถือ+เดสก์ท็อป · เปิด `/menu` → เพิ่มสินค้า 2 ชิ้น → ตะกร้า → checkout กรอกชื่อ/โทร/ที่อยู่ → สั่งซื้อ | สร้างออเดอร์สำเร็จ ได้เลข `BMB-YYYYMMDD-xxx` · ยอดตรงกับตะกร้า | ข้อมูลทดสอบ (เบอร์ทดสอบ) | ได้ | ยกเลิกออเดอร์ใน Test J |
| **B** | Prereq: A · วันนี้ก่อน cutoff · เลือกสินค้า SAME_DAY ในช่วงเวลาเปิดร้าน → สั่งทันที | ไม่ถูกบังคับเป็น pre-order cutoff · เลือกรอบวันนี้ได้ หรือส่งทันทีตามรอบ · หลัง cutoff แถวรอบแสดง "ปิดรับแล้ว" | ข้อมูลทดสอบ | ได้ | ยกเลิกใน J |
| **C** | Prereq: admin ตั้งรอบ/วันพรุ่งนี้ · ลูกค้าสั่ง PRE_ORDER เลือกวัน+รอบ | เข้า `delivery_rounds` ของรอบนั้น (`current_count` +1) · cutoff บังคับจริง (เกิน cutoff สั่งไม่ได้) · แสดงในรอบ batch ของแอดมิน | ข้อมูลทดสอบ | ได้ | ยกเลิกใน J |
| **D** | Prereq: มีออเดอร์ SAME_DAY 1 + PRE_ORDER 1 · แอดมินใช้หน้าจัดการ/production batch รวม SAME_DAY เข้า batch PRE_ORDER | รวมได้โดย **order_mode/origin/round ของออเดอร์เดิมไม่เปลี่ยน** · มี audit · ไม่สร้างออเดอร์ซ้ำ · ยอด/การจ่ายไม่ถูกข้าม | ข้อมูลทดสอบ | ได้ | ปล่อยไว้/ยกเลิกตามปกติ |
| **E** | Prereq: A (PromptPay) · ลูกค้าส่ง TXN ref + สลิป → แอดมินเปิด Admin Orders → แผงตรวจสลิปเห็นหลักฐาน → กดยืนยัน | แผงแสดงสลิป/สถานะจริง (ไม่ว่างเปล่า) · ยืนยัน 1 ครั้ง → `paid` + `audit_logs payment_processed` · กดซ้ำ = idempotent · ยืนยันครั้งเดียวกับเงินจริง 1 ยอด | **เงินจริง (โอนจริง 1 ครั้ง)** | ทำซ้ำได้ด้วยยอดทดสอบ | ไม่ต้อง (บันทึกเป็นประวัติ) |
| **F** | Prereq: A · เปิดหน้า Kitchen | ออเดอร์เข้าคิวถูกสาขา/ถูกเวลา · เปลี่ยนสถานะไปข้างหน้าได้ตาม chain · ย้อนหลัง/ข้ามขั้นไม่ได้ | ข้อมูลทดสอบ | ได้ | ตาม J |
| **G** | Prereq: F (เตรียมเสร็จ) · แอดมินเปิด Delivery Management → assign ไรเดอร์/รอบ | assign ถูกคน/ถูกไรเดอร์ (Bite Drive) · ไรเดอร์เห็นงานใน PWA · audit `delivery_assigned` | ข้อมูลทดสอบ | ได้ | ตาม H/J |
| **H** | Prereq: G · ไรเดอร์เปิด Bite Drive PWA บนมือถือจริง → รับงาน → เดินทาง → ที่จุดส่ง: **ปุ่มถ่ายรูป** (กล้อง) และ **ปุ่มเลือกรูปจากเครื่อง** ใช้ได้ทั้งคู่ → อัปโหลด → ยืนยันส่ง | เห็น progress รายขั้นตอน · ถ้าเน็ตหลุดมีปุ่มลองใหม่ · `pod-photos` มีไฟล์จริงใต้โฟลเดอร์ `drivers.id/` · สลิป/POD ผูกกับออเดอร์ถูก · **คนอื่นเปิดรูป/ลบ/เขียนทับไม่ได้** | ข้อมูลทดสอบ + ตำแหน่งจริง | ได้ | ปล่อยเป็นหลักฐาน |
| **I** | Prereq: H · ลูกค้าเปิด Track + แอดมินดูหน้าเดียวกัน | ไทม์ไลน์ตรงกับเหตุการณ์จริงทุกฝั่ง (poll/focus refresh — ไม่ใช้ realtime) · สถานะ delivered ขึ้นพร้อมกันเมื่อรีเฟรช | ข้อมูลทดสอบ | ได้ | — |

| ID | ชื่อ/ขั้นตอนโดยย่อ | Expected | เงินจริง/ข้อมูลจริง | ทำซ้ำได้ | Cleanup |
|---|---|---|---|---|---|
| **J** | Failure matrix: (1) จ่ายล้มเหลว/timeout แล้ว retry (2) กดสั่งซ้ำเร็ว ๆ (3) อัปโหลด POD ตัดเน็ต (4) ส่งไม่สำเร็จ/ปิดงานผิด (5) ยกเลิก/คืนเงินตามขอบเขต (6) สถานะสิ้นสุดแล้วถูกกดย้อน/ข้าม | (1) ไม่สร้างออเดอร์ซ้ำ+intent ซ้ำ (2) idempotent (124) (3) error ชัด+ลองใหม่ได้ (4) ไม่พาลทำออเดอร์อื่น delivered (5) refund ผ่าน EF admin-only (6) **ถูกปฏิเสธ** (TERMINAL) | ข้อมูลทดสอบ (ยกเว้น refund จริง = อนุมัติแยก) | ได้ | ยกเลิกออเดอร์ทดสอบตามขั้นตอน |
| **K** | Prereq: มีโค้ดโปรโมชันจริง · ใส่โค้ดในตะกร้า → reload หน้า → ไป checkout → สั่ง | โค้ดคงอยู่หลัง reload (ไม่คืน pending ปลอม) · แสดงส่วนลดที่เดียว ไม่ซ้ำ · ยอด checkout = ยอดที่ server คิดจริง · โค้ดไม่ผ่านเงื่อนไข = แจ้งและไม่ตัดยอดเงียบ | ข้อมูลทดสอบ | ได้ | เอาโค้ดออก |
| **L** | Prereq: build ใหม่ (หลัง push นี้) · เปิดหน้าเลือกที่อยู่/ไรเดอร์แผนที่/Track · ทดสอบทั้งตอน key ใช้ได้และ (ถ้าทำได้) ตอนบล็อก key | แผนที่โหลด + geocode/route ทำงาน หรือ **แสดง fallback ชัดเจน** ("แผนที่ใช้ไม่ได้ชั่วคราว" + ปักหมุด/ที่อยู่ข้อความ) ไม่ใช่จอขาว/เดด | ตำแหน่งจริง | ได้ | — |
| **M** | Prereq: บัญชี admin + staff · เปิด Web POS → สั่ง/รับ pickup → ตั้งค่าเครื่องพิมพ์ → สั่งพิมพ์ (มีเครื่องจริง) | staff เห็นเฉพาะสิทธิ์ตัวเอง · ข้อมูลลูกค้า/เงินรั่วไม่ได้ · print job เข้า `print_jobs` + รายงาน **สำเร็จ/ล้มเหลวจริง** (เครื่องจริงเท่านั้นที่ยืนยันได้) | ข้อมูลทดสอบ + เครื่องพิมพ์จริง | ได้ | ปิดรอบ/shift |
| **N** | Prereq: มี recipe/inventory ตัวอย่าง · สั่งออเดอร์ที่ผูกสูตร → ดู Inventory + Reports | stock ลดตอนขาย/คืนตอนยกเลิก · ไม่ลดซ้ำจาก event ซ้ำ · รายงานขาย/จ่ายเงิน/คืนเงินตรงกับออเดอร์ทดสอบ · **ไม่โชว์กำไรสุทธิปลอม** (§8) | ข้อมูลทดสอบ | ได้ | ปรับ stock คืน |
| **O** | Prereq: none (AI ทำแล้ว — Owner ตรวจหลักฐาน) · ดู §9 + Actions log `daily-backup` | เห็น backup ล่าสุด + drill PASS · ขั้นตอนกู้ใน §9 ทำตามได้จริง | — | ได้ | — |
| **P** | Prereq: ดู `automation_queue` + Actions `automation-scheduler` | jobs `sched-*` รันตามเวลา · ซ้ำแล้วไม่ทำงานซ้ำ (idempotent) · ไม่มี failed ค้าง | ข้อมูลระบบ | ได้ | — |
| **Q** | Prereq: ทดสอบ A–P ครบ · เทียบ `audit_logs` + order_status_history + `payment_intents` | ทุกเหตุการณ์สำคัญมี audit ตรงลำดับเวลา · ยอดขาย/รับเงิน/สลิป/POD สะท้อนกันครบ · **ไม่มี intent ซ้ำคู่ใหม่** (unique index ทำงาน) | ข้อมูลระบบ | ได้ | — |

## 13. Rollback / recovery notes (ถ้า test ไหน FAIL)
- **UI/client:** ย้อน build ได้จาก Cloudflare Pages → Deployments → Rollback ไป build ก่อนหน้า (`index-5LwijPy-.js` = build a6df293) — ไม่ต้องย้อน DB (mig 138/139 เป็น additive + REPLACE function)
- **ถ้าสงสัยว่า mig 138/139 ทำให้พัง:** forward-fix ได้ — ทั้งสองไฟล์เป็น `CREATE OR REPLACE` + policy ใหม่ · ย้อน behavior เดิมได้โดย re-run definition เก่าจาก `008/129/132` (เก็บไว้ครบ) · **ห้าม** `db push` ย้อนมั่ว
- **ปัญหาจ่ายเงิน:** ตรวจ `payment_intents` + `audit_logs` ก่อนเสมอ · ห้าม mark paid มือเปล่า · ใช้ `confirm_offline_payment` เท่านั้น · refund = EF `stripe-refund`/`omise-refund` (admin-only)
- **ปัญหา POD/storage:** ไฟล์ไม่หายเพราะ RLS (upload ผ่าน `driver_attach_pod`) — ตรวจ `proof_of_delivery_path` บน assignment · ถ้า policy พังให้ re-run mig 139
- **ข้อมูลพังหนัก:** restore ตาม §9 (scratch ก่อนเสมอ) + re-apply 138/139 + คืน env

## 14. Updated documentation (paths ใน commit นี้)
- `docs/BMB_R3_ENGINEERING_CLOSURE_2026-10-23.md` (เอกสารนี้ — consolidated package)
- `AI_WORK_STATE.md` (state ledger รอบ 6)
- `docs/BMB_RECOVERY_PLAN_2026-10-23.md` — *ยังใช้เป็น root-cause matrix ได้ · สถานะงานอัปเดตที่เอกสารนี้แทน (supersede เฉพาะ status)*
- Evidence (ไม่ commit — `e2e/artifacts/` ถูก ignore โดยตั้งใจ): `r4-probe-*.json`, `prod-*-138-139.json`, `_tmp_drill*.log`

## 15. FINAL STATUS
**ENGINEERING CLOSURE READY FOR OWNER ACCEPTANCE = YES** (งาน engineering ที่ทำได้จริงเสร็จ + verified ด้วย automated/runtime evidence ครบ · เหลือเฉพาะการทดสอบจริงของ Owner + การตัดสินใจ 3 ข้อ §7)
**ยังไม่ใช่:** DONE / owner-accepted / production-ready แบบสมบูรณ์ — จนกว่า A–Q จะผ่านจริงตามเกณฑ์ 0.1/0.10 ของ UNIVERSAL_MASTER_AI_RULES

