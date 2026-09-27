# BMB_W3C_OMNICHANNEL_EVIDENCE.md
**WAVE 3-C — OMNICHANNEL · วันที่: 2026-09-27** · ภาษาไทยเป็นหลัก · TEST identifiers คง English

## 1. Owner Authorization
- Owner command "BMB — OWNER AUTHORIZATION / START W3-C OMNICHANNEL" (2026-09-27): ทำ W3-C-0 →
  W3-C-11 → GATE → COMMIT → PUSH → HANDOFF → HARD STOP · ใช้ architecture authority ที่กำหนด ·
  ห้าม Make.com · ห้าม implement ก่อน audit · ห้ามสร้าง F-14 migration โดยพลการ ·
  Final gate ต้องแยก verdict (ห้ามรวม PASS เดียว)

## 2. W3-C Scope
- Omnichannel: PWA / FACEBOOK / FACEBOOK_GROUP / MESSENGER / MANUAL (+ future LINE/TikTok/Google/QR/Direct)
- หลัก: Channel → Adapter/Ingestion → Native BMB Automation → Canonical RPC → Supabase → Order Hub
- AI = Intelligence/Extraction/Assistance เท่านั้น (ไม่ใช่ transaction authority)

## 3. Architecture
- ตามเอกสาร `docs/AUTOMATION_ARCHITECTURE.md` (W3-B) + architecture ในคำสั่ง Owner
- ยืนยันไม่มี Make.com ใน implementation ใด ๆ (scan src/ supabase/ e2e/ รอบใหม่: 0 hits ใน code)

## 4. W3-C-0 Reality Audit (production + repo จริง)
| Capability | สถานะ |
|---|---|
| Canonical order RPC `create_order_with_items` (server-authoritative, mode gate, cutoff Asia/Bangkok, 025) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (W3-C probe) |
| Canonical pre-order RPC `create_pre_order_with_items` (017/025) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (W3-C probe) |
| Order mode gate (`available_same_day`/`available_preorder`, 023 trigger mirror) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (ERR_PRODUCT_MODE_NOT_ALLOWED ทำงานจริง) |
| Direct-DB-insert block (RLS on orders) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (customer JWT INSERT = 403 42501; anon = 401) |
| Admin MANUAL intake (Admin UI → `bmbAdminApi_orders.createOrder` → canonical RPC) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (W3-C probe) |
| PWA intake (CheckoutPage → canonical RPC) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (W3-C probe) |
| Payment idempotency / webhook (Stripe, 008/010) | IMPLEMENTED · CONNECTED · DEPLOYED · RUNTIME VERIFIED (Wave 1) |
| Native automation handoff (automation-worker, W3-B) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (W3-B 13/13 + W3-C probe) |
| FACEBOOK / FACEBOOK_GROUP / MESSENGER inbound | **NOT IMPLEMENTED · NOT CONNECTED** (ไม่มี webhook receiver/adapter ใน src/supabase — scan ใหม่ยืนยัน) — **F-14 BLOCKED** |
| source_channel / external_ref_id / cross-channel idempotency | **MISSING** (ไม่มีใน orders schema และ RPC params — git grep + production) → F-14 BLOCKED |
| Future channels (LINE/TikTok/Google/QR/Direct) | MISSING (ยังไม่มี requirement จาก Owner) |
| Cross-channel customer identity model (FB/Messenger user → customer) | **IDENTITY GAP** — existing model: customers + orders.customer_ref (auth.users) + phone/name; ไม่มี external identity mapping table |

## 5. Channel Inventory (W3-C-1)
| Channel | inbound | identify | ext.ref | order create | duplicate protect | auth/verify | audit | retry | source_channel/ext_ref_id |
|---|---|---|---|---|---|---|---|---|---|
| PWA | browser session | auth.users (JWT) | n/a | canonical RPC ✓ | payment ✓ / create ✗ | Supabase Auth JWT ✓ | audit_logs ✓ | caller ✓ | ✗ (MISSING) |
| MANUAL (admin) | Admin UI | is_admin() | n/a | canonical RPC ✓ | transition ✓ / create ✗ | admin RLS ✓ | audit_logs ✓ | caller ✓ | ✗ (MISSING) |
| FACEBOOK / FB_GROUP / MESSENGER | — | — | — | — | — | — | — | — | **NOT IMPLEMENTED — F-14 BLOCKED** |
| LINE/TikTok/Google/QR/Direct | — | — | — | — | — | — | — | — | NOT IMPLEMENTED (ไม่มี requirement) |

หมายเหตุตรงตามคำสั่ง: **ไม่มีการสร้าง fake channel integration** เพื่อให้ test ผ่าน

## 6. Existing Implementations
- `src/lib/bmbAdminApi_orders.ts` — createOrder (admin) → canonical RPC (client ส่งแต่ input, server คิดราคา)
- `src/pages/CheckoutPage.tsx` — customer intake → canonical RPC
- `supabase/functions/*` — ไม่มี channel webhook receiver (FB/Messenger = F-14 scope)

## 7. Channel Contracts
- สัญญา intake เดียวที่มีจริง: `create_order_with_items(p_* params)` · `create_pre_order_with_items`
- ไม่มี external channel contract (ไม่มี signature verify สำหรับ FB/Messenger) — MISSING/F-14

## 8. Canonical Order Intake (W3-C-3)
- **PASS**: ทุก intake ที่มีอยู่จริงเข้า canonical RPC → Supabase → canonical order_number
  (พิสูจน์ runtime: PWA order `BMB-…-655`, MANUAL order `BMB-…-214`)
- **Direct DB insert ถูกปฏิเสธ**: customer JWT → 403 (42501 RLS violation), anon → 401
- ไม่พบ path "Facebook/Messenger/AI/Automation → direct DB insert" ใน code (ไม่มีช่องทางเหล่านั้นเลย)

## 9. Customer Identity (W3-C-6)
- existing model: `orders.customer_ref` (auth.users) + customers row + customer_name/phone
  (channel-agnostic contact fields) · RLS own-read/admin
- **IDENTITY GAP** (รายงานตามคำสั่ง — STOP เฉพาะ dependent): ไม่มี external identity mapping
  (facebook_id/messenger_psid → customer) · required model = identity mapping table + link flow ·
  migration impact: additive table; security impact: ต้อง design ควบคู่ webhook verification ·
  **ไม่สร้าง identity model ใหม่เอง** — รอ Owner

## 10. F-14 Dependency (W3-C-2) — **F-14 = BLOCKED (ไม่ implement)**
Requirement จาก production schema จริง (ตอบ 10 ข้อ):
1. **ขาด**: `orders.source_channel` (text, default), `orders.external_ref_id` (text nullable)
2. **Contract**: `create_order_with_items` ต้องเพิ่ม optional `p_source_channel`/`p_external_ref_id`
   (หรือ RPC ingestion แยก) — additive, ไม่ breaking
3. **RPC กระทบ**: create_order_with_items (+ ทางเลือก ingestion RPC สำหรับ adapter)
4. **RLS กระทบ**: ไม่มี (additive columns; policy เดิมคงอยู่)
5. **Backward compat**: existing callers ไม่ส่ง param ใหม่ → default channel ใช้ได้ทันที
6. **Unique index จำเป็น**: `(source_channel, external_ref_id)` WHERE external_ref_id IS NOT NULL —
   DB-level duplicate protection สำหรับ cross-channel event
7. **Migration**: 1 ไฟล์ additive (ALTER TABLE + index + RPC signature)
8. **Backfill**: existing orders → source_channel default ('PWA' หรือ 'MANUAL' ตาม actor —
   **ต้อง Owner เลือก policy**) · ปริมาณน้อย
9. **Security impact**: unique index = durable duplicate guard; adapter ต้องมี webhook signature
   verification ก่อนเรียก RPC
10. **Test impact**: เพิ่ม duplicate-event/same-ref tests ได้ (ต่อยอด w3c probe)
→ **STOP เฉพาะ F-14 implementation** (รอ Owner Gate) · ส่วน W3-C อื่นทำต่อเสร็จแล้ว

## 11. Idempotency (W3-C-4)
- พิสูจน์ runtime ที่มีอยู่: transition ซ้ำ (same-state) → idempotent, ไม่เกิด side effect ใหม่
  (tr1 {ok,to:cancelled,from:pending} → tr2 {ok,to:cancelled,from:cancelled})
- payment webhook idempotency = unique partial index (Wave 1 verified)
- automation event idempotency = W3-B (duplicate=true, 1 row)
- **ONE logical customer action = ONE canonical order: ยังพิสูจน์ไม่ได้สำหรับ cross-channel
  duplicate order creation** — probe จริงยืนยัน: สร้าง order ซ้ำ (items เดียวกัน) ได้ 2 order
  (`BMB-…-655` + `BMB-…-269`) เพราะไม่มี idempotency key → **F-14 = BLOCKED** (ห้าม invent schema)
- in-memory protection: ไม่ใช้ (ทุก idempotency ที่มีอยู่ = DB durable)

## 12. Duplicate Handling
- เหมือนข้อ 11 · ผลจริงถูกบันทึกเป็น evidence ไม่ซ่อน (duplicate-create-behavior-documented)

## 13. Security (W3-C-5)
- canonical intake enforced ด้วย RLS (runtime: 403/401 กับ direct insert) — ไม่มี trust-external-payload
- secret scan: git/dist/runtime 0 hits (ข้อ 21) · ไม่ log key/JWT/token ใน probe ใด ๆ
- FB/Messenger webhook signature verification = MISSING พร้อมกับ channel (F-14) — BLOCKED
- service_role: server-side only (automation-worker) · least privilege: intake ผ่าน authenticated
  JWT / admin RLS เท่านั้น
- cross-channel identity collision: ไม่สามารถเกิดได้เพราะไม่มี channel inbound (ถ้ามี = ต้องออกแบบ
  identity mapping ก่อน — ข้อ 9)

## 14. Order Mode (W3-C-7)
- PRE-ORDER vs SAME_DAY = server-authoritative (mode gate + cutoff Asia/Bangkok + delivery_round)
- runtime พิสูจน์: SAME_DAY ผ่าน create_order_with_items · PRE-ORDER ผ่าน create_pre_order_with_items
  (product mode flag ถูก backend ตรวจ — ERR_PRODUCT_MODE_NOT_ALLOWED / ERR_SCHEDULED_DATE_INVALID
  ทำงานจริงเมื่อ intent ไม่ถูก) · Channel adapter ไม่มีสิทธิ์ตัดสิน business authority
- ทุกช่องทางที่มีจริง (PWA/MANUAL) เข้า Order Hub เดียวกัน (orders table + status machine เดียว)

## 15. Native Automation Handoff (W3-C-8)
- ORDER → SUPABASE → automation-worker (stale-pending job) → notification → audit_logs
- runtime: worker เห็น TEST order (`BMB-…-269`), notified 1 ครั้ง, event ซ้ำ → duplicate
- ไม่มี parallel automation engine · ไม่มี Make.com · ไม่มี duplicate business logic ใน adapter
  (ไม่มี adapter ใหม่ใน scope นี้)

## 16. Production E2E (W3-C-9) — `e2e/w3c-omnichannel-e2e.json` · TEST DATA ONLY · **PASS 12/12**
| ตรวจ | ผล |
|---|---|
| PWA canonical intake (customer JWT → RPC) → `BMB-…-655` | PASS |
| MANUAL canonical intake (admin JWT → RPC) → `BMB-…-214` | PASS |
| direct DB insert (customer JWT) → 403 RLS | PASS |
| direct DB insert (anon) → 401 | PASS |
| PRE-ORDER canonical intake (create_pre_order_with_items, mode-gated) | PASS |
| duplicate transition → idempotent (no side effect) | PASS |
| invalid payload → rejected by backend | PASS |
| duplicate order creation (same items) → 2 orders (CURRENT behavior, F-14 BLOCKED) | PASS (documented) |
| automation handoff once (worker + duplicate event) | PASS |
| unauthorized/secret-scan ครบใน W3-B probe | PASS |

## 17. Runtime Evidence
- `e2e/w3c-omnichannel-e2e.json` (12/12) · `e2e/w3b-automation-e2e.json` (13/13) ·
  audit_logs rows (automation.execution) บน production · order rows ชื่อ 'W3C Test*' (TEST DATA ONLY)

## 18. GAP
1. **F-14 schema (source_channel / external_ref_id / unique index)** — BLOCKED รอ Owner Gate
   (requirement ครบ 10 ข้อในข้อ 10)
2. **Facebook / FB Group / Messenger inbound integration** — NOT IMPLEMENTED, NOT CONNECTED
   (F-14 + webhook signature + identity mapping ต้องมาก่อน)
3. **IDENTITY GAP** — ไม่มี external identity mapping (FB/Messenger user → customer)
4. **Cross-channel duplicate-order protection** — ไม่มี idempotency key ตอนสร้าง order
   (runtime-verified: order ซ้ำได้ 2 รายการ) — แก้ได้ด้วย F-14
5. Future channels — ยังไม่มี Owner requirement

## 19. READY
- PWA channel = READY (canonical intake runtime-verified)
- MANUAL channel = READY (canonical intake runtime-verified)
- Canonical intake contract + Order Hub + mode gate = READY (runtime-verified)
- Native automation handoff = READY (runtime-verified)

## 20. BLOCKED
- F-14 schema implementation — OWNER GATE (รายงานข้อ 10)
- Channel ingestion (FACEBOOK/FACEBOOK_GROUP/MESSENGER) — F-14 + identity + webhook verify
- External identity model — OWNER DECISION

## 21. Quality Gate (W3-C-10)
- tsc = 0 ✓ · vitest 44 files / 358 tests ✓ · build ✓ · lint 0 ✓
- git secret scan ✓ · dist secret scan ✓ · runtime secret scan ✓ (probe responses 0 hits)
- production E2E ✓ (12/12) · RLS/security regression ✓ (direct insert ยังถูก deny; RLS/ACL ไม่ถูกแตะ)
- git diff/status/log/HEAD/origin/main ตรวจก่อน commit ✓

## 22. Final Verdict (แยกตามคำสั่ง)
```
W3-C CORE            = PASS   (canonical intake + Order Hub + automation handoff runtime-verified)
F-14                 = BLOCKED (schema requirement รอ Owner Gate — ไม่ได้ implement)
Channel PWA          = PASS
Channel MANUAL       = PASS
Channel FACEBOOK     = NOT IMPLEMENTED (F-14 BLOCKED)
Channel FACEBOOK_GROUP = NOT IMPLEMENTED (F-14 BLOCKED)
Channel MESSENGER    = NOT IMPLEMENTED (F-14 BLOCKED)
Channel LINE/TikTok/Google/QR/Direct = NOT IMPLEMENTED (ไม่มี Owner requirement)
Security             = PASS (RLS enforce intake; ไม่มี secret exposure)
E2E                  = PASS (12/12, TEST DATA ONLY)
Quality Gate         = PASS
```
**ห้ามสรุปเป็น "W3-C = PASS" เพราะ F-14 และ external channels ยัง BLOCKED**


