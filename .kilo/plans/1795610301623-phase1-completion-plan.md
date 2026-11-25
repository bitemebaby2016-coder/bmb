# Phase 1 Completion Plan — BMB Smart Ingredient & Cost Management

## Executive Summary

Phase 1 is **not complete**. Existing UI (`InventoryPage.tsx`, `AdminRecipes.tsx`) has significant gaps. Supplier Master and Supplier Product Mapping APIs exist but **have no UI**. This plan addresses all gaps to achieve true "Definition of Done" per Owner directive.

---

## 1. Current State Audit (Feature Matrix)

| Feature | Status | Category | Notes |
|---------|--------|----------|-------|
| **Ingredient List** | ✅ Exists | Existing & Complete | Basic table with stock, category, unit, price |
| **Ingredient Add** | ✅ Exists | Existing & Complete | Creates in Supabase |
| **Ingredient Delete** | ✅ Exists | Existing & Complete | Hard delete (should be soft) |
| **Ingredient Edit** | ❌ Missing | Missing — Must Build | No edit form |
| **Ingredient Deactivate** | ❌ Missing | Missing — Must Build | No soft delete / status toggle |
| **Purchase Unit / Use Unit** | ❌ Missing | Missing — Must Build | Fields in DB/API, not in UI |
| **Conversion Factor / Package Size** | ❌ Missing | Missing — Must Build | Fields in DB/API, not in UI |
| **Yield / Waste (prep_yield_factor, prep_waste_pct)** | ❌ Missing | Missing — Must Build | Fields in DB/API, not in UI |
| **Supplier Association (supplier_id FK)** | ❌ Missing | Missing — Must Build | API supports, UI doesn't |
| **Cost Fields (wavg_cost, last_purchase_price, last_approved_price)** | ❌ Missing | Missing — Must Build | Fields in DB/API, not in UI |
| **Search / Filter / Sort** | ❌ Missing | Missing — Must Build | Only text search on product name in recipes |
| **Validation / Error Handling** | ⚠️ Partial | Existing but Incomplete | Basic toast errors, no field validation |
| **Supplier Master UI** | ❌ Missing | Missing — Must Build | API complete, zero UI |
| **Supplier Product Mapping UI** | ❌ Missing | Missing — Must Build | API complete, zero UI |
| **Recipe/BOM List** | ✅ Exists | Existing & Complete | Basic table |
| **Recipe Add** | ✅ Exists | Existing & Complete | Creates in Supabase |
| **Recipe Delete** | ✅ Exists | Existing & Complete | Deletes from Supabase |
| **Recipe Edit** | ❌ Missing | Missing — Must Build | No edit form |
| **Batch Yield / Waste** | ❌ Missing | Missing — Must Build | Fields in DB/API, not in UI |
| **Recipe Cost Breakdown** | ❌ Missing | Missing — Must Build | `cost_per_unit` in DB, not computed/shown |
| **Navigation: PurchaseHub** | ❌ Missing | Missing — Must Build | Owner directive: Supplier/Mapping in PurchaseHub |

---

## 2. Phase 1 Deliverables — Implementation Tasks

### A. Ingredient Master — Enhance `InventoryPage.tsx`

**File:** `src/pages/admin/InventoryPage.tsx`  
**API:** `src/lib/bmbAdminApi_inventory.ts` (already supports all fields)

| Task | Description | Acceptance |
|------|-------------|------------|
| A1 | Add **Edit Mode** — click row → populate form → save updates | PUT to `inventory` table, refresh list |
| A2 | Add **Deactivate** (soft delete) — toggle `status` or `is_active` | Use existing `deleteInventory` but set `is_active=false` or add `deactivateInventory` |
| A3 | Extend **Add/Edit Form** with Phase 1 fields:<br>• `purchase_unit` (text)<br>• `use_unit` (text)<br>• `conversion_factor` (number, default 1)<br>• `package_size` (number)<br>• `gross_weight` / `net_weight` (number)<br>• `prep_yield_factor` (number, default 1)<br>• `prep_waste_pct` (number, default 0)<br>• `supplier_id` (select from `getSuppliers()`)<br>• `wavg_cost`, `last_purchase_price`, `last_approved_price` (readonly display) | All fields save to Supabase |
| A4 | Add **Search/Filter/Sort**:<br>• Text search (name, category)<br>• Filter by category, status<br>• Sort by name, stock, price, updated_at | Client-side on loaded data |
| A5 | Display **Supplier Info** in table: supplier name, contact | Join via `supplier_id` |
| A6 | Show **Cost per Use Unit** computed: `unit_price / conversion_factor` (if purchase_unit ≠ use_unit) | Display in table & detail |
| A7 | Add **Validation**: required fields, numeric ranges, positive conversion | Thai error messages via Toast |
| A8 | Add **Loading/Empty/Error States** per R21d (already have LoadErrorBanner) | Consistent with AdminRecipes |

---

### B. Supplier Master — Create `SupplierPage.tsx`

**New File:** `src/pages/admin/SupplierPage.tsx`  
**API:** `src/lib/bmbAdminApi_suppliers.ts` (complete CRUD)

| Task | Description | Acceptance |
|------|-------------|------------|
| B1 | **Supplier List** page with table: name, code, contact, phone, email, payment_terms, lead_time, status | Fetch via `getAllSuppliers(true)` |
| B2 | **Add Supplier** form: name, code, contact_name, phone, email, address, payment_terms_days, lead_time_days, is_active | POST via `createSupplier` |
| B3 | **Edit Supplier** — click row → form → save | PUT via `updateSupplier` |
| B4 | **Deactivate Supplier** — soft delete (`is_active=false`) | `deleteSupplier` (already soft) |
| B5 | **Supplier Detail View** — modal or expand row showing:<br>• Contact info<br>• Address<br>• Purchase terms<br>• **Ingredients supplied** (via `getIngredientsForSupplier`)<br>• **Price history** (from `supplier_products` price states) | Click row → detail panel |
| B6 | Search/Filter/Sort: by name, code, status, active/inactive | Client-side |
| B7 | Validation + Thai error messages | Required fields, email format, positive numbers |

---

### C. Supplier Product Mapping — Create `SupplierProductMappingPage.tsx`

**New File:** `src/pages/admin/SupplierProductMappingPage.tsx`  
**API:** `src/lib/bmbAdminApi_supplierProducts.ts` (complete CRUD + price states)

| Task | Description | Acceptance |
|------|-------------|------------|
| C1 | **Mapping List** — table with: Supplier, Ingredient, Supplier SKU, Supplier Product Name, Purchase Unit, Use Unit, Conversion Factor, Package Size, 3 Price States (committed/realized/approved), Price per Use Unit, Preferred, Active | Fetch via `getSupplierProducts()` with joins |
| C2 | **Add Mapping** form:<br>• Supplier (select)<br>• Ingredient (select from inventory)<br>• Supplier SKU / Barcode<br>• Supplier Product Name<br>• Brand / Package Size<br>• Purchase Unit / Qty<br>• Use Unit (auto from ingredient)<br>• Conversion Factor<br>• Prices (committed/realized/approved)<br>• Min Order Qty, Lead Time<br>• Preferred flag | POST via `createSupplierProduct` |
| C3 | **Edit Mapping** — inline or modal | PUT via `updateSupplierProduct` |
| C4 | **Price per Use Unit** computed: `price / conversion_factor` for each price state | Show all 3 computed columns |
| C5 | **Price Comparison** — for same ingredient, show all suppliers side-by-side at **Use Unit** | Group by ingredient, compute comparable price |
| C6 | **Multiple Suppliers per Ingredient** — support & display | Filter by ingredient_id |
| C7 | **Deactivate Mapping** (soft delete) | `deleteSupplierProduct` |
| C8 | Search/Filter: by supplier, ingredient, active status | Client-side |

---

### D. Recipe / BOM — Enhance `AdminRecipes.tsx`

**File:** `src/pages/admin/AdminRecipes.tsx`  
**API:** `src/lib/bmbAdminApi_recipes.ts` (supports batch_yield_factor, batch_waste_pct, cost_per_unit)

| Task | Description | Acceptance |
|------|-------------|------------|
| D1 | **Edit Recipe** — click row → populate form → update quantity, batch yield, waste | PUT via `upsertRecipe` (extend to accept new fields) |
| D2 | Add **Batch Yield Factor** & **Batch Waste %** fields to form | Save to `recipes` table |
| D3 | **Cost Breakdown** per recipe row:<br>• Ingredient cost per use unit (from inventory `wavg_cost` or `last_approved_price`)<br>• Qty per unit × cost = ingredient cost<br>• Sum = recipe cost per unit<br>• Apply batch yield: `cost / batch_yield_factor` | Compute client-side, display in table |
| D4 | Show **Preparation Yield** from ingredient (`prep_yield_factor`, `prep_waste_pct`) in recipe row | Join ingredient data |
| D5 | **Validation**: qty > 0, yield 0-1, waste 0-100 | Thai errors |
| D6 | **Missing Recipe Indicator** — already exists (products without recipes) | Keep & enhance |

**API Change Required:** Extend `upsertRecipe` to accept `batch_yield_factor`, `batch_waste_pct`, `cost_per_unit`.

---

### E. Navigation & UX — Hub Integration

**Files:** `src/components/admin/AdminHubs.tsx`, `src/lib/adminUi.ts`, `src/App.tsx`

| Task | Description | Acceptance |
|------|-------------|------------|
| E1 | Create **PurchaseHub** in `AdminHubs.tsx` with tabs:<br>• `suppliers` → `SupplierPage`<br>• `mappings` → `SupplierProductMappingPage` | New hub component |
| E2 | Add routes in `App.tsx`:<br>• `/admin/purchase` → `PurchaseHub`<br>• `/admin/suppliers` → redirect to `/admin/purchase?tab=suppliers`<br>• `/admin/supplier-products` → redirect to `/admin/purchase?tab=mappings` | Lazy-loaded routes |
| E3 | Update `ADMIN_NAV_GROUPS` in `adminUi.ts`: add **Purchase** group or add to **Settings** group per Owner "reuse hub first" | Nav items appear in sidebar |
| E4 | Ensure **Recipe** stays in **MenuHub** (already at `/admin/recipes`) | No change |
| E5 | Ensure **Inventory** stays in **SettingsHub** (already at `/admin/inventory`) | No change |
| E6 | Role-based nav: `inventory` role sees PurchaseHub, `kitchen` role sees Recipes | `navGroupsForRole` handles |

---

## 3. Database / API Changes Required

| Component | Change | File |
|-----------|--------|------|
| `upsertRecipe` | Add `batch_yield_factor`, `batch_waste_pct`, `cost_per_unit` params | `bmbAdminApi_recipes.ts` |
| `recipes` table | Ensure columns exist: `batch_yield_factor`, `batch_waste_pct`, `cost_per_unit`, `last_cost_calculated_at` | Migration (verify) |
| `inventory` table | Verify all Phase 1 columns exist (already in API) | Migration (verify) |
| `suppliers` table | Verify all columns exist (already in API) | Migration (verify) |
| `supplier_products` table | Verify all columns exist (already in API) | Migration (verify) |

> **Note:** Do NOT create new migrations unless columns are missing. Verify via Supabase dashboard or RPC first.

---

## 4. Testing Strategy (E2E + Unit)

### Test Matrix per Owner Directive

| Test ID | Scenario | Feature | Type |
|---------|----------|---------|------|
| T01 | Open Ingredient List, search "ไก่" | A. Ingredient | E2E |
| T02 | Add Ingredient "เนื้อวัว" with purchase_unit="กก.", use_unit="กรัม", conversion=1000 | A. Ingredient | E2E |
| T03 | Edit Ingredient, change min_stock, verify persist after reload | A. Ingredient | E2E |
| T04 | Set purchase_unit="กล่อง", use_unit="กก.", conversion=10, verify price/kg calc | A. Ingredient | Unit + E2E |
| T05 | Verify price per use unit = unit_price / conversion_factor | A. Ingredient | Unit |
| T06 | Create Supplier "บจก. ไก่สด" with contact, terms | B. Supplier | E2E |
| T07 | Edit Supplier, change lead_time, verify | B. Supplier | E2E |
| T08 | Map Supplier Product: SKU="CHK-001", ingredient="เนื้อไก่", price=120/กล่อง, conversion=10 | C. Mapping | E2E |
| T09 | Add 2nd supplier for same ingredient, different price | C. Mapping | E2E |
| T10 | Verify price comparison shows both at ฿/กก. | C. Mapping | E2E |
| T11 | Open existing Recipe, edit quantity, save | D. Recipe | E2E |
| T12 | Add ingredient to Recipe, verify cost breakdown | D. Recipe | E2E |
| T13 | Set batch_yield_factor=0.9, verify cost adjusts | D. Recipe | Unit + E2E |
| T14 | Reload page, verify all data persists | All | E2E |
| T15 | Submit empty required field → Thai error toast | All | E2E |
| T16 | Login as `inventory` role → see PurchaseHub, not Kitchen | E. Nav | E2E |
| T17 | Mobile responsive: drawer works, tables scroll | All | E2E |
| T18 | Regression: Order stock deduction still works | Regression | E2E |

### Test Execution
```bash
# Unit tests
npm run test

# E2E tests (Playwright)
npx playwright test --project=chromium

# TypeScript + Lint
npm run build && npm run lint
```

---

## 5. Implementation Order (Dependency Graph)

```
Phase 1.1: Database Verification
  └─ Verify all columns exist in Supabase (no migrations unless missing)

Phase 1.2: Ingredient Master (InventoryPage.tsx)
  ├─ A1 Edit form
  ├─ A2 Deactivate
  ├─ A3 Extended fields
  ├─ A4 Search/Filter/Sort
  ├─ A5 Supplier join display
  ├─ A6 Cost computation
  ├─ A7 Validation
  └─ A8 States

Phase 1.3: Recipe/BOM (AdminRecipes.tsx)
  ├─ D1 Edit form
  ├─ D2 Batch yield/waste fields
  ├─ D3 Cost breakdown computation
  ├─ D4 Prep yield display
  ├─ D5 Validation
  └─ API: extend upsertRecipe

Phase 1.4: Supplier Master (NEW SupplierPage.tsx)
  ├─ B1 List + B2 Add + B3 Edit + B4 Deactivate
  ├─ B5 Detail view with mappings
  ├─ B6 Search/Filter
  └─ B7 Validation

Phase 1.5: Supplier Product Mapping (NEW SupplierProductMappingPage.tsx)
  ├─ C1 List with computed prices
  ├─ C2 Add form (complex: supplier + ingredient selects)
  ├─ C3 Edit
  ├─ C4 Price per use unit computation
  ├─ C5 Price comparison view
  ├─ C6 Multiple suppliers support
  ├─ C7 Deactivate
  └─ C8 Search/Filter

Phase 1.6: Navigation & Hubs
  ├─ E1 PurchaseHub component
  ├─ E2 App.tsx routes
  ├─ E3 adminUi.ts nav groups
  └─ E4-E6 Role verification

Phase 1.7: Testing & Polish
  ├─ Run all unit tests
  ├─ Run E2E test matrix (T01-T18)
  ├─ TypeScript build + lint
  └─ Owner verification checklist
```

---

## 6. Risk Assessment & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Missing DB columns | Blocks API saves | Medium | Verify via `supabase.from('table').select('*').limit(1)` before coding |
| `upsertRecipe` API change breaks existing | Recipe add fails | Low | Extend params with defaults, test existing add flow |
| Supplier dropdown empty in Ingredient form | Can't associate | Low | `getSuppliers()` already returns active suppliers |
| Price comparison math errors | Wrong costing | Medium | Unit test `price / conversion_factor` with edge cases (0, null) |
| Nav group not showing for roles | Permission regression | Low | Test `navGroupsForRole` with each role |
| Duplicate UI patterns | Code bloat | Medium | Extract shared components: `DataTable`, `EntityForm`, `SearchFilter` |

---

## 7. Definition of Done Checklist

- [ ] All 4 feature areas (A-D) have working CRUD with Supabase persistence
- [ ] All forms validate with Thai error messages
- [ ] Search/Filter/Sort works on all list pages
- [ ] Price per Use Unit computes correctly (conversion_factor applied)
- [ ] Supplier Product Mapping shows price comparison at same Use Unit
- [ ] Recipe Cost Breakdown shows ingredient costs + batch yield adjustment
- [ ] PurchaseHub accessible at `/admin/purchase` with 2 tabs
- [ ] Navigation shows PurchaseHub for appropriate roles
- [ ] No duplicate components/APIs/tables created
- [ ] RLS policies allow read/write for admin roles (verify)
- [ ] All 18 E2E test scenarios pass
- [ ] `npm run build` passes (TypeScript strict)
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (Vitest)
- [ ] Owner can open production UI and verify workflow end-to-end

---

## 8. Files to Create / Modify

### New Files
1. `src/pages/admin/SupplierPage.tsx` — Supplier Master UI
2. `src/pages/admin/SupplierProductMappingPage.tsx` — Mapping UI
3. `src/components/admin/PurchaseHub.tsx` — Hub component (or add to AdminHubs.tsx)

### Modified Files
1. `src/pages/admin/InventoryPage.tsx` — Major enhancement (A1-A8)
2. `src/pages/admin/AdminRecipes.tsx` — Enhancement (D1-D6)
3. `src/lib/bmbAdminApi_recipes.ts` — Extend `upsertRecipe` params
4. `src/components/admin/AdminHubs.tsx` — Add `PurchaseHub` export
5. `src/lib/adminUi.ts` — Add PurchaseHub to nav groups
6. `src/App.tsx` — Add lazy routes for PurchaseHub

### Test Files (New)
1. `src/__tests__/inventoryPhase1.test.ts` — Ingredient Master tests
2. `src/__tests__/supplierMaster.test.ts` — Supplier tests
3. `src/__tests__/supplierProductMapping.test.ts` — Mapping tests
4. `src/__tests__/recipeBomPhase1.test.ts` — Recipe tests
5. `src/__tests__/purchaseHubNav.test.ts` — Navigation tests
6. Playwright E2E specs for T01-T18

---

## 9. Open Questions for Owner

1. **Deactivate vs Delete**: Should Ingredient "delete" be soft (status=inactive) or hard? Current `deleteInventory` is hard. Owner directive says "ปิดใช้งาน" (deactivate).

2. **PurchaseHub Location**: Add to **Settings** group (with Inventory) or create new **Purchase** group? Directive says "Supplier / Mapping อยู่ใน PurchaseHub" and "ให้ Reuse Hub เดิมก่อนสร้างใหม่". Since Inventory is in SettingsHub, perhaps PurchaseHub = new tab in SettingsHub?

3. **Price State Display**: Show all 3 prices (committed/realized/approved) in mapping list, or only `last_approved_price` for costing? Owner Decision B4 says 3 states exist.

4. **Cost Calculation Source**: For Recipe cost breakdown, use `wavg_cost` (perpetual) or `last_approved_price` (admin-set)? Owner: "Last Approved Price for costing".

5. **Batch Yield Default**: Default `batch_yield_factor=1.0`, `batch_waste_pct=0`? Yes per API defaults.

---

## 10. Next Steps

1. **Owner reviews this plan** — confirm open questions
2. **Start Phase 1.1** — Verify DB columns via Supabase dashboard
3. **Execute in order** — Phase 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7
4. **Daily sync** — Report completed tasks, blockers, test results
5. **Phase Gate** — Owner verification before Phase 2

---

**Plan Status:** Ready for Owner review. Implementation begins upon approval.