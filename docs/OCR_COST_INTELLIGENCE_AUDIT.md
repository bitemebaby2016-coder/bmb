# OCR Recovery & Cost Intelligence — Audit + Completion (2026-11-26)

Project `ivkdfognyiwjcmrhcnwz` · Baseline HEAD `48398ae` · Production-First (no staging).
Scope: forensic audit of OCR, then close the gap in-repo (no prod write, no real AI spend).

## 1. Existing OCR Components (forensic)
- **No OCR existed.** No `ocr`/`receipt`/`invoice`/`document` migration, service, or upload UI.
- AI layer reused: `supabase/functions/ai-proxy/index.ts` (OpenRouter gateway, server-side key),
  `supabase/functions/_shared/aiPolicy.ts` (task→model policy), `_shared/aiStructuredOutput.ts`
  (JSON extract/validate), `src/lib/aiModels.ts`/`aiService.ts`/`aiVoice.ts`.
- Policy was **text-only**: Primary `qwen/qwen3.7-flash`, Fallback `xiaomi/mimo-v2.6-flash`; **no vision task**.
- Purchase side existed: `bmbAdminApi_purchaseOrders/goodsReceipts/suppliers/supplierProducts/purchaseAnalytics`,
  `PurchaseDashboardPage`, `PurchaseOrderPage`, `GoodsReceivingPage`, `SupplierPage`, `SupplierProductMappingPage`.
- Price history: `purchase_price_history` (221, append-only) + `get_purchase_price_history` (227) + PO dashboard (228).

## 2. Implemented vs Missing
Implemented this session (repo):
- Migration **233_ocr_documents**: table + RLS (admin/inventory/finance write, staff read, org/branch scope) +
  RPCs `ocr_create_document` / `ocr_list_documents` / `ocr_get_document` / `ocr_approve_document` / `ocr_reject_document`
  + audit + duplicate index.
- AI policy: new **`ocr_extract`** task — **GLM 5.3 Flash primary / Qwen fallback**, bounded (2000 tokens, 60s).
- ai-proxy: **vision branch** (multimodal `image_url`, `response_format json_object`, reasoning off, temp 0, one fallback).
- Client: `src/lib/ocr/{types,validate,match,preprocess,import}.ts`, `ocrService.ts`, `bmbAdminApi_ocr.ts`.
- Admin UI: `OcrDocumentsPage` (upload→OCR→review→match→validate→approve/reject) + nav + route `/admin/ocr`.
- Import: CSV (native) + XLSX (zip+xml, no deps) + manual entry.
- Tests: `src/__tests__/ocr.test.ts` (13).
Missing / deferred: Makro Official API/Partner feed (needs credentials — not in repo); production deploy of 233.

## 3. Reused vs New
Reused: ai-proxy, aiPolicy, aiStructuredOutput, purchase APIs, price history, RLS helpers (`has_org_row_scope`, role predicates), `append_audit_log`, `update_updated_at_column`.
New: ocr_documents, ocr_extract task, vision branch, ocr lib, OCR page. No duplicate ingredient/recipe/inventory system.

## 4. Database / Migration Requirements
- **233_ocr_documents** (pending production apply). Idempotent; depends on 214/217/221/223/146.
- Approval writes `purchase_price_history` (`price_type='approved'`) + `supplier_products.last_approved_price` only.

## 5. AI Provider / Fallback
OpenRouter Vision; `ocr_extract` primary `z-ai/glm-5.3-flash`, fallback `qwen/qwen3.7-flash`; structured JSON; reasoning off; image ~1,600 px (OCR_MAX_DIM). No hardcoded key (server-side only).

## 6. Accuracy / Approval Workflow
Per-field confidence; null on unclear (never guessed); programmatic subtotal+tax=total and qty×price=line_total; needsReview flag; duplicate detection (sha256 + unique index); original image + raw OCR + model + prompt_version stored; approval required before any price-history write; no auto PO/GRN/WAVG.

## 7. Supplier / Ingredient Integration
`matchSupplier`/`matchIngredient` (normalized fuzzy, suggest-only). On approve, lines matched to `supplier_products` + `inventory` write price history. Reuses existing supplier/inventory — no new master data.

## 8. UI / UX
`/admin/ocr` under จัดซื้อ group. Original image beside OCR fields; per-line confidence; supplier/ingredient selects; validation errors/warnings; approve/reject. CSV/Excel + manual entry feed the same review/approval path.

## 9. Tests and Evidence
- `ocr.test.ts` 13/13 pass (validate, match, CSV, policy).
- Full suite: **259 files / 3027 tests pass** (+1 file/+13).
- Gates: tsc 0, lint 0, build 0.
- Fresh Replay (Docker, 001→233): **REPLAY_ALL_GREEN migrations=233** + all contract suites (incl. 190 BKK date gate).
- Mock used only in unit tests — not production evidence.

## 10. Remaining Production Actions
- Deploy migration 233 (Owner, after backup gate).
- Set `OPENROUTER_API_KEY` (already server-side) — no client key.
- Optional: Makro Official API/Partner feed (needs Owner credentials/authorization).
- Live Owner test: upload receipt → review → approve → verify price history; CSV/Excel import; manual entry; tenant/RLS isolation.
- **Cost Intelligence Phase 2 NOT declared complete** until 233 is deployed and OCR/CSV/Excel/Manual are verified end-to-end on production.