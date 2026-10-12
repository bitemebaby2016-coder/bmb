# BMB — OWNER CHECKLIST (อัปเดต 2026-10-12 รอบ P0-interim + P1)

> เอกสารสำหรับ **Owner** — เรียงตามลำดับที่ต้องทำ
> เอกสารนี้ **เขียนทับ** เวอร์ชันก่อน (ไม่ต่อท้าย) — ใช้ฉบับนี้ฉบับเดียว
>
> **ห้าม**วาง test password / payment credentials / ข้อมูลลูกค้าจริงในเอกสารหรือแชต

---

## 0. ปิดแล้ว (มีหลักฐาน production/โค้ดจริง)

| หัวข้อ | หลักฐาน |
|---|---|
| production เสิร์ฟ build `5cc693a` แล้ว | `e2e/launch-verify.json` L7 |
| GPS granted → "ตำแหน่งจาก GPS" บน production | L4 PASS (`10.7050, 102.1350`) |
| canonical `/track/:orderNumber` ไม่มี placeholder | L1 PASS |
| แชต production ตอบจริง 4.1 วิ | L6 PASS |
| **migration 121 (GRANT customers) apply แล้ว** | Owner ยืนยัน + screenshot SQL Editor |
| **SF-02 — ไม่มีลูกค้าจริงรายใดถูกเขียนพิกัด 0,0** | production query: `null_island_exact = 0 จาก 37` |
| **P1 — กู้คืนรหัสผ่าน** (`/login` → ลืมรหัสผ่าน → `/reset-password`) | `src/lib/authRecovery.ts` + `ResetPasswordPage` + 16 tests |
| **P1 — `/orders` เป็น ProtectedRoute** (SF-08) | `App.tsx` |
| **P0-interim — rate limit บน `phone-auto-login`** (5/15นาทีต่อเบอร์ · 20/ชม.ต่อ IP) | `rateLimit.ts` pure module + EF wiring + tests |
| gates รอบนี้ | lint **0** · vitest **74 ไฟล์ / 802 tests** · build **0** |

รันซ้ำ: `node e2e/launchVerify.cjs` (production read-only) · `npm run lint && npm test && npm run build`

---

## 1. ข้อเท็จจริงใหม่ที่ **แก้ไขรายงานเดิม**

### 1.1 NULL ISLAND ไม่เกิดขึ้นจริง (SF-02 ปิด)

> แฮนออฟเดิมกล่าวอ้างว่า "production EF rev เก่า → quick login เขียน `default_*=0,0` ทุกครั้ง"
> **ข้อมูลจริงไม่รองรับข้อนี้** — แถว `0,0` = **0 จาก 37** และบัญชี phone-keyed 33 แถว **มีพิกัดจริงครบ**

| ตัวเลข production | ค่า |
|---|---|
| `total_customers` | 37 |
| `null_island_exact` | **0** |
| `phone_keyed_without_coords` | **0** |
| `email_keyed_without_coords` | 4 |
| `no_user_id` (ไม่มี user_id) | **3** |

⇒ งาน deploy EF rev ใหม่ **ลดระดับจาก data-corruption emergency เหลือเป็นงาน hardening ตามปกติ**

### 1.2 SF-01 ต้องแก้ประเภท — ไม่ใช่ "เปลี่ยนรหัสผ่านบัญชีอีเมลเดิม"

โค้ดจริง (`phone-auto-login/index.ts:155,199`) จับคู่บัญชีด้วย **synthetic email `<phone>@phone.bmb.local` เท่านั้น**
→ ลูกค้าที่สมัครด้วยอีเมลจริง **จะไม่ถูกจับ** แต่จะเกิด **บัญชีซ้ำ** (account splitting)

**ความเสี่ยงจริงที่ยังเป็น Critical:**
- **ใครก็ตามที่รู้เบอร์โทร สามารถเข้าบัญชี phone-keyed ของเบอร์นั้นได้ทันที** (ปัจจัยเดียว)
- มีลูกค้าจริง **33 ราย (89%)** ใช้บัญชีแบบนี้
- **ห้ามลบ Quick Login ทันที** — ต้องมี OTP + แผนรองรับลูกค้าเดิม + Rollback

---

## 2. Owner Decision Register (บันทึกตามคำสั่ง 2026-10-12)

| # | ประเด็น | คำตัดสิน |
|---|---|---|
| OD-1 | Quick Login | ไม่ยอมรับความเสี่ยงเดิม · ต้องใช้ OTP ก่อนอนุญาตเข้าบัญชีด้วยเบอร์ · **ห้ามลบทิ้งทันที** |
| OD-2 | Guest Checkout | อนุมัติหลักการ · เลือก **ทางเลือก A** (Guest Identity ผ่าน OTP แล้วใช้ Order RPC เดิม) ถ้าพิสูจน์ปลอดภัย · ทางเลือก B ไม่เลือก |
| OD-3 | OTP | ยืนยันการควบคุมเบอร์ **แยกจาก Login Authorization และ Payment** |
| OD-4 | SMS Provider | อนุมัติหลักการใช้ **THSMS** |
| OD-5 | Facebook | คงใน Roadmap (P3) แต่ไม่ขวางความปลอดภัย/Guest Checkout |
| OD-6 | Email/Password | คงไว้ · เพิ่มกู้คืนรหัสผ่าน + ตรวจการยืนยันอีเมล → **ทำแล้ว (กู้คืน)** |
| OD-7 | Passkeys | ทำภายหลัง (P4) |

---

## 3. P0 — Security Remediation (ค้าง: ต้องมี OTP)

**ทำแล้ว (interim):** rate limit 5/15 นาทีต่อเบอร์ + 20/ชม.ต่อ IP · ค่า IP สูงกว่าเพราะลูกค้าไทยหลายคนอยู่หลัง CGNAT

**ยังต้องทำ (blocked):** ให้ Quick Login ใช้ OTP ก่อนออก session → **ต้อง Owner provision `SMS_*` secret ก่อน**

```bash
supabase secrets set SMS_PROVIDER=thsms_org SMS_API_KEY=<key> SMS_SENDER_NAME=<sender> SMS_MESSAGE_TYPE=standard
supabase functions deploy phone-auto-login --project-ref ivkdfognyiwjcmrhcnwz
```
> credential `THSMS_*` มีใน `.env.local` ของเครื่อง Owner แล้ว (ตรวจเฉพาะชื่อ key) — ต้องทดสอบส่ง 1 ข้อความจริงก่อนขั้นถัดไป

**ข้อจำกัดที่ต้องยอมรับ:** rate limit เป็น in-memory ต่อ instance → reset เมื่อ cold start · เป็น interim เท่านั้น

---

## 4. P1 — ทำแล้ว / เหลือให้ Owner ตรวจ

**ทำแล้ว:** ลืมรหัสผ่าน (`/login` → ปุ่ม "ลืมรหัสผ่าน?" → กรอกอีเมล → ลิงก์ไป `/reset-password`) · กัน account enumeration (อีเมลไม่มีในระบบก็ตอบสำเร็จ) · `/orders` เป็น ProtectedRoute

**ต้อง Owner ตรวจ (ผมเข้า Dashboard ไม่ได้):**
1. Supabase Dashboard → Authentication → Providers → **Email** → ต้องเปิด **Confirm email**
2. Authentication → URL Configuration → **Redirect URLs** ต้องมี `https://biteme-baby.com/reset-password`
3. ทดสอบจริง: ใช้อีเมลตัวเองกด "ลืมรหัสผ่าน" → ได้ลิงก์ → ตั้งรหัสผ่านใหม่ → login ได้

---

## 5. P2 — OTP + Guest Checkout (ยังไม่เริ่ม — รอ §3)

**acceptance criteria ที่ Owner ตั้งไว้ (ต้องพิสูจน์ทั้ง 5 ข้อ):**
1. ลูกค้ากลับมาสั่งซ้ำโดยไม่ติดขั้นตอนสมัครสมาชิกอย่างไร
2. Guest Order จะมีเจ้าของและสิทธิ์เข้าถึงอย่างไร
3. เชื่อมบัญชีเดิมภายหลังได้อย่างไรโดยไม่สร้าง Customer ซ้ำ
4. **การยืนยัน OTP จะไม่ทำให้ผู้ใช้ได้สิทธิ์เข้าบัญชีเดิมโดยอัตโนมัติ**
5. หาก OTP/Session ล้มเหลว จะไม่มีออเดอร์หรือการเรียกเก็บเงินค้างผิดสถานะ

**งานที่ต้องทำก่อนเริ่ม:** แก้ `no_user_id = 3` แถว (ข้อมูลไม่ผูก Auth user) — ไม่งั้น account linking จะมีออเดอร์กำพร้า

---

## 6. P3 — Facebook OAuth (ยังไม่เริ่ม)

`signInWithOAuth` = **0** · `META_APP_ID` / `META_APP_SECRET` มีใน `.env.local` แล้ว (ตรวจเฉพาะชื่อ) · ต้องมี callback route + test user จริง

## 7. P4 — Passkeys (ยังไม่เริ่ม)

`navigator.credentials` / `webauthn` = **0** · ต้องยืนยันความพร้อมของ Supabase SDK ก่อนเริ่ม

---

## 8. งาน Owner ที่ยังค้างอยู่ทั้งหมด

| ลำดับ | งาน | สถานะ |
|---|---|---|
| 1 | ตั้ง `SMS_*` secret + ทดสอบส่ง SMS จริง 1 ข้อความ | **เปิดทางให้ P0/P2** |
| 2 | ตรวจ Email Confirmation ใน Dashboard + ทดสอบกู้คืนรหัสผ่านจริง | P1 |
| 3 | ทำ Omise TEST E2E ทุกสถานะ + ตรวจ webhook | ยังไม่มีหลักฐานการจ่ายจริง |
| 4 | GPS matrix บนมือถือจริง (เคส 1–4 ทำได้เลย) | handoff §8 |
| 5 | Copy 7 วัน (`theater_daily_copy`) | Admin → Settings |
| 6 | ลบ/noindex `bitemebaby-5f7.pages.dev` (build แช่แข็ง) | Cloudflare dashboard |
| 7 | Omise LIVE onboarding/identity verification | ก่อนรับเงินจริง |
| 8 | ตัดสินใจ provenance column ถ้าต้องการ restore พิกัด | optional |
| 9 | ยืนยัน revision hash ของ EF (Management API `/versions` คืน 404) | ยืนยันได้แค่วันเวลา |

| OD-8 | Payment / Order State Machine | รักษาระบบเดิม ห้ามแก้เพื่อให้ Guest Checkout ผ่าน |
| OD-9 | Email Confirmation / Omise TEST | ต้องตรวจ Dashboard + ทดสอบจริง ห้ามอนุมานจาก Build/CI |
