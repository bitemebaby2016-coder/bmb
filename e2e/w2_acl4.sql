SELECT 'ANON_WRITE_LEAK' AS kind, c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v')
  AND (has_table_privilege('anon', c.oid, 'INSERT')
    OR has_table_privilege('anon', c.oid, 'UPDATE')
    OR has_table_privilege('anon', c.oid, 'DELETE')
    OR has_table_privilege('anon', c.oid, 'TRUNCATE')
    OR has_table_privilege('anon', c.oid, 'REFERENCES')
    OR has_table_privilege('anon', c.oid, 'TRIGGER'))
ORDER BY 1, 2;

SELECT 'SVC_INCOMPLETE' AS kind, c.relname,
  has_table_privilege('service_role', c.oid, 'SELECT') AS s,
  has_table_privilege('service_role', c.oid, 'INSERT') AS i,
  has_table_privilege('service_role', c.oid, 'UPDATE') AS u,
  has_table_privilege('service_role', c.oid, 'DELETE') AS d
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v')
  AND NOT (has_table_privilege('service_role', c.oid, 'SELECT')
       AND has_table_privilege('service_role', c.oid, 'INSERT')
       AND has_table_privilege('service_role', c.oid, 'UPDATE')
       AND has_table_privilege('service_role', c.oid, 'DELETE'))
ORDER BY 1, 2;

SELECT 'ANON_FUNCTION_EXEC_GRANTS' AS kind, count(*) AS n
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE');