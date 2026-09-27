# BMB_W4C_REALTIME_AUDIT.md
**W4-C — Realtime Stub Audit · วันที่: 2026-09-27 · AUDIT ONLY (ไม่มี implement) · Authority: Production runtime > Code > Deployment state > Docs**

## คำตอบข้อถามหลัก

| คำถาม | คำตอบ | Evidence |
|---|---|---|
| มี realtime จริงหรือไม่? | **ไม่มี — และเป็นการตั้งใจ (intentional)** | vite.config.ts:56 alias `@supabase/realtime-js` → stub |
| อะไรใช้ realtime? | ไม่มีอะไรใช้ | git grep: 0 business callers |
| ใครเป็น caller? | ไม่มี — `subscribeToTable`/`unsubscribeFromChannel` (src/lib/supabase.ts:71/88) เป็น dead code — มีเพียง test mocks (api.test/canonicalOrderFlow.test/paymentStateMachine.test) ปลอมมัน | git grep `subscribeToTable` |
| มี subscription จริงหรือไม่? | **ไม่มี** — stub `channel()` throw `REALTIME_DISABLED` | src/lib/stubs/realtimeStub.ts:19-21 |
| table ไหน publish? | **ไม่มีตารางใดถูก publish** — `pg_publication_tables` = 0 rows (Management API read-only query) | runtime DB query 2026-09-27 |
| publication มีอยู่ไหม? | `supabase_realtime` publication มีอยู่ (Supabase default) แต่**ว่าง** — ไม่มี table ใด replicated | `select pubname from pg_publication` |
| RLS รองรับหรือไม่? | N/A — ไม่มี replicated table → realtime ไม่ทำงานอยู่แล้วแม้ subscribe | — |
| PWA ใช้จริงหรือไม่? | **ไม่ใช้** — ใช้ READ-ONLY polling แทน | OrderTrackPage (setInterval refresh), PaymentConfirmationPage (15s) |
| Admin ใช้จริงหรือไม่? | **ไม่ใช้** — AdminOrders ใช้ fetch-on-demand + W4-A pagination; AdminErrorsPage ใช้ polling 30s | source + W4-A |
| มี polling fallback หรือไม่? | **มี และเป็นกลไกหลัก** (READ-ONLY): OrderTrackPage · PaymentConfirmationPage (15s) · AdminErrorsPage (30s) | source |
| ถ้า stub ถูกลบจะเกิด regression หรือไม่? | ห้ามลบ — ถ้าลบ alias ออก จะกลับไป ship realtime-js+Phoenix ~100KB ให้ผู้ใช้ทุกคนโดยไม่มีใครใช้ (bundle regression) — และถ้า subscribe โดยไม่มี publication = ทำงานเป็น false-silent | vite alias + publication ว่าง |

## Classification

| รายการ | Status | Action |
|---|---|---|
| src/lib/stubs/realtimeStub.ts + vite alias | **STUB (intentional, documented)** | KEEP — เป็น bundle-size protection ที่ตั้งใจ |
| supabase.ts realtime.params (eventsPerSecond) | PARTIAL (config ตกค้าง แต่ถูก stub override) | NO ACTION (แตะ = code change ไม่จำเป็น) |
| subscribeToTable / unsubscribeFromChannel (dead code) | **UNUSED** | SAFE CLEANUP — OWNER REVIEW (การลบกระทบ 3 test mocks ต้องแก้ tests ด้วย — เสนอได้ แต่รอบนี้ audit-only) |
| Database publication (supabase_realtime, 0 tables) | NONE (ว่าง) | NO ACTION (การ add table เข้า publication = schema/DB change → ห้ามโดย default) |

## Required Output

```text
========================================
W4-C REALTIME STUB AUDIT
========================================

Realtime infrastructure: STUB (intentional bundle-size stub — ไม่ใช่ broken feature)

PWA: ไม่ใช้ realtime — READ-ONLY polling (OrderTrack, PaymentConfirmation 15s)
Admin: ไม่ใช้ realtime — fetch-on-demand + AdminErrors polling 30s
Database publication: supabase_realtime มีอยู่แต่ว่าง (0 tables replicated)
Subscriptions: 0 (dead-code helper เท่านั้น — mocked ใน 3 test files)
Polling fallback: มี = กลไกหลักอยู่แล้ว ครอบคลุม use-case ที่ต้องการ freshness
Runtime verification: publication ว่าง ยืนยันผ่าน read-only DB query
TRUE STUBS: 1 (realtimeStub.ts — เจตนาที่ถูกต้อง: ประหยัด ~100KB)
MISSING CAPABILITIES: ไม่มี business requirement ที่ต้องใช้ realtime จริง
  (freshness ที่มีอยู่ = polling; notifications = Web Push FROZEN/DEFERRED)
SAFE CLEANUP: 1 รายการเสนอได้ (subscribeToTable/unsubscribeFromChannel dead code
  + 3 test mocks — non-destructive, แต่ต้องแก้ tests ร่วม → OWNER REVIEW)
OWNER DECISION REQUIRED: 1 (อนุมัติ/ไม่อนุมัติ ลบ dead-code helpers ใน W4-D
  หรือคงไว้เป็น API surface สำหรับอนาคต)

IMPLEMENTED      = 0 (audit-only)
CONNECTED        = 0
DEPLOYED         = stub ใช้งานจริงทุก build (ใน bundle)
RUNTIME VERIFIED = publication ว่าง (DB query) + build ผ่าน (stub ใช้งานจริง)
MISSING          = ไม่มี requirement
BLOCKED          = ไม่มี
DEFERRED         = ไม่มี
OWNER DECISION   = 1
========================================
```

## ข้อสรุป
- ห้าม implement realtime เพราะเห็นคำว่า "realtime/subscribe/channel" — **ไม่มี business/runtime requirement**
- ห้ามลบ stub (bundle protection ตั้งใจ · ถ้าลบ = bundle regression ~100KB)
- การเปิด realtime จริงในอนาคตต้อง: add table เข้า publication (= DB change → ต้องอนุมัติแยก) + ลบ alias + RLS-aware policies → เกิน scope W4

**HARD STOP — รอ Owner decision ก่อน W4-D**
