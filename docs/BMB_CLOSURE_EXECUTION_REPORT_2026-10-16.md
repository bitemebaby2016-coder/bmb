# BMB — PRODUCTION CLOSURE EXECUTION REPORT (2026-10-16)
## Owner-Authorized: Publish · Delivery Reset · Migration 124/125 · Test-Content Removal · Acceptance Prep

> คำสั่ง: OWNER AUTHORIZED PRODUCTION CLOSURE EXECUTION (2026-10-16) · baseline = `BMB_CONSOLIDATED_CLOSURE_GAP_AUDIT_2026-10-15.md`
> หลักฐานทั้งหมดเก็บที่ `backups/*2026-10-16*` (gitignored) · เวลาในรายงาน = ไทย (UTC+7) · ศัพท์สถานะ: IMPLEMENTED · CONNECTED · DEPLOYED · RUNTIME VERIFIED · DOCUMENTED · MISSING · BLOCKED · DEFERRED

---

## 1. Git / Deploy baseline — ก่อนและหลัง

| | ก่อนเริ่มงาน | หลังปิดงาน |
|---|---|---|
| HEAD = origin/main | `0587947` (ตรงกับ ls-remote) | `c3fbf28` + commit รายงานนี้ (push แล้ว) |
| Worktree | สะอาด (untracked = audit doc 1 ไฟล์) | สะอาด (commit เฉพาะไฟล์งาน) |
| Stash | `local-edits-before-sync-2026-09-21` ครบ ไม่แตะ | เท่าเดิม ไม่แตะ ✓ |
| Deployed production | `index-D5g1w0jk.js` (marker `:has(.sched-cal`=1 = HEAD) | **`index-Cpdq7RVC.js`** = commit `c3fbf28` (chunk `bmbAdminApi_orders-D2DTTjUB.js` มี `dropoff_detail`×2 — ก่อน deploy = 0) |
| ไฟล์ที่ commit | — | `src/lib/orderAddress.ts`, `src/lib/bmbAdminApi_orders.ts`, `src/pages/admin/DeliveryManagement.tsx`, `src/__tests__/orderAddressFallback.test.ts` (commit `c3fbf28`) + เอกสาร 2 ไฟล์ (audit baseline + รายงานนี้) |
| ห้ามแตะที่ไม่แตะ | — | `.env*`/secrets · backups · stash · untracked เดิม · ไม่มี `git add -A` (stage exact paths เท่านั้น) |

## 2. ตารางงานทุกข้อ (สถานะตามศัพท์โครงการ)

| งาน (ตามคำสั่ง §0) | สถานะ | หลักฐาน |
|---|---|---|
| 1. Publish ตารางเมนู + เตรียมรอบวันทดสอบ | **RUNTIME VERIFIED** | §3–§4 · anon rows=4 · badges /shop=9 /menu=4 |
| 2. จัดการรอบอดีตโดยรักษา history | **RUNTIME VERIFIED** | §5 · past_active 45→0 · orders/assigns 206/10 เท่าเดิม |
| 3. Migration 124 เข้า Production + 125 ledger ถูกต้อง | **RUNTIME VERIFIED** | §6–§7 · ledger 124+125 · verify ครบ |
| 4. กำจัดข้อความทดสอบ (`Test description`) | **RUNTIME VERIFIED** | §8 · 2 รายการล้าง · anon test-strings=0 · audit log ×2 |
| 5. แก้ที่อยู่จัดส่ง DeliveryManagement | **IMPLEMENTED / DEPLOYED** (runtime card = รอ acceptance) | §9 · tests 1,023 · deploy marker |
| 6. Production smoke + เตรียมระบบให้ Owner ทดสอบ | **RUNTIME VERIFIED (smoke) / READY** | §11 · 7 ตรวจ |
| 7. หยุดรอ Owner ทดสอบ (ไม่ประกาศ Production Ready) | **DOCUMENTED** | §13–§14 |
| R10 precheck 18-param (ของเดิม) | **RUNTIME VERIFIED** | pronargs=18, ท้าย `p_customer_ref uuid` |
| R9/R12 (retention/PII, md5) | **DEFERRED — accepted-risk บันทึกแล้ว** | ไม่ใช่ defect กัน apply · มติ retention ยังรอ Owner |
| Dead queue 13 + push subs=0 | **DOCUMENTED / แผนยังไม่ทำ (ตาม §9 คำสั่ง)** | §10 |
| Payment live (Stripe/Omise) · THSMS · Meta · staging · RC-5 | **MISSING/BLOCKED (คงเดิม — นอกคำสั่งนี้)** | §12 |

## 3. Publish ตารางเมนู (§2)

**ก่อน:** `menu_schedule` 6 แถว (16/19/20 ต.ค. ×2) — unpublished ทั้งหมด · `round_key=null` ทุกแถว (ผูกด้วยวันที่)

**ทำ:** RPC `publish_menu_schedule(p_scheduled_date, p_publish=true)` ภายใต้ Dedicated Test Admin session (กลไกเดียวกับปุ่ม Publish ใน /admin/menu-schedule · enforcement ของ migration 123 = 2 รายการ/วัน + สินค้า PRE_ORDER ที่ใช้ได้ — server ตอบ `ok:true, rows:2` ทั้งสองวัน)

| วันที่ | เมนูที่เผยแพร่ (2 ต่อวัน) | ผล customer-facing |
|---|---|---|
| **2026-10-19** | เต้าหู้ย่างผักสามสี (฿79) · สเต็กปลาดอลลี่ (฿79) | anon เห็น 2 แถว · badge วันที่ 19 ขึ้น /shop + /menu |
| **2026-10-20** | กุ้งบ้อคโคลี่ผักสามสี (฿79) · สเต๊กเต้าหู้ (฿79) | anon เห็น 2 แถว · badge วันที่ 20 |

**แถวที่ปล่อยไว้ (ไม่ publish) + เหตุผล:** 2 แถวของ **2026-10-16** — (1) วันที่ = วันนี้ ไม่เข้าเงื่อนไข "อยู่ในอนาคตตามเวลาไทย" ตามตัวอักษร และ (2) **server ห้ามอยู่แล้ว**: 118:138 `ERR_SCHEDULED_DATE_INVALID` (pre-order ต้อง `scheduled_date > today`) → เผยแพร่ไปก็สั่งไม่ได้ ปล่อยไว้ตาม §2

**หลักฐาน:** backups/ops-2026-10-16-log.txt (ANON rows=4) · smoke: /shop `badges=9 date19-visible=true` · /menu คลิกหมวด "จองล่วงหน้า" → `badges=4 has-taohu=true has-19=true` (tab behavior ปกติ)

## 4. Delivery rounds (§3)

| รายการ | ก่อน | หลัง |
|---|---|---|
| rounds ทั้งหมด | 45 | **54** (+9 ใหม่) |
| active ที่เป็นอดีต | **45** | **0** |
| active วันนี้/อนาคต | 0 | **9** (16/19/20 × morning/midday/evening) |
| orders / delivery_assignments | 206 / 10 | **206 / 10 (เท่าเดิม)** |

**วิธีจัดการ:** ① ปิดรอบอดีต 45 = `UPDATE status='closed', updated_at=now()` ด้วย **id เจาะจง 45 รายการ** (ไม่เหมารวม, ไม่ DELETE) — คำสั่งเดียวกับ `setRoundStatus` ของแอป · 'closed' = ค่าที่ CHECK รองรับ + แอปใช้จริง + RPC 025 บล็อกการจอง (`ERR_ROUND_CLOSED`) ② สร้างรอบใหม่ด้วย RPC **`ensure_rounds_for_date`** ×3 วัน = กลไก canonical (024/029, id `round-YYYYMMDD-key`, template-validated) → morning (cutoff 23:59, 08:00–20:00, cap 100) · midday (10:30, 11:00–14:00, 80) · evening (16:00, 17:00–20:00, 100)

**history ไม่สูญหาย:** ไม่แตะ `orders`/`order_items`/`delivery_assignments`/`order_status_history` (นับเท่าเดิม) · รอบที่มีออเดอร์ (round-w3b-test 124 ออเดอร์ ฯลฯ) อยู่ครบ + FK เดิม — เปลี่ยนเฉพาะ `status` (ย้อนกลับได้) · before/after + id list = backups/ops-2026-10-16-log.txt

## 5. Migration 124 — Order idempotency (§4)

| หัวข้อ | ผล |
|---|---|
| **diff SHA** | `124_order_submit_idempotency.sql` SHA256 `A49C9A9C11CDDDCC…` (W5C R1/R2/R3 + strict CHECK — commit `06a697b`) = ไฟล์เดียวกับที่ contract ทดสอบ (ไม่แก้ระหว่างงาน) |
| **backup evidence** | `backups/pre-124-snapshot-2026-10-16.json` 74,882 bytes (13:1x น.) = `pg_get_functiondef(create_order_with_items)` (def_md5 `febfd48fc74117991b9aeca63566dbe7`) + grants + ledger + counts ทั้งระบบ · **หมายเหตุ:** platform daily backups = ว่าง (`walg_enabled=true, pitr_enabled=false, backups:[]`) — แนะนำเปิด PITR/เพิ่ม scheduled backup (gap ให้ Owner ตัดสินใจ) |
| **contract/concurrency** | **local harness ALL_GREEN สด 2026-10-16** (001-123 → contract 123 → apply 124 → T1-T18+T8b+T2b → cleanup → concurrency 2 sessions + R6b race) · อ้างอิง CI Contract Tests #22 (SHA-bound) + ALL_GREEN ×2 รอบ W5C · `unique_violation` branch = defense-in-depth ไม่มี runtime coverage (ยอมรับไว้) |
| **preflight 8/8** | ①diff↔contract ②signature 18-param ③unique/RLS/grants/advisory-lock/replay/payment_intents (T8b) ④tests ล่าสุด ⑤R9/R12 = accepted-risk บันทึก (retention = มติภายหลัง; sha256 = hardening อนาคต — ไม่ใช่ defect กัน apply) ⑥backup ใหม่วันนี้ ⑦ledger ไม่มี 124 (42P01) ⑧maintenance window (ร้านยังไม่เปิด) + rollback (DROP `_i`+table + restore 118 def จาก snapshot) |
| **apply result** | `supabase db push --linked --skip-vault --include-all` — dry-run ×2 ยืนยัน "Would push: • 124_order_submit_idempotency.sql" (ไฟล์เดียว) → apply จริง **exit 0** · `--skip-vault` กันแตะ secrets · บันทึกเทคนิค: รอบแรกค้างที่คำถาม `[Y/n]` interactive (ไม่ใช่ password) — แก้ด้วย stdin `< NUL` = default Y |
| **verify หลัง apply (read-only)** | ledger `124 order_submit_idempotency` ✓ · `order_submissions` = 6 คอลัมน์ตรง source + PK + CHECK `os_result_has_order` · **RLS on, 0 policies, grants = postgres เท่านั้น** · `_i` = 19 args + EXECUTE authenticated/postgres/service_role · canonical helper = postgres-only · **`create_order_with_items` 118 def_md5 เท่าเดิมเป๊ะ** · counts 206/203/56/454 เท่าเดิม · anon อ่าน submissions ไม่ได้ (401/42501) |

## 6. Migration 125 — Ledger reconcile (§5)

| หัวข้อ | ผล |
|---|---|
| **schema evidence** | เทียบ body จริง repo↔prod: `resolve_home_branch_id` · `upsert_driver` · `assign_driver` · `driver_login` = **contained-in-prod ×4** + defaults (`drivers.home_branch_id=resolve_home_branch_id()`) + RPC ทั้ง 3 ใช้ resolver |
| **repair method** | **`supabase migration repair --status applied --linked 125`** (กลไกทางการ CLI) → "Repaired migration history: [125] => applied" **exit 0** — ไม่ insert ledger ด้วย SQL เอง |
| **proof ไม่ execute ซ้ำ** | def_md5 `create_order_with_items` เท่าเดิมก่อน/หลัง · prosrc 4 ฟังก์ชันเท่าเดิม · `migration list` เปลี่ยนเฉพาะช่อง Remote = ledger-only |
| **ท้ายงาน** | `migration list` = **123/124/125 ตรงกัน Local+Remote — ไม่มี pending/drift** (ก่อนหน้า 124+125 ขาดทั้งคู่ — repair ก่อน push จึงป้องกัน execute 125 ซ้ำได้ทัน) |

## 7. คำบรรยาย/ข้อมูลเมนูทดสอบ (§6)

**แก้แล้ว (audit trail ครบ):** 2 รายการ — ค่าเดิม `description: "Test description"` → ค่าใหม่ `""` (ค่าว่างตามแบบสินค้าอื่นในระบบ; ไม่แต่งคำบรรยายใหม่) · ราคา/ชื่อ/สต็อก/สถานะ **ไม่แตะ**

| สินค้า | id | ก่อน → หลัง |
|---|---|---|
| ข้าวลาบอกไก่+ไข่ต้ม (฿69) | `prod-1789610117076-2p5e8u` | "Test description" → "" |
| สปาเกตตี้ผัดพริกแห้งกุ้ง (฿99) | `prod-1789607383214-t8rm95` | "Test description" → "" |

- **auditability:** เขียนผ่านช่องทางเดียวกับ `updateProduct` ของแอป (PostgREST update ภายใต้ Test Admin session) + **audit_logs จริง 2 แถว** (`append_audit_log` → `alog-…-2b9b01`, `alog-…-89250d`, user=test admin, metadata before/after)
- **ตรวจหลังแก้:** anon customer view = 19 สินค้า, **test-strings เหลือ 0** · scan `%test%` เหลือเฉพาะรายการที่ไม่ได้แก้ (ด้านล่าง)

**รายการที่ยังต้องให้ Owner ตัดสิน (ไม่แตะ — นอกขอบเขต/เจตนาไม่ชัด):**
| รายการ | เหตุผลที่ไม่แก้ |
|---|---|
| `coming soon` ×2 (`prod-1791769642687-89fvpq`, `prod-1791769591910-vy5ad7`) ฿1, descr="new products" | ดูเป็น placeholder แต่อาจเป็น teaser ที่ Owner ตั้งใจ (มีภาพ coming-soon ในระบบ) — ชื่อไม่ใช่ "test" |
| `prod-1` ผัดไทยกุ้งสด (descr="ข้าวกุ้งผัดพริกเกลือ") | คำบรรยายไม่ตรงชื่อเมนู = เนื้อหาผิด ไม่ใช่ test content — ห้ามเปลี่ยนเนื้อหาธุรกิจโดยไม่อนุมัติ |
| `prod-w3c-test-pre` "W3C Test Preorder Product" descr="TEST DATA ONLY (W3-C)" | ระบุว่า test จริง แต่ `is_available=false` = **ไม่แสดงต่อลูกค้า** → ห้ามลบสินค้าตาม §6 · แนะนำ Owner ตัดสินใจลบ/เก็บถาวร |

## 8. DeliveryManagement ที่อยู่จัดส่ง (§7)

| หัวข้อ | ผล |
|---|---|
| **โค้ด** | ใหม่ `src/lib/orderAddress.ts` (`resolveOrderDeliveryAddress` — เลือก `delivery_address` ก่อน ถ้าว่าง/เว้นวรรค → fallback `dropoff_detail` → ถ้าว่างคืน '') + normalize ใน `hydrateOrderItems` (**ทุก read path ของแอดมิน**) + บรรทัด `📍` ใน DeliveryManagement เรียก helper · **ไม่สร้าง migration `delivery_address`** ตามคำสั่ง |
| **tests** | `orderAddressFallback.test.ts` 6 กรณี (fallback/ว่าง/null/trim/ลำดับความสำคัญ) + regression เต็ม **99 ไฟล์ 1,023 เทสต์ ผ่านทั้งหมด** · tsc 0 · lint 0 · build 0 |
| **deploy** | commit `c3fbf28` → `index-Cpdq7RVC.js` + chunk `bmbAdminApi_orders-D2DTTjUB.js` มี `dropoff_detail`×2 (ก่อน deploy = 0) = **โค้ดขึ้น production จริง** |
| **runtime** | บรรทัด `📍` อยู่ในบัตร "คิว Dispatch — พร้อมส่ง" (readyQ) · **readyQ ว่าง** (ออเดอร์ 206 ใบ = cancelled 205 + delivered 1 = terminal ทั้งหมด ไม่มีใบใน ready_for_dispatch) → ยังไม่มีบัตรให้แสดง · ตาราง "กำลังเดินทาง/ส่งแล้ว" = ไม่มีคอลัมน์ที่อยู่ (ดีไซน์เดิม ไม่เกี่ยวกับบั๊กนี้) · ออเดอร์อ้างอิง `PO-20260929-131` มี `dropoff_detail="QA TEST ADDRESS (W5-2) — TEST DATA ONLY"` (ข้อมูล history ไม่แตะ) · **ยืนยันบรรทัดที่อยู่แบบ runtime เต็มรูปแบบ = checklist ข้อ 5 ของ acceptance test** (ออเดอร์จริงจะเข้า readyQ ตอนครัวทำเสร็จ) |

## 9. Dead queue 13 + Push (§9)

- **รายการที่ตรวจ:** 13/13 = `sched-notification_dispatch-gh-dispatch-20261005t0405…0909` — scheduled **batch dispatch** ของ GitHub scheduler วันที่ 2026-10-05 (04:05–09:09 UTC, ทุก ~25 นาที), attempts 3/3, payload `{limit:200, lookbackMinutes:360}`, `last_error="worker_http=200 status=failed"` — **ไม่ใช่ข้อความรายลูกค้า** เป็น job สแกน/ยิง notification รอบเวลา · queue โดยรวมยังทำงานปกติ (succeeded 1,555→1,570+) = ความล้มเหลวเฉพาะ window วันที่ 5
- **backup/export:** ครบใน `backups/pre-124-snapshot-2026-10-16.json` (dead_queue rows ทั้ง 13)
- **แผนที่ยังไม่ทำ (ตามคำสั่ง — ไม่ retry/ไม่ลบ):** ① ไม่ retry — retry = dispatch รอบเวลาใหม่ = **ความเสี่ยงข้อความซ้ำถึงลูกค้า** → ต้องอนุมัติรายรายการ (§9 คำสั่ง) ② เสนอทางเลือก: ปล่อยทิ้งไว้เป็นประวัติ / archive เมื่อมีนโยบาย retention ③ `push_subscriptions=0` = **missing runtime setup** (ต้องลงทะเบียนอุปกรณ์จริงตอนทดสอบ — ไม่สร้าง subscriber ปลอม)

## 10. Production smoke — 2026-10-16 13:45–13:52 น. (§8, read-only ทั้งชุด)

| # | ตรวจ | ผล | หลักฐาน |
|---|---|---|---|
| 1 | HTTP 200 + asset/build identity | **PASS** | `index-Cpdq7RVC.js` = `c3fbf28` (marker `dropoff_detail` ใน chunk) |
| 2 | /shop, /menu, หมวด, รูป, ราคา, availability | **PASS** | HTTP 200 · /shop badges=9+วันที่ 19 · /menu (คลิกหมวด) badges=4 · หมวดสองชั้นปกติ |
| 3 | RLS menu_schedule + products | **PASS** | anon เห็นเฉพาะ published (4 แถว) / available (19 สินค้า) · order_submissions anon=401 |
| 4 | Admin GET: Orders/Kitchen/MenuSchedule/Rounds/Delivery/Products | **PASS 7/7** | login ผ่าน test admin · ทุกหน้า HTTP 200, login-wall=false |
| 5 | DeliveryManagement แสดง dropoff_detail | **PASS-by-code/deploy/tests** | ดู §8 — runtime card รอออเดอร์จริงใน acceptance |
| 6 | Order tracking ออเดอร์เก่า | **PASS** | `/track/PO-20260929-131` HTTP 200, has-order=true |
| 7 | console/network errors + ป้ายหลัง publish | **PASS (มีหมายเหตุ)** | รอบแรกเจอ 1 transient 403 (resource ไม่ระบุ) — รอบ re-check 2 ครั้งถัดมา = **0 errors/0 failed resources** · ป้ายวันเมนูขึ้นแล้วตามข้อ 2 |

## 11. Blocker ที่เหลือ (เหตุผลที่ยังไม่ปิด)

| # | รายการ | เหตุผล |
|---|---|---|
| 1 | **`_i` ยังไม่ถูก wire เข้าแอป** — client (`m1Submit`) ยังเรียก `create_order_with_items` เดิมโดยไม่ส่ง `p_client_submit_key` | 124 เข้า production แล้วแต่ **การป้องกันออเดอร์ซ้ำยังไม่ active ใน UI** = ต้องแก้โค้ด checkout + tests (นอกคำสั่งนี้ — เสนอเป็นงานถัดไป **ก่อน** acceptance test ถ้าต้องการทดสอบ double-submit) |
| 2 | Payment live (Stripe/Omise) | ยังเป็น key ทดสอบ — ไม่อนุมัติ cutover ในคำสั่งนี้ · แผนทดสอบใช้ PromptPay QR/โอนแทน |
| 3 | THSMS runtime / Meta real events / push device | ไม่ส่งของจริงตามคำสั่ง §10 · push subs=0 = ต้องลงทะเบียนอุปกรณ์ |
| 4 | Staging + R11 (`_i` ผ่าน pgbouncer) | ยังไม่มี staging (deferred ก่อนเปิดร้าน) |
| 5 | R9/R13/R15 + md5→sha256 (R12) | accepted-risk บันทึกแล้ว · มติ retention/hardening = รอ Owner |
| 6 | `PROPOSED_wave5_orders_delivery_address.sql` | ใช้ UI fallback แล้ว — migration = optional parity (ต้อง Owner อนุมัติ + แก้ comment ที่ผิดก่อน) |
| 7 | ข้อมูลเมนู 3 กลุ่ม (§7 ตารางล่าง) | ต้อง Owner ตัดสิน |
| 8 | Platform daily backups ว่าง (WAL-G only) | แนะนำเปิด PITR/scheduled backup |
| 9 | RC-5 deploy SHA binding | ยังไม่มี build identity ในระบบ (ใช้ marker scan เป็น interim) |
| 10 | Dead queue 13 | รอ Owner อนุมัติ retry/archive รายรายการ (§9) |

## 12. Acceptance checklist — ออเดอร์จริง 1 ใบ วงเงินรวม ≤ 300 บาท (ให้ Owner ทำตาม)

**เตรียมพร้อมแล้ววันนี้:** เมนู 19/20 ต.ค. เผยแพร่แล้ว (badge ขึ้นจริง) · รอบส่ง 16/19/20 ต.ค. active พร้อม (morning/midday/evening) · ระบบสะอาด (ไม่มีรอบอดีตปน, ไม่มีข้อความทดสอบ) · migration 124/125 เรียบร้อย

| ขั้น | ทำอะไร | ตรวจอะไร | งบ |
|---|---|---|---|
| 0 เตรียม | เลือกวันทดสอบ (19 หรือ 20 ต.ค. = pre-order / วันนี้ = same-day ก่อน 23:59) · เปิด /shop หรือ /menu | badge วัน-เดือนขึ้นตรง menu_schedule | — |
| 1 สั่งซื้อ | เลือกเมนูจากช่องจองล่วงหน้า (เต้าหู้ย่างผักสามสี ฿79 / สเต็กปลาดอลลี่ ฿79 ฯลฯ) → ตะกร้า → checkout → login (OTP หรือ password) → ที่อยู่ในโซน 5 กม. | 1 การ์ด = 1 ปุ่ม · วันที่ badge ตรงกับรอบที่เลือก | อาหาร ≤200 |
| 2 จ่ายจริง | **PromptPay QR / โอนธนาคาร** → สแกนโอนจริง | แอดมินเห็น intent pending → ตรวจ**เงินเข้าบัญชีจริงตรงยอด** (ไม่ใช่แค่สลิป) → ยืนยันชำระเงิน (คู่มือ บ.8) → `payment_status=completed` | ≤250 |
| 3 ครัว | `/admin/kitchen` → preparing → ready | notification เกิด (ระวัง dead queue ใหม่) · **บรรทัด `📍` บนบัตร dispatch ต้องแสดงที่อยู่จริง (ไม่ใช่ —)** ← ยืนยัน §7/§8 | — |
| 4 Bite Drive | `/admin/delivery` assign ไรเดอร์ → ไรเดอร์รับที่ `/rider` → picked_up → in_transit → delivered | assignment timestamps ครบ · ไรเดอร์ login ได้จริง (m125) | ≤50 (ค่าส่ง) |
| 5 Tracking | เปิด `/track/<order_number>` คู่กัน | timeline ตรง · ยอด = subtotal+fee−discount | — |
| 6 จบ | ตรวจ `order_status_history` + เงินเข้าจริง + screenshot ทุก step | ทุกอย่างตรง · เก็บออเดอร์+intent เป็นหลักฐาน (ห้ามลบ) | **รวม ≤300** |

**Failure/rollback:** QR หมดอายุ → แอดมิน cancel intent (ไม่ charge) · ไรเดอร์ไม่รับ → assign ใหม่ · คิวช้า → เลื่อนรอบ · ผิดพลาดหนัก → แอดมินยกเลิกออเดอร์ + คืนเงินโอนมือ · เก็บหลักฐานทั้งหมด + backup ก่อน/หลัง

## 13. GO / NO-GO

| คำถาม | คำตัดสิน |
|---|---|
| **Owner acceptance test (1 ออเดอร์ ≤300 บาท)** | 🟢 **GO** — ระบบพร้อมตาม checklist §12 · เลือก PromptPay QR/โอนเป็นช่องทางเงิน · ถ้าต้องการทดสอบกันออเดอร์ซ้ำ ให้รอ wire `_i` ก่อน (§11 ข้อ 1) |
| **Production Ready / เปิดร้าน** | 🔴 **NO-GO (คงเดิม)** — payment live/SMS/push/staging ยังไม่ครบ · ห้ามประกาศจาก migration/smoke บางส่วนที่ผ่าน |

---

`OWNER ACCEPTANCE TEST = READY`
`REAL PAYMENT = NOT STARTED`
`REAL ORDER / COOKING / DISPATCH = NOT STARTED`
`OPEN SHOP = NOT AUTHORIZED BY THIS TASK`

---
*รายงาน: BMB_CLOSURE_EXECUTION_REPORT_2026-10-16 · หลักฐาน = backups/*2026-10-16* · ทุกการเขียนข้อมูลมี before/after + audit trail · ไม่มีการ charge/ส่ง SMS/push/dispatch/ลบข้อมูล/แตะ secrets ตลอดงานนี้*