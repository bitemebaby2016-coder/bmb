# BMB — WHITE-LABEL TENANCY DATA MATRIX (37 production tables)

อ้าง: `BMB_WHITE_LABEL_TENANCY_ARCHITECTURE.md` · ตรวจจาก prod (information_schema FK + pg_policies) · **ทุกตาราง: ปัจจุบันไม่มี tenant/store/brand column**

| # | Table | Purpose | คลาส | Isolation จำเป็น? | Ownership anchor (อนาคต) | Current RLS (สรุป) | RPC deps |
|---|---|---|---|---|---|---|---|
| 1 | products | catalog สินค้า | B | ✅ | self.tenant_id | public_read(is_available)/admin(is_admin) | create_order, compute_addons_price |
| 2 | product_categories | หมวดสินค้า | B | ✅ | self.tenant_id (anchor) | public_read(is_active)/admin | — |
| 3 | menu_schedule | weekly PRE_ORDER | B (ผ่าน products) | ✅ | derive products | admin/read | enforce_menu_gate, get_menu_for_date |
| 4 | promotions | โปรฯ | B | ✅ | self | public/admin | order promo logic |
| 5 | delivery_rounds | รอบส่ง | B | ✅ | self | public/admin | create_order, capacity |
| 6 | delivery_zones | โซนส่ง | B | ✅ | self | public/admin | delivery fee |
| 7 | inventory | วัตถุดิบ | B | ✅ | self | admin/anon_read | bom, deduct |
| 8 | inventory_transactions | การเคลื่อนไหว stock | B | ✅ | derive inventory | anon/admin (cmd=ALL ต้องตรวจ qual) | INV-01/02 |
| 9 | recipes | recipe/BOM | B | ✅ | self (+inventory) | auth_read/admin | bom feasibility |
| 10 | production_batches | batch ผลิต | B | ✅ | self | admin | kitchen |
| 11 | production_batch_items | items ใน batch | B (ผ่าน batch) | ✅ | derive batch | admin | — |
| 12 | business_settings | settings key-value | B | ✅ (หรือ global ช่วงแรก) | self | admin/auth-read/anon-deny | mode gates |
| 13 | media_assets | รูป/metadata | B | ✅ | self + asset_type | public_read/admin | upload lib |
| 14 | mascot_overrides | mascot ต่อ role | B | ✅ (NULL=default) | self | anon_read/admin | upsert_mascot_override |
| 15 | customers | ลูกค้า | C | ✅ | self.tenant_id | admin/anon(cmd=ALL ตรวจ qual)/own | create_order, OTP flows |
| 16 | orders | ออเดอร์ | C | ✅ | self.tenant_id (**anchor order spine**) | own insert/read/update + admin | state machine, create_order_with_items |
| 17 | order_items | รายการ+snapshot | C (derive ผ่าน orders) | ✅ | derive orders (FK มีอยู่) | anon/own/admin (cmd=ALL ตรวจ qual) | create_order |
| 18 | order_status_history | ประวัติสถานะ | C (derive) | ✅ | derive orders(order_number) | admin_read | 040 trigger |
| 19 | payment_intents | การชำระ | C (derive) | ✅ | derive orders(order_number) | own/anon(cmd=ALL ตรวจ qual)/admin | payment EF, record_payment_result |
| 20 | delivery_assignments | จ่ายไรเดอร์ | C (derive) | ✅ | derive orders(order_number) | deny anon/admin/scoped driver | assign_driver, driver RPCs |
| 21 | drivers | ไรเดอร์ | A/B (Owner ตัดสิน: pool ร่วม/ต่อ tenant) | ⚠ | self (nullable ถ้า pool) | self-update/scoped/admin | driver RPCs |
| 22 | pre_orders | จองล่วงหน้า | C | ✅ | derive customer/products | archive read (own/admin/anon) | preorder RPCs |
| 23 | preorder_votes | โหวตเมนู | C | ✅ | derive products | admin/anon insert/public read | — |
| 24 | reviews | รีวิว | C | ✅ | self/derive products | own/admin/public | review EFs |
| 25 | loyalty_points | คะแนน | C | ✅ | derive customers | own/admin | reward logic |
| 26 | notifications | แจ้งเตือนลูกค้า | C | ✅ | derive customers | own/admin/anon(cmd=ALL ตรวจ) | dispatch automation |
| 27 | notification_prefs | ตั้งค่าแจ้งเตือน | C | ✅ | derive customers | own/admin/deny anon | — |
| 28 | track_order_attempts | w5h1 tracking | C | ✅ | derive orders | (ตรวจต่อ TEN-08) | tracking |
| 29 | provider_orders | external providers | C (derive) | ✅ | derive orders | own/admin/anon(cmd=ALL ตรวจ) | external sync (frozen providers) |
| 30 | customers↔channels (customer_channel_identities) | identity ลูกค้า | A/C | ✅ | platform + tenant scope | admin_read | OTP/LINE (frozen) |
| 31 | ai_conversations | AI chat | C | ✅ | derive customers | own/admin/anon(cmd=ALL ตรวจ) | AI service |
| 32 | ai_customer_memory | AI memory | C | ✅ | derive customers | deny anon/own/admin | AI memory |
| 33 | ai_recommendations | AI แนะนำ | C | ✅ | derive customers/products | own/admin/anon | AI |
| 34 | profiles | บัญชี admin/staff | A | ✅ (platform + tenant membership) | tenant_id ใหม่ + platform_admin | own/admin/public limited | is_admin() |
| 35 | audit_logs | audit trail | A (global, เก็บ tenant id ใน payload ภายหลัง) | ✅ (read ระดับ platform) | platform | anon deny-ish/admin/own | ทุก EF ที่เขียน audit |
| 36 | system_errors | error reporting | A | ❌ (platform) | platform | admin_read | errorReporter |
| 37 | content_approvals | content moderation | A | ⚠ (platform ระดับกลาง) | platform (+tenant ภายหลังได้) | admin/auth/anon(cmd=ALL ตรวจ) | content automation |

**หมายเหตุ:** ตารางประเภท derive ไม่ต้องเพิ่ม tenant_id เอง (RLS subquery/JOIN) ตาม contract §9 — ลดจำนวน migration และรักษา snapshot เดิม · policy cmd=ALL ที่ให้ anon ยังต้องตรวจ qual รายตัวใน TEN-08 (ไม่ใช่สถานะ BLOCKED ของ contract นี้ แต่เป็นงานตรวจจริงก่อน enforce)

## 🔴 HARD STOP — รอ Owner review
