# BMB — G8-S5 HANDOFF — NEXT CHAT

**สร้าง:** 2026-10-04 (~03:40Z) · **สถานะ G8-S5 = HOLD (รอ GitHub scheduled runtime เท่านั้น)**
**Git ณ handoff:** HEAD = origin/main = `d84c2a9` · WORKTREE = CLEAN

## 1. BMB ultimate goal (คงเดิม ห้ามเปลี่ยน)

REAL ORDER → REAL PAYMENT → REAL KITCHEN → REAL DISPATCH → REAL DELIVERY → REAL TRACKING → REAL FAILURE HANDLING — ทั้งหมด canonical authority ฝั่ง server, client เป็น read-model เท่านั้น

## 2. Architecture locked (CLOSED)

- Automation control-plane (G8): GitHub Actions cron (`*/5 * * * *` + `7 * * * *`) → queue-enqueue EF (verify_jwt + `x-automation-token`, job allowlist, payload template server-side, DB idempotency) → automation_queue (identity `sched-<job>-<ref>`, migration 110+111, RPCs service_role-only) → queue-dispatcher EF (claim `FOR UPDATE SKIP LOCKED`, lease 5 นาที, batch 10) → canonical automation-worker โดยไม่แก้โค้ด (eventId = queue id) → complete/fail RPC (OD-1: worker = business authority)
- Legacy direct worker invocation = ถูกลบใน commit `8666026` (single-commit cutover)
- G8-D06 = OPTION A (transport) — CLOSED
- Workflow fix `3310601` = ลบ `needs:` ระดับ step 3 จุด (GitHub parser ต้องการ) — cron/cadence/architecture ไม่แตะ

## 3. Evidence hierarchy

`SCHEDULED RUNTIME (event=schedule จริง)` > `CONTROLLED RUNTIME (E2E transport จริง)` > `synthetic (RPC-driven)` > `source-code inspection` — ห้ามประกาศ PASS จาก single source check; ห้ามนับ push/dispatch/manual/synthetic เป็น scheduled

## 4. Owner operating rules / HARD STOP

- เปลี่ยนใด ๆ ต้อง Owner decision ก่อน · พบ defect → HARD STOP รายงาน ไม่เดา
- ห้ามเริ่ม G6/G7, Open Shop, Stripe live, Meta, physical delivery จาก automation gate
- ห้ามแก้ payload/identity/retry/RLS/authority โดยไม่มี Owner authorization
- Session recovery: verify `HEAD==origin/main`, worktree clean; evidence scripts ผ่าน PowerShell here-string + `node --check`; commit dedupe ด้วย reset --soft + force-with-lease

## 5. Completed G8 gates (CLOSED — ห้ามเปิดซ้ำ)

G8-S0 (audit) · G8-S1 (decision package) · G8-S2 (DB queue, migration 110) · G8-S3 (cutover prep + contracts) · G8-S4 (enqueue idempotency migration 111, OD-6 ai_timeout fix) · G8-T1 (transport audit → D06 Option A) · G8-T2 (queue-enqueue EF deployed, 488/0 tests)

## 6. Owner decisions (CLOSED)

- G8-D01..D05: ตามรายงาน G8-S1/S2/S3 (scope 3 legacy jobs, synthetic_selftest runner, retry classes D03, identity scheme, dispatcher boundary)
- G8-D06: OPTION A — queue-enqueue เป็น secure transport เดียว
- OD-1: dispatcher ไม่ re-interpret business result (worker = authority)
- OD-2: queue idempotency = DB ON CONFLICT (ENQUEUED|DUPLICATE|INVALID)
- OD-3: failure classes — retryable (db_transient/worker_failure) → backoff; non-retryable (business_rejection/auth/malformed) → DEAD; replay = identity ใหม่
- OD-4: legacy jobs ใช้ identity cadence เดิม (`gh-dispatch|gh-stale|gh-stock-<bucket>`)
- OD-5: dispatcher ไม่มี business logic/payload construction
- OD-6: ai_timeout base 120s, eff_max 2

## 7. G8-S5 complete history

- Root cause: `8666026` มี `needs:` ระดับ STEP → GitHub parser reject ไฟล์ → startup_failure (runs 14:46Z/16:56Z/00:41Z, jobs=0) → schedule ถูก ignore ตั้งแต่ 14:09Z
- Fix: `3310601` ลบ step-level `needs:` 3 จุดเท่านั้น — post-fix push (01:45Z, 02:38Z) ไม่มี startup_failure run = parser PASS ยืนยัน
- Controlled runtime evidence (PASS, คงเดิม): enqueue ENQUEUED/DUPLICATE + negatives 401/400 · claim SKIP LOCKED 1/identity · worker succeeded 3/3 (โค้ดไม่แตะ) · re-enqueue DUPLICATE no-op · re-dispatch claimed=0 · retry backoff respected · non-retryable→DEAD · replay→identity ใหม่ · lease-expiry→requeue · secret scan CLEAN · npm test 488/488
- Scheduled runtime evidence: = 0 — last successful event=schedule = `2026-10-03T14:09:18Z` (run 37128641566); หลัง fix ไม่มี schedule event ถูกสร้างเลย (observation windows: 14:52Z→16:55Z, 23:25Z→00:45Z, 03:08Z→03:35Z; legacy invocation = 0 ตลอด; dual-path = 0)
- Final gate: HOLD — ต้องได้ ≥2 scheduled executions/job (≥6 รวม) พร้อม chain เต็มจึง PASS

## 8. Current Git state

HEAD `d84c2a9` = origin/main · WORKTREE CLEAN · ลำดับคอมมิตล่าสุด: `d84c2a9` (docs restoration) → `3310601` (parser fix) → `d943f08` → `6a5392d` → `8666026` (cutover)

## 9. Production blockers ที่ไม่เกี่ยวกับ G8

Stripe live-mode verify · external notification credentials · physical delivery ops · real dispatch provider integration · tracking dependencies

## 10. Status ที่ห้ามเปลี่ยนโดยไม่มี Owner decision

- G6/G7 registration: **NOT REGISTERED** (gate แยก)
- Open Shop: **NOT OPEN / NOT AUTHORIZED**
- Stripe: **NOT touched** (live-mode verify ยังเปิด)
- External notification credentials: **ยังไม่มี**
- Physical delivery: **ยังไม่เปิด**
- G4 Meta: **HOLD**
- Real dispatch/provider: **ยังไม่ integrate**
- Tracking: **ยังไม่เปิด**

## 11. Exact next action

1. รัน observation ต่อ: `node e2e/g8s5Watch.cjs` (detached) + `node e2e/g8s5Observe.cjs` — จับ `event=schedule` เท่านั้น เป้าหมาย ≥2 executions/job พร้อม chain เต็ม
2. ตรวจ GitHub Actions tab ว่ามี banner schedule-disabled หรือ GitHub status incident หรือไม่ (restore existing trigger only — Owner-authorized)
3. เมื่อได้ scheduled executions ครบ → พิสูจน์ chain ต่อ execution (schedule→enqueue→queue→claim→dispatcher→worker→terminal→trace) + legacy=0 + dual-path=0 → อัปเดต report §17/§23 → `G8-S5 = PASS` → HARD STOP for Owner review
4. ถ้า schedule ยังไม่ fire → รายงาน 9 ข้อ (last schedule run, post-fix SRUN, latest push, workflow state, parser status, window, GH evidence, queue evidence, duration since fix) → คง HOLD ห้าม workaround

## 12. MUST NOT revisit (CLOSED)

AUTOMATION_TOKEN (verified — ห้าม rotate/สร้างใหม่) · auth architecture · G8-D06 · queue/enqueue/dispatcher architecture · retry policy · enqueue idempotency · cron/cadence · G6/G7 registration decision · worker semantics · completed gates G8-S0..S4, T1, T2

## 13. Evidence references

- `BMB_G8_S5_CONTROLLED_CUTOVER_RUNTIME_REPORT.md` (§1-§23 + §17b/§17c/§23b)
- `e2e/g8s5Precheck.cjs`, `g8s5DispatcherRuntime.cjs`, `g8s5FailureReverify.cjs`, `g8s5Observe.cjs`, `g8s5Watch.cjs`, `g8s5ProbeScheduled.cjs`, `g8s5-dispatcher-evidence.json`
- Commits: `8666026` cutover · `3310601` parser fix · `d84c2a9` latest
- GitHub run IDs: `37128641566` (last schedule success 14:09Z) · `37165700731` (startup_failure pre-fix)

## 14. Final instruction

**"Continue from this handoff. Do not restart completed waves. Do not reopen closed Owner decisions."**

