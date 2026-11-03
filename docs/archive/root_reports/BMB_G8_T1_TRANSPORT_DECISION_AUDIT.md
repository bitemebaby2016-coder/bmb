# BMB G8-T1 — SECURE ENQUEUE TRANSPORT DECISION AUDIT (READ-ONLY)

- Date: 2026-10-03 · Baseline: G8-S4 @ `630e05b` · NO implementation, NO deploy, NO scheduler change
- Facts ทั้งหมดมาจาก code/config จริง (config.toml, workflows, migrations, migration 111)

## 1. VERIFIED REPOSITORY FACTS (Task 4 + 3)

- `automation-scheduler.yml`: auth ปัจจุบัน = `AUTOMATION_TOKEN` (GitHub repo secret → header `x-automation-token`) + publishable apikey inline; `permissions: {}` (ไม่มี OIDC/id-token), ไม่มี GitHub environments/protection; workflow เรียก HTTP ได้จริง (curl ใช้อยู่)
- OIDC: **ไม่ configured ที่ใดเลย** ในทุก workflow
- Edge Functions verify_jwt ต่อ function (config.toml): automation-worker = **true** + shared secret; ai/social workers = false + x-automation-token; stripe = false (จำเป็น)
- Dedicated restricted DB role: **ไม่มีอยู่จริง** — ทุก migration grant เฉพาะ anon/authenticated/service_role (probe ทุกไฟล์)
- Direct DB connectivity: ทางเทคนิคมี (Supabase pooler, `SUPABASE_DB_URL` ระบุใน BMB_DR_RUNBOOK §B) แต่ไม่เคยถูกใช้จาก GH
- `enqueue_automation_job` contract (จาก migration 111 — ไม่แก้): signature `(p_id text, p_job_type text, p_worker text, p_payload jsonb default '{}', p_max_attempts integer default 3) → text` · required: p_id/p_job_type/p_worker (ไม่ว่าง) · idempotency = p_id PK + ON CONFLICT DO NOTHING → 'ENQUEUED'|'DUPLICATE'|'INVALID' · available_at = now() · EXECUTE เฉพาะ service_role · SECURITY DEFINER, search_path=public

## 2. VIABLE TRANSPORTS (Task 1 — proven, nothing assumed)

- **OPTION A** — GH → Edge Function ใหม่ (queue-enqueue) → service_role → `enqueue_automation_job()`: รูปแบบตรงกับ automation-worker ที่พิสูจน์แล้ว (verify_jwt + x-automation-token + service_role server-side)
- **OPTION B** — GH → direct PostgreSQL (pooler) ด้วย dedicated restricted role (สร้างใหม่, GRANT EXECUTE เฉพาะ enqueue RPC)
- **OPTION C** — GH → existing trusted boundary: **NOT AVAILABLE (proven absent)** — automation-worker hardcode-ปฏิเสธ job อื่น (HTTP 400), social workers ไม่ใช่ enqueue boundary
- **OPTION D (เพิ่มเติม)** — pg_cron ใน DB enqueue ตามตารางเวลาเอง (GH หมดบทบาท) — viable เชิงเทคนิค แต่เปลี่ยน architecture D01 → Owner decision ขนาดใหญ่

## 3. SECURITY ANALYSIS (Task 2)

| Dimension | A: EF boundary (ใหม่) | B: direct PG + restricted role |
|---|---|---|
| authentication | x-automation-token shared secret (pattern เดิม) + verify_jwt=true | DB password ของ role ใหม่ |
| authorization | allowlist job_type/payload template ใน EF (hardcoded) | GRANT EXECUTE เฉพาะ RPC — DB enforce |
| credential type | shared secret token | DB role password |
| storage | GitHub repo secret + Supabase secret (pattern เดิม) | GitHub repo secret + Supabase role |
| rotation | regenerate + set 2 ที่ (DR runbook §C มี procedure สำเร็จแล้ว) | ALTER ROLE + update GH secret — runbook ใหม่ต้องเขียน |
| blast radius (leak) | rotate แล้วขอบเขต = enqueue เท่านั้น (EF จำกัด job_type) | rotate แล้ว = enqueue เท่านั้นถ้า grant ถูก; direct-DB surface → misconfig risk สูงกว่า |
| service_role exposed to GH? | **NO** (server-side ใน EF เท่านั้น) | **NO** (แต่สร้าง role ใหม่บน DB) |
| caller เลือก tenant/brand/business? | ไม่ได้ (EF template hardcoded + payload opaque) | ไม่ได้ (RPC ไม่มีช่องทาง) — แต่ caller ควบคุม p_id/p_job_type/p_max_attempts ตรงกว่า A |
| payload inject creds/authority | opaque; EF กรอง template ได้ | opaque (RPC ไม่ตีความ) |
| replay protection | deterministic id + DB idempotency | เดียวกัน |
| auditability | EF logs + audit trace + queue row | queue row เท่านั้น |
| rate limit / abuse | EF limiter ได้ (G5 pattern) | role connection limits |
| failure behavior | HTTP status + body.status (S3 §8 พร้อม) | SQL exception — map เองเป็น GH exit |
| external dependency | EF runtime (ใช้อยู่แล้ว) | pooler + role lifecycle |
| operational complexity | ต่ำสุด — โคลน automation-worker pattern (deploy multipart พิสูจน์แล้ว) | สร้าง role + runbook ใหม่ |
| production suitability | ตรง D01 + consistent กับ boundary เดิมทุกตัว | viable แต่แตก pattern (BMB ไม่เคยใช้ direct-DB จากภายนอก) |

**แยกชัด: `service_role ตรงใน GH Actions` (ห้าม — master key, blast radius ทั้ง project) ≠ `trusted backend boundary ที่ใช้ service_role ภายใน` (A = รูปแบบนี้ เหมือน automation-worker ทุกตัวที่มีอยู่)** — ไม่เทียบเท่ากัน

## 4. DECISION MATRIX (Task 5 — no recommendation/ranking/score)

| Transport | Security boundary | Credential exposure | Blast radius | Operational dependency | Migration impact | Production suitability | Owner decision |
| --------- | ----------------- | ------------------- | ------------ | ---------------------- | ---------------- | ---------------------- | -------------- |
| A: EF queue-enqueue (ใหม่) | EF verify_jwt + x-automation-token + allowlist; service_role ภายในเท่านั้น | shared secret ใน GH repo secret (pattern เดิม) | leak → rotate ตาม runbook เดิม; ขอบเขต enqueue เท่านั้น | EF runtime (มีอยู่) + deploy multipart (พิสูจน์แล้ว) | ไม่ต้องแก้ DB (RPC พร้อม); ของใหม่ = 1 EF | ตรง D01 + consistent กับ boundary เดิมทุกตัว | PENDING — OWNER |
| B: direct PG + restricted role | DB GRANT EXECUTE จำกัด; DB password auth | role password + connection string ใน GH | leak → rotate role; direct-DB surface misconfig risk สูงกว่า | pooler + role lifecycle + runbook ใหม่ | additive migration สร้าง role + grants (ใหม่) | viable แต่แตก pattern จากทุกส่วนที่มีอยู่ | PENDING — OWNER |
| C: existing boundary | — | — | — | — | — | **NOT AVAILABLE (proven absent)** | N/A |
| D: pg_cron enqueue ใน DB | ไม่มี credential ออกภายนอก | ไม่มี (GH หมดบทบาท) | ต่ำสุด | pg_cron extension + schedule ใน DB | additive migration (cron schedule) | เปลี่ยน architecture D01; ต้องตัดสินใหญ่ | PENDING — OWNER (architecture change) |

## 5. OPEN SHOP IMPACT (Task 6)

Chain เมื่อ transport ถูกเลือกและ S5 cutover:
`LEGACY SCHEDULER → SECURE ENQUEUE (T-1) → QUEUE → DISPATCHER (claim RPC) → CANONICAL WORKER (automation-worker ไม่แก้) → NOTIFICATION (in-app เท่านั้น) → FAILURE HANDLING (retry/dead/replay + traces)`

**หลัง T-1 ยัง BLOCKED (external — ไม่ปิดเพราะ G8 ผ่าน):**
| Chain | Blocker |
|---|---|
| REAL ORDER | E2E order จริงรอบแรก (OWNER-LED) |
| REAL PAYMENT | **Stripe live-mode verification** (UNRESOLVED) |
| REAL KITCHEN | real users/devices (OWNER-LED) |
| REAL DISPATCH | real dispatch/provider integration (UNRESOLVED) |
| REAL DELIVERY | physical delivery operations (OWNER-LED) |
| REAL TRACKING | none known in code (order_status_history auto) |
| REAL FAILURE HANDLING | external notification credentials ยังไม่มี (EMAIL/SMS/PUSH/LINE) · **G4 Meta (HOLD)** |

## 6. G8-T1 DECISION PREPARATION GATE

```text
T-1                     = READY FOR OWNER DECISION (matrix §4 — no AI recommendation)
production mutation     = NONE
scheduler changed       = NO
G6 registered           = NO
G7 registered           = NO
real business queue jobs= NONE
migrations changed      = NO
secrets changed         = NO
Git HEAD / origin/main  = verified below (commit+push of this audit doc only)
worktree                = CLEAN
```

**STOP — ไม่ implement transport, ไม่เริ่ม G8-S5, ไม่แก้ automation-scheduler.yml, ไม่ deploy — รอ Owner เลือก transport จาก §4**