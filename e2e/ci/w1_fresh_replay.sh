#!/usr/bin/env bash
# ============================================================
# W-1 (2026-10-26) — FRESH REPLAY เทียบ production (Owner APPROVED)
#   สร้าง DB สะอาดใน container → prelude stubs → apply 001..156 ตามลำดับ
#   → บันทึกผลทุกไฟล์เป็น evidence (ห้ามอ้างผลในหัว)
# preprocessor + shims = port VERBATIM จาก .github/workflows/contract-tests.yml
# (แก้เฉพาะ temp copy — ไฟล์ history ไม่ถูกแตะ)
#
# วิธีใช้ (ผ่าน e2e/ci/w1_run_replay.bat บน host — path มีช่องว่าง ห้ามพิมพ์ตรง):
#   docker exec bmb_replay_w1 bash /mnt/repo/e2e/ci/w1_fresh_replay.sh
# ผล: /mnt/repo/e2e/w1-replay-apply-20261026.log + .jsonl
# exit 0 เฉพาะเมื่อครบทุกไฟล์ (156/156)
# ============================================================
set -uo pipefail
export PGUSER=postgres
export PGDATABASE=bmb_replay

REPO=/mnt/repo
STAMP="${W1_STAMP:-2026-10-26}"
LOG="$REPO/e2e/w1-replay-apply-$STAMP.log"
JSONL="$REPO/e2e/w1-replay-apply-$STAMP.jsonl"

: > "$JSONL"
exec > >(tee "$LOG") 2>&1

echo "===== W-1 FRESH REPLAY $(date -u +%FT%TZ) ====="
psql -X -d postgres -c "DROP DATABASE IF EXISTS bmb_replay" >/dev/null 2>&1
psql -X -d postgres -c "CREATE DATABASE bmb_replay" || { echo CREATE_DB_FAIL; exit 1; }

# ---- copy repo -> /tmp/w และตัด CR ทิ้ง (checkout ฝั่ง Windows เป็น CRLF) ----
rm -rf /tmp/w
mkdir -p /tmp/w/supabase
cp -r "$REPO/e2e" /tmp/w/e2e
cp -r "$REPO/supabase/migrations" /tmp/w/supabase/migrations
find /tmp/w -type f \( -name '*.sql' -o -name '*.sh' \) -print0 | while IFS= read -r -d '' f; do
  tr -d '\r' < "$f" > "$f.tr" && mv "$f.tr" "$f"
done
cd /tmp/w || exit 1

echo "===== PRELUDE (supabase stubs แบบ CI) ====="
psql -X -v ON_ERROR_STOP=1 -f e2e/ci/00_prelude_supabase_stubs.sql || { echo PRELUDE_FAIL; exit 1; }

# ---- ledger แบบ Supabase (ให้เทียบกับ production ได้ตรง ๆ) ----
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  name text,
  statements text[]
);
SQL
[ $? -ne 0 ] && { echo LEDGER_INIT_FAIL; exit 1; }

# ---- preprocessor (verbatim จาก contract-tests.yml) ----
preprocess() {
  local src="$1" dst="$2"
  sed -E \
    -e 's/^DO \} BEGIN$/DO $$ BEGIN/' \
    -e 's/^END \};$/END $$;/' \
    -e 's/^AS \}$/AS $$/' \
    -e 's/^\} SECURITY DEFINER;/$$ SECURITY DEFINER;/' \
    -e 's/\$\$_/$$/g' \
    -e 's/^={10,}BEGIN;/BEGIN;/' \
    -e "/sections=% still have null/ s/null\.';/null.', v_p, v_c, v_s;/" \
    -e "/addon_groups=% still have null/ s/null\.';/null.', v_ag, v_a, v_pag;/" \
    -e '/p_date\), 0 rdy$/ s/COUNT\(\*\) cnt FROM/COUNT(*) cnt, 0 rdy FROM/' \
    -e '/cnt, 0 rdy FROM/ s/, 0 rdy$//' \
    "$src" > "$dst"
  awk '
    BEGIN { inq=0 }
    {
      line=$0
      tmp=line; n=0
      while (match(tmp, /\$\$/)) { n++; tmp=substr(tmp, RSTART+RLENGTH) }
      if (n%2==1) inq=!inq
      if (!inq && line ~ /^[[:space:]]*CREATE POLICY[[:space:]]+/) {
        t=line; sub(/^[[:space:]]*/,"",t); m=split(t,a,/[[:space:]]+/)
        if (m>=5 && a[1]=="CREATE" && a[2]=="POLICY" && a[4]=="ON")
          printf "DROP POLICY IF EXISTS %s ON %s;\n", a[3], a[5]
      }
      print line
    }
  ' "$dst" > "$dst.awk" && mv "$dst.awk" "$dst"
}

shim() { # $1 = label, $2 = sql (CI-only repair; history file untouched)
  local out rc
  out=$(psql -q -c "$2" 2>&1); rc=$?
  if [ $rc -ne 0 ]; then echo "SHIM_FAIL $1: $out"; else echo "shim OK: $1"; fi
}
echo "===== MIGRATIONS 001..156 (numeric order) ====="
fail_count=0
fail_sum=""
ok_count=0
for f in supabase/migrations/[0-9][0-9][0-9]_*.sql; do
  b=$(basename "$f")
  ver="${b%%_*}"
  if [ "$b" = "035_m1_closure_p0_blockers.sql" ]; then
    shim "$b" "DROP FUNCTION IF EXISTS public.compute_delivery_fee(numeric,numeric,text,integer,numeric);"
    shim "$b" "ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT '';"
  fi
  if [ "$b" = "037_m1_p0_blockers_repaired.sql" ]; then
    shim "$b" "DROP FUNCTION IF EXISTS public.compute_delivery_fee(numeric,numeric,text,integer,numeric);"
  fi
  if [ "$b" = "065_rls_isolation.sql" ]; then
    shim "$b" "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id TEXT; ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_platform BOOLEAN DEFAULT false;"
  fi
  if [ "$b" = "066_profiles_tenant_authority.sql" ]; then
    shim "$b" "INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role) VALUES ('dddf4b57-405f-4852-a985-76d8d52b1b72','fixture-owner@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated') ON CONFLICT (id) DO NOTHING; INSERT INTO public.profiles (id, role) VALUES ('dddf4b57-405f-4852-a985-76d8d52b1b72','admin') ON CONFLICT (id) DO NOTHING;"
  fi
  if [ "$b" = "081_branches_table.sql" ]; then
    shim "$b" "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id TEXT;"
  fi
  if [ "$b" = "107_product_backfill_scope_constraints.sql" ]; then
    shim "$b" "INSERT INTO public.media_assets (id, url, asset_key, category) VALUES ('fx-ma-1','https://example.invalid/legacy1.png','fx-key-1','product'),('fx-ma-2','https://example.invalid/legacy2.png','fx-key-2','product'),('fx-ma-3','https://example.invalid/legacy3.png','fx-key-3','product'),('fx-ma-4','https://example.invalid/legacy4.png','fx-key-4','product'),('fx-ma-5','https://example.invalid/legacy5.png','fx-key-5','product'),('fx-ma-6','https://example.invalid/legacy6.png','fx-key-6','product'),('fx-ma-7','https://example.invalid/legacy7.png','fx-key-7','product'),('fx-ma-8','https://example.invalid/legacy8.png','fx-key-8','product'),('fx-ma-9','https://example.invalid/legacy9.png','fx-key-9','product') ON CONFLICT (id) DO NOTHING;"
  fi

  tmp=$(mktemp)
  preprocess "$f" "$tmp"
  echo "== apply $b"
  out=$(psql -X -v ON_ERROR_STOP=1 -q -f "$tmp" 2>&1); rc=$?
  rm -f "$tmp"
  printf '%s\n' "$out"
  if [ $rc -ne 0 ]; then
    fail_count=$((fail_count+1))
    fail_sum="$fail_sum $b"
    msg=$(printf '%s\n' "$out" | grep -m1 'ERROR:' || echo "failed rc=$rc")
    echo "FAIL $b :: $msg"
    printf '{"file":"%s","version":"%s","status":"FAIL","error":"%s"}\n' \
      "$b" "$ver" "$(printf '%s' "$msg" | sed 's/"/\\"/g' | tr -d '\n')" >> "$JSONL"
  else
    ok_count=$((ok_count+1))
    printf '{"file":"%s","version":"%s","status":"OK"}\n' "$b" "$ver" >> "$JSONL"
    psql -X -v ON_ERROR_STOP=1 -q -c \
      "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('$ver', '$(printf '%s' "$b" | sed "s/\.sql$//")', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING" >/dev/null 2>&1 \
      || echo "LEDGER_INSERT_FAIL $b"
  fi
done

echo "===== SUMMARY ====="
echo "OK=$ok_count FAIL=$fail_count"
if [ $fail_count -gt 0 ]; then
  echo "REPLAY_FAIL:$fail_sum"
  exit 1
fi
echo "REPLAY_ALL_GREEN $ok_count/$((ok_count + fail_count))"