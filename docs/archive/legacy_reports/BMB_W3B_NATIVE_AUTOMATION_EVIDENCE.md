# BMB_W3B_NATIVE_AUTOMATION_EVIDENCE.md
**WAVE 3-B — NATIVE AUTOMATION / BACK-OFFICE WORKER · วันที่: 2026-09-27** · ภาษาไทยเป็นหลัก

## 1. Owner Authorization
- Owner command "BMB — OWNER CORRECTION / W3-B NATIVE AUTOMATION" (2026-09-27): สร้าง/ตรวจ/
  ทำให้สมบูรณ์ Native BMB Automation จาก infrastructure ที่มีอยู่จริง → AUDIT→IMPLEMENT→TEST→
  PRODUCTION VERIFY→EVIDENCE→DOCUMENT→GATE→COMMIT→PUSH→HANDOFF→HARD STOP

## 2. Architecture Correction
- ข้อความก่อนหน้าที่อ้าง Make.com = **INVALID ASSUMPTION** (Owner Decision) ·
  Make.com ไม่ใช่ dependency/engine/source of truth · ห้าม implement Make.com integration ·
  แก้เอกสารแล้ว: BMB_06 (หัวเอกสาร OWNER CORRECTION) + เอกสารใหม่
  `docs/AUTOMATION_ARCHITECTURE.md` · เอกสาร GAP เดิมที่ระบุ "Make.com = MISSING"
  ยังเป็นความจริงทาง code (ไม่มี Make.com ใน repo) แต่ MISSING ไม่ใช่ข้อบังคับให้ใช้ Make.com

## 3. Baseline
- HEAD = `8327232` (ผล W3-A) · W3-A GATE = PASS · Cloudflare production = build จาก 84fbd75
  (W3-0 verified) · Supabase production functions (ก่อน W3-B): create-checkout, stripe-webhook,
  stripe-refund, phone-auto-login, ai-proxy

## 4. Reality Audit (W3-B-0) — IMPLEMENTED/CONNECTED/DEPLOYED/RUNTIME VERIFIED/DOCUMENTED
| กลไก | สถานะ |
|---|---|
| order transition machine (RPC `transition_order_status`, allow-list 030) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (Wave 2 12/12) · DOCUMENTED |
| order_status_history trigger (040, same-transaction) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (Wave 2) · DOCUMENTED |
| driver status sync (036, GUC transaction-local) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (Wave 2) · DOCUMENTED |
| payment idempotency (008/010, unique partial index payment_intents) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (Wave 1) · DOCUMENTED |
| stripe-webhook (webhook handler + signature verify) | IMPLEMENTED · DEPLOYED · CONNECTED (Stripe) · DOCUMENTED |
| inventory aggregates (012/026 triggers) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED · DOCUMENTED |
| server-side audit_logs + append_audit_log (018) | IMPLEMENTED · DEPLOYED · DOCUMENTED |
| notifications / notification_prefs (001/021) | IMPLEMENTED (table) · DEPLOYED · **ไม่มี transport จริง** (W3-C/D scope) |
| Edge Function โฟลเดอร์ 9 ตัว (ai-daily-report, calculate-promotion, check-inventory, daily-report, generate-rewards, inventory-reorder, random-menu-draw, track-share, vote-menu) | **EMPTY PLACEHOLDERS** — ไม่ IMPLEMENTED, ไม่ tracked ใน git, ไม่ deploy, ไม่มีใครเรียกใช้ (scan `functions.invoke`) → ไม่มี regression risk |
| cron/scheduled jobs/pg_cron | MISSING ทั้ง repo และ production (scan: ไม่มี Deno.cron, ไม่มี cron.schedule, config.toml ไม่มี [cron]) |
| Make.com / FB / Messenger / LINE inbound | MISSING (ยืนยัน scan ใหม่) — และ **ห้ามใช้** ตาม Owner Decision |
| queues/retry framework/event tables | MISSING (ไม่มี event/job/queue table) |

## 5. Existing Automation ที่ใช้เป็นฐาน (ห้ามสร้างซ้ำ)
- DB triggers/RPC (ตารางข้างบน) = automation ที่แข็งแรงและ runtime-verified แล้ว
- pattern ที่มีอยู่: RPC allow-list + audit_logs + idempotency ด้วย unique index —
  W3-B worker ออกแบบตาม pattern เดียวกัน

## 6. Native Architecture (W3-B-1)
- **EVENT → BMB AUTOMATION → VALIDATE/LOAD CANONICAL → EXECUTE → RECORD RESULT → RETRY (caller-driven)**
- Worker ใหม่: `supabase/functions/automation-worker/index.ts` (native Deno EF)
  - Jobs: `orders_stale_pending` (อ่าน orders canonical ตาม maxAgeMinutes + customerNamePrefix)
    · `inventory_low_stock` (อ่าน products.stock — **ค่าแสดงผล ไม่ใช่ capacity authority**)
  - Side effect เดียวที่อนุญาต: **บันทึก notification** (ไม่แตะ authoritative business state)
  - Durable state โดยไม่เพิ่ม schema: execution trace = `audit_logs`
    (`action=automation.execution`, `id=auto-exec-<event_id>`, metadata ครบ trace)

## 7. Event Flow (W3-B-2)
- event source ที่มีจริง: order lifecycle (RPC/trigger), payment webhook (Stripe), driver sync,
  scheduled window (worker) · ไม่มี channel events จริง (F-14) · **ไม่สร้าง event type ใหม่** —
  ใช้ event_id ที่ derive จาก job+window (hourly bucket) หรือ caller กำหนด
- traceability: event_id / order_number / execution_id / action / result / errors / timestamp —
  พิสูจน์ใน audit_logs metadata (ข้อ 13)

## 8. Order Flow (W3-B-6)
- ORDER (create_order_with_items — canonical RPC) → Supabase commits → worker **อ่าน** state
  (pending + created_at) → action = notification → result บน audit_logs
- worker ไม่คำนวณ/override สถานะออเดอร์ใด ๆ (ไม่มี UPDATE orders) — status ยังผ่าน transition
  machine เท่านั้น · delivery round/scheduled date อ่านจาก delivery_rounds canonical
- ครอบคลุม PRE-ORDER/SAME-DAY ผ่าน canonical tables (orders/pre_orders/delivery_rounds) —
  worker อ่านจาก Supabase เท่านั้น

## 9. Idempotency (W3-B-3)
- ONE LOGICAL EVENT (event_id) → ONE LOGICAL SIDE EFFECT
- Durable ใน DB (ไม่ใช่ in-memory): รอบถัดไปเจอ audit_logs SUCCEEDED ของ event_id เดิม →
  ตอบ `{duplicate:true}` และหยุด · notification id deterministic (`auto-stale-<order_number>`,
  `auto-stock-<product_id>`) + ตรวจซ้ำก่อน insert
- ผลจริง (production): same event twice → duplicate=true, notif_rows=1 ·
  worker restart/timeout-retry ปลอดภัยเพราะ state อยู่ใน DB
- jobs ปัจจุบันไม่ต้องใช้ F-14 columns (channel ingestion ยังไม่ทำ)

## 10. Retry (W3-B-4)
- Caller-driven เท่านั้น (cron/owner re-invoke) · **ไม่มี automatic infinite retry**
- event ที่ failed → รอบถัดไป (event_id เดิม) รันใหม่ได้เพราะ trace ยังไม่ SUCCEEDED
  (merge-duplicates update) · event ที่ succeeded → duplicate ทันที (bounded)
- ผลจริง: debug run ที่ products read fail = บันทึก `status:failed, errors:[...]` ลง audit_logs
  (หลักฐาน failure state จริง) → แก้ bug → event ใหม่ succeeded

## 11. Failure Handling (W3-B-4)
- TIMEOUT (Deno wall-clock + caller timeout) · 5XX/4XX จาก REST → throw → บันทึก failed ·
  DUPLICATE → ตอบ duplicate ไม่ทำซ้ำ · PARTIAL FAILURE → status=partial (บาง item สำเร็จ,
  errors ถูกเก็บ) · WORKER FAILURE → trace ค้าง failed ใน audit_logs, operator ตรวจได้ ·
  replay = re-invoke ได้ · retry policy: caller กำหนด, bounded ต่อ invocation

## 12. Security (W3-B-9)
- verify_jwt = true (platform) + shared secret header `x-automation-token` == AUTOMATION_TOKEN
  (Supabase secret ใหม่ 64-hex · เก็บใน secrets.local.env gitignored + Supabase secrets)
- service-role key: server-side only (Deno.env), ไม่ log / ไม่ return ใน response ใด ๆ
- ไม่เชื่อ external payload เป็น canonical truth (worker อ่านจาก DB เสมอ) ·
  unauth=401 / wrong-token=401 / unknown job=400 (probe จริง)

## 13. Observability (W3-B-10)
- audit_logs row ต่อ execution: job / event_id / execution_id / status (succeeded|partial|failed) /
  results (counts + ids) / errors / finished_at · ไม่เก็บ secret/token (scan ยืนยัน)
- operator ตรวจย้อนหลัง: `GET /rest/v1/audit_logs?action=eq.automation.execution`

## 14. External Integration Boundary (W3-B-8)
- worker ปัจจุบันไม่เรียก external service ใด (notifications = DB rows) ·
- กฎ external failure: ไม่มีทางทำ canonical order state เสียหาย — worker เขียนเฉพาะ
  notifications/audit_logs (ไม่แตะ orders) โดย design ·
- BMB business logic vs adapter: แยกเป็น job function ต่อ job (พร้อมรองรับ adapter ภายหลัง) ·
- notification transport จริง (email/LINE/SMS) = W3-C/D + Owner decision

## 15. Production E2E (W3-B-11) — `e2e/w3b-automation-e2e.json` · TEST DATA ONLY · **PASS 13/13**
| ตรวจ | ผล |
|---|---|
| customer login (qa-customer) | PASS |
| setup round+product (round-w3b-test scheduled วันนี้) | PASS |
| TEST order create ผ่าน canonical RPC (BMB-20260927-540) | PASS |
| unauthenticated → 401 | PASS |
| stale-pending first run (prefix 'W3B Test') → notified=1, already_notified=4 | PASS |
| notification row มีจริง (auto-stale-<order>) | PASS |
| same event twice → duplicate=true, notif_rows=1 (ONE event ONE effect) | PASS |
| execution trace บน audit_logs ครบ trace fields | PASS |
| inventory_low_stock + same event twice → duplicate | PASS |
| unknown job → 400 · malformed json → 400 · OPTIONS → 200 | PASS |
| secret scan ทุก response (token/service key) → 0 hits | PASS |

## 16. F-14 Dependency
- W3-B core jobs ทำได้**โดยไม่แตะ schema** (ใช้ notifications + audit_logs เดิม) → CORE = PASS
- F-14-blocked: **channel ingestion automation** (Facebook/Messenger/manual channel events →
  duplicate-order prevention ด้วย source_channel/external_ref_id) — ห้าม implement จน Owner
  sign-off migration · schema requirement (สำหรับ Owner): เพิ่ม source_channel + external_ref_id
  (unique) + idempotency key บน orders หรือ channel_events table — additive, backward compatible,
  ต้อง design webhook verification + security ควบคู่ · **DEPENDENT = BLOCKED — OWNER DECISION**
- scheduler (pg_cron enable) = DB change → GAP ข้อ 17 (แยกจาก F-14)

## 17. GAP (ไม่ blocker ต่อ CORE Gate)
1. **Scheduler ยังไม่ผูก** — worker พร้อมรับ invocation แต่ production ยังไม่มี cron → Owner
   decision (enable pg_cron = DB change / external trigger)
2. Notification transport จริง (ส่งออกนอกระบบ) = W3-C/D
3. Channel ingestion = F-14 BLOCKED (ข้อ 16)
4. Jobs ครอบคลุมเพียง 2 job แรก (stale-pending, low-stock) — daily-report/rewards/inventory
   automation ยังเป็น empty placeholders (ไม่มีใครเรียกใช้ — ไม่ใช่ regression)
5. Per-item upstream timeout ยังไม่มี (พึ่ง platform wall-clock)

## 18. READY
- automation-worker = READY (deployed + hardened + production E2E 13/13 + trace/idempotency verified)
- Existing DB-native automation (transitions/history/driver sync/payment idempotency) = READY
  (runtime-verified จาก Wave 1-2, ตรวจซ้ำใน audit นี้)

## 19. BLOCKED
- Channel ingestion automation (F-14) — OWNER DECISION REQUIRED
- Scheduling binding (pg_cron) — OWNER DECISION REQUIRED (DB change)
- Notification transport — W3-C/D scope

## 20. Gate Result
Native BMB Automation verified ✓ · No Make.com dependency ✓ · Supabase = Source of Truth ✓ ·
Business authority boundary verified ✓ (worker ไม่เขียน authoritative state) · event flow ✓ ·
order_id traceability ✓ · idempotency ✓ (durable, DB-based) · retry ✓ · failure handling ✓ ·
security ✓ · observability ✓ · production E2E 13/13 ✓ · tsc PASS ✓ · vitest PASS ✓ ·
build PASS ✓ · secret scan PASS ✓ · no unrelated regression ✓ (ไม่แตะ src/)
→ **W3-B CORE GATE = PASS · F-14-DEPENDENT (channel ingestion) = BLOCKED** (แยกสถานะตามคำสั่ง)

