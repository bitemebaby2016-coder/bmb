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