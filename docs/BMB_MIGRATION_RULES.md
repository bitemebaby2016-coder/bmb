# BMB Migration Rules (Permanent) — Recovery 2026-11-26

These rules are permanent. They exist because Production drifted (schema 218 vs ledger 210, duplicate versions 180/183/203/204) and required a full Recovery.

## The 8 Permanent Rules
1. **Never create a duplicate migration version.** One version number = one file. Renumber (do not duplicate) if a number is taken.
2. **Never apply SQL outside the Migration Workflow without recording the Ledger correctly.** No ad-hoc `r61Apply183.cjs`-style scripts that write schema without a matching `schema_migrations` row.
3. **Never let Production Schema diverge from the Migration Ledger.** After any apply, `supabase migration list --linked` must match the files.
4. **Every migration must pass Fresh Replay and CI** (`e2e/ci/w2_fresh_replay_full.sh`, 001→latest, no skip) before it is considered done.
5. **A migration already applied must not be edited in place** without a Reconciliation plan (forward migration + ledger repair).
6. **Every deploy must verify Production Ledger and Schema first** (read-only `migration list` + schema check).
7. **Never accumulate Migration Drift** into a large Recovery. Reconcile immediately when drift is detected.
8. **Report real status, not numbers assumed from docs.** The ledger max (from `migration list`) is the source of truth, not a number in a handoff/status doc.

## Migration Deployment Policy (Production-first)
- Apply via `supabase db push` using the **postgres role** (DB password entered locally by Owner; never in chat, never committed).
- The access-token login role **cannot** write `supabase_migrations` (owner-only, no grants) → do not rely on it for ledger writes.
- One migration at a time; verify ledger after each; stop on any error/drift.
- Backup (PITR or verified `pg_dump`) is a hard gate before apply.
- No test data / write-path E2E on Production without separate Owner approval.

## Canonical History (after Recovery 2026-11-26)
- Versions 001–228 unique; the 4 former duplicates renumbered to **229–232**:
  - 229 = real_position_shared_3_sides (was 180 dup)
  - 230 = promo_banner_mascot (was 183 dup)
  - 231 = user_post_context (was 203 dup; made idempotent)
  - 232 = sync_approval_to_marketing_post (was 204 dup)
- Recorded primaries kept at 180=cart_sessions_reminder, 183=order_message_notifications, 203=ai_grounding, 204=order_memory.
- Fresh Replay (001→232) = Production parity (both members of each former pair applied).

## Recovery Procedure (summary; full runbook in RECOVERY_PACKAGE_2026-11-26.md)
1. Backup. 2. Archive/renumber duplicates (done in repo). 3. `migration repair --status applied 211..218` (ledger-only). 4. `db push` 219–228 (postgres role). 5. Verify ledger + read-only smoke.