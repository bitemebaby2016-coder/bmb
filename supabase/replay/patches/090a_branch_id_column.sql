-- REPLAY PATCH (ISOLATED LOCAL ONLY): breaks the circular dependency
-- 081_branches_table.sql (SQL function references profiles.branch_id)
-- <-> 090_profiles_branch_id.sql (FK requires branches table).
-- Adds the column only; the real 090 later adds the FK (matches production).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id TEXT;
