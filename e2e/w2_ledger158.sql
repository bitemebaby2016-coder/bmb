-- W-1/parity รอบสุดท้าย: ตรง ledger ให้เท่ากับสิ่งที่ fresh replay จะบันทึกเมื่อ apply 158 (ไฟล์อยู่ใน repo แล้ว)
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('158', '158_align_grants_and_rls', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3;