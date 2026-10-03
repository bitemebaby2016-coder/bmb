# BMB_G6_WORKLOG.md

Gate: **G6 — Social Comment AI Foundation** (Social Comment AI Foundation)
วันที่: 2026-10-03 BKK
ทำงานเป็น Stage: G6-S0 → S1 → S2 → S3 → S4 → S5 (แต่ละ Stage ต้อง commit/push/clean ก่อนข้าม)

## G6-S0 — BASELINE + AUDIT ONLY

### Baseline (ยืนยันจริง)

```text
HEAD         = a775fe04d5a966971738dcd2b55ba28f48c8b013
origin/main  = a775fe04d5a966971738dcd2b55ba28f48c8b013
WORKTREE     = CLEAN
INDEX        = CLEAN
G4           = HOLD — EXTERNAL META REVIEW / APPROVAL (ไม่ถูกแตะ)
G5           = PASS (ai-proxy vG5 deployed + runtime probe PASS 6/6)
```

### Production DB audit (ผ่าน Management API SQL — READ-ONLY เท่านั้น, script `e2e/g6s0DbAudit.cjs`)

**Tables (public):**

| Table | est_rows | สถานะ |
|---|---|---|
| `social_events` | 0 | IMPLEMENTED · DEPLOYED (migration 109) · RUNTIME VERIFIED (schema probe) — ยังไม่มี event จริง (ตาม G4 HOLD) |
| `channel_page_bindings` | 2 rows | IMPLEMENTED · CONNECTED — FACEBOOK + MESSENGER → `tenant-bmb-001`, `is_active=true` (Page 862940416913026) |
| `content_approvals` | 0 | IMPLEMENTED · DEPLOYED (migration 022) · DORMANT (0 rows) |
| `brands` | 1 | IMPLEMENTED (single-brand launch) |
| `tenants` | 1 | IMPLEMENTED (`tenant-bmb-001`) |
| `social_event_actions` / `social_replies` | **ไม่มี table** — MISSING (ไม่จำเป็น: state ฝังใน `social_events` แล้ว) |

**`social_events` schema (จาก production จริง + migration 109):**

- Ingestion: `event_id`, `platform` (CHECK: MESSENGER|FACEBOOK|FACEBOOK_GROUP), `page_id`, `event_type` (CHECK: comment|message|mention), `sender_id/name`, `content`, `payload`
- Tenant/brand: `tenant_id NOT NULL` (FK tenants), `brand_id` nullable (FK + constraint `fk_social_events_brand_tenant`: brand ต้องอยู่ tenant เดียวกัน)
- Status machine (CHECK): `RECEIVED|PROCESSING|SUCCEEDED|FAILED|RETRYABLE|IGNORED|DUPLICATE` + `attempts`/`last_error`/`claimed_at`
- **AI state (non-authoritative, เตรียมไว้แล้วตั้งแต่ G3):** `ai_model`, `ai_reply_text`, `ai_validated`, `ai_guardrail_flags`
- Action state: `action_type` CHECK `none|reply|order`, `order_number` = REFERENCE ถึง canonical orders เท่านั้น
- Reply delivery state: `reply_status` CHECK `pending|sent|failed`, `reply_provider_id`, `reply_attempted_at`
- Idempotency: `UNIQUE (platform, event_id)` + `ON CONFLICT DO NOTHING` (HC-4) — probe ยืนยัน dup_groups = 0

**RLS / Grants (จาก production):**

- `social_events`: RLS ENABLED; policies = `social_events_tenant_read` (`is_tenant_admin_of(tenant_id)`) + `social_events_platform_read` (`is_platform_admin()`) — SELECT เท่านั้น; grants: authenticated=SELECT, service_role=ALL; **anon = REVOKE (DENY)**; write path = service_role เท่านั้น (ผ่าน `ingest_social_event` SECURITY DEFINER, EXECUTE ให้ service_role)
- `content_approvals`: RLS ENABLED; policies: admin ALL (`is_admin()`), authenticated SELECT, anon policy USING(false); grants authenticated INSERT/UPDATE/SELECT/DELETE (via RPC security definer)
- `channel_page_bindings`: RLS ENABLED

**RPCs ที่เกี่ยวข้อง (production):** `ingest_social_event(p_platform,...)` (G3 ingestion, tenant derivation server-side, brand = `brands.is_default` — single-brand, ไม่ยอมรับ caller-supplied brand), `submit_content_for_approval`, `review_content` (admin-only, pending→approved/rejected เท่านั้น), `is_content_approved` (publish gate), `auto_approve_order` (order domain — ไม่เกี่ยวกับ social reply)

**Edge Functions (production list):** `ai-proxy` (G5, verify_jwt=false + in-function auth), `channel-webhook` (G4, verify_jwt=false + HMAC), `automation-worker`, `create-checkout`, `stripe-webhook`, `stripe-refund`, `phone-auto-login`, `voice-tts` — **ไม่มี social processing/outbound EF**
### Repository audit (root — ไม่ใช้ stale copy `bmb/`)

| Code path | สถานะ |
|---|---|
| `ai-proxy` + `_shared/aiPolicy.ts` | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (G5) — tasks `social_comment_classify`/`social_reply_draft`/`social_post_draft` = **RESERVED (400 จริงบน production, probe R4)** |
| `src/lib/aiModels.ts` | IMPLEMENTED (re-export policy) |
| `src/lib/aiService.ts`, `aiGuardrails.ts`, `aiGuardrailsAdv.ts` | IMPLEMENTED (chat path + guardrail 2 ชั้น) |
| `supabase/functions/channel-webhook` | IMPLEMENTED · DEPLOYED (v6, HMAC runtime verified) — ingest path เท่านั้น ยังไม่มี classify/reply |
| `ingest_social_event` | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (G3 tests + production schema) |
| social inbox / comment moderation UI (root `src/`) | **MISSING** (ค้นแล้ว: ไม่มีไฟล์ใดใน root src อ้าง `social_events` — มีเพียง `aiRouting.test.ts` ที่กัน reserved task) |
| AI classify caller สำหรับ social events | **MISSING** (ไม่มี code เรียก `social_comment_classify` — reserved เท่านั้น) |
| Reply draft writer ลง `social_events.ai_reply_text` | **MISSING** |
| Outbound Meta reply/post (`reply_status='sent'`, `reply_provider_id`) | **MISSING** — ไม่มี Meta write code, ไม่มี `PAGE_ACCESS_TOKEN` secret (ยืนยันจาก secret list: ไม่มี FACEBOOK_/PAGE_ACCESS) → **BLOCKED (G4 + Meta permission)** |
| `contentApproval` (`contentAutomation.ts` → `submit_content_for_approval`/`review_content`) | IMPLEMENTED · DORMANT (0 rows) |
| Meta API client | **MISSING** (ไม่มี Facebook Graph API call ใน repo root) |
| publish path (real post) | **MISSING** → G7 scope, DEFERRED |

### Existing approval path (ตรวจของจริง — migration 022 + production schema)

```text
content_approvals.status = 'pending' | 'approved' | 'rejected'   (CHECK constraint จริง)
submit_content_for_approval  → สร้างแถว status='pending' (ต้อง authenticated)
review_content               → admin-only: pending → approved/rejected (transition ตรวจ WHERE status='pending')
is_content_approved(id)      → publish gate แยก: approved = "publishable" เท่านั้น
ไม่มี state 'published' ใน content_approvals; ไม่มี auto-publish ทุก path
```

**สรุป semantic ตามที่คำสั่ง G6-S1 ต้องการ:**

- `DRAFT → APPROVED / REJECTED`: **มีอยู่จริง** ในชื่อ `pending → approved/rejected` (semantic เดียวกัน; ห้ามสร้าง state 'draft' ใหม่ — ใช้ 'pending' ตามของจริง)
- `APPROVED != PUBLISHED`: **มีอยู่จริง** — `is_content_approved` เป็น gate แยก ไม่มี code path ใด publish อัตโนมัติหลัง approve → **ไม่ต้อง HARD STOP** (บันทึก mapping นี้ใน contract)

### Security boundary (ปัจจุบัน)

- social_events เขียนได้เฉพาะ service_role; อ่านเฉพาะ tenant/platform admin; anon DENY
- tenant derivation server-side จาก `channel_page_bindings` เท่านั้น (ไม่ยอมรับ caller-supplied tenant/brand)
- brand = `brands.is_default` ภายใต้ tenant (single-brand launch — ห้ามแตะ authority นี้)
- AI = untrusted intelligence: guardrail ฝัง server-side ใน ai-proxy (AI-02) + client `aiGuardrails.ts` — AI ไม่มี authority ต่อ price/payment/stock/order (ยืนยันแล้วใน G5)

### Findings / ข้อจำกัดที่ G6 ต้องออกแบบให้ชัด (ไม่ตัดสินเองใน S0)

1. **Write path สำหรับ AI state:** `social_events` เขียนได้เฉพาะ service_role — การเก็บ classification/draft ต้องผ่าน service-side path (Edge Function / automation-worker extension) ไม่ใช่ client write → เสนอใน S1 contract (proposal เท่านั้น)
2. **ไม่มี UI ทบทวน draft** (social inbox) — MISSING: ถ้า G6 ต้องมี human approval ของ reply draft ต้องเสนอ UI/RPC เพิ่ม = **Owner decision** (additive) ใน S1
3. **`reply_status` มี 'sent'** แต่ outbound Meta = BLOCKED (G4 + ไม่มี PAGE_ACCESS_TOKEN) → G6 จะไม่แตะ 'sent' จนกว่า Meta พร้อม
4. **status ของ social_events ไม่มี state สำหรับ classified/drafted** — ใช้ `status='SUCCEEDED'` + AI columns เป็น evidence ได้ หรือต้อง migration เพิ่ม CHECK value → **G6 DB CHANGE REQUIRED** หากต้องเพิ่ม (proposal ใน S1, ห้าม implement ก่อน Owner อนุมัติ)
5. `content_approvals.content_type` CHECK = promotion|banner|post|announcement — **ไม่มี 'social_reply'** → ถ้าจะใช้ approval workflow กับ reply draft ต้อง migration (proposal เท่านั้น)

### Proposed G6 scope (ส่งต่อ S1 ตัดสิน — ยังไม่ implement)

```text
Task 1: social_comment_classify  → ACTIVE (classify เก็บผลใน social_events AI columns)
Task 2: social_reply_draft       → ACTIVE (draft เก็บใน ai_reply_text + requires_human_review)
Deferred: social_post_draft      → RESERVED (G7)
Outbound Meta reply              → BLOCKED (รอ G4 + Meta permission) — ห้ามแตะ reply_status='sent'
Human review ของ reply draft     → เสนอ additive UI/RPC (ต้อง Owner decision)
```

### S0 gate result

```text
npm test (baseline regression) = 42 files passed (ไม่มี code change ใน S0)
S0 = AUDIT COMPLETE — ไม่มี implementation
Commit: ce0254a — HEAD == origin/main, WORKTREE/INDEX CLEAN ยืนยันแล้ว
```

## G6-S1 — CONTRACT + DESIGN (จบแล้ว)

- สร้าง `BMB_G6_CONTRACT.md`: task activation (`social_comment_classify` + `social_reply_draft` = ACTIVE, `social_post_draft` = RESERVED), input/output schema, validation (FAIL CLOSED), failure behavior, authorization (automation-token pattern เดิม), tenant/brand scope (derived เท่านั้น), idempotency (UNIQUE + claim), retention/PII, approval/publish boundary
- **Critical approval rule ตรวจของจริงแล้ว (S0):** `pending→approved/rejected` + `is_content_approved` gate = **มี semantic ครบ** → ไม่ HARD STOP; mapping บันทึกชัด: DRAFT ≈ 'pending', APPROVED != PUBLISHED ✅
- **`G6 DB CHANGE REQUIRED` = ไม่มี** — ใช้คอลัมน์ที่ migration 109 มีอยู่แล้วทั้งหมด (`ai_model/ai_reply_text/ai_validated/ai_guardrail_flags` jsonb) — ไม่มี migration, ไม่แตะ RLS/grant
- Processing component (proposal ที่ S2 จะ implement): EF ใหม่ `social-ai-worker` — auth pattern เดียวกับ `automation-worker` (`AUTOMATION_TOKEN`), เขียนผ่าน `SUPABASE_SERVICE_ROLE_KEY` (grant เดิมจาก migration 109), AI routing import `_shared/aiPolicy.ts` + validator `_shared/aiStructuredOutput.ts` (G5 reuse), trigger = manual + automation-scheduler.yml (scheduler เดิม)
- Human review UI = **DEFERRED**; outbound Meta = **BLOCKED** (G4); `reply_status` คง NULL ตลอด G6; `action_type` คง 'none'
- S1 verification: contract เทียบกับ production evidence (S0) ตรงทุกจุด — ไม่มี authority ใหม่, ไม่มี business rule ใหม่, ไม่มี destructive change

```text
S1 = CONTRACT COMPLETE (docs เท่านั้น)
NEXT: G6-S2 Implementation หลัง commit/push/clean ยืนยัน
```