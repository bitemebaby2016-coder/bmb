# BMB — G9 FINAL REPORT (SOCIAL AI PRODUCTION E2E)

**G9 RESULT: PASS — โดย Owner อนุมัติ 2026-10-06**
> คำสั่ง Owner: *"G9 decision อนุมัติทำครบ ตามกฏ ทดสอบผ่านทั้งหมด อนุญาติอัพเดทเอกสารครบแล้วค่อยคอมมิทพุช"*
> (Contract §10.7 — Owner เป็นผู้อนุมัติคนเดียว; เอกสารนี้บันทึกการอนุมัตินั้น ไม่ใช่การประกาศของ AI)

**Contract:** `BMB_G9_CONTRACT.md` · **รายงานระหว่างทาง:** `BMB_G9_NONMETA_OWNER_REVIEW.md` (§1–§5 = รอบ Non-Meta, §6 = REAL PUBLISH 2026-10-06)

---

## E2E JOURNEY EVIDENCE (ต่อ stage)

Chain [LOCKED]: `REAL EVENT → INGEST → CLASSIFY → ROUTE → GENERATE → AUTHORIZE → ACTION → RESULT → PERSISTENCE → REPLAY SAFETY → FAILURE RECOVERY`

| Stage | หลักฐาน | สถานะ |
|---|---|---|
| REAL EVENT (outbound — publish) | คำสั่ง publish จริง 2 รายการ (PRE_ORDER + SAME_DAY) จาก approval row ที่ Owner สั่งสร้าง | ✅ production real |
| INGEST (outbound) | `content_approvals` rows `g9-journey-preorder-001` / `g9-journey-sameday-001` (status=approved) | ✅ |
| CLASSIFY / ROUTE / GENERATE | G5/G6 evidence เดิม (6/6 + ai-proxy runtime) — reuse ตาม contract (ห้าม rerun) | ✅ reuse |
| AUTHORIZE | `content_approvals` CHECK `status='approved'` เท่านั้นที่ worker รับ · pending → 409 (`publishWorkerProbe` #5) · human review path = `review_content` (admin-gated) | ✅ |
| ACTION | `social-publish-worker` → Graph `POST /{page_id}/feed` → **HTTP 200** โพสต์จริง 2 โพสต์ (`862940416913026_122142901857204867`, `862940416913026_122142901881204867`) | ✅ |
| RESULT | approval row `review_note = 'PUBLISHED <post_id>'` (ยืนยัน live ทั้ง 2 แถว) | ✅ |
| PERSISTENCE | `audit_logs` = `g9-publish-*` จำนวน **2/2 แถว** (action=`social.publish`) + evidence file `e2e/g9-publish-journey-evidence.json` | ✅ |
| REPLAY SAFETY | replay ทั้ง 2 approvalId → `already=true` + post_id เดิม · **0 duplicate post** · audit PK ตายตัว 1 แถว/โพสต์ | ✅ |
| FAILURE RECOVERY | negative probe 5/5 (401/400/400/404/409) · failure audit id ตายตัว `g9-publish-fail-*` (replay ไม่ pile แถวซ้ำ) · G8-S5 retry evidence ของเดิม | ✅ |

- **REAL EVENT (inbound — comment/message จากลูกค้า)** ยังไม่มี event จริง = **ขอบเขต G4 (Real Meta Verification หลัง G9)** — เป็นที่ทราบและอนุมัติแล้วตาม D-03 + contract §2 (G4 = หลัง G9) · live state ยังสะอาด (FAILED/RETRYABLE/PROCESSING = 0/0/0, ยืนยันซ้ำด้วย `g9NonMetaProbe` รอบนี้)

## FAILURE MATRIX EVIDENCE (12/12)

| # | Canonical identifier | หลักฐาน | ผล |
|---|---|---|---|
| 1 | `channel-webhook` validation/signature | `e2e/g3_webhook_boundary.mjs` + G3 final report (reuse) | ✅ invalid ถูกปฏิเสธ |
| 2 | ingest idempotency | G5/G8 evidence (duplicate event → ไม่ generate ซ้ำ, reuse) · publish side = audit PK (ข้อ 12) | ✅ |
| 3 | AI timeout | `g9NonMetaProbe` = `fetchWithTimeout` → `status:'timeout'` → **ไม่** markFailed (21/21) | ✅ |
| 4 | AI/provider failure | `g9NonMetaProbe` fallback guard 1 ครั้ง + `upstream_error` retryable | ✅ |
| 5 | malformed AI output | `g9NonMetaProbe` `AI_EMPTY_CONTENT` → markFailed + ไม่มี write path ปลอม | ✅ |
| 6 | Meta/network outbound failure | `publishWorkerProbe` 5/5 — publish ก่อน Meta call ต้องผ่าน gate ทั้งหมด · `auditFailure` PK ตายตัว (fail replay ไม่ซ้ำแถว) | ✅ |
| 7 | worker crash/retry recovery | `g9NonMetaProbe` `claimEvent` + `claimed_at` + `releaseToRetryable` + attempts+1 | ✅ |
| 8 | duplicate scheduler/execution | G8-S5 (reuse — ห้าม rerun): 28 executions, dup=0, legacy=0, **dual-path=0** | ✅ |
| 9 | unauthorized tenant/brand | `publishWorkerProbe` anon → 401 · `g9NonMetaProbe` RLS deny probes · G7 security evidence | ✅ |
| 10 | stale event/action | `g9NonMetaProbe` `orders_stale_pending` = notification-only, ไม่ mutate business table | ✅ |
| 11 | already-completed action | **จริง**: journey replay 2/2 → `already=true`, post_id เดิม, 0 duplicate · G8-S5 idempotent claim (reuse) | ✅ |
| 12 | persistence / replay safety | audit PK `g9-publish-<id>` = 2 แถว/2 โพสต์ ตรง 1:1 · evidence JSON · G8-S5 dup=0 | ✅ |

## SECURITY / AUTHORIZATION RESULT

- ผู้ไม่มีสิทธิ์ (anon/automation-token ผิด) → **401 ทุกครั้ง** (`publishWorkerProbe` #1)
- publish ได้เฉพาะ approval `status='approved'` — PENDING → **409**, ไม่มี approval → **404**, body ผิด → **400** (ไม่มี path สร้างโพสต์เอง)
- Secrets (Meta token / service key / VAPID) **ไม่เคยถูก echo** ใน response/log (worker + probes ตรวจ)
- RLS/tenant deny = probes ของ G7/G9 (reuse) — ไม่มี unauthorized leak

## REPLAY / IDEMPOTENCY RESULT

- `G9_JOURNEY_RESULT: 6 pass / 0 fail` — replay 2/2 `already=true`, **0 duplicate post**, audit 1:1
- G8-S5 (reuse): dup=0 · legacy=0 · dual-path=0
- **0 unexpected mutations** — แถวที่สร้างมีแค่ 2 approval + 2 audit ตามที่ออกแบบ

## LOGIC CHANGED / DB / MIGRATION / SECURITY FLAGS

```text
LOGIC CHANGED       = NO (แก้ business/automation logic เดิม 0 จุด — G7/G8 ไม่ถูกแตะ)
NEW CAPABILITY      = YES (social-publish-worker EF — Owner อนุมัติ 2026-10-05 "ทำให้จบรวม meta เลย" + 2026-10-06 สั่งรัน journey)
DB CHANGED          = NO (schema เดิม — แค่ insert data: 2 approval + 2 audit rows)
MIGRATION           = NO
SECURITY CHANGED    = NO
PRODUCTION MUTATION = YES (EF `social-publish-worker` deploy · EF secrets META_PAGE_ACCESS_TOKEN/META_PAGE_ID ใหม่ · โพสต์จริง 2 โพสต์บนเพจ)
```

## TESTS / TYPECHECK / LINT RESULTS (ณ commit ปิด G9)

- **TSC = 0 errors** · **LINT = 0** · **VITEST = 522/522** · **BUILD = 0**
- Probes: `g9NonMetaProbe` **21/21** · `publishWorkerProbe` **5/5** · `g9PublishJourney` **6/6**

## HEAD == origin/main / WORKTREE

```text
HEAD == origin/main (ยืนยันหลัง push รอบปิด G9)
WORKTREE = CLEAN
```

## OWNER DECISIONS ระหว่างทาง

1. **D-03** — G9 ส่วนไม่ต้องใช้ Meta ทำก่อน (2026-10-05)
2. **Meta write path** — Owner อนุมัติ scope ใหม่ (2026-10-05: *"ทำให้จบรวม meta เลย"*) → `social-publish-worker`
3. **แอป Meta ใหม่** `1737887467512190` — Owner สร้าง/คีย์เอง, ล้างคีย์เก่าเอง (2026-10-06)
4. **สั่งรัน deploy worker + G9 journey** (2026-10-06) — publish จริง 2 โพสต์
5. **G9 decision = อนุมัติทำครบตามกฏ ทดสอบผ่านทั้งหมด** (2026-10-06) → PASS ตาม §10.7

## ค้างจาก Owner (ไม่ขวาง G9)

- โพสต์ทดสอบบนเพจ 3 รายการ (1 `[acceptance-test]` + 2 `[G9 Acceptance]`) — สั่งลบเมื่อตรวจเสร็จ
- G4 REAL EVENT inbound (Meta verification) — ด่านถัดไปตาม spine
- SMS provider/credentials · Stripe live webhook endpoint · real-device push test
