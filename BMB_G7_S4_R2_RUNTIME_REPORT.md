# BMB G7 — S4-R2 PRODUCTION DEPLOY + RUNTIME VERIFICATION REPORT

- Project `ivkdfognyiwjcmrhcnwz` · function `social-post-worker` · date 2026-10-03
- Baseline: G7 S3-R1 PASS @ `60d5d61` (HEAD == origin/main, worktree clean — ตรวจก่อนเริ่ม)
- Synthetic refs (ใหม่ทั้งหมด ไม่ reuse S4-R1): `g7-s4r2-20261003T090000Z-q7w2n4`, `g7-s4r2-20261003T091500Z-m3k8v6`

## 1. DEPLOYED = PASS

- slug `social-post-worker` — deploy ฟังก์ชันเดียว (ไม่มี function อื่นถูกแตะ; list ก่อน deploy ยืนยันว่าทุกฟังก์ชันอื่นคง version เดิม)
- HTTP **201** (Management API multipart — กลไกเดียวกับที่พิสูจน์แล้วใน S4-R1, evidence `e2e/g7s4-deploy-evidence.json`)
- active version **3** (จาก defective v2) · status ACTIVE · verify_jwt **true**
- bundle sha256 บันทึกใน evidence · deploy scope = index.ts + `_shared/aiPolicy.ts` + `_shared/aiTimeout.ts` + `_shared/aiStructuredOutput.ts` เท่านั้น
- ไม่มี migration / schema change ใด ๆ

## 2. VERIFY DEPLOYED SOURCE = PASS

- GET `/v1/projects/{ref}/functions/social-post-worker` → v3 ACTIVE verify_jwt=true
- GET deployed body → 79,771 bytes
- `is_default=eq.true` พบ 2 จุด · bare `is_default=true` = **0 จุด** (negative-lookahead)
- brand line ตรงเป๊ะ: `rest('GET', '/rest/v1/brands?select=id,tenant_id&is_default=eq.true&limit=1')`

## 3. AUTH NEGATIVE = PASS (5/5 → 401)

| Case | Status |
|---|---|
| publishable key ไม่มี x-automation-token | 401 unauthorized |
| invalid token | 401 unauthorized |
| blank token | 401 unauthorized |
| anon bearer ไม่มี apikey | 401 Invalid JWT |
| Basic auth | 401 not Bearer |

ไม่มีการใช้ Page Access Token / VERIFY_TOKEN / SUPABASE_ACCESS_TOKEN เป็น automation auth

## 4. RUNTIME VERIFIED = PASS (F1–F16)

Invocation: ครั้งแรก **422** `AI_OUTPUT_REJECTED:malformed_json_or_empty` — fail-closed ตาม contract (AI คืน non-JSON ครั้งแรกที่ AI path ถูกเรียกจริงบน prod; **ไม่มี DB write จากครั้งนั้น**, ตรวจ residue=0 ก่อน retry ด้วย ref เดิม) → ครั้งที่สอง **200**

| Proof | Evidence |
|---|---|
| F1 HTTP success | 200 `{"ok":true,...}` |
| F2 reached handler | ผ่าน auth + input contract + idempotency pre-check ถึง AI/persist |
| F3 task | audit metadata `task:"social_post_draft"` |
| F4 tenant derived server-side | metadata `tenant_context:"tenant-bmb-001/brand-bmb-main"` (จาก `brands where is_default=eq.true`; worker ไม่มี field รับ tenant/brand จาก caller) |
| F5 default brand resolved | REST `is_default=eq.true` → 200 → `brand-bmb-main` (D3 หาย — ไม่มี missing_tenant_context) |
| F6 G5 model routing | metadata `model:"qwen/qwen3.7-flash"` (resolveTaskPolicy — never client-selected) |
| F7 structured validation | metadata `validated:true` (parse→schema→semantic, rejectUnknown) |
| F8 content_approvals row | `g7cap-<ref>` exists |
| F9/F10/F11 | `content_type='post'` · `status='pending'` · `created_by=NULL` |
| F12/F13 audit | row exists, action `g7.draft`, id `g7-draft-<ref>` |
| F14 audit metadata | ไม่มี token/secret ใด ๆ |
| F15 no Meta call | worker ไม่มี Meta/publish code; no publish path |
| F16 no business mutation | draft INSERT + audit INSERT เท่านั้น |

## 5. IDEMPOTENCY VERIFIED = PASS

- SAME ref ซ้ำ → 200 `duplicate:true` + previous metadata + no-op note
- หลัง replay: content_approvals ยัง = 1 · audit g7.draft ยัง = 1 · row เดิมไม่เปลี่ยน
- NEW ref → 200 สร้าง draft ใหม่ IDs เป็นอิสระ (CA=2, audit=2 ยืนยันทาง DB)

## 6. APPROVAL BOUNDARY = PASS

- Worker ไม่มี approve/reject/publish (hard-coded status='pending', created_by=NULL)
- Negative: review_content() ผ่าน service_role → P0001 ERR_NOT_AUTHENTICATED (service path แกะ review ไม่ได้เลย)
- Negative: review ซ้ำ (replay) → P0001 ERR_APPROVAL_NOT_PENDING (transition ทางเดียว แก้ย้อนไม่ได้)
- Human review ผ่าน canonical review_content() ด้วย admin fixture เดิม (BMB_TEST_ADMIN_* มีอยู่แล้วตั้งแต่ Wave 1 — grant_type=password, JWT ใช้ในหน่วยความจำเท่านั้น ไม่พิมพ์/ไม่บันทึก): pending → approved = 200 {"ok":true,"status":"approved"} + audit action 'content_review'
- อีก draft คง status='pending' (worker ไม่แตะ state หลัง INSERT)
- APPROVED != PUBLISHED: status='published' = 0 rows · ไม่มี Meta callback · ไม่มี publish API · ไม่มี Page token (publish path ไม่มีอยู่ใน G7 ตาม D-G7-A)

## 7. CLEANUP VERIFIED = PASS

- ลบเฉพาะ exact ids (id เต็มทุก statement — ไม่มี broad DELETE): g7cap-<ref1>, g7cap-<ref2>, g7-draft-<ref1>, g7-draft-<ref2> + audit content_review ที่ entity_id ชี้ synthetic drafts
- หลัง cleanup: content_approvals = 0 (baseline ก่อนรอบนี้ = 0 — ไม่มี unrelated row ถูกลบ) · g7cap-% = 0 · g7-draft-% = 0 · action g7.draft = 0 · action content_review = 0

## 8. REGRESSION = PASS

- npm test = 488 passed / 0 failed · subset G5 aiRouting(31) + G6 g6Security(27) + G7 g7Security(63) = 121/121
- tsc --noEmit = 0 · eslint = 0 · vite build = 0 · secret scan (diff + evidence) = CLEAN
- Production สด: unauthorized = 401 · ai-proxy social_post_draft = 400 invalid_task (G5 boundary — task นี้อนุญาตเฉพาะ post-worker) · G6 worker (social-ai-worker v2) ไม่รู้จัก x-automation-token → activate G7 ไม่ได้ · ไม่มี Meta publish path

## 9. AUTOMATION_TOKEN

- CONFIGURED = YES (GitHub PRESENT + Supabase Function PRESENT — audit รอบ S3-R1)
- VALUE EXPOSED = NO (อ่านจาก supabase/secrets.local.env ใน runner เท่านั้น; response ถูก scan หา token ทุกครั้ง; ไม่พิมพ์/ไม่บันทึกใน evidence)
- ไม่มี create/rotate/replace; ไม่ใช้ Page token / VERIFY_TOKEN / SUPABASE_ACCESS_TOKEN แทน

## 10. VERDICT

| Gate | Result |
|---|---|
| DEPLOYED | PASS |
| RUNTIME VERIFIED | PASS |
| IDEMPOTENCY VERIFIED | PASS |
| APPROVAL BOUNDARY | PASS |
| CLEANUP VERIFIED | PASS |
| REGRESSION | PASS |

**G7 S4-R2 = PASS** — production วิ่งบน fixed v3 (is_default=eq.true) แล้ว

ข้อจำกัดตาม contract: ยังไม่ประกาศ "G7 COMPLETE" / "OPEN SHOP READY" / "TRUE PRODUCTION CLOSURE" — รอ G7 Final Gate โดย Owner/Controller เท่านั้น
