# Staged Workflow SQL — Reference Only (NOT Applied by WP1)

Owner สั่ง 2026-11-26 (WP1 Remediation §D): WP1 รับผิดชอบเฉพาะ Schema,
Constraints, Indexes, RLS และ Contract Definitions งาน Functions/RPC ทั้งหมด
ถูกย้ายมาไว้ที่นี้เป็น **design reference** ให้ WP เจ้าของนำไป apply

> ⚠️ ไฟล์ในโฟลเดอร์นี้ **ไม่ใช่ migration** — replay/CI จะไม่ apply
> WP เจ้าของต้อง promote เป็น migration เมื่อเริ่มงาน WP นั้น
> และต้องรัน integration test ของ WP นั้นก่อน merge

## Mapping ตามคำสั่ง Owner

| ไฟล์ | WP เจ้าของ | เนื้อหา |
|---|---|---|
| `wp2_po_workflow_rpc.sql` | **WP2** | generate_po_number + create/update/submit/approve_purchase_order |
| `wp4_grn_workflow_rpc.sql` | **WP4** | generate_grn_number + create_grn_draft + approve_grn |
| `wp6_wavg_posting_reversal.sql` | **WP6** | calculate_grn_line_landed_cost + post_goods_receipt_line/post_goods_receipt + reverse_grn |
| `wp7_price_history_read_api.sql` | **WP7** | get_purchase_price_history (SECURITY INVOKER — RLS บังคับ) |
| `wp8_po_dashboard_read_api.sql` | **WP8** | get_po_dashboard (SECURITY INVOKER — RLS บังคับ) |

## กฎบังคับทุกไฟล์ (Owner C/D)

1. **SECURITY DEFINER ต้องตรวจ role + org scope ในตัวเอง** — RLS ไม่บังคับ
   ภายใน SECURITY DEFINER ทุก function ต้องเรียก `public.has_org_row_scope()`
   (+ `has_staff_branch_scope()` สำหรับ staff) ก่อนแตะข้อมูล
2. **Read APIs ใช้ SECURITY INVOKER** เพื่อให้ RLS ของ 223 บังคับจริง
3. ห้ามอ้างคอลัมน์ที่ไม่มีจริง (`supplier_products.package_size` ไม่มี — m217;
   `goods_receipt_lines.landed_cost` ไม่มี — landed cost เก็บใน
   purchase_price_history.landed_cost / inventory_transactions.unit_cost)
4. Reversal = positive-quantity mirror + `reversal_of` linkage (ห้ามค่าติดลบ
   ใน goods_receipts/lines); idempotency ตาม contract คอลัมน์ของ migration 220
