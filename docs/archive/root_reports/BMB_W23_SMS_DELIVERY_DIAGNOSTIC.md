# BMB — W-2.3 SMS DELIVERY DIAGNOSTIC (THSMS) — BRAINSTORM ก่อนแก้ไข

**สถานะ:** ANALYSIS ONLY (Owner สั่ง "เบรนสตอร์มปัญหา … ก่อนแก้ไข") — ยังไม่แก้โค้ด/ไม่เปลี่ยน config
**วันที่:** 2026-10-07 (รอบ 8e) · **Provider:** THSMS (`https://thsms.com`) · account user `pual` (bitemebaby2016@gmail.com)
**อาการ (Owner):** เครดิตถูกตัด 1/ข้อความ **แต่ไม่มี SMS เข้าเครื่องทั้ง 2 เบอร์** (`0826378546`, `0942649269`)

---

## 1. ข้อเท็จจริงที่ยืนยันแล้ว (Confirmed Evidence — ฝั่งเรา)

| # | หลักฐาน | ค่า/ผล |
|---|---|---|
| E1 | THSMS `POST /api/send-sms` ตอบ | `HTTP 200 {"success":true,"code":200,"message":"OK","data":{"credit_usage":1,"remaining_credit":...}}` |
| E2 | เครดิตถูกหักจริง | `remaining_credit` ลดลง 1/ข้อความ (สั้น ≤70) · ตอนข้อความยาว ~90 = `credit_usage:2` |
| E3 | รูปแบบ request | `Authorization: Bearer <key>` + body `{"sender","msisdn":["0XXXXXXXXX"],"message"}` (ตรง docs ทางการ gist) |
| E4 | `msisdn` format | leading-0 (`0826378546`) — ตรงตัวอย่าง docs `089xxxxxxx` |
| E5 | Sender `Direct SMS` | Owner ยืนยัน: สาธารณะ / **อนุญาตใช้งาน** / **ใช้งาน** (registered) |
| E6 | ข้อความ | ASCII/GSM-7 51 ตัวอักษร = 1 segment (ไม่ใช่ปัญหารูปแบบข้อความ) |
| E7 | **Control test เบอร์บัญชีเอง** (`0817847992` = user.mobile `66817847992`) | `HTTP 200 credit_usage:1` — เหมือนทุกประการ (Owner ยังไม่ยืนยันว่าเข้าไหม) |
| E8 | ทุกเบอร์ที่ยิง (082, 094, 668-prefix, 081-control) | ตอบ success + หักเครดิต **เหมือนกันหมด** → THSMS รับงานทุกครั้ง |
| E9 | `/api/me` wallet | `credit`/`balance` ทำงาน · user.priority = 3 · `last_login: null` |
| E10 | ไม่มี delivery-report endpoint ใน docs | docs มีแค่ V1/V2: Check Credit · Send SMS · Send SMS Schedule Task |

**ข้อสรุปจากฝั่งเรา:** EF → THSMS ทำงานถูกต้อง 100% (request ถูก, format ถูก, sender ถูก, รับงาน + หักเครดิต) → **ความล้มเหลวอยู่ "หลัง" การรับงาน (ฝั่ง THSMS → carrier → มือถือ)** ไม่ใช่ฝั่ง BMB

## 2. สิ่งที่ตัดออกแล้ว (Ruled Out)

- ❌ เบอร์ผิด — Owner ยืนยัน 082 + 094 ถูกต้อง
- ❌ รูปแบบเบอร์ — EF ส่ง leading-0 ตรง docs (ทดสอบ 66-prefix ก็ 200 เหมือนกัน)
- ❌ Sender name — "Direct SMS" ลงทะเบียน + อนุญาตใช้งาน
- ❌ ข้อความยาว/2 segment — ลดเป็น ≤70 แล้ว = `credit_usage:1`
- ❌ EF/โค้ด BMB — response OK + provider_status 200 สะท้อนจริง (ตอนเครดิตหมด = 422→EF 502)
- ❌ auth/secret — ส่งได้ + หักเครดิต

## 3. สมมติฐานที่เหลือ (Ranked) + วิธีพิสูจน์

| # | สมมติฐาน | ความน่าจะเป็น | วิธีพิสูจน์ (ไม่แก้โค้ด) |
|---|---|---|---|
| **H1** | **Sender-ID "อนุญาตใช้งาน" ในแผง ≠ อนุมัติระดับ carrier (DLT/whitelist รายค่าย)** — carrier drop เงียบ โดย gateway ยังตอบ success | **สูง** | ดู THSMS panel "รายงานการส่ง" · ลอง sender อื่น (`Happy Hour`) · ถาม THSMS ว่า sender นี้ผ่าน whitelist AIS(082)/True(094) หรือยัง |
| **H2** | **Route/บัญชีเป็นแบบ Marketing/Bulk (priority 3) ที่ดีเลย์/ถูกกรอง** | กลาง | ดู panel สถานะ · รอ 1–24 ชม. แล้วเช็กซ้ำ |
| **H3** | **บัญชี THSMS ยังไม่ผ่าน KYC/ทดลอง** → ส่งได้เฉพาะเบอร์ลงทะเบียน | กลาง | Control E7: ถ้าเบอร์บัญชีเอง (0817847992) ได้รับ แต่ 082/094 ไม่ได้ = ยืนยัน H3 |
| **H4** | **มือถือปลายทางกรอง alphanumeric sender / DND** (ทั้ง 2 เครื่อง) | ต่ำ-กลาง | ทดสอบเบอร์ค่ายที่ 3 · ดู blocklist ในมือถือ |
| **H5** | **content filter** — ข้อความมี `[ ]`/คำว่า "TEST" | ต่ำ | ส่งข้อความล้วน "Bite Me Baby" ไม่มีอักขระพิเศษ/ลิงก์ |
| **H6** | **เครดิตเป็นแบบ promo** ที่หักได้แต่ไม่ส่งจริง | ต่ำ | ดู panel ประเภทเครดิต · ถาม THSMS |
| **H7** | **ดีเลย์คิว gateway** | ต่ำ | รอแล้วเช็กซ้ำ |

**สมมติฐานที่มีน้ำหนักสุด = H1 (sender ไม่ผ่าน carrier whitelist)** เพราะรับงาน+hักเครดิตทุกครั้ง แต่ไม่ถึงทุกเบอร์ → ตรงกับอาการ "gateway submit สำเร็จ แต่ carrier reject/drop"

## 4. มุมวิเคราะห์แบบ "เอเย่น" 4 คน

1. **SMS Gateway Engineer:** ตอบ `success:true` = `submit_sm` "รับเข้าคิว" ไม่เท่ากับ `deliver_sm` — ต้องดู **submit_sm_resp / delivery report** จาก carrier (THSMS มีใน panel/support)
2. **Thai Carrier / Sender-ID (DLT) expert:** ชื่อผู้ส่ง alphanumeric ต้องขึ้นทะเบียนต่อค่าย (AIS/True/dtac) · แผง THSMS "ใช้งาน" = อนุมัติที่ THSMS แต่ **ไม่การันตีค่ายปลายทาง approve** → มัก drop เงียบ
3. **Integration engineer:** request ถูก 100% (E1–E6) — จุดอ่อนคือ **response ไม่มี message-id** → track ไม่ได้ ควรขอ THSMS เพิ่ม id/report
4. **Data analyst:** pattern E8 (ทุกเบอร์ได้ 200 เหมือนกัน) = ตัวแปร "ปลายทาง" ไม่กระทบการตอบรับ → ชี้ปัญหาที่ระดับ sender/route/บัญชี ไม่ใช่เบอร์

## 5. แผนทดสอบที่แนะนำ (เรียงตามความคุ้มค่า — ยังไม่แก้โค้ด)

| ลำดับ | การทดสอบ | บอกอะไร | ต้นทุน |
|---|---|---|---|
| **T1** | **Owner เปิด THSMS panel → ประวัติ/รายงานการส่ง** | สถานะจริง: ส่งสำเร็จ/รอส่ง/ไม่สำเร็จ + เหตุผล ← เร็วสุด+ชัดสุด | ฟรี |
| **T2** | **ยืนยัน control E7** (0817847992 ได้รับไหม) | แยก H3 (บัญชี/whitelist) vs H4 (ปลายทาง) | 0 |
| **T3** | ส่งด้วย sender อื่น (`Happy Hour`) ไปเบอร์ Owner | แยก H1 (sender-specific carrier block) | 1 เครดิต |
| **T4** | ส่งข้อความล้วน ไม่มี `[ ]`/"TEST"/ลิงก์ | แยก H5 (content filter) | 1 เครดิต |
| **T5** | **ติดต่อ THSMS support 095-961-2240 / info@thsms.com** แจ้งบัญชี `pual` + เวลา + ปลายทาง ("API 200+หักเครดิต แต่ไม่ถึง") → ขอ gateway log/submit_resp | เหตุผลจริงจากค่าย ← decisive | ฟรี |
| **T6** | ส่งเบอร์ค่ายที่ 3 | แยก H4 (carrier ปลายทาง) | 1 เครดิต |

## 6. คำถามที่ต้องขอจาก THSMS (ให้เอเย่นตอบ)

1. ข้อความที่ส่งล่าสุด (timestamp `2026-10-07`) สถานะคืออะไร (queued/sent/failed)?
2. `sender = Direct SMS` ผ่าน whitelist ค่าย AIS (082…) / TrueMove (094…) หรือยัง?
3. ทำไม `send-sms` ตอบ `success` เมื่อ carrier drop — มี `message_id`/delivery-report ให้ track ไหม?
4. บัญชีนี้มีข้อจำกัด (KYC / ทดลอง / ส่งได้เฉพาะเบอร์ลงทะเบียน) หรือไม่?

---

## 7. บทสรุป (สำหรับ Owner)

```text
ฝั่ง BMB (EF → THSMS API) = ทำงานถูกต้องครบ (พิสูจน์แล้ว E1–E10)
จุดพัง = ชั้น THSMS → carrier → มือถือ (gateway รับงาน + หักเครดิต แต่ไม่ถึงเครื่อง)
ตัวต้องสงสัยอันดับ 1 = sender-id "Direct SMS" ไม่ผ่าน whitelist ระดับค่าย (H1)
ทางที่เร็ว+decisive ที่สุด = T1 (ดู panel) + T5 (ถาม THSMS support)
ยังไม่แก้โค้ดใด ๆ — รอ Owner/เอเย่นยืนยันสาเหตุก่อน
```

---

## 8. อัปเดต รอบ 8f — ทดสอบด้วย "คีย์ใหม่" (Owner เปลี่ยน env)

**Owner ตั้งค่าใน `.env.local`:** `THSMS_API_KEY=thsms_75c77a7589bb…3dbbe8` · `THSMS_SENDER_NAME=SMSOTP`
**ทดสอบ 3 เบอร์เดิม (ยิงตรงไม่ผ่าน EF):**

| เบอร์ | `/api/me` | `/api/send-sms` |
|---|---|---|
| `0826378546` | **404** | **404** |
| `0942649269` | **404** | **404** |
| `0817847992` | **404** | **404** |

body ทุกครั้ง: `{"success":false,"status_code":404,"error":"Not Found","message":"User Not Found"}`

### ข้อสรุป (E11)
- **คีย์ใหม่ "ไม่เป็นที่รู้จัก" โดย THSMS (ระดับ auth/identity)** → **ยังไม่มีการส่ง และไม่มีการหักเครดิต** (403/404 = ไม่ผ่าน auth ก่อนถึงชั้นส่ง)
- รูปแบบคีย์ถูกต้อง: `^thsms_[0-9a-f]{64}$` (len 70) → ปัญหาอยู่ที่ **ค่าคีย์** ไม่ใช่ format/ช่องว่าง/อักขระแปลก
- `/api/me` และ `/api/send-sms` ให้ผลเหมือนกัน → เป็นปัญหา auth-level ไม่ใช่ payload

### สาเหตุที่เป็นไปได้
1. **คัดลอก/พิมพ์คีย์ผิดหรือไม่ครบ**
2. **คีย์คนละบัญชี/คนละ environment** (ก่อนหน้านี้คีย์ที่ใช้ได้ resolve เป็น user id **112612 / username `pual`**)
3. **บัญชี/คีย์ถูก revoke/ระงับ**

> ⚠️ **ถ้าคีย์นี้เป็นคีย์เดียวกับที่เคยใช้ได้** → แปลว่าบัญชี THSMS ถูกระงับ → **อธิบายอาการ "หักเครดิตแต่ SMS ไม่ถึง" ได้เลย**

### ต้องทำต่อ
- Owner คัดลอกคีย์จากแผง THSMS ใหม่ (เมนู API / Settings) ให้ครบ 64 hex + prefix `thsms_`
- ยืนยันว่า **sender `SMSOTP` ลงทะเบียนในบัญชีนั้น** (คนละ sender กับ `Direct SMS` เดิม)
- เมื่อคีย์ถูกต้องแล้ว จึงรัน E1–E7 ซ้ำ (ยิงตรง) เพื่อวัดว่า sender `SMSOTP` ถึงเครื่องหรือไม่

---

## 9. อัปเดต รอบ 8g — ย้ายผู้ให้บริการไป `thsms.org`

**สาเหตุย้าย:** คีย์ที่ Owner ให้เป็น **คนละบัญชี** (404 `User Not Found`) · แอดมิน SMS แนะนำเปลี่ยนเว็บใหม่ → **`https://thsms.org/dashboard`** (คนละแพลตฟอร์มกับ `thsms.com` เดิม)

**API ใหม่ (จาก docs ทางการ):**

| item | ค่า |
|---|---|
| Base URL | `https://api.thsms.org/v1` |
| Auth | header **`X-API-Key: <key>`** (เดิมใช้ `Authorization: Bearer`) |
| ส่ง SMS | `POST /sms/send` body `{ sender_name, recipient, message, message_type }` |
| ยกเลิก | `POST /sms/:id/cancel` |
| เช็กเครดิต | `GET /credits` |
| message_type | ตัวอย่าง `superfast` (อาจมีค่าอื่น) |

> **ข้อดีที่ได้เพิ่ม:** `POST /sms/send` คืน **`:id`** → สามารถ track/ยกเลิกได้ (thsms.com ไม่มี) — แก้จุดอ่อนเดิมที่ไม่มี delivery report

**โค้ดที่แก้ (commit `34dd39d`):**
- `supabase/functions/sms-send/index.ts` — เพิ่ม provider switch:
  - `SMS_PROVIDER=thsms_org` → header `X-API-Key` + body `{ sender_name, recipient, message, message_type }`
  - `SMS_PROVIDER=thsms` (legacy) → `Authorization: Bearer` + `{ msisdn:[to], message, sender }`
  - เพิ่ม secret `SMS_MESSAGE_TYPE` (default `superfast`) · response คืน `provider` + `provider_body` (≤160) เพื่อวินิจฉัย
- `e2e/w23SetSmsSecrets.cjs` — ชี้ `SMS_API_URL=https://api.thsms.org/v1/sms/send` + `SMS_PROVIDER=thsms_org`
- `e2e/thsmsOrgProbe.cjs` (ใหม่) — ยิงตรง `GET /credits` + `POST /sms/send` 3 เบอร์ (X-API-Key)

**Gates:** TSC 0 · LINT 0 · VITEST 527/527 · BUILD 0

**ยังต้องได้จาก Owner (เพื่อทดสอบจริง):**
1. **API key ของ thsms.org** (dashboard → API)
2. **sender_name ที่ลงทะเบียน** บน thsms.org
3. (ถ้าต้องการ) `message_type` เช่น `superfast`
→ วางใน `.env.local`: `THSMS_API_KEY=` และ `THSMS_SENDER_NAME=` แล้วแจ้งกลับ → ผมรัน probe 3 เบอร์ + ตั้ง secrets + deploy EF

---

## 10. อัปเดต รอบ 8h — `thsms.org` ทำงานได้จริง (คีย์ + EF + deploy)

**การค้นพบสำคัญ:** คีย์ `thsms_75c7…bbe8` เป็น **ตัวเดียวกันทุกอักษร** กับที่เคย 404 บน thsms.com — แต่ใช้ได้กับ **thsms.org** → ยืนยันว่าเป็น **คีย์ของบัญชี thsms.org** (คนละแพลตฟอร์ม) จริง ไม่ใช่คีย์เสีย

**ทดสอบยิงตรง 3 เบอร์ (`X-API-Key`):**

| เบอร์ | `GET /credits` | `POST /sms/send` |
|---|---|---|
| `0826378546` | 200 `available=511` | 200 `{credits_used:3, messages_queued:1, status:"queued", success:true, valid_count:1}` |
| `0942649269` | 200 `available=508` | เหมือนกัน |
| `0817847992` | 200 `available=505` | เหมือนกัน |

- ✅ คีย์ถูกต้อง · sender `SMSOTP` ผ่าน · ทุกเบอร์ `queued` + `valid_count:1`
- ⚠️ **`credits_used: 3` ต่อข้อความ** (message_type=`superfast`) — ถ้าต้องการประหยัด อาจลอง `message_type` อื่น

**EF + production:**
- **secrets ตั้งแล้ว** (HTTP 201): `SMS_PROVIDER=thsms_org` · `SMS_API_URL=https://api.thsms.org/v1/sms/send` · `SMS_API_KEY` · `SMS_SENDER_NAME=SMSOTP` · `SMS_MESSAGE_TYPE=superfast` · `META_PAGE_ACCESS_TOKEN` → verify 6/6 PRESENT
- **EF `sms-send` deploy สำเร็จ** (`Deployed Functions on project ivkdfognyiwjcmrhcnwz: sms-send`)
- `w23SmsProbe` → **3/3 ALL PASS** (`provider=thsms_org`) · `w23SmsSendOwner` → `SMS_HTTP=200 ok=true provider_status=200`
- แก้ `deploySmsSend.cjs` ให้ไล่ทุก `SUPABASE_ACCESS_TOKEN` (ตัวท้ายหมดอายุ → 401)

**ยืนยันแล้ว (2026-10-07):** ✅ **Owner ยืนยัน SMS เข้าเครื่องจริงทั้ง 3 เบอร์** → **W-2.3 DELIVERY CONFIRMED** — ปัญหา "SMS ไม่ถึง" จบสมบูรณ์ด้วยผู้ให้บริการ **thsms.org** + sender `SMSOTP` · **root cause เดิม: ชี้ผิดแพลตฟอร์ม (`thsms.com`) ทั้งที่คีย์/บัญชีเป็นของ `thsms.org`**

---

## 11. อัปเดต รอบ 8i — เครดิต 1/ข้อความ + แก้ token ซ้ำ

**การค้นพบสำคัญ:** thsms.org คิดเครดิตตาม **`message_type`** (ไม่ใช่ความยาวข้อความ — ข้อความ ≤70 ตัวแต่ `superfast` ก็ยัง 3):

| `message_type` | `credits_used` |
|---|---|
| **`standard`** | **1** ✅ |
| `express` | 2 |
| `superfast` | 3 |

> หน้าเว็บ thsms.org ระบุว่ารองรับ `Superfast`, `Express`, `Standard`

**แก้แล้ว:** `SMS_MESSAGE_TYPE=standard` (default ในโค้ด + secret prod) + `THSMS_MESSAGE_TYPE=standard` ใน `.env.local` → re-set secrets (201) + redeploy · probe → **`credits_used:1`** ✅ · EF send 200

**แก้ token ซ้ำ:** `.env.local` มี `SUPABASE_ACCESS_TOKEN` **2 บรรทัด** — ตัวเก่า `sbp_fcf…` (มี**เว้นวรรค**ก่อน `=`) ถูกดึงไปใช้ก่อน → 401 · แก้โดย **comment ปิดตัวเก่า** เหลือตัวถูก `bmb-dev-2026-10` (`sbp_fceb…1936`, exp 05 Nov 2026) → ตั้ง secrets ผ่านด้วย 201 (ไม่มี 401)
