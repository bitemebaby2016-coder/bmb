# BMB_G6_FINAL_REPORT.md

Gate: **G6 — Social Comment AI Foundation**
วันที่: 2026-10-03 BKK · อ้างอิง: `BMB_G6_WORKLOG.md` (S0–S4 evidence จริง) + `BMB_G6_CONTRACT.md` + git evidence

## 1. Executive status

```text
==================================================
G6 = PASS (AI capability — scope reconciled per Owner decision 2026-10-03)
     G6 = AI capability (classify/draft/validate/safety/idempotency)
     G8 = Operational orchestration (scheduler/queue/retry/backoff/concurrency/recovery)
     job registration 'hourly-social-ai' ถูกถอดออกจาก scheduler แล้ว (commit นี้)
     — worker invoke แบบ manual/internal เท่านั้น; G8 จะ register เอง
SOCIAL COMMENT AI FOUNDATION = IMPLEMENTED + DEPLOYED + RUNTIME VERIFIED
   (classification + reply DRAFT เท่านั้น — ไม่มี outbound Meta)
REAL META E2E = BLOCKED / DEFERRED (รอ G4 Meta approval — ตามที่ G6 กำหนดไว้ตั้งแต่ต้น)
HEAD == origin/main, WORKTREE = CLEAN, INDEX = CLEAN
==================================================
```

## 2. Baseline

```text
HEAD before S0:  a775fe0 (G5 PASS closure) — ยืนยัน == origin/main, WORKTREE/INDEX CLEAN
```

## 3. Audit (S0)

Production DB probe จริง (`e2e/g6s0DbAudit.cjs`, READ-ONLY): `social_events` (0 rows, schema มี AI/action/reply state พร้อมจาก migration 109), `channel_page_bindings` 2 rows (FACEBOOK+MESSENGER → tenant-bmb-001), `content_approvals` (0 rows, pending/approved/rejected), RLS/grants ตรวจจริง, `ingest_social_event` + approval RPCs ยืนยัน ครบ — รายละเอียดเต็มใน worklog §S0

## 4. Contract (S1)

`BMB_G6_CONTRACT.md`: `social_comment_classify` + `social_reply_draft` = ACTIVE, `social_post_draft` = RESERVED; schema input/output/validation/failure/authorization/tenant/brand/idempotency/retention/approval/publish boundary ครบ; approval semantic ตรวจของจริง = `pending→approved/rejected` + `is_content_approved` gate (**APPROVED != PUBLISHED** มีจริง → ไม่ HARD STOP); `G6 DB CHANGE REQUIRED` = ไม่มี (ใช้คอลัมน์ migration 109 ที่มีอยู่)

## 5. Implementation (S2)

| ไฟล์ | สถานะ |
|---|---|
| `supabase/functions/social-ai-worker/index.ts` | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED |
| `supabase/functions/_shared/aiPolicy.ts` (PolicyContext/WORKER_ACTIVE_TASKS) | IMPLEMENTED (additive, ai-proxy ยัง reject reserved ตามเดิม) |
| `.github/workflows/automation-scheduler.yml` | **ไม่มีการเปลี่ยนแปลงหลัง reconcile** (job `hourly-social-ai` ที่เคยเพิ่มใน S2 ถูกถอดออกตาม Owner reconciliation — G8 เป็นผู้ register scheduling) |
| `supabase/config.toml` | IMPLEMENTED (เพิ่ม block ของ worker, verify_jwt=true) |

## 6. Task activation

- `social_comment_classify` = **RUNTIME VERIFIED** (production: classify สำเร็จ, intent=question)
- `social_reply_draft` = **RUNTIME VERIFIED** (draft เก็บใน `ai_reply_text`, `ai_validated=true`)
- `social_post_draft` = **RESERVED / BLOCKED** (400 จริงทั้ง proxy+worker — R4)

## 7. Structured output

parse → schema validate → semantic validate (confidence 0–1, safety flags enum, source_event_id binding, banned content regex, draft ≤500 ตัวอักษร) → **FAIL CLOSED** — พิสูจน์จริง 2 ชั้น: unit (27 tests) + production incident รอบ probe แรก (empty content → `status='FAILED'`, AI columns คง null)

## 8. Prompt injection defense

Social content = UNTRUSTED DATA (system prompt เป็น constant, content อยู่ใน data wrapper «...», ประกาศ DATA ไม่ใช่ INSTRUCTION ทั้งสอง prompt) + schema-forced JSON + semantic validation — G6-06/07/08 PASS

## 9. Tenant security

Tenant derive server-side เท่านั้น (`channel_page_bindings`); worker ไม่รับ tenant จาก caller/AI; NULL tenant เป็นไปไม่ได้ (NOT NULL + UNBOUND_PAGE) — **RUNTIME VERIFIED** (R5/R6) + unit (G6-10..12)

## 10. Brand security

`brand_id` derive จาก `brands.is_default` ตอน ingest (single-brand launch — ไม่แตะ); constraint `fk_social_events_brand_tenant` ยังคุมอยู่; worker ไม่แตะ brand — RUNTIME VERIFIED (R0/R5)

## 11. Idempotency

`UNIQUE(platform,event_id)` + `ON CONFLICT DO NOTHING` (DB-level) + optimistic claim (`status=eq.RECEIVED` conditional PATCH) — duplicate invocation บน production จริง → no-op (`processed=0`) — **RUNTIME VERIFIED** (G6-15)

## 12. Approval boundary

ทุก draft = `review_status:'pending_review'` (ไม่มี auto-approve); approve = human action (UI = DEFERRED); `content_approvals` gate (`APPROVED != PUBLISHED`) ไม่ถูกแตะ — RUNTIME VERIFIED (R7)

## 13. Meta boundary

ไม่มี Meta write endpoint/Page Access Token ใน code (code search ผ่าน); worker **ไม่เขียน** `reply_status`/`action_type`/`reply_provider_id` ตลอด G6 — RUNTIME VERIFIED (R8: ทั้งสามคง null หลังประมวลผลจริง)

## 14. Test matrix

`src/__tests__/g6Security.test.ts` = **27/27 passed** ครอบคลุม G6-01..G6-25 (รายละเอียดต่อกลุ่มใน worklog §S3); G6-R* runtime = S4

## 15. Regression

`npm test` = **43 test files passed** (รวม G5 aiRouting 31 tests ไม่พัง) · `tsc --noEmit` clean · `eslint` clean · `npm run build` success · code search: ไม่มี Meta write/PAGE token/business mutation/SECURITY DEFINER ใหม่

## 16. Production runtime

`e2e/g6RuntimeProbe.cjs` = **PASS 12/12** บน production จริง (safe synthetic event `g6probe-` + cleanup เหลือ 0 rows) — ตารางเต็มใน worklog §S4; **ไม่มี persistent test data ค้าง**

## 17. G4 status

```text
G4 = HOLD — EXTERNAL META REVIEW / APPROVAL (ไม่ถูกแตะตลอด G6)
G6 REAL META E2E = BLOCKED / DEFERRED — จะเปิดเมื่อ G4 ปิด + Meta permission พร้อม
```

## 18. Known limitations

1. `social-ai-worker` ยังไม่มี scheduled run จริง (การ register ลง scheduler เป็นของ G8 ตาม Owner reconciliation 2026-10-03) — worker พิสูจน์ผ่าน manual invoke จริงแล้ว; production events = 0 ตาม G4 HOLD
2. `RETRYABLE` rows ยังไม่มี auto-retry (ตั้งใจ — retry/recovery เป็นของ G8); ต้อง invoke ซ้ำ
3. Rate/usage counter ของ worker เป็น in-memory per-isolate (minimal ตาม D5-02)

## 19. Deferred work

- Social inbox / human review UI (approve/reject draft ใน admin) — DEFERRED (รอ outbound พร้อม)
- `social_post_draft` + G7 publish — RESERVED/DEFERRED
- Outbound Meta reply (`reply_status='sent'`) — BLOCKED (G4 + Meta permission)
- Scheduler/queue/retry/backoff/concurrency/recovery รวมถึงการ register `social-ai-worker` — **G8**

## 20. Git closure

```text
S0 docs(G6): record social comment AI baseline audit      ce0254a
S1 docs(G6): define social comment AI contract            4408ecf
S2 feat(G6): implement social comment AI foundation       a1835d4
S3 test(G6): verify social comment AI security boundary   fd4e687
S4 verify(G6): record production runtime verification     ef9d6a5
S5 docs(G6): final gate report                            aa042e4
    docs(G6): record scope reconciliation (HOLD)          67cba88
    fix(G6): reconcile scheduler scope per Owner decision (job ถอดออก) = commit นี้
HEAD == origin/main · WORKTREE CLEAN · INDEX CLEAN
```