# BMB — CAT-02 REPORT: Menu Schedule UI + Canonical Availability

**Gate:** CAT-02 (1 gate = 1 commit) · **CAT-D02=A** — connect EXISTING migration 039 `menu_schedule` to Admin + Customer PWA · TEN-D01=A (ไม่มี tenant implementation ใน gate นี้) · Base: CAT-01 CLOSED (`385b22b`)

## AUDIT RESULT (Production > Code > Migrations > Docs)
- Backend canonical **มีอยู่จริงและ live ใน prod** (039): table `menu_schedule(date, product_id, delivery_round_key, is_published)` + RPCs `set_menu_schedule` (admin, replace-all, audit log, past-date rejected) / `publish_menu_schedule` / `get_menu_for_date` + **`trg_menu_gate`** (AFTER INSERT order_items: PRE_ORDER วันที่มี published menu → สินค้านอกเมนูถูกปฏิเสธ `ERR_PRODUCT_NOT_ON_MENU`) + **`trg_operating_hours`** (BEFORE INSERT orders: `business_settings.operating_hours` → `ERR_ORDER_MODE_CLOSED` / `ERR_ROUND_CLOSED`)
- **ก่อน gate นี้: 0 code callers, 0 schedule rows ใน prod** — ระบบถูกสร้างไว้แต่ไม่มี UI ต่อ
- **ไม่พบ semantic conflict ที่ต้อง STOP:**
  - `available_preorder` ไม่ conflict — 039 ออกแบบ additive ไว้ชัด: วันที่มี published menu = whitelist; วันที่ไม่มี = ใช้ gate `available_preorder` (023/025) เดิม
  - `preorder_max_days` prod = **50** (038 default 40 — Owner แก้เองแล้ว; **ต่างจาก "7" ในคำสั่ง → Production ชนะ** ตาม §7, ไม่แก้ค่า, Admin UI อ่านค่าจริงจาก order_policy)
  - Cutoff = 2h ก่อน delivery_start (038) + round cutoff_time (025) — canonical เดิม, ไม่แตะ

## CONTRACT (canonical relationship)
```
Menu Schedule (039, published) → [date whitelist for PRE_ORDER]
  → วันที่มี menu: สินค้าใน menu เท่านั้น (delivery_round_key NULL = ทุกรอบ)
  → วันที่ไม่มี menu: products.available_preorder gate เดิม
→ Customer PWA: Checkout PRE_ORDER date picker + banner + pre-submit mirror
Order authority (แตะไม่ได้/ไม่ได้แตะ): create_order_with_items (025) + trg_menu_gate (039)
  + trg_operating_hours (039) + trg_pre_order_window/2h cutoff (038) + capacity (024/025)
แยกชัด: operating hours/mode open-close (business_settings) ≠ menu visibility (schedule)
  ≠ ordering window/lead time (order_policy) ≠ round cutoff/capacity (rounds)
```

## IMPLEMENTED / CONNECTED / DEPLOYED / VERIFIED
- **IMPLEMENTED:** `src/lib/bmbMenuSchedule.ts` (RPC callers + published-read + `mirrorPreOrderScheduleGate`) · `AdminMenuSchedule.tsx` (ดู/สร้าง/แก้/publish/unpublish/effective state/server error panel/date bounded by prod `preorder_max_days=50`)
- **CONNECTED:** route `/admin/menu-schedule` + nav "Menu Schedule" · Checkout PRE_ORDER = canonical schedule read + banner + pre-submit gate (blocks submit เมื่อสินค้านอกเมนูวันนั้น — กัน customer เจอ reject จาก schedule rule โดย server ยังตัดสินจริง)
- **DEPLOYED:** migration **056** → prod (anon SELECT policy on published rows + `GRANT SELECT TO anon`)
- **RUNTIME VERIFIED (prod, read-only, ไม่สร้าง fake data):**
  1. current schedule state: **0 rows** (ยังไม่มี owner schedule — เป็นค่าจริง ไม่ใช่ data ปลอม)
  2. Admin read: authenticated SELECT grant ✓ (table-level, 039)
  3. Customer read: **REST anon GET = 200 `[]`** (ก่อน deploy = 401 — grant gap พบจาก runtime verify)
  4. SAME_DAY: ไม่ถูกกระทบ (schedule เป็น whitelist เฉพาะ PRE_ORDER) — mock test ยืนยัน spine เดิม
  5. PRE_ORDER: gate path ทดสอบผ่าน canonical `create_order_with_items` (mock mirror ของ 039 triggers)
  6. cutoff: 038/025 triggers **intact ใน prod (14 order triggers ครบ)** — ไม่แตะ
  7. closed/open: `trg_operating_hours` live + `operating_hours` settings ครบ 5 keys (all open — ค่าจริง)
  8. no duplicate authority: สร้าง 0 schedule system ใหม่ — UI/lib ทั้งหมดเรียก RPC/table เดิม
  9. **anon write = 401** (security evidence)
- **DOCUMENTED:** `docs/ADMIN_GUIDE_TH.md` §5

## TESTS
Vitest **314/314 (35 files, +10 ใหม่)** · tsc 0 · eslint 0 · build PASS · secret-scan: ไม่มี key ใน code (deploy script อ่านจาก env เท่านั้น)

## MISSING / BLOCKED / DEFERRED
- **MISSING:** ยังไม่มี scheduled-date rounds ใน prod ที่เป็นวันอนาคต (rounds สร้างวันต่อวันโดย `ensure_rounds_for_date`) — PRE_ORDER publish จึงควรทำก่อนวัน-delivery; Admin UI อ่าน order_policy จริงแล้วจึงไม่เป็น blocker
- **DEFERRED (Owner):** `preorder_max_days` prod=50 ≠ "7" ในคำสั่ง — ตาม §7 Production ชนะ; หากต้องการ 7 ให้ Owner สั่งแก้ settings แยก
- **DEFERRED:** `get_menu_for_date` RPC (authenticated-only) ยังไม่ถูกเรียกจาก client — customer ใช้ table read (published-only) แทน; RPC คงอยู่ตาม 039
- **BLOCKED:** —

## GIT
HEAD = origin/main = (post-commit) · WORKTREE = CLEAN

## 🔴 HARD STOP — รอ Owner review ก่อน CAT-03