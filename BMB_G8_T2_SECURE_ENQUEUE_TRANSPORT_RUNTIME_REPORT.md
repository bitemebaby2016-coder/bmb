# BMB G8-T2 — SECURE ENQUEUE TRANSPORT RUNTIME REPORT

- Date: 2026-10-03 · Owner decision D06 = OPTION A · Baseline: T1 @ `7778116`
- Labels: IMPLEMENTED / DEPLOYED / RUNTIME VERIFIED / DOCUMENTED / MISSING / BLOCKED / DEFERRED
- **NO cutover · NO legacy switch · NO G6/G7 registration · NO real business execution**

## 1. EXACT FUNCTION CREATED — IMPLEMENTED + DEPLOYED

`supabase/functions/queue-enqueue/index.ts` — slug `queue-enqueue`, deployed v1 HTTP 201, `verify_jwt=true` (deploy evidence: `e2e/g8t2Deploy.cjs` → `DEPLOY_STATUS 201 VERSION 1 VERIFY_JWT true`)

## 2. AUTHENTICATION DESIGN — IMPLEMENTED + DOCUMENTED

- platform layer: verify_jwt=true (เหมือน automation-worker — pattern ที่ GH เรียกอยู่จริงทุก 5 นาที)
- handler layer: header `x-automation-token` ≡ `AUTOMATION_TOKEN` Supabase secret (exact match)
- credential: shared secret · storage: GitHub repo secret `AUTOMATION_TOKEN` (มีอยู่แล้ว — **NO new secret required**) + Supabase secrets · transmission: HTTPS header
- rotation: DR runbook §C (regenerate → `supabase secrets set` → update GH secret) — DOCUMENTED
- failure behavior: missing/wrong token → HTTP 401 `{error:'unauthorized'}` — RUNTIME VERIFIED

## 3. CREDENTIAL BOUNDARY — IMPLEMENTED + RUNTIME VERIFIED

- service_role มีอยู่เฉพาะใน EF runtime (Deno.env) — **ไม่ปรากฏใน GitHub workflow, ไม่ปรากฏใน committed source, ไม่ log/return**
- GH ได้เพียง shared secret ที่ rotate แล้วขอบเขตเหลือ enqueue เท่านั้น
- ห้ามชัดเจน: `SUPABASE_SERVICE_ROLE_KEY` / DB superuser / unrestricted PG credentials เข้า GH — ไม่มีการเพิ่ม (scan §12)

## 4. REQUEST CONTRACT — IMPLEMENTED + RUNTIME VERIFIED

`POST { job, ref, params? }` — job ∈ allowlist 4 (3 legacy + synthetic_selftest) · `ref` = /^[a-z0-9][a-z0-9-]{3,63}$/ · params ผ่าน allowlist builder เท่านั้น (ตรวจชนิด+range; ฟิลด์อื่น IGNORED) · ไม่รับ authority fields / available_at / max_attempts จาก caller (fix 3 server-side) · ไม่รับ `customerNamePrefix` (TEST DATA ONLY — ปิดตาม S3 §4)

## 5. RPC INVOCATION — IMPLEMENTED + RUNTIME VERIFIED

EF เรียก `enqueue_automation_job()` ผ่าน PostgREST ด้วย service_role — **single RPC, ไม่มี generic proxy, ไม่มี direct INSERT ลง automation_queue** — id = `sched-<job>-<ref>` (deterministic), worker/payload = server-side template

## 6. AUTHORITY BOUNDARY — RUNTIME VERIFIED (N7/N8)

- authority/credential injection (`tenant_id/brand_id/is_admin/service_role_key/attempt_count/status`) → ignore ไม่ forward — payload หลังเก็บ = template ล้วน (`extraPayloadKeys:[]`), ไม่มี authority columns, attempt/status ไม่ถูกแตะ
- arbitrary RPC/table/SQL injection → **impossible** (ไม่มี path; ได้ 400 unknown job)

## 7. IDEMPOTENCY BEHAVIOR — IMPLEMENTED + RUNTIME VERIFIED

- ไม่มี SELECT-then-INSERT ใน EF — เรียก RPC เดียว propagate canonical result
- duplicate identity → `200 {ok:true,result:'DUPLICATE',duplicate:true}` — row ไม่เปลี่ยน (attempt=0, queued คงเดิม) — DB ยังเป็น authority

## 8-9. POSITIVE / NEGATIVE TESTS — RUNTIME VERIFIED (`e2e/g8t2-runtime-evidence.json`)

| # | Test | Result |
|---|---|---|
| P1 | valid trusted caller → ENQUEUED | 200 ENQUEUED, row queued, payload={synthetic:true}, max=3 ✓ |
| P2 | duplicate identity → DUPLICATE/NO-OP | 200 DUPLICATE, row unchanged ✓ |
| P3 | legacy template ผ่าน transport (notification_dispatch params) | 200 ENQUEUED, payload={lookbackMinutes:360,limit:200}, worker=automation-worker ✓ |
| P4 | 8 concurrent same identity | **1 ENQUEUED + 7 DUPLICATE** (exactlyOne=true) ✓ |
| N1/N2 | no token / wrong token | 401 / 401 ✓ |
| N3 | malformed JSON | 400 ✓ |
| N4 | arbitrary job type | 400 unknown job ✓ |
| N5 | invalid identity (ref) | 400 invalid_ref ✓ |
| N6 | params out of range | 400 invalid_params ✓ |
| N7 | authority+credential injection | IGNORED — ไม่ forward, ไม่แตะ row ✓ |
| N8 | arbitrary RPC/table/SQL | 400 — no proxy path ✓ |
| N9 | anon ตรง PostgREST enqueue RPC | 401 (S4 evidence — EXECUTE เฉพาะ service_role) ✓ |

## 10. CONCURRENT ENQUEUE TEST — RUNTIME VERIFIED

P4: 8 parallel HTTP same identity → exactly one canonical queue execution identity (DB ON CONFLICT ภายใต้ race) — ไม่มี duplicate execution

## 11. PRODUCTION SYNTHETIC RUNTIME EVIDENCE — RUNTIME VERIFIED

- job_type='synthetic_selftest' เท่านั้น · legacy job 3 ตัวไม่ถูก execute (P3 = enqueue row เท่านั้น แล้วลบทันที — worker ไม่ถูกเรียก)

## 12. SECRET SCAN — VERIFIED

- `Select-String 'SUPABASE_SERVICE_ROLE_KEY\s*=["'].+|eyJhbGciOi|sk-or-'` บน EF + workflow + deploy/runtime scripts = **0 hits**
- publishable apikey inline ใน workflow = public by design (มีอยู่ก่อน G8 — ไม่ใช่ secret)

## 13. SERVICE_ROLE EXPOSURE AUDIT — VERIFIED

- workflow ใช้ `secrets.AUTOMATION_TOKEN` เท่านั้น (3 refs) · ไม่มี service_role ใน GH หรือ repo · EF responses/logs ไม่มี credential (คืนเฉพาะ error strings/result codes)

## 14. GITHUB ACTIONS INSPECTION — DOCUMENTED (NO CHANGE)

- `automation-scheduler.yml` ไม่ถูกแก้ — legacy path คงเดิม 100%
- S5 preparation (proposed, NOT applied ตาม §12 ของคำสั่ง): เปลี่ยน curl จาก automation-worker → `queue-enqueue` ด้วย secret เดิม (`AUTOMATION_TOKEN`) + เพิ่ม dispatch step — ทำใน S5 เมื่อ Owner authorize เท่านั้น

## 15. CLEANUP EVIDENCE — RUNTIME VERIFIED

- DELETE exact synthetic ids (`sched-...-g8t2s-*`) → 204 · residue `sched-synthetic_selftest-g8t2s-*` = **0** (รวม debug row จาก probe แรก)

## 16. OPEN SHOP TRACEABILITY — DOCUMENTED

```text
TRIGGER (GH Actions) → SECURE ENQUEUE (queue-enqueue EF) → QUEUE → DISPATCHER → CANONICAL WORKER → NOTIFICATION → FAILURE HANDLING
                        └── G8-T2 ปิดช่วง TRIGGER → SECURE ENQUEUE → QUEUE (เชิงเทคนิค — ยังไม่ switch จนกว่า S5) ──┘
```

- ยังไม่ปิด: KITCHEN/DISPATCH/DELIVERY จริง · NOTIFICATION ภายนอก · FAILURE HANDLING ระดับ production ops

## 17. REMAINING BLOCKERS (ยังเปิด — ไม่อ้างว่าปิด)

- **S5 cutover authorization** (Owner) — transport พร้อมแต่ workflow ยังเดิน legacy
- Stripe live-mode verification (UNRESOLVED) · external notification credentials (UNRESOLVED) · physical delivery ops (OWNER) · **G4 Meta (HOLD)** · real dispatch/provider integration (UNRESOLVED) · tracking dependency: none known in code