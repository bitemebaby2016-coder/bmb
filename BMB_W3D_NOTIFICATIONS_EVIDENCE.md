# BMB_W3D_NOTIFICATIONS_EVIDENCE.md
**W3-D Notifications · วันที่: 2026-09-27 · CORE GATE = PASS (24/24 production E2E) · TRANSPORT E2E = BLOCKED (ไม่มี provider) · Meta = DEFERRED BY OWNER**

## 1. Reality Audit (W3-D-0) — ตรวจของจริง ไม่ใช่เอกสาร

| Component | State | Evidence |
|---|---|---|
| `public.notifications` (001 + 021: category/user_id) | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED | W3-B E2E wrote/read rows; W3-D E2E wrote/read rows |
| `notification_prefs` + RPC (021) | IMPLEMENTED · DEPLOYED | migration 021; prefs suppression exercised by dispatcher |
| `audit_logs` execution trace | PASS | action=`automation.execution`, durable |
| `automation-worker` EF | PASS (W3-B 13/13) + W3-D job added | production deploy ×2 |
| In-app customer UI | GAP → CLOSED (W3-D) | NotificationDropdown ก่อนหน้าอ่านเฉพาะ local zustand — ไม่มี server hydration |
| Admin visibility | GAP → CLOSED (W3-D) | `/admin/notifications` ใหม่ (RLS admin) |
| Service worker / PWA | offline cache only (vite-plugin-pwa) | ไม่มี Web Push |
| Web Push (VAPID/subscription) | MISSING → **STOP (W3-D-7)** | ต้องใช้ VAPID keys + push subscription storage (schema) → Owner decision |
| Email/SMS providers | NOT CONFIGURED | ไม่มี credentials |
| Payment event feed | MISSING authoritative feed | `orders.payment_status` เป็น current-state only — ไม่มี payment history table |

## 2. Architecture (W3-D-1) — ยึด command ตรงตัว, ไม่แตะ authority

```
Canonical Event (order_status_history / delivery_assignments — authoritative)
      ↓
Notification Decision (event map ที่ Owner อนุมัติ + notification_prefs suppression)
      ↓
Notification Job (automation-worker job `notification_dispatch` — ไม่สร้าง worker ใหม่)
      ↓
Transport Adapter (in_app = notifications row; EMAIL/SMS/PUSH/LINE/FB/MESSENGER = declared NOT_CONFIGURED)
      ↓
Recipient (public.customers.id — resolved จาก orders.customer_id=auth uid → customers.user_id)
      ↓
Delivery Result (created / duplicate — deterministic id)
      ↓
Audit (audit_logs automation.execution)
```

- Supabase = Source of Truth เดิม · notification เป็น side-effect only · worker ไม่แตะ order/payment/inventory
- **ห้าม invent event**: ใช้เฉพาะ event ที่มี authoritative source (ORDER_* จาก order_status_history migr 040, DRIVER_ASSIGNED/ACCEPTED/PICKED_UP จาก delivery_assignments migr 020)
- **PAYMENT_SUCCESS/PAYMENT_FAILED = STOP → OWNER DECISION REQUIRED** (ไม่มี payment event feed; orders.payment_status เป็น current-state only — การสร้าง feed ต้องมี business decision)

## 3. Idempotency (W3-D-4) — durable, ไม่ใช่ in-memory
- Deterministic notification id: `evt-ord-<order_number>-<to_status>` / `evt-drv-<order_number>-<status>` = logical uniqueness (event × status × order)
- Dedupe: GET-existence + `Prefer resolution=ignore-duplicates` (PK) — parallel duplicate → ONE row
- ไม่เพิ่ม schema — ใช้ PK ของตารางเดิม (พิสูจน์แล้วว่าเพียงพอ; หลีกเลี่ยง migration ตาม HARD RULE 7)

## 4. Retry / Failure (W3-D-5)
- Bounded: lookbackMinutes (1..1440) + limit (1..500) — scan window จำกัด
- Observable: insert failure ไม่ถูกปลอมเป็น duplicate — กลายเป็น `failed:<status>:<body>` ใน errors + execution trace (พบจริงระหว่างทดสอบ: FK 409 ถูกจับเป็น failed แล้วแก้ — มีหลักฐาน failure trace ใน audit_logs)
- Idempotent: re-run หลัง failure ปลอดภัย (deterministic id)
- Dead-letter: ยังไม่จำเป็น — ไม่มี external transport (ไม่สร้าง complexity ก่อน use case จริง)

## 5. Transport (W3-D-6)
- in_app = IMPLEMENTED + RUNTIME VERIFIED (row ใน notifications, customer อ่านผ่าน RLS)
- EMAIL / SMS / PUSH / LINE / FACEBOOK / MESSENGER = **NOT CONFIGURED** (ไม่มี credentials — ห้าม fake)

## 6. Production E2E (W3-D-10) — `e2e/w3d-notifications-e2e.json` **PASS 24/24** (TEST DATA ONLY: W3D Test orders + qa-* accounts)
1. unauthenticated → 401 ✓ 2. unknown job → 400 ✓ 3. malformed payload → 400 ✓
4. canonical order create (RPC) ✓ 5. dispatch run-1 → `evt-ord-<order>-pending` created ✓
6. row มี canonical recipient (customers.id) + notification_type=ORDER_CREATED ✓
7. transition pending→confirmed (transition_order_status, admin) → dispatch → ORDER_CONFIRMED created ✓
8. re-run same window → duplicate, rows ยัง = 2 (no duplicate side effect) ✓
9. assign_driver (canonical) → DRIVER_ASSIGNED notification ✓
10. execution trace ใน audit_logs ✓ 11. empty window → observable empty ✓
12. customer อ่าน row ของตัวเอง ✓ · อ่าน/แก้ row คนอื่นไม่ได้ (RLS) ✓ · mark-own-read persist จริงใน DB ✓
13. admin อ่านได้ (RLS admin) ✓ 14. anonymous blocked ✓ 15. 0 secret leak (ทุก response) ✓

**TRANSPORT E2E (external provider) = BLOCKED — ไม่มี production provider ห้ามประกาศ delivery PASS**

## 7. PWA (W3-D-7) — STOP เฉพาะส่วนนั้น
- Current SW = offline cache (vite-plugin-pwa autoUpdate) — ไม่มี push
- Web Push feasibility = ทำได้ แต่ต้องมี: VAPID keypair (Owner decision/config) + push subscription storage (schema ใหม่ → STOP ตาม W3-D-4) + permission UX
- **ไม่บล็อก notification core** — core ผ่านแล้ว

## 8. Security
- ไม่มี schema migration · ไม่มี secret ใหม่ · service_role อยู่ฝั่ง server เท่านั้น
- Secret scan: git (เฉพาะ comment/regex literal — ไม่มีค่าจริง) CLEAN · dist CLEAN · worker responses CLEAN (probe scan)
- RLS: notifications anon deny / own read+update / admin all (migr 006) — ยืนยันด้วย E2E ข้อ 12-14

## 9. Regression (W3-D-11) — rerun หลัง deploy แล้ว ทั้งหมด PASS
F-05 12/12 · F-06 14/14 · F-18 15/15 · Identity 20 PASS · W3-A 12 PASS · W3-B 13/13 ·
W3-C Core intake PASS · W3-C External foundation PASS (probe) · **Meta real connectivity = DEFERRED BY OWNER (ไม่ rerun — ไม่มีการเปลี่ยน Meta integration)**

## 10. Quality Gate (W3-D-12)
tsc 0 · vitest 22 files / 179 passed · build ✓ · lint 0 · git secret scan CLEAN · dist secret scan CLEAN · runtime secret scan CLEAN · RLS ✓ · idempotency ✓ · retry/failure ✓

## 11. Files changed
- `supabase/functions/automation-worker/index.ts` — + job `notification_dispatch`
- `src/lib/notificationService.ts` — + markNotificationRead (RLS own update), notification_type select
- `src/store/notificationStore.ts` — + hydrateServerNotifications (idempotent merge) + markServerAsRead (server-first)
- `src/components/notification/NotificationDropdown.tsx` — hydrate เมื่อ authed + per-row server read
- `src/pages/admin/AdminNotifications.tsx` (ใหม่) + `src/App.tsx` route + `src/lib/adminUi.ts` nav
- `e2e/w3dNotificationsE2E.cjs` (ใหม่) + `e2e/w3d-notifications-e2e.json`
- **ไม่มี migration · ไม่มี secret ใหม่ · ไม่มี worker ใหม่**
