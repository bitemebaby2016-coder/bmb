# BMB_W4B_PLACEHOLDER_EF_AUDIT.md
**W4-B — Placeholder Edge Function Audit / Cleanup · วันที่: 2026-09-27 · AUDIT-FIRST (ไม่มี destructive action) · Authority: Production runtime > Code > Deployment state > Docs**

## STEP 1 — INVENTORY (evidence จริงทั้งหมด)

**Deployment state** (Supabase Management API — read-only): deployed = 7 functions ACTIVE
`create-checkout (v36, jwt✓) · stripe-webhook (v44, jwt off — ใช้ Stripe signature) · stripe-refund (v6, jwt✓) · phone-auto-login (v4, jwt off) · ai-proxy (v4, jwt✓) · automation-worker (v7, jwt✓) · channel-webhook (v3, jwt off — ใช้ HMAC)`

**Source**: 16 folders — 7 มี implementation / 9 folders **ว่างจริง (0 files, 0 bytes)**
**config.toml**: ประกาศเฉพาะ 7 functions จริง — 9 placeholders **ไม่เคยอยู่ใน deployment config เลย**

### 7 ACTIVE functions — callers/runtime evidence

| Function | Deployed | Frontend caller | Backend/Automation caller | External caller | Runtime evidence |
|---|---|---|---|---|---|
| create-checkout | ✓ v36 | `paymentGateway.ts:66` (checkout flow) | — | — | W3-Wave probes · PWA ใช้จริง |
| stripe-webhook | ✓ v44 | — | — | **Stripe** (signature) | 008/028 contract · production state machine |
| stripe-refund | ✓ v6 | `bmbAdminApi_orders.ts:329` (AdminOrders refund) | — | Stripe API | AdminOrders UI ใช้จริง |
| phone-auto-login | ✓ v4 | `locationLogin.ts:95` (quick login: name+phone+GPS) | — | — | LoginPage/authStore ใช้จริง |
| ai-proxy | ✓ v4 | `aiService/aiToolCalling/aiVoice` (invoke) | — | OpenRouter (server-side key) | W3-A probe 12 PASS |
| automation-worker | ✓ v7 | — | GitHub Actions scheduler + cron/HTTP | — | W3-B/D/E + scheduler traces ต่อเนื่องถึง 16:31 |
| channel-webhook | ✓ v3 | — | — | Meta (DEFERRED) | W3-C-EXT probe 15/15 |

### 9 PLACEHOLDER folders — verified empty + zero production footprint

| Name | Bytes | config.toml | Deployed | Frontend caller | Workflow caller | Historical evidence |
|---|---|---|---|---|---|---|
| ai-daily-report | 0 | ✗ | ✗ | 0 refs | 0 refs | — |
| calculate-promotion | 0 | ✗ | ✗ | 0 refs | 0 refs | — |
| check-inventory | 0 | ✗ | ✗ | 0 refs | 0 refs | — |
| daily-report | 0 | ✗ | ✗ | 0 refs | 0 refs | Phase-6 probe ผล **404** (e2e/prod-phase6-integration.json) |
| generate-rewards | 0 | ✗ | ✗ | 0 refs | 0 refs | Phase-6 probe ผล **404** |
| inventory-reorder | 0 | ✗ | ✗ | 0 refs | 0 refs | — |
| random-menu-draw | 0 | ✗ | ✗ | 0 refs | 0 refs | — |
| track-share | 0 | ✗ | ✗ | 0 refs | 0 refs | — |
| vote-menu | 0 | ✗ | ✗ | 0 refs | 0 refs | Phase-6 probe ผล **404** |

(การอ้างถึง 3 ชื่อใน `e2e/prodAuditPhase6.cjs` + JSON = historical audit artifacts ที่**พิสูจน์ว่าไม่เคย deployed** (404) — ไม่ใช่ caller)

## STEP 2–3 — CLASSIFICATION

```text
A — ACTIVE PRODUCTION (7): create-checkout · stripe-webhook · stripe-refund ·
    phone-auto-login · ai-proxy · automation-worker · channel-webhook
    → KEEP (ห้ามแตะ)
B — REFERENCED / CONTRACTUAL (0)
C — SAFE UNUSED (0 — placeholder folders ไม่มี contract แต่การลบ = destructive)
E — TRUE PLACEHOLDER (9): ทั้งหมด verified (ว่าง + ไม่เคย deploy + ไม่มี caller +
    3 ตัวพิสูจน์ 404 ย้อนหลัง) → REMOVE — OWNER REVIEW
D / F / G: 0
```

| Name | Status | Recommended Action |
|---|---|---|
| create-checkout | ACTIVE | KEEP |
| stripe-webhook | ACTIVE | KEEP |
| stripe-refund | ACTIVE | KEEP |
| phone-auto-login | ACTIVE | KEEP |
| ai-proxy | ACTIVE (AI boundary: Intelligence/Extraction/Assistance only — grep 0 business-write) | KEEP |
| automation-worker | ACTIVE | KEEP |
| channel-webhook | ACTIVE (Meta DEFERRED — ห้ามลบ เพราะเป็น external integration contract) | KEEP |
| 9 placeholders (รายชื่อข้างบน) | PLACEHOLDER (verified) | **REMOVE — OWNER REVIEW** (ลบ 9 folders ว่าง — non-destructive ต่อ runtime เพราะไม่เคย deploy แต่ยังเป็น folder deletion → รอ Owner) |

## STEP 4 — CRITICAL BOUNDARIES
- Orders/payments/stripe/refund/identity/driver/delivery/notifications: functions ที่เกี่ยวข้องล้วน ACTIVE → ไม่ถูกแตะ ✓
- AI boundary คงเดิม: ai-proxy = Intelligence/Extraction/Assistance เท่านั้น (grep: 0 write patterns) ✓

## STEP 5 — DESTRUCTIVE ACTION RULE
- ไม่มีการ DROP/delete/rename/เปลี่ยน contract/auth ใด ๆ ในรอบนี้ (AUDIT-FIRST)
- ลบ 9 folders ว่าง = folder deletion → **OWNER REVIEW** ก่อน

## STEP 6 — TEST (ไม่มี code change — รันยืนยัน)
- tsc 0 · vitest 179/179 · build ✓ · lint 0 · secret scan CLEAN

## STEP 8 — GATE

```text
AUDIT = COMPLETE

IMPLEMENTED      = 0 (audit-only)
CONNECTED        = 7/7 ACTIVE functions (ยังเดิม)
DEPLOYED         = 7 (9 placeholders ไม่เคย deploy)
RUNTIME VERIFIED = automation-worker/channel-webhook/ai-proxy (W3 evidence ต่อเนื่อง)
MISSING          = 9 folders ว่าง (source-level only)
BLOCKED          = ไม่มี
DEFERRED         = การลบ 9 placeholders → OWNER REVIEW
OWNER DECISION   = 1 รายการ: อนุมัติลบ 9 placeholder folders หรือ KEEP
```

## BACKUP RULE
`bmb-prod-dump-20260927-2328.sql` = MANUAL BACKUP / OWNER ACCEPTED RISK / OFF-SITE = NOT IMPLEMENTED — ไม่ commit ไม่ upload (local: `D:\A PROJECT\bmb-backups\`)

## FROZEN
Payment Events · Web Push/VAPID · Email · SMS · LINE · Meta real E2E · Facebook Group · pg_cron · race optimization · Supabase Pro · PITR · production restore · new provider — INTACT

## DATABASE
NO MIGRATION · NO SCHEMA CHANGE · NO DESTRUCTIVE DB OPERATION ✓

**ห้ามใช้คำ "CLEANUP COMPLETE"** — ยังไม่ได้ลบจริง (รอ Owner)
