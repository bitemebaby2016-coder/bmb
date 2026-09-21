# PWA-100-GATE — Evidence Pack (Bite Me Baby, DOMAIN A)

> Collected 2026-09-21 by reconciliation audit: tests, build, lint, live DB REST probes.
> Checklist and criteria: `BMB_100_PERCENT_CLOSURE_BOOK.md` -> "PWA-100-GATE criteria".

---

## 1. Recovery Commands (re-run)

```bash
npm test                          # unit 154/154
npm run build                     # tsc strict + vite + PWA (dist/sw.js)
npm run lint                      # eslint — 0 errors
node e2e/sqlContracts.cjs --include-new   # live DB REST (after 020 push -> 29/29)
```

---

## 2. Automated Checks (measured 2026-09-21)

| Check | Result | Evidence file |
|-------|--------|---------------|
| Unit tests | **154 PASS** | `npm test` (incl. `adminUi.test.ts` 11 new) |
| Build (tsc strict + vite) | PASS | `dist/index.html`, `dist/sw.js`, precache 80 entries |
| Lint | 0 errors | `npm run lint` |
| SQL contracts REST | 28/29 | `e2e/sql-contract-result.json` — 1 pending = Bite Drive (migration 020) |
| CI workflow | present | `.github/workflows/ci.yml` (push/PR -> test+lint+build) |

---

## 3. Live DB Probing (REST, 2026-09-21) — migrations

| Migration | RPC/table probe | Result |
|:--|:--|:--|
| 017 | create_pre_order_with_items / cancel_pre_order / quote_pre_order | ERR control PASS (deployed) |
| 018 | append_audit_log | {"ok":true} PASS |
| 019 | deduct/restore_inventory, create_production_batch, kitchen_queue, get_inventory_requirements | ERR control PASS (deployed) |
| 020 | compute_delivery_fee_rpc, driver_login, assign_driver, my_deliveries | **PGRST202 — owner: db push (020)** |
| 021 | create_notification, record_system_error, get_ai_memory, upsert_mascot_override | ERR control PASS (deployed) |
| 022 | customer_intelligence, submit_content_for_approval, review_content, is_content_approved | PASS (deployed) |

---

## 4. Feature Status DOMAIN A (evidence -> Closure Book)

| Cluster | Status |
|---------|--------|
| Money+Order (017/018) | VERIFIED — RPC live + audit + tests |
| Kitchen/Inventory (019) | VERIFIED — deploy, owner SQL suite in e2e |
| Bite Drive (020) | CODE DONE — live awaits `supabase db push` (only remaining item) |
| PWA+Admin+AI (021) | VERIFIED — notif/errors/memory/mascot + ADMIN UI |
| Phase 5 AI hardening (022) | VERIFIED — injection suite + server memory merge |
| Phase 6 Intelligence (022) | VERIFIED — customer_intelligence + client service |
| Phase 7 Growth (022 + UI) | VERIFIED — content approval workflow + /admin/content-approvals + banner gate |
| Phase 6 UI/admin closure | LIVE — category headings, image cancel/URL, AdminNav, role header |

---

## 5. Owner Tasks to Close GATE

1. `supabase db push` (migration 020) and repeat `--include-new` -> 29/29
2. Supabase SQL Editor: `e2e/contracts_020_bite_drive.sql` -> PASS (transaction rollback)
3. Lighthouse (production mobile) -> record score in this file (§6)
4. REAL-WORLD PILOT plan (2-4 weeks) -> evidence in this pack

---

## 6. Lighthouse (placeholder for owner)

```
TBD — owner: run lighthouse on https://bitemebaby-5f7.pages.dev
Target: Performance >= 90 (current cache/vendor-split, index ~114-118kB)
```

---

**End of evidence pack — update alongside CURRENT_STATE / Closure Book (overwrite).**
