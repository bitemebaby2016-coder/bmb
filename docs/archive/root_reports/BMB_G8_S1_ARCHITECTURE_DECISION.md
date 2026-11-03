# BMB G8-S1 — ARCHITECTURE DECISION PACKAGE (PREPARATION ONLY)

- Date: 2026-10-03 · Baseline: G8-S0 PASS @ `f1b0964` · HEAD == origin/main, WORKTREE CLEAN
- Evidence base: BMB_G8_S0_AUTOMATION_AUDIT.md (production DB probe + scheduler + worker inventory)
- สถานะ: ไม่มี implementation / migration / deploy / scheduler registration / production mutation
- Owner Choice ทุกข้อ = UNDECIDED — ห้ามถือว่า option ใด "ดีที่สุด" (ไม่มี ranking)

## G8-S1-A — ARCHITECTURE COMPARISON (ทุก option × ทุกมิติ)

สัญลักษณ์: A = GH Actions + DB queue ใหม่ · B = GH Actions + existing tables (ไม่เพิ่ม queue) · C = DB queue + dedicated dispatcher EF · D = Hybrid (B ตอนนี้ → A/C ภายหลัง)

| มิติ | OPTION A | OPTION B | OPTION C | OPTION D |
|---|---|---|---|---|
| architecture | GH cron → dispatcher step ใน workflow → claim จาก DB queue → invoke worker | GH cron ยิง worker ตรงแบบเดิม + in-workflow retry/backoff + audit-trace idempotency | GH cron (tick เท่านั้น) → dispatcher EF → claim → invoke worker ทุกประเภท | phase 1 = B; phase 2 = A หรือ C เมื่อ Owner สั่ง |
| components | workflow แก้, 1 migration (queue+RPC), worker ไม่แก้ logic | workflow แก้, ไม่มี migration | workflow ย่อ, 1 migration, dispatcher EF ใหม่, worker ไม่แก้ logic | phase1 = B ทั้งหมด; phase2 = เพิ่มชุด A/C |
| DB changes | + queue table (claimed/lease/attempts/next_retry_at/dead status) + claim/complete/fail RPC + RLS service_role | ไม่มี | เหมือน A + worker registry table (ถ้าต้องการ uniform registration) | phase1 ไม่มี; phase2 ตามที่เลือก |
| scheduler changes | เพิ่ม step claim-before-invoke ต่อ job เดิม | เพิ่ม retry loop/backoff ใน step | ลดเหลือ tick เดียว → dispatcher | phase1 แก้ retry; phase2 ย้ายทั้งชุด |
| worker changes | ไม่จำเป็น (idempotency เดิมใช้ได้) | ไม่มี | ไม่จำเป็น (dispatcher ครอบ) | ไม่มีใน phase1 |
| migration requirement | YES (non-destructive, table ใหม่ล้วน) | NO | YES (non-destructive) | phase1: NO · phase2: YES |
| deployment requirement | deploy workflow + RPC (ไม่ deploy EF ใหม่) | deploy workflow เท่านั้น | deploy dispatcher EF + workflow | phase1 เฉพาะ workflow; phase2 ตามชุดที่เลือก |
| rollback path | drop queue table + revert workflow (legacy path ไม่ถูกลบระหว่าง phase transition) | revert workflow (ง่ายสุด) | revert workflow → legacy cron เดิม; drop queue | phase1 rollback = B rollback; phase2 rollback = กลับ phase1 |
| failure recovery | lease expiry + stale claim re-queue + DLQ | cron รอบหน้าเท่านั้น (crash กลาง run = สูญ state) | ครบเหมือน A (lease อยู่ใน dispatcher) | phase1 จำกัด; phase2 ครบ |
| concurrency behavior | atomic claim (FOR UPDATE SKIP LOCKED pattern) — ปลอดภัยต่อ multi-source | GH concurrency group เท่านั้น — manual invoke ระหว่าง cron ยังไม่ atomic | atomic claim ใน dispatcher — ปลอดภัยสูงสุด | phase1 ไม่ atomic; phase2 atomic |
| idempotency behavior | trace dedupe เดิม + claim ชั้นนอก (AI call ไม่ซ้ำ) | trace dedupe เดิม (AI อาจถูกเรียกซ้ำถ้า crash หลัง AI ก่อน trace) | เหมือน A | ตาม phase |
| retry behavior | next_retry_at + backoff + jitter + max_attempts ใน DB (cross-run จริง) | in-workflow ครั้งเดียวต่อ run (cross-run = cron รอบหน้า) | ครบเหมือน A | phase1 จำกัด; phase2 ครบ |
| operational complexity | กลาง (queue ดูแล + workflow) | ต่ำสุด | สูง (EF + queue + registry) | ต่ำตอนแรก สูงภายหลัง (โยก 2 ครั้ง) |
| observability | queue rows + trace + Actions history | Actions history + trace (เดิม) | เหมือน A + จุดรวมเดียว | phase1 เดิม; phase2 ครบ |
| legacy 3 jobs compatibility | ย้ายเข้า queue ได้ (event_id เดิมใช้ต่อ) — ต้องกัน run คู่ช่วง cutover | ไม่ถูกแตะเลย | ย้ายได้เหมือน A — dispatcher ครอบแทน | phase1 = ไม่แตะ; phase2 ย้าย |
| G6 compatibility | พร้อมหลัง G8-D04 dedupe (claim กัน AI ซ้ำ) | ยังไม่ safe (ไม่มี claim) | พร้อมหลัง D04 เหมือน A | phase1 ยังไม่ safe |
| G7 compatibility | พร้อม (ref-idempotency + claim) | ใกล้เคียง (ref กัน duplicate row แต่ AI call ซ้ำได้) | พร้อม | ตาม phase |
| security boundary | queue = service_role only; ไม่แตะ business authority | ไม่เปลี่ยนอะไร | เหมือน A + dispatcher ต้อง verify x-automation-token ภายใน | ตาม phase |
| blast radius | workflow + DB ใหม่ (revert ง่าย, legacy schema ไม่แตะ) | workflow เท่านั้น (เล็กสุด) | EF ใหม่ + queue + workflow (กว้างสุด) | แบ่งเล็กตาม phase |

## G8-S1-B — TRANSITION PLAN (CURRENT → INTERMEDIATE → TARGET)

**OPTION A**
```
CURRENT (GH cron ยิง automation-worker ตรง)
  ↓ INTERMEDIATE: deploy queue+RPC (ยังไม่ใช้) → deploy workflow ใหม่ที่ claim ก่อน invoke
  ↓ TARGET: ทุก job ผ่าน queue; DLQ/retry ใน DB
legacy ระหว่าง migration: ยังรันจาก workflow เดิมจนกว่า cutover
duplicate execution: ไม่เกิด ถ้า cutover = สลับ workflow ครั้งเดียว (old step ลบพร้อมเพิ่ม new step ใน commit เดียว)
cutover point: merge workflow ใหม่ (run ถัดไปใช้ queue ทันที)
rollback point: revert workflow commit → กลับยิงตรง (queue table คงอยู่ได้ ไม่กระทบ)
data compatibility: event_id/trace format เดิมใช้ต่อ; queue เป็น state ใหม่ล้วน
scheduler compatibility: cron cadence เดิมคงอยู่
```

**OPTION B**
```
CURRENT → INTERMEDIATE/TARGET อันเดียว (ไม่มี schema change)
legacy: ไม่แตะ — เพิ่ม retry/backoff รอบ invoke เดิม
duplicate: ไม่เกิด (pattern เดิม + idempotency เดิม)
cutover: merge workflow ใหม่ · rollback: revert workflow
data/scheduler compatibility: 100% เดิม
```

**OPTION C**
```
CURRENT → INTERMEDIATE: deploy dispatcher EF + queue (dispatcher รับ tick แต่ยังไม่มี job) → ย้าย job ทีละตัว (flag ใน dispatcher) → TARGET: workflow เหลือ tick เดียว
legacy ระหว่าง migration: ตัวที่ย้ายแล้วปิด step ใน workflow พร้อมกันกับเปิดใน dispatcher (per-job cutover)
duplicate: ป้องกันได้เพราะ cutover ต่อ job — ถ้าเปิดสองทางพร้อมกันโดยไม่มี claim จะเกิด duplicate (ห้ามทำ)
cutover: per-job flag · rollback: ปิด flag → step เดิมกลับมาทำงาน
data compatibility: เหมือน A · scheduler compatibility: cron เดิมแต่ย่อบทบาท
```

**OPTION D**
```
CURRENT → phase1 (B transition) → phase2 (A หรือ C transition — เลือกซ้ำเมื่อถึงคราว)
legacy: phase1 ไม่แตะ · duplicate: ไม่เกิดทั้งสอง phase ถ้าทำตามลำดับข้างบน
cutover: สองจุด (phase1 merge, phase2 cutover ตาม A/C) · rollback: กลับ phase ก่อนหน้า
data compatibility: phase1 ไม่แตะ DB; phase2 ตามที่เลือก
```

## G8-S1-C — LEGACY 3 JOB ANALYSIS (ไม่เปลี่ยน implementation)

| มิติ | 1. notification_dispatch | 2. orders_stale_pending | 3. inventory_low_stock |
|---|---|---|---|
| current trigger | cron */5 + dispatch(all/dispatch/stale) | cron */5 + dispatch(all/dispatch/stale) | cron hourly 7 * * * * + dispatch(stock) |
| current auth | verify_jwt=true + x-automation-token | เดียวกัน | เดียวกัน |
| current idempotency | durable: audit `auto-exec-<event_id>` + notification deterministic id (สองชั้น) | durable: trace + notification dedupe | durable: trace + notification dedupe |
| current failure handling | errors[] → partial/failed → trace; GH step fail visible | เดียวกัน | เดียวกัน |
| current retry | ไม่มี (cron รอบหน้า = implicit retry) | ไม่มี | ไม่มี (ทุกชั่วโมง) |
| business authority | ไม่มี — อ่าน canonical feeds เขียน notifications เท่านั้น | ไม่มี — notification เท่านั้น (ไม่เปลี่ยน order state) | ไม่มี — alert เท่านั้น (ไม่แก้ stock) |
| suitability for queue migration | สูง (stateless scan + dedupe durable ทำให้ re-run safe) | สูง (เหมือนกัน) | สูง (เหมือนกัน; ความถี่ต่ำกว่า) |
| risk during transition | ต่ำ — ถ้า cutover ปลอดภัยตาม §B; ซ้ำซ้อนถูก dedupe อยู่แล้ว | ต่ำ | ต่ำ (ความถี่ต่ำ → หน้าต่างชนน้อย) |

## G8-S1-D — G6 / G7 READINESS (exact behavior, ห้ามแก้ code)

**G6 social-ai-worker (สถานะจริงจาก source + G6/S4 evidence):**
- วันนี้: verify_jwt=false + x-automation-token · AI call มี timeout + fallback 1 ครั้ง · logging event_id/task/model/status เท่านั้น (console log — ไม่มี DB durable state)
- duplicate execution: **ไม่ป้องกัน** — event_id เป็น log field ไม่ใช่ dedupe key; scheduler ยิงซ้ำ = AI call ซ้ำเต็ม ๆ
- concurrent execution: **ไม่ป้องกัน** — สอง request พร้อมกัน = AI call คู่
- crash after claim: ไม่มี state ให้ recover (stateless) · stale claim: ไม่มี concept นี้
- retry: caller จัดการ — ปลอดภัยเพราะไม่มี side effect ฝั่ง DB
- **ต้องเพิ่มก่อน scheduler → claim → social-ai-worker ปลอดภัย:** (1) durable dedupe/claim ฝั่ง queue (dispatcher) หรือใน worker (แก้ code), (2) stale-lease recovery ครอบ crash-after-claim, (3) max attempts ต่อ job กัน cost รั่ว → ถ้าห้ามแก้ worker ทั้งหมดต้องมาจาก claim layer (ผูกกับ G8-D04)

**G7 social-post-worker (สถานะจริงจาก S4-R2):**
- วันนี้: verify_jwt=true + x-automation-token · deterministic ref → duplicate no-op (S4-R2-G) · fail-closed · audit g7.draft 1 แถว/ref · precheck idempotency ก่อน AI call (พิสูจน์ใน F-series: attempt 2 ไม่เรียก AI)
- duplicate AI generation (sequential): ป้องกันแล้วโดย precheck
- concurrent AI generation: **ยังเปิด** — สอง request ref เดิมพร้อมกัน: ทั้งคู่ผ่าน precheck ก่อนฝั่งใด INSERT → AI call คู่ → INSERT ตัวหลังชน constraint หรือ row ซ้ำ
- duplicate content_approvals / audit trace: ผูกกับ concurrent case ข้างบน (ต้องยืนยัน constraint ของ deterministic id ตอน S2 ถ้า implement)
- **ต้องเพิ่ม:** claim/exclusion ระดับ queue กัน concurrent — แนะนำทาง dispatcher เพื่อไม่แก้ worker; crash-after-claim/stale claim มาจาก lease ของ queue

**สรุป readiness:** G7 = พร้อมเมื่อมี claim layer (ไม่ต้องแก้ worker) · G6 = ต้องมี claim layer + ตัดสินใจ durable dedupe (G8-D04) ก่อน register เสมอ

## G8-S1-E — RETRY POLICY PROPOSAL (ยังไม่ implement)

RETRYABLE (transient):
| ประเภท | max_attempts | backoff | jitter | timeout | terminal condition |
|---|---|---|---|---|---|
| network transient (fetch fail/502/503/504) | 3 | exponential base 60s (60→120→240) | ±20% | 30s ต่อ worker HTTP call | ครบ 3 → dead-letter |
| AI provider 5xx / 429 | 3 (รวม in-request fallback) | base 120s | ±20% | aiTimeout เดิมต่อ call | ครบ → dead-letter |
| AI provider timeout | 2 | base 120s | ±20% | aiTimeout เดิม | ครบ → dead-letter |
| DB transient (503/เน็ตตอน persist) | 3 | base 30s | ±20% | REST timeout เดิม | ครบ → dead-letter (idempotency ทำให้ retry ปลอดภัย) |
| worker timeout (GH/Deno) | 1 ต่อรอบ cron | n/a (รอบถัดไป) | – | 5 นาที (เดิม) + lease ครอบ | lease หมดอายุ → re-queue นับ attempt |

NON-RETRYABLE (terminal ทันที):
| ประเภท | terminal condition |
|---|---|
| invalid auth (401/403) | dead-letter + alert ทันที — retry ไม่มีวันแก้ |
| malformed input (400 contract ผิด) | dead-letter — แก้ caller/contract ก่อน |
| schema violation (PGRST/23514) | dead-letter — ชี้ bug, ห้าม retry ทับ |
| safety rejection (AI_CONTENT_REJECTED / banned) | dead-letter — ห้าม retry ข้าม policy |
| permanent business rejection / job unknown | dead-letter — operator ตัดสิน |
| DB constraint conflict (deterministic id ชน = ทำไปแล้ว) | ไม่ dead-letter — บันทึก duplicate:no-op ตามเดิม |

กติกากลาง: attempt นับต่อ job (ไม่ reset เมื่อเปลี่ยน scheduler run) · ทุก attempt บันทึก trace ตาม pattern audit_logs เดิม · jitter แบบ full jitter ฝั่ง dispatcher

## G8-S1-F — DLQ / TERMINAL MODEL (เสนอ, ยังไม่ implement)

| องค์ประกอบ | ข้อเสนอ |
|---|---|
| terminal status | `dead` (state machine: queued → claimed → running → succeeded / failed(retryable) → dead) — `failed` ยัง retry ได้, `dead` จบถาวร |
| failure reason | enum class ตาม §E (auth / contract / schema / safety / business / exhausted) — บังคับระบุ |
| last error | message จาก attempt สุดท้าย (truncate, ไม่มี secret/PII — ตามแนว audit metadata เดิม) |
| attempt count | นับทุก attempt สะสมต่อ job, ไม่ reset |
| failed_at | timestamp ของ attempt สุดท้าย (แยกจาก created_at) |
| manual replay | operator replay **สร้าง execution ใหม่ด้วย event_id/ref ใหม่** — execution เดิมคง status dead เป็นหลักฐาน (audit ไม่ถูกลบ/แก้) · replay ผ่าน canonical worker เสมอ (automation-worker / social-ai-worker / social-post-worker เดิม) — **ห้าม bypass canonical authority**: DLQ replay ไม่มีสิทธิ์เขียน business state โดยตรง |
| retention | เสนอ 90 วัน (นับจาก failed_at) — รอ G8-D05 |
| operator visibility | (ขึ้นกับ option) dead rows query ผ่าน service_role + สรุปใน Actions summary / audit trace; ถ้าเลือก D05 แบบ in-app จะอ่านผ่าน admin RLS เดิม |

## G8-S1-G — OWNER DECISION TABLE

| Decision | Option | Evidence | Consequence | Owner Choice |
|----------|--------|----------|-------------|--------------|
| G8-D01 Architecture | A: GH Actions + DB queue ใหม่ · B: GH Actions + existing tables · C: DB queue + dispatcher EF · D: Hybrid B→A/C | S0 §3 (ไม่มี queue จริง), §4 (scheduler เดียว), §7 (gap matrix), §A ตารางเปรียบเทียบ 19 มิติ | กำหนด migration/deploy ชุด, concurrency ระดับ, blast radius, ความซับซ้อนการดูแล | UNDECIDED |
| G8-D02 Legacy Job Migration | ย้ายทั้ง 3 เข้า reliability layer / คง GH Actions ตรง / ย้ายทีละตัว (per-job flag เฉพาะ C) | S0 §4 + §C (ทั้งสาม idempotency durable อยู่แล้ว, risk ต่ำ) | กัน duplicate execution ช่วง cutover; กำหนดจุด rollback ต่อ job | UNDECIDED |
| G8-D03 Cadence / Retry Policy | คง */5 + hourly · max_attempts 2–3, backoff 30–120s, jitter ±20% (§E) — ปรับได้ | S0 §4 (best-effort ไม่ใช่ SLA), §8, §E | กำหนด latency การกู้งาน, AI cost จาก retry, ภาระ Actions | UNDECIDED |
| G8-D04 G6 Claim/Dedupe Gate | (a) ห้าม register G6 จนมี claim layer (ไม่แก้ worker) · (b) เพิ่ม durable dedupe ใน worker ก่อน register · (c) register G6 ทันที (ไม่แนะนำ — ไม่มี dedupe) | S0 §5 + S1-D (G6 ไม่มี durable dedupe; concurrent = AI call คู่) | (a) G6 ออนไลน์ช้ากว่าแต่ไม่แก้ worker · (b) ต้อง deploy G6 ใหม่ · (c) เสี่ยง AI cost ซ้ำ | UNDECIDED |
| G8-D05 DLQ / Terminal Retention | retention 30 / 60 / 90 วัน · visibility: Actions summary / audit trace / admin in-app | S0 §3 (ไม่มี terminal state วันนี้), S1-F model | พื้นที่เก็บ, ความสามารถ recovery ย้อนหลัง, ภาระ operator | UNDECIDED |

## S1 CLOSURE

- เอกสารนี้ = decision preparation เท่านั้น — ไม่มี architecture implementation / migration / deploy / scheduler registration / production mutation
- Owner ต้องล็อก G8-D01..D05 ก่อน G8-S2 (design/implement) เริ่มได้



หมายเหตุ: ทั้งสาม idempotency แน่นอยู่แล้ว — ความเสี่ยงหลักของ migration ไม่ใช่ duplicate effect แต่เป็น "เรียกซ้ำโดยไม่จำเป็น" (cost/latency) ไม่ใช่ความเสียหายข้อมูล

