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

## 4. Ordered production acceptance checklist (Owner runbook)

> รันบน `https://biteme-baby.com` เท่านั้น · เรียงตามลำดับที่พึ่งพิงกัน · เครื่องหมาย
> `[R]` = อ่านอย่างเดียว · `[O]` = สร้างข้อมูลทดสอบของ Owner เอง (จด order number ไว้)

| # | ขั้น | PASS = |
|---|---|---|
| 1 | `[R]` เปิด CI หลัง push ล่าสุด (Actions: CI + Contract Tests) | ทั้งสองเขียว — Contract รันถึง "Contract 147 OK" |
| 2 | `[R]` หน้าแรก/เมนู/รอบ/โปรโมชันโหลดครบ (desktop + มือถือ) | ไม่มี console error, รูป/ป้ายไม่เพี้ยน |
| 3 | `[O]` สั่ง SAME_DAY 1 ออเดอร์ (รอบยังไม่เลย cutoff) | สร้างสำเร็จ → ติดตามสถานะจริง |
| 4 | `[O]` สั่ง PRE_ORDER บนวันที่มีเมนูปฏิทิน ภายใน 2 ชม. ก่อนส่ง | สำเร็จ · เกินคัทออฟต้องถูกปฏิเสธพร้อมเวลา HH:MM จริง |
| 5 | `[R]` `/admin` ทุกเมนู (desktop sidebar + มือถือ drawer) | ทุกลิงก์ไปหน้าจริง · scroll ขึ้นบนสุดเมื่อเปลี่ยนหน้า · ป้ายคัทออฟ 2 ช่องแสดงในหน้ารอบจัดส่ง |
| 6 | `[R]` หน้ารอบจัดส่ง: ตั้งคัทออฟ 2 ช่องคนละค่าบนรอบเดียว | บันทึกได้ · แถวรอบโชว์ทั้ง 2 ค่า · ล้างช่องพรีออเดอร์ = กลับไปใช้กฎ |
| 7 | `[R]` เปิดเบราว์เซอร์ที่ค้างป้ายแดง (เคส 841) → reload 2 ครั้ง | ป้าย **หายและไม่กลับมา** · bell เห็น "จัดส่งสำเร็จ" บนสุด · "อ่านทั้งหมดแล้ว" ปิด popup เอง · ลิงก์ไป /notifications |
| 8 | `[O]` เปิด push บนมือถือแล้วสั่งออเดอร์ทดสอบ | ได้รับ notification จริง 1 ครั้งต่อสถานะ |
| 9 | `[O]` จ่ายเงินจริง 1 ออเดอร์ + ตรวจสลิปในแอดมิน | สลิปขึ้นหน้าตรวจ · อนุมัติผ่าน · สถานะ paid ตรง DB |
| 10 | `[R]` ตรวจ SMS/ข้อความยืนยัน (ถ้าเปิดใช้) | ส่งถึงเบอร์จริง |
| 11 | `[O]` Rider: อัปโหลด POD บนมือถือ 1 ครั้ง | รูปขึ้นจริง · สถานะจัดส่งเปลี่ยน |
| 12 | `[R]` แผนที่ใน checkout (มือถือ + desktop) | แผนที่โหลด (Maps key ถูกต้อง) |
| 13 | `[R]` `AI_WORK_STATE.md` + แฮนด์ออฟอัปเดต + commit/push ล่าสุดตรง production build | ข้อมูลสถานะไม่ drift |

**ปิดแผนเมื่อ:** #1–#14 ผ่านครบ — รายการใดติดขัด = จด defect ใหม่ใน `AI_WORK_STATE.md`

## 5. ระบบ role 13 ค่า (146/147 · Owner sign-off P1-P3 + missing/partial ทั้งหมด)

### #14 แต่งตั้ง + ทดสอบบน production

**วิธีแต่งตั้ง (ไม่มี UI — SQL Editor ของ Supabase Dashboard):**

```sql
-- (ก) แต่งตั้งบัญชี admin คนแรกเป็น owner
SELECT set_config('request.jwt.claims',
       '{"sub":"<ADMIN-UUID>","role":"authenticated"}', false);
SELECT public.set_user_role('<ADMIN-UUID>'::uuid, 'owner');

-- (ข) ตั้ง role รายบัญชี (ครบทุกกลุ่ม)
SELECT public.set_user_role('<UUID-KITCHEN>'::uuid,   'kitchen');
SELECT public.set_user_role('<UUID-INVENTORY>'::uuid, 'inventory');
SELECT public.set_user_role('<UUID-FINANCE>'::uuid,   'finance');
SELECT public.set_user_role('<UUID-MARKETING>'::uuid, 'marketing');
SELECT public.set_user_role('<UUID-POS>'::uuid,       'pos');
SELECT public.set_user_role('<UUID-SUPPORT>'::uuid,   'support');
SELECT public.set_user_role('<UUID-AUDITOR>'::uuid,   'auditor');
SELECT public.set_user_role('<UUID-DEV>'::uuid,       'developer');
-- rider: ระบบตั้งให้เองเมื่อ link drivers.user_id (trigger drivers_promote_rider)
```

**ขั้นทดสอบ (login ด้วยบัญชีของ role นั้น บน biteme-baby.com):**

| ขั้น | ทำอะไร | PASS = |
|---|---|---|
| 14a | login owner/admin | เห็นเมนูแอดมินครบทุกกลุ่ม |
| 14b | login kitchen → /admin | เห็นเฉพาะ ภาพรวม/ออเดอร์/ครัว/สูตร/รอบ/เมนู — ไม่เห็น รายงาน/ตั้งค่า/องค์กร · สร้าง batch ในหน้าครัวได้จริง |
| 14c | login inventory | เพิ่ม/แก้/ลบวัตถุดิบได้จริง (grant คืน + policy) |
| 14d | login finance | ดูรายงานการเงิน + ปิดวัน (close_day) ได้ |
| 14e | login marketing | สร้าง/อนุมัติโพสต์การตลาดได้ |
| 14f | login pos | เห็น POS/ออเดอร์/ลูกค้า/รายงาน (parity staff เดิม) |
| 14g | login support | เปิดออเดอร์/ลูกค้า/แจ้งเตือน — **แก้ไขอะไรไม่ได้** |
| 14h | login auditor | เปิดได้ทุกหน้ารายงาน/บันทึก — **อ่านอย่างเดียวจริง** |
| 14i | login rider → /rider | PWA ทำงานปกติ (backfill role='rider' แล้ว) |
| 14j | login customer | ไม่เห็นลิงก์ Admin / เข้า /admin ไม่ได้ (redirect `/`) |