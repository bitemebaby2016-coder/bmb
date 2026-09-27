# BMB_OWNER_DECISIONS_LOCKED.md
**Status: OWNER-APPROVED ARCHITECTURE — LOCKED (2026-09-27)**
Normalize จาก Owner Decision Pack 14 ข้อ เป็น implementation-ready spec
เก็บ intent เดิมทั้งหมด — ห้าม AI DEV เปลี่ยน/เจรจา/ตีความใหม่เป็น business decision
ขัดแย้งทางเทคนิค → `STOP → REPORT → ASK OWNER`

## D-01 AI Architecture
- `ai-proxy` (Supabase Edge Function) = Single Gateway ของ AI ทั้งหมด
- Transport: `Client → Supabase Auth JWT → ai-proxy → Provider`
- API keys: **SERVER-SIDE ONLY** (Edge Function env / `supabase secrets set`) —
  ห้ามฝังใน client build / lazy chunk / localStorage / VITE_* env
- สถานะเดิม: ai-proxy ไม่ได้ deploy (404 สด) → ต้อง KEEP & DEPLOY (Wave 3)

## D-02 AI Provider
- Provider: **OpenRouter** เท่านั้น (ห้ามใช้ DeepSeek — ไม่มี integration)
- Primary: `nvidia/nemotron-3-ultra-550b-a55b:free` (Nemotron Free)
- Fallback: `qwen/qwen3.7-flash`, `glm flash` (เมื่อ rate limit / service unavailable)
- เรียกผ่าน ai-proxy ฝั่ง server เท่านั้น

## D-03 Automation
- ไม่ใช้ Make.com — Internal Automation ทั้งหมด: Supabase Edge Functions + Supabase Cron (pg_cron)
- งานเบื้องหลัง: daily-report, generate-rewards, inventory-reorder
- ระบบต้องมี scheduler ตั้งเวลาโพสต์ + คิวโพสต์
- รวบรวมออเดอร์ทุกช่องทางเข้าออเดอร์รวมเดียวกับ PWA (canonical orders)
- ระบบภายนอก (ถ้ามี) = Read-only Observer — ห้ามมี Transaction Authority

## D-04 Omnichannel
สิทธิ์รายช่องทาง:

| ช่องทาง | Create Order | Update Order | Receive Message | Notification |
|---|---|---|---|---|
| PWA | ใช่ | ไม่ (เว้นยกเลิกตาม window) | ใช่ | ใช่ (In-app) |
| Manual (Admin) | ใช่ | ใช่ | ใช่ | ใช่ |
| Facebook | ไม่ | ไม่ | ใช่ | ใช่ |
| Messenger | ไม่ | ไม่ | ใช่ | ใช่ |
| LINE | ไม่ | ไม่ | ใช่ | ใช่ |

- Facebook/Messenger ต้องมี automation รับออเดอร์จริงจากเพจ แต่ห้ามสร้าง confirmed
  transactional order ตรงจาก webhook — flow บังคับ:
  `External Message → Inbound Event → Idempotency → Parse/Extract → Order Draft/Pending
  → PWA/Admin confirmation → Canonical Order RPC → orders`
- ห้าม bypass: price / inventory / capacity / delivery fee / payment / order state machine
- ถ้าไม่มี draft model → ระบุ GAP + ออกแบบ contract ก่อน implement
- Transaction Authority: **PWA + Admin + PostgreSQL** เท่านั้น

## D-05 Delivery Policy
1. ≤5 km: Bite Me Baby Self Delivery (ไรเดอร์ประจำร้าน) เป็นหลัก
2. >5 km: ปลดล็อก Frontend — อนุญาต External Rider / Delivery Provider
3. Provider รองรับ: Grab / LINE MAN (ผ่าน Adapter หรือเรียกโดย Admin/ระบบ)
4. >5 km: Prepayment 100% เท่านั้น — ห้าม COD
5. >5 km: Tracking แสดงในหน้า Tracking ของ BMB + ลิงก์ติดตามสดของ Provider

## D-06 Driver Identity
- เบอร์โทรอย่างเดียว **ไม่พอ** ระบุตัวตน (แก้ F-06)
- Rider ทุกคนต้องมีบัญชี Supabase Auth (Admin provisioning หรือสมัครผ่าน SMS OTP + Password)
- ทุก RPC (รับงาน/ดูข้อมูลลูกค้า/เปลี่ยนสถานะ) ต้องส่ง JWT Bearer เท่านั้น
- DB (RLS/Triggers) ปฏิเสธคำขอที่ส่งแค่เบอร์ใน body ทันที

## D-07 Kitchen Operational Model
- Lifecycle: `Confirmed → Preparing → Ready for Dispatch → Out for Delivery → Delivered`
- Batch: ต่อรอบ + ต่อวัน (Round & Daily Batching)
- Queue: FIFO อิง `confirmed_at`
- Dispatch: Self ≤5 km → แจ้ง Rider PWA เมื่อ Ready for Dispatch;
  External >5 km → ส่งสัญญาณเรียก Provider หรือแจ้ง Admin เรียกรถ
- Cancellation Boundary: ห้ามลูกค้ายกเลิกเมื่อถึง `Preparing` ขึ้นไป

## D-08 Payment
- เปิด Stripe (บัตร) + PromptPay (QR ที่ `public/assets/Qr Code/BMB_Promptpay_Qr`)
- Single Payment Authority: Database RPC เท่านั้น (client ปรับสถานะชำระเงินเองไม่ได้)
- PromptPay/โอน: ผ่าน webhook อัตโนมัติ หรือ Admin RPC `confirm_offline_payment` (Admin-first)
- Cancel window: 5 นาที (`cancel_window_minutes = 5`) หลังสั่ง ถ้ายังไม่ถึง Preparing → คืนเงินอัตโนมัติ

## D-09 Unified Order Source Schema
- ทุกออเดอร์: `order_id` (UUID) + `source_channel` (บังคับ)
- Enum: `PWA | FACEBOOK | MESSENGER | LINE | MANUAL | OTHER`
- ช่องทางภายนอก: บันทึก `external_message_id` / `external_ref_id` เสมอ (Idempotency)

## D-10 Content AI
- AI สร้าง **Draft เท่านั้น** + Approval Gate โดยมนุษย์ (หน้า AdminContentApprovals)
- ข้อห้ามเด็ดขาด: AI ห้ามแตะ ราคา / การชำระเงิน / สต็อก / คืนเงิน / ยกเลิกออเดอร์ /
  ค่าจัดส่ง / สถานะออเดอร์ / Capacity

## D-11 Edge Functions (14 ตัว)
| Function | คำสั่ง |
|---|---|
| ai-proxy | KEEP & DEPLOY (แก้ความปลอดภัย + deploy prod) |
| ai-daily-report | REPLACE/MERGE → รวมเข้า daily-report |
| daily-report | KEEP (ร่วมกับ Supabase Cron) |
| generate-rewards | KEEP |
| inventory-reorder | KEEP |
| random-menu-draw | REMOVE |
| track-share | REMOVE (ใช้ shareable link ฝั่ง client แทน) |
| vote-menu | REMOVE |
| check-inventory / calculate-promotion | REPLACE/MERGE → ย้าย logic ไป Database RPC |

## D-12 Admin Credential
- ROTATE & REVOKE: ยกเลิก credential สาธารณะ `admin@bmb.co.th` บน Production ทันที
- Dedicated Test Admin: สร้างบัญชีทดสอบเฉพาะ — password อยู่ใน secret channel ฝั่งผู้ดูแลเท่านั้น
  ห้าม: commit / hardcode / frontend env / public docs / screenshots / logs
- Production Mutation Boundary: ระหว่าง verification แก้ได้เฉพาะ Test Data ที่ระบุชัด
  (เช่น `TEST-ORDER-...`) — ห้ามแตะออเดอร์ลูกค้าจริง

## D-13 RLS Intent
- `drivers`: Driver Scoped / Admin Only — ไรเดอร์เห็น/แก้เฉพาะของตนเอง; Admin อ่านได้ทั้งหมด;
  ห้ามลูกค้ารายอื่นอ่าน
- `recipes`: Authenticated Read (เฉพาะส่วนเปิดเผย) / Admin Write + Master Recipe = Admin เท่านั้น

## D-14 Test Data Cleanup
- ห้าม DELETE ตรง — Mark `is_test = true` หรือย้ายไปตาราง Archive
- เพื่อไม่ให้ข้อมูลทดสอบเข้า dashboard / รายงานขาย / สถิติ
