# BMB — Rider E2E Closure + Map Fix + Backup/Migration Reconcile (2026-10-20)

**งาน:** Owner task RIDER E2E PRODUCTION CLOSURE (A1–A5) + PHASE 2 Map + PHASE 3 Backup/Migration + ADDENDUM Rider Portal
**สถานะรวม:** IMPLEMENTED + CONNECTED (ใน repo) · **Production migration 132 = รอ Owner อนุมัติ apply** · E2E จริงบน production = ยังไม่ประกาศ PASS (รอทดสอบจริงตาม checklist)

---

## 1. สิ่งที่แก้/เพิ่ม (ทั้งหมดอยู่ใน commit นี้)

### A1 — Rider job refresh + new-job awareness (`src/pages/RiderPwaPage.tsx`)
- polling `my_deliveries` (RPC 041/132) ทุก **25 วินาที** + ปุ่มรีเฟรชเอง + `last-updated` + error banner + retry
- เตือนงานใหม่: แบนเนอร์ + เสียง (WebAudio ไม่ต้องโหลดไฟล์) **เปิด/ปิดได้** (`rider_sound_on`)
- กัน polling ซ้อน (inFlightRef) · หยุดทันทีที่ logout/unmount (interval cleanup) · ไม่ใช้ Realtime (ตามนโยบายแอป)
- ทุก action กันกดซ้ำด้วย `busyOn`/`deliverBusy`

### A2 — Push ถึงไรเดอร์ที่ถูกมอบหมาย (คนละ audience กับลูกค้าชัดเจน)
- `push_subscriptions` + `driver_id` + CHECK `num_nonnulls(customer_id, driver_id) = 1` (migration 132 §10)
- `register_push_subscription` ขยาย arg `p_audience ('auto'|'customer'|'driver')` — identity = JWT → `customers.id`/`drivers.user_id` เท่านั้น; ownership check กัน hijack endpoint
- `claim_push_driver_targets` (service_role ONLY) + `push-send` รับ `driverId` (หนึ่งคำขอ = หนึ่ง audience, ห้ามส่งทั้งคู่)
- `automation-worker` (`notification_dispatch`): ยิง push "🛵 มีงานใหม่ → /rider" เฉพาะ assignment `status='assigned'` ที่ `rider_pushed_at IS NULL` + PATCH claim (atomic `is.null`) → **idempotent** แม้ scan window ทับซ้อน; มอบหมายใหม่ (assign_driver 132 reset marker) → ไรเดอร์คนใหม่ได้แจ้งเตือน
- push ล้มเหลว **ไม่แตะ** assignment/order — polling ของ /rider เป็น fallback เสมอ
- หน้า /rider: ปุ่มเปิด/ปิดการแจ้งเตือน + สถานะ permission ตรงจริง (denied/unsupported บอกตามจริง)
- ไม่มี secret (service-role/VAPID private) ลง client ทุกเส้นทาง

### A3 — POD persisted จริง (เลิก "รูปอยู่แค่ client state")
- bucket **`pod-photos` (PRIVATE)** + storage policies: อัปโหลดได้เฉพาะโฟลเดอร์ `driver_id/` ของตน (split_part), อ่าน = admin หรือเจ้าของ, แก้/ลบ = admin เท่านั้น (กันลบหลักฐาน)
- `driver_attach_pod` (SECURITY DEFINER, JWT): ตรวจ path อยู่ในโฟลเดอร์ตน + งานยังไม่ปิด → บันทึก `proof_of_delivery_path/url/pod_captured_at/pod_latitude/longitude` + audit
- **`driver_update_delivery_status('delivered')` ต้องมี POD แล้ว** (`ERR_POD_REQUIRED`) — admin override (116) ยังใช้ได้กรณีฉุกเฉิน (audited)
- client: บีบอัดรูป (≤1280px, JPEG q0.8) · ตรวจชนิด/ขนาด (≤15MB เข้า / ≤5MB อัปโหลด) · upload → attach → delivered (retry ได้เมื่อ network fail)
- Admin (`DeliveryManagement.tsx`): แสดงรูป POD (signed URL) ในคิว dispatch + ตาราง en-route · อยู่หลัง refresh/re-login เพราะเก็บใน storage

### A4 — Decline/cancel/stale assignment
- `driver_decline_assignment` (เฉพาะ `assigned`) + `admin_cancel_assignment` (is_admin) — เหตุผล + actor + timestamp + `audit_logs` เสมอ; **แถว assignment ไม่ถูกลบ** (ประวัติคงอยู่)
- trigger `close_assignments_on_order_terminal`: ออเดอร์ `cancelled/failed` → ปิด assignment ที่ active อัตโนมัติ (`cancel_reason='order_cancelled'/'order_failed'`) + audit
- `assign_driver` (132): reassign ผ่าน ON CONFLICT **reset ฟิลด์ POD/decline/cancel/rider_pushed_at ทั้งหมด** + คืนสถานะไรเดอร์คนก่อน (กันงานผี/หลักฐานปน)
- UI: ไรเดอร์มีปุ่ม "ปฏิเสธงาน" · แอดมินมีปุ่ม "ยกเลิกงาน" + เหตุผลแสดงบนบอร์ด · `my_deliveries` กรอง `declined/cancelled` ออก
- รับงานซ้ำป้องกัน atomic เดิม (UPDATE WHERE status='assigned' + UNIQUE order) — ยืนยันด้วย contract G1

### A5 — Network/error handling
- `driverService`: action คืน `DriverActionResult { ok, error, kind }` — kind = `network|permission|state|unknown` (แยกแยะจาก error message + navigator.onLine)
- UI แสดงข้อความไทยตาม kind + retry **เฉพาะ network** · ไม่มี silent false อีกต่อไป
- ไม่มีจุดไหนเขียน `orders.status` โดยข้าม transition authority (เฉพะ RPC เดิม)

### PHASE 2 — Map
- `googleMaps.ts`: `getGoogleMapsLoadError()` — บอกสาเหตุจริง (missing key / SDK ถูกบล็อก / key ถูกปฏิเสธ) แทน "แผนที่ว่างเงียบ ๆ"
- `DeliveryMapPicker`: แสดงสาเหตุดังกล่าวในกล่อง fallback (พิกัด manual + GPS ยังใช้ได้)
- **`RiderMiniMap` (ใหม่)** ในหน้า /rider: แผนที่จุดปักแยกชนิดชัดเจน 🏠 ปลายทาง (จากออเดอร์) / 🛵 คุณ (GPS จริง) / 🍳 ครัว (อ้างอิงจาก `config/kitchenLocation` — ไม่ hardcode) + แสดงพิกัดตัวเลข/ระยะทางเมื่อ SDK โหลดไม่ได้
- ตรวจแล้ว: ไม่มีการสลับ lat/lng ในทุกเส้นทาง (`parseManualPin` ตรวจ |lat|≤90), ปลายทางมาจาก `orders.dropoff_*` ที่ลูกค้ายืนยันบนแผนที่ (trusted source + `isTrustedSource` กันค่า 0,0/เก่า)

### PHASE 3 — Backup/Migration reconcile (ดู §3)

### ADDENDUM — Rider Portal entry
- ปุ่ม **"🛵 งานจัดส่งของฉัน (ไรเดอร์)"** ใน: Header เมนูมือถือ + ProfilePage — **แสดงเฉพาะบัญชีที่แอดมินผูกไรเดอร์แล้ว** (server-verified ผ่าน RPC `driver_login`, ห้ามอนุมานจาก client) · ผู้ใช้ทั่วไปไม่เห็น
- ปุ่ม **"เปิดหน้าไรเดอร์"** ใน /admin/delivery (แท็บใหม่ — แอดมินไม่กลายเป็นไรเดอร์; /rider ตรวจ JWT→drivers.user_id ของตัวเอง)
- `/rider`: login แล้วแต่ยังไม่ถูกผูก → ข้อความชัดเจน "ติดต่อแอดมิน provision/ผูกบัญชี" (ไม่ใช่หน้าว่าง/รายการว่าง) + ปุ่มลองใหม่/ออกจากระบบ

---

## 2. ผลทดสอบจริง (fresh run 20 ต.ค. 2026 — ไม่อ้างผลเก่า)

| ชุด | ผล | หลักฐาน |
|---|---|---|
| `npx tsc --noEmit` | ✅ ผ่าน (exit 0) | run วันนี้ |
| `npx eslint` (ไฟล์ที่แก้ทั้งหมด) | ✅ 0 problems | run วันนี้ |
| `npx vitest run` (ทั้ง suite) | ✅ **1205/1205** (113 files) | run วันนี้ (รวม 12 tests ใหม่: driverActionResults 9 + dbRestoreDrill 3) |
| `npm run build` (PWA) | ✅ built (v1.3.0, precache 150 entries) | run วันนี้ |
| SQL replay 001–**132** บน PG17 ephemeral | ✅ ALL MIGRATIONS APPLIED CLEANLY | `e2e/ci/apply_all_migrations.sh` (docker postgres:17-alpine) |
| `e2e/contracts_132_rider_pod_push_decline.sql` | ✅ PASS G1–G6 ทั้งหมด (ROLLBACK) | decline+reassign-reset+กันรับซ้ำ / admin cancel+history / auto-close / POD guards / push audience+ownership / security |
| `e2e/contracts_036_driver_status_sync.sql` (อัปเดต) | ✅ PASS ทุกกลุ่ม (G1–G9) รวม **G1-POD gate** | ซ่อม fixture ที่ค้างมาตั้งแต่ก่อน 041 (ผูก drivers.user_id + harness grants) |
| `e2e/contracts_127_130.sql`, `contracts_131_register_customers.sql` | ✅ ยังผ่าน (regression — ไม่พังจาก 132) | run วันนี้บน DB เดียวกับที่ apply 132 แล้ว |
| Production probe (read-only) | ✅ migration 126–130 recorded ใน schema_migrations | `e2e/g8s5MigrationHistory.cjs` วันนี้ |

**หมายเหตุ ความซื่อสัตย์ของหลักฐาน:**
- E2E บน production กับอุปกรณ์จริง (checklist ข้อ 1–10) = **ยังไม่ผ่านการทดสอบจริง** — ต้องทำหลัง deploy + apply 132 (ดู §5)
- Restore drill: **ยังไม่เคยรันจริงก่อนหน้านี้** (MISSING เดิม) — รอบนี้เพิ่ม `scripts/dbRestoreDrill.mjs` (download → เทียบ sha256/size กับ manifest → gunzip → ตรวจโครงสร้าง dump → ทางเลือก restore ลง scratch DB พร้อม guard ห้ามชี้ production) + unit test ตรรกะ 3 ข้อ — **การรัน drill จริงต้องใช้ `SUPABASE_SERVICE_ROLE_KEY`** (GitHub secret; ไม่มีในเครื่องนี้โดยถูกต้อง) → run ได้ทันทีจาก Actions/เครื่อง Owner

## 3. PHASE 3 — สรุป Backup/Migration

| รายการ | สถานะ | หลักฐาน |
|---|---|---|
| Backup ย้าย GCS → Supabase Storage (bucket `db-backups` PRIVATE) | ✅ IMPLEMENTED · DEPLOYED (run #6 เขียว 19 ต.ค.) | commits `a7e474a`→`aa653e6`, `scripts/dbBackup.mjs`, `.github/workflows/daily-backup.yml` |
| `--verify` ตรวจ checksum+size หลัง upload จริง | ✅ IMPLEMENTED | pre-upload size+sha256 → download กลับเทียบ byte-for-byte (fail closed) + `--verify` ตรวจ manifest hash + .sql.gz + bucket private |
| GCS_SERVICE_ACCOUNT_JSON | ✅ เลิกใช้แล้ว (workflow ไม่เรียก) | คอมเมนต์ใน workflow: "ลบ secret เดิมทิ้งได้" — README ไม่มีรายการนี้ค้าง (ไม่ drift) |
| Migrations 127–130 (pickup/print/POS/finance) | ✅ **APPLIED บน production แล้ว** (recorded ใน schema_migrations) | probe `g8s5MigrationHistory.cjs` วันนี้: `127_pickup_fulfillment…130_finance_reports` อยู่ครบ |
| Migration 131 (register→customers) | ⚠️ **objects ทำงานจริงบน production** (probe: `handle_new_user` มี customers upsert + customers=3 rows) แต่**ไม่ได้ record ใน schema_migrations** (drift — replay รอบหน้าจะยิงซ้ำ) | probe วันนี้ · ข้อเสนอ: `supabase migration repair --status applied 131` (metadata เท่านั้น) — ขออนุมัติก่อน |
| Restore test | ⚠️ ยังไม่เคยมีก่อนหน้านี้ → รอบนี้มีเครื่องมือ + unit test; รัน drill จริงได้ทันทีเมื่อมี secret | `scripts/dbRestoreDrill.mjs` |

## 4. Migration Plan — `132_rider_pod_push_decline.sql` (ขออนุมัติ apply ขึ้น production)

**เนื้อหา:** คอลัมน์ใหม่บน `delivery_assignments` (POD/decline/cancel/rider_pushed_at — additive ทั้งหมด) · CHECK status +`'declined'` · bucket `pod-photos` + policies · RPC ใหม่ `driver_attach_pod`/`driver_decline_assignment`/`admin_cancel_assignment`/`claim_push_driver_targets` · CREATE OR REPLACE `assign_driver`/`my_deliveries`/`driver_update_delivery_status`/`register_push_subscription`/`unregister_push_subscription`/`list_my_push_subscriptions` · trigger ปิดงานค้างเมื่อออเดอร์จบทาง

- **ทดสอบแล้ว:** replay 001–132 ผ่านสะอาดบน PG17 + contract 132/036/127-130/131 ผ่าน (§2) · ไม่แตะข้อมูลเดิม (ไม่มี DELETE/UPDATE ข้อมูลลูกค้า)
- **ผลกระทบ:** พฤติกรรมที่เปลี่ยน = ไรเดอร์ `delivered` ต้องมีรูป POD ก่อน (admin override 116 ยังใช้ได้) · หนึ่ง push endpoint = หนึ่ง audience (register ใหม่สลับให้)
- **Rollback:** กลับฟังก์ชันเป็นฉบับ 041/115/125 เดิม + drop trigger `trg_close_assignments_on_order_terminal` — คอลัมน์ใหม่ทิ้งไว้ได้ไม่เป็นพิษ · ถ้าเลวร้ายสุด: restore จาก backup ล่าสุดใน `db-backups` (verify ทุกวัน)
- **คำสั่งที่จะใช้ (เมื่ออนุมัติ):** apply เฉพาะไฟล์ 132 ผ่าน Management API (แบบรอบ 126–130) + record `schema_migrations` + verify objects — **ไม่ใช้ `supabase db push` แบบเหมารวม**
- **Edge Functions:** `automation-worker` + `push-send` ต้อง deploy คู่กัน (rider push) — secrets เดิมครบ (VAPID_*/AUTOMATION_TOKEN) ไม่ต้องเพิ่ม

## 5. E2E checklist (PHASE 4 ข้อ 1–10) — สถานะก่อนทดสอบจริง

| # | ข้อ | สถานะ |
|---|---|---|
| 1 | Login /rider + เห็นตัวตนถูกต้อง | ⏳ รอทดสอบจริง (logic + fixture พร้อม: บัญชี `jin.pao66` link แล้วบน production) |
| 2 | แอดมินมอบหมาย → งานโผล่ผ่าน polling | ⏳ รอทดสอบจริง (polling 25s + contract G1 ยืนยันฝั่ง DB แล้ว) |
| 3 | Push ถึงอุปกรณ์ไรเดอร์ + fallback | ⏳ รอทดสอบจริง (ต้อง apply 132 + deploy worker ก่อน; fallback=polling ทำงานเสมอ) |
| 4 | Accept ครั้งเดียว + กันรับซ้ำ | ✅ ฝั่ง DB ยืนยันแล้ว (contract G1) / ⏳ UI รอทดสอบจริง |
| 5 | Decline/cancel/reassign | ✅ ฝั่ง DB (contract G1/G2) / ⏳ UI รอทดสอบจริง |
| 6 | picked_up→in_transit→delivered + order sync | ✅ ฝั่ง DB (contract 036 ทั้ง chain + POD gate) / ⏳ อุปกรณ์จริง |
| 7 | Upload POD → refresh → รูปยังอยู่ | ⏳ ต้อง apply 132 (bucket+RPC) ก่อน |
| 8 | เครือข่ายขัดข้อง + retry | ⏳ รอทดสอบจริง (kind=network + ปุ่ม retry แล้ว) |
| 9 | พิกัดจริง + ภาพแผนที่บนอุปกรณ์ส่งอาหาร | ⏳ รอทดสอบจริง — **ดู §6 Google Maps checklist** |
| 10 | audit logs + customer tracking/notifications | ✅ audit ฝั่ง DB ทุกจุด (contracts) / ⏳ end-to-end จริง |

## 6. สิ่งที่ Owner ต้องทำเอง (Google Maps + ค่าตั้ง + การอนุมัติ)

1. **Cloudflare Pages → Environment variables:** ยืนยัน `VITE_GOOGLE_MAPS_API_KEY` (+ `VITE_GOOGLE_MAPS_MAP_ID`, `VITE_GOOGLE_ROUTES_API_KEY`) ถูกตั้งใน **production build** — ถ้าไม่มี แผนที่จะแสดงข้อความ "ไม่พบ VITE_GOOGLE_MAPS_API_KEY ในการ build นี้" (ตอนนี้บอกสาเหตุชัด ไม่เงียบ)
2. **Google Cloud Console (project ของ key):** เปิด API: *Maps JavaScript API*, *Places API*, *Routes API* + **เปิด billing** + ตั้ง HTTP referrer restrictions: `biteme-baby.com/*`, `*.pages.dev/*` (staging)
3. ใช้ key ฝั่ง client เท่านั้น (public ได้ตาม design) — ห้ามใช้ key ที่มีสิทธิ์ service/admin
4. **GitHub Secrets:** คง `SUPABASE_SERVICE_ROLE_KEY`, `BMB_DATABASE_URL` · `GCS_SERVICE_ACCOUNT_JSON` **ลบได้** (เลิกใช้แล้ว) · ทางเลือก: เพิ่ม step รัน `node scripts/dbRestoreDrill.mjs` รายเดือนเป็น restore rehearsal
5. **ขออนุมัติ 2 รายการ:** (ก) apply migration 132 + deploy edge functions `automation-worker`/`push-send` · (ข) `supabase migration repair --status applied` สำหรับ 131 (แก้ drift metadata — ไม่แตะข้อมูล)

## 7. ป้ายสถานะรวม

| ชิ้น | สถานะ |
|---|---|
| A1 polling/refresh/sound/error | IMPLEMENTED · CONNECTED (local gates green) |
| A2 rider push (subscription/claim/dispatch/fallback) | IMPLEMENTED · CONNECTED — **DEPLOYED pending** (132 + functions) |
| A3 POD persistence + admin view | IMPLEMENTED · CONNECTED — **DEPLOYED pending** (132) |
| A4 decline/cancel/auto-close/reassign | IMPLEMENTED · CONNECTED · RUNTIME VERIFIED (DB contract) — **DEPLOYED pending** |
| A5 error kinds + retry + no silent fail | IMPLEMENTED |
| PHASE 2 map (RiderMiniMap + error causes + coord audit) | IMPLEMENTED · CONNECTED — map render จริงรอ key/billing บน prod (§6) |
| PHASE 3 backup GCS→Supabase + verify | DOCUMENTED (เดิม DEPLOYED/RUNTIME แล้ว — run #6) |
| PHASE 3 restore drill | IMPLEMENTED (tool+test) — RUNTIME VERIFIED pending secret |
| Migration 131 schema_migrations record | **DEFERRED — รอ Owner อนุมัติ repair** |
| ADDENDUM rider entry (hidden-by-role + admin button + unlinked message) | IMPLEMENTED · CONNECTED |
| Production E2E PASS | **ยังไม่ประกาศ** — รอ §5 ทดสอบจริงหลัง deploy |