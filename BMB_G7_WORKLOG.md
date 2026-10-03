# BMB_G7_WORKLOG.md

Gate: **G7 — Social Post AI Foundation (Draft Only / No Publishing)**
Stage: **S0 — AUDIT ONLY** (ไม่ implement) · วันที่: 2026-10-03 BKK

## Baseline (ยืนยันจริง)

```text
HEAD         = 5458dd6f65b21cbf62e88e357c6d5237ec083400 (ตรง expected)
origin/main  = 5458dd6f65b21cbf62e88e357c6d5237ec083400
WORKTREE     = CLEAN
INDEX        = CLEAN
G6           = PASS (AI capability, scope reconciled) — ไม่ถูกแตะใน S0
G4           = HOLD — EXTERNAL META REVIEW / APPROVAL — ไม่ถูกแตะใน S0
```

## A. Existing social post capability

| สิ่ง | ตำแหน่ง | สถานะ |
|---|---|---|
| task `social_post_draft` | `supabase/functions/_shared/aiPolicy.ts:62` (`status:'RESERVED'`, primary/fallback = MODEL_A, maxTokens 700, timeout 60s) | IMPLEMENTED (policy entry) · **RESERVED/DORMANT** |
| อ้างอิงใน code | เฉพาะ `aiPolicy.ts` + tests (`aiRouting.test.ts:262`, `g6Security.test.ts:148`) | DOCUMENTED — ไม่มี caller จริง |
| client exposure | ไม่มีใน `src/lib/*` — client ไม่รู้จัก task นี้ | MISSING (โดยตั้งใจ) |
| social post generation code | ไม่มี | MISSING |
| Meta write operations | code search `graph.facebook|graph.meta|PAGE_ACCESS_TOKEN` → พบเฉพาะไฟล์ test (negative assertion) | **ไม่มี Meta write path ใด ๆ** |
| content automation/approval | `src/lib/contentApproval.ts`, `src/pages/admin/AdminContentApprovals.tsx`, `AdminPromotions.tsx` (ใช้ `submit_content_for_approval`/`review_content` RPCs) | IMPLEMENTED · DORMANT (production 0 rows) |
| publish path | ไม่มี (ไม่มี auto-publish ทุก path) | MISSING (โดยตั้งใจ — publish = ภายหลัง, นอก G7) |

## B. Existing G5 routing — พฤติกรรมจริงของ `social_post_draft`

- `resolveTaskPolicy('social_post_draft')` (context default `'proxy'`) → `{ ok:false, reason:'reserved_task' }` → **ai-proxy 400 `task_reserved_not_active`** — **RUNTIME VERIFIED** (G6-S4 probe R4 จริงบน production + T-G5-17 + G6-20 unit)
- `WORKER_ACTIVE_TASKS` = {social_comment_classify, social_reply_draft} — **ไม่มี** social_post_draft → worker context ก็ rejected (`g6Security.test.ts` G6-20)
- ไม่ถูก route ไปไหน, ไม่ถูก expose ผ่าน ai-proxy, ไม่มีใน client code
- การ activate ภายหลัง = แก้ TASK_POLICY status + (ถ้าใช้ worker) เพิ่ม WORKER_ACTIVE_TASKS — ยังไม่ทำใน S0

## C. Existing approval model (production probe สด — `e2e/g7s0DbProbe.cjs`, READ-ONLY)

```text
content_approvals.status CHECK  = 'pending' | 'approved' | 'rejected'   (production constraint จริง)
content_approvals.content_type CHECK = 'promotion' | 'banner' | 'post' | 'announcement'
                                  → 'post' มีอยู่แล้ว — เก็บ social post draft ได้โดยไม่ migration
RPCs (production):  submit_content_for_approval (authenticated → 'pending')
                    review_content (is_admin() → pending→approved/rejected เท่านั้น)
                    is_content_approved (publish gate — approved = "publishable" เท่านั้น)
rows                = 0 (DORMANT)
ไม่มี state 'published' ในตาราง · ไม่มี auto-publish code path ใด ๆ
```

**APPROVED != PUBLISHED = พิสูจน์ได้จาก code + DB จริง** → ไม่ HARD STOP
(state machine: draft/submit → `pending` → `approved|rejected`; publish = การกระทำแยกที่ต้องมี approval ก่อน — approval ไม่ใช่ publish authorization)
## D. Existing content storage

- **Canonical draft storage ที่มีอยู่ = `content_approvals`** (title/body/status/reviewed_by/review_note) — `content_type='post'` ใช้ได้ทันที
- `social_events` เหมาะกับ **event-bound** content (comment/message) เท่านั้น — post draft ไม่มี source event → ไม่เหมาะ
- ไม่มี dedicated social-post-draft table — **ไม่ต้องสร้างใหม่** (S1 จะตัดสินใช้ `content_approvals` + `content_type='post'` เป็น canonical)
- ไม่สร้าง table ใหม่ใน S0 (ตามคำสั่ง)

## E. Existing tenant/brand authority (G2/Post-G2 — evidence จริงจาก G6-S0 audit วันนี้)

- tenant derive server-side จาก `channel_page_bindings` เท่านั้น; `tenants` 1 row; brand = `brands.is_default` (single-brand)
- `social_events` RLS: SELECT เฉพาะ tenant admin/platform admin; write เฉพาะ service_role; anon DENY
- `content_approvals` RLS: admin ALL (`is_admin()`), authenticated SELECT, anon policy USING(false)
- **ไม่มี caller-supplied tenant authority; ไม่มี cross-tenant; NULL/empty = deny; ไม่มี brand-level authority ใหม่** — ตรงหลักการที่ G7 กำหนดทุกข้อ

## F. Existing G6 boundary — coexistence

- G6 `social-ai-worker` = classify + reply draft (event-bound, เขียนเฉพาะ `social_events` AI columns)
- G7 (post draft, event-free, `content_approvals`) **แยกพาธสมบูรณ์** → coexist ได้โดยไม่แก้ G6
- G7 เพิ่มเฉพาะ `post draft` — การแตะ G6 code จำกัดที่ policy activation เท่านั้น (S1 ตัดสิน)

## Security / Authority audit

| หัวข้อ | ผล |
|---|---|
| Untrusted input / prompt injection | pattern DATA≠INSTRUCTION พิสูจน์แล้วใน G6 (system เป็น constant, content เป็น data wrapper, schema-forced output) — G7 ต้อง reuse (S1) |
| Structured output / fail-closed | `_shared/aiStructuredOutput.ts` (parse→schema→semantic, ไม่ repair, ไม่ execute instruction จาก model) — RUNTIME VERIFIED ใน G6 |
| Model-selected tenant/brand/publish destination | ไม่มี — server ตัดสินจาก DB context; G7 ต้องคงแบบเดียวกัน |
| Business boundary (price/payment/stock/capacity/delivery fee/order/cancel/refund/fulfillment) | ไม่มี AI authority ใด ๆ (G5/G6 พิสูจน์แล้ว) — G7 ใช้ read-only context เดียวกัน |
| Meta boundary | ไม่มี publish endpoint/Page token ใน code ทั้ง repo (นอกจาก negative assertions ใน tests); ห้าม convert approval→publish, ห้าม publish token, ห้าม enqueue publish, ห้าม external publish job |

## G7 Test Matrix (โครงสำหรับ S1/S3)

`G7-01` task identification · `G7-02` model routing ตาม policy · `G7-03` reserved rejected ก่อน activate · `G7-04` valid draft · `G7-05` structured output · `G7-06` malformed fail-closed · `G7-07` prompt injection · `G7-08` oversized input · `G7-09..12` tenant derivation/cross-tenant/NULL/empty · `G7-13` brand boundary · `G7-14` approval semantics · `G7-15` APPROVED != PUBLISHED · `G7-16` no Meta publish · `G7-17` no Page token · `G7-18..21` no business/order/payment/inventory mutation · `G7-22` idempotency/replay · `G7-23` unauthorized invocation · `G7-24` G5 regression · `G7-25` G6 regression

## Production safety (S0)

READ-ONLY เท่านั้น — ไม่มี mutation, ไม่มี Meta call, ไม่มี test data (ไม่จำเป็น — audit ใช้ schema/counts), ไม่มี secret ถูกพิมพ์, ไม่มี scheduler registration
## Findings

```text
F1  social_post_draft = RESERVED ทุก context (proxy+worker) — ปลอดภัย, RUNTIME VERIFIED (400 จริง)
F2  content_approvals มี content_type 'post' อยู่แล้ว → G7 ใช้เป็น draft storage ได้โดยไม่ migration
F3  APPROVED != PUBLISHED พิสูจน์จริง (pending→approved/rejected + is_content_approved gate; ไม่มี published state)
F4  ไม่มี Meta write path/Page token ใน code ทั้ง repo → ไม่มี auto-publish ให้เผลอ trigger
F5  ไม่มี social post generation code อยู่ก่อน — G7 เริ่มจากศูนย์บน foundation ที่มี
    (aiPolicy / aiStructuredOutput / worker pattern / content_approvals)
F6  activation = เปลี่ยนแค่ TASK_POLICY status (+ worker task set ถ้าใช้ worker path) — ไม่แตะ G3/G4/G5/G6 contracts
F7  human review UI สำหรับ post draft = AdminContentApprovals มีอยู่แล้ว (DORMANT) — ตรวจ compatibility ใน S1
F8  STOP CONDITIONS 11 ข้อ: ไม่มีข้อใด trigger (approval ชัด, ไม่มี authority ใหม่, ไม่มี auto-publish,
    boundary ชัด, ไม่ต้อง migration, ไม่ใช้ Meta credential จริง, ไม่มี business mutation authority เกี่ยว)
```

## S0 COMPLETION GATE

```text
G7 S0 AUDIT
BASELINE:            5458dd6 ตรง expected · G6/G4 ไม่ถูกแตะ
HEAD:                5458dd6f65b21cbf62e88e357c6d5237ec083400
origin/main:         5458dd6f65b21cbf62e88e357c6d5237ec083400
WORKTREE / INDEX:    CLEAN / CLEAN

SOCIAL_POST_DRAFT:
  existing:            policy entry เท่านั้น (aiPolicy.ts) — ไม่มี caller/generation code
  current state:       RESERVED/DORMANT — RUNTIME VERIFIED (400 จริงทั้ง proxy+worker)
  activation required: YES (S1+ ตัดสิน path + activation) — ยังไม่ทำใน S0

APPROVAL:
  state machine:       pending → approved | rejected (CHECK constraint จริง;
                       authority = submit/review/is_content_approved RPCs)
  APPROVED != PUBLISHED: พิสูจน์จริง (ไม่มี published state; is_content_approved = gate แยก)
  authority:           submit=authenticated · review=is_admin() · ไม่ต้องสร้าง publish authority

TENANT:
  authority:           derive server-side เท่านั้น (page binding / G2 model เดิม)
  cross-tenant:        ไม่มีช่องทาง (RLS + NOT NULL + UNBOUND_PAGE)
  NULL/empty:          DENY

META:
  publish path reachable: NO (ไม่มีใน code ทั้ง repo)
  Page Access Token exposure: NO (ไม่มี secret ใด; ไม่อ่าน/ไม่พิมพ์)
  external dependency: G4 = HOLD — Meta approval

SECURITY:
  prompt injection:    pattern DATA≠INSTRUCTION พิสูจน์แล้ว (G6) — reuse
  output validation:   aiStructuredOutput (parse→schema→semantic) — RUNTIME VERIFIED
  fail-closed:         พิสูจน์จริงบน production แล้ว (G6-S4 incident + probe)

DATABASE:
  migration required:  ไม่จำเป็น (content_approvals.content_type='post' มีอยู่) — S1 ยืนยันอีกครั้ง
  destructive change:  NONE

TEST MATRIX:          G7-01..25 ร่างไว้ — จัดทำจริงใน S3 ตาม contract S1

FINDINGS:             F1..F8 (ด้านบน)

DECISION:             READY FOR S1

COMMIT:               docs(G7): record social post AI baseline audit
HEAD == origin/main:  YES
WORKTREE CLEAN:       YES (หลัง commit)
```

**STOP — ไม่เริ่ม S1 ใน execution นี้**
## G7-S2 — HARD STOP (blocker ยืนยันจริงจาก production — ยังไม่ implement)

**วันที่:** 2026-10-03 BKK · สถานะ: STOP ตามคำสั่ง S2 ("If implementation reveals that any of
the above is required: HARD STOP. Do not invent a workaround.")

### Blocker: §2 (internal automation auth) × §8 (ต้องใช้ `submit_content_for_approval`) ขัดกันจริง

**Evidence (production probe จริง, ไม่มี mutation — input ที่ abort ก่อน INSERT ทั้งสองกรณี,
script `e2e/g7s2RpcProbe.cjs`):**

```text
POST /rest/v1/rpc/submit_content_for_approval  (Authorization: Bearer SERVICE_ROLE_KEY)
p_content_type='post', p_title='' (invalid → abort ก่อน INSERT เสมอ)
→ HTTP 400 {"code":"P0001","message":"ERR_NOT_AUTHENTICATED"}
```

- RPC `submit_content_for_approval` (migration 022) ตรวจ `v_uid := auth.uid(); IF v_uid IS NULL
  THEN RAISE 'ERR_NOT_AUTHENTICATED'` — **ต้องมี user JWT เท่านั้น**
- worker แบบ internal (AUTOMATION_TOKEN) มีเพียง `SUPABASE_SERVICE_ROLE_KEY` — **ไม่มี user JWT
  ใด** ใน secret store (ไม่มี FACEBOOK_/PAGE token, ไม่มี user credential ที่ reuse ได้)
- ทางเลือกที่เหลือทั้งหมดละเมิดคำสั่ง S2 ข้อใดข้อหนึ่ง:
  1. service_role direct INSERT ลง content_approvals → ละเมิด §8 "Do not insert around the RPC"
  2. ให้ worker ใช้ client JWT / เปิด client activation path → ละเมิด §2 "no client/public
     activation path"
  3. แก้ RPC/migration เพิ่ม service_role path → ละเมิด HARD RULE (create migration / new authority)

**สิ่งที่ยังไม่ถูก implement** (จงใจ — รอ Owner decision): worker, policy activation,
tests G7-01..28 — ห้ามทำบางส่วนแล้วปล่อยค้าง

### Owner decisions ที่ต้องตัดสิน (เลือก 1):

```text
D-G7-A: อนุญาตให้ worker (service_role) INSERT ลง content_approvals ตรง ๆ
        ด้วย status='pending', created_by=NULL (ไม่มี authority ใหม่ — service_role
        มี INSERT grant อยู่แล้วจาก migration 022; review ยังเป็น human ผ่าน
        review_content RPC เดิม; APPROVED != PUBLISHED คงอยู่)
        → ต้องแก้ S1 contract §3 wording ให้ตรง

D-G7-B: Owner จัดหา internal service user (JWT แบบ long-lived) ให้ worker
        เพื่อเรียก submit_content_for_approval ตามตัวอักษรของ §8

D-G7-C: แก้ RPC (migration) ให้ service_role เรียกได้ — authority change
        (ไม่แนะนำ — แตะ approval authority เดิม)
```

**สถานะ:**

```text
G7 = HARD STOP — OWNER DECISION REQUIRED (D-G7-A / B / C)
S2 = NOT IMPLEMENTED (ไม่มี code ของ G7 ถูกเขียน/commit)
G6/G5/G4 = ไม่ถูกแตะ
COMMIT นี้ = evidence เท่านั้น (worklog + probe script)
```

## G7-S1 — CONTRACT (จบแล้ว — docs เท่านั้น)

สร้าง `BMB_G7_CONTRACT.md` — จุดตัดสินสำคัญ (grounded บน S0 evidence):

- **Storage:** `content_approvals` (content_type='post' มีอยู่จริง) + AI metadata ลง `audit_logs`
  (deterministic id `g7-draft-<draft_ref>`, pattern เดิมของ automation-worker) → **ไม่ต้อง migration,
  ไม่สร้างตารางใหม่** — STOP CONDITION #2/#3 ไม่ trigger
- **Approval:** authority เดิม (submit/review/is_content_approved) — `APPROVED != PUBLISHED` คงอยู่;
  approved = human approval เท่านั้น ไม่ใช่ Meta authorization
- **G5 routing:** activation = `TASK_POLICY.social_post_draft.status: RESERVED→ACTIVE` (additive เดียว);
  **ไม่เพิ่ม** WORKER_ACTIVE_TASKS; worker ใหม่แยกต่างหาก resolve ด้วย context เฉพาะ
  (`PolicyContext` ใหม่แบบ additive) — ไม่ redesign G5, ไม่ expose ผ่าน ai-proxy client path
- **G6 compatibility:** EF ใหม่ `social-post-worker` แยกจาก `social-ai-worker` สมบูรณ์
  (ไม่มี shared mode) → comment reply/Meta reply/publish ไม่มีทาง activate โดยไม่ตั้งใจ
- **Idempotency:** source_reference (server-generated) + trace ใน audit_logs (deterministic PK)
  — replay = duplicate no-op; การสร้างใหม่ = draft_ref ใหม่ — ไม่ต้อง migration
- **Trigger:** manual/internal (AUTOMATION_TOKEN) — scheduler/queue/retry = G8
- **Security:** reuse pattern G6 (DATA≠INSTRUCTION, schema-forced, semantic+banned regex,
  fail-closed พิสูจน์จริง); ห้าม business/external authority ทุกประเภท
- **Test contract:** G7-01..25 + เพิ่ม G7-26..28 (binding mismatch, banned content, AI trace)

S1 STOP CONDITIONS 12 ข้อ: **ไม่มีข้อใด trigger**

```text
## G7-S2 — RESUMED (Owner Decision D-G7-A) — IMPLEMENTATION + TESTS COMPLETE

**Contract corrected:** §3 (direct service_role INSERT, D-G7-A) + มาตรา OWNER DECISION D-G7-A
เพิ่มใน `BMB_G7_CONTRACT.md` — `submit_content_for_approval()` ยังเป็น human-side authority
เดิม (client เรียกผ่าน UI ได้ตามเดิม) — แต่ AI draft persistence ใช้ direct INSERT ตาม D-G7-A

**Prerequisite ยืนยัน production สด (`e2e/g7s2ResumeProbe.cjs`, READ-ONLY):**
`content_approvals.created_by` IS NULLABLE=YES ✅ · service_role INSERT grant ✅ · audit_logs schema ตรวจ ✅

**ไฟล์ implement จริง:**

| ไฟล์ | เนื้อหา |
|---|---|
| `supabase/functions/social-post-worker/index.ts` (ใหม่, 362 บรรทัด) | post-draft worker: AUTOMATION_TOKEN auth (401), draft_ref/source_reference server-generated, brief/source_text ≤2000 reject, DATA≠INSTRUCTION prompt (constant), OpenRouter ผ่าน `resolveTaskPolicy('social_post_draft','post_worker')` (policy model, timeout, fallback, reasoning off), schema+semantic validation (binding mismatch/title/body/hashtags/safety_flags/banned regex/review override) FAIL CLOSED, direct INSERT `content_approvals` (hard-coded post/pending/created_by=null), trace `audit_logs` id='g7-draft-<draft_ref>' (deterministic PK → replay=duplicate no-op), logs เฉพาะ draft_ref/model/status |
| `supabase/functions/_shared/aiPolicy.ts` | `social_post_draft` RESERVED→**ACTIVE** (additive เดียวตาม S1) + `PolicyContext 'post_worker'` + `PROXY_BLOCKED_TASKS` (ai-proxy/G6-worker ยัง 400 — **fix bug ที่พบระหว่าง implement: ACTIVE task ต้องถูกบล็อกทุก context ยกเว้น post_worker**) |
| `src/lib/aiModels.ts` | re-export เพิ่ม (PROXY_BLOCKED_TASKS/POST_WORKER_ACTIVE_TASKS) |
| `src/__tests__/g7Security.test.ts` (ใหม่) | G7-01..42 = **30 tests ผ่านทั้งหมด** (source-contract บน ?raw + schema unit) |
| `src/__tests__/g6Security.test.ts` | G6-20 อัปเดตตาม D-G7-A (ACTIVE + client-blocked + worker-blocked) → **27/27** |
| `src/__tests__/aiRouting.test.ts` | T-G5-17 อัปเดต: social_post_draft ACTIVE but client-blocked → **31/31** |
| `supabase/config.toml` | เพิ่ม `[functions.social-post-worker]` verify_jwt=true (ยัง **ไม่ deploy** — เป็น S4) |
| `e2e/g7s2ResumeProbe.cjs`, `e2e/g7s2RpcProbe.cjs`, `e2e/g7s2ReadTestJson.cjs` | probe/evidence helpers (read-only) |

**D-G7-A boundary ใน code:** `DRAFT_CONTENT_TYPE='post'`, `DRAFT_STATUS='pending'`,
`created_by: null` hard-coded — payload/model เปลี่ยนไม่ได้ (ไม่มี generic write helper);
worker ไม่มี approve/reject/publish/review_content capability ใด ๆ (test พิสูจน์ G7-33..37)

**Verification จริง (ทั้งหมดรันจริง):**

```text
npm test        = 44 files / 455 tests PASSED (0 failed)  [รวม G7 30, G6 27, G5 aiRouting 31]
g7Security      = 30/30 · g6Security = 27/27 · aiRouting = 31/31
tsc --noEmit    = clean
eslint          = clean (0 error/warning)
npm run build   = built in 4.70s (no error)
secret scan     = CLEAN (hit เดียว = negative-assertion pattern ใน test เอง)
```

**ไม่มี:** migration · schema change · Meta code · Page token · scheduler · queue · retry ·
G6 modification (behavior-preserving เฉพาะ test expectation ตาม D-G7-A) · G4 modification ·
production deploy · production mutation

**Known limitations (S2):**
1. ยังไม่ deploy / ไม่ runtime verify (S4) — `social-post-worker` ยังไม่ได้ deploy ไป production
2. draft id deterministic 'g7cap-<draft_ref>' — replay กันที่ trace pre-check; race ระหว่าง
   concurrent duplicate จะได้ 409 → duplicate no-op (จัดการแล้วใน worker)
3. scheduler registration = G8; worker invoke ด้วย manual/internal เท่านั้น

**G4:** ไม่ถูกแตะ — ไม่มี Meta code/PAGE token ใน G7 ทุกไฟล์ (test พิสูจน์ G7-16/17)
**G8:** ไม่ถูกแตะ — ไม่มี scheduler/queue/retry ใด ๆ (test พิสูจน์)

```text
S2 = IMPLEMENTED + TESTED + DOCUMENTED (DEPLOYED = NO, RUNTIME VERIFIED = NO)
NEXT: G7-S3 Security deep-test — หลัง commit/push/clean ยืนยัน
```
S1 = CONTRACT COMPLETE (ไม่ implement/deploy/mutate)
NEXT: G7-S2 Implementation — หลัง commit/push/clean ยืนยัน
## G7-S3 — SECURITY / TEST GATE (จบแล้ว)

**Defects พบและแก้ (ภายใน G7 scope, minimal fix):**

```text
D1 (S3-OUT-04): aiStructuredOutput ก่อนหน้านี้ SILENTLY IGNORE unknown fields
    ขัด contract §2 "unknown fields rejected"
    Fix: additive opts.rejectUnknown (default false = behavior-preserving สำหรับ
    G5/G6 callers เดิมทั้งหมด) + worker ส่ง { rejectUnknown: true } → unknown
    field เช่น publish_token/tenant_id → reject `unknown_field:<key>`
    Test: S3-OUT-04 + G7 worker wiring test
D2 (S3 injection case 1): banned regex เดิมไม่ครอบคลุม "publish this to Meta"
    Fix: เพิ่ม patterns publish[…](meta|facebook) / meta[…]publish /
    โพสต์ลง(เพจ|meta|facebook) — เฉพาะใน G7 worker prompt guard
    Test: S3 injection case 1 ผ่าน (รวม 10 cases)
```

**S3 test suite ใหม่ (ใน `g7Security.test.ts` — รวมเป็น 60 tests ทั้งหมด ผ่าน 60/60):**

| กลุ่ม | ผล |
|---|---|
| S3-AUTH-01..06 (401 gate, exact-compare, client/proxy/G6-worker บล็อก post task) | PASS |
| S3-TENANT-01..05 (derive server-side, caller-supplied เป็นไปไม่ได้, missing_tenant_context fail-closed) | PASS |
| S3-BRAND-01..04 (brands.is_default, ไม่มี brand_admin/override) | PASS |
| S3-OUT-01..12 (valid/missing/type/**unknown**/enum/length/hashtags/binding/malformed) | PASS |
| S3 prompt injection 10 cases (ผ่าน enforcement layer จริง: banned regex + rejectUnknown + binding + no-mutation-surface) | PASS |
| S3-IDEM-01..03 (deterministic PK + pre-check + 409 no-op; new ref = new draft; ไม่มี DELETE) | PASS |
| S3 audit trace (bounded metadata — ไม่มี secrets/PII/authorization; ครบ task/ref/model/validation/source/outcome/context) | PASS |

**META NEGATIVE:** ไม่มี graph.facebook/graph.meta/Page token/publish endpoint ใน worker ทั้งไฟล์ (codeOnly + S3-OUT-04 unknown-field rejection กันทางผ่าน model output)
**BUSINESS NEGATIVE:** REST เขียนได้เฉพาะ content_approvals + audit_logs; ไม่มี orders/payments/inventory/delivery/refund/cancel/price/capacity
**APPROVAL:** worker ไม่มี review_content/'approved'/'rejected'/'published' capability; migration 022 ยืนยัน pending→approved/rejected + is_admin gate

**Verification จริง:**

```text
npm test   = 455 tests / 0 failed (44 files)
tsc        = exit 0
eslint     = exit 0
build      = exit 0
secret scan = CLEAN (git diff a2c2f24 scan — ไม่มี real credential; negative strings ใน test เท่านั้น)
static diff = เฉพาะ g7Security.test.ts + aiStructuredOutput.ts (rejectUnknown additive,
              behavior-preserving — มี test ครอบ default path เดิม) + worker banned regex
```

**STATUS: SECURITY VERIFIED · TEST VERIFIED · IMPLEMENTATION VERIFIED — DEPLOYED = NO, RUNTIME VERIFIED = NO**

**G4:** ไม่ถูกแตะ — ไม่มี Meta code/PAGE token ใน G7 ทุกไฟล์ (test พิสูจน์ G7-16/17)
**G8:** ไม่ถูกแตะ — ไม่มี scheduler/queue/retry ใด ๆ (test พิสูจน์)
```