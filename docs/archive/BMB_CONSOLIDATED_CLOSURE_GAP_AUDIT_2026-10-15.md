# BMB — CONSOLIDATED PRODUCTION CLOSURE GAP AUDIT (2026-10-15)
## READ-ONLY BASELINE + ACCEPTANCE READINESS PLAN

> **โหมด: READ-ONLY 100%** — หลักฐานทั้งหมดมาจากการ `SELECT`/`GET` เท่านั้น (Management API database/query + PostgREST anon + HTTP GET)
> ไม่มีการ apply migration · เปลี่ยนข้อมูล · publish · จ่ายเงิน · ส่ง SMS/push · dispatch · ลบข้อมูล · commit/push/deploy (ไฟล์นี้ = untracked โดยเจตนา)
> Evidence timestamp ทั้งหมด: **2026-10-15** · เทียบ baseline 2026-10-14 · ศัพท์สถานะ: IMPLEMENTED · CONNECTED · DEPLOYED · RUNTIME VERIFIED · DOCUMENTED · MISSING · BLOCKED · DEFERRED

---

## 1. Git / Deployment baseline

| รายการ | ผลตรวจ 2026-10-15 |
|---|---|
| HEAD = origin/main = ls-remote | **`0587947`** ตรงกันทั้งสาม (`d52f9a2` UX fix · `9d4f747` assets/evidence · `0587947` docs status) |
| Worktree | **สะอาด 100%** — staged 0 · unstaged 0 · untracked 0 |
| Stash | `stash@{0}: local-edits-before-sync-2026-09-21` — **ครบ ไม่ถูกแตะ** (9 ไฟล์ +4,291/−499) → preserve ต่อ |
| ไฟล์นอก git (ignored/local) | `backups/prod-full-20261006-*.sql` ×3 (4.67MB = dump ฐาน prod 2026-10-06 — backup base) · `e2e/artifacts/` · `public/assets/reviews/*.jpg` (ใช้บนเว็บ) · `.env`/`.env.local`/`supabase/secrets.local.env` |
| สุขอนามัยเล็กน้อย | `v1.txt`(486B)/`v2.txt`(0B) = scratch ที่ถูก track อยู่ — ควร retire ภายหลัง |
| Deployed production | `biteme-baby.com` HTTP 200 · `assets/index-D5g1w0jk.js`(198KB) + `index-CQonLfod.css`(144KB) + lazy chunks 90 ไฟล์ |
| **Deployed == HEAD** | **ใช่** — marker scan: CSS มี `:has(.sched-cal`=1 · `is-open`=1 · `sched-cal`=30 (เฉพาะ commit `d52f9a2`) + `bite_closed`=3 (c275e1e) → โค้ดที่เสิร์ฟ = โค้ด HEAD (asset `index-0s4lXvhI` ของ baseline เก่า = superseded) |

## 2. BLOCKER MATRIX — ทุก open item (หลักฐาน 2026-10-15)

| # | หัวข้อ | Source / path | Evidence | สถานะ | Sev | Dependencies | Owner action | Closure |
|---|---|---|---|---|---|---|---|---|
| 1 | **Migration 124** idempotency | `124_order_submit_idempotency.sql` · `e2e/contracts_124_idempotency.sql` (T1-T18+T2b) | `order_submissions` ไม่มี (42P01) · ledger max=123 | IMPLEMENTED+ISOLATED / prod **DEFERRED** | สูง | R9/R12 มติ · R10 ✅ · R11 | ลงนาม diff 124 (W5C R1-R3+T14-18 แล้ว) + สั่ง apply | แถว 124 ใน ledger + double-submit smoke |
| 2 | `orders.delivery_address` + RPC `dropoff_detail` | `PROPOSED_wave5_..sql` · `bmbAdminApi_orders.ts:71` · `DeliveryManagement.tsx:220` | **คอลัมน์ไม่มีจริงบน prod** (orders 31 คอลัมน์ มีแค่ dropoff_detail) · trigger จริง `trg_pre_order_address_check` = `UPDATE OF order_mode, dropoff_detail` ไม่พึ่งคอลัมน์นี้ | DEFERRED + UI '—' = บั๊กจริง | ต่ำ/กลาง | Owner เลือก backfill vs UI | **UI fallback อ่าน dropoff_detail ก่อน** (เสี่ยงน้อยสุด) · migration = optional | หน้าจัดส่งเห็นที่อยู่ |
| 3 | R9 retention/PII `order_submissions` | W5B R9 | ผูกกับ 124 | DEFERRED | ต่ำ | 124 | TTL 90 วัน / mask PII | มติบันทึก |
| 4 | **R10 prod precheck 18-param** | `pg_proc` (SELECT) | **`pronargs=18` ท้าย=`p_customer_ref uuid`** ตรง signature 118 | **RUNTIME VERIFIED — ปิดรอบนี้** | — | — | — | บรรทัดนี้ |
| 5 | R11 `_i` PostgREST + pgbouncer | W5B R11 | ไม่มี staging | **BLOCKED** | กลาง | staging | อนุญาต staging / ยอมรับความเสี่ยง | ผลบน staging |
| 6 | R12 md5→sha256 | `124:79-85` | ยังใช้ md5 | DEFERRED | ต่ำ | R1 | จดมติ | commit แก้ |
| 7 | `unique_violation` coverage | W5C note | isolated เท่านั้น (ยอมรับไว้) | DEFERRED | ต่ำ | 124 | จดมติเดิม | — |
| 8 | Stripe live | edge `create-checkout`/`stripe-webhook`/`stripe-refund` | intents 47 = test ทั้งหมด (completed 28/pending 10/refunded 8/partial 1) · ชื่อคีย์ live มีใน `.env.local` แต่ไม่ยืนยันค่า/CF env | CONNECTED(test) · Live **ไม่ verified** | สูง(เปิดร้าน)/ต่ำ(เทสต์) | Owner cutover | ตัดสิน live หลังเทสต์เล็ก | charge จริง 1 + webhook |
| 9 | Omise live | edge `omise-*` | key test เท่านั้น · intents omise=0 | CONNECTED(test) · Live **MISSING** | กลาง | Owner | ถ้าใช้ = ขอ live key | intent จริง 1 |
| 10 | **PromptPay QR/โอน manual** | `payment_intents` + `record_payment_result` + คู่มือ บ.8 | promptpay 9 (completed 2/pending 4/processing 3) — **เคยสำเร็จจริง 2 ครั้ง** · คู่ค์ผ่าน order_number + `uq_payment_intents_provider_id` | **RUNTIME VERIFIED — ทางที่เหมาะกับเทสต์เงินจริง** | — | ไม่พึ่ง live key | ใช้ในเทสต์ ≤300 | เงินเข้าจริง + completed |
| 11 | THSMS | edge `sms-send`/`otp-send` · `BMB_W23_..md` (07 ต.ค.) | หลักฐานเก่า DOCUMENTED · รอบนี้ไม่ส่ง (side effect) | CONNECTED · runtime ปัจจุบัน **MISSING** | กลาง(OTP) | อนุญาตส่ง 1 ข้อความ | ส่ง OTP ทดสอบ 1 ครั้ง | log 1 ข้อความ |
| 12 | Meta real events | edge `channel-webhook` · `META_*` | test mode เท่านั้น · permissions/events จริงไม่ยืนยัน | CONNECTED(test) · real **MISSING** | ต่ำ | Owner | ตรวจสิทธิ์ Page | event จริง 1 |

| 13 | Push subs=0 + dead queue 13 | edge `push-send`/`queue-dispatcher` · `push_subscriptions` · `automation_queue` | subs=0 · queue: succeeded **1,555**/dead **13** (`notification_dispatch` — เท่าเดิม ไม่มี retry/clear) · queue เดินหน้าจริง +116 ตั้งแต่ 14 ต.ค. | IMPLEMENTED · queue RUNTIME VERIFIED · dead-letter **MISSING** | ต่ำ–กลาง | — | มติ retry/clear (backup ก่อน) | dead=0 หรือมีมติ |
| 14 | Staging environment | — | ยังไม่มี | **MISSING** | กลาง | งบ Owner | ดู §6 | provision |
| 15 | `VITE_FEATURE_BRAND_ROUTING` under-flag | `src` (มี test ครอบ) | OFF ทุก env | DEFERRED | ต่ำ | — | — | runtime check ใต้ flag |
| 16 | **menu_schedule published=0** | `menu_schedule` · `/admin/menu-schedule` (คู่มือ บ.10) | มี 6 แถว (16/19/20 ต.ค. ×2) **is_published=false ทั้งหมด** · anon เห็น 0 = RLS ถูกต้อง → ป้ายไม่แสดง | data **MISSING** (รอ publish) | **สูง** | Owner | **Menu Schedule → เลือกเมนู → Publish** (บ.10) | ป้ายขึ้นจริง |
| 17 | Visual QA ป้าย+มือถือ (มีป้าย) | Playwright | ผ่าน 39/39 เฉพาะกรณี 0 ป้าย | DEFERRED | ต่ำ | ข้อ 16 | — | Playwright รอบมีป้าย |
| 18 | Production smoke หลัง 3 commits | §7 | deploy ยืนยันแล้ว (marker) · smoke ยังไม่รัน | DEPLOYED · smoke **DEFERRED** | กลาง | อนุมัติ | อนุญาต §7 ชุด A | smoke log |
| 19 | Stash disposition | `stash@{0}` | ครบ 9 ไฟล์ | DEFERRED | ต่ำ | Owner | กู้/ทิ้ง | บันทึกมติ |
| 20 | เมนูข้อมูลทดสอบ (ชื่อ/รูป/คำบรรยาย) | `/admin/products` (บ.9.1) | ยังมีคำบรรยายทดสอบ ("Test description" ฯลฯ) | MISSING (content) | กลาง | Owner | แก้ในแอดมิน | เว็บไม่มีข้อความทดสอบ |
| 21 | **DRIFT: migration 125 ไม่บันทึก** | `125_driver_home_branch.sql` · `pg_proc` | `resolve_home_branch_id`+RPC ทั้ง 3 (uses_resolver=true)+column defaults **อยู่จริงบน prod** แต่ `schema_migrations` **ไม่มีแถว 124/125** | IMPLEMENTED(live) / ledger **ผิด** | **กลาง** (db push รอบหน้าจะ apply ซ้ำ) | ops | บันทึก ledger ย้อนหลัง / re-apply ผ่าน supabase cli | มีแถว 125 ใน ledger |
| 22 | **DRIFT: คำอธิบาย PROPOSED wave5 ผิด** | `PROPOSED_wave5_..sql:10` | บอกว่า "prod มีคอลัมน์ delivery_address จาก manual-era" — **probe ยืนยันว่าไม่มี** | DOCUMENTED ต้องแก้ | ต่ำ | ข้อ 2 | แก้ comment ก่อน apply (SQL ใช้ได้) | commit แก้ |
| 23 | **Rider/ครัว→ส่ง + รอบส่ง** | `drivers`(6: busy5/offline1) · `delivery_assignments`(10) · `delivery_zones`(6) · `delivery_rounds`(45) · `DeliveryManagement.tsx` · `RiderPwaPage→RiderPWA` | เคยส่งจริง (assignments 10) · **round ทั้ง 45 อยู่ในอดีต (max 2026-10-14) — ไม่มีรอบอนาคต** | IMPLEMENTED+RUNTIME VERIFIED(อดีต) · รอบอนาคต **MISSING** | **สูง** | Owner | สร้างรอบวันทดสอบ (บ.7.1) + เตรียมไรเดอร์ | assignment ใหม่ delivered |
| 24 | RC-5 deploy SHA binding | W5B §6.2 | ยังไม่มี build identity ในระบบ | MISSING | ต่ำ–กลาง | — | มติ (marker scan = interim) | deploy metadata |

**อ่านสรุป:** ปิดรอบนี้ = ข้อ 4 (R10) · ของที่ **ต้องทำก่อนเทสต์เงินจริง** = ข้อ 16 + 23 + ตัดสินข้อ 1 + ข้อ 20 · ที่เหลือ = ความเรียบร้อย/ก่อนเปิดร้าน

## 3. Migration & Database Safety (§3 — อ่านอย่างเดียว)

**สถานะ history จริง (SELECT `supabase_migrations.schema_migrations` 2026-10-15):** count=123 · max=123 (001–123) · **124 และ 125 ไม่มีแถวใน ledger**

| หัวข้อ | ผลตรวจจริง |
|---|---|
| Migration 124 เข้า prod หรือยัง | **ยังไม่เข้า** — `order_submissions` = `42P01 relation does not exist` (ยืนยันสองทาง: ledger + relation) |
| **R10 precheck (ปิดแล้ว)** | `create_order_with_items` = **18 args** (`pronargs=18`) ท้ายด้วย `p_customer_ref uuid` = signature 118 เป๊ะ → named args ของ 124 (`p_source_channel`/`p_external_ref_id`/`p_customer_ref`) **ใช้ได้กับ schema ปัจจุบัน** — เงื่อนไขก่อน apply 124 ข้อเดียวที่เคย BLOCKED = **ผ่านแล้ว** |
| **ความเข้ากันได้ 124 ↔ schema** | ✅ 18-param RPC มี · ✅ ตาราง `payment_intents` แยกเดี่ยว (submit ไม่แตะ — T8b) · ✅ unique เดิมบน orders (`uq_orders_channel_extref`, `orders_order_number_key`) ไม่ชน · ⚠️ `_i` ยังไม่เคยผ่าน PostgREST/pgbouncer จริง (R11) · ⚠️ ledger ต้องเพิ่มแถว 124 ตอน apply ให้ครบ |
| **DRIFT ใหม่ (ข้อ 21)** | m125 (`resolve_home_branch_id`, `upsert_driver`/`assign_driver`/`driver_login` rewrite, DEFAULT บน `drivers.home_branch_id`) **อยู่จริงบน prod แล้ว** แต่ไม่มีแถว ledger = apply แบบ manual → `supabase db push` รอบหน้าจะพยายามรัน 125 ซ้ำ → **ต้อง reconcile ledger ก่อน deploy ฝั่ง DB ครั้งต่อไป** |
| **DRIFT ใหม่ (ข้อ 22)** | `orders.delivery_address` = **ไม่มีบน prod** (31 คอลัมน์ — ยืนยันด้วย `information_schema` + `pg_trigger`) · trigger จริง `trg_pre_order_address_check` = `UPDATE OF order_mode, dropoff_detail` **ไม่พึ่งคอลัมน์นี้** → คำใน PROPOSED wave5 ที่ว่า "prod มีคอลัมน์นี้อยู่แล้ว" = **ผิด** · ผลคือ apply PROPOSED = เสี่ยงต่ำ (`ADD COLUMN IF NOT EXISTS` metadata-only) แต่**ไม่จำเป็นต่อเส้นทางสั่งซื้อ** — แนะนำ UI fallback ก่อน (matrix ข้อ 2) |
| Unique indexes ปัจจุบัน | `orders`: pkey + `orders_order_number_key` + `uq_orders_order_number` + `uq_orders_channel_extref` · `payment_intents`: pkey + `uq_payment_intents_provider_id` · `menu_schedule`: pkey + `menu_schedule_scheduled_date_product_id_key` (กันวัน+เมนูซ้ำ) |
| Order creation/read paths (reconcile ครบ) | **เขียน:** `m1Submit.ts` → RPC `create_order_with_items`(18) = canonical · channel path (webhook `channel-webhook`/048/117) มี `uq_orders_channel_extref` กันซ้ำ · guest/OTP = เข้าทางเดียวกัน · **อ่าน:** `bmbAdminApi_orders.ts` (`orders.select('*')`), OrdersPage/OrderTrackPage · **เงิน:** `payment_intents` + `record_payment_result` (idempotent, grants: service_role+postgres เท่านั้น) |
| Replay/concurrency/dup payment | ทดสอบแล้วบน isolated: T1–T18 + T2b (replay marker `replay:true` + คืนสถานะปัจจุบัน = R3 ปิดแล้ว) + `concurrency_124.sh` 2 sessions จริง → **ยังเหลือ R11 (prod runtime)** |
| Rollback plan 124 | `DROP TABLE order_submissions` + `CREATE OR REPLACE create_order_with_items` ตาม definition ใน `118_restore_fc_gates_after_117.sql` + ลบแถว ledger 124 — ทดสอบใน `local_stack_replica.sh` แล้วได้ (harness ALL_GREEN ×2) |
| Rollback plan PROPOSED wave5 | `DROP COLUMN delivery_address` คืน schema ได้ แต่**ข้อมูลในคอลัมน์หายถาวร** → แนะนำ "คงคอลัมน์ไว้" มากกว่า rollback · ถ้า backfill = dump คอลัมน์ก่อนเสมอ |

## 4. Payment & External Services (§4 — ไม่แตะค่า config/ไม่เปิดเผย secret)

| บริการ | โค้ดจริง | สถานะ | ช่องทางรับเงินจริงได้ตอนนี้? |
|---|---|---|---|
| **PromptPay QR / โอนธนาคาร manual** | `payment_intents`(promptpay_qr) · `record_payment_result` · แอดมินยืนยันตามคู่มือ บ.8 | **RUNTIME VERIFIED** (completed จริง 2 ครั้ง) | **ได้ — แนะนำสำหรับเทสต์ ≤300** (เงินโอนจริงระหว่างบัญชี Owner เอง + ยืนยันมือ ไม่พึ่ง live key) |
| Stripe | edge `create-checkout`/`stripe-webhook`/`stripe-refund` · `paymentGateway` | CONNECTED(test) — intents 47 ทั้งหมด test mode · ชื่อคีย์ live มีใน `.env.local` แต่ **ไม่ยืนยันค่า/ไม่ยืนยัน CF env** | ยังไม่ confirm — ถ้าจะใช้ต้อง verify live key + webhook endpoint จริงก่อน (ค่าธรรมเนียมบัตรจริง) |
| Omise | edge `omise-checkout`/`omise-webhook`/`omise-refund` | CONNECTED(test) · live **MISSING** · intents 0 | ไม่ได้ |
| THSMS (SMS/OTP) | edge `sms-send`/`otp-send` · keys `THSMS_*` · หลักฐานเก่า `BMB_W23_SMS_DELIVERY_DIAGNOSTIC.md` (2026-10-07) | CONNECTED · **runtime ปัจจุบัน MISSING** (ไม่ส่งระหว่าง audit) | ต้อง verify 1 ครั้งก่อนพึ่ง OTP (มีทางสำรอง: password login / `phone-auto-login`) |
| Meta (messaging) | edge `channel-webhook` · `META_*` keys · probe test mode | CONNECTED(test) · real-event/permissions **MISSING** | ไม่จำเป็นต่อเทสต์นี้ |
| Web Push | edge `push-send` · `push_subscriptions`=0 | IMPLEMENTED · ไม่มีอุปกรณ์ลงทะเบียน | ต้องมี device ลงทะเบียนก่อนทดสอบ |
| Google Maps | `VITE_GOOGLE_MAPS_API_KEY` | CONNECTED (ใช้บนหน้าเว็บจริง) | — |

**การจับคู่ payment↔order:** `payment_intents.order_number` + unique `uq_payment_intents_provider_id` + `record_payment_result` idempotent → จ่ายซ้ำไม่สร้างยอดคู่ · **duplicate payment จาก replay** = T8b พิสูจน์ว่า submit/replay ไม่สร้าง intent ซ้ำ (124 ยังไม่เข้า prod แต่ intent สร้างโดย RPC แยกต่อ order_number — ความเสี่ยงหลักคือ **ออเดอร์ซ้ำ** ไม่ใช่ charge ซ้ำ)

## 5. Operations & Test Data (§5 — นับอย่างเดียว ไม่ลบ/ไม่ replay)

**คลังข้อมูลจริง 2026-10-15 (SELECT counts) เทียบ baseline 2026-10-14:**

| ตาราง | จำนวน | เทียบ 14 ต.ค. | หมายเหตุ |
|---|---|---|---|
| orders | 206 (cancelled 205 + delivered 1) | เท่าเดิม | **ยังไม่มีออเดอร์ active ใหม่** — ทดสอบเล็กยังไม่เกิด |
| order_items | 203 | เท่าเดิม | |
| payment_intents | 56 (stripe 47 / promptpay 9 / omise 0) | เท่าเดิม | ไม่มีธุรกรรมใหม่ตั้งแต่ 14 ต.ค. |
| notifications | 338 | เท่าเดิม | |
| order_status_history | 454 | เท่าเดิม | |
| automation_queue | 1,568 = succeeded **1,555** + dead 13 | +116 succeeded | queue ทำงานจริง · dead 13 เดิม (`notification_dispatch`) ไม่มี retry/clear |
| push_subscriptions | 0 | เท่าเดิม | |
| menu_schedule | **6** (16/19/20 ต.ค. ×2 — unpublished ทั้งหมด) | ใหม่ (เดิม 0) | Owner เริ่มกรอกแล้ว แต่ยังไม่ Publish |
| delivery_rounds | 45 (**max วันที่ 2026-10-14 = อดีตทั้งหมด**) | — | **ต้องสร้างรอบอนาคตสำหรับเทสต์** |
| drivers | 6 (busy 5 / offline 1) | — | provisioning ใช้ได้ (m125 live) |
| delivery_assignments | 10 | — | ประวัติ dispatch เคยทำงานจริง |
| delivery_zones | 6 | — | |
| products / cats / sections | 20 / 6 / 4 | +1/+1/เท่า | Owner แก้เมนูต่อเนื่อง · anon เห็น 19 สินค้าขายได้ |

**เส้นทางไรเดอร์/ครัว→ส่ง (จากโค้ดปัจจุบัน):** ① แอดมิน provision ไรเดอร์ + ผูก login (`DeliveryManagement.tsx` — create driver + link `user_id`, m125) ② ไรเดอร์เข้า `/rider` (`RiderPwaPage.tsx` → `RiderPWA` บน supabase auth) ③ รับงาน → `delivery_assignments` status: assigned→accepted→picked_up→in_transit→delivered ④ ครัว (`AdminKitchen.tsx`, คู่มือ บ.5) เตรียม/ready ⑤ ติดตามได้ที่ `OrderTrackPage` · Bite Drive = `delivery_method` โซน 5 กม. (`ERR_BITE_DRIVE_DISABLED`/`SELF_DELIVERY_EXCEEDS_5KM_LIMIT` ใน RPC 118)

**ขั้นตอนแอดมินที่ต้องทำก่อนเทสต์ (ไม่แตะเนื้อหาโดยไม่ให้ Owner):**
1. **เผยแพร่ตารางเมนู:** `/admin/menu-schedule` → เลือก 2 เมนู/วัน → **Publish** (คู่มือ บ.10 — มี row รออยู่ 6 แถวแล้ว)
2. **สร้างรอบส่งอนาคต:** `/admin/rounds` → ตั้งวัน/เวลา cutoff/delivery + capacity (คู่มือ บ.7.1)
3. **แก้ข้อมูลเมนูทดสอบ:** ชื่อ/คำบรรยาย/รูป (คู่มือ บ.9.1) — "Test description" ฯลฯ
4. เตรียมไรเดอร์ 1 คน (provision + login ผ่าน) + ยืนยัน PromptPay รับเงินได้

**Safe cleanup (เสนอ — ยังไม่ทำ ไม่มีการลบ):** dead queue 13 = retry หรือ archive พร้อม backup (ตารางเล็ก ทำผ่าน UPDATE status ย้อนได้) · test orders 206 = **เก็บเป็นหลักฐาน** (ทุกแถว terminal แล้ว) · `backups/prod-full-20261006-*.sql` ×3 = ใช้เป็นจุดกู้ฐานก่อนงาน DDL ใด ๆ · rollback ของแต่ละงานอยู่ใน §3

## 6. Staging Recommendation (§6)

| เกณฑ์ | Staging แยก (Supabase branch/โปรเจกต์รอง) | Production acceptance แบบคุมเข้ม |
|---|---|---|
| ต้นทุน | สูงกว่างบเทสต์ (setup + config + seed) | **≤300 บาทตามงบ** |
| ความครอบคลุม | ได้ R11 (`_i` ผ่าน PostgREST/pgbouncer) + payment sandbox | ได้ end-to-end จริง รวมเงินจริง/SMS/push จริง |
| Data isolation | สมบูรณ์ | ต่ำ — ต้องมี window เงียบ + รายการเดียว |
| Rollback | ทิ้ง DB ได้ | cancel/refund มือ + backup (§5) |
| ความเสี่ยง | ต่ำ | กลาง — คุมด้วย checklist + ถ่ายทุก step |

**ข้อเสนอ:** รอบนี้ (เทสต์ 1 ออเดอร์ ≤300) = **ใช้ Production แบบคุมเข้ม** (คุ้มกว่าสร้าง staging) — แต่ **ก่อนเปิดร้านจริงควรมี staging อย่างน้อย 1 ชุด** เพื่อปิด R11 + ซ้อม payment live cutover + ทดสอบ SMS/push โดยไม่แตะลูกค้าจริง · งาน schema ใด ๆ (124/PROPOSED) = ต้องผ่าน `e2e/ci/local_stack_replica.sh` (ALL_GREEN) ก่อนเสมอ

## 7. Production Smoke Plan (§7 — เตรียมไว้ ยังไม่รัน)

**ชุด A — read-only (ไม่สร้าง/ไม่ส่ง/ไม่ชาร์จ — รันได้ทันทีที่อนุมัติ):**
1. HTTP 200 + assets hash ตรง build ปัจจุบัน (marker `:has(.sched-cal`) · `bite_closed`)
2. `/shop` `/menu` โหลด — หมวดสองชั้น + ไม่มีช่องซ้ำ + ป้ายปฏิทิน "ไม่แสดง" ขณะ 0 published (ถูกต้อง)
3. anon REST: `menu_schedule` เห็นเฉพาะ published · `products` เฉพาะ `is_available` (RLS spot-check)
4. Admin login (test admin) → GET ทุกหน้าหลัก: Orders/Kitchen/MenuSchedule/Rounds/DeliveryManagement/Products — ไม่มี error · DeliveryManagement แสดง dropoff_detail ได้ (หลังแก้ UI)
5. `OrderTrackPage` ของออเดอร์เก่า (delivered 1 รายการ) อ่านได้

**ชุด B — มี side effect (ต้องอนุมัติแยกทีละอย่าง):** สร้างออเดอร์ทดสอบ · ส่ง SMS/OTP 1 ครั้ง · push 1 ครั้ง · charge เงินจริง · publish schedule · dispatch งานไรเดอร์ · retry/clear dead queue

## 8. รายงานฉบับสุดท้าย (Deliverable)

### 8.1 ทำแล้ว vs ยังขาดจริง

**ปิดแล้ว (หลักฐาน 2026-10-15):** Git/Deploy baseline ตรงเป๊ะ (HEAD=origin=deployed=code ชุดเดียวกัน) · R10 prod precheck = **ผ่าน** (18-param ตรง) · W5C ปิด R1/R2/R3 + T14-T18 ในไฟล์ 124 แล้ว (isolated ALL_GREEN ×2) · UX fix ทั้งหมด deploy แล้ว · RLS anon ถูกต้อง (ไม่ leak แถว unpublished) · queue ทำงานจริง · m125 ใช้งานได้จริง (provision ไรเดอร์สำเร็จ)

**ยังขาดจริง (เรียงความสำคัญสำหรับเทสต์เงินจริง):** ① menu_schedule ยังไม่ Publish (6 แถวรอ) ② ไม่มี delivery_round อนาคต ③ migration 124 ยังไม่เข้า prod (ความเสี่ยงออเดอร์ซ้ำ) ④ ข้อมูลเมนูทดสอบยังไม่ได้ล้าง ⑤ THSMS runtime ปัจจุบันไม่ verified (ถ้าใช้ OTP) ⑥ ledger migration คลาดเคลื่อน (125 ไม่ถูกบันทึก) ⑦ หน้า DeliveryManagement แสดงที่อยู่ไม่ได้ (UI '—')

### 8.2 ลำดับการดำเนินงานที่แนะนำ

| ลำดับ | งาน | โดย | หมายเหตุ |
|---|---|---|---|
| 1 | Publish menu_schedule (บ.10) + สร้างรอบส่งอนาคต (บ.7.1) + ล้างข้อมูลเมนูทดสอบ (บ.9.1) | **Owner** | เงื่อนไขบังคับก่อนเทสต์ |
| 2 | **ตัดสินใจ migration 124:** (แนะนำ) apply ก่อนเทสต์ — R10 ผ่านแล้ว, เหลือ R9/R12 = จดมติ · หรือยอมรับความเสี่ยงออเดอร์ซ้ำ + คุมมือ | **Owner** | ถ้า apply = ผ่าน local_stack_replica ก่อน + backup + maintenance window |
| 3 | Reconcile ledger migration (บันทึก 125 / re-apply ผ่าน supabase cli) | AI Dev (ได้รับอนุมัติ) | ก่อน deploy ฝั่ง DB ครั้งต่อไป |
| 4 | แก้ UI DeliveryManagement อ่าน `dropoff_detail` (fallback) | AI Dev (ได้รับอนุมัติ) | เสี่ยงน้อยสุด ไม่แตะ DB |
| 5 | ทดสอบ THSMS 1 ข้อความ (หรือข้ามไปใช้ password login) | Owner อนุมัติ | ค่าใช้จ่ายน้อยมาก |
| 6 | **Smoke ชุด A (read-only)** | AI Dev (ได้รับอนุมัติ) | §7 |
| 7 | **เทสต์ออเดอร์จริง 1 ออเดอร์ ≤300 บาท** | Owner + AI Dev ดูแล | สคริปต์ §8.4 |
| 8 | สรุปผล + อัปเดต review pack/EV log + ตัดสินใจเรื่องค้าง | AI Dev | ไม่ push จนกว่า Owner สั่ง |

### 8.3 Owner decisions required (รวมทุกจุด)

1. **Migration 124** — apply ก่อนเทสต์ / หลังเทสต์ / ไม่ apply (ระบุใน §8.2 ข้อ 2) + จดมติ R9 (retention) / R12 (sha256)
2. **PROPOSED wave5 delivery_address** — UI fallback ก่อน (แนะนำ) หรือ apply migration + เลือก backfill `delivery_address ← dropoff_detail` หรือไม่
3. **Payment จริงช่องทางไหน** — PromptPay QR/โอน (แนะนำสำหรับเทสต์) หรือ Stripe live (ต้อง cutover key + webhook ก่อน)
4. **Staging** — จัดหาเมื่อไร (แนะนำก่อนเปิดร้าน ไม่บังคับก่อนเทสต์นี้)
5. **Stash `local-edits-before-sync-2026-09-21`** — กู้/ทิ้ง
6. **dead queue 13** — retry / archive
7. **RC-5 deploy SHA binding** — ทำหรือยอมรับ marker scan ไปก่อน
8. **หมายเหตุ:** มติ W5C เดิม (R1 normalize/R2 key policy/R3 replay (ข) composite owner_key) = มีบันทึกใน contract แล้ว — ยืนยันอีกครั้งตอน sign-off diff 124

### 8.4 Test script — ออเดอร์จริง 1 ใบ งบ ≤300 บาท (QR/โอน + ครัว + Bite Drive)

**Phase 0 เตรียม (Owner):** Publish schedule แล้ว · มีรอบส่งวัน D · เมนูพร้อม · ไรเดอร์ login ผ่าน · PromptPay พร้อมรับ · กำหนดงบ: อาหาร ≤200 + ค่าส่ง ~30-50 + buffer ≤300

1. **สั่งซื้อ:** มือถือเครื่องทดสอบ → `/shop` หรือ `/menu` → เลือกเมนูจากช่อง pre-order (สังเกตป้ายวันที่ต้องตรง menu_schedule ที่ publish) → เพิ่มตะกร้า (1 ใบ = ปุ่มเดียว) → Checkout → login (OTP ถ้า THSMS ผ่าน หรือ password) → ที่อยู่/GPS ในโซน → **ก่อนกดสั่ง: ถ้ากดซ้ำตั้งใจ 2 ครั้ง = ทดสอบการกันออเดอร์ซ้ำ (บันทึกผล: ถ้า 124 ยังไม่ apply อาจได้ 2 ออเดอร์ = หลักฐานความเสี่ยง)** → ได้เลข `BMB-...`
2. **จ่ายเงินจริง:** เลือก PromptPay QR → สแกนโอนจริง (≤300) → บันทึก intent id/status=pending/processing → แอดมินตรวจเงินเข้าบัญชีจริง → ยืนยันชำระเงิน (คู่มือ บ.8 → `record_payment_result`) → `payment_status=completed`
3. **ครัว:** `AdminKitchen` (บ.5) → preparing → ready · สังเกต notification ที่เกิด (และโอกาสหลุดเข้า dead queue)
4. **Bite Drive:** `DeliveryManagement` assign ไรเดอร์ → ไรเดอร์รับใน `/rider` → picked_up → in_transit → delivered · เปิด `OrderTrackPage` ดู tracking คู่กัน
5. **ตรวจจบ:** order_status_history ครบ timeline · ยอดเงินตรง (subtotal+fee-discount=total) · ที่อยู่แสดงถูกในหน้าจัดส่ง (หลังแก้ UI) · เงินเข้าจริงตรงยอด · เก็บ screenshot ทุก step

**Failure handling:** จ่ายไม่ทัน/QR หมดอายุ → intent ค้าง = แอดมิน cancel (บ.4.4) + ไม่ charge · ไรเดอร์ไม่รับ → assign ใหม่ · คิวครัวช้า → เลื่อนรอบ (cutoff) · ต้อง rollback → แอดมินยกเลิก + คืนเงินมือ (PromptPay โอนคืน) · **cleanup:** เก็บออเดอร์+intent เป็นหลักฐาน (ห้ามลบ) · backup dump ก่อน/หลัง · รายงานผลเป็น EV log ใหม่

### 8.5 GO / NO-GO

| คำถาม | คำแนะนำ |
|---|---|
| **เทสต์ออเดอร์จริง 1 ใบ ≤300 บาท** | **CONDITIONAL GO** — เงื่อนไข: (1) Publish schedule + สร้างรอบส่งอนาคต + ล้างเมนูทดสอบ (2) ตัดสินใจเรื่อง 124 ให้จบก่อนวันเทสต์ (แนะนำ apply — R10 ผ่านแล้ว) (3) เลือก PromptPay QR/โอนเป็นช่องทางเงิน (4) อนุมัติ smoke ชุด A ผ่านก่อน (5) ถ้าใช้ OTP = ทดสอบ THSMS 1 ครั้งก่อน |
| **เปิดร้าน / ประกาศ Production Ready** | **NO-GO (คงเดิมตามกติกา W5B)** — ยังขาด: 124 ไม่ apply · payment live ไม่ verified · ไม่มี staging (R11 ค้าง) · SMS/push runtime ไม่ครบ · PRODUCTION-RUNTIME tier ยังไม่ครบชุด |

---
*Audit: READ-ONLY · 2026-10-15 · หลักฐานทั้งหมด = SELECT/GET · ไม่มีการแก้ไขสถานะใด ๆ · รอ Owner review + อนุมัติสั่งดำเนินการ*
*ไฟล์นี้ = untracked (ไม่ commit ตามคำสั่ง)*