# BMB_W3E_OPERATIONS_AUDIT.md
**Wave 3-E — Operations / Observability / Reliability Audit · วันที่: 2026-09-27 · AUDIT (read-only) · ไม่มี schema/business change**

สถานะแต่ละหมวด (IMPLEMENTED / PARTIAL / NOT CONFIGURED / OWNER DECISION):

| หมวด | State | หลักฐาน/เหตุผล |
|---|---|---|
| Durable auditability | **IMPLEMENTED** | `audit_logs`: automation.execution (ทุก run มี status/results/errors), payment, delivery, identity, order lifecycle (040) — admin อ่านได้ที่ `/admin/audit-log` |
| Failure visibility | **IMPLEMENTED** | `system_errors` feed (migr 021) + `/admin/errors` (client/EF) + execution trace errors ใน audit_logs |
| Worker health / retry visibility | **IMPLEMENTED** (bounded, caller-driven) | ทุก execution มี execution_id/status=persisted; re-run idempotent (deterministic id); W3-D ทำ insert-failure observable (`failed:<status>` ใน errors) |
| Scheduled jobs | **OWNER DECISION (ค้างจาก W3-B)** | ไม่มี pg_cron/external scheduler bound ใน production — automation-worker + notification_dispatch ทำงานเมื่อถูก trigger (HTTP+token) เท่านั้น → notification latency ขึ้นกับความถี่ trigger |
| Stale jobs / retention | **PARTIAL** | audit_logs และ notifications เติบโต unbounded — ยังไม่มี retention policy (เป็น schema/ops decision → Owner; ไม่เร่งด่วน) |
| Dead-letter conditions | **N/A ปัจจุบัน** | ไม่มี external transport → ไม่มี terminal-failure queue; จะต้องออกแบบเมื่อเพิ่ม provider (W3-D-5 บันทึกไว้แล้ว) |
| Operational alerts | **NOT CONFIGURED** | ไม่มี email/Slack/push alert — ขึ้นกับ Owner decision (ผูกกับ W3-D transport) |
| Admin operational visibility | **IMPLEMENTED** | Dashboard + Orders + Kitchen + Delivery + `/admin/errors` + `/admin/audit-log` + `/admin/notifications` (W3-D-8) |
| Logging (EF runtime logs) | **PARTIAL** | Edge Function logs อยู่ใน Supabase log console (retention ตามแพลตฟอร์ม) — structured durable logging ทำผ่าน audit_logs/system_errors แล้ว |
| Backup/recovery assumptions | **ASSUMPTION — ยังไม่ verify** | Supabase managed backups ตาม plan — AI DEV ไม่มีสิทธิ์ตรวจ retention/PITR; recovery drill ยังไม่เคยรัน → **OWNER VERIFY** |
| Security boundaries | **PASS (verified ซ้ำ)** | RLS deny-by-default + EF JWT/shared-token + secret scans (git/dist/runtime) CLEAN — ดู W3-D evidence §8 |
| Meta connectivity | **DEFERRED BY OWNER** | ไม่กระทบส่วน operations อื่น |

## สรุป + สิ่งที่ต้องตัดสินโดย Owner
1. **Scheduler binding** (pg_cron หรือ external cron) — ตัวถังหลักของ "ระบบเดินเอง" — OWNER DECISION
2. **Operational alerts / transport provider** — OWNER DECISION (ผูกกับ W3-D transport)
3. **Retention policy** (audit_logs/notifications) — schema/ops decision — ไม่เร่งด่วน
4. **Backup/DR verification** — Owner ตรวจ Supabase dashboard (backups/PITR) — AI DEV ทำแทนไม่ได้

ไม่มีการ implement ใหม่ใน W3-E รอบนี้ — ทุกหมวดที่ implement ต่อได้ด้วยตัวเองมีอยู่แล้วและผ่านการ verify;
ส่วนที่เหลือล้วนเป็น Owner decision dependency (ตาม HARD RULE 8/9)
