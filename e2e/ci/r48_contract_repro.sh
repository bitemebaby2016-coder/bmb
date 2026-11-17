#!/usr/bin/env bash
# ============================================================
# e2e/ci/r48_contract_repro.sh — R48 (2026-11-17) full CI contract replica
#   Owner สั่ง: ทดสอบให้ผ่านจริงก่อน apply/commit/push
#   = เลียนแบบ .github/workflows/contract-tests.yml ทุก step บน Docker postgres:16
#   (prelude → apply migrations 001..N ยกเว้น 124 → contract 123 → apply 124
#    → contract 124 → cleanup verify → concurrency → contracts ทั้งชุด → legacy 7 → 190)
#   CI จริงล้มที่ Contract 135 หลัง m181 (run 44086503471) — รอบ 1 ของสคริปต์นี้
#   พิสูจน์บั๊ก (135+020 = "function is not unique") แล้วแก้ m181 (207 ปัจจุบัน)
#   → รอบนี้ต้อง ALL_GREEN ทั้งชุด
# วิธีรัน:
#   node e2e/ci/normalize_lf.cjs e2e/ci/r48_contract_repro.sh
#   docker rm -f bmb_replay_r48; docker run -d --name bmb_replay_r48 \
#     -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bmb_replay \
#     -v "<repo>:/mnt/repo" postgres:16
#   docker exec bmb_replay_r48 bash /mnt/repo/e2e/ci/r48_contract_repro.sh
# ============================================================
set -uo pipefail
export PGUSER=postgres
export PGDATABASE=bmb_replay

REPO=/mnt/repo
LOG="$REPO/e2e/r48-contract-repro-2026-11-17.log"
: > "$LOG"
exec > >(tee "$LOG") 2>&1

echo "===== R48 FULL CONTRACT REPLICA $(date -u +%FT%TZ) ====="
psql -X -d postgres -c "DROP DATABASE IF EXISTS bmb_replay" >/dev/null 2>&1
psql -X -d postgres -c "CREATE DATABASE bmb_replay" || { echo CREATE_DB_FAIL; exit 1; }

rm -rf /tmp/w
mkdir -p /tmp/w/supabase
cp -r "$REPO/e2e" /tmp/w/e2e
cp -r "$REPO/supabase/migrations" /tmp/w/supabase/migrations
find /tmp/w -type f \( -name '*.sql' -o -name '*.sh' \) -print0 | while IFS= read -r -d '' f; do
  tr -d '\r' < "$f" > "$f.tr" && mv "$f.tr" "$f"
done
cd /tmp/w || exit 1

echo "===== PRELUDE ====="
psql -X -v ON_ERROR_STOP=1 -f e2e/ci/00_prelude_supabase_stubs.sql || { echo PRELUDE_FAIL; exit 1; }

preprocess() {
  local src="$1" dst="$2"
  sed -E \
    -e 's/^DO \} BEGIN$/DO $$ BEGIN/' \
    -e 's/^END \};$/END $$;/' \
    -e 's/^AS \}$/AS $$/' \
    -e 's/^\} SECURITY DEFINER;/$$ SECURITY DEFINER;/' \
    -e 's/\$\$_/\$\$/g' \
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

shim() {
  local out rc
  out=$(psql -q -c "$2" 2>&1); rc=$?
  if [ $rc -ne 0 ]; then echo "SHIM_FAIL $1: $out"; else echo "shim OK: $1"; fi
}

echo "===== MIGRATIONS (inventory mode — skip 124 เหมือน CI) ====="
fail_count=0
for f in supabase/migrations/[0-9][0-9][0-9]_*.sql; do
  b=$(basename "$f")
  case "$b" in 124_*) echo "== skip $b"; continue ;; esac
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
    echo "FAIL $b"
  fi
done
if [ $fail_count -gt 0 ]; then
  echo "MIGRATIONS_FAIL count=$fail_count"
  exit 1
fi
echo "MIGRATIONS_ALL_APPLIED"

# ---- widen hours (เหมือน CI) ----
psql -X -v ON_ERROR_STOP=1 -c "UPDATE public.business_settings SET value = '{\"open\":\"00:00\",\"close\":\"23:59\"}'::jsonb WHERE key = 'hours'" || exit 1

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

echo "===== CONTRACTS ที่เหลือ (order เดียวกับ CI) ====="
cfail=0
for f in \
  e2e/contracts_127_130.sql \
  e2e/contracts_131_register_customers.sql \
  e2e/contracts_133_payment_slip.sql \
  e2e/contracts_135_dispatch_offers.sql \
  e2e/contracts_136_driver_location.sql \
  e2e/contracts_137_marketing_posts.sql \
  e2e/contracts_138_139.sql \
  e2e/contracts_140.sql \
  e2e/contracts_141.sql \
  e2e/contracts_142.sql \
  e2e/contracts_143.sql \
  e2e/contracts_144.sql \
  e2e/contracts_148_same_day_no_cutoff.sql \
  e2e/contracts_146.sql \
  e2e/contracts_149_round_archive.sql \
  e2e/contracts_147.sql \
  e2e/contracts_153_promotion_campaign_controls.sql \
  e2e/contracts_154_referral_program.sql \
  e2e/contracts_155_loyalty_tiers.sql \
  e2e/contracts_156_engagement_play.sql \
  e2e/contracts_163_rider_step_sync.sql \
  e2e/contracts_184_pickup_outside_hours.sql \
  e2e/contracts_017_018.sql \
  e2e/contracts_019_kitchen.sql \
  e2e/contracts_020_bite_drive.sql \
  e2e/contracts_021_phase4.sql \
  e2e/contracts_022_phases_5_7.sql \
  e2e/contracts_029_round_grant.sql \
  e2e/contracts_033_table_acl.sql \
  e2e/contracts_190_bkk_date_gates.sql
do
  echo "===== $f ====="
  out=$(psql -X -v ON_ERROR_STOP=1 -f "$f" 2>&1); rc=$?
  printf '%s\n' "$out"
  if [ $rc -ne 0 ]; then
    cfail=$((cfail+1))
    echo "CONTRACT_FAIL $f"
  elif [ "$f" = "e2e/contracts_184_pickup_outside_hours.sql" ]; then
    if ! printf '%s' "$out" | grep -q 'R65_184_RESULTS'; then
      echo "CONTRACT_FAIL $f (R65_184_RESULTS marker missing)"
      cfail=$((cfail+1))
    else
      echo "CONTRACT_OK $f"
    fi
  else
    echo "CONTRACT_OK $f"
  fi
done

echo "===== SUMMARY ====="
if [ $cfail -gt 0 ]; then
  echo "R48_FULL_FAIL contracts_failed=$cfail"
  exit 1
fi
echo "R48_FULL_ALL_GREEN"