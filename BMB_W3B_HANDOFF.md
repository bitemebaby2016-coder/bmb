# BMB_W3B_HANDOFF.md
**Wave 3-B — Native Automation · วันที่: 2026-09-27 · CORE GATE = PASS · HARD STOP**

## สิ่งที่เสร็จ
- **Architecture Correction**: Make.com = INVALID ASSUMPTION (Owner Decision) — ไม่มี Make.com
  integration ใด ๆ · แก้เอกสาร + สร้าง `docs/AUTOMATION_ARCHITECTURE.md`
- **W3-B-0 Reality Audit**: จำแนกสถานะ IMPLEMENTED/CONNECTED/DEPLOYED/RUNTIME VERIFIED/DOCUMENTED
  (รายละเอียดใน BMB_W3B_NATIVE_AUTOMATION_EVIDENCE.md ข้อ 4) — DB-native automation
  (transition machine/status history/driver sync/payment idempotency/inventory aggregates)
  พร้อมใช้ · ไม่มี scheduler/queue/event-table · 9 automation EF folders = EMPTY placeholders
- **Implement**: `supabase/functions/automation-worker` — native back-office worker
  (ไม่มี schema ใหม่: ใช้ notifications + audit_logs เดิม) · jobs: orders_stale_pending,
  inventory_low_stock · **ไม่แตะ authoritative business state**
- **Deploy**: automation-worker ACTIVE บน production (ivkdfognyiwjcmrhcnwz) + secret
  AUTOMATION_TOKEN (64-hex, gitignored local + Supabase secrets)
- **Production E2E** (`e2e/w3b-automation-e2e.json`): **PASS 13/13** — TEST DATA ONLY
  (round-w3b-test + W3B Test orders) · idempotency (same event twice → duplicate, 1 row) ·
  execution trace บน audit_logs · unauth 401 · 400/405 · CORS · 0 secret leak
- ระหว่างทดสอบพบ+แก้ bug จริง 2 จุด: PostgREST `not=` syntax → `stock=not.is.null`;
  notified/duplicate classification (ตรวจก่อน insert) — ทั้งสองมีหลักฐาน failure trace
  ใน audit_logs (action=automation.execution, status=failed)

## Production state
- Supabase functions: ai-proxy, automation-worker (ใหม่), create-checkout, stripe-webhook,
  stripe-refund, phone-auto-login · Cloudflare production = 84fbd75 (ไม่แตะ src/ — ไม่ redeploy)
- ไม่มี schema migration ใด ๆ ใน W3-B

## Tests / evidence
- e2e/w3b-automation-e2e.json 13/13 · tsc 0 · vitest 44 files/358 · build ✓ · lint ✓ ·
  secret scan ✓ (git + dist + worker responses)

## GAP / Owner Decisions ที่เพิ่มขึ้น
1. **Scheduler binding** (enable pg_cron = DB change หรือ external trigger) — OWNER DECISION
2. **F-14 channel ingestion** (source_channel/external_ref_id/idempotency schema) — BLOCKED,
   requirement ร่างไว้ใน evidence ข้อ 16 — OWNER DECISION
3. Notification transport — W3-C/D
4. Empty placeholder EF folders 9 ตัว — ลบหรือ implement ภายหลัง (ไม่มีผลการใช้งาน)

## F-14 dependency
CORE = PASS · DEPENDENT (channel ingestion) = BLOCKED — แยกสถานะตามคำสั่ง ไม่รวมเป็น PASS เดียว

## Next step (เมื่อ Owner สั่ง)
`START W3-C OMNICHANNEL` → เริ่มด้วย Reality Audit (channel sources ที่มีจริง) —
ปัจจุบัน **HARD STOP**
