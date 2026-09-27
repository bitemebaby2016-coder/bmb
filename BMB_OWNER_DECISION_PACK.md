# BMB_OWNER_DECISION_PACK.md
**แพ็กการตัดสินใจของเจ้าของระบบ — ช่วงหลัง Reality Freeze / ก่อน Remediation**
**วันที่:** 2026-09-27 · อ้างอิงเท่านั้น: `BMB_MASTER_REALITY_FREEZE.md` + `BMB_MASTER_REALITY_GAP_MAP.md` + `e2e/master-reality-freeze.json` + หลักฐาน Phase 0–6 (ห้ามกลับไปใช้ README/เอกสารเก่าแทน Freeze)
**โหมด:** REMEDIATION PLANNING — **ยังห้าม implementation** · READ-ONLY ABSOLUTE: ห้ามแก้ code/DB/migration/RLS/auth/config · ห้าม rotate secret · ห้าม deploy · ห้ามลบ Edge Function · ห้ามสร้าง integration/ตาราง · ห้ามแก้ production data
**กติกา:** ไม่ให้คำแนะนำ · ไม่บอก option ไหนดีที่สุด · ไม่จัดอันดับ · ไม่เลือกแทน Owner — เป้าหมายคือให้ Owner ตอบครบ 14 ข้อในเอกสารเดียว

## สรุปตารางการตัดสิน (Decision Summary Table)

| ID | Decision | Current Reality | Options | Affected Findings | Dependency Impact | Owner Decision |
|---|---|---|---|---|---|---|
| D-01 | สถาปัตยกรรม AI | ai-proxy = 404 จริง | A. กู้คืน/deploy ai-proxy แบบปลอดภัย · B. ใช้สถาปัตยกรรม server-side อื่นแทน · C. อื่น ๆ (ระบุ) | F-03 | ตัดสินก่อน F-04 และฟีเจอร์ AI ทุกตัว | ______________ |
| D-02 | ผู้ให้บริการ AI | OpenRouter มี path ใน code · DeepSeek ไม่มี implementation | OpenRouter · DeepSeek · ทั้งคู่ (ระบุ primary/fallback) · อื่น ๆ | F-03, F-04 | ต่อเนื่องจาก D-01 | ______________ |
| D-03 | Automation | Make.com = MISSING (ไม่มี implementation เลย) | ใช้ Make.com · ไม่ใช้ · ใช้ internal automation · อื่น ๆ | F-15, F-14 | พึ่ง D-09 (schema source) | ______________ |
| D-04 | Omnichannel | PWA = surface เดียวที่ active · FB/Messenger/LINE = MISSING | ตัดสินช่องทาง + สิทธิ์ต่อช่องทาง (ดู §04) | F-14, F-16 | พึ่ง F-14 ที่ต้องออกแบบก่อน | ______________ |
| D-05 | Delivery | ≤5km backend ✓ · >5km backend ✓ แต่ frontend บล็อก · provider DORMANT (provider_orders=0) | ดู §05 | F-10, F-19 | พึ่ง D-06 (ตัวตน driver) | ______________ |
| D-06 | ตัวตน Driver | driver_login ใช้เบอร์จาก client ไม่มี JWT binding | Supabase Auth · OTP · Admin ออกบัญชีให้ · อื่น ๆ | F-06 | ก่อน D-05 ส่วน >5km | ______________ |
| D-07 | โมเดลงานครัว | พื้นผิวครัว = MISSING (ไม่มี route, 0 แถว) | ดู §07 (workflow/batch/queue/handoff) | F-07, F-19 | พึ่ง F-05 (ประวัติออเดอร์) | ______________ |
| D-08 | การชำระเงิน | Stripe card = READY จริง · PromptPay/COD = ยังไม่พิสูจน์สด | Stripe เดียว · +PromptPay · +PromptPay+COD · อื่น ๆ | F-05 (ตรวจสอบย้อนหลัง) | ก่อนคลื่น 5 (E2E) | ______________ |
| D-09 | แหล่งออเดอร์รวม | ไม่มี source_channel/external-message-id | enum แหล่ง: PWA/FACEBOOK/FACEBOOK_GROUP/MESSENGER/LINE/MANUAL/OTHER (ดู §09) | F-14 | ก่อน D-03, D-04 | ______________ |
| D-10 | Content AI | content generation = DORMANT (0 การอนุมัติ) | A. สร้างร่างเท่านั้น · B. ร่าง+อนุมัติ · C. ร่าง+ตั้งเวลาหลังอนุมัติ · D. อื่น ๆ | F-15 (EF ที่เกี่ยว) | อิสระ (แต่ห้าม AI เป็นอำนาจธุรกรรม) | ______________ |
| D-11 | EF dormant | Active 4 · Source-only 10 | ต่อตัว: KEEP · REPLACE · REMOVE · UNKNOWN/ต้องการหลักฐานเพิ่ม | F-15 | ต่อเนื่อง D-01/D-03 | ______________ |
| D-12 | บัญชีทดสอบ Admin | credential สาธารณะเข้า production admin ได้จริง | rotate/ลบ credential สาธารณะ · สร้างบัญชี test admin จำเพาะ · กำหนดสภาพแวดล้อม/ข้อมูลทดสอบปลอดภัย | F-01, F-02, F-21 | เปิดทางคลื่น 1 และ 5 | ______________ |
| D-13 | เจตนา RLS | drivers/recipes มี grant กว้าง (intent ยังยืนยันไม่ได้) | public read · authenticated read · owner/admin เท่านั้น · driver scoped · อื่น ๆ | F-18 | ก่อนทดสอบสด RLS (คลื่น 2) | ______________ |
| D-14 | ข้อมูลทดสอบ | paid-ไม่มี-PI ×2 · audit 'test' ×6 · ออเดอร์ไม่มีรอบ ×3 | คงไว้ · mark เป็น test · ล้าง · เก็บถาวร · อื่น ๆ | F-20 | อิสระ (ทำเมื่อได้รับอนุญาต) | ______________ |

## §01 DECISION 01 — สถาปัตยกรรม AI

- **ความจริงปัจจุบัน:** ai-proxy ไม่ได้ deploy — GET/POST ตอบ 404 จริงบน production (Phase 6) ทำให้แชท Bite AI ใช้ไม่ได้ทั้งสายหลัง UI
- **เพราะอะไรสำคัญ:** เป็นประตูเดียวของทุกฟีเจอร์ AI; การตัดสินนี้กำหนดขอบเขต provider key ฝั่ง server และการกระจายฟีเจอร์ AI ทั้งหมด
- **ตัวเลือก:** A. กู้คืน/deploy ai-proxy แบบปลอดภัย (key ฝั่ง server) · B. ใช้สถาปัตยกรรม server-side อื่นแทน · C. อื่น ๆ (ระบุ)
- **ระบบที่กระทบ:** Bite AI chat, AI memory, คำแนะนำ, /voice-demo, Edge Functions
- **Findings:** F-03 (CRITICAL), เกี่ยว F-04 · **Dependencies:** ตัดสินก่อน F-04 และทุกฟีเจอร์ AI
- **ยังตัดสินไม่ได้ค้าง:** scope ฟีเจอร์ AI ที่จะรองรับหลัง deploy
- **การตัดสินของ Owner:** ______________________

## §02 DECISION 02 — ผู้ให้บริการ AI

- **ความจริงปัจจุบัน:** OpenRouter เป็น provider เดียวใน code (Model A nemotron free + fallback qwen); DeepSeek ไม่มี implementation ในชั้นใด
- **เพราะอะไรสำคัญ:** กำหนดโมเดลราคา/คุณภาพ/การจัดการ key และเงื่อนไข fallback
- **ตัวเลือก:** OpenRouter · DeepSeek · ทั้งคู่ (ต้องระบุ primary และ fallback) · อื่น ๆ
- **ระบบที่กระทบ:** ai-proxy/EF, aiVoice, aiService, aiModels.ts
- **Findings:** F-03, F-04 · **Dependencies:** ต่อเนื่องจาก D-01; key ต้องอยู่ฝั่ง server เท่านั้น
- **ยังตัดสินไม่ได้ค้าง:** ถ้า "ทั้งคู่" — ใคร primary/ใคร fallback
- **การตัดสินของ Owner:** ______________________

## §03 DECISION 03 — Automation

- **ความจริงปัจจุบัน:** Make.com = MISSING — ไม่มี code/config/DB ใด ๆ (พิสูจน์ Phase 1/6); ไม่มี scheduler/queue/event path
- **เพราะอะไรสำคัญ:** กำหนดว่างานเบื้องหลัง (รายงาน/รางวัล/reorder) ขับเคลื่อนด้วยแพลตฟอร์มภายนอกหรือ internal
- **ตัวเลือก:** ใช้ Make.com (ระบุบทบาท เช่น "back-office worker" — **ไม่ใช่ transaction authority**) · ไม่ใช้ · ใช้ internal automation · อื่น ๆ
- **ระบบที่กระทบ:** EF กลุ่ม job (daily-report/generate-rewards/inventory-reorder), automation domain, audit eventing
- **Findings:** F-15, F-14 · **Dependencies:** พึ่ง D-09 + F-05
- **ยังตัดสินไม่ได้ค้าง:** หากใช้ Make.com — role ที่แน่นอนคืออะไร
- **การตัดสินของ Owner:** ______________________

## §04 DECISION 04 — Omnichannel

- **ความจริงปัจจุบัน:** PWA = พื้นผิวสั่งซื้อเดียวที่ active; FB/Messenger/LINE = แค่ลิงก์ footer; ไม่มี schema รองรับ (F-14)
- **เพราะอะไรสำคัญ:** กำหนด schema (source_channel) และงาน integration ทั้งหมด
- **ตัวเลือกช่องทาง + สิทธิ์ต่อช่องทาง** (กรอก ☐ ใช่/☐ ไม่ ทุกช่อง):

| ช่องทาง | Create Order | Update Order | Receive Customer Message | Receive Notification |
|---|---|---|---|---|
| PWA | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ |
| Facebook | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ |
| Messenger | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ |
| LINE | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ |
| Manual | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ | ☐ ใช่ ☐ ไม่ |

- **ระบบที่กระทบ:** schema ออเดอร์, notifications, EF webhook รับข้อความ (ยังไม่มี)
- **Findings:** F-14 (HIGH), F-16 · **Dependencies:** พึ่ง D-09; กำหนดขอบเขต F-16
- **ยังตัดสินไม่ได้ค้าง:** สิทธิ์รายช่องทางในตารางข้างบน
- **การตัดสินของ Owner:** ______________________

## §05 DECISION 05 — Delivery

- **ความจริงปัจจุบัน:** ≤5km = self delivery ใช้ได้ (ค่าส่ง RPC+โซน ✓) · >5km backend รองรับ (enum 4 ทาง + is_outside_self_zone) แต่ frontend บล็อก (hardcode) · provider ภายนอก = MOCKUP/DORMANT (provider_orders=0)
- **เพราะอะไรสำคัญ:** กำหนดรัศมีบริการจริง ผู้ส่งจริง และเงื่อนไขชำระ/ติดตามสำหรับ >5km
- **คำถามที่ต้องตอบ:**
  1. ≤5km = Bite Me Baby self delivery? ☐ ใช่ ☐ ไม่ (ระบุ: ______)
  2. >5km = external rider/provider? ☐ ใช่ ☐ ไม่
  3. ถ้าใช่ — provider: ☐ biteDrive ☐ Grab ☐ Lineman ☐ Foodpanda ☐ อื่น ๆ (______)
  4. payment timing >5km: ☐ ชำระล่วงหน้า ☐ ชำระเมื่อได้รับ ☐ อื่น ๆ (______)
  5. tracking >5km: ☐ ต้อง tracking สดจาก provider ☐ ตัวตน BMB เพียงพอ ☐ อื่น ๆ
- **ระบบที่กระทบ:** CheckoutPage, deliveryRouter, provider adapters, delivery_assignments/provider_orders, tracking
- **Findings:** F-10, F-19 · **Dependencies:** พึ่ง D-06 ส่วน >5km; กำหนดขอบเขตคลื่น 4
- **ยังตัดสินไม่ได้ค้าง:** คำถามย่อย 5 ข้อ
- **การตัดสินของ Owner:** ______________________

## §06 DECISION 06 — ตัวตน Driver

- **ความจริงปัจจุบัน:** driver_login(p_phone, p_name) สมัครตัวตนอัตโนมัติจากเบอร์ที่ client ส่งมา ไม่มีการผูก JWT (พิสูจน์ function body Phase 5)
- **เพราะอะไรสำคัญ:** ถ้าไม่มี model เข้มแข็ง ใครก็อ้างเป็น rider และรับ/เปลี่ยนสถานะการส่งได้ — บล็อก dispatch จริงทุกกรณี
- **ตัวเลือก:** Supabase Auth (บัญชี rider) · OTP (ยืนยันเบอร์) · Admin ออกบัญชี driver ให้ · อื่น ๆ (ระบุ)
- **เงื่อนไขที่ Owner ต้องยืนยัน:** "เบอร์โทรเพียงอย่างเดียว **ต้องไม่** เพียงพอเป็นตัวตน" — ☐ ใช่ เป็นข้อบังคับ ☐ ไม่
- **ระบบที่กระทบ:** driver RPCs, riders PWA, delivery_assignments, RLS drivers
- **Findings:** F-06 (HIGH) · **Dependencies:** ตัดสินก่อน D-05(>5km) และก่อนมอบงานส่งจริง
- **ยังตัดสินไม่ได้ค้าง:** เงื่อนไขข้างบน + วิธี provisioning rider
- **การตัดสินของ Owner:** ______________________

## §07 DECISION 07 — โมเดลงานครัว

- **ความจริงปัจจุบัน:** พื้นผิวครัว = MISSING (AdminKitchen ไม่มี route · production_batches=0 · get_kitchen_summary ไม่มี caller) · lifecycle จริงไม่เคยเดินเกิน pending/confirmed
- **เพราะอะไรสำคัญ:** กำหนด workflow ผลิตจริง ซึ่งกำหนด UI ครัวและการเชื่อม batch ↔ ออเดอร์ ↔ การส่ง
- **ตัวเลือก workflow:** `Confirmed → Preparing → Ready for Dispatch → Out for Delivery → Delivered` · อื่น ๆ (ระบุ: ______)
- **องค์ประกอบย่อย:** batch/round: ☐ ต่อรอบ+วัน ☐ ต่อเมนู ☐ อื่น ๆ · queue: ☐ FIFO ตามเวลายืนยัน ☐ กลุ่มตามรอบ ☐ อื่น ๆ · preparation status: ☐ enum ปัจจุบัน ☐ เพิ่มสถานะย่อย · dispatch handoff: ☐ self delivery ☐ มอบ provider ☐ อื่น ๆ · cancellation boundary: ☐ ห้ามยกเลิกหลังเริ่มเตรียม ☐ จุดอื่น (______)
- **ระบบที่กระทบ:** หน้าครัว (AdminKitchen หรือใหม่), production_batches(+items), transition_order_status
- **Findings:** F-07, F-19 · **Dependencies:** พึ่ง F-05 (ต้องมีประวัติออเดอร์ก่อน)
- **ยังตัดสินไม่ได้ค้าง:** องค์ประกอบย่อยทั้ง 5
- **การตัดสินของ Owner:** ______________________

## §08 DECISION 08 — การชำระเงิน

- **ความจริงปัจจุบัน:** Stripe card = READY จริง (webhook v41 + PI 6 events + idempotency + refund 1 ครั้ง) · PromptPay/offline/COD = DB/RPC มีแต่ยังไม่พิสูจน์สด
- **เพราะอะไรสำคัญ:** กำหนดขอบเขตช่องทางชำระ ผู้มีอำนาจยืนยัน และนโยบายยกเลิก/คืนเงิน
- **ตัวเลือกช่องทาง:** Stripe เท่านั้น · Stripe + PromptPay · Stripe + PromptPay + COD · อื่น ๆ
- **องค์ประกอบย่อย:** confirmation authority: ☐ DB RPC เป็น authority เดียว (คงเดิม) ☐ อื่น ๆ (______) · offline approval: ☐ admin ยืนยันเท่านั้น (confirm_offline_payment is_admin-first) ☐ อื่น ๆ · cancellation/refund: ☐ หน้าต่างยกเลิกตาม cancel_window_minutes=5 ☐ อื่น ๆ (______)
- **ระบบที่กระทบ:** paymentGateway, create-checkout, stripe-webhook, confirm_offline_payment, payment_intents
- **Findings:** เกี่ยว F-05, F-20 · **Dependencies:** ก่อนคลื่น 5 (E2E สด)
- **ยังตัดสินไม่ได้ค้าง:** ช่องทาง + องค์ประกอบย่อย 3 ข้อ
- **การตัดสินของ Owner:** ______________________

## §09 DECISION 09 — แหล่งออเดอร์รวม (Unified Order Source)

- **ความจริงปัจจุบัน:** ไม่มี source_channel/external-message-id — มีแต่ order_number (BMB-...) ไม่มี identity ช่องทาง
- **เพราะอะไรสำคัญ:** ทุกออเดอร์ต้องมี canonical order_id + identity ช่องทาง เพื่อให้ multi-channel ไม่สับสนและ idempotent
- **ตัวเลือก canonical source enum:** ☐ PWA ☐ FACEBOOK ☐ FACEBOOK_GROUP ☐ MESSENGER ☐ LINE ☐ MANUAL ☐ OTHER (ระบุ: ______)
- **กติกาที่ Owner ต้องยืนยัน:** ทุกออเดอร์ (ทุกช่องทาง) ต้องมี canonical `order_id` + source/channel identity — ☐ ใช่ บังคับ ☐ ไม่
- **ระบบที่กระทบ:** ตาราง orders (เพิ่ม field), RPC สร้างออเดอร์, webhook รับช่องทางในอนาคต
- **Findings:** F-14 (HIGH) · **Dependencies:** ตัดสินก่อน D-03/D-04 และก่อน migration schema ใด ๆ
- **ยังตัดสินไม่ได้ค้าง:** enum ที่เลือก + กติกาบังคับ
- **การตัดสินของ Owner:** ______________________

## §10 DECISION 10 — Content AI Automation

- **ความจริงปัจจุบัน:** content generation = DORMANT (content_approvals = 0 แถว, ไม่เคยใช้) · มี approval gate (canPublish) ตาม design แต่ไม่เคยรันจริง
- **เพราะอะไรสำคัญ:** กำหนดว่า AI จะเข้าถึงเนื้อหาสาธารณะได้ระดับใด — **ห้าม AI เป็นอำนาจของ:** ราคา · การชำระเงิน · สต็อก · คืนเงิน · การยกเลิก · ค่าส่ง · สถานะออเดอร์ · ความจุ (ยืนยันแล้วจาก Phase 6 ว่าไม่มี path ดังกล่าว — การตัดสินนี้คือการล็อกเป็นนโยบาย)
- **ตัวเลือก:** A. สร้างร่างเท่านั้น (Generate draft only) · B. ร่าง + workflow อนุมัติ · C. ร่าง + ตั้งเวลาเผยแพร่หลังอนุมัติ · D. อื่น ๆ (ระบุ)
- **ระบบที่กระทบ:** contentAutomation, contentApproval, submit/review_content RPC, AdminContentApprovals
- **Findings:** เกี่ยว F-15 (EF ที่เกี่ยว), domain 18 (DORMANT) · **Dependencies:** อิสระ (หลังอนุมัตินี้ถึงเปิดใช้ได้)
- **ยังตัดสินไม่ได้ค้าง:** ระดับ A/B/C/D + ใครเป็นผู้อนุมัติ
- **การตัดสินของ Owner:** ______________________

## §11 DECISION 11 — Edge Functions ที่ DORMANT (ตัดสินรายตัว)

- **ความจริงปัจจุบัน:** รวม 14 · Active 4 (create-checkout v33, stripe-webhook v41, stripe-refund v3, phone-auto-login v1) · Source-only/DORMANT 10 (บางตัวไม่พบ caller เลย, ai-proxy พิสูจน์ 404 สด)
- **เพราะอะไรสำคัญ:** ตัดสินนี้กำหนดขอบเขตงาน deploy ของคลื่น 3 — ห้ามลบหรือ deploy ในงานนี้
- **ตัวเลือกต่อตัว:** KEEP · REPLACE · REMOVE · UNKNOWN / ต้องการหลักฐานเพิ่ม

| Edge Function | ผู้เรียกที่รู้จัก | การตัดสินของ Owner (KEEP/REPLACE/REMOVE/UNKNOWN) |
|---|---|---|
| ai-proxy | aiService.ts:53 | ______________ |
| ai-daily-report | ไม่พบ | ______________ |
| daily-report | ไม่พบ | ______________ |
| generate-rewards | ไม่พบ | ______________ |
| inventory-reorder | ไม่พบ | ______________ |
| random-menu-draw | ไม่พบ | ______________ |
| track-share | ไม่พบ | ______________ |
| vote-menu | ไม่พบ | ______________ |
| check-inventory / calculate-promotion (สแกนซ้ำรวมใน 14) | ไม่พบ | ______________ |

- **ระบบที่กระทบ:** Edge Functions, automation, AI
- **Findings:** F-15 (MEDIUM), F-03 · **Dependencies:** ต่อเนื่อง D-01/D-03
- **ยังตัดสินไม่ได้ค้าง:** ทั้ง 10 ตัว
- **การตัดสินของ Owner (รวม):** ______________________

## §12 DECISION 12 — บัญชีทดสอบ Admin / Credential

- **ความจริงปัจจุบัน:** credential สาธารณะ (admin@bmb.co.th/admin123) **เข้า production admin ได้จริง** (ล็อกอินสำเร็จ Phase 4) และแสดงบนหน้า login สาธารณะ
- **เพราะอะไรสำคัญ:** ปิด F-01/F-02 และเปิดทางให้ตรวจสอบหลัง remediation ได้อย่างปลอดภัย (คลื่น 1 และ 5)
- **ตัวเลือก:** rotate/ลบ credential สาธารณะ · สร้างบัญชี test admin จำเพาะ · กำหนดสภาพแวดล้อม/ข้อมูลทดสอบที่ปลอดภัย · ผสมข้างต้น
- **คำถามที่ Owner ต้องตอบ:** production mutation ใดที่ **อนุญาต** ให้ใช้เพื่อ verification หลัง remediation (เช่น สร้าง/แก้แถวทดสอบ, ทดสอบ transition บน test order) — ระบุ: ______
- **ระบบที่กระทบ:** Supabase Auth, หน้า login, บัญชี admin ทุกตัว
- **Findings:** F-01, F-02, F-21 · **Dependencies:** เปิดทางคลื่น 1 → คลื่น 2 → คลื่น 5
- **ห้าม:** เปลี่ยน credential ในงานนี้ (บันทึกการตัดสินเท่านั้น)
- **การตัดสินของ Owner:** ______________________

## §13 DECISION 13 — เจตนา RLS

- **ความจริงปัจจุบัน:** `drivers` มี policy auth_read using=true (authenticated อ่านได้ทุกคน) · `recipes` มี anon SELECT=true (anon อ่านได้ทั้งหมด) · ความปลอดภัยจริงพึ่ง policy กรอง — intent ยังยืนยันไม่ได้ (ยังไม่ทดสอบสด)
- **เพราะอะไรสำคัญ:** ถ้า broad grant ไม่ใช่เจตนา = ช่องโหว่การอ่านข้อมูล; ถ้าใช่ = ต้องบันทึกเป็น design เพื่อไม่ถูกแก้ผิดในอนาคต
- **ตัวเลือกโมเดลการเข้าถึง (ต่อตาราง):** public read · authenticated read · owner/admin เท่านั้น · driver scoped · อื่น ๆ

| ตาราง | โมเดลที่ Owner ต้องการ |
|---|---|
| drivers | ______________ |
| recipes | ______________ |

- **ระบบที่กระทบ:** RLS policies, driver RPCs, หน้า recipe สาธารณะ (ถ้ามี)
- **Findings:** F-18 · **Dependencies:** ก่อนการทดสอบสด RLS ในคลื่น 2
- **ห้าม:** แก้ policy ในงานนี้
- **การตัดสินของ Owner:** ______________________

## §14 DECISION 14 — ข้อมูลทดสอบใน Production

- **ความจริงปัจจุบัน:** paid-แต่-ไม่มี-PI ×2 (test artifacts 2026-09-19) · audit_logs action='test' ×6 · ออเดอร์ไม่มีรอบ ×3 — อธิบายได้ว่ามาจากการทดสอบ ยังไม่ถูกแตะ
- **เพราะอะไรสำคัญ:** ข้อมูลปนเปื้อนทำให้ metric/forensics คลาดเคลื่อน; การตัดสินกำหนดว่าจะทำอย่างไรเมื่อได้รับอนุญาต
- **ตัวเลือก:** คงไว้ (preserve) · mark เป็น test · ล้าง (clean) · เก็บถาวร (archive) · อื่น ๆ
- **ระบบที่กระทบ:** orders, payment_intents, audit_logs
- **Findings:** F-20 · **Dependencies:** อิสระ — ดำเนินการได้เฉพาะเมื่อ Owner อนุญาต
- **ห้าม:** แก้ production data ในงานนี้
- **การตัดสินของ Owner:** ______________________

## เกณฑ์การยอมรับ + สถานะ

- ครบ **14 decisions** ✓ (§01–§14 + ตารางสรุป) · trace กลับ Master Gap Map ได้ (ทุก decision อ้าง F-XX) ✓ · **ไม่มี implementation** ✓ · **ไม่มี production mutation** ✓ · **ไม่มี deployment** ✓ · **ไม่มีการเปลี่ยน secret** ✓ · ไม่มีคำแนะนำ/การจัดอันดับ/การเลือกแทน Owner ✓

**OWNER DECISION PACK = READY**

**HARD STOP** — รอ Owner ตอบ 14 decisions (กรอกช่อง "การตัดสินของ Owner" ทั้งหมด) — ห้ามเริ่มคลื่นงานแก้ใด ๆ จนกว่าจะได้คำตอบ