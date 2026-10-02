# BMB G4 — META SECURITY BOUNDARY · IMPLEMENTATION REPORT

วันที่: 2026-10-02 · Baseline: a69469d · Owner decisions: D4-1 redeploy APPROVE · D4-2 constant-time compare APPROVE · D4-3 timestamp/replay DEFER · D4-4 mention parser DEFER · D4-5 Page IDs external · D4-6 Meta subscription external

## 1. Production function version

| | Before | After |
|---|---|---|
| channel-webhook version | **5** (2026-09-27, pre-G3) | **6** (`supabase functions list`: ACTIVE, 2026-10-02 12:08) |
| Deployment drift | CONFIRMED (repo มี G3 boundary, prod v5 ไม่มี) | **ELIMINATED** (deploy EXIT ok — "Deployed Functions: channel-webhook") |

## 2. Exact code changes (single file + one new test)

`supabase/functions/channel-webhook/index.ts` — **เฉพาะ D4-2**:
- เพิ่ม `timingSafeEqualHex(a,b)`: XOR-fold ทั้งความยาว (len XOR) และทุก byte (คู่ `?? 0` เมื่อความยาวไม่เท่า) — ไม่มี early-exit byte mismatch
- เปลี่ยนบรรทัดตัดสิน: `if (!sig || sig !== expected)` → `if (!sig || !timingSafeEqualHex(sig, expected))`
- ไม่แตะ: algorithm (ยัง HMAC-SHA256 raw body ก่อน JSON.parse), secret name, route, tenant authority, page binding model, social_events schema, order path
**ไม่มีการแก้ไฟล์อื่นใน production code** (เพิ่มเฉพาะ test harness `e2e/g4_signature_boundary.mjs`)

## 3. Security test evidence (ทั้งหมดรันจริง)

| Test | Result |
|---|---|
| **G4 signature harness (e2e/g4_signature_boundary.mjs)** — รัน source จริงของ function: helper wired + plain-compare removed; valid sig → verification pass; invalid → 401; malformed (no-prefix/short/UPPERCASE/md5-prefix) → 401; missing sig → 401; missing secret → 500 fail-closed; raw-body integrity (sign A send B) → 401 | **ALL PASSED (11/11)** |
| G3 webhook boundary harness (11/11) | ALL PASSED (regression: code change ไม่ทำให้ boundary เดิมเสีย) |
| Replay 110 files (fresh bare container) | REPLAY_OK FAILURES=0 |
| T1–T11 / T12–T23 / S1–S8 | ALL PASSED (3 suites, exit 0) |
| Concurrent idempotency race | PASSED: [INSERTED][DUPLICATE], RACE_ROWS=1 |
| npm test | 367/367 PASS (41 files) |
| lint | PASS (clean) |
| build | PASS (built in 4.40s) |

## 4. Production probe evidence (v6; signature-gate only — zero data writes)

| Probe | Result |
|---|---|
| B: POST ไม่มี signature | **401** (gate ทำงาน, ไม่มี downstream processing) |
| C: POST malformed signature (sha256=zz) | **401** |
| GET handshake wrong verify_token | **403** |
| A: missing-secret behavior | RUNTIME VERIFIED บน harness (test 6) — production มี secret จึงไม่สามารถ/ไม่ควร simulate; fail-closed path ยังอยู่ใน deployed code |
| D: unbound page / F: valid-structure-no-binding | RUNTIME VERIFIED บน isolated (S4/S7) — production probe ด้วย valid sig ต้องใช้ secret value (ห้ามอ่าน) และจะเขียน audit row (= production test data) จึงไม่ทำ; จะ verify จริงเมื่อ Owner เชื่อม Meta (D4-6) |

## 5. G3 regression evidence

- migration 109 unchanged (git diff ว่าง; production g3_tables=2, g3_unique=1, g3_policies=3 pre/post deploy)
- T1–T23 + S1–S8 + race + G3 harness: ครบและผ่าน (ตาราง §3)
- production function v6 คือ source เดียวกับ commit นี้ (deploy จาก working tree)

## 6. Event identity finding (Phase 3 — no code change)

- **Canonical identity สร้างได้จาก actual payload contract** ของ event shapes ที่รองรับ:
  - Messenger: `msg-<message.mid>` — mid เป็น identity ของ Meta เอง, มีเสมอใน valid message event
  - Facebook feed: `post_id || comment_id || value.id` — Meta identity fields ของ payload จริง
- fallback (`ev-<entry.id>-<ts>` / `chg-...`) ยิงเฉพาะเมื่อ identity fields **ขาด** = payload ไม่อยู่ใน canonical contract ⇒ collision ระหว่าง **two distinct VALID Meta events เป็นไปไม่ได้**
- ⇒ **ไม่มีการแก้ event identity** (ตรงตามเงื่อนไข Owner: แก้เมื่อ canonical identity พิสูจน์ได้ — และพิสูจน์ได้แล้วว่าไม่ต้องแก้); uniqueness ยังเป็น UNIQUE(platform,event_id) ไม่ถูกแตะ
- สถานะ: DOCUMENTED (canonical identity from payload contract)

## 7. Deferred hardening (per Owner)

| Item | Status |
|---|---|
| Timestamp/replay freshness (D4-3) | **DEFERRED** — ไม่มี approved payload/timestamp contract; DB uniqueness ยังคุ้ม effect-level |
| Mention parser (D4-4) | **DEFERRED** — รอ canonical parsing contract |
| event_id fallback | DOCUMENTED — canonical identity established; no change |

## 8. External dependency status

| Item | Status |
|---|---|
| Supabase secrets (APP_SECRET / VERIFY_TOKEN) | CONNECTED (names verified; values never read/printed) |
| Production function | DEPLOYED v6 — boundary รอ Meta event แรกอยู่ (fail-closed) |
| channel_page_bindings | 0 rows — **fail-closed**; รอ Owner ใส่ Page IDs จริง (D4-5) |
| Meta App webhook subscription | **BLOCKED EXTERNAL** (Owner action) |
| Real Meta event verification | **MISSING** — ยังไม่มี real event ถูกได้รับ (จะเกิดหลัง Owner subscribe) |

## 9–11. Git

- HEAD: (verify below, post-push) · origin/main: (verify below) · Worktree: (verify below)
- Changed files: `supabase/functions/channel-webhook/index.ts` (constant-time compare only) · `e2e/g4_signature_boundary.mjs` (new test) · `BMB_G4_READINESS_REVIEW.md` (จากรอบ audit) · รายงานนี้

## FINAL STATUS (ตาม STATUS RULE — ไม่อ้าง PASS)

```
G4 = HOLD — EXTERNAL DEPENDENCY

ฝั่ง implementation เสร็จและ deployed ครบ (drift eliminated: v5→v6;
constant-time compare implemented + 11/11 harness; ทุก regression PASS)
แต่ยังไม่มี: Page IDs bound (D4-5), Meta subscription (D4-6),
real Meta event received + full-chain runtime verification
เมื่อ Owner ทำ external step เสร็จ และ real event ผ่าน chain ครบ
(verify → signature → binding → tenant/brand → social_events row →
duplicate/replay → ไม่มี order bypass) จึงจะอัปเดตเป็น G4 = PASS
```

STOP — ไม่มี G5 work / Auto Reply / Auto Post / AI routing / retry scheduler