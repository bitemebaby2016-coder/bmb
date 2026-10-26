-- W-2/033 — ชุดสั้น: anon SELECT set จริง · anon write leak · service_role ที่ยังขาด · G2 targets
SELECT 'ANON_SELECT' AS kind, c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v')
  AND has_table_privilege('anon', 'public.' || c.relname, 'SELECT')
ORDER BY 1, 2;

SELECT 'ANON_WRITE_LEAK' AS kind, c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v')
  AND (has_table_privilege('anon', 'public.' || c.relname, 'INSERT')
    OR has_table_privilege('anon', 'public.' || c.relname, 'UPDATE')
    OR has_table_privilege('anon', 'public.' || c.relname, 'DELETE')
    OR has_table_privilege('anon', 'public.' || c.relname, 'TRUNCATE')
    OR has_table_privilege('anon', 'public.' || c.relname, 'REFERENCES')
    OR has_table_privilege('anon', 'public.' || c.relname, 'TRIGGER'))
ORDER BY 1, 2;

SELECT 'SVC_INCOMPLETE' AS kind, c.relname,
  has_table_privilege('service_role', 'public.' || c.relname, 'SELECT') AS s,
  has_table_privilege('service_role', 'public.' || c.relname, 'INSERT') AS i,
  has_table_privilege('service_role', 'public.' || c.relname, 'UPDATE') AS u,
  has_table_privilege('service_role', 'public.' || c.relname, 'DELETE') AS d
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v')
  AND NOT (has_table_privilege('service_role', 'public.' || c.relname, 'SELECT')
       AND has_table_privilege('service_role', 'public.' || c.relname, 'INSERT')
       AND has_table_privilege('service_role', 'public.' || c.relname, 'UPDATE')
       AND has_table_privilege('service_role', 'public.' || c.relname, 'DELETE'))
ORDER BY 1, 2;

SELECT 'G2_TARGET' AS kind, c.relname,
  has_table_privilege('authenticated', 'public.' || c.relname, 'SELECT') AS a_sel,
  has_table_privilege('authenticated', 'public.' || c.relname, 'INSERT') AS a_ins,
  has_table_privilege('authenticated', 'public.' || c.relname, 'UPDATE') AS a_upd,
  has_table_privilege('authenticated', 'public.' || c.relname, 'DELETE') AS a_del
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('business_settings','content_approvals','media_assets','mascot_overrides')
ORDER BY 1, 2;