// ============================================
// build migration 142 from the 141 function body (anchor-guarded)
// R5c (Owner 2026-10-23): PRE_ORDER requires >=1 menu-calendar item of that date
//   - create_order_with_items = body of 141 + ERR_PRE_ORDER_REQUIRES_MENU gate
//     (closes the free-date API loophole: no calendar menu in the order = reject)
//   - per-item date/round binding stays in enforce_menu_gate (ERR_PRODUCT_NOT_ON_MENU)
// Usage: node e2e/m142Build.cjs
//   -> supabase/migrations/142_pre_order_requires_menu.sql
// ============================================
const fs = require('fs')

const SRC = 'supabase/migrations/141_pre_order_unify_menu_calendar.sql'
const OUT = 'supabase/migrations/142_pre_order_requires_menu.sql'

const ANCHOR = "    IF (p_scheduled_date - v_today) < public.order_setting('pre_order_lead_days', 1) THEN RAISE EXCEPTION 'ERR_LEAD_TIME'; END IF;"
const INSERT = `${ANCHOR}
    -- R5c/142: PRE_ORDER ต้องมี >=1 เมนูจากปฏิทินของวันนั้น (published, ยังไม่ผ่านรอบจัดส่ง)
    --   · ตะกร้าไม่มีเมนูปฏิทินเลย = ERR_PRE_ORDER_REQUIRES_MENU (ปิดช่องยิง API เลือกวันอิสระ)
    --   · มีเมนูผูกวันแต่คนละวัน = ERR_PRODUCT_NOT_ON_MENU (§5-C เดิม — enforce_menu_gate สำทับรายสินค้า)
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_items) AS x(product_id text, quantity integer, options jsonb, special_request text)
      JOIN public.menu_schedule ms ON ms.product_id = x.product_id
       AND ms.is_published = true
       AND ms.scheduled_date = p_scheduled_date
       AND ms.scheduled_date >= v_today
    ) THEN
      IF EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_items) AS x(product_id text, quantity integer, options jsonb, special_request text)
        JOIN public.menu_schedule ms ON ms.product_id = x.product_id
         AND ms.is_published = true
         AND ms.scheduled_date >= v_today
      ) THEN
        RAISE EXCEPTION 'ERR_PRODUCT_NOT_ON_MENU: no cart item matches menu date %', p_scheduled_date::text;
      END IF;
      RAISE EXCEPTION 'ERR_PRE_ORDER_REQUIRES_MENU';
    END IF;`

const src = fs.readFileSync(SRC, 'utf8')
const beginIdx = src.indexOf('\nBEGIN;')
const commitIdx = src.indexOf('\nCOMMIT;')
if (beginIdx < 0 || commitIdx < 0) {
  console.error('ANCHOR_MISSING: BEGIN/COMMIT')
  process.exit(1)
}
let body = src.slice(beginIdx + 1, commitIdx + '\nCOMMIT;'.length)
if (!body.includes(ANCHOR)) {
  console.error('ANCHOR_MISSING: ERR_LEAD_TIME line')
  process.exit(1)
}
if (body.includes('ERR_PRE_ORDER_REQUIRES_MENU')) {
  console.error('ALREADY_PATCHED')
  process.exit(1)
}
body = body.replace(ANCHOR, INSERT)
if (!body.includes('ERR_PRE_ORDER_REQUIRES_MENU')) {
  console.error('INSERT_FAILED')
  process.exit(1)
}

const HEADER = `-- ============================================================
-- Migration 142 — PRE_ORDER ต้องมีเมนูจากปฏิทินของวันนั้น (R5c)
-- Owner directive 2026-10-23 (สัญญาปิดเซสชัน R5c):
--   "พรีออเดอร์มาจากเมนูที่แอดมินลงปฏิทินเท่านั้น (วันจากป้ายมุมเมนู ลูกค้าเลือกแค่รอบ)
--    ไม่อนุญาตพรีออเดอร์วันอิสระ — ไม่มีเมนูปฏิทินในตะกร้า = same-day เท่านั้น"
-- Contract changes (ตั้งใจ — ไม่ใช่ refactor):
--   142) create_order_with_items (PRE_ORDER branch): ต้องมี >=1 สินค้าที่อยู่ใน
--        menu_schedule (is_published, scheduled_date = p_scheduled_date, ยังไม่ผ่านรอบ)
--        · ตะกร้าไม่มีเมนูปฏิทินเลย = RAISE 'ERR_PRE_ORDER_REQUIRES_MENU' (ปิดช่องยิง API เลือกวันอิสระ)
--        · มีเมนูผูกวันแต่คนละวัน = RAISE 'ERR_PRODUCT_NOT_ON_MENU' (§5-C เดิม)
--        การผูก "วัน/รอบ" รายสินค้าคงอยู่ที่ enforce_menu_gate (ERR_PRODUCT_NOT_ON_MENU)
-- create_order_with_items body = 141 + gate 142 จุดเดียว (สร้างโดย e2e/m142Build.cjs — anchor-guarded)
-- สัญญาทดสอบ: e2e/contracts_142.sql
-- Rollback: apply ใหม่ supabase/migrations/141_pre_order_unify_menu_calendar.sql
-- ============================================================

`

fs.writeFileSync(OUT, HEADER + body, 'utf8')
console.log('WROTE=' + OUT + ' bytes=' + (HEADER + body).length)