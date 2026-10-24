# BMB — E2E / Production Acceptance Plan (2026-10-24)

> **Handoff task 6 (P2).** แผนตรวจสอบการเดินทางลูกค้าจริงบน production —
> **ไม่มีการ mutate production ในเอกสารนี้**; checklist ด้านท้ายเป็นของ **Owner หรือ
> ผู้ได้รับมอบหมายให้รันเอง** · อ้าง domains: `biteme-baby.com` (deploy ปัจจุบัน,
> auto-deploy) · `bitemebaby-5f7.pages.dev` = STALE ห้ามใช้ตรวจภาพ

## 1. Journey map — stage × automated coverage (source evidence)

| # | Stage (ลูกค้าจริง) | automated coverage ที่มี | ชนิดหลักฐาน |
|---|---|---|---|
| A | เปิดเว็บ/เลือกเมนู/ดูรอบ (browse) | vitest catalog/productSchedule/deliveryRoundStatus/routeRealData · playwright `routeNav.spec.ts` (ทุก route + guard + console errors) | unit + browser smoke |
| B | ตะกร้า/คูปอง/เพิ่ม-ลด (cart) | vitest cartStore/cartPersistence/cartLineIdentity/menuCartResultGuard/cartIsolationStore/checkoutModeLock/checkoutMixedSplit | unit |
| C | สั่งซื้อ (order create) | **SQL contracts 123,124,127-145** (gate 142/143/145, capacity, idempotency, shared-slot, cutoff 2 ช่อง) + vitest checkout flows | contract (server authority) + unit |
| D | จ่ายเงิน (pay) | contracts 028/133 (slip) + vitest paymentStateMachine/paymentExceptions/paymentIntentsSingleRead/stripe+omise webhook signature | contract + unit |
| E | เตรียมอาหาร (prepare) | contracts 019/029 kitchen + vitest kitchenService/orderStateMachine/adminDeliveryAdvance | contract + unit |
| F | จัดส่ง (deliver) | contracts 036/135/140 (rider/dispatch/auto-close) + vitest routeEta/rider flows | contract + unit |
| G | แจ้งเตือน (notify) | contracts 131 + vitest **notificationReconciliation (ใหม่)** + push service tests | unit (runtime = checklist) |
| H | แอดมินทั้งหมด (ops) | vitest 30+ admin suites + **adminNavFeedback (ใหม่)** + source contracts | unit |

## 2. Gap register (ช่องว่างระหว่าง automated กับ production จริง)

| Gap | stage | สถานะ | วิธีปิด |
|---|---|---|---|
| ป้ายแจ้งเตือนแดงค้างหลัง reload (เคส 841) | G | โค้ดแก้แล้ว + เทสต์แล้ว — **ยังไม่ runtime-verify บนเบราว์เซอร์จริง** | checklist #7 |
| การจ่ายเงินจริง (Stripe/PromptPay/Omise บนค่าจริง) | D | เทสต์ sandbox/signature เท่านั้น | checklist #9 |
| Web push ถึงเครื่องจริง + หมุน subscription | G | runtime-probe บางส่วน | checklist #8 |
| SMS ส่งจริง (TEXT iO) | G | W23 probe ครั้งก่อน | checklist #10 |
| Rider POD upload (D-02) + กล้องมือถือ | F | เคยติด RLS/พื้นที่ (Recovery Plan D-02) | checklist #11 |
| แผนที่ (Maps key อ่านตอน build) | A/F | ต้องมี env ใน Cloudflare | checklist #12 |
| Desktop+mobile visual ของ admin nav | H | unit/source test แล้ว — ตาตรวจจริง = Owner | checklist #5 |
| คัทออฟ 2 ช่อง (งาน 4) บน production | C | migration + contract เขียวใน ephemeral — production apply แล้ว/รัน checklist | checklist #6 |

## 3. หลักการ (ห้ามละเมิด)

1. อ่าน-อย่างเดียว = ไม่ต้องขอ · การสั่ง/แก้ข้อมูลจริง = ทำเฉพาะ checklist ที่ระบุและ
   **บันทึก audit ไว้** — ห้าม blanket clear / blanket update
2. การแก้ schema/RLS/auth = ต้องผ่าน `BMB_ROLE_PERMISSION_AI_AUDIT_2026-10-24.md`
   + Owner sign-off เสมอ
3. หลักฐานทุกขั้น = screenshot/log/query result จริง — "จำไม่ได้" = ไม่ผ่าน
4. contract/verify scripts ทั้งหมด = ROLLBACK / read-only ห้ามชี้ไป production โดย
   ไม่ตั้งใจ (ใช้เฉพาะผ่าน Management API + script ที่ระบุ)