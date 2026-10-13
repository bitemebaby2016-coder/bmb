#!/usr/bin/env bash
# ============================================================
# e2e/ci/local_stack_replica.sh — จำลอง CI contract stack ในเครื่องตัวเอง
# (Docker postgres:16, ephemeral) ใช้ iterate ก่อน push = เลียนแบบ
# .github/workflows/contract-tests.yml ทุก step
#
# วิธีใช้ (PowerShell — ทำตามลำดับ):
#   0) cd 'D:\A PROJECT\Bite Me Baby'
#      node e2e/ci/normalize_lf.cjs e2e/ci/local_stack_replica.sh
#      (บังคับ: Windows checkout อาจให้ไฟล์ CRLF → bash จะพังทันที)
#   1) docker rm -f bmb-pg 2>$null
#      docker run -d --name bmb-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bmb_contract -v 'D:\A PROJECT\Bite Me Baby:/mnt/repo' postgres:16
#   2) docker exec -d bmb-pg bash /mnt/repo/e2e/ci/local_stack_replica.sh
#   3) docker exec bmb-pg tail -f /tmp/run.log     (รอ ALL_GREEN — ถ้าพักจะลงท้าย *_FAIL)
#   4) docker rm -f bmb-pg
#
# หมายเหตุ:
# - ทุกอย่างอยู่ใน DB ชั่วคราวใน container — ไม่แตะ production เด็ดขาด
# - pattern ที่มี backslash อยู่ในไฟล์นี้เท่านั้น (ไม่ส่งผ่าน argv — เลี่ยง
#   ปัญหา escape หายใน PowerShell→docker ที่เคยทำให้ sed กลายเป็น s/r$//)
# - ห้ามใช้กับ DB ที่ไม่ใช่ disposable
# ============================================================
set -uo pipefail
export PGUSER=postgres PGDATABASE=bmb_contract
exec > /tmp/run.log 2>&1   # ทุก output ลง /tmp/run.log — ตรงกับคำสั่ง tail ใน header

psql -X -d postgres -c 'DROP DATABASE IF EXISTS bmb_contract' >/dev/null 2>&1
psql -X -d postgres -c 'CREATE DATABASE bmb_contract' >/dev/null 2>&1

# ---- copy repo -> /tmp/w และตัด CR ทิ้ง (ไฟล์ Windows checkout อาจเป็น CRLF) ----
rm -rf /tmp/w
mkdir -p /tmp/w/supabase
cp -r /mnt/repo/e2e /tmp/w/e2e
cp -r /mnt/repo/supabase/migrations /tmp/w/supabase/migrations
find /tmp/w -type f \( -name '*.sql' -o -name '*.sh' \) -print0 | while IFS= read -r -d '' f; do
  tr -d '\r' < "$f" > "$f.tr" && mv "$f.tr" "$f"
done
cd /tmp/w

echo "===== PRELUDE ====="
psql -X -v ON_ERROR_STOP=1 -f e2e/ci/00_prelude_supabase_stubs.sql || { echo PRELUDE_FAIL; exit 1; }

# ---- preprocessor (ตรงกับ workflow: แก้เฉพาะ temp copy — ห้ามแตะไฟล์ history) ----
preprocess() {
  local src="$1" dst="$2"
  sed -E \
    -e 's/^DO \} BEGIN$/DO $$ BEGIN/' \
    -e 's/^END \};$/END $$;/' \
    -e 's/^AS \}$/AS $$/' \
    -e 's/^\} SECURITY DEFINER;/$$ SECURITY DEFINER;/' \
    -e 's/\$\$_/\$\$/g' \
    -e 's/^={10,}BEGIN;/BEGIN;/' \
    -e "/sections=% still have null/ s/null.';/null.', v_p, v_c, v_s;/" \
    -e "/addon_groups=% still have null/ s/null.';/null.', v_ag, v_a, v_pag;/" \
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

shim() {
  local out rc
  out=$(psql -q -c "$2" 2>&1); rc=$?
  if [ $rc -ne 0 ]; then
    echo "SHIM_FAIL $1: $out"
  fi
}

echo "===== MIGRATIONS 001-123 (inventory mode) ====="
fail_count=0
fail_sum=""
for f in supabase/migrations/*.sql; do
  b=$(basename "$f")
  case "$b" in PROPOSED_*|124_*) echo "== skip $b"; continue ;; esac
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
  if [ $rc -ne 0 ]; then
    printf '%s\n' "$out"
    fail_count=$((fail_count+1))
    fail_sum="$fail_sum $b"
  fi
done
if [ $fail_count -gt 0 ]; then
  echo "MIGRATION_INVENTORY_FAIL: $fail_count file(s):$fail_sum"
  exit 1
fi
echo "All migrations 001-123 applied cleanly on isolated DB"

echo "===== CONTRACT 123 ====="
psql -X -v ON_ERROR_STOP=1 -f e2e/contracts_123_menu_publish.sql || { echo CONTRACT123_FAIL; exit 1; }

echo "===== APPLY 124 ====="
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/124_order_submit_idempotency.sql || { echo APPLY124_FAIL; exit 1; }

echo "===== CONTRACT 124 ====="
psql -X -v ON_ERROR_STOP=1 -f e2e/contracts_124_idempotency.sql || { echo CONTRACT124_FAIL; exit 1; }

echo "===== CLEANUP VERIFY ====="
echo "order_submissions=$(psql -Atc 'SELECT count(*) FROM public.order_submissions')"
echo "orders_09=$(psql -Atc "SELECT count(*) FROM public.orders WHERE customer_phone IN ('0900000000','0999999999')")"

echo "===== CONCURRENCY ====="
bash e2e/ci/concurrency_124.sh || { echo CONCURRENCY_FAIL; exit 1; }

echo "ALL_GREEN"