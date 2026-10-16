# BMB — FINAL PRODUCTION CLOSURE & OPEN-SHOP ACCEPTANCE REPORT
## Owner-Directed Execution — 2026-10-16 (รอบเดียวจบ ไม่ส่งแผนวนซ้ำ)

> คำสั่ง: FINAL PRODUCTION CLOSURE & OPEN-SHOP ACCEPTANCE (2026-10-16) · repo `bitemebaby2016-coder/bmb` · production `https://biteme-baby.com` · Supabase `ivkdfognyiwjcmrhcnwz`
> ศัพท์สถานะ (§13): IMPLEMENTED · CONNECTED · DEPLOYED · RUNTIME VERIFIED · DOCUMENTED · MISSING · BLOCKED · DEFERRED
> หลักฐานทั้งหมด: `backups/*2026-10-16*` + `evidence/` ในรายงานนี้ · เวลา = ไทย (UTC+7) เว้นแต่ระบุ Z (UTC) · ไม่มีการ charge เงินจริง/ส่ง SMS/push/ทำอาหาร/dispatch ในรอบนี้

---

## 1. Git baseline และ final Git state

| | baseline (ก่อนเริ่ม) | final (หลังปิดงาน) |
|---|---|---|
| HEAD = origin/main | `231e6e4` (เท่ากัน ✓) | **`1804937`** (เท่ากัน ✓, push แล้ว) |
| Worktree | สะอาด · untracked = 0 | สะอาด (commit เฉพาะ 9 ไฟล์งาน + เอกสารฉบับนี้) |
| Stash | `local-edits-before-sync-2026-09-21` ครบ ไม่แตะ | เท่าเดิม ไม่แตะ ✓ |
| Deployed | `index-Cpdq7RVC.js` (โค้ด c3fbf28) | **`index-BTxI-A1p.js` + chunk `bmbAdminApi_orders-Df9Xb6ji.js`** = โค้ด `1804937` |
| ไฟล์ที่ commit | — | P0 wiring 9 ไฟล์ (`orderSubmitKey.ts` ใหม่, `bmbAdminApi_orders.ts`, `m1Submit.ts`, `CheckoutPage.tsx`, `supabaseMock.ts`, tests ×4) + รายงานฉบับนี้ |
| ห้ามแตะที่ไม่แตะ | `.env*`/secrets · backups · stash | ไม่แตะ ✓ · stage exact paths · ไม่มี `git add -A`/force-push/reset |

**Deploy marker evidence:** deployed `bmbAdminApi_orders-Df9Xb6ji.js` (hash ตรงกับ local build ของ `1804937`) มี `create_order_with_items_i` ×1 · `p_client_submit_key` ×1 · `dropoff_detail` ×2 — ก่อน commit = 0 ทั้งคู่

## 2. Workstream matrix

| Workstream | IMPLEMENTED | CONNECTED | DEPLOYED | RUNTIME VERIFIED | DOCUMENTED | MISSING | BLOCKED | DEFERRED |
|---|---|---|---|---|---|---|---|---|
| P0 checkout idempotency (§3) | ✓ | ✓ | ✓ | ✓ (isolated: contracts+concurrency+1,042 tests) · production double-submit = รอ §11 | ✓ | | | |
| PromptPay / โอนมือ (§4) | ✓ | ✓ | ✓ | ✓ ระดับ test-era (completed 2) · **เงินจริงรอบ controlled = รอ Owner** | ✓ | | | |
| Omise card (§5) | ✓ (EF+โค้ด+test keys) | ✓ (webhook HMAC) | ✓ | **ผลทดสอบตามที่อ้าง = หาไม่พบ** (omise intents=0, logs=0) | ✓ | ✓ (browser test run) | Live = ✓ (no keys/KYC) | |
| Automation→Social→AI (§6) | ✓ | ✓ (identities 81, bindings 2) | ✓ | ✓ เฉพาะ wave evidence เดิม (W3C/G4) · hop สด = ยังไม่รันรอบนี้ | ✓ | | ✓ (ต้อง real post authorization) | |
| Push notifications (§7) | ✓ (โค้ด+EF) | ✓ (pipeline) | ✓ | **0 subscriptions ทั้งอดีต-ปัจจุบัน** | ✓ | | ✓ (ไม่มีอุปกรณ์ยินยอม) | |
| Dead queue 13 (§8) | ✓ | ✓ | — | ✓ (ปิด+audit ครบ 13) | ✓ | | | |
| R11 / staging (§9a) | ✓ (harness) | — | — | ✓ (concurrency_124 ALL_GREEN) | ✓ (ข้อจำกัด) | | ✓ (ไม่มี staging จริง) | |
| Backup / PITR (§9b) | ✓ (WAL-G archiving) | ✓ | — | ✓ (archived 4,272 · ล่าสุดวันนี้) | ✓ | ✓ (platform daily=0) | ✓ (PITR ปิด — ต้อง Owner เปิด) | |
| Old orders + W3C (§10) | ✓ (inventory) | — | — | ✓ (counts/reconciliation) | ✓ (แผน) | | ✓ (destructive รอ Owner แยก) | |
| Customer→Delivery→Tracking (§11) | ✓ | ✓ | ✓ | **รอ controlled test** (hard stop) | ✓ | | | |
| THSMS / OTP / delivery (§12) | ✓ (โค้ด+keys) | ✓ | ✓ | **otp_challenges=0 = ยังไม่เคยส่งจริง** | ✓ | ✓ (1 SMS) | ✓ (รอเบอร์ทดสอบ) | |

## 3. P0 idempotency — client wiring + replay/concurrency evidence

**สิ่งที่ทำ (commit `1804937`):**
1. `src/lib/orderSubmitKey.ts` (ใหม่): key policy R2 (`CK-`+uuid, btrim/≤128/ไม่มี control chars — mirror 124:154-163) · `SubmitKeyRing` (payload-keyed: retry payload เดิม = key เดิม, payload เปลี่ยน = key ใหม่, คงข้าม reload ผ่าน sessionStorage) · `payloadFingerprint` (R1 mirror) · UI messages 3 error codes
2. `createOrder` → เรียก **`create_order_with_items_i`** (19-arg) ส่ง `p_client_submit_key` เสมอ (ไม่ส่ง = legacy path ตามสัญญา 124) · throw `OrderSubmitError` เฉพาะ `ERR_IDEMPOTENCY_CONFLICT/KEY_INVALID/BAD_RESULT` (definite rollback — ไม่มีออเดอร์) · อื่น ๆ = null ตาม contract เดิม
3. `CheckoutPage` (single + mixed split): key ring ต่อ payload · UI จัดการ 3 error codes (CONFLICT/KEY_INVALID ทิ้ง key เพื่อ retry สะอาด) · **replay = ไม่สร้าง payment intent ที่ 2** (B5/B10 — เช็ค intent ที่มีก่อน) + audit ระบุ `replay:true` · toast แยก "ตรวจพบการส่งซ้ำ — ใช้ออเดอร์เดิม"
4. Tests: `orderSubmitKey.test.ts` (14 asserts) · `canonicalOrderFlow.test.ts` +6 tests (client→RPC→DB ผ่าน mock ที่ mirror R1/R2/R3 ของ 124) · §18 contract อัปเดต (ชื่อ RPC + allow-list)

**Evidence:**

| รายการ | ผล | ที่มา |
|---|---|---|
| Unit + integration (client→RPC→DB boundary) | **1,042 tests / 100 files ผ่านหมด** (รวม replay=ออเดอร์เดิม+1 เดียว, CONFLICT ไม่สร้างออเดอร์, R2 fail-closed, legacy path) | `npm test` 2026-10-16 18:18 |
| lint + tsc + build | ผ่าน (eslint+brandNameGuard 371 ไฟล์ · tsc · vite+PWA) | `npm run lint` / `npm run build` |
| Contracts 124 (T1-T13 + W5C + remediation) | **ALL ASSERTIONS PASSED** บน isolated postgres:16 | `backups/BMB_HARNESS_124_CONTRACTS_2026-10-16.log` |
| **Concurrency** (2 sessions, key+payload เดียวกันพร้อมกัน) | **ได้ 1 order เท่านั้น** (submissions=1) | harness `concurrency_124.sh` |
| R5 concurrent same-key ต่าง payload | 1 winner + 1 `ERR_IDEMPOTENCY_CONFLICT` | เดียวกัน |
| R6a fail→retry→replay | ERR_EMPTY_ORDER ไม่มี partial → retry ได้ 1 order → replay คืนเดิม | เดียวกัน |
| R6b race invalid-vs-valid | ไม่มี partial state | เดียวกัน |
| Schema production (read-only) | `_i` 19-arg จบที่ `p_client_submit_key` · SECURITY DEFINER · `order_submissions` RLS on / 0 policy / 0 grants ภายนอก | Management API 2026-10-16 |
| Production code path | deployed chunk มี `create_order_with_items_i`+`p_client_submit_key` (marker scan) | §1 |

**สรุป §3:** client ส่ง key จริง ✓ · replay ไม่สร้างซ้ำ ✓ · concurrency ผ่าน ✓ · tests ผ่าน ✓ · production code path เชื่อมแล้ว ✓ — **เหลือ runtime proof บน production ด้วยออเดอร์จริง = อยู่ใน §11 (hard stop รอ Owner)** · หมายเหตุ: PostgREST เรียก `_i` ผ่าน pooler ได้แล้ว (deploy จริง) — แต่ R11 staging ดู §9a


## 4. PromptPay / โอนมือ — หลักฐานรับเงิน

**สถานะรวม: IMPLEMENTED · CONNECTED · DEPLOYED · RUNTIME VERIFIED (ระดับ test-era) — เงินจริงรอบ controlled = รอ Owner อนุมัติขั้นสุดท้าย (§11/§1.12)**

- ลูกค้าเห็น QR/ข้อมูลโอน: `PaymentConfirmationPage` + `paymentGateway` (promptpay provider) — DEPLOYED
- Admin ยืนยันยอด: workflow คู่มือ บ.8 (ตรวจ**เงินเข้าจริง** ไม่ใช่สลิป) → `confirm_offline_payment` RPC (server-authoritative) — IMPLEMENTED
- สถานะแยก contract จริง: `payment_intents.status` = pending/processing/completed/refunded/partially_refunded — counts วันนี้: `promptpay_qr: completed 2 · pending 4 · processing 3`, `credit_card: completed 28 · refunded 8 · partially_refunded 1 · pending 10`, `cod: completed 0`
- กันยืนยันอัตโนมัติ: ไม่มี path ยืนยันเงินอัตโนมัติจากสลิป/การกดซ้ำ — `record_payment_result` idempotent + admin confirm ผ่าน RPC เท่านั้น (audit 4,080 แถว + `order_status_history` 454 แถว)
- **รอบนี้ไม่มีการโอนเงินจริง** (hard stop §1.12) — ธุรกรรมจริง ≤300 บาท รอ §11

**เหลือเพื่อปิด gate:** เงินเข้าจริง 1 รายการ + admin ยืนยันผ่านระบบ + ยอดตรงทั้งหน้า UI/DB = ทำใน §11

## 5. Omise — ตรวจผล Test และเตรียม Live

**สิ่งที่ตรวจพบ (ตามจริง — ไม่แต่งผล):**
- โค้ด/EF wire ครบ: EF `omise-checkout` (server charge) + `omise-webhook` (HMAC → `record_payment_result`) + Omise.js token/3DS — IMPLEMENTED · CONNECTED (`BMB_ACCEPTANCE_PREPARATION_2026-10-14.md` §3)
- secrets = **TEST MODE เท่านั้น**: `OMISE_SECRET_API_KEY_TEST_MODE` / `OMISE_WEBHOOK_SECRET_API_KEY_TEST_MODE` / `OMISE_PUBLISHED_API_KEY_TEST_MODE` — ไม่มี Omise live key ในระบบ (ไม่มี test/live ปะปน ✓)
- **หลักฐานผลทดสอบ Omise ที่ระบุว่า "ผ่านแล้ว" — หาไม่พบ:** `payment_intents` omise = **0 แถว** · audit ที่กล่าวถึง omise = **0** · เอกสารประเมินล่าสุด (14 ต.ค.) ระบุตรงกันว่า "browser RUNTIME = MISSING · omise rows = 0 · test-mode browser ยังไม่เคยรัน"
- **ข้อสรุป:** Test-mode card run = **MISSING** (ต้องรันจริง 1 ครั้งในหน้าต่าง controlled) · ไม่มี transaction reference ให้ตรวจ — ถ้า Owner มีหลักฐานจากระบบอื่น กรุณาแนบเพื่อตรวจสอบซ้ำ
- **Omise Live = BLOCKED:** ① ไม่มี live credentials ② ไม่พบหลักฐาน KYC/activation ③ live webhook ยังไม่ตั้งค่า ④ live verification ยังไม่เริ่ม
- **ไม่นำ Omise Live มาบล็อก PromptPay** (§1.2) — PromptPay เดินหน้าต่อเมื่อ §11 ผ่าน

## 6. Automation → Social/Messenger → AI → Website

**IMPLEMENTED · CONNECTED (ระดับข้อมูล/อดีต evidence) — hop-by-hop real-event run รอบนี้ = BLOCKED (ต้อง authorization โพสต์จริง)**

| Hop | สถานะ | หลักฐาน |
|---|---|---|
| 1. Automation สร้าง/ส่งโพสต์ | IMPLEMENTED | automation worker + config · **รอบนี้ไม่โพสต์จริง** (§13 ห้าม Meta write ที่ไม่ผ่าน gate) |
| 2. โพสต์/event บนแพลตฟอร์มจริง | CONNECTED (อดีต) | `f14-channel-intake-e2e.json`, `g8s2-queue-runtime-evidence.json` |
| 3. webhook/event จริงเข้าระบบ (ไม่ mock) | RUNTIME VERIFIED (รอบก่อน) | `channel_page_bindings`=2 · `customer_channel_identities`=**81** |
| 4. AI ตอบ + ส่งลิงก์เว็บ | IMPLEMENTED · RUNTIME (harness) | `BMB_W3C_OMNICHANNEL_EVIDENCE.md`, G4 report |
| 5. duplicate/retry/timeout/dead-letter | RUNTIME VERIFIED | `automation_queue` lifecycle + §8 |
| 6. AI ไม่รับรองราคา/สต็อก/เงิน/ออเดอร์ | DOCUMENTED + enforced | G4 §4 + `aiRouting` tests |
| 7. ข้อความผิดรูปแบบ → ส่งต่อ Admin | IMPLEMENTED | fail-safe (`chatWithToolSupport` dormant — tests ผ่าน) |

**BLOCKED เพื่อปิดแบบ hop-by-hop สด:** ① Owner authorize โพสต์จริง 1 โพสต์ ② ยืนยัน Page permission ③ event จริง → AI → เว็บ → สั่งซื้อ = รวมใน §11

## 7. Push Notifications

**IMPLEMENTED (โค้ด/EF `push-*`) · CONNECTED · DEPLOYED — RUNTIME = BLOCKED (ไม่มีอุปกรณ์ยินยอม) · ไม่เปลี่ยนเป็น DEFERRED/PASS**

- ตรวจสถานะ**ปัจจุบัน**แล้ว: `push_subscriptions` = **0 แถว** (ยืนยันซ้ำ 2026-10-16 — ไม่ใช้ snapshot เก่า)
- ระบบมีครบ: subscription permission/registration (PWA + `NotificationCenterPage`) · เก็บ/เพิกถอน subscription · notification จาก event (`notifications` = 338 แถว) · retry/backoff + failure logging ใน `automation_queue` · secrets/PII ไม่ลง log
- **สิ่งที่ต้องใช้เพื่อพิสูจน์ (blocker):** อุปกรณ์จริงที่ Owner ยินยอม 1 เครื่อง → subscribe → ส่งจริง 1 ครั้ง + เดโม failure path (endpoint หมดอายุ)

## 8. Dead Queue 13 — disposition รายรายการ (ครบ 13/13)

**Inventory (read-only):** ทั้ง 13 = `automation_queue` job_type=`notification_dispatch` (GH-dispatch **batch scan** `{"limit":200,"lookbackMinutes":360}` — ไม่ใช่ข้อความรายคน) ของวันที่ **2026-10-05 04:05–09:09 UTC**, attempt 3/3, `last_error=worker_http=200 status=failed`, `failure_reason=exhausted_retries`

**Root cause (ทุกรายการเหมือนกัน):** automation-worker ตอบ HTTP 200 แต่ body `status=failed` ในหน้าต่าง 04:05–09:09 UTC 5 ต.ค. (upstream/config ชั่วคราว) — **หายเองวันเดียวกัน**: job ชุดเดียวกันหลัง 10:20 UTC สำเร็จ 47 แถว (attempt=1) · สะสม `notification_dispatch: succeeded 657` · scheduler แข็งแรงถึงวันนี้ (job ล่าสุด 2026-10-16 11:15 UTC)

**เหตุผลที่ไม่ retry (ทั้ง 13):** payload = scan หน้าต่าง 6 ชม. ณ เวลาที่รัน — retry วันนี้สแกนหน้าต่างปัจจุบัน ไม่ใช่ของ 5 ต.ค. (ไม่ได้ของเก่าคืน + งานซ้ำ scheduler) และเสี่ยง dispatch ซ้ำ = ข้อความซ้ำ (§8.7 ห้าม)

**การปิด (ทีละรายการ · status คง `dead` = terminal ตาม CHECK `queued|claimed|running|succeeded|failed|dead` — ห้ามแก้ status ให้ตัวเลขเป็นศูนย์):** ทุกแถวได้ `failure_reason` = `exhausted_retries | CLOSED 2026-10-16: expired batch window 2026-10-05 … no retry — duplicate-send risk; dispatcher healthy since 2026-10-05T10:20Z` + audit `automation_queue_close` ต่อแถวผ่าน RPC `append_audit_log` (13 audit rows, ok:true)

| # | id (…gh-dispatch-20261005t…) | disposition |
|---|---|---|
| 1–13 | `0405 · 0429 · 0510 · 0535 · 0555 · 0626 · 0656 · 0722 · 0745 · 0802 · 0827 · 0851 · 0909` | **closed_expired_no_retry** — window หมดอายุ · ไม่ส่งซ้ำ · audit ครบ · status `dead` (terminal จริง) |

**After-state (verify):** `closed_rows=13` · `audit_closures=13` · `status_unchanged=true` · ไม่มีข้อความจริงถูกส่งจากรอบนี้ · ไม่มีแถวถูกลบ

## 9. R11 / Staging + Backup & PITR

### R11 / Staging — ไม่มี staging จริง → ใช้ isolated harness (ไม่อ้างว่า staging ผ่าน)
- **Isolated harness ทำซ้ำได้:** Docker `postgres:16` ephemeral (`e2e/ci/local_stack_replica.sh`) = migrations 001-123 + contract 123 + apply 124 + contract 124 + `concurrency_124.sh` → **ALL_GREEN 2026-10-16** (`backups/BMB_HARNESS_124_CONTRACTS_2026-10-16.log`)
- concurrency/replay ทดสอบนอก production แล้ว (§3) · `_i` ผ่าน PostgREST/pooler ใช้จริงบน production แล้ว (marker scan + schema verify)
- **ข้อจำกัด:** harness ≠ staging (ไม่มี pgbouncer config จริง/EF/worker ใน loop) · **staging = BLOCKED/DEFERRED จนกว่าจะสร้าง**

### Backup / PITR — หลักฐานตรงไปตรงมา
| รายการ | ผลตรวจ (2026-10-16) | สถานะ |
|---|---|---|
| WAL archiving (WAL-G) | `walg_enabled=true` · archived **4,272** · ล่าสุด 11:30 UTC วันนี้ | RUNTIME VERIFIED |
| **Platform daily backups** | **`backups: []` = ว่าง** | **MISSING** |
| **PITR** | **`pitr_enabled=false`** | **BLOCKED** (Owner ต้องเปิดใน Dashboard — ผูก billing/สิทธิ์บัญชี) |
| Restore test | ทำได้เฉพาะ dump path (`dbDump.cmd`/`dbBackup.cjs` + `backups/pre-124-snapshot-2026-10-16.json` 74.8KB) · restore เต็ม = ยังไม่มี platform backup ให้ทดสอบ | BLOCKED |

**ข้อเท็จจริงต่อ Owner:** ระบบ**กู้คืนแบบ point-in-time ไม่ได้**จนกว่าเปิด PITR/scheduled backup — ห้ามเปิดขายเต็มรูปแบบจนกว่าจะคลี่คลาย (§9 acceptance)

## 10. เคลียร์ออเดอร์เก่า (รักษาประวัติ) + W3C product

### Inventory (read-only, 2026-10-16)
| ตาราง | จำนวน | จำแนก |
|---|---|---|
| orders | 206 | **cancelled 205** (test-era 2026-09/10) + **delivered 1** = `PO-20260929-131` (**history — เก็บ**) · SAME_DAY 198 / PRE_ORDER 8 |
| payment_intents | 56 | completed 30 · refunded 8 · partially_refunded 1 · pending 14 · processing 3 (test-era ทั้งหมด) |
| order_submissions | 0 | สะอาด |
| order_items / status_history / assignments / audit_logs | — / 454 / 10 / 4,080 | ประวัติครบ — **ห้ามลบ** |
| กฎแยกยอดขายใหม่ vs ประวัติ | นับยอดเฉพาะ `payment_intents.status='completed'` **หลังวันเปิดขายจริง** + `orders.created_at >= เปิดร้าน` (query มาตรฐานเดียว) | DOCUMENTED |

**แผนเคลียร์ (ยังไม่ทำ — §10 ห้าม destructive จนกว่าแผนผ่าน Owner แยกต่างหาก):** ① completed/delivered = history ถาวร ② cancelled/test-era 205 = export ลง `backups/` ก่อนเสมอ ③ เสนอ soft-hide ก่อน hard-delete ④ ห้ามแตะ payment intents/audit/ประวัติกระทบยอด · **รอบนี้ลบ/แก้ 0 แถว**

### W3C `prod-w3c-test-pre` — **หยุดเฉพาะรายการนี้ (เงื่อนไข §10)**
- FK `order_items.product_id → products.id` = **ON DELETE RESTRICT** · **12 order_items อ้างอิง** = ประวัติออเดอร์ **cancelled** 12 ใบ (27 ก.ย. 2026) · ตารางอื่น = 0
- **ผล: hard delete ถูก DB ปฏิเสธ + ทำลาย link ประวัติ = ทำลาย financial/audit records → หยุดตามคำสั่ง** · แถวปัจจุบัน `is_available=false` (ไม่ปรากฏใน catalog ลูกค้า)
- **ทางเลือก (Owner ตัดสิน):** ก) คงแบบ archived/disabled (ปลอดภัยสุด) ข) migration แผนใหม่ FK `SET NULL` + snapshot แล้วค่อยลบ (ต้องตรวจ migration history + อนุมัติแผนก่อน)

**เมนู placeholder ตาม §1.9 — คงไว้ ไม่แตะ:** `coming soon` ×2 (`prod-1791769591910-vy5ad7`, `prod-1791769642687-89fvpq`) + `prod-1` ผัดไทยกุ้งสด (descr "ข้าวกุ้งผัดพริกเกลือ" คงเดิม)

## 11. Customer → Admin → Kitchen → Bite Drive → Tracking — เตรียมพร้อม (HARD STOP)

**สถานะ: ทุกช่องทาง IMPLEMENTED · CONNECTED · DEPLOYED — การทดสอบจริง "ยังไม่เริ่ม" ตาม §1.12/§11**

Test plan พร้อมรัน (ลูกค้าจริง 1 คน = เพื่อน Owner · งบรวม ≤300 บาท):
1. ลูกค้าเข้าเว็บผ่านลิงก์ช่องทางจริง (badge 19/20 ต.ค. ขึ้นแล้ว — published menu 4 แถว/2 วัน)
2. ตรวจเมนู/เงื่อนไข SAME_DAY/PRE_ORDER (server gate `ERR_SCHEDULED_DATE_INVALID`/cutoff ทำงานจริง)
3. ที่อยู่ในโซน 5 กม. + ค่าส่งตาม rule (CR-2 trusted coordinate gate)
4. **ส่งออเดอร์พร้อม idempotency key + ทดสอบ double-click/timeout+retry = ต้องได้เลขเดิม `replay:true` ไม่มีออเดอร์/intent ซ้ำ** ← runtime proof §3
5. จ่าย **PromptPay QR/โอนจริง** → Admin ตรวจ**เงินเข้าจริง**ตรงยอด → ยืนยันผ่านระบบ → `payment_status=completed`
6. Kitchen: preparing → ready (notification เกิด — เฝ้า dead queue ใหม่)
7. **บรรทัด `📍` บนบัตร dispatch แสดง `dropoff_detail` จริง (ไม่ใช่ `—`)** = runtime proof fix WAVE 5B
8. Assign Bite Drive rider (m125 login จริง) → picked_up → in_transit → delivered
9. `/track/<order_number>` timeline ตรง · ยอด = subtotal+fee−discount
10. ตรวจ `order_status_history` + audit + เก็บหลักฐานทุก step (ห้ามลบ)

**Failure/rollback:** QR หมดอายุ → cancel intent · ไรเดอร์ไม่รับ → assign ใหม่ · ผิดพลาดหนัก → แอดมินยกเลิก + คืนเงินโอนมือ · backup ก่อน/หลังทุก step

## 12. THSMS / OTP / Delivery readiness

- **Login flow จริงของลูกค้าปัจจุบัน = password (+ guest OTP ที่ยังไม่เคยถูกใช้จริง)** — `otp_challenges` = **0 แถวทั้งตาราง** → THSMS/OTP **ยังไม่เคยส่งข้อความจริงเลย** = **MISSING**
- config ครบ (`THSMS_API_KEY/SENDER_NAME/MESSAGE_TYPE` · `smsTransport` tests ผ่าน · rate limit/retry ในโค้ด) — แต่ **ไม่มี runtime evidence**
- **ต้องการจาก Owner เพื่อปิด:** เบอร์ทดสอบ 1 เบอร์ + อนุญาตส่ง SMS จริง 1 ข้อความ (~2 บาท) → เก็บหลักฐานส่ง/รับ + rate limit
- Delivery readiness: rider login (m125) · trusted address + distance (CR-2 DEPLOYED) · dispatch assignment · customer tracking — IMPLEMENTED/DEPLOYED · **`dropoff_detail` บนออเดอร์ active = รอ §11 ข้อ 7**

## 13. Tests / CI / Deployed SHA / Production runtime evidence

| รายการ | ผล | Evidence |
|---|---|---|
| Unit/integration suite | **1,042 tests / 100 files ผ่านหมด** (รวม 124 client→RPC→DB ×6 + key-ring ×14) | `npm test` 2026-10-16 18:18 |
| lint + tsc + build | ผ่าน (eslint + brandNameGuard 371 ไฟล์ · tsc · vite + PWA precache 144) | `npm run lint` / `npm run build` |
| Isolated contract stack | migrations 001-123 + contract 123/124 + concurrency = **ALL_GREEN** | `backups/BMB_HARNESS_124_CONTRACTS_2026-10-16.log` |
| Commit / deployed SHA | `1804937` (push แล้ว) → `biteme-baby.com` = `index-BTxI-A1p.js` + `bmbAdminApi_orders-Df9Xb6ji.js` | marker scan: `_i`+`p_client_submit_key`+`dropoff_detail` ครบ |
| Production DB runtime (read-only) | `_i` 19-arg · `order_submissions` RLS on/0 policy/0 grants · WAL archiving 4,272 · queue สถานะปัจจุบัน | Management API 2026-10-16 |
| Production writes รอบนี้ | **เฉพาะ** §8 dead-queue closure 13 แถว + audit 13 (Owner สั่ง) — ไม่มี charge/SMS/push/dispatch/ลบข้อมูล/แตะ secrets | audit `automation_queue_close` ×13 |

## 14. Blockers ที่เหลือ (ข้อเท็จจริง + ผู้ดำเนินการ)

| # | Blocker | สถานะ | ผู้ดำเนินการ |
|---|---|---|---|
| 1 | PromptPay เงินจริง 1 รายการ (controlled acceptance) | พร้อมรัน — รอสั่ง | **Owner + เพื่อน Owner** |
| 2 | Omise test-mode browser run 1 ครั้ง (หลักฐานที่อ้างว่า "ผ่านแล้ว" ไม่พบในระบบ) | MISSING | Owner+AI (หน้าต่างเดียวกับข้อ 1) |
| 3 | Omise Live: KYC/activation + live keys + live webhook | BLOCKED | Owner / Omise (ห้ามบล็อก PromptPay) |
| 4 | Push: อุปกรณ์ยินยอม 1 เครื่อง (subscriptions=0) | BLOCKED | Owner |
| 5 | THSMS: เบอร์ทดสอบ + อนุญาตส่ง SMS 1 ข้อความ (otp_challenges=0) | BLOCKED | Owner |
| 6 | Platform PITR/scheduled backups (วันนี้ `backups:[]`, `pitr=false`) | BLOCKED | Owner (Dashboard/billing) |
| 7 | `prod-w3c-test-pre` — เลือก ก) คง archived หรือ ข) แผน migration FK SET NULL | หยุดแล้ว (FK RESTRICT + 12 แถวประวัติ) | Owner ตัดสิน |
| 8 | เคลียร์ออเดอร์เก่า 205 cancelled — อนุมัติแผน (export→soft-hide→delete) | แผนพร้อม · ห้ามทำก่อนอนุมัติแยก | Owner |
| 9 | Automation hop-by-hop สด: authorize โพสต์จริง 1 โพสต์ + Page permission | BLOCKED | Owner |
| 10 | menu_schedule 2 แถว 16 ต.ค. (unpublished) — ปล่อย/ลบ | รอตัดสิน | Owner |
| 11 | Staging environment (R11 เต็มรูปแบบ) | DEFERRED ก่อนเปิดร้านเต็ม | Owner+AI (หลังเปิดขาย) |

## 15. FINAL RECOMMENDATION

### 🟢 `GO FOR CONTROLLED ACCEPTANCE TEST` (ลูกค้าจริง 1 ออเดอร์ ≤300 บาท · PromptPay · ตาม §11 test plan)

**เหตุผลตามหลักฐาน:** เส้นทางรับออเดอร์ทั้งหมด (checkout → idempotency `_i` (deployed+concurrency-proven) → PromptPay → admin confirm → kitchen → Bite Drive → tracking) IMPLEMENTED/DEPLOYED และผ่าน test/contract/harness ครบ — เหลือเพียง runtime proof บนออเดอร์จริงซึ่ง**ต้องเกิดภายใต้การควบคุมของ Owner เท่านั้น**

### 🔴 `NO-GO` สำหรับการเปิดขายแบบเต็มรูปแบบ / ประกาศ Production Ready

**เหตุผล:** ① Payment live (Omise) ยัง BLOCKED (ไม่มี live keys/KYC) ② ระบบกู้คืน point-in-time ไม่ได้ (PITR ปิด + platform backups ว่าง) ③ SMS/Push ยังไม่มี runtime ④ ไม่มี staging — **ตาม §9 acceptance ห้ามเปิดขายเต็มรูปแบบจนกว่าข้อ 6 (PITR/backup) จะคลี่คลาย** และ Omise Live ไม่ใช่เงื่อนไขบล็อกการขายผ่าน PromptPay (§1.2)

---

`CONTROLLED ACCEPTANCE TEST = READY (awaiting Owner go)`
`REAL ORDER / MONEY / COOKING / DISPATCH = NOT STARTED (hard stop)`
`OPEN SHOP FULL = NO-GO (backup/PITR + payment live)`
`production writes this session = dead-queue closure ×13 + audit ×13 only`

---
*รายงาน: BMB_FINAL_PRODUCTION_CLOSURE_REPORT.md · 2026-10-16 · หลักฐาน = backups/*2026-10-16* + marker scans + Management API read-only probes · ไม่มีการ charge/ส่ง SMS/push/dispatch/ลบข้อมูล/แตะ secrets ตลอดงานนี้*