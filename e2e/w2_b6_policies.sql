-- W-2/B-6 — สร้างรายการ policy ที่ anon ต้องประเมิน nhưngเรียก helper ที่ anon ไม่มีสิทธิ์ EXECUTE
SELECT policyname, tablename, permissive, cmd, roles, qual, COALESCE(with_check,'') AS with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (roles::text[] @> ARRAY['anon'] OR roles::text[] @> ARRAY['public'])
  AND (qual ~ 'is_[a-z_]+\s*\(' OR COALESCE(with_check,'') ~ 'is_[a-z_]+\s*\(')
ORDER BY tablename, policyname;

SELECT 'COUNT' AS kind, count(*) AS n
FROM pg_policies
WHERE schemaname = 'public'
  AND (roles::text[] @> ARRAY['anon'] OR roles::text[] @> ARRAY['public'])
  AND (qual ~ 'is_[a-z_]+\s*\(' OR COALESCE(with_check,'') ~ 'is_[a-z_]+\s*\(');