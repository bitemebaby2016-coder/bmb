-- ============================================
-- Bite Me Baby — Migration 096: Repair Thai text encoding (mojibake fix)
-- Root cause: 095 seed file was double-encoded (UTF-8 Thai bytes mis-decoded
-- as Windows-1252 and re-saved), so branches/delivery_rounds rows stored
-- garbled text instead of the intended 'สาขาหลัก' / 'เช้า เที่ยง เย็น'.
-- This script repairs PRODUCTION rows in place. Idempotent — safe to re-run.
-- Detection rule: value contains non-ASCII Latin-1 chars (mojibake) and
-- contains NO real Thai codepoints (U+0E00–U+0E7F) → treat as garbled.
-- ============================================

BEGIN;

-- SECTION 1: branches — fix garbled branch names
UPDATE public.branches
SET name = 'BMB Central (สาขาหลัก)'
WHERE tenant_id = 'tenant-bmb-001'
  AND name ~ '[^\x00-\x7F]'
  AND name !~ '[\u0E00-\u0E7F]';

-- SECTION 2: delivery_rounds — fix รอบเช้า/เที่ยง/เย็น for ALL seeded dates
UPDATE public.delivery_rounds
SET display_name = 'เช้า (06:00-09:00)'
WHERE round_key = 'morning'
  AND display_name ~ '[^\x00-\x7F]'
  AND display_name !~ '[\u0E00-\u0E7F]';

UPDATE public.delivery_rounds
SET display_name = 'เที่ยง (11:00-14:00)'
WHERE round_key = 'midday'
  AND display_name ~ '[^\x00-\x7F]'
  AND display_name !~ '[\u0E00-\u0E7F]';

UPDATE public.delivery_rounds
SET display_name = 'เย็น (17:00-20:00)'
WHERE round_key = 'evening'
  AND display_name ~ '[^\x00-\x7F]'
  AND display_name !~ '[\u0E00-\u0E7F]';

-- SECTION 3: delivery_zones — fix garbled zone names by distance tier
UPDATE public.delivery_zones
SET name = 'โซนใกล้ครัว ศรีโลม (0-3 กม.)'
WHERE max_distance_km <= 3.00
  AND name ~ '[^\x00-\x7F]'
  AND name !~ '[\u0E00-\u0E7F]';

UPDATE public.delivery_zones
SET name = 'โซนปทุมวัน / ราชปรารภ (3-6 กม.)'
WHERE max_distance_km > 3.00 AND max_distance_km <= 6.00
  AND name ~ '[^\x00-\x7F]'
  AND name !~ '[\u0E00-\u0E7F]';

UPDATE public.delivery_zones
SET name = 'โซนทองหล่อ / เอกมัย (6-10 กม.)'
WHERE max_distance_km > 6.00
  AND name ~ '[^\x00-\x7F]'
  AND name !~ '[\u0E00-\u0E7F]';

-- SECTION 4: Verification — count remaining garbled rows (must be 0)
DO $$ DECLARE
  v_bad_branches int; v_bad_rounds int; v_bad_zones int;
BEGIN
  SELECT count(*) INTO v_bad_branches FROM public.branches
    WHERE name ~ '[^\x00-\x7F]' AND name !~ '[\u0E00-\u0E7F]';
  SELECT count(*) INTO v_bad_rounds FROM public.delivery_rounds
    WHERE display_name ~ '[^\x00-\x7F]' AND display_name !~ '[\u0E00-\u0E7F]';
  SELECT count(*) INTO v_bad_zones FROM public.delivery_zones
    WHERE name ~ '[^\x00-\x7F]' AND name !~ '[\u0E00-\u0E7F]';
  RAISE NOTICE 'Encoding repair done — remaining garbled: branches=%, rounds=%, zones=%', v_bad_branches, v_bad_rounds, v_bad_zones;
  IF v_bad_branches + v_bad_rounds + v_bad_zones > 0 THEN
    RAISE EXCEPTION 'ERR_ENCODING_REPAIR_INCOMPLETE';
  END IF;
END $$;

COMMIT;