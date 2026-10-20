#!/bin/sh
# ============================================================
# Bite Me Baby — apply ALL numbered migrations on an ephemeral DB
# (local + CI harness — BACKEND-CAPABILITY-CLOSURE-2026-10-19)
#
# Preprocess rules are ported VERBATIM from .github/workflows/contract-tests.yml
# so local verification behaves exactly like CI (temp copies only — history
# files are never modified).
#
# Usage: sh apply_all_migrations.sh /migrations /ci
#   /migrations = mounted supabase/migrations (ro)
#   /ci         = mounted e2e/ci (ro) — prelude stubs
# Exit 0 only when EVERY migration 001-131 applies cleanly.
# ============================================================
set -u
MIG_DIR="${1:-/migrations}"
CI_DIR="${2:-/ci}"
DB="${PGDATABASE:-bmb}"

preprocess() {
  src="$1"; dst="$2"
  # normalize CRLF (Windows checkout) so the anchored sed rules match like CI
  tr -d '\r' < "$src" > "$dst.nocr"
  sed -E \
    -e 's/^DO \} BEGIN$/DO $$ BEGIN/' \
    -e 's/^END \};$/END $$;/' \
    -e 's/^AS \}$/AS $$/' \
    -e 's/^\} SECURITY DEFINER;/$$ SECURITY DEFINER;/' \
    -e 's/\$\$_/\$\$/g' \
    -e 's/^={10,}BEGIN;/BEGIN;/' \
    -e "/sections=% still have null/ s/null\.';/null.', v_p, v_c, v_s;/" \
    -e "/addon_groups=% still have null/ s/null\.';/null.', v_ag, v_a, v_pag;/" \
    -e '/p_date\), 0 rdy$/ s/COUNT\(\*\) cnt FROM/COUNT\(\*\) cnt, 0 rdy FROM/' \
    -e '/cnt, 0 rdy FROM/ s/, 0 rdy$//' \
    "$dst.nocr" > "$dst"
  rm -f "$dst.nocr"
  awk '
    BEGIN { inq=0 }
    {
      line=$0
      tmp=line; n=0
      while (match(tmp, /\$\$/)) { n++; tmp=substr(tmp, RSTART+RLENGTH) }
      if (n%2==1) inq=!inq
      if (!inq && line ~ /^[[:space:]]*CREATE POLICY[[:space:]]+/) {
        t=line; sub(/^[[:space:]]*/, "", t); m=split(t, a, /[[:space:]]+/)
        if (m>=5 && a[1]=="CREATE" && a[2]=="POLICY" && a[4]=="ON")
          printf "DROP POLICY IF EXISTS %s ON %s;\n", a[3], a[5]
      }
      print line
    }
  ' "$dst" > "$dst.awk" && mv "$dst.awk" "$dst"
}

echo "== prelude: supabase stubs =="
psql -q -v ON_ERROR_STOP=1 -U postgres -d "$DB" -f "$CI_DIR/00_prelude_supabase_stubs.sql" || {
  echo "PRELUDE FAILED"; exit 1; }

fail_count=0
fail_sum=""
shim() { # $1 = annotation, $2 = sql (CI-only repair; history files untouched)
  out=$(psql -q -U postgres -d "$DB" -c "$2" 2>&1)
  if [ $? -ne 0 ]; then echo "::error::$1 shim SQL failed: $out"; else echo "shim OK: $1"; fi
}
for f in "$MIG_DIR"/[0-9][0-9][0-9]_*.sql; do
  b=$(basename "$f")
  # shims ported VERBATIM from .github/workflows/contract-tests.yml (CI-only repairs
  # for pre-existing authoring-order defects — see BMB_MIGRATION_REPLAYABILITY_AUDIT.md)
  case "$b" in
    035_m1_closure_p0_blockers.sql)
      shim "$b" "DROP FUNCTION IF EXISTS public.compute_delivery_fee(numeric,numeric,text,integer,numeric);"
      shim "$b" "ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT '';"
      ;;
    037_m1_p0_blockers_repaired.sql)
      shim "$b" "DROP FUNCTION IF EXISTS public.compute_delivery_fee(numeric,numeric,text,integer,numeric);"
      ;;
    065_rls_isolation.sql)
      shim "$b" "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id TEXT; ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_platform BOOLEAN DEFAULT false;"
      ;;
    066_profiles_tenant_authority.sql)
      shim "$b" "INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role) VALUES ('dddf4b57-405f-4852-a985-76d8d52b1b72','fixture-owner@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated') ON CONFLICT (id) DO NOTHING; INSERT INTO public.profiles (id, role) VALUES ('dddf4b57-405f-4852-a985-76d8d52b1b72','admin') ON CONFLICT (id) DO NOTHING;"
      ;;
    081_branches_table.sql)
      shim "$b" "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id TEXT;"
      ;;
    107_product_backfill_scope_constraints.sql)
      shim "$b" "INSERT INTO public.media_assets (id, url, asset_key, category) VALUES ('fx-ma-1','https://example.invalid/legacy1.png','fx-key-1','product'),('fx-ma-2','https://example.invalid/legacy2.png','fx-key-2','product'),('fx-ma-3','https://example.invalid/legacy3.png','fx-key-3','product'),('fx-ma-4','https://example.invalid/legacy4.png','fx-key-4','product'),('fx-ma-5','https://example.invalid/legacy5.png','fx-key-5','product'),('fx-ma-6','https://example.invalid/legacy6.png','fx-key-6','product'),('fx-ma-7','https://example.invalid/legacy7.png','fx-key-7','product'),('fx-ma-8','https://example.invalid/legacy8.png','fx-key-8','product'),('fx-ma-9','https://example.invalid/legacy9.png','fx-key-9','product') ON CONFLICT (id) DO NOTHING;"
      ;;
  esac
  preprocess "$f" "/tmp/$b"
  out=$(psql -q -v ON_ERROR_STOP=1 -U postgres -d "$DB" -f "/tmp/$b" 2>&1)
  rc=$?
  if [ $rc -ne 0 ]; then
    fail_count=$((fail_count+1))
    fail_sum="$fail_sum $b"
    echo "::error::$b FAILED:"
    printf '%s\n' "$out" | head -5
  else
    echo "OK  $b"
  fi
done

if [ $fail_count -gt 0 ]; then
  echo "MIGRATION INVENTORY: $fail_count file(s) FAILED:$fail_sum"
  exit 1
fi
echo "ALL MIGRATIONS APPLIED CLEANLY (001-131)"