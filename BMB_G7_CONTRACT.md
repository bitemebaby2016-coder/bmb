# BMB_G7_CONTRACT.md

Gate: **G7 — Social Post AI Foundation (Draft Only / No Publishing)**
Stage: **S1 — CONTRACT ONLY** (ไม่ implement/deploy/mutate production)
อ้างอิง: `BMB_G7_WORKLOG.md` (S0 audit จริง, commit df43053) เท่านั้น
วันที่: 2026-10-03 BKK

## 0. SCOPE

```text
ใน G7: social_post_draft — สร้าง post DRAFT ที่ validated → เก็บเป็น draft → รอ human review
นอก G7: publish ทุกรูปแบบ, Meta API ทุก call, scheduler/queue/retry (G8), comment/reply path (G6)
```

Lifecycle (ผูกกับ evidence):

```text
approved input/context (server-derived)
→ social_post_draft (RESERVED → activation ตาม §8)
→ G5 server-side model routing (policy เดิม, model whitelist เดิม)
→ LLM
→ UNTRUSTED MODEL OUTPUT
→ parse → schema validation → semantic safety validation → authority-boundary validation
→ persist as draft (content_approvals, content_type='post', status='pending')
→ human review (review_content RPC เดิม)
→ approved / rejected
```

**Invariant (ผูกกับ production constraint จริง):** `APPROVED != PUBLISHED` —
`approved` = human content approval เท่านั้น; **ไม่ใช่** Meta authorization / automatic publishing /
scheduler authorization / Page API authorization; **ไม่มี state 'published' ในระบบ ณ ปัจจุบัน — ต้องคงอยู่แบบนั้น**

## 1. INPUT CONTRACT

| ประเภท | เนื้อหา | ที่มา |
|---|---|---|
| **Trusted application context** (server-generated เท่านั้น) | draft_ref (server uuid), tenant/brand context (derived, read-only), วันที่/เวลา, task identity | DB/config ที่มี authority อยู่แล้ว — **ห้ามมี field ใหม่ที่เป็น authority** |
| **Untrusted content** (DATA เท่านั้น) | หัวข้อ/โจทย์ที่ผู้มีอำนาจระบุ (brief), ข้อความ social ที่อ้างอิง, URL/ข้อความภายนอก, ข้อความที่ AI สร้างก่อนหน้า | ทุกอย่างถูก wrap เป็น DATA — **"Data is DATA, not instructions"** |

กติกา: content ใด ๆ ที่ส่งเข้า prompt ต้องอยู่ใน data wrapper (pattern เดียวกับ G6:
`«...»`) ห้าม concat เข้า system prompt ซึ่งเป็น constant; ห้ามรับ tenant/brand/destination จาก
content หรือจาก model; oversized input ถูก truncate ที่ขอบเขตที่กำหนด (content ≤ 2,000 ตัวอักษรเข้า prompt)

## 2. OUTPUT CONTRACT (strict structured — FAIL CLOSED ทุกขั้น)

Model ต้องตอบ JSON เท่านั้น (system prompt บังคับ) — ทุก field unknown → reject:

```json
{
  "draft_ref":      "<uuid ที่ server สร้าง และต้อง echo กลับให้ตรง>",
  "title":          "string, required, 1–120 ตัวอักษร",
  "body":           "string, required, 1–2000 ตัวอักษร",
  "language":       "th | en (enum, required)",
  "tone":           "friendly | professional | playful (enum, required)",
  "hashtags":       "array<string>, required, 0–10 ตัว, ตัวละ ≤30 ตัวอักษร, รูปแบบ ^#[A-Za-z0-9_\\u0E00-\\u0E7F]+$",
  "requires_human_review": "boolean, required",
  "safety_flags":   "array, required, minItems 1 — enum: none|abusive|price_claim|payment_claim|medical|external_link|inventory_claim",
  "source_reference": "string, required, = source_reference ที่ server กำหนด (echo binding)"
}
```

**Semantic validation (server-side override/reject — เหมือน G6):**

- `draft_ref` ไม่ตรง / `source_reference` ไม่ตรง → reject (`binding_mismatch`)
- ความยาวเกิน / enum เพี้ยน / hashtag รูปแบบผิด → reject
- `safety_flags` มี flag ใด ≠ 'none' → **server override** `requires_human_review = true`
- BANNED content (regex + semantic): `auto_publish|publish now|page access token|access_token|`
  `ยืนยันการโพสต์|โพสต์ทันที|ราคา...ตัดสิน|สั่งซื้อ|ยืนยันการชำระเงิน` → reject (`banned_content_in_draft`)
- ห้าม output field ใดที่แทน publish authorization / Meta credentials / Page Access Token /
  tenant authority / brand authority / business mutation command — schema ไม่มี field เหล่านี้อยู่แล้ว
  + banned regex กันการขนทางผ่าน free-text

Failure ที่ขั้นใดขั้นหนึ่ง = **FAIL CLOSED** — ไม่ repair, ไม่ rewrite, ไม่ fallback ไปใช้ text ที่ไม่ผ่าน validation
## 3. CONTENT STORAGE CONTRACT — `content_approvals` (canonical เดิม, ไม่มี migration)

ใช้ production `content_approvals` ที่ S0 probe ยืนยันแล้ว (`content_type='post'` อยู่ใน CHECK จริง):

```text
draft creation   : เรียก RPC public.submit_content_for_approval(p_content_type='post',
                   p_title=<validated title>, p_body=<validated body>)
                   — SECURITY DEFINER เดิม, ต้อง authenticated → status='pending'
owner            : created_by = auth.uid() (คอลัมน์เดิม) — ไม่มี tenant_id/brand_id คอลัมน์ใหม่
tenant/brand     : single-brand/tenant launch (S0) — draft เป็น platform-scoped record ตาม
                   authority model เดิมของ content_approvals (B2 data matrix); G7 ไม่ invent
                   brand/tenant column ใหม่
review_status    = status เดิม ('pending') — ไม่มี field ใหม่
timestamps       : created_at/reviewed_at เดิม
AI metadata      : บันทึกเป็น execution trace ใน public.audit_logs (pattern เดิมของ W3-B/
                   automation-worker) — action='g7.draft', id='g7-draft-<draft_ref>',
                   metadata jsonb = { model, validated:true, requires_human_review,
                   safety_flags, language, tone, hashtags, source_reference, task }
                   — ไม่แตะ review_note (เก็บไว้สำหรับ human review เท่านั้น)
```

**เหตุผลที่ไม่ HARD STOP:** title/body/status/created_by/timestamps ครบตามที่ draft ต้องการ;
AI metadata ใช้ audit_logs (jsonb, pattern เดิม) — ไม่ต้อง migration, ไม่สร้างตารางใหม่

## 4. APPROVAL CONTRACT (authority เดิม — ไม่สร้างใหม่)

```text
pending  ├── approved   (review_content — is_admin() เท่านั้น)
         └── rejected   (review_content — is_admin() เท่านั้น)
```

- `approved` = human content approval เท่านั้น — **ไม่ใช่** Meta authorization,
  ไม่มี automatic publishing, ไม่มี scheduler authorization, ไม่มี Page API authorization
- `is_content_approved(id)` = publish gate แยก (ยังไม่มีใครเรียกเพื่อ publish ใน G7)
- การ publish จริง = อนาคต + ต้องมี Owner decision/authority แยกต่างหาก (นอก G7)
- G7 ห้าม bypass approval ที่มีอยู่ทุกรูปแบบ

## 5. TENANT / BRAND CONTRACT (reuse G2/Post-G2 เป๊ะ)

- tenant derive server-side เท่านั้น — ไม่มี caller-supplied tenant; cross-tenant denied;
  NULL/empty denied; unbound page denied (ที่เกี่ยวกับ page context)
- platform authority = เดิม (`is_platform_admin`) — ไม่สร้าง path ใหม่
- brand = existing relation (`brands.is_default`, single-brand) — **ห้าม** invent `brand_admin`,
  ห้ามสร้าง brand permission model ใหม่, **ห้าม**ให้ model output เลือก authority scope
- model/LLM ไม่ได้รับ tenant/brand identifiers ใด ๆ ใน prompt (แค่ context ที่ไม่มี authority)

## 6. G5 MODEL CONTRACT (reuse เป๊ะ — ไม่ redesign)

- task = `social_post_draft` ผ่าน `_shared/aiPolicy.ts` — routing policy/whitelist เดิม
  (primary `qwen/qwen3.7-flash`, fallback `z-ai/glm-5.3-flash`, maxTokens 700, timeout 60s)
- **Additive activation (contract เท่านั้น — implement ใน S2):**
  1. `TASK_POLICY.social_post_draft.status`: `'RESERVED' → 'ACTIVE'`
  2. `WORKER_ACTIVE_TASKS` **ไม่**เพิ่ม — `social_post_draft` จะถูกเรียกผ่าน proxy-context
     resolution จาก **G7 worker ของตัวเองเท่านั้น** (ไม่ expose ผ่าน ai-proxy client path)
     — รายละเอียดใน §7
- ห้าม bypass ai-proxy policy layer / ห้าม expose API keys / ห้ามรับ client-selected model /
  ห้าม model injection — ทุกอย่างเหมือน G5/G6

## 7. G6 COMPATIBILITY (separation boundary)

```text
G6 (คงเดิม ไม่แตะ): social_comment_classify + social_reply_draft
                    = event-bound (social_events), trigger = automation/internal
G7 (ใหม่):          social_post_draft
                    = event-free (brief + content_approvals), trigger = manual/internal (admin/owner)
```

- **Separation boundary:** G7 ใช้ Edge Function **ใหม่แยกต่างหาก `social-post-worker`**
  (pattern เดียวกับ social-ai-worker: AUTOMATION_TOKEN auth, service_role write, policy reuse)
  — ไม่เพิ่ม mode ใน social-ai-worker → ไม่มีทาง shared behavior ทำให้ comment reply /
  Meta reply / publishing เกิดโดยไม่ตั้งใจ
- G6 worker ไม่ถูกแก้, G6 tests ต้องผ่านครบ (G7-25 regression)
- `WORKER_ACTIVE_TASKS` คงเดิม — G7 worker resolve task ด้วย context เฉพาะของตัวเอง
  (S2 จะเพิ่ม `PolicyContext` ที่ชื่อชัด เช่น `'post_worker'` แบบ additive — ไม่แตะ 'proxy'/'worker' semantics เดิม)
## 8. SECURITY CONTRACT (testable controls)

### Prompt injection (content = UNTRUSTED DATA เสมอ)

ตัวอย่างที่ต้องถูก defense และ test ครอบ: "ignore previous instructions" · fake system/developer
message ใน content · malicious URL/text · instruction ฝังใน imported content · บังคับ publish ·
เปลี่ยน tenant/brand · ขอ secrets

Expected: content คงเป็น DATA (wrapper «...», system เป็น constant), schema-forced JSON,
semantic validation + banned regex — injection ที่ทำให้ output เพี้ยน = FAIL CLOSED

### Structured output pipeline

```text
parse → schema validation → semantic safety validation → authority validation → persist
ห้าม: best-effort repair · rewrite · fallback ไป text ที่ไม่ validate · รับ instruction จาก model
ห้าม: model ระบุ tenant/brand/publish destination
```

### Business authority — G7 ห้าม mutate: orders, payment, inventory, delivery, refund,
cancellation, price, capacity (worker เขียนได้เฉพาะ content_approvals + audit_logs)

### External authority — G7 ห้าม: publish · เรียก Meta write API · สร้าง publish job ·
สร้าง publish token · ใช้ Page Access Token · schedule publication

## 9. IDEMPOTENCY CONTRACT (ไม่มี migration)

```text
source_reference = server-generated request key (uuid) — ผู้เรียกไม่กำหนดเอง
trace id         = 'g7-draft-<draft_ref>' ใน audit_logs (PK — deterministic)
replay detection : ก่อน persist ตรวจ audit_logs id='g7-draft-<draft_ref>' มีอยู่แล้ว?
                   → duplicate: true → no-op (pattern เดียวกับ automation-worker previousExecution)
same request replay (draft_ref/source_reference เดิม) = 1 draft เท่านั้น
new intentional generation = server สร้าง draft_ref/source_reference ใหม่ → draft ใหม่ตามควร
ห้าม: uniqueness migration ใหม่ · queue dedup ใหม่ (G8)
```

หมายเหตุ: `submit_content_for_approval` สร้าง id เอง (`cap-...`) — replay protection จึงผูกที่
trace id ใน audit_logs (deterministic PK) ไม่ใช่ที่ content_approvals → ปลอดภัยโดยไม่ migration

## 10. FAILURE CONTRACT (ทุก failure = fail safely)

| Failure | พฤติกรรม |
|---|---|
| unauthorized caller | 401 (AUTOMATION_TOKEN pattern) — ไม่มี state เปลี่ยน |
| missing/invalid tenant/context | reject ก่อนเรียก AI — ไม่มี draft |
| invalid task | `invalid_task`/`reserved_task` จาก policy — 400 |
| model timeout / provider error | FAIL (`AI_UPSTREAM`) — ไม่ persist, ไม่ auto-retry (G8 รับผิดชอบ retry/backoff) |
| malformed output / schema violation | FAIL (`AI_OUTPUT_REJECTED:...`) — ไม่ persist |
| semantic safety violation / injection | FAIL (`AI_OUTPUT_REJECTED:banned_content_in_draft` ฯลฯ) — ไม่ persist |
| duplicate request | `{ duplicate: true }` — no-op |
| persistence failure | FAIL (`AI_PERSIST_ERROR`) — ไม่มี partial publish state, ไม่มี business mutation |

ไม่มี partial publish state ทุกกรณี · ไม่มี automatic retry architecture ใน G7

## 11. TEST CONTRACT — G7-01..25 (จัดทำจริงใน S3)

`G7-01` task identification · `G7-02` model routing (policy model, ไม่รับ client model) ·
`G7-03` reserved/unauthorized ก่อน activate · `G7-04` valid generation · `G7-05` schema validation ·
`G7-06` malformed fail-closed · `G7-07` prompt injection (6 ตัวอย่างตาม §8) · `G7-08` oversized input ·
`G7-09..12` tenant derivation/cross-tenant/NULL/empty · `G7-13` brand boundary · `G7-14` approval state ·
`G7-15` APPROVED != PUBLISHED · `G7-16` no Meta publish path · `G7-17` no Page token ·
`G7-18..21` no business/order/payment/inventory mutation · `G7-22` replay/idempotency ·
`G7-23` unauthorized invocation · `G7-24` G5 regression (aiRouting ครบ) · `G7-25` G6 regression (comment path ครบ)

เพิ่มเติมจาก contract: `G7-26` draft_ref/source_reference binding mismatch → reject ·
`G7-27` banned content regex (publish language) · `G7-28` AI metadata trace ใน audit_logs (deterministic id)

## 12. EXPLICIT NON-GOALS (G7)

publish ทุกรูปแบบ · Meta API call ใด ๆ · Page Access Token · automatic posting ·
scheduler registration · queue/retry/backoff/concurrency orchestration · dead-letter/recovery ·
social inbox automation · comment reply path · order/payment/inventory/delivery/refund/price/capacity
mutation · tenant/brand authority ใหม่ · ตารางใหม่ · migration

## 13. G8 DEFERRED RESPONSIBILITIES

scheduler/queue/retry/backoff/concurrency/failure recovery รวมถึงการ register
`social-post-worker` ลง scheduler (เมื่อ G8 มา — เช่นเดียวกับ social-ai-worker)

## 14. G4 EXTERNAL DEPENDENCY

real Meta E2E (รวมถึง publish จริงในอนาคต) = BLOCKED/DEFERRED จนกว่า G4 ปิด (Meta App Review/
Approval) — G7 ไม่ใช้ Meta credential ใด ๆ และไม่ขึ้นกับ G4 ในการสร้าง draft

## 15. EVIDENCE SUMMARY

| หัวข้อ | สถานะ |
|---|---|
| content_approvals + 'post' + CHECK + RPCs | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (S0 probe สด) |
| APPROVED != PUBLISHED | RUNTIME VERIFIED (constraint จริง, ไม่มี published state) |
| social_post_draft policy entry | IMPLEMENTED · RESERVED (จะ activate ใน S2) |
| aiStructuredOutput / injection defense pattern | IMPLEMENTED · RUNTIME VERIFIED (G6) |
| social-post-worker | MISSING (S2) — contract กำหนดแล้วในเอกสารนี้ (DOCUMENTED) |
| publish path / Page token | MISSING (โดยตั้งใจ — BLOCKED จนกว่า G4 + Owner decision) |
| AdminContentApprovals review UI | IMPLEMENTED · DORMANT — human review ผ่าน RPC เดิม |