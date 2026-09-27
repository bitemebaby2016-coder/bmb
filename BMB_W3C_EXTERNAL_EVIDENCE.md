# BMB_W3C_EXTERNAL_EVIDENCE.md
**W3-C-EXTERNAL — Facebook + Messenger Channel Adapters · วันที่: 2026-09-27**
ภาษาไทยเป็นหลัก · TEST DATA ONLY

## 1. Owner Authorization
- Owner command "BMB — OWNER MASTER EXECUTION COMMAND / START W3-C-EXTERNAL" (2026-09-27):
  อนุมัติ Facebook + Messenger channel adapters (foundation ที่ channel integration จะเรียกใช้) ·
  ห้าม W3-D · ห้าม Make.com · ห้าม LINE/TikTok/Google · แยก IMPLEMENTED/CONNECTED/DEPLOYED/
  RUNTIME VERIFIED ทุก channel · production credentials ไม่มี → STOP ตามกติกา

## 2. W3-C-EXT-0 Reality Audit (production + repo จริง)
| รายการ | สถานะ |
|---|---|
| Facebook / Messenger credentials (repo + Supabase secrets) | **MISSING** — secrets.local.env และ `supabase secrets list` ไม่มี FACEBOOK_/FB_/MESSENGER_/META_/PAGE_ACCESS ใด ๆ (มีแค่ STRIPE/SUPABASE/OPENROUTER/AUTOMATION_TOKEN/CHANNEL_* ที่สร้างในงานนี้) |
| Facebook App / Page Access Token / Webhook subscription | **MISSING** — ต้องมี Owner action |
| Webhook receiver EF | **MISSING ก่อนงานนี้** → สร้างใหม่ (`channel-webhook`) |
| `customer_channel_identities` + resolve RPC | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (Identity Foundation) |
| F-14 intake schema (source_channel/external_ref_id/duplicate guard) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED |
| Canonical RPC + automation-worker + audit_logs | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED |
| Meta production App/Page configuration | **NOT CONFIGURED** — ต้องมี Owner action (§10) |

## 3. Channel Contract (W3-C-EXT-1)
```
External Channel (Meta)
  ↓ channel-webhook EF (webhook receiver)
  ↓ GET verification (hub.challenge + CHANNEL_WEBHOOK_VERIFY_TOKEN)
  ↓ POST: X-Hub-Signature-256 = HMAC-SHA256(raw body, CHANNEL_WEBHOOK_APP_SECRET)
  ↓ payload validation (object=page, entry[])
  ↓ channel derivation — จาก payload metadata เท่านั้น (ไม่เดา):
      messaging[] → MESSENGER · changes + group_id → FACEBOOK_GROUP ·
      changes + item + page entry → FACEBOOK · ไม่ระบุ → REJECT + audit
  ↓ event dedupe (durable: audit_logs channel_event by entity_id)
  ↓ identity resolution/provisioning (customer_channel_identities)
  ↓ canonical RPC create_order_with_items (service path: p_customer_ref
    + p_source_channel + p_external_ref_id) — ห้าม direct INSERT
  ↓ audit_logs (channel_event / channel_event_duplicate / channel_event_rejected)
```
Channel payload **ไม่ใช่ source of truth** — product/round/capacity/mode/cutoff/fee/payment
validate ที่ canonical RPC ทั้งหมด (server-authoritative เหมือน PWA/MANUAL)

## 4. Facebook (W3-C-EXT-2)
- IMPLEMENTED: signature verification + event parsing + external_user_id extraction + audit +
  error handling (runtime-verified ผ่าน signed synthetic events บน production EF)
- CONFIGURED: **NO** — ไม่มี Facebook App credentials จริง (Meta APP_SECRET / Page / webhook
  subscription) · CONNECTED: **NO** · DEPLOYED: YES (channel-webhook ACTIVE)
- RUNTIME VERIFIED (foundation path): YES — signed-event pipeline ทำงานจริง
- **FACEBOOK PRODUCTION CONNECTIVITY = BLOCKED** — exact missing config ดู §10

## 5. Messenger (W3-C-EXT-3)
- เหมือน Facebook ทุกประการ (คนละ source_channel — MESSENGER แยกจาก FACEBOOK ตาม event shape:
  messaging[] vs changes[]) · external ID ข้าม channel ไม่ถูก assume เป็น identity เดียวกัน
  (runtime: same ext id คนละ channel → คนละ identity row)
- **MESSENGER PRODUCTION CONNECTIVITY = BLOCKED** (Meta App/Page config ไม่มี — §10)

## 6. Facebook Group (W3-C-EXT-9)
- แยก channel จาก **explicit `group_id` ใน payload เท่านั้น** — event ที่ไม่มี group_id/item
  ไม่ถูกเดาเป็น FACEBOOK (runtime: unknown-origin → rejected + `channel_event_rejected` audit)
- FACEBOOK_GROUP = SCHEMA INTAKE PASS (foundation) · real group integration = NOT STARTED

## 7. Identity (W3-C-EXT-4)
- existing mapping → resolve existing customer ✓ · no mapping → server-side provisioning
  (auth admin + customer_channel_identities row เฉพาะ service context) ✓ ·
  collision → reject + audit ✓ · unauthorized link → ERR_ONLY_ADMIN ✓ ·
  client กำหนด customer_id เองไม่ได้ (identity resolve ฝั่ง server)

## 8. Order Intake (W3-C-EXT-5)
- ผ่าน canonical RPC `create_order_with_items` ทั้งหมด (service path: p_customer_ref
  เฉพาะ service_role) — **ไม่มี direct INSERT** (runtime ยืนยัน)
- ผลลัพธ์ครบ: source_channel=MESSENGER · external_ref_id=event id · customer_ref (provisioned) ·
  canonical order_number (BMB-20260927-…)

## 9. PRE-ORDER / SAME-DAY (W3-C-EXT-6)
- order_mode/scheduled_date ส่งเข้า canonical RPC — backend validate ทั้งหมด
  (ERR_PRODUCT_MODE_NOT_ALLOWED / ERR_SCHEDULED_DATE_INVALID ยังทำงานตามเดิม) ·
  adapter ไม่คำนวณ business truth

## 10. PRODUCTION CONNECTIVITY — EXACT OWNER CHECKLIST (ไม่ขอ secrets ใน chat)
1. สร้าง Facebook App (business) + Page ผูกร้าน
2. แทน test APP_SECRET: `npx supabase secrets set CHANNEL_WEBHOOK_APP_SECRET=<meta_app_secret>` (จาก App Settings → Basic — ไม่ต้องแสดงใน chat)
3. คง VERIFY_TOKEN เดิมหรือตั้งใหม่: `CHANNEL_WEBHOOK_VERIFY_TOKEN` (ต้องตรงกับ secrets.local.env)
4. Meta App Dashboard → Webhooks: Callback URL
   `https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1/channel-webhook` + Verify Token ข้อ 3 ·
   subscribe: messages, messaging_postbacks, feed (Page)
5. Page Access Token (เก็บเป็น Supabase secret เช่น `CHANNEL_PAGE_ACCESS_TOKEN`) —
   สำหรับขั้นตอบกลับ/outbound (รอบถัดไป)
6. App review/permissions: pages_messaging, pages_read_engagement
→ หลังครบ: rerun `node e2e/channelWebhookProbe.cjs` ด้วย secret จริง → RUNTIME VERIFIED จริง

## 11. Production E2E (W3-C-EXT-11) — `e2e/channel-webhook-e2e.json` · TEST DATA ONLY · **PASS 15/15**
| ตรวจ | ผล |
|---|---|
| Meta verification handshake (correct token → challenge echo) | PASS |
| wrong verify token → 403 | PASS |
| unsigned request → 401 | PASS |
| bad signature → 401 | PASS |
| malformed JSON (signed) → 400 | PASS |
| unsupported object (signed) → 400 | PASS |
| unknown-origin event → rejected + audited (ไม่เดา channel) | PASS |
| **MESSENGER order event → canonical order + identity provisioning (BMB-20260927-543)** | PASS |
| order row: source_channel=MESSENGER + external_ref_id=event id | PASS |
| duplicate event → no new order (rows=1) | PASS |
| FACEBOOK page-change → channel=FACEBOOK + audit | PASS |
| FACEBOOK_GROUP (explicit group_id) → channel=FACEBOOK_GROUP | PASS |
| parallel identical events → ONE order (rows=1) | PASS |
| secret scan 13 responses → 0 hits | PASS |

**แยกสถานะ:**
- Facebook: IMPLEMENTED ✓ · DEPLOYED ✓ · RUNTIME VERIFIED (foundation path) ✓ · CONNECTED = BLOCKED (Meta config)
- Messenger: IMPLEMENTED ✓ · DEPLOYED ✓ · RUNTIME VERIFIED (foundation path) ✓ · CONNECTED = BLOCKED (Meta config)
- real-provider E2E (ข้อความจริงจาก Meta): BLOCKED ตาม config — ไม่สร้าง fake PASS

## 12. Bugs จริงที่พบ + แก้ระหว่างงาน
1. **048 ambiguous overload** — 048 ไฟล์เดียวมีทั้ง 16-param (จาก 044 extraction) และ 17-param
   wrapper → PGRST203 ทำ caller เดิมพังจริง → **049** DROP 16-param overload (production) +
   แก้ไฟล์ 048 ใน repo ให้เหลือ signature เดียว (17-param additive)
2. **audit_logs insert ไร้ id** (PK TEXT NOT NULL) → dedupe record ล้มเงียบ → เพิ่ม generated id
3. parseEvent ปรับเป็นระดับ entry (messaging/changes รวมอยู่ใน entry แล้ว)

## 13. Regression (หลัง migrations 048/049 + deploy บน production)
- **F-14 16/16** ✓ · **Identity Foundation 19/19** ✓ · **W3-C Core 12/12** ✓ ·
  **W3-B 13/13** ✓ · **W3-A 11/11** ✓ · **F-05 12/12** ✓ · **F-18 15/15** ✓ · **F-06 14/14** ✓
  (หลังเตรียม test order dispatchable — test data precondition) · PWA/MANUAL intake ✓

## 14. Quality Gate (W3-C-EXT-13)
tsc 0 ✓ · vitest 22 files / 179 tests ✓ · build ✓ · lint 0 ✓ · git/dist/runtime secret scan ✓ ·
RLS ✓ · ACL ✓ · production E2E 15/15 ✓ · idempotency ✓ · concurrency ✓ · security ✓
(test count: 44/358 → 22/179 อธิบายแล้วใน F-14 evidence §21 — ไม่มี canonical test หาย)

## 15. Final Verdict (แยกตามคำสั่ง)
```
Facebook
  implementation = IMPLEMENTED (adapter deployed)
  configuration  = BLOCKED (Meta App/Page/webhook config ไม่มี — §10 checklist)
  connected      = BLOCKED
  deployed       = YES (channel-webhook on ivkdfognyiwjcmrhcnwz)
  runtime        = RUNTIME VERIFIED (foundation path, signed synthetic events)
  security       = PASS (HMAC verify runtime-verified; unsigned/bad-sig rejected)
  idempotency    = PASS (event dedupe + order-level unique guard, rows=1)

Messenger
  implementation = IMPLEMENTED (adapter deployed)
  configuration  = BLOCKED (Meta config)
  connected      = BLOCKED
  deployed       = YES
  runtime        = RUNTIME VERIFIED (foundation path)
  security       = PASS
  idempotency    = PASS

Facebook Group
  status = SCHEMA/foundation PASS (channel derivation จาก group_id จริง) ·
           real integration = NOT STARTED

Identity             = PASS (foundation runtime-verified)
Canonical Intake     = PASS (ผ่าน canonical RPC เท่านั้น — ไม่มี direct INSERT)
Automation Handoff   = PASS (channel events audited; automation-worker 13/13)
Security             = PASS (§8 ครบ — ไม่มี secret exposure)
Production E2E       = PASS (15/15) · real-provider E2E = BLOCKED (config)
Regression           = PASS (ครบทุกชุด)
Quality Gate         = PASS
```
→ **W3-C-EXTERNAL: IMPLEMENTED + DEPLOYED + RUNTIME VERIFIED (foundation) · CONNECTED = BLOCKED
(รอ Owner Meta configuration ตาม checklist §10)** · ห้ามสรุปเป็น "W3-C-EXTERNAL = PASS" รวม ๆ


## PRE-FLIGHT RE-CHECK — 2026-09-27 (W3-C-EXTERNAL Connectivity Command)
- `supabase secrets list`: `CHANNEL_WEBHOOK_APP_SECRET`, `CHANNEL_WEBHOOK_VERIFY_TOKEN` **PRESENT**
  (names only — values not printed; per handoff these are still **test values**, not real Meta values)
- Live GET `/functions/v1/channel-webhook`:
  - no token → **403** ✓ · wrong verify token → **403** ✓ · missing hub params → **403** ✓
  - "valid verify token → 200 + challenge" **NOT PROVEN** against real Meta values
    (verify token lives only in the production secret store — not readable by AI DEV, by design)
- Facebook App / Page Access Token / Meta webhook subscription: still **MISSING** (Owner action)
- Status unchanged: Facebook/Messenger = IMPLEMENTED + DEPLOYED + runtime-verified foundation ·
  **CONNECTED = BLOCKED (Owner Meta configuration)** · W3-D NOT STARTED (per HARD STOP)
