# BMB_02_MIGRATION_DRIFT.md
**Read-only comparison: repo migrations (39) vs production `supabase_migrations.schema_migrations` + live catalog probes**
**Evidence:** `e2e/prod-phase2-audit.json` (2026-09-27)

## Migration history

- LOCAL: 39 files (001–039) in `supabase/migrations/`
- REMOTE: 39 recorded versions, 001→039 ตรงลำดับชื่อ
- LOCAL ONLY: none Â· PRODUCTION ONLY (stale history rows): none

## Object-level drift

| ประเภท | ผลการตรวจ |
|---|---|
| Tables | 35 ตาราง public — ไม่พบ table ที่ไม่มีที่มา (ทั้งหมดสอดคล้องกับชุด migration 019/020/021/022/039 ฯลฯ) — ยังไม่ได้ diff body-by-body |
| Enums | order_mode/order_status/payment_status/payment_method/delivery_method/round_period/ingredient_status — ตรงกับที่ migrations กำหนด |
| Triggers | มี order/status/payment/round/menu triggers (trigger list ใน JSON) — ตรงกับ design 007/008/030/038/039 |
| Functions | 103 functions — probe keyword-level ยืนยัน create_order_with_items/enforce_pre_order_window/ensure_rounds_for_date มี cutoff/capacity logic จริง |
| Views | public_profiles (view) — write path ปิด (grant: authenticated SELECT เท่านั้น) |
| Extensions | probe มีใน JSON (เช่น pg_trgm — เห็น gin_trgm functions) |

## สรุป

**ไม่พบ migration drift ระดับชุด** (39/39 ตรงกัน) — drift จริงที่พบคือระดับ **deployment surface**: Edge Functions (4/14) และระดับ **code-vs-doc** (README stale 34/34)
**NOT VERIFIED:** body-level equality ของ functions กับ SQL ใน migration files (ต้อง dump + diff — แนะนำเป็นงานถัดไปถ้าต้องการความแน่นอน 100%)


