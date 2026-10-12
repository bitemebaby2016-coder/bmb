# BMB — OWNER LAUNCH CHECKLIST (2026-10-12)

> เอกสารสำหรับ **Owner อย่างเดียว** — เรียงตามลำดับที่ต้องทำ
> ทุกงานฝั่ง dev/automotion ที่ทำได้เอง "ทำเสร็จแล้ว" (ดู §0) — ที่เหลือในเอกสารนี้
> เป็นงานที่ **ต้องใช้สิทธิ์ production / ตัดสินใจทางธุรกิจ / อุปกรณ์จริง** เท่านั้น
>
> **ห้าม**วาง test password / payment credentials / ข้อมูลลูกค้าจริงในเอกสารหรือแชต

---

## 0. ปิดไปแล้วรอบ 2026-10-12 (ไม่ต้องทำอะไรเพิ่ม)

| หัวข้อ | หลักฐาน |
|---|---|
| Production เสิร์ฟ build ที่มี `5cc693a` แล้ว | `e2e/launch-verify.json` → L7 (`ERR_TIMEOUT` marker อยู่ใน bundle จริง) |
| **GPS granted → แสดง "ตำแหน่งจาก GPS" ได้จริงบน production** (เดิม FAIL) | L4 — badge `ตำแหน่งของฉัน: ตำแหน่งจาก GPS · 10.7050, 102.1350` · `e2e/screenshots/launch-03-gps-granted.png` |
| GPS denied → ไม่โกหกว่าเป็น GPS | L5 — badge `ตำแหน่งโดยประมาณ (IP)` |
| canonical `/track/:orderNumber` ไม่มี placeholder อีกต่อไป | L1 — canonical `https://biteme-baby.com/track/LV-20261012-01` |
| หน้า `/track` ของ guest มี phone gate (RPC ตาม migr 050) | L1b — `e2e/screenshots/launch-01b-track-guest-gate.png` |
| meta `/orders` `/reviews` ถูกเสิร์ฟจริง · `/reviews/:id` → `/reviews` · `/payment/:n` → `/checkout` | L2 / L3 |
| **แชตตอบจริงบน production ใน 4.1 วิ** (งบ 60 วิ, ไม่ค้าง) | L6 — คำตอบจริงจาก AI ไม่ใช่ fallback |
| `/payment/:orderNumber` title มีเลขออเดอร์ (ปิด P2) | `getPaymentMeta` + `PaymentSeo` + tests |
| `robots.txt` บล็อก `/payment/*` (กันเลขออเดอร์หลุดเข้า index) | `public/robots.txt` + test |
| เตรียม migration `121_grants_customers_select.sql` ไว้แล้ว (ยัง**ไม่** apply — รออนุมัติ) | `supabase/migrations/121_grants_customers_select.sql` |

รันซ้ำได้ตลอด: `node e2e/launchVerify.cjs` → `e2e/launch-verify.json` (อ่านอย่างเดียว ไม่ login ไม่สั่งของ)

---

## 1. [P0-1] Deploy Edge Function `phone-auto-login` rev ใหม่ — เร่งที่สุด

**ทำไม:** production ยังรัน rev เก่า → quick login ทุกครั้งเขียน `default_* = 0,0` (NULL ISLAND)
ลงตาราง `customers` ของลูกค้าจริง ทุกครั้งที่มีคนใช้ "เข้าสู่ระบบด่วน"

```bash
supabase secrets list          # ตรวจว่า key อยู่ — ดูเฉพาะ presence ห้ามพิมพ์ค่า
supabase functions list        # ตรวจ revision ที่ deploy อยู่ตอนนี้
supabase functions deploy phone-auto-login --project-ref ivkdfognyiwjcmrhcnwz
```

**หลัง deploy ต้องเช็ค:** quick login หนึ่งครั้ง (บัญชีทดสอบ) → ดูแถว `customers`
ต้อง**ไม่มี**ค่า `0,0` ใน `default_latitude/default_longitude`

---

## 2. [P0-2] ตัดสินใจความปลอดภัยของ quick login (Owner เท่านั้น)

ข้อเท็จจริงจาก source: **รู้เบอร์โทร = เข้าบัญชีได้** (ปัจจัยเดียว) · ไม่มี rate limit · ทุกครั้งสุ่มรหัสผ่านใหม่และ PUT ไปเปลี่ยนรหัสของผู้ใช้ email/password เดิม · `verify_jwt=false` + `CORS *`

เลือกอย่างใดอย่างหนึ่ง แล้ว**บันทึกเป็นลายลักษณ์อักษร**:
- **(ก) เพิ่ม OTP (SMS)** — ต้องมี SMS provider + แก้ EF → ทำหลังเปิดได้ถ้ายอมรับความเสี่ยงระยะสั้น
- **(ข) ยอมรับความเสี่ยง** — เหมาะถ้า quick login เป็นทางเลือกรองและลูกค้าส่วนใหญ่ใช้ email

> งานนี้ยังไม่ถูกทำในฝั่งโค้ดโดยเจตนา — ร้านเปิดขายแล้ว และการแก้ login path
> โดยไม่มีบัญชีทดสอบบน production มีความเสี่ยงสูงกว่าประโยชน์


---

## 3. [P0-3] Apply migration 121 (เปิดสิทธิ์อ่านตาราง `customers` ของตัวเอง)

ถ้าไม่ทำ: `restoreProfileAddress()` (เติมข้อความที่อยู่ให้ลูกค้าเก่าหลัง login)
จะ fail เงียบ — ลูกค้าเก่ายังต้องกรอกที่อยู่เองทุกครั้ง

```bash
supabase db push    # หรือ apply supabase/migrations/121_grants_customers_select.sql ผ่าน dashboard
```

**เช็คว่ามีจริง (read-only):**
```sql
select has_table_privilege('authenticated','public.customers','SELECT') as customers_select_ok;
-- ต้องขึ้น true
```
> RLS `customers_own_read` (migr 006) ยังกรองเฉพาะแถวของตัวเอง — GRANT นี้ไม่ทำให้คนอื่นอ่านข้อมูลลูกค้าได้

---

## 4. [P0-4] Test account / OTP — ปลดล็อก E2E matrix ที่ค้างอยู่

ต้องมีบัญชีทดสอบ (ห้ามใช้บัญชี/ข้อมูลลูกค้าจริง) เพื่อปลด:
matrix **#3, #5, #6, #7** + ครึ่ง checkout ของ **#1, #2, #4, #8, #9**

ส่งให้ AI ผ่านช่องทางที่เหมาะสม (ห้ามวางในแชตสาธารณะ/ไฟล์ที่ commit ได้)

---

## 5. [P0-5] Omise TEST end-to-end ผ่าน browser จริง

ขั้นตอนเต็มอยู่ใน handoff §12.3 · สรุปสั้น:
1. login บัญชีทดสอบ → สั่งเมนูจริง → checkout → จ่ายทุกสถานะ (สำเร็จ / pending / ยกเลิก / declined)
2. หลังแต่ละเคส เช็ค: `/payment/:orderNumber` · `/orders` · Admin → Orders/Payment exceptions ·
   Omise dashboard มี charge ครบ · **Admin → Errors ไม่มี webhook error ใหม่**
3. ส่งกลับ: screenshot + order numbers (ไม่ต้องส่งข้อมูลบัตร)

> **TEST ผ่าน ≠ LIVE พร้อม** — ห้ามเปิดรับเงินจริงจน onboarding/identity verification ของ Omise LIVE จบ

---

## 6. [P0-6] GPS / Delivery matrix บนมือถือจริง (Android + Chrome)

ตาราง 10 เคส + วิธี reset permission อยู่ใน handoff §8 · **เคส 1–4 ทำได้ทันที** (deploy แล้ว),
เคส 5–10 ต้องมี test account (ข้อ 4)

สิ่งที่ต้องส่งกลับ: เคส / วันที่ / PASS-FAIL / screenshot

---

## 7. [P1] Copy 7 วัน (`theater_daily_copy`)

login `/admin` → Settings → key กรอก `theater_daily_copy` (ระบบเติมเทมเพลต 7 วันให้)
→ ตรวจแก้ → **Save** → rotation ขึ้นหน้าร้านทันที (ห้ามให้ AI แก้ business settings แทน Owner)

---

## 8. [Owner decision] Facebook Login

โค้ด**ไม่มี** Facebook/OAuth login อยู่จริง (NOT IMPLEMENTED ไม่ใช่ "รอ test")
→ **แนะนำ: ตัดออกจาก scope เปิดร้าน** แล้วค่อยเพิ่มทีหลังพร้อม test user จริง

---

## 9. [Owner] จัดการ `bitemebaby-5f7.pages.dev`

build แช่แข็ง (bundle `/assets/index-DphkYgGq.js` — **ไม่มี** `ERR_TIMEOUT` = เก่ากว่า `5cc693a`)
→ เปลี่ยนจาก repo ไม่ได้ ต้องทำใน Cloudflare dashboard: **ลบ project นั้น** หรือตั้ง noindex/redirect ระดับ edge

---

## 10. [Owner optional] คืนพิกัดจาก server (ไม่ใช่แค่ข้อความที่อยู่)

ถ้าต้องการให้ระบบจำพิกัดเดิมข้ามอุปกรณ์: ต้องเพิ่ม **คอลัมน์ provenance** บน `customers`
ก่อน (Owner approve schema) แล้วค่อยขยาย `restoreProfileAddress`
เหตุผล: CR-2 ห้ามมอบ trust แบบพิสูจน์ไม่ได้ + EF เก่าเคยเขียน `0,0` ห้ามเอากลับมาใช้

---

## 11. คำสั่งตรวจสอบมาตรฐาน (ทุกครั้งก่อนถือว่า "พร้อม")

```powershell
npm run lint        # ต้อง = 0
npm test            # ต้องผ่านทั้งหมด
npm run build       # ต้อง = 0
node e2e/launchVerify.cjs   # production read-only — ทุก check ต้อง PASS
```
