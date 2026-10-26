// W-6 (Owner อนุมัติ 2026-10-26) — apply migration 157 + 158 บน production แบบ staged
//   รันตามลำดับ: precheck → apply157 → apply158 → verify → record
//   ผลแต่ละ stage = e2e/w6Apply157158-<stage>.json (ruff pattern เดียวกับ r16Apply156.cjs)
//   **production write ที่ได้รับอนุมัติ**: 157 (anon policy scoping = P0) + 158 (RLS + align grants)
const fs = require('fs');
const token = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1];
if (!token) { console.log('NO_ACCESS_TOKEN'); process.exit(1); }
const REF = 'ivkdfognyiwjcmrhcnwz';
const q = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: await r.text() };
};
const stage = process.argv[2] || 'precheck';
const results = [];
const log = (label, r) => {
  let parsed; try { parsed = JSON.parse(r.body); } catch { parsed = String(r.body).slice(0, 600); }
  results.push({ label, status: r.status, data: parsed });
  console.log(`[${label}] status=${r.status} ${JSON.stringify(parsed).slice(0, 700)}`);
};
const save = () => fs.writeFileSync(`e2e/w6Apply157158-${stage}.json`, JSON.stringify(results, null, 2));

(async () => {
  if (stage === 'precheck') {
    log('ledger-top', await q('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'));
    log('already-157-158', await q("SELECT version FROM supabase_migrations.schema_migrations WHERE version IN ('157','158')"));
    log('backup-recency', await q("SELECT count(*) AS recent FROM storage.objects WHERE bucket_id='db-backups' AND created_at > now() - interval '14 days'"));
    log('anon-visible-helper-policies-before', await q(
      `SELECT count(*) AS n FROM pg_policies WHERE schemaname='public'
       AND (roles::text[] @> ARRAY['anon'] OR roles::text[] @> ARRAY['public'])
       AND (qual ~ 'is_[a-z_]+\\s*\\(' OR COALESCE(with_check,'') ~ 'is_[a-z_]+\\s*\\(')`));
    log('rls-two-tables-before', await q(
      `SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname IN ('admin_portfolio_items','products_branch_overrides')`));
  } else if (stage === 'apply157') {
    log('apply-157', await q(fs.readFileSync('supabase/migrations/157_anon_policy_role_scoping.sql', 'utf8')));
  } else if (stage === 'apply158') {
    log('apply-158', await q(fs.readFileSync('supabase/migrations/158_align_grants_and_rls.sql', 'utf8')));
  } else if (stage === 'verify') {
    log('anon-visible-helper-policies-after', await q(
      `SELECT count(*) AS n FROM pg_policies WHERE schemaname='public'
       AND (roles::text[] @> ARRAY['anon'] OR roles::text[] @> ARRAY['public'])
       AND (qual ~ 'is_[a-z_]+\\s*\\(' OR COALESCE(with_check,'') ~ 'is_[a-z_]+\\s*\\(')`));
    log('reviews-anon-read', await q(
      "SELECT policyname, roles::text FROM pg_policies WHERE schemaname='public' AND tablename='reviews' AND policyname='reviews_anon_read'"));
    log('rls-two-tables-after', await q(
      `SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname IN ('admin_portfolio_items','products_branch_overrides')`));
    log('anon-still-cannot-write', await q(
      `SELECT count(*) AS leak FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relkind IN ('r','p','v')
         AND (has_table_privilege('anon', c.oid, 'INSERT') OR has_table_privilege('anon', c.oid, 'UPDATE')
           OR has_table_privilege('anon', c.oid, 'DELETE'))`));
    log('authenticated-select-count', await q(
      `SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relkind IN ('r','p','v')
         AND has_table_privilege('authenticated', c.oid, 'SELECT')`));
  } else if (stage === 'record') {
    log('record-157', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('157','157_anon_policy_role_scoping','{}'::text[]) ON CONFLICT (version) DO NOTHING"));
    log('record-158', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('158','158_align_grants_and_rls','{}'::text[]) ON CONFLICT (version) DO NOTHING"));
    log('history-after', await q('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 4'));
  } else {
    console.error('unknown stage'); process.exit(1);
  }
  save();
  const bad = results.filter((r) => r.status >= 400);
  const sqlErr = results.filter((r) => JSON.stringify(r.data).includes('ERROR:'));
  if (bad.length || sqlErr.length) {
    console.log('STAGE_FAIL', stage, [...bad, ...sqlErr].map((b) => b.label).join(','));
    process.exitCode = 1; return;
  }
  console.log('STAGE_OK', stage);
})().catch((e) => { console.error(e); process.exit(1); });