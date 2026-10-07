# BMB HANDOFF — เซสชันถัดไป (2026-10-07 · ปิดรอบ 8j: SMS ผ่านจริง + Admin แก้ครบ)

> อ่านก่อนเริ่มทำอะไรทุกครั้ง · HEAD = commit รอบนี้ @ `origin/main` (worktree clean)
> Master status อยู่ที่ `BMB_PRODUCTION_MASTER_STATUS.md` (§14 = changelog จริง — อัปเดตทุกรอบ)
> อ่านคู่: `BMB_ADMIN_AUDIT_2026-10-07.md` (admin fix รอบ 8j) + `BMB_W23_SMS_DELIVERY_DIAGNOSTIC.md` (SMS)

## 0. สถานะปิดเซสชันล่าสุด (2026-10-07 · รอบ 8g–8j) — อ่านก่อน §1

**ผ่านจริง (Owner ยืนยัน):**
- ✅ **W-2.3 SMS = CONFIRMED** — ย้าย provider `thsms.com` → **`thsms.org`** (sender `SMSOTP` · `message_type=standard` = **1 เครดิต/ข้อความ** · `express`=2 · `superfast`=3) · **Owner ยืนยันข้อความเข้าทั้ง 3 เบอร์ (082/094/081)** · EF `sms-send` deployed (provider switch `thsms_org` · secret 6/6) · `w23SmsProbe` 3/3
- ✅ **Admin: เพิ่มรูปเมนูได้จริง (Owner ยืนยัน)** — แก้ด้วย **Migration 119 = APPLIED + VERIFIED 6/6** (storage policy ใช้ `bucket_id='bmb-images'` แทน subquery `storage.buckets` ที่ RLS ซ่อน → 42501) · **ADMIN_CRUD 20/20 PASS** (categories · products(+รูป) · menu_sections · delivery_rounds · promotions · media_assets · storage upload/publicUrl) · `createDeliveryRound` ใส่ `branch_id` แล้ว (RLS `is_branch_admin`) · history migration **119/119**
- ✅ Gates ปิดรอบ: **TSC 0 · LINT 0 · VITEST 49 files/527 · BUILD 0** · worktree clean (Dockerfile/docker-compose/.dockerignore commit แล้ว)

**ยังไม่ได้ลอง (Owner บอกเอง):**
- ⏳ **ขนส่ง (delivery rounds) ใน UI** — โค้ดแก้แล้ว (branch_id) · probe ผ่าน insert/update/delete · รอ Owner ลองจริงใน `/admin/*`

**สำคัญสำหรับแชทหน้า:**
- ⚠️ `search_codebase` สแกน workspace `chat\bmb` (สำเนาเก่า) **ไม่ใช่** repo จริง `D:\A PROJECT\Bite Me Baby` → ใช้ `run_commands` + `Get-Content`/`Select-String` กับ D: เสมอ
- `.env.local`: token เดี่ยวถูกต้อง (`bmb-dev-2026-10` = `sbp_fceb…1936` exp **05 Nov 2026**) — ตัวเก่า `sbp_fcf…` comment ปิดแล้ว
- THSMS ใหม่: base `https://api.thsms.org/v1` · auth **`X-API-Key`** · `POST /sms/send` `{sender_name,recipient,message,message_type}` · `GET /credits`
- Probes ใหม่รอบ 8g–8j: `thsmsOrgProbe` · `adminDbDiag` · `adminDbDiag2` · `dbq` · `adminMediaProbe` · `adminCrudProbe` · `m119ApplyVerify`

## 1. กฎการทำงาน (ห้ามลืม — จาก BMB_G9_CONTRACT.md §2 spine + กติกาสะสม)

1. **HARD STOP รอ Owner** ทุกงานที่ต้องใช้ Owner input: อนุมัติ apply 118 · page token ใหม่ · ยืนยัน SMS เข้าเครื่อง · Stripe · push device · Asset Registry · brand routing flag — ห้ามทำแทน Owner
2. **Production mutation ต้องมี Owner อนุมัติเป็นลายลักษณ์** ก่อนรัน (write ลง prod DB, deploy EF, rotate secret) — ยกเว้นรอบที่ Owner สั่งตรง ๆ (เช่นรอบ 7: SMS + page token)
3. **Gates ก่อน commit เสมอ:** `npx tsc --noEmit` = 0 · `npm run lint` = 0 · `npm test -- --run` = 527+/527+ · `npm run build` = exit 0
4. **Commit + push `origin/main` ทุกจบงาน** — ห้ามปล่อย worktree ค้าง; รายงาน commit hash ใน changelog ด้วย
5. **อ่านสถานะก่อนเสมอ** — งานที่เคย DONE ห้ามทำซ้ำ/reimplement (เช็ค §14 ก่อนเริ่ม)
6. **ห้ามแตะ containers ของ selfprint-v3-react** — งาน DB ใช้ temp container จากภายนอกเท่านั้น
7. **Secrets/passwords ห้าม print/commit** — `.dbpw.tmp` ลบทิ้ง · `backups/` gitignored
8. แก้ prod DB: ผ่าน migration + `supabase db push` (history reconcile แล้ว — อย่า `--include-all`)
9. EF deploy: **Management API multipart ใช้ไม่ได้กับ multi-file function (400)** → ใช้ `npx supabase functions deploy <name> --project-ref ivkdfognyiwjcmrhcnwz` (มี example: `e2e/deploySmsSend.cjs`)
10. `.env.local` เคยมี `SUPABASE_ACCESS_TOKEN` ซ้ำ 2 บรรทัด (ตัวเก่า comment ปิดแล้ว 2026-10-07) — script ควร try token ย้อนหลัง (reverse) เสมอ

## 2. สถานะ ณ ปิดเซสชัน (2026-10-07 รอบ 8)

**DONE รอบ 8 (Owner อนุมัติครบ 3 ข้อค้างรอบ 7):**
- ✅ **Migration 118 = APPLIED** — `fcApply118` **APPLY118_OK** → `fcVerify114` **25/25** · `fcProdVerify` **9/9** (`no_active_orders`=0) · `intakeDriftProbe` **18-param OK** · `fcProdVerify` FC gates (`rpc_fc1_fc5_live`) กลับมาผ่าน · history **118/118** (`migHistoryReconcile --write`)
  - ⚠️ **บทเรียน apply:** รอบแรก apply ล้ม `syntax error 42601 at REVOKE` LINE 280 เพราะ `pg_get_functiondef()` ไม่รวม `;` → build script tail ต้องขึ้นต้นด้วย `;` (แก้ใน `m118BuildFromLive.cjs` แล้ว) · DB transaction rollback อัตโนมัติ (prod ไม่เสียหาย — ยืนยัน `m118StateProbe`) · `m118Verify` เป็น textual เท่านั้น ไม่จับ syntax ระดับ SQL
- ✅ **Meta page token = LONG-LIVED** — `node e2e/metaPageTokenExtend.cjs` (`fb_exchange_token` ด้วย page token) → token ใหม่ type=PAGE **expires_at=0 (NEVER)** · scope มี `pages_messaging` · `/me`+เพจ 200 · set secret (201) · `publishWorkerProbe` **5/5** · **(หมายเหตุ: user token ใน `.env.local` หมดอายุแล้ว → `metaTokenExchange` ล้ม step1 code190/467 — ไม่ใช้ ไม่ overwrite)
- ✅ **SMS ไปเบอร์ Owner `0942649269`** — `node e2e/w23SmsSendOwner.cjs` (ตั้ง profiles.phone บัญชีทดสอบ `ae12e10b` ชั่วคราว → ส่ง → คืนค่าเดิมเสมอใน `finally`) → **HTTP 200 · `ok:true` · `provider_status:200` · `to_masked=094***9269`** · **เหลือ Owner ยืนยันเข้าเครื่องจริง**
- ⚠️ **รอบ 8b/8c (Owner แจ้ง SMS ไม่ถึง):** ส่งซ้ำไป `082***8546` (Owner ยืนยัน 082+094 ถูกต้องทั้งคู่แต่ไม่ได้รับ) ทั้ง EF (`w23SmsSendOwner 0826378546` = HTTP 200) และ THSMS ตรง (`thsmsDirectProbe`) · ยืนยันรูปแบบทางการจาก gist หน้า docs = `msisdn` นำหน้าด้วย 0 → **EF ส่งถูกต้องแล้ว** · **ข้อความสั้น ≤70 ตัวอักษร → `credit_usage:1`** (ยาว ~90 → 2) · **THSMS wallet credit หมด (0.00)** → EF = HTTP 502/`provider_status:422` · **ปลายเหตุต้องสงสัย: `SMS_SENDER_NAME="Direct SMS"` มีเว้นวรรค** (Sender ID ปกติห้ามเว้นวรรค) → **รอบ 8d: Owner ยืนยัน `Direct SMS` = sender Valid (สาธารณะ/อนุญาตใช้งาน/ใช้งาน) + เติมเครดิต 502.00 → ส่งซ้ำ EF ไป 082/094 = HTTP 200 → เหลือ Owner ยืนยันรับ**
- Gates ปิดรอบ: **TSC 0 / LINT 0 / VITEST 527/527 / BUILD 0**

**จากรอบ 7 (ยังจริง):** W-2.3 SMS code (THSMS) deployed ผ่าน CLI · `_shared/sms` normalize `66xx→0xx` · DEFECT 117 clobber FC gates (ตอนนี้ปิดด้วย 118 แล้ว) · G10 evidence pack = `BMB_G10_FINAL_REPORT.md` (**NOT CLOSED**)

## 3. ค้างรอ Owner (HARD STOP — ทำต่อได้ทันทีเมื่อของมา)

| รายการ | รออะไร | ทำอะไรต่อเมื่อได้ |
|---|---|---|
| ✅ **Migration 118** | DONE รอบ 8 | APPLIED + VERIFIED — `fcVerify114` 25/25 · `fcProdVerify` 9/9 · intake 18-param OK · history 118/118 |
| ✅ **Page token** | DONE รอบ 8 | exchange → **LONG-LIVED (expires=NEVER)** · set secret · `publishWorkerProbe` 5/5 |
| **SMS เข้าเครื่อง** | Owner ยืนยันรับ `[W-2.3 TEST]` ที่ **`082***8546`** (หรือ `094***9269`) | DONE — เติมเครดิตแล้ว (502.00) · Sender `Direct SMS` ยืนยัน Valid · ส่งซ้ำ HTTP 200 ทั้ง 082/094 → **Owner ยืนยันรับ → ปิด W-2.3** |
| Stripe LIVE | account review ผ่าน (Paused soon / 2 tasks In review) | live webhook + acceptance (W-2.1/W-2.2) |
| Push เครื่องจริง | Owner ทดสอบ device | ยืนยัน subscription → ปิด |
| G4 Meta real event | Meta ปลดล็อก | add Tester → `g4CheckRealEvents` |
| Asset Registry / brand flag / E2E admin session | Owner decision (เดิม) | ตาม handoff เดิม |

## 4. งานที่ทำได้โดยไม่ติด Owner

- **ปิด G10 เมื่อข้อค้างบนหมด** — รัน verification ซ้ำทั้งชุด + อัปเดต `BMB_G10_FINAL_REPORT.md` → HARD STOP รอ Owner sign-off (AI ห้ามประกาศ PASS เอง)
- งานค้างเล็กน้อย: untracked 4 ไฟล์ — ✅ **จัดการแล้วรอบ 8j**: `openapi-paths.txt` (ว่าง 0 bytes) ลบทิ้ง · `Dockerfile`/`docker-compose.yml`/`.dockerignore` commit แล้ว (worktree clean)
- ✅ **118 apply แล้ว** — admin config (radius/zone/bite_drive/external) **มีผลที่ order RPC จริง** (FC gates บังคับที่ `create_order_with_items` แล้ว)

## 5. ข้อมูลอ้างอิงเร็ว

- Repo: `D:\A PROJECT\Bite Me Baby` (mirror: `...\workspaces\chat\bmb`) · branch `main`
- Supabase ref: `ivkdfognyiwjcmrhcnwz` · secrets API ห้ามชื่อขึ้นต้น `SUPABASE_` · `/database/query` = 201
- THSMS: `GET https://thsms.com/api/me` = check credit (มี 10.00) · docs ตัวอย่าง = gist `saloveby-lab/2df9c655…` (send) + `9b854f55…` (credit)
- EF deploy ใหม่: `npx supabase functions deploy <fn> --project-ref ivkdfognyiwjcmrhcnwz` (ตั้ง `SUPABASE_ACCESS_TOKEN` จาก `.env.local` — บรรทัดหลัง)
- Probes ใหม่รอบ 7: `g10ProdSnapshot` · `metaTokenScopeCheck` · `w23SetSmsSecrets` · `w23SmsProbe` · `deploySmsSend` · `m118BuildFromLive` · `m118Verify`
- Probes ใหม่รอบ 8: `fcApply118` (apply 118) · `m118StateProbe` (เช็ค prod def) · `metaTokenDiag` (debug token metadata) · `metaPageTokenExtend` (exchange page token → long-lived) · `migHistory` · `migHistoryReconcile` (มีอยู่เดิม) · `smsPhoneLookup` · `whoIs` · `w23SmsSendOwner` (ส่ง SMS ไปเบอร์ Owner)
- ⚠️ **`.env.local` META_USER_ACCESS_TOKEN หมดอายุแล้ว** — ถ้าต้อง exchange user token ใหม่ Owner ต้อง generate จาก Graph API Explorer ใส่ env
- 🔎 **SMS ไม่ถึงเครื่อง (W-2.3): วิเคราะห์ครบใน `BMB_W23_SMS_DELIVERY_DIAGNOSTIC.md`** — ✅ **RESOLVED (2026-10-07): ย้าย provider → `thsms.org` (sender `SMSOTP`) · Owner ยืนยัน SMS เข้าเครื่องจริงทั้ง 3 เบอร์** · root cause เดิม: ชี้ผิดแพลตฟอร์ม (`thsms.com`) ทั้งที่คีย์/บัญชีเป็นของ `thsms.org`
- คู่มือแอดมิน: `docs/03_ADMIN_USER_GUIDE.md`

## 6. เปิดเซสชันใหม่ด้วยข้อความนี้

"อ่าน BMB_HANDOFF_NEXT_SESSION_2026-10-07.md ใน repo ก่อน — ทำงานต่อจากสถานะล่าสุดใน BMB_PRODUCTION_MASTER_STATUS.md §14 ตามกฎทุกข้อ อย่าทำซ้ำของที่ DONE"
