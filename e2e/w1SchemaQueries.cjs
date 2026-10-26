// W-1 (fresh replay เทียบ production) — ชุด query อ่านอย่างเดียว (SELECT เท่านั้น)
// ใช้ร่วมกันทั้ง 2 ฝั่ง:
//   · replay ท้องถิ่น  → docker exec psql (e2e/w1Snapshot.cjs local)
//   · production       → Supabase Management API /database/query (e2e/w1Snapshot.cjs prod)
// ขอบเขต = schema `public` เท่านั้น — auth/storage/realtime เป็นของ Supabase-managed
// และถูกแทนด้วย prelude stubs ใน replay (เทียบกันไม่ได้โดยชอบธรรม) → ตัดออกพร้อมบันทึก
// เกณฑ์ปิด W-1 (handoff): ตาราง/คอลัมน์/index/policy/ACL/RLS + ledger version ต้องไม่มี drift
// ที่ไม่มีคำอธิบาย

const QUERIES = [
  {
    label: 'meta',
    info: true,
    sql: "SELECT current_setting('server_version') AS server_version, current_database() AS db",
  },
  {
    label: 'tables',
    sql: "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
  },
  {
    label: 'columns',
    sql: `SELECT table_name, column_name, data_type, udt_name, is_nullable,
                 COALESCE(column_default, '') AS column_default,
                 COALESCE(character_maximum_length::text, '') AS char_len,
                 COALESCE(numeric_precision::text, '') AS num_precision,
                 COALESCE(numeric_scale::text, '') AS num_scale
          FROM information_schema.columns
          WHERE table_schema='public'
          ORDER BY table_name, ordinal_position`,
  },
  {
    label: 'indexes',
    sql: "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname",
  },
  {
    label: 'rls',
    sql: `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r'
          ORDER BY c.relname`,
  },
  {
    label: 'policies',
    sql: `SELECT tablename, policyname, permissive, roles, cmd,
                 COALESCE(qual, '') AS qual, COALESCE(with_check, '') AS with_check
          FROM pg_policies WHERE schemaname='public'
          ORDER BY tablename, policyname`,
  },
  {
    label: 'acl_tables',
    sql: `SELECT table_name, grantee, privilege_type, is_grantable
          FROM information_schema.role_table_grants
          WHERE table_schema='public' AND grantee IN ('anon', 'authenticated', 'service_role')
          ORDER BY table_name, grantee, privilege_type`,
  },
  {
    label: 'acl_functions',
    sql: `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
                 has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
                 has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
                 has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc_exec
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='public'
          ORDER BY p.proname, args`,
  },
  {
    label: 'functions',
    sql: `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
                 pg_get_function_result(p.oid) AS result,
                 p.prosecdef AS security_definer, p.provolatile AS volatility,
                 md5(COALESCE(p.prosrc, '')) AS body_md5,
                 md5(btrim(regexp_replace(regexp_replace(COALESCE(p.prosrc, ''), E'\r', '', 'g'), E'[ \t]+$', '', 'gm'), E'\n \t')) AS body_md5_norm
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='public'
          ORDER BY p.proname, args`,
  },
  {
    label: 'views',
    sql: "SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name",
  },
  {
    label: 'triggers',
    sql: `SELECT t.tgname, c.relname AS on_table, t.tgenabled
          FROM pg_trigger t
          JOIN pg_class c ON c.oid = t.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND NOT t.tgisinternal
          ORDER BY c.relname, t.tgname`,
  },
  {
    label: 'constraints',
    sql: `SELECT conrelid::regclass::text AS subject, conname, pg_get_constraintdef(oid) AS def
          FROM pg_constraint
          WHERE connamespace = 'public'::regnamespace
          ORDER BY subject, conname`,
  },
  {
    label: 'sequences',
    sql: "SELECT sequence_name, data_type, start_value FROM information_schema.sequences WHERE sequence_schema='public' ORDER BY sequence_name",
  },
  {
    label: 'ledger',
    sql: "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version",
  },
];

module.exports = { QUERIES };