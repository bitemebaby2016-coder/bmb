# BMB — G9 NON-META VERIFICATION REPORT (D-03) · 2026-10-05

**สถานะเอกสาร:** รายงานเพื่อ**ยื่น Owner review** — **ไม่ใช่การประกาศ G9 PASS** (contract §10.7: *Owner อนุมัติ report ก่อนปิด G9 — AI ห้ามประกาศเอง*)
**HEAD:** `816994b` · worktree CLEAN · gates: TSC0 / LINT0 / VITEST **517/517** / BUILD0
**Scope:** G9 ส่วนที่**ไม่ต้องใช้ Meta real event** ตามมติ D-03 · reuse G5/G6/G7/G8 · **ไม่ rerun G8-S5** · **ไม่แตะ Meta** · **ไม่สร้าง event จริง**

---

## 1. สิ่งที่ทำในรอบนี้

1. **Probe ใหม่ `e2e/g9NonMetaProbe.cjs`** — ตรวจซ้ำได้เสมอ (read-only, ไม่ insert, ไม่แตะ Meta) = **21/21 PASS**
2. ตรวจ code-shape จริงของ `social-ai-worker` + `_shared/aiTimeout.ts` + `_shared/aiPolicy.ts` + `automation-worker` และตรวจ live production rows

## 2. ผลตรวจ 5 รายการ (evidence ที่ compile ไว้ใน §7.2 — ยืนยันซ้ำด้วย probe)

| # | รายการ | ผลตรวจ probe |
|---|---|---|
| **#3** | AI timeout | `fetchWithTimeout` + `TimeoutError` → `status:'timeout'` → **ไม่** ถูกส่งเข้า `markFailed` · helper อยู่ใน `_shared` (single source) |
| **#4** | AI/provider failure | `policy.fallback` + guard `!== modelUsed` + `upstream_error` (retryable) · fallback มาจาก `MODEL_A_FALLBACK` ตัวเดียว |
| **#5** | malformed AI output | `AI_EMPTY_CONTENT` → `markFailed` · **worker ไม่มี Meta write path เลย** (negative assertion ผ่าน) |
| **#7** | worker crash/retry | `claimEvent` + `claimed_at` + `releaseToRetryable` + attempts+1 ครบ |
| **#10** | stale action | `orders_stale_pending` = notification-only · **ไม่ mutate** orders/products/delivery |

## 3. ผลตรวจ live production (read-only)

| ตรวจ | ผล |
|---|---|
| `social_events` reachable | HTTP 200 |
| FAILED / RETRYABLE / PROCESSING | **0 / 0 / 0** (ไม่มี event ค้าง) |
| FAILED event ที่มี outbound state (`reply_status`/`action_type`/`ai_reply_text`) | **0 violations** (G6 boundary ยังไม่มีใครละเมิด) |
| PROCESSING ที่ค้างไม่มี `claimed_at` | **0** |

> ⚠️ ตัวเลข 0/0/0 หมายถึง **ไม่มี event จริงเลย** (REAL EVENT = BLOCKED รอ G4/Meta) — นี่คือเหตุที่ G9 ยังปิดไม่ได้เต็ม ตาม contract

## 4. สิ่งที่ยังเปิดค้าง (ต้อง Owner ตัดสิน/ให้ข้อมูล)

| ข้อ | สิ่งที่รอ |
|---|---|
| **§9 [PROPOSED]** | จำนวน journey runs ขั้นต่ำ · ครอบคลุม per-channel หรือไม่ · ระยะเวลาเก็บ evidence — **รอ Owner กำหนด** |
| **§10.1** | E2E journey ครบทุก stage ยังขาด REAL EVENT + INGEST จริง (= Meta, รอ G4) |
| **§10.2** | Failure matrix จริงบน production ยังขาด #2-real (redelivery) + #6 (Meta outbound) — ทั้งคู่รอ Meta |
| **Meta 3 ค่า** | set เป็น EF secrets แล้ว (`META_APP_ID/SECRET/PAGE_ACCESS_TOKEN`) — **โค้ด Meta write path ยังไม่มี** (ขัดกฎ "ห้ามสร้าง phase/contract ใหม่") → **ขอ Owner อนุมัติ scope การ implement ก่อน** |

## 5. สรุปที่ยื่น Owner

**G9 Non-Meta ส่วนที่ทำได้โดยไม่ต้องมี Meta = ผ่านครบ** (evidence #3/#4/#5/#7/#10 ยืนยันซ้ำด้วย probe 21/21 + live state สะอาด) — **แต่ยังไม่ปิด G9** เพราะ:

1. REAL EVENT + INGEST จริง = รอ G4/Meta (external)
2. Failure matrix #2-real/#6 = รอ Meta (external)
3. Meta write path ยังไม่มีในโค้ด — การสร้างใหม่ต้องได้รับอนุมัติ scope จาก Owner ก่อน (ขัดกฎเดิม "ห้ามสร้าง phase/contract ใหม่")

**คำถามถึง Owner (3 ข้อ):**
1. อนุมัติให้ implement **Meta write path** ใหม่หรือไม่ (ผูกกับ credentials ที่ set ไว้แล้ว) — ถ้าอนุมัติ จะทำเป็น feature ใหม่ที่ผ่าน gates เต็มรูปแบบ
2. กำหนดจำนวน journey runs ขั้นต่ำ + ระยะเวลาเก็บ evidence (§9 PROPOSED)
3. ยืนยันว่า G9 Non-Meta ส่วนนี้ **ผ่านในมุมมอง Owner** หรือยัง — เพื่อบันทึกลง §14/§15 ก่อนไปต่อ (Meta/G4 → SMS → ระบบแอดมิน)

---

**HARD STOP:** เอกสารนี้ = รายงานรอ Owner review — **ไม่ใช่การประกาศ G9 PASS** · ไม่มีการแก้โค้ดใด ๆ ในรอบนี้ (probe อย่างเดียว)