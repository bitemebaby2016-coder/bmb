# BMB — G7 S4 RUNTIME REPORT (HARD STOP: DEPLOYED, RUNTIME BLOCKED BY DEFECT)

> วันที่: 2026-10-03 · Base: S3 `2df3c08892cf309d0d5a0010eb611650208d0b10` · Project: `ivkdfognyiwjcmrhcnwz`
> สถานะรวม: **S4 = FAIL (HARD STOP) — กลับไป S3 ก่อน deploy รอบใหม่** ตามเงื่อนไข "ถ้ามี source change เพราะพบ defect: HARD STOP และกลับไป S3 security/test ห้ามแก้แล้วประกาศ S4 PASS"

## 1) DEPLOYED = PASS (mechanism เดิม, scope ตรง)

- Deploy เพาะ `social-post-worker` ผ่าน Management API `POST /v1/projects/{ref}/functions/deploy?slug=social-post-worker` (mechanism เดียวกับ `e2e/step2_deploy.cjs` ที่ repo ใช้ — ไม่สร้าง deploy architecture ใหม่)
- ผลจริง: `201` · slug=`social-post-worker` · **version 2** · status=`ACTIVE` · `verify_jwt=true` · entrypoint=`index.ts`
- Files ที่ deploy: `social-post-worker/index.ts` + `_shared/aiPolicy.ts` + `_shared/aiTimeout.ts` + `_shared/aiStructuredOutput.ts` (bundle ตาม import graph — Supabase API ปัจจุบันต้องแนบไฟลทุกไฟลใน multipart เอง)
- ไม่ deploy: ai-proxy / social-ai-worker / automation-worker / channel-webhook / scheduler / อื่น ๆ (ยืนยันด้วย list functions ก่อน-หลัง: version ตัวอื่นไม่เปลี่ยน)
- selfprint: **ไม่เกี่ยวและไม่ถกแตะ** — selfprint เปนคนละ repo + เปน local Supabase stack (port 54321); deploy นี้ชี้ project ref ของ BMB เท่านั้น; function list ของ BMB prod ไม่มี selfprint
- Deployment defect ที่พบและแก้ใน evidence script เท่านั้น (ไม่ใช่ product code): ฟอรแมต multipart ของ deploy endpoint ปัจจุบัน = field `file` (array) + filename เปน repo-relative path + entrypoint_path ตรงกับ filename (v1 ใช้ `files` → 400; flat filename → bundle error `_shared` not found → v5 ผ่าน). supabase CLI ใช้ไม่ได้บนเครื่องนี้ (CliConfigParseError, machine-level) — ไม่แก้ config.toml

## 2) RUNTIME VERIFIED = FAIL (S4-E blocked — defect D3 ใน worker)

### S4-D production auth negatives = PASS (ทุกแบบ 401)

```text
D1 publishable-key ดยไม่มี x-automation-token  -> 401 unauthorized
D2 x-automation-token ไม่ถกต้อง               -> 401 unauthorized
D3 x-automation-token ว่าง                      -> 401 unauthorized
D4a Bearer ปลอม (ไม่มี apikey)                  -> 401 Invalid JWT (verify_jwt=true)
D4b Basic auth                                  -> 401 Auth header is not 'Bearer {token}'
```

### S4-E valid synthetic invocation = BLOCKED ที่ tenant derivation (502)

- Synthetic ref: `g7-s4-20261003T030303Z-j4vf18` (pattern `g7-s4-<timestamp>-<random>`, ไม่มี real customer/order/Meta content)
- Pre-probe: draft id `g7cap-<ref>` และ trace `g7-draft-<ref>` ไม่มีอย่ · baseline `content_approvals`=0 · `audit_logs(action='g7.draft')`=0 · brand default = `brand-bmb-main` / `tenant-bmb-001`
- Call จริง (internal token ผ่าน `supabase/secrets.local.env`, ไม่พิมพค่า): HTTP **502** `{"error":"missing_tenant_context"}`
- สาเหตุที่พิสจนแล้ว (REST reproduction ตรง): worker บรรทัด 301 ใช้ `GET /rest/v1/brands?select=id,tenant_id&is_default=true&limit=1` — PostgREST **ต้องใช้ `is_default=eq.true`**; รปแบบเดิมได้ **400 PGRST100** → `ctx` ว่าง → fail-closed `missing_tenant_context` (ทำงานถกต้องตามออกแบบ — ปลอดภัย, แต่ทำให้ flow สร้าง draft ใช้ไม่ได้)
- **DEFECT D3 (แก้ไม่ได้ใน S4 ตามกติกา)**: `supabase/functions/social-post-worker/index.ts:301` → ต้องเปน `/rest/v1/brands?select=id,tenant_id&is_default=eq.true&limit=1` (G6 worker/ส่วนอื่นไม่พบ pattern นี้ — เปนบักเพาะไฟลนี้, หลุดรอดเพราะ S0–S3 ทดสอบ tenant ด้วย stubbed rest ไม่ใช่ PostgREST จริง)
- E1–E16 จึง **ยังไม่พิสจน** (ยกเว้น E4 ในเชิงลบ: fail-closed ทำงานจริง)

### S4-F idempotency = ยังทดสอบไม่ได้ (blocked ดย D3) · S4-G approval boundary = ยังทดสอบไม่ได้

## 3) CLEANUP VERIFIED = PASS (ไม่มีสิ่งใดต้องลบ)

- Post-run probe: `CA_SYNTHETIC=0`, `TRACE_SYNTHETIC=0`, `CA_TOTAL=0`, `AL_G7DRAFT_TOTAL=0` — **ไม่มี row ใดถกสร้าง** (worker fail-closed ก่อน INSERT เสมอ) → ไม่มี synthetic residue, ไม่มี unrelated row ถกแตะ, ไม่มี broad DELETE

## 4) TEST VERIFIED = PASS (post-runtime regression)

```text
tsc --noEmit = exit 0 · eslint = exit 0 · build = exit 0
npm test = 485 passed / 0 failed (aiRouting 31, g6Security 27, g7Security 60 รวมอย่)
secret scan บนไฟลที่ commit = CLEAN (ไม่มีค่า secret จริงในไฟลใด ๆ)
```

## 5) สรุปสถานะ (ห้ามใช้คำ COMPLETE/PRODUCTION READY/OPEN SHOP READY)

| หัวข้อ | สถานะ |
|---|---|
| IMPLEMENTED | PASS (จาก S3) |
| SECURITY VERIFIED | PASS (จาก S3) |
| TEST VERIFIED | PASS (485/0) |
| DEPLOYED | PASS (social-post-worker v2 ACTIVE) |
| RUNTIME VERIFIED | **FAIL** (D3 tenant derivation — 502 ทุกครั้ง) |
| CLEANUP VERIFIED | PASS (ไม่มี synthetic residue: 0 rows) |

## 6) ขั้นถัดไป (รอ Owner)

1. กลับส่ **S3**: แก้ D3 (`is_default=true` → `is_default=eq.true`) + เพิ่ม test กัน regression (assert query string รปแบบ PostgREST ที่ถกต้อง / integration-style contract test) → commit ตามรอบ S3
2. จากนั้นขอคำสั่งรัน S4 รอบใหม่ (pre-probe → deploy → S4-D..H) — synthetic ref ใหม่ ห้าม reuse ของเดิม
3. หมายเหตุ incident ระหว่างทาง (ไม่กระทบ production): editor-batch ทำไฟล script ชั่วคราวเสียหาย + สร้างไฟลขยะนอก repo (`D:\A PUBLISHABLE PROJECT`) — ลบออกหมดแล้ว, production/DB ไม่ถกกระทบ

## 7) GIT / EVIDENCE

```text
HEAD == origin/main : (ด้านล่าง — หลัง commit report นี้)
WORKTREE = CLEAN
Evidence: e2e/g7s4-deploy-evidence.json · e2e/g7s4-invoke-g7-s4-20261003T030303Z-j4vf18.json
          e2e/g7s4AuthNeg.cjs · e2e/g7s4Deploy.cjs · e2e/g7s4Invoke.cjs · e2e/g7s4ListFunctions.cjs · e2e/g7s4PreProbe.cjs
```

**DECISION: S4 = FAIL → HARD STOP — ห้ามเริ่ม G8/G9/G10 — รอคำสั่งถัดไปจาก Owner/Controller**
