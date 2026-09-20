# Bite Me Baby — คู่มือแอดมินฉบับใช้งานจริง (ภาษาไทย)

> สถานะจริง ณ 2026-09-20 — เอกสารนี้**เขียนทับ**สถานะเดิม (ตรวจจากโค้ดจริง + migration จริง)
> ผู้ใช้เป้าหมาย: เจ้าของร้าน / ผู้ดูแลระบบ

---

## 1) ทำไมบัญชีแอดมินที่เคยตั้งไว้ login ไม่ได้ (สาเหตุจริง + วิธีแก้)

ระบบ login ใช้ **Supabase Auth** (`signInWithPassword`) — ไม่ใช่ localStorage เดิมแล้ว
(P0-2 FIX: identity/password อยู่กับ auth.users ฝั่ง server)

**ปัญหาเดิมของแอป:** หน้า Login ดันทุก error เป็นข้อความเดียว `Invalid email or password`
→ เราไม่รู้ว่าล้มเพราะอะไร (แก้แล้วแล้ว: ตอนนี้หน้า login จะบอก**เหตุผลจริงเป็นภาษาไทย**
เช่น "อีเมลนี้ยังไม่ได้ยืนยัน" หรือ "รหัสผ่านไม่ถูกต้อง")

### สาเหตุที่พบบ่อย (เรียงตามความน่าจะเป็น)

| อันดับ | สาเหตุ | อาการ |
|---|---|---|
| 1 | **Email not confirmed** — Supabase default บังคับยืนยันอีเมล แต่อีเมลยืนยันไม่ถูกส่งถึง (Free tier จำกัดอีเมล/ชั่วโมง มักติด spam) | กรอกถูกทุกอย่างแต่เข้าไม่ได้เสมอ |
| 2 | **รหัสผ่านไม่ตรง** | เข้าไม่ได้ (error "Invalid login credentials") |
| 3 | ชื่อ project/URL deploy คนละ environment (preview URL ต่อ Supabase ผิดตัว) | error network หรือ login ผ่านแต่ดึงข้อมูลไม่ได้ |

> หมายเหตุสำคัญ: **login สำเร็จ ≠ เป็นแอดมิน** — สิทธิ์แอดมินอยู่ที่ตาราง
> `profiles.role = 'admin'` (แยกออกจากรหัสผ่านคนละชั้น) ดูวิธียกระดับใน §3

### วิธีเช็คและแก้ใน Supabase Dashboard (ทำได้เอง 3 นาที)

1. เข้า supabase.com/dashboard → เลือก project **bmb** (`ivkdfognyiwjcmrhnwz`)
2. เมนูซ้าย **Authentication → Users** → หา `jinpao3024@outlook.com`
3. ดูคอลัมน์ **"Confirm email"** (เลื่อนตารางไปขวา)
   - ถ้ายังไม่ยืนยัน → กดที่แถว user → เมนู `…` → **Confirm email** หรือ
   - ถ้าลืมรหัสผ่าน → กด **Send password recovery** (ระบบจะส่งลิงก์ตั้งรหัสใหม่)
4. ทางเลือก (แก้ผ่าน SQL Editor ได้เลย ถ้าไม่ได้รับอีเมล):

```sql
-- ยืนยันอีเมลทันที (เทียบเท่าการกด Confirm email ใน Dashboard)
update auth.users
   set email_confirmed_at = now(), updated_at = now()
 where email = 'jinpao3024@outlook.com';
```

แล้วกลับไปหน้าเว็บ login ใหม่อีกครั้ง

---

## 2) ระบบแอดมินสมบูรณ์ระดับไหนแล้ว (Audit ตามสถานะจริง)

| ส่วน | สถานะ | อยู่ที่ไหน |
|---|---|---|
| Identity + Session (JWT, refresh, logout) | ✅ สมบูรณ์ | Supabase Auth + `src/store/authStore.ts` (P0-2) |
| Role ผู้ใช้ (`customer`/`admin`) + auto-create profile ตอนสมัคร | ✅ สมบูรณ์ | migration `006` (`handle_new_user`) + ตาราง `profiles` |
| กัน escalation (user แก้ role ตัวเองไม่ได้) | ✅ สมบูรณ์ | migration `006` B7 + `014` (`guard_profile_mutation`) |
| RLS ฝั่ง server สำหรับ admin (`is_admin()` + `*_admin` policies) | ✅ สมบูรณ์ | migration `005/006` ครบทุกตาราง admin-managed |
| Guard หน้าเว็บฝั่ง frontend (AdminRoute) | ✅ สมบูรณ์ | `src/App.tsx` → `fetchProfileRole()` จาก `profiles` |
| ตัวยกระดับเจ้าของร้าน (owner bootstrap) | ✅ มีเครื่องมือ | migration `014` → `promote_to_full_admin(email)` |
| หน้าแอดมิน (12+ หน้า) + ระบบ audit log | ✅ สมบูรณ์ | รายการใน §4 |
| **สิ่งที่ยังต้องทำฝั่งคน (ไม่ใช่โค้ด)** | ⚠️ | ดู §2.1 |

### 2.1 สิ่งที่ยังต้องทำบน Supabase จริง (checklist)

- [ ] ยืนยันอีเมลบัญชีเจ้าของ (§1)
- [ ] เช็คว่า migration `014` ถูก apply แล้ว — รันใน SQL Editor:

```sql
select proname from pg_proc where proname = 'promote_to_full_admin';
```

ถ้า**ไม่มีแถว** = ยังไม่ได้รัน → เปิดไฟล์
`supabase/migrations/014_owner_admin_full_access.sql` ก็อป**ทั้งไฟล์**ไปวางใน
SQL Editor แล้วกด Run (idempotent — รันซ้ำได้ปลอดภัย)

- [ ] ยกระดับบัญชีเจ้าของเป็น admin (§3)
- [ ] เช็ค migration ที่เหลือ (015/016) ถ้ายังไม่ได้ apply — ใช้วิธีเดียวกัน

---

## 3) วิธีสร้าง / ยกระดับแอดมิน (3 วิธี — แนะนำวิธี A)

### วิธี A — ใช้ฟังก์ชันที่ระบบเตรียมไว้ (แนะนำ)

Supabase Dashboard → **SQL Editor** → รัน:

```sql
select public.promote_to_full_admin('jinpao3024@outlook.com');
```

ผลที่คาดหวัง: `{"ok": true, "role": "admin", "is_owner": true, ...}`

- ถ้าได้ `NO_ACCOUNT_FOUND` = ไม่มีบัญชีอีเมลนี้ในระบบ → สมัครผ่านหน้า Register
  ก่อน แล้วรันคำสั่งนี้อีกครั้ง
- ระบบจะตั้ง `profiles.role='admin'`, `is_owner=true`, `is_active=true` ให้เอง
- จากนั้น **logout แล้ว login ใหม่** → ระบบจะพาเข้า `/admin` อัตโนมัติ
  (LoginPage ตรวจ role จาก DB แล้วเลือกปลายทางให้)

> ฟังก์ชันนี้เรียกได้**เฉพาะใน SQL Editor เท่านั้น** (ถูก `REVOKE` จากเว็บ/anonymous
> ตามดีไซน์ความปลอดภัย — ไม่มีใครแอบยกระดับสิทธิ์ผ่านหน้าเว็บได้)

### วิธี B — สร้างบัญชีแอดมินใหม่ (Dashboard + SQL)

1. **Authentication → Users → Add user** → ใส่ email/password → ติ๊ก **Auto Confirm User**
2. SQL Editor:

```sql
insert into public.profiles (id, email, role, is_active)
select id, email, 'admin', true
  from auth.users
 where email = 'new-admin@example.com'
on conflict (id) do update
   set role = 'admin', is_active = true, updated_at = now();
```

### วิธี C — ยกระดับบัญชีที่มีอยู่แล้ว (สั้นสุด)

```sql
update public.profiles
   set role = 'admin', is_owner = true, is_active = true, updated_at = now()
 where email = 'jinpao3024@outlook.com';
```

### เช็คว่าเป็นแอดมินแล้วจริงหรือยัง

```sql
select email, role, is_owner, is_active from profiles
 where email = 'jinpao3024@outlook.com';
-- คาดหวัง: role = admin, is_owner = true, is_active = true
```

---

## 4) คู่มือใช้งานหน้าจอแอดมิน (ทุกหน้า)

เข้าใช้งาน: login ด้วยบัญชี `role='admin'` → ระบบพาไป `/admin` เอง
(ถ้าเข้าเองก็พิมพ์ URL ตรง ๆ — หน้าที่ไม่ใช่ admin จะถูก redirect กลับ `/` ทันที)

| Route | หน้าจอ | ใช้ทำอะไร |
|---|---|---|
| `/admin` | Admin Dashboard | ภาพรวมวันนี้: จำนวนออเดอร์, รายได้, ออเดอร์ค้าง, อัตราส่งสำเร็จ, วัตถุดิบใกล้หมด |
| `/admin/orders` | จัดการออเดอร์ | เปลี่ยนสถานะตามลูกโซ่ (`pending → confirmed → preparing → ready_for_dispatch → dispatched → … → delivered`), ยกเลิก (พร้อมคืนโควตารอบส่งอัตโนมัติ), refund Stripe |
| `/admin/products` | เมนู & Add-ons | เพิ่ม/แก้เมนู, ราคา, รูป, เปิด-ปิดขาย, stock แสดงผล, rating; ตั้ง **Add-ons/Toppings** (ราคาคิดฝั่ง server เสมอ) |
| `/admin/rounds` | รอบจัดส่ง | คุมรอบ `morning/midday/evening`, capacity (โควตาต่อรอบ), เวลา cutoff, เปิด/ปิดรับ |
| `/admin/promotions` | โปรโมชัน | สร้างคูปอง/โปร (fixed/percentage/free_shipping/spend_threshold/flash_sale ฯลฯ), กำหนดเงื่อนไข |
| `/admin/customers` | ลูกค้า | ดูข้อมูล/สถิติลูกค้า, บล็อก-ปลดบล็อก (is_active) |
| `/admin/inventory` | วัตถุดิบ | สต็อกวัตถุดิบ, movement, แจ้ง low stock, สั่งซื้อซ้ำ (reorder) |
| `/admin/settings` | ตั้งค่าระบบ | ค่า config ที่ admin แก้ได้จากหน้าเว็บ |
| `/admin/media` | คลังสื่อ | จัดการรูปใน storage bucket `bmb_images` (upload/ลบ/คัดลอก URL) |
| `/admin/audit-log` | Audit Log | ดู action ทุกอย่างย้อนหลัง (ใคร ทำอะไร เมื่อไหร่) |
| `/admin/delivery` | จัดการส่งของ | สถานะช่องทางส่ง (Bite Drive live / Grab-LINEMAN sandbox / FoodPanda mock) |
| `/admin/route-optimization` | เส้นทาง | จัด route ไรเดอร์หลายออเดอร์ (nearest-neighbor) |
| `/admin/control` 🆕 | Admin Control | โควตารายวัน vs ออเดอร์จริง + สถานะไรเดอร์ (สถาปัตยกรรม Blueprint ใหม่) |
| `/rider` 🆕 | Rider PWA | ฝั่งไรเดอร์: เช็คอิน GPS ใกล้ปลายทาง + ถ่ายรูป **POD** ก่อนกด Delivered (ระบบบังคับ ถ้าไม่มีรูป/อยู่นอกระยะ จะกดไม่ได้) |

> หมายเหตุ: หน้า `/admin/control` และ `/rider` เป็นส่วนใหม่ตาม Master Universal
> Blueprint (ดู `docs/BITEBABY_BLUEPRINT_REFACTOR_2026-09-20.md`)

---

## 5) Deployment และค่าที่ตั้ง (Cloudflare Pages + Supabase)

- Repo ผูกกับ **Cloudflare Pages** — `git push origin main` แล้ว deploy อัตโนมัติ
  (URL preview แบบ `ede0a85b.bitemebaby.pages.dev` จะเปลี่ยนทุก build — ใช้ production domain ยาว ๆ จะสเถียรกว่า)
- Environment variables ที่ต้องตั้งใน Cloudflare Pages (Settings → Environment variables):

| ตัวแปร | ที่มา |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |
| `VITE_OPENROUTER_API_KEY` | OpenRouter (สำหรับ Bite AI chat) |

- ⛔ **ห้าม**ตั้ง `service_role` key ฝั่ง frontend (ถูกถอดออกแล้วตั้งแต่ P0-1 — งานที่ต้องใช้สิทธิ์สูงต้องไปอยู่ใน Edge Function)
- สั่ง build เช็คก่อน push เสมอ: `npm run build` (tsc + vite) และ `npm test`

---

## 6) Troubleshooting สรุปสั้น (อาการ → สาเหตุ → ทางแก้)

| อาการ | สาเหตุที่พบบ่อย | ทางแก้ |
|---|---|---|
| Login ไม่ได้ ทั้งที่รหัสถูก | Email ยังไม่ยืนยัน | §1 — Confirm email / SQL update |
| Login ไม่ได้ แจ้งรหัสผ่านไม่ถูก | ลืม/พิมพ์ผิด | Dashboard → Send password recovery |
| Login ผ่านแต่พอกด /admin โดนดันกลับหน้าแรก | `profiles.role` ยังไม่ใช่ `admin` | §3 วิธี A/C แล้ว logout-login ใหม่ |
| กด promote แล้วได้ `NO_ACCOUNT_FOUND` | ไม่มีบัญชี email นี้ใน auth.users | สมัครผ่าน Register ก่อน แล้ว promote ใหม่ |
| กด promote แล้ว error ไม่พบฟังก์ชัน | migration 014 ยังไม่ถูก apply | §2.1 — รันไฟล์ 014 ทั้งไฟล์ใน SQL Editor |
| สร้างออเดอร์ error `PGRST202` | migration 007 (RPC `create_order_with_items`) ยังไม่ apply | รันไฟล์ migration ที่ขาดตามลำดับ |
| ปุ่มสั่งซื้อเป็นเทา "ออเดอร์เต็ม/หมดเวลา" | Truth Table: โควตาเต็ม หรือเลย cutoff (ทำงานถูกต้อง) | ขยาย quota ใน /admin/rounds หรือรอรอบถัดไป |

---

## 7) ข้อควรระวังด้านความปลอดภัย (สรุปสั้น)

- สิทธิ์แอดมินทุกอย่างตรวจ**ฝั่ง server** (RLS + `is_admin()`) — แก้ UI ไม่ได้ช่วย
- Client แอบแก้ role ตัวเองไม่ได้ (`guard_profile_mutation` + RLS)
- Service-role key ห้ามลง frontend เด็ดขาด
- ทุก action สำคัญมี audit log — เปิดดูได้ที่ `/admin/audit-log`

— จบคู่มือ —

