# BMB Native Automation Architecture (W3-B)

> ตาม Owner Decision (2026-09-27): **Automation ของ BMB เป็นระบบที่ BMB เขียนและควบคุมเอง**
> Make.com ไม่ใช่ dependency / automation engine / source of truth — และห้ามเพิ่ม integration
> ของ Make.com

## บทบาท (Source of Truth hierarchy)
- **Supabase PostgreSQL** = CANONICAL SOURCE OF TRUTH
- **BMB Automation** (automation-worker EF + DB triggers/RPC) = WORKER / ORCHESTRATOR
- **AI Gateway** (`ai-proxy`) = INTELLIGENCE / ASSISTANCE
- **Customer PWA / Admin** = interfaces
- **External providers** = external services เท่านั้น

## Authority boundary
Automation ทำได้: process events, orchestrate, notify, sync external, prepare delivery
actions, trigger approved AI ops, ETL, back-office assistance, retry, maintain integration
execution state.
Automation **ห้าม** เป็น authoritative source ของ: price / promotion / coupon / inventory /
capacity / payment / refund / delivery fee / order state / financial settlement.
เมื่อต้องเปลี่ยน authoritative state → เรียก approved backend RPC → Supabase validates/commits.

## Implementation ปัจจุบัน (native, ไม่มี schema ใหม่)
- `supabase/functions/automation-worker` — native back-office worker
  - Jobs: `orders_stale_pending`, `inventory_low_stock`
  - Auth: verify_jwt + shared `x-automation-token` (Supabase secret)
  - Durable idempotency: `event_id` → `audit_logs` (`action=automation.execution`,
    `id=auto-exec-<event_id>`) — ONE logical event → ONE logical side effect
  - Side effects: `notifications` (deterministic ids, dedupe)
  - Retry: caller-driven (cron/owner), ไม่มี automatic infinite retry
  - Traceability: event_id / order_number / execution_id / action / result / errors / timestamp
- DB-native automation (existing, runtime-verified): order status transition machine (030),
  order_status_history trigger (040), driver status sync (036), inventory aggregates (012/026),
  server-side audit log (018), payment idempotency (008/010)
- External webhook handler: `stripe-webhook` (signature verify + payment idempotency)

## Channel Integration (W3-C-EXTERNAL, 2026-09-27)
- channel-webhook EF = Meta webhook receiver (verify + HMAC signature + channel derivation + identity + canonical intake) — IMPLEMENTED + DEPLOYED + RUNTIME VERIFIED (foundation path) · production CONNECTED = BLOCKED (รอ Owner Meta config)

## Scheduling (GAP — รอ Owner)
Worker ยังไม่มี scheduler ผูกใน production. ตัวเลือก: pg_cron extension เรียก EF ทุกชั่วโมง,
หรือ external trigger (owner cron). การ enable pg_cron = DB change → ต้องผ่าน Owner.

## F-14 dependency (BLOCKED → **RESOLVED (CORE) 2026-09-27**)
- F-14 schema implemented: `orders.source_channel` / `orders.external_ref_id` (nullable) +
  UNIQUE `(source_channel, external_ref_id)` WHERE external_ref_id IS NOT NULL + single-signature
  `create_order_with_items` (16-param, additive) + stamp trigger — runtime-verified 16/16
  (`e2e/f14-channel-intake-e2e.json`) · ดู `BMB_F14_OMNICHANNEL_SCHEMA_EVIDENCE.md`
- คงเหลือ BLOCKED: **identity table** `customer_channel_identities` (design ครบใน F-14 evidence
  §14 — รอ Owner authorization) · external channel production integration (webhook verify ต้องมาก่อน)
