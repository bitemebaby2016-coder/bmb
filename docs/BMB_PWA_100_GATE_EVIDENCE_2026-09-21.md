# PWA-100-GATE — Evidence Pack (Bite Me Baby, DOMAIN A)

> Collected 2026-09-21 by reconciliation audit: tests, build, lint, live DB REST probes.
> Checklist and criteria: `BMB_100_PERCENT_CLOSURE_BOOK.md` -> "PWA-100-GATE criteria".

---

## 1. Recovery Commands (re-run)

```bash
npm test                          # unit 163/163 (needs VITE_SUPABASE_URL/ANON_KEY in env)
npm run build                     # tsc strict + vite + PWA (dist/sw.js)
npm run lint                      # eslint — 0 errors
node e2e/sqlContracts.cjs --include-new   # live DB REST probes -- 29/29 PASSED (2026-09-21)
```

---

## 2. Automated Checks (measured 2026-09-21)

| Check | Result | Evidence file |
|-------|--------|---------------|
| Unit tests | **163 PASS** (21 files) | `npm test` (incl. `adminUi.test.ts` 11 new) |
| Build (tsc strict + vite) | PASS | `dist/index.html`, `dist/sw.js`, precache 80 entries |
| Lint | 0 errors | `npm run lint` |
| SQL contracts REST | **29/29 PASSED** | `e2e/sql-contract-result.json` (2026-09-21T14:27Z re-run) |
| CI workflow | **PASS** | GitHub Actions run #15 head `0e85c37` — Node 24, test+lint+build (runs #3-#14 were red on Node 20: jsdom 30 engines) |

---

## 3. Live DB Probing (REST, 2026-09-21) — migrations

| Migration | RPC/table probe | Result |
|:--|:--|:--|
| 017 | create_pre_order_with_items / cancel_pre_order / quote_pre_order | ERR control PASS (deployed) |
| 018 | append_audit_log | {"ok":true} PASS |
| 019 | deduct/restore_inventory, create_production_batch, kitchen_queue, get_inventory_requirements | ERR control PASS (deployed) |
| 020 | compute_delivery_fee_rpc, driver_login, assign_driver, my_deliveries | ERR control PASS (deployed 2026-09-21 via db push) |
| 021 | create_notification, record_system_error, get_ai_memory, upsert_mascot_override | ERR control PASS (deployed) |
| 022 | customer_intelligence, submit_content_for_approval, review_content, is_content_approved | PASS (deployed) |

---

## 4. Feature Status DOMAIN A (evidence -> Closure Book)

| Cluster | Status |
|---------|--------|
| Money+Order (017/018) | VERIFIED — RPC live + audit + tests |
| Kitchen/Inventory (019) | VERIFIED — deploy, owner SQL suite in e2e |
| Bite Drive (020) | VERIFIED — DB APPLIED 2026-09-21 + REST probes 4/4 (real rider flow -> pilot) |
| PWA+Admin+AI (021) | VERIFIED — notif/errors/memory/mascot + ADMIN UI |
| Phase 5 AI hardening (022) | VERIFIED — injection suite + server memory merge |
| Phase 6 Intelligence (022) | VERIFIED — customer_intelligence + client service |
| Phase 7 Growth (022 + UI) | VERIFIED — content approval workflow + /admin/content-approvals + banner gate |
| Phase 6 UI/admin closure | LIVE — category headings, image cancel/URL, AdminNav, role header |

---

## 5. Owner Tasks to Close GATE

1. ~~`supabase db push` + `--include-new`~~ DONE 2026-09-21 (29/29)
2. ~~Supabase SQL Editor: `e2e/contracts_020_bite_drive.sql`~~ DONE 2026-09-21 (owner ran -> PASS, transaction rolled back)
3. Lighthouse (production mobile) -> record score in this file (§6)
4. REAL-WORLD PILOT plan (2-4 weeks) -> evidence in this pack

---

## 6. Lighthouse (owner measurement log)

- **2026-09-21 (owner, Chrome DevTools mobile — PREVIEW deploy `c04ffb8b.bitemebaby.pages.dev`, 400px viewport):**
  Performance **41** · Accessibility 85 · Best Practices 100 · SEO 61
  Metrics: FCP 2.5s · **LCP 29.3s** · TBT 910ms · SI 18.1s · CLS 0
- **CAVEAT:** วัดบน **PREVIEW deployment** (ไม่ใช่ production domain `bitemebaby-5f7.pages.dev`)
  + หน้าแรกติดสถานะ loading (mascot thinking) — LCP 29.3s น่าจะโดน data-load stall
- **NEXT:** วัดซ้ำบน production domain + สืบสาเหตุ LCP (data fetch / hero image) → Target Performance >= 90
- **2026-09-21 (assistant verification round — attempted 3 paths, all failed, ตามจริง):**
  - `lighthouse` CLI local → **EPERM** จาก chrome-launcher temp cleanup (AV lock บนเครื่องนี้, 3 ครั้งรวม profile/no-space/system-temp)
  - PageSpeed Insights API (Lighthouse บน Google infra) → **429 Too Many Requests** (rate limit ต่อ IP, 2 ครั้ง)
  - → **ยังไม่มี production Lighthouse measurement ใหม่** — gate เปิดอยู่ รอ owner วัด (Chrome DevTools หรือ PSI ตอน rate limit คลาย)

---

**End of evidence pack — update alongside CURRENT_STATE / Closure Book (overwrite).**
