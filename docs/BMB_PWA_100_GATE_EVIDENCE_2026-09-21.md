# PWA-100-GATE — Evidence Pack (Bite Me Baby · DOMAIN A)

> Собран 2026-09-21 по факту исполнения: тесты, build, lint, REST-пробы live DB, PHASE 6 UI/admin, PHASE 7 UI.
> Checklist и критерии: `BMB_100_PERCENT_CLOSURE_BOOK.md` → «PWA-100-GATE — критерии».

---

## 1. Команды восстановления (re-run)

```bash
npm test                        # unit 163/163
npm run build                   # tsc strict + vite + PWA (dist/sw.js)
npm run lint                    # eslint — 0 errors
node e2e/sqlContracts.cjs --include-new   # REST-пробы live DB (после push 020 → 29/29)
```

## 2. Автоматическая проверка (результаты 2026-09-21)

| Проверка | Результат | Evidence file |
|----------|-----------|---------------|
| Unit tests | **163/163 PASS** | `npm test` (в т.ч. `src/__tests__/adminUi.test.ts` 11 новых) |
| Build (tsc strict + vite) | PASS | `dist/index.html`, `dist/sw.js`, precache 80 entries |
| Lint | 0 errors | `npm run lint` |
| SQL contracts REST | 25/29 | `e2e/sql-contract-result.json` — 4 pending = Bite Drive (migration 020) |
| CI workflow | present | `.github/workflows/ci.yml` (push/PR → test+lint+build) |

## 3. Live DB probing (REST, 2026-09-21) — миграции

| Migration | RPC/table probe | Result |
|:--|:--|:--|
| 017 | create_pre_order_with_items / cancel_pre_order / quote_pre_order | ERR control ✓ (deployed) |
| 018 | append_audit_log | `{"ok":true}` ✓ |
| 019 | deduct/restore_inventory, create_production_batch, kitchen_queue, get_inventory_requirements | ERR control ✓ (deployed) |
| 020 | compute_delivery_fee_rpc, driver_login, assign_driver, my_deliveries | **PGRST202 — владелец: db push (020)** |
| 021 | create_notification, record_system_error, get_ai_memory, upsert_mascot_override | ERR control ✓ (deployed) |
| 022 | customer_intelligence, submit_content_for_approval, review_content, is_content_approved | ✓ (deployed) |

## 4. Feature status DOMAIN A (evidence → Closure Book)

| Кластера | Статус |
|---------|--------|
| Money+Order (017/018) | VERIFIED — RPC live + audit + tests |
| Kitchen/Inventory (019) | VERIFIED — deploy, legacy owner SQL suite в e2e |
| Bite Drive (020) | CODE DONE — live ждёт `supabase db push` (един.resting item) |
| PWA+Admin+AI (021) | VERIFIED — notif/errors/memory/mascot + ADMIN UI |
| PHASE 5 AI hardening (022) | VERIFIED — injection suite + server memory merge |
| PHASE 6 Intelligence (022) | VERIFIED — customer_intelligence + client service |
| PHASE 7 Growth (022 + UI) | VERIFIED — content approval workflow + /admin/content-approvals + banner gate |
| PHASE 6 UI/admin closure | LIVE — category headings, image cancel/URL, AdminNav, role header |

## 5. Что требует owner (manual), чтобы закрыть GATE

1. `supabase db push` (миграция 020) и повторный `--include-new` → 29/29
2. Supabase SQL Editor: `e2e/contracts_020_bite_drive.sql` → PASS (transaction rollback)
3. Lighthouse (production mobile) → внести score в этот файл (п.6)
4. REAL-WORLD PILOT план (2-4 недели) → evidence в этот pack

## 6. Lighthouse (место для owner замера)

```
TBD — owner: chrome lighthouse on https://bitemebaby-5f7.pages.dev
Target: Performance ≥ 90 (сейчас кэш/сплит vendor, index ~114-118kB)
```

---

**Конец evidence pack · обновлять вместе с CURRENT_STATE/Closure Book (overwrite).**
