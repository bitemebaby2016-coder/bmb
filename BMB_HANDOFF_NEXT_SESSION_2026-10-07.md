# BMB HANDOFF — เซสชันถัดไป (2026-10-07 หลังรอบ 7: SMS THSMS + G10 verification + defect 118)

> อ่านก่อนเริ่มทำอะไรทุกครั้ง · ตัวตนต่อจากเซสชัน G10-verification+SMS (HEAD = commit รอบนี้ @ `origin/main`)
> Master status อยู่ที่ `BMB_PRODUCTION_MASTER_STATUS.md` (§14 = changelog จริง — อัปเดตทุกรอบ)
> อ่านคู่: `BMB_G10_FINAL_REPORT.md` (สถานะ closure) + `BMB_G10_DEFECT_117_FC_ROLLBACK.md` (defect หลัก)

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
10. `.env.local` มี `SUPABASE_ACCESS_TOKEN` ซ้ำ 2 บรรทัด — script ต้อง try token ย้อนหลัง (reverse) เสมอ (rule 10 เดิม)

## 2. สถานะ ณ ปิดเซสชัน (2026-10-07 รอบ 7)

**DONE รอบนี้:**
- **W-2.3 SMS = RUNTIME VERIFIED (THSMS)** — `THSMS_API_KEY`/`THSMS_SENDER_NAME` (Owner ใส่เอง) → secrets ตั้ง (HTTP 201) · THSMS API ทางการ `POST https://thsms.com/api/send-sms` + Bearer + `{msisdn:[],message,sender}` · EF แก้ body format + import `_shared/sms.ts` + normalize `66xx→0xx` · deploy ผ่าน CLI · **`w23SmsProbe` 3/3** (ส่งจริง 200, `to_masked=090***1544`, credit 10.00 เหลือ 9.50) — **เหลือ Owner ยืนยันเข้าเครื่อง**
- **Page token ใหม่ set secret แล้ว** — USER token app#2 (1737887467512190) scope มี `pages_messaging` · เรียกเพจ BmB 200 · `metaTokenScopeCheck.cjs` (ใหม่) — **⚠️ หมดอายุ 2026-10-07 01:00 UTC → ต้อง exchange ใหม่ด่วน**
- **G10 verification** — `g10ProdSnapshot.cjs` + `g10-prod-snapshot.json` (web/EF/secrets/DB read-only ครบ) · evidence pack = `BMB_G10_FINAL_REPORT.md` (**NOT CLOSED**)
- **DEFECT พบจริง:** migration 117 clobber FC gates 112/114 → **`118_restore_fc_gates_after_117.sql` authored + `m118Verify` 16/16 — PENDING Owner, ห้าม apply**
- Probe แก้: `intakeDriftProbe.cjs` (reverse token ตาม rule 10 — เดิม 401)
- Gates ปิดรอบ: **TSC 0 / LINT 0 / VITEST 527/527 / BUILD 0**

## 3. ค้างรอ Owner (HARD STOP — ทำต่อได้ทันทีเมื่อของมา)

| รายการ | รออะไร | ทำอะไรต่อเมื่อได้ |
|---|---|---|
| **Migration 118** | Owner อนุมัติ apply (ลายลักษณ์อักษร) | apply ผ่าน Management API (pattern 117) → `intakeDriftProbe` (18-param OK) → `m118BuildFromLive` (live==file) → **`fcVerify114` + `fcProdVerify` ต้อง ALL PASS** → อัปเดต §14 + defect report |
| **Page token** | exchange ก่อน 2026-10-07 01:00 UTC | `node e2e/metaTokenExchange.cjs exchange` → set secret (w23SetSmsSecrets) → `metaTokenScopeCheck` ต้อง BMB_PAGE 200 |
| SMS เข้าเครื่อง | Owner ยืนยันรับ `[W-2.3 TEST]` ที่ `090***1544` | ปิด W-2.3 ใน master status |
| Stripe LIVE | account review ผ่าน (Paused soon / 2 tasks In review) | live webhook + acceptance (W-2.1/W-2.2) |
| Push เครื่องจริง | Owner ทดสอบ device | ยืนยัน subscription → ปิด |
| G4 Meta real event | Meta ปลดล็อก | add Tester → `g4CheckRealEvents` |
| Asset Registry / brand flag / E2E admin session | Owner decision (เดิม) | ตาม handoff เดิม |

## 4. งานที่ทำได้โดยไม่ติด Owner

- **ปิด G10 เมื่อข้อค้างบนหมด** — รัน verification ซ้ำทั้งชุด + อัปเดต `BMB_G10_FINAL_REPORT.md` → HARD STOP รอ Owner sign-off (AI ห้ามประกาศ PASS เอง)
- งานค้างเล็กน้อย: ตัดสินใจ untracked 4 ไฟล์ (Dockerfile/docker-compose/.dockerignore/openapi-paths) — Docker deploy ไม่เกี่ยวกับ BMB prod = Cloudflare Pages
- ⚠️ ระหว่างยังไม่ apply 118: **ห้ามมั่นใจว่า admin config (radius/zone/bite_drive) มีผลที่ order RPC** — ยัง hardcode 5.00 อยู่

## 5. ข้อมูลอ้างอิงเร็ว

- Repo: `D:\A PROJECT\Bite Me Baby` (mirror: `...\workspaces\chat\bmb`) · branch `main`
- Supabase ref: `ivkdfognyiwjcmrhcnwz` · secrets API ห้ามชื่อขึ้นต้น `SUPABASE_` · `/database/query` = 201
- THSMS: `GET https://thsms.com/api/me` = check credit (มี 10.00) · docs ตัวอย่าง = gist `saloveby-lab/2df9c655…` (send) + `9b854f55…` (credit)
- EF deploy ใหม่: `npx supabase functions deploy <fn> --project-ref ivkdfognyiwjcmrhcnwz` (ตั้ง `SUPABASE_ACCESS_TOKEN` จาก `.env.local` — บรรทัดหลัง)
- Probes ใหม่รอบ 7: `g10ProdSnapshot` · `metaTokenScopeCheck` · `w23SetSmsSecrets` · `w23SmsProbe` · `deploySmsSend` · `m118BuildFromLive` · `m118Verify`
- คู่มือแอดมิน: `docs/03_ADMIN_USER_GUIDE.md`

## 6. เปิดเซสชันใหม่ด้วยข้อความนี้

"อ่าน BMB_HANDOFF_NEXT_SESSION_2026-10-07.md ใน repo ก่อน — ทำงานต่อจากสถานะล่าสุดใน BMB_PRODUCTION_MASTER_STATUS.md §14 ตามกฎทุกข้อ อย่าทำซ้ำของที่ DONE"
