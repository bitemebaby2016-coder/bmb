# BMB_W3D_HANDOFF.md
**Wave 3-D — Notifications · วันที่: 2026-09-27 · CORE GATE = PASS · TRANSPORT = BLOCKED (ไม่มี provider) · Meta = DEFERRED BY OWNER**

## สถานะรวม (แยกชั้นตามคำสั่ง)
```
Notification CORE (event→decision→job→in_app→audit) = PASS (production E2E 24/24)
In-app TRANSPORT                                    = PASS (RUNTIME VERIFIED)
External TRANSPORT (email/sms/push/line/meta)       = NOT CONFIGURED (ไม่มี credentials)
Web Push / PWA push                                 = STOP (W3-D-7 — VAPID + subscription storage → Owner decision)
PAYMENT_SUCCESS / PAYMENT_FAILED events             = STOP → OWNER DECISION (ไม่มี authoritative payment event feed)
Admin visibility                                    = PASS (/admin/notifications)
Meta connectivity (FB/Messenger)                    = DEFERRED BY OWNER (ไม่ใช่ defect)
```

## สิ่งที่ทำ
1. **W3-D-0 Reality Audit** — พบ: notifications table + prefs + RPC มีจริงและ deployed (migr 001/021); UI ลูกค้าไม่เคยอ่านจาก DB (local-only) = GAP; ไม่มี Web Push; ไม่มี provider; payment ไม่มี event feed
2. **W3-D core** (ไม่มี migration, ไม่มี worker ใหม่): automation-worker + job `notification_dispatch` — อ่าน canonical feeds (order_status_history migr 040 / delivery_assignments migr 020), map เฉพาะ event ที่ Owner อนุมัติ, resolve recipient (auth uid → customers.id), เคารพ notification_prefs (Transactional), เขียน in_app notification ด้วย deterministic id (durable idempotency), execution trace บน audit_logs
3. **Customer UI**: hydration จาก server (idempotent merge) + mark-read แบบ server-first ผ่าน RLS own-update
4. **Admin UI**: `/admin/notifications` (pagination/search, ไม่มี PII/token/credential)
5. **E2E**: `e2e/w3dNotificationsE2E.cjs` → `e2e/w3d-notifications-e2e.json` PASS 24/24 (production, TEST DATA ONLY)

## Bugs ที่พบและแก้ระหว่างทดสอบ (มี failure trace จริงใน audit_logs)
1. PostgREST `in.()` list ถูก encodeURIComponent ทั้งก้อน → recipient lookup ล้มเหลว (skipped 82) — แก้: encode ราย value, comma raw
2. orders.customer_id = auth uid (ไม่ใช่ customers.id) → FK 409 — แก้: resolve ผ่าน customers.user_id
3. insert failure เดิมถูก classify เป็น 'duplicate' (invisibility) — แก้: `failed:<status>` + errors ใน trace

## Owner Decisions ที่เปิดค้าง
1. **Payment notifications** — ต้องมี payment event feed ก่อน (schema/trigger) → OWNER DECISION
2. **Web Push** — VAPID + push subscription storage (schema ใหม่) → OWNER DECISION
3. **External transports** (email/sms/line/meta) — provider + credentials → OWNER DECISION
4. **Scheduler** — pg_cron binding สำหรับ notification_dispatch (และ jobs เดิม) — ยังค้างจาก W3-B → OWNER DECISION (ปัจจุบัน trigger ด้วย HTTP+token / cron ภายนอกได้)

## Next Step
W3-E Operations/Observability/Reliability Audit (ตาม execution order) — ไม่รอ Meta
