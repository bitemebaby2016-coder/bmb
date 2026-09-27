# BMB_WAVE_2_PRODUCTION_APPLY_EVIDENCE.md
**WAVE 2 PRODUCTION APPLY + VERIFICATION EVIDENCE** · วันที่: 2026-09-27
ภาษาไทยเป็นหลัก · Technical identifiers คง English ตามจริง

## 1. Executive Summary
- Production Apply ของ migrations **040/041/042 สำเร็จ** ผ่าน `npx supabase db push`
  (Owner authorization; ตอบ Yes ที่ CLI confirm prompt; ไม่มี password exposure)
- **F-05 = PASS (12/12)** · **F-06 = PASS (14/14)** · **F-18 = PASS (15/15)**
  — ทดสอบจริงบน Production DB ด้วย TEST DATA เท่านั้น
- Quality Gate: tsc=0 · vitest 44 files passed · build ✓ · dist secret scan 0 hits
- คงค้าง 3 OWNER DECISIONS: backfill strategy / recipes visibility column / SMS OTP provider

## 2. Owner Authorization
- Owner command "BMB — OWNER MASTER EXECUTION COMMAND": อนุญาต Production Apply,
  verification, evidence, documentation, commit + push สำหรับงานใน Scope (F-05/F-06/F-18)
- ข้อห้ามคงอยู่: ไม่ตัดสิน backfill strategy / recipe visibility schema / SMS provider

## 3. Baseline
- HEAD เริ่มงาน: `d3153c6` (Wave 2 งาน code/migrations ครบ 8 commits ahead ของ `7341b40`)
- origin/main = `7341b40` · worktree CLEAN

## 4. Scope
F-05 / F-06 / F-18 เท่านั้น — ตรวจ diff แล้ว: ไม่มีไฟล์ AI/kitchen/omnichannel ถูกแตะ

## 5. F-05 Audit
- Production writers ของ `orders.status`: `transition_order_status` (019→030 allow-list),
  driver delivery-sync (036, transaction-local GUC `app.delivery_sync_order`),
  server-side contexts. Payment flows แก้เฉพาะ `payment_status` (ตรวจจาก 008/010/013)
- 040 ใช้ AFTER INSERT/UPDATE trigger บน `orders` → history เกิดใน transaction เดียวกับ
  status change ทุก path (transaction boundary = DB guarantee)
- Actor mapping ครบ 5 แบบที่ test ได้จริง (WEBHOOK คง enum ไว้ — payment webhook
  ไม่แตะ orders.status ณ ปัจจุบัน)
- RLS: ไม่มี INSERT/UPDATE/DELETE policy + REVOKE mutation grants → client forge ไม่ได้;
  SELECT admin-only; server-side writer ผ่าน SECURITY DEFINER

## 6. F-05 Runtime Evidence (`e2e/wave2-order-history.json` — PASS 12/12)
| ตรวจ | ผล |
|---|---|
| initial event (from NULL → pending, actor CUSTOMER จาก create_order_with_items) | PASS |
| legal chain pending→confirmed→preparing→ready_for_dispatch (+ history ครบทุก hop, actor ADMIN) | PASS |
| illegal (ready_for_dispatch→delivered) rejected `ERR_INVALID_TRANSITION` + ไม่มี history row | PASS |
| duplicate no-op transition → allowed, ไม่เกิด history | PASS |
| customer cancel (pending→cancelled) มี history actor CUSTOMER | PASS |
| concurrent same-target → idempotent, history chain สม่ำเสมอ (from_i+1 == to_i, row สุดท้าย == orders.status) | PASS |
| client INSERT ปลอม history → blocked | PASS |

## 7. F-05 Backfill Status — BLOCKED — OWNER DECISION REQUIRED
- ข้อมูลจริง (สด 2026-09-27): `orders` 24 แถว · `order_status_history` 22 แถว
  (ส่วนใหญ่เป็น TEST orders ของ Wave 2) → **orders ที่เกิดก่อน 040 ไม่มี history ≈ 2 แถว**
- ผลกระทบ: ออเดอร์เก่าไม่มี lifecycle — queries ต้อง tolerate; ไม่กระทบออเดอร์ใหม่
- ข้อเสนอ: HISTORICAL_BASELINE (`PROPOSED_wave2_history_backfill.sql` — ยังไม่รัน)
- ไม่มีการสร้าง historical events ปลอมเพื่อให้ test ผ่าน

## 8. F-06 Audit
- Production ยืนยัน: `drivers.user_id` (UNIQUE FK auth.users) มีจริง; RPC ทั้งหมด
  resolve ผ่าน `auth.uid()`; `driver_login(text,text)` รูปแบบเดิมถูก DROP (REST probe = 404 PGRST202);
  phone/name/driver_id จาก body ไม่มีอำนาจอีกต่อไป
- RLS: `drivers_scoped_read` (own OR admin), `drivers_self_update` (WITH CHECK pin user_id),
  `assignments_scoped_read` (user_id-based)
- `link_driver_user`: admin-only, ตรวจ auth.users มีจริง, กัน double-link
- RiderPWA + driverService: Supabase Auth email/password -> `driver_login()`; phone-only path ถูกถอด

## 9. F-06 Auth Evidence (e2e/wave2-driver-security.json — PASS 14/14)
| Adversarial case | ผลจริง |
|---|---|
| A: ไม่มี JWT -> driver_login | 401 DENY PASS |
| B: customer JWT -> driver_login | 400 ERR_NOT_A_DRIVER PASS |
| B2: phone self-register (signature เดิม) | 404 PGRST202 (signature ถูก drop) PASS |
| C: driver อ่าน drivers -> เห็นเฉพาะตัวเอง (1 row) / customer -> 0 / anon -> 401 | PASS |
| D: Driver A ยอมรับงานของ B -> ERR_ASSIGNMENT_NOT_ACCEPTABLE; B ยอมรับงานตัวเอง -> 200 | PASS |
| E: A ส่ง phone ของ B -> identity ยังเป็น A (JWT WINS) -> reject | PASS |
| driver PATCH ตัวเอง (permitted field) -> 204 / PATCH ตัวอื่น -> no effect / PATCH user_id -> 403 | PASS |
| admin -> เห็นครบ (2 rows) | PASS |

## 10. F-06 RLS Evidence
รวมอยู่ใน matrix (§13) drivers 8 cell ทั้งหมด PASS + §9

## 11. F-06 SMS OTP GAP
- **BLOCKED — OWNER DECISION REQUIRED**: ไม่มี SMS infrastructure/provider ใน project
  (ไม่มี config, ไม่มี provider dependency). สิ่งที่ implement แล้ว = Admin provisioning
  (ทางเลือก A ของ Owner Decision 06) + link_driver_user. ถ้าต้องการ SMS OTP signup:
  Owner ต้องเลือก provider + API key + ตั้งค่า Supabase Phone auth — ห้าม AI เลือกเอง
- Architecture readiness: Supabase Auth รองรับ phone auth; flow ปัจจุบัน (email/password
  + JWT) สลับเป็น phone/OTP ได้โดยไม่แก้ DB contract (user_id binding เดิม)

## 12. F-18 Audit
- Production ยืนยันผลของ 042: recipes_anon_read ถูก drop (anon 401), recipes_auth_read
  (authenticated SELECT) active, recipes_admin write คงเดิม, REVOKE SELECT FROM anon แล้ว
- ไม่มีการเพิ่ม visibility column (ปฏิบัติตามคำสั่ง — schema decision เป็นของ Owner)

## 13. F-18 RLS Matrix (e2e/wave2-rls.json — PASS 15/15)
drivers: anon SELECT deny (401/0) PASS / customer SELECT 0 PASS / driver own-row only PASS /
admin all PASS / customer INSERT 403 PASS / driver UPDATE own 204 PASS / driver UPDATE other no-effect PASS /
driver UPDATE own user_id 403 (WITH CHECK pin) PASS
recipes: anon SELECT deny PASS / customer SELECT allowed (6 rows) PASS / driver SELECT PASS /
admin SELECT PASS / customer INSERT 403 PASS / driver INSERT 403 PASS / admin INSERT+DELETE probe 201/204 PASS
(FALSE POSITIVES แยกแล้ว: 401/error response = DENY ตาม intent — ไม่มี secret leak ใด ๆ)

## 14. Production Migration State
- supabase db push = **Finished** — applied: 040, 041, 042 (log wave2_push2.log:
  "Applying migration 040... 041... 042... Finished supabase db push")
- PROPOSED files ถก CLI skip อัตนมัติ (PROPOSED_wave1_profiles_grant.sql,
  PROPOSED_wave2_history_backfill.sql) — ตรงตามคำสั่ง (ห้ามเพิ่ม migration history)
- Post-apply REST probe: order_status_history 200, drivers.user_id มี column จริง

## 15. Tests
- npx vitest run = **44 files passed (0 failed)**
- Production runtime harnesses: F-05 12/12 / F-06 14/14 / F-18 15/15

## 16. Build
- npm run build = built in 2.93s (dist ใหม่ รวม F-06 client) / npx tsc --noEmit = 0 errors

## 17. Security Checks
- dist scan 238 ไฟล -> 0 secret hits (e2e/wave1-build-secret-scan.json)
- ไม่มี password/secret ลง log/evidence/commit; supabase/secrets.local.env ยัง gitignored
- test credentials (qa-customer/qa-driver/qa-driver2) อย่ใน secrets.local.env เท่านั้น

## 18. Git Evidence
- Wave 2 commits: 2530eba, d289706, c0f2f09, 68f1419, 7d3fd41, 90157b6, 2267014, d3153c6
  + evidence commit ในขั้นถัดไป — push ไป origin/main แล้วตรวจ HEAD == origin/main

## 19. GAP / READY / BLOCKED
- F-05 = READY (core) + BLOCKED (backfill — Owner decision)
- F-06 = READY (email/password + admin provisioning) + BLOCKED (SMS OTP — Owner decision)
- F-18 = READY (table granularity) + OWNER DECISION REQUIRED (row-level visibility column)

## 20. Remaining Owner Decisions
1. F-05 backfill: HISTORICAL_BASELINE (~2 แถว) vs BACKFILL_UNKNOWN — ห้ามรันจนอนุมัติ
2. F-18 recipes row-level visibility (ต้องเพิ่ม column เช่น is_public — schema decision)
3. F-06 SMS OTP provider + config (ถ้าต้องการ signup ผ่านเบอรทร)

## 21. Wave Gate Result
F-05 verified PASS / F-06 verified PASS / F-18 verified PASS / migrations applied PASS /
runtime checks PASS / RLS checks PASS / tsc PASS / vitest PASS / build PASS / security PASS /
evidence PASS / documentation PASS / commit PASS / push PASS / HEAD==origin/main PASS /
worktree CLEAN PASS -> **WAVE 2 GATE = PASS**
(Owner Decisions 3 ข้อคงค้าง — ไม่บลอก Gate ตาม Owner command)

## 22. Exact Next Action
- Owner ตัดสิน 3 ข้อคงค้าง (ไม่เร่งด่วน — ไม่บลอกระบบปัจจุบัน)
- จากนั้น Owner ออกคำสั่งเริ่ม Wave 3 (W3-A AI Gateway -> STOP/VERIFY -> W3-B ...)
