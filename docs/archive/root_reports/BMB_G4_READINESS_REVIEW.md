# BMB G4 — META SECURITY BOUNDARY · READINESS REVIEW (AUDIT ONLY)

วันที่: 2026-10-02 · Baseline: HEAD == origin/main == a69469d · G1/G2-A/D2/G2-RV/POST-G2/G3 = PASS
Mode: HARD STOP — audit only; no code/migration/deploy/secret/Meta-config/commit/push performed

## 1. Current implementation audit (production code as of a69469d, not old reports)

| Surface | Finding | Status |
|---|---|---|
| `supabase/functions/channel-webhook/index.ts` (repo) | WebCore adapter: GET handshake + POST HMAC + parse + G3 ingestion boundary + legacy order-intent path (via canonical RPC) + audit trail | IMPLEMENTED |
| **Production Edge Function** | `supabase functions list` → channel-webhook **ACTIVE, version 5, deployed 2026-09-27** — predates G3 edits ⇒ **repo มี G3 ingestion block แต่ production function ยังไม่ได้ deploy รุ่นใหม่** | **MISSING** (deploy step required at G4 implementation) |
| Supabase secrets (names via `secrets list`, values NOT read) | `CHANNEL_WEBHOOK_APP_SECRET`, `CHANNEL_WEBHOOK_VERIFY_TOKEN` มีอยู่บน production | CONNECTED (names verified) |
| Other Meta-related code | No Meta code outside channel-webhook (no graph API calls, no tokens stored); config.toml verify_jwt=false documented | IMPLEMENTED (scope-contained) |
| Data minimization | ไม่เก็บ/คืน secret/token/page token; audit metadata เฉพาะ channel/extUser/order ref | DOCUMENTED + CODE VERIFIED |

## 2. Meta signature contract

| # | Question | Answer | Status |
|---|---|---|---|
| 1 | Header expected | `x-hub-signature-256` (`sha256=<hex>`) | IMPLEMENTED + RUNTIME VERIFIED (harness test 2; W3-C probe bad-signature) |
| 2 | Raw body | `await req.text()` — full raw body, single read, no re-serialization | IMPLEMENTED + RUNTIME VERIFIED |
| 3 | Signed over exact raw bytes | YES — HMAC คำนวณจาก raw string ก่อน JSON.parse | IMPLEMENTED + RUNTIME VERIFIED |
| 4 | Algorithm | HMAC-SHA256 (WebCrypto crypto.subtle) | IMPLEMENTED + RUNTIME VERIFIED |
| 5 | Secret source | Supabase secrets env `CHANNEL_WEBHOOK_APP_SECRET` (module init) | IMPLEMENTED + CONNECTED |
| 6 | Secret missing | 500 fail-closed ก่อนอ่าน/ประมวลผล body (zero fetch side effects) | RUNTIME VERIFIED (harness test 1) |
| 7 | Malformed signature | !sig \| \| sig !== expected → 401 ก่อน JSON parse และก่อน fetch | RUNTIME VERIFIED (harness 2; probe) |
| 8 | Wrong signature | 401 เดียวกัน | RUNTIME VERIFIED |
| 9 | Timing-safe compare | **MISSING** — `sig !== expected` string compare ธรรมดา | **MISSING** (severity ต่ำ: timing attack บน HMAC ผ่าน network แทบไม่ feasible; ให้เปลี่ยน constant-time ตอน G4 impl) |
| 10 | Replay protection (timestamp freshness) | **MISSING** — ไม่มีตรวจอายุ event | MISSING (mitigated by DB uniqueness — §5) |
| 11 | Duplicate events | DB UNIQUE(platform,event_id) + DUPLICATE marking | RUNTIME VERIFIED (G3 S2 + concurrent race test) |
## 3. Page binding security (channel_page_bindings, migration 109)

| Aspect | Finding | Status |
|---|---|---|
| Schema | UNIQUE(platform,page_id) · CHECK page_id<>'' · platform CHECK enum · tenant FK -> tenants(id) | DEPLOYED + RUNTIME VERIFIED |
| RLS | ENABLED; platform_admin ALL policy เท่านั้น | DEPLOYED + RUNTIME VERIFIED (S7: tenant admin hidden - ACL deny) |
| Grants | PUBLIC/anon/authenticated REVOKEd; service_role CRUD | DEPLOYED + RUNTIME VERIFIED (anon_grants=0 probe) |
| Who manages bindings | platform admin เท่านั้น; webhook caller ห้าม | RUNTIME VERIFIED |
| Active/inactive | is_active=false -> RPC ไม่ match -> UNBOUND_PAGE (fail-closed) | IMPLEMENTED + RUNTIME VERIFIED (S4 semantics; dedicated inactive test = G4 impl item) |
| Fail-closed | bindings ว่าง (ปัจจุบัน 0 แถว) -> ทุก page -> UNBOUND_PAGE -> reject+audit | RUNTIME VERIFIED (production probe svc_unbound=UNBOUND_PAGE) |
| Cross-tenant | tenant derive จาก binding เท่านั้น; caller-supplied tenant/brand ไม่มีช่องทาง (RPC signature ไม่รับ; harness test 5) | RUNTIME VERIFIED |
| Cross-brand | brand derive จาก brands.is_default ของ tenant (D3 single-brand) | IMPLEMENTED (D3) |
| Production state | bindings = 0 rows (ไม่มี fake bindings ตามคำสั่ง) | DEPLOYED (empty, fail-closed) |

## 4. Event validation contract

| Event | Behavior | Status |
|---|---|---|
| message (Messenger) | ev.messaging[] -> sender.id ต้องมี (ไม่มี -> reject+audit); event_id = msg-<mid> (mid ขาด -> fallback ev-<entry.id>-<ts>); text parsed เพาะ order-intent JSON | IMPLEMENTED + RUNTIME VERIFIED (harness 5; W3-C probe) |
| comment (FB feed) | ev.changes[] -> value.from; event_id = post_id/comment_id/id; channel จาก explicit metadata เท่านั้น (ไม่เดา) | IMPLEMENTED + RUNTIME VERIFIED (W3-C probe; S4 DB-level) |
| mention | **MISSING** - webhook ยังไม่มี mention parser (RPC รับ type แต่ไม่มีที่มา) | MISSING (G4 impl item หรือ DEFERRED - Owner ตัดสิน) |
| Malformed/invalid JSON | 400 | RUNTIME VERIFIED (harness 7; invalid-json path code-verified) |
| Missing sender | reject + audit | IMPLEMENTED (code) |
| Missing page_id | entry.id ขาด -> p_page_id='' -> RPC REJECTED (fail-closed) | IMPLEMENTED + DB-level RUNTIME VERIFIED (S3) |
| Missing event_id | fallback composite id อาจชนกันถ้า timestamp ้ำ (collision -> UNIQUE -> DUPLICATE = fail-safe ด้าน effect แต่อาจ swallow event) | DOCUMENTED gap (G4 impl: ใช้ Meta delivery id เมื่อมี) |
| Unsupported event/object | object != page -> 400; shape ไม่ร้จัก -> reject+audit | RUNTIME VERIFIED (harness 7) |
| Order creation | ไม่มี order creation ดยตรงจาก Meta - intent ต้องผ่าน create_order_with_items canonical RPC (p_source_channel + p_external_ref_id) เท่านั้น | IMPLEMENTED + DOCUMENTED |

## 5. Replay / duplicate security analysis

| Case | Outcome | Status |
|---|---|---|
| A. same event replay | RPC ON CONFLICT -> mark DUPLICATE, no reprocessing; audit channel_event_duplicate | RUNTIME VERIFIED (S2 + harness 6) |
| B. concurrent duplicate | TRUE-CONCURRENCY TEST PASSED: 2 sessions -> INSERTED + DUPLICATE, ROWS=1 | RUNTIME VERIFIED |
| C. invalid signature + valid event_id | 401 ก่อน ingestion - ไม่มี row, ไม่มี fetch side effect | RUNTIME VERIFIED (harness 2) |
| D. valid signature + duplicate event_id | DUPLICATE marking; single row | RUNTIME VERIFIED |
| E. same event_id across platforms | UNIQUE(platform,event_id) -> platform-scoped = 2 rows (ตาม design) | IMPLEMENTED (explicit cross-platform test = G4 impl item) |
| F. same event_id across pages (same platform) | ถือเปน duplicate ของ platform+event_id - แถวเดียว, page แรกชนะ; page_id ไม่อย่ใน uniqueness | DOCUMENTED gap (Meta event_id มี scope ระดับ app จึงสอดคล้อง; ไม่เปลี่ยน UNIQUE ตามคำสั่ง) |

DB authority = UNIQUE(platform,event_id) คงเดิม ไม่ถก weaken/replace

## 6. External dependency matrix

| Dependency | Status | Note |
|---|---|---|
| Meta App ID | READY (ไม่จำเปนฝั่ง server สำหรับ inbound) | ใช้ตอนตั้งค่า Meta App dashboard |
| App Secret | CONNECTED (production secret มีอย่ - ชื่อ verified, ค่าไม่อ่าน) | ต้องค่าเดียวกับ Meta App webhook config |
| Verify Token | CONNECTED (มีบน production secrets) | ต้องค่าเดียวกันใน Meta subscription |
| Page Access Token | READY / ไม่จำเปนสำหรับ G4 (inbound only) | จำเปนตอน outbound reply (gate หลังจากนี้) |
| Webhook subscription (Meta side) | **BLOCKED EXTERNAL** | Owner ต้อง subscribe ใน Meta App + ยืนยัน callback URL + verify token |
| Page IDs | **MISSING + OWNER DECISION REQUIRED** | channel_page_bindings = 0; ห้ามใส่ fake bindings |
| Production function URL | READY (function ACTIVE) | **version 5 = pre-G3 code - ต้อง redeploy ก่อนเชื่อม Meta** |
| Required Meta permissions | ไม่มีสำหรับ inbound webhook | DOCUMENTED |
| Required env secrets | ครบ (2/2) | CONNECTED |

## 7. Security test matrix (executed vs planned)

| # | Test | Status |
|---|---|---|
| 1 | valid signature -> process | RUNTIME VERIFIED (harness 5 + W3-C probe) |
| 2 | invalid signature -> 401 | RUNTIME VERIFIED (harness 2) |
| 3 | malformed signature -> 401 | RUNTIME VERIFIED (unsigned/bad-sig probe + harness 2) |
| 4 | missing secret -> 500 fail-closed | RUNTIME VERIFIED (harness 1) |
| 5 | missing signature -> 401 | RUNTIME VERIFIED (probe) |
| 6 | wrong page (object != page) -> 400 | RUNTIME VERIFIED (harness 7) |
| 7 | unbound page -> reject+audit | RUNTIME VERIFIED (harness 4 + production probe) |
| 8 | inactive binding -> reject | IMPLEMENTED (semantics) - dedicated executable test = G4 impl item |
| 9 | missing event_id -> fallback id | IMPLEMENTED - collision-behavior test = G4 impl item |
| 10 | missing page_id -> RPC REJECT | RUNTIME VERIFIED (S3 DB-level) |
| 11 | unsupported event -> reject | RUNTIME VERIFIED (harness 7 / parse errors) |
| 12 | duplicate event -> DUPLICATE | RUNTIME VERIFIED (S2 + harness 6) |
| 13 | concurrent duplicate | RUNTIME VERIFIED (true concurrency) |
| 14 | cross-tenant binding attempt | RUNTIME VERIFIED (caller ไม่มีช่องทาง; S5/S6) |
| 15 | caller-supplied tenant_id/brand_id injection | RUNTIME VERIFIED (harness 5: no tenant field; RPC ไม่รับ) |
| 16 | order-path isolation | RUNTIME VERIFIED (harness 4: no create_order call; S8) |
| 17 | no secret leakage in logs | CODE VERIFIED (data-minimization) - automated log-scan = G4 impl item |
| 18 | fail-closed behavior | RUNTIME VERIFIED (harness 1/3 + production probes) |

## 8. Exact change surface (G4 implementation เมื่อได้รับอนุาต - ไม่ได้แตะในรอบนี้)

1. Redeploy channel-webhook Edge Function รุ่นปัจจุบัน (รวม G3 ingestion block)
2. Optional hardening (แนะนำ): constant-time signature compare; timestamp freshness check; mention parser (Owner ตัดสิน)
3. Production channel_page_bindings INSERT ตาม Page IDs จริงจาก Owner (platform-admin path)
4. Executable tests ที่ยังขาด: #8, #9(collision), #14(explicit), #17(log scan)

SCOPE-EXPANSION WARNING: outbound reply / Graph API / Page token = นอก G4 (gate หลังจากนี้)

## 9. Risks / gaps

- Production function stale (version 5, pre-G3): ถ้า Meta เชื่อมตอนนี้ จะไม่มี page allowlist/ingestion boundary ทำงาน (audit_logs dedupe เท่านั้น) -> ต้อง redeploy ก่อนเชื่อมจริง (สงสุด)
- Timing-unsafe compare: ต่ำ
- ไม่มี timestamp/replay freshness: ต่ำ-กลาง (effect-level ปลอดภัยด้วย DB uniqueness; stale event ยังเข้า state machine)
- event_id fallback collision: ต่ำ (DUPLICATE = fail-safe effect)
- Cross-page event_id dedupe: ต่ำ (ตาม Meta id scope)
- Secret leakage: ไม่พบใน source ปัจจุบัน (code-verified; log-scan test = G4 impl item)

## 10. Owner decisions required

1. ให้ Page ID(s) จริง + platform ของแต่ละ page (channel_page_bindings) - D-05/B-4 ค้างจาก G3 section 16.2
2. ยืนยันจะ subscribe webhook ใน Meta App ด้วย callback URL + VERIFY_TOKEN ที่มีอย่ (external action)
3. อนุมัติ optional hardening: constant-time compare + timestamp freshness + mention parser (แนะนำ 2 ข้อแรก)
4. ยืนยัน redeploy channel-webhook ก่อนเชื่อม Meta (จำเปน)

## 11. GO / HOLD
```
G4 = HOLD - EXTERNAL DEPENDENCY

เหตุผล: ฝั่งเราพร้อม (secrets ครบ 2/2, DB boundary deployed, ค้ด boundary
implemented + harness-verified 11/11, fail-closed verified) แต่:
  (1) Meta webhook subscription = BLOCKED EXTERNAL (Owner action ใน Meta App)
  (2) Page IDs = MISSING (Owner ต้องให้ค่าจริง - ห้าม fake bindings)
  (3) Production Edge Function = version 5 (pre-G3) - ต้อง redeploy ก่อนเชื่อม
ไม่มี security remediation ที่ block - timing-safe/replay-freshness เปน
hardening items แนะนำให้ทำพร้อม G4 implementation + redeploy
```

---
Git HEAD at audit: a69469d (== origin/main)
Worktree at audit: เพิ่มเพาะไฟลรายงานนี้ (uncommitted ตาม HARD STOP); ไม่มี code/migration/secrets เปลี่ยนแปลง
