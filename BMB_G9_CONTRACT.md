# BMB G9 — SOCIAL AI PRODUCTION E2E (CANONICAL CONTRACT)

**สถานะเอกสาร:** CONTRACT DRAFT — รอ Owner review (HARD STOP ก่อน implementation)
**สร้างจาก:** G9 PLAN RECOVERY ตามคำสั่ง Owner ("Create Canonical G9 Contract From Existing Locked Execution Plan")
**ข้อห้ามเหนือเอกสารนี้:** ห้ามประกาศ G9 PASS, ห้ามเริ่ม implementation ก่อน Owner review ผ่าน

---

## 0. SOURCE DISCIPLINE

แยกแหล่งที่มาชัดเจน 3 ประเภท ทุกหัวข้อ:

- **[LOCKED]** — กำหนดไว้แล้วใน BMB execution spine / prior Owner planning context (Owner ยืนยันในคำสั่ง plan recovery)
- **[FACT]** — ตรวจพบจาก production/code จริง ณ HEAD (อ้างไฟล์/identifier ตาม code)
- **[PROPOSED]** — ยังไม่มีหลักฐาน ต้องรอ Owner อนุมัติก่อนกลายเป็น requirement

**ห้ามยกระดับ [PROPOSED] → requirement โดยไม่มีหลักฐาน/การอนุมัติของ Owner**

---

## 1. G9 OBJECTIVE [LOCKED]

G9 = **Social AI Production E2E**

พิสูจน์ integrated production journey ตั้งแต่ event จริงจนถึง action/result และ failure recovery บน production แบบ end-to-end ไม่ใช่รายส่วน (G3/G5/G6/G7/G8 ปิดรายส่วนแล้ว)

---

## 2. G9 POSITION IN EXECUTION SPINE [LOCKED]

```text
G1 → G2 Asset/Brand Control → G2-RV → G3 Social Events → G4 Meta Security
→ G5 AI Routing → G6 Auto-reply → G7 Auto-post → G8 Retry/Failure
→ G9 Social AI E2E        ← G9 อยู่ตรงนี้
→ G10 TRUE PRODUCTION CLOSURE

---

## 3. G9 SCOPE [LOCKED]

พิสูจน์ production journey แบบ integrated:

```text
REAL EVENT → INGEST → CLASSIFY → ROUTE → GENERATE → AUTHORIZE
→ ACTION → RESULT → PERSISTENCE → REPLAY SAFETY → FAILURE RECOVERY
```

ห้ามตัด failure/safety coverage ตาม Section 4 ออกเอง

---

## 4. G9 FAILURE MATRIX [LOCKED intent — canonical identifiers ตาม code จริง]

Coverage ขั้นต่ำ 12 ข้อจาก plan เดิม ([FACT] = ตรวจจาก repo ณ HEAD; ชื่อกลไกอาจต่างจาก wording เดิม แต่ business intent คงเดิม — ห้ามตัดรายการ):

| # | Plan เดิม (intent) | Canonical identifier [FACT] | สิ่งที่ G9 ต้องยืนยัน |
|---|---|---|---|
| 1 | invalid event/webhook | `channel-webhook` validation/signature check | invalid webhook ถูกปฏิเสธ ไม่เข้า pipeline |
| 2 | duplicate event/webhook | idempotency ที่ ingest layer | duplicate event ไม่ generate ซ้ำ |
| 3 | AI timeout | `ai-proxy` timeout behavior (G5 audit §6) | timeout ไม่ค้าง pipeline, terminal state ชัดเจน |
| 4 | AI/provider failure | `ai-proxy` provider error handling | fail → error state + retry policy ตาม G8 |

---

## 5. G9 E2E JOURNEY (stage → code จริง)

| Stage [LOCKED] | Code จริง [FACT] | หมายเหตุ |
|---|---|---|
| REAL EVENT | Meta/social event บน production | ระดับ event จริง (ไม่ใช่ synthetic เท่านั้น) |
| INGEST | `supabase/functions/channel-webhook` | webhook intake (Meta-adjacent — ดู HARD-STOP §11) |
| CLASSIFY | classification ใน social-ai-worker / G5 routing | ตาม G5 ที่ปิดแล้ว |
| ROUTE | G5 AI Routing (`ai-proxy` provider selection) | ตาม G5 ที่ปิดแล้ว |
| GENERATE | `social-ai-worker` (AI generate) | ตาม G5/G6 |
| AUTHORIZE | tenant/brand authorization ก่อน action | ห้ามลดขอบเขต |
| ACTION | `social-post-worker` ผ่าน `automation_queue` + `queue-dispatcher` | G8 architecture — ห้ามแก้ |
| RESULT | terminal state บน `automation_queue` (`succeeded`/`failed`) | ตาม pattern G8-S5 |
| PERSISTENCE | audit trace + ตาราง content/result | ตรวจ read-only — ห้ามสร้าง migration ถ้าไม่จำเป็นตาม contract |
| REPLAY SAFETY | idempotency ตรวจซ้ำจาก persistence | FAILURE MATRIX #11–12 |
| FAILURE RECOVERY | retry/recover ผ่าน G8 queue mechanism | ห้ามสร้างกลไกใหม่ |

---

## 6. G9 SECURITY BOUNDARY [FACT + LOCKED]

- [FACT] automation ใช้ `AUTOMATION_TOKEN` — **ห้ามเปลี่ยน token** (กฎ Owner)
- [FACT] RLS และ service_role boundaries ถูกยืนยันใน G3/G5/G7 — G9 ตรวจซ้ำ read-only ไม่แก้
- [LOCKED] ห้ามเปิด Stripe production ใน G9

---

## 8. G9 REPLAY / IDEMPOTENCY REQUIREMENTS [LOCKED]

- ทุก stage ต้อง replay-safe: รันซ้ำ (duplicate event, duplicate scheduler, worker retry) ต้องไม่ก่อ side effect ซ้ำ
- ยืนยันด้วยหลักฐานแบบเดียวกับ G8-S5: enqueue → queue → claim → dispatcher → worker → terminal state → audit trace, legacy=0, dual-path=0, รายการซ้ำ=0
- [PROPOSED] รูปแบบการสาธิต replay (จำนวน replay case, synthetic vs real) — **รอ Owner กำหนดใน review**

---

## 9. G9 PRODUCTION EVIDENCE REQUIREMENTS

- [LOCKED] evidence ต้องเป็น production runtime evidence แบบเดียวกับ G8-S5 (full chain trace ผ่าน read-only probe)
- [PROPOSED — รอ Owner] จำนวน journey runs ขั้นต่ำ, สัดส่วน per-channel (comment/message/post), ระยะเวลาเก็บ evidence
- [LOCKED] evidence ครอบคลุม FAILURE MATRIX 12/12; บางข้ออาจ probe-only โดยห้าม trigger จริงบน production ถ้ามีความเสี่ยง — ระบุต่อข้อตอน S-stage design แล้ว Owner อนุมัติ

---

## 10. G9 EXIT / PASS CRITERIA


---

## 11. G9 HARD-STOP CONDITIONS [LOCKED]

ต้องหยุดและรายงาน Owner ทันที ห้ามดำเนินการต่อเอง เมื่อ:

- ต้องแตะ G8 scheduler/queue/retry architecture หรือ `AUTOMATION_TOKEN`
- ต้องสร้าง migration (ทำได้เฉพาะเมื่อ Owner อนุมัติว่าจำเป็นตาม G9 contract)
- ต้องทำ Meta production write / เปิด Meta credentials
- พบ migration drift 104–111 ต้องถูกแตะ — **ห้ามซ่อมเอง**
- พบข้อความ/ข้อมูลที่ไม่แน่ใจว่าควรแก้ (language cleanup rule)
- พบ conflict ระหว่าง plan เดิมกับ code จริง
- เข้าขอบเขต G4 (Real Meta Verification) โดยไม่ตั้งใจ — G4 = หลัง G9

---

## 12. G9 OUT OF SCOPE [LOCKED]

- ห้ามย้อน/แก้ G7, G8 (รวม scheduler, queue, retry, cron, AUTOMATION_TOKEN)
- ห้ามแก้ migration drift 104–111
- ห้ามเปิด Stripe production

---

## 13. G9 REQUIRED FINAL REPORT [LOCKED skeleton]

สิ้นสุด G9 ต้องมี `BMB_G9_FINAL_REPORT.md` ที่ระบุ:

```text
G9 RESULT (PASS/FAIL — โดย Owner อนุมัติ)
E2E JOURNEY EVIDENCE (ต่อ stage)
FAILURE MATRIX EVIDENCE (12/12)
SECURITY / AUTHORIZATION RESULT
REPLAY / IDEMPOTENCY RESULT
LOGIC CHANGED = YES/NO
DB CHANGED = YES/NO
MIGRATION = YES/NO
SECURITY CHANGED = YES/NO
PRODUCTION MUTATION = YES/NO
TESTS / TYPECHECK / LINT RESULTS
HEAD == origin/main
WORKTREE = CLEAN
OWNER DECISIONS ระหว่างทาง
```

---

## 14. CURRENT STAGE / NEXT STAGE

```text
G9 CURRENT STAGE = CONTRACT DRAFT (เอกสารนี้) — รอ Owner review
G9 NEXT STAGE    = หลัง Owner อนุมัติ/แก้ contract → S-stage breakdown (รอ Owner กำหนด ห้ามออกแบบเอง)
G9 IMPLEMENTATION = NOT STARTED
PRODUCTION MUTATION = NO
MIGRATION = NO
```

**HARD STOP — รอ Owner review ของ `BMB_G9_CONTRACT.md`**

- ห้ามทำ Physical Delivery
- ห้ามประกาศ G10 / ทำ G10 closure
- ห้ามทำ Real Meta Verification (เป็น G4 — หลัง G9)
- ห้ามแก้ business rules
- ห้ามสร้าง G9 architecture ใหม่ / contract ใหม่แทน contract นี้
- ห้ามเปลี่ยน DB schema / API contract / security / automation architecture
- ห้ามเอา language cleanup มาขยาย scope G9 (แยก workstream; สถานะ: CODE FIXED = YES, PRODUCTION REDEPLOY = NO — ห้าม redeploy เอง)

PASS เมื่อครบทั้งหมด:

1. E2E journey ครบทุก stage (Section 3) มี production evidence
2. FAILURE MATRIX ครบ 12/12 มีหลักฐาน
3. SECURITY / AUTHORIZATION boundary ยืนยันผ่าน (ไม่มี unauthorized รั่ว)
4. REPLAY / IDEMPOTENCY ยืนยันผ่าน (0 duplicates, 0 unexpected mutations)
5. Tests/typecheck/lint ผ่านทั้งหมด ณ commit ปิด G9
6. `BMB_G9_FINAL_REPORT.md` คอมมิตแล้ว + HEAD == origin/main + WORKTREE CLEAN
7. **Owner อนุมัติ report ก่อนปิด G9** — AI DEV ห้ามประกาศ PASS เอง

[PROPOSED] เกณฑ์ตัวเลข (จำนวน runs ขั้นต่ำ ฯลฯ) รอ Owner กำหนด — อ้างแบบ G8-S5 (≥2/งาน, ≥6 รวม) เป็น base ได้ **เมื่อ Owner อนุมัติ**

- [LOCKED] Meta/Facebook ไม่ใช่ dependency ของ scheduled chain (ยืนยันใน G8-S5) — ไม่เปิด Meta credentials ใหม่เอง

---

## 7. G9 AUTHORIZATION BOUNDARY [LOCKED]

- ทุก event ผ่าน tenant authorization และ brand authorization ก่อน AUTHORIZE stage
- AI output **ไม่มี** authority เอง — ต้องผ่าน authorization layer (ตาม G5 audit §8) ก่อน ACTION
- unauthorized tenant/brand = ปฏิเสธ + audit trace (FAILURE MATRIX #9)

| 5 | malformed AI output | social-ai-worker output validation | malformed output ไม่กลายเป็น action |
| 6 | Meta/network/outbound failure | `social-post-worker` outbound failure | outbound fail → retry/dead-end ชัดเจน |
| 7 | worker crash / retry recovery | `automation-worker` + `automation_queue` retry (G8) | crash → recover ได้ ไม่ duplicate |
| 8 | duplicate scheduler/execution | `queue-enqueue`/`queue-dispatcher` dedupe; dual-path=0 (G8-S5) | ไม่มี execution ซ้ำจาก scheduler 2 ทาง |
| 9 | unauthorized tenant / brand | tenant/brand authorization (RLS + worker checks) | unauthorized ถูกปฏิเสธทั้งหมด |
| 10 | stale event/action | stale detection (เช่น orders_stale_pending) | stale action ไม่ถูก execute |
| 11 | already-completed action | idempotent claim/complete ของ `automation_queue` | ทำซ้ำไม่ก่อ side effect ครั้งที่สอง |
| 12 | persistence / replay safety | audit trace + terminal `succeeded` (พิสูจน์ใน G8-S5) | replay ไม่ก่อ mutation ซ้ำ |

**ห้ามแก้ G8 scheduler/queue/retry architecture ระหว่าง G9** — G9 ใช้และยืนยันสิ่งที่ G8 ปิดไปแล้วเท่านั้น

```

Dependency ที่ถือตาม spine:

```text
G7 = COMPLETE
G8 = PASS
G9 = NEXT
G4 = หลัง G9 (Real Meta Verification)
G10 = หลัง G4
```

- ห้ามย้อน G7 / G8
- ห้ามข้ามไป G10
- ห้ามทำ G4 แทน G9
- ห้ามทำ production Meta write หาก G9 contract ไม่อนุญาต
