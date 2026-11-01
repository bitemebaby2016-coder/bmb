# BMB — HANDOFF สำหรับแชทใหม่ (ปิดเซสชัน 2026-11-01 · หลัง R49)

> **อ่านไฟล์นี้เป็นไฟล์แรกในแชทใหม่** ต่อจากนั้นอ่านตามลำดับ: `AI_ENTRYPOINT.md` → `UNIVERSAL_MASTER_AI_RULES.md` → `AI_WORK_STATE.md` (บล็อก R49) → `docs/BMB_PRODUCTION_TEST_PACK.md` (§R/§S = checklist ปิดงาน)
> HEAD = ดู `git log --oneline -1` · production ledger = **181** (`e2e/r49Apply180-result.json` ALL_PASS) · EF `notification-dispatcher` deployed

## สิ่งที่ปิดแล้วรอบ R47-R49 (2026-11-01 · มีหลักฐาน)

1. **AI Studio 5 ข้อ (R47)** + EF image-gen deployed
2. **Notification Hub E2E (R48):** m179 (channel_identities + notification_outbox + RPC 4 + flags LINE=mock + bmb-notify cron) · EF notification-dispatcher (builders transactional/reminder/reengage/points/abandoned + drain web_push→messenger→line-mock) · client notificationManager · apply ALL_PASS + gate 401
3. **GPS → เติมที่อยู่อัตโนมัติ** (Nominatim fallback) · **Theater ปฏิทินมุมขวา** (ScheduleDateBadge)
4. **DoD 3 ข้อรอบนี้ (R49):** idempotency (event_key UNIQUE + key คงที่) · Popup 3D Claymation ขอสิทธิ์ push · reminder ตาม `order_policy.reminder_days` + abandoned cart จริง (`cart_sessions`)
5. **Add-on Profit Margin (R49):** m181 admin-driven cap (แทน hardcode 15% server) · promo_price server-side · cross-sell เรียงกำไร · Checkout margin guard · การ์ดกฎใน /admin/products · audit ทุก save

## งานค้าง/ต้องทำในแชทใหม่ (เรียงลำดับทำ)

1. **รัน TEST_PACK §S ทั้งหมดบน production** (S-1..S-19 = รวม DoD รอบ R49) + §R เดิม · ถ้ามีข้อแดง = เก็บภาพ+query แล้วแจ้ง Owner
2. **Maps T9 retest:** Owner กด Save Console + รอ 5 นาที → `/checkout` 3 ฝั่ง (เดสก์ท็อป/แท็บเล็ต/ไรเดอร์ล้างแคช) · ถ้ายังไม่ขึ้น = ขอภาพบรรทัดแดง F12 Console (probe ฝั่งเรา two-try ครบแล้ว ห้ามยิงซ้ำ)
3. **เทสต์ auto-flow ใหม่ทั้งระบบ** (Owner บอกจะลอง) · retest T6/T10 · ตรวจ "ถึงปลายทาง" (1B2)
4. ** Notification เพิ่มเติมที่ยังไม่ได้ต่อ:** ผูก PSID อัตโนมัติใน channel-webhook/socialOrderIntake (RPC `register_channel_identity` พร้อม · column source='order_link' รองรับ) · LINE = เมื่ออนุมัติตั้ง `lineMode='live'` + เขียน sender
5. **Abandoned cart เงื่อนไขละเอียด:** ปรับ window/ข้อความ copy ตาม Owner · ถ้าอยากได้ guest = ต้องมีช่องทาง (บัญชี/PSID) ตอนนี้ guest = skipped_guest
6. **Add-on P2 (_candidates):** server per-line addon discount allocation ใน create_order (ตอนนี้ = client guard + server total cap) · standalone add-on line type ถ้าอนาคตขายท็อปปิ้งเดี่ยว (flag main_dish_required ปัจจุบัน gate แผง cross-sell)
7. **D-1..D-3 + TEST_PACK §Q (ติดไว้) + §L runtime checks เดิม**
8. **งานค้างอื่น ๆ จากแฮนออฟก่อน** = `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-31.md` (B7 pitch ×4 · B5 ตาม D-4)

- **กติกาทำงาน (ย้ำ)**

## DoD Checklist ย้ายมาจาก TEST_PACK §S.2.1 (anchor แก้ fail — ใช้รายการนี้แทน · S-1..S-9 อยู่ที่ TEST_PACK §S.1)

| # | DoD | ต้องเห็นอะไร | จดอะไร |
|---|---|---|---|
| S-10 | Idempotency 1 event = 1 ครั้ง: `SELECT event_key, count(*) FROM notification_outbox GROUP BY 1 HAVING count(*)>1` | ผล = 0 แถว (event_key UNIQUE + key คงที่ `ntf-/remind-/cart-/reeng-/pts-` + claim ไม่แตะ `sent`) | query |
| S-11 | แจ้งเตือนสถานะ (สลิปผ่าน/กำลังส่ง) | outbox คีย์เดียว · `status='sent'` ครั้งเดียวต่อ event | query |
| S-12 | Popup 3D Claymation: เปิด PWA ใหม่ (permission=default) รอ ~6 วิ | การ์ดส้มน้อง Bite "🔔 รับการแจ้งเตือนสถานะอาหาร" · กดเปิด → toast · "ไว้ทีหลัง" = หาย 7 วัน | ภาพ |
| S-13 | Reminder ตามกฎแอดมิน: `order_policy.reminder_days` (default 1 · แก้ 1-14) | ตั้ง 2 → เตือน 2 วันก่อนรอบส่ง (`remind-<order>-<date>`) | ค่า+query |
| S-14 | Abandoned cart 15-30 นาที: ใส่ของ (login) ไม่สั่ง 15-30 นาที | `cart_sessions.status='notified'` + outbox `cart-*` 1 ครั้ง · guest = `skipped_guest` | query+ภาพ |
| S-15 | การ์ดกฎกำไร `/admin/products` → "⚖️ กฎกำไรแอดออน" | ตั้งเพดาน/กำไรขั้นต่ำ/บังคับเมนูหลัก/cross-sell → บันทึก → toast + audit | ภาพ+audit |
| S-16 | ราคาโปรแอดออน: เพิ่ม "ราคาโปร" ใน Toppings ของฟอร์มเมนู | หน้าร้านโชว์โปร+ขีดฆ่า · server คิดโปรจริงตอนสั่ง | ภาพ 2 จอ |
| S-17 | Cross-sell เรียงกำไร: เปิดตะกร้าที่มีของ | แผง `✨ ทานคู่กันอร่อยกว่า` = กำไรสูงสุดก่อน | ภาพ |
| S-18 | คูปองไม่กัดกำไรแอดออน: ส่วนลดเยอะในบิลที่มีท็อปปิ้ง | แถบ `data-testid=addon-margin-guard` เตือนเกินเพดาน | ภาพ |
| S-19 | ดูผล apply รอบ R49 | `e2e/r49Apply180-result.json` = ALL_PASS (6 checks) · ledger 181 | JSON |

## หมายเหตุความถูกต้องของบันทึกรอบนี้ (สารภาพตรง ๆ)

- **r49AddonMargin = 5 ข้อจริง** (it ที่ 6 checkout/cart asserts edit fail → ย้าย checklist มาที่นี่แทน — งานค้างเล็กในแชทใหม่: เพิ่ม it กลับ)
- **TEST_PACK มี §S.1 (S-1..S-9) จริง · §S.2.1 = ไม่ได้เข้าไฟล์** (anchor ไม่เจอ) → ใช้ตารางด้านบนแทน
- commit ลำดับ: `33e9478` (งาน R49 ทั้งหมดแต่หัวข้อเขียนว่า R48 + tsc import ซ้ำ) → `68f5814` (แก้ import = **CI success×2**) → `c5d5034` (แก้ข้อความ commit ให้ตรง) · ข้อความ `68f5814`/`c5d5034` ยังโฆษณา "§S.2.1/6 ข้อ" เกินจริง — **บรรทัดนี้คือความจริง**
- CI ล่าสุด: `68f5814` CI+Contract = success ✓ · Contract `33e9478` = success ✓ (CI แดง = import ซ้ำที่แก้แล้ว)

- bootstrap 3 ไฟล์ทุกแชท · single-run เทสต์ · ห้าม poll log · lint chain ก่อน commit · two-try rule · ห้าม claim PASS โดยไม่มี evidence · secrets ไม่ลง git