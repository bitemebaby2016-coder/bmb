-- ============================================
-- Bite Me Baby — Migration 058: RE-D1 security closure (preorder_votes)
--
-- AUDIT FINDING (CAT-03A audit, 2026-09-29): policy preorder_votes_anon
-- (INSERT TO anon,authenticated, qual=NULL) allows unlimited anonymous
-- direct INSERT — spam/abuse exposure, BLOCKER for Open-Shop.
--
-- Frontend caller audit (2026-09-28): ZERO code paths insert into
-- preorder_votes (only a type definition in src/types/index.ts).
-- Per Owner decision RE-D1 = CLOSE ANON DIRECT INSERT BEFORE OPEN-SHOP:
-- drop the anon policy. Regular authenticated users also lose INSERT
-- (no policy grants it) — feature safely unavailable until a future
-- server-authoritative RPC contract with anti-abuse boundary.
-- Admin ALL policy (is_admin()) remains — admin retains full access.
-- DATA-SAFE: policy-only change; existing rows untouched (count verified).
-- ============================================

DROP POLICY IF EXISTS preorder_votes_anon ON public.preorder_votes;
