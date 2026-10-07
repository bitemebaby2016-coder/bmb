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
