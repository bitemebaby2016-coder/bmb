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

## กติกาทำงาน (ย้ำ)

- bootstrap 3 ไฟล์ทุกแชท · single-run เทสต์ · ห้าม poll log · lint chain ก่อน commit · two-try rule · ห้าม claim PASS โดยไม่มี evidence · secrets ไม่ลง git