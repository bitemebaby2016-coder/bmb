# BMB — STALE CONTRACTS 8 ไฟล์: รายงานซ่อม + หลักฐาน (2026-10-25 · Task A)
> Harness: Docker `bmb-pg` (postgres:16) · DB `bmb_verify` ใหม่ทุกรอบ · prelude+preprocessor = **CI verbatim**
> (`contract-tests.yml` rules) · **MIGRATIONS_OK 001-151 clean** ทุกครั้ง · ไฟล์ contract ทุกไฟล์ = BEGIN…ROLLBACK

## A. ผลรวมรอบสุดท้าย (`e2e/contracts_*.sql` ทั้งหมด 40 ไฟล์)
- **OK 32:** mandate **023 · 028 · 030 · 036 · 037 · 038 · 125 (7/8)** + 123,124,127-130,131,132,133,135,136,137,138_139,140,141,142,143,144,146,147,148,149 (= CI contract set ทั้งหมด เขียว)
- **FAIL 8:** **039 (G7 ข้อเดียว — เหตุผลด้านล้าง)** + ไฟล์นอก mandate 7: 017_018/019/020/021/022/029/033
  (สายเก่า · ไม่อยู่ใน CI steps · ไม่ได้แตะในรอบนี้ — รอ Owner สั่งเพิ่มถ้าต้องการ)

## B. ตารางซ่อมรายไฟล์ (ชั้นความล้มเหลว → แก้ → พิสูจน์)
| ไฟล์ | ชั้นที่เคยล้ม (evidence จาก replay) | การแก้ (ทุกอย่าง fixture/realign ใน txn ROLLBACK) | ผล |
|---|---|---|---|
| 023 | (1) radius 212 กม. (2) menu-gate 142 (3) `mark_payment_failed` หาย (4) `ERR_NO_PAYMENT_INTENT` (5) T4 flag-mode ถูก 142 แทนที่ | kitchen 10.7016/102.1429+รัศมี 5 · menu blanket วัน+2 · T14 → `record_payment_result(status='failed')` (canonical · aa43dc2+bmbAdminApi_orders.ts:408) + intent seed · T4 → วัน+1 ไร้เมนู คาด menu-gate (คอมเมนต์อ้าง 142 G2/Feature A) | **rc=0** |
| 028 | (1) radius (2) menu (3) `mark_payment_failed` (4) `ERR_EXTERNAL_METHOD_DISABLED: grab_rider` | fixture เดิม + T7 → `record_payment_result` (amount=t, key ใหม่ — T8 count=2 คงเดิม) · เปิด `external_methods_enabled:["grab_rider"]` (112 W-1.4 default []) | **rc=0** |
| 030 | radius + menu-gate (prod-5/6 @+2) | kitchen fixture + menu rows แบบ 142 | **rc=0** |
| 036 | radius (SAME_DAY create โดน 5 กม. gate) | kitchen fixture | **rc=0** |
| 037 | (1) zone fee 35≠25 (2) `driver_login` 2-arg หาย (3) `guard_profile_mutation` claims=ลูกค้า (4) `resolve_home_branch_id` deny | deactivate โซน 095×3 ใน txn (020 zone-city 0-5=25 คืนสภาพ) · rider fixture แบบ 036 (auth user+drivers.user_id+claims rider) + admin claims ก่อน UPDATE · assignment INSERT = `RESET ROLE` postgres · (คง transition 3 บรรทัดไว้ครบ) | **rc=0** |
| 038 | (1) menu-gate (2) permission business_settings ×2 (3) G3 "TODAY" ล้าสมัยตาม 143 | menu rows วัน-1/0/+1/+5 (prod-6) · `RESET ROLE` ก่อน UPDATE setting (2 จุด: reproduce + defect ชนิดเดียวกัน) · G3 → ทดสอบ PAST แทน (143 = Owner production test "พรีออเดอร์วันนี้ได้") — error รับชุดเดิม | **rc=0** |
| 125 | T5: claims ว่าง `''` → parse json ล้ม | set claims `{"role":"anon"}` (parse ได้ ไม่มี sub) → guard `ERR_NOT_AUTHENTICATED` จริง | **rc=0** |
| 039 | (1) radius (2) G3b error ระดับ cart (3) G4 legacy-gate ถูก 142 ยกเลิก (4) **G7** | kitchen fixture · G3b รับ `ERR_PRE_ORDER_REQUIRES_MENU` (อ้าง 142 G4) · G4 → คาด REJECTION (อ้าง 141/142 R5c) · **G1–G6 PASS** | ⛔ **G7 = defect จริง** |

## C. 039 G7 — ทำไมไม่แก้เอง (ต้อง Owner)
- ข้อเท็จจริง: `set_menu_schedule`(039:61)/`publish_menu_schedule`(039:120,123) **ไม่มี REVOKE/GRANT ใด ๆ**
  จาก PUBLIC/anon ในทุก migration (probe ทั้ง corpus + Select-String GRANT/REVOKE ใน 039 = 4 บรรทัด
  เป็นของ get_menu/enforce_* เท่านั้น) → default PUBLIC EXECUTE → `has_function_privilege(anon)=true` = FAIL G7
- ความร้ายแรง: มี internal `is_admin()` gate คุม (G2 ผ่าน) → ไม่ใช่ช่องเปิดเขียน แต่ขาด defense-in-depth
  ที่สัญญาเรียกร้อง · production artifact `prod-contracts-result.json` ไม่มีบรรทัด 039 (ไม่มีหลักฐานด้านใดด้านหนึ่ง)
- **ทางแก้ที่ถูก:** `REVOKE EXECUTE ON FUNCTION public.set_menu_schedule(date,jsonb),
  public.publish_menu_schedule(date,boolean) FROM PUBLIC, anon;` = security/schema change
  → ต้อง **Owner sign-off** (acceptance plan §3 + §6 ห้ามแก้เอง) · ห้ามแก้ assertion ฝ่ายเดียว (rules 0.5/0.6)

## D. หลักฐานอื่นของรอบนี้
- Full gates (src): tsc 0 · lint+brandNameGuard 0 · **vitest 139 files/1427 tests 0 fail** · build 0 ✓
- Targeted (banner fix): preOrderEntry 10 + homeMenuAdminOrdering 9 = **19/19** ✓
- **R-17 restore drill: `dbRestoreDrill: PASS`** (bucket private · latest backup · manifest sha256/size · dump structure — fail-closed, read-only)
- sed-rule CI parity: pattern A `COUNT(\*)` = ไม่ทำงาน (พิสูจน์) · pattern B `COUNT\(\*\)` = ตรง CI → ใช้ B ทุกที่