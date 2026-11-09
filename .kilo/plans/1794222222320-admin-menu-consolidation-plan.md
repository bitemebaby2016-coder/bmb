# Admin Menu Consolidation & Settings UX Improvement Plan

## Goal
Consolidate admin menu structure, convert all English labels to 100% Thai, and replace manual `true`/`false` JSON inputs with proper ToggleSwitch components for all boolean settings.

---

## 1. Menu Consolidation (5 groups → 3 groups)

### Current Structure (adminUi.ts:22-76)
```typescript
ADMIN_NAV_GROUPS = [
  { id: 'overview',  label: 'ภาพรวม',         items: [Dashboard] },
  { id: 'orders',    label: 'จัดการออเดอร์...', items: [Orders, POS, Kitchen, Recipes] },
  { id: 'menu',      label: 'เมนูและการโปรโมท', items: [Products, Promotions, Marketing] },
  { id: 'customers', label: 'ลูกค้าและเนื้อหา', items: [Customers, Notifications, Media, Portfolio, Reviews] },
  { id: 'system',    label: 'ระบบและการตั้งค่า', items: [Inventory, Reports, Delivery, AuditLog, Errors, Settings, Tenants, Onboarding, Billing] }
]
```

### Proposed Consolidation (3 groups)
| New Group ID | Label (Thai) | Combined From | Routes |
|---|---|---|---|
| `operations` | **ดำเนินงาน** | overview + orders + menu | Dashboard, Orders, POS, Kitchen, Recipes, Products, Promotions, Marketing |
| `customers` | **ลูกค้าและเนื้อหา** | customers | Customers, Notifications, Media, Portfolio, Reviews |
| `settings` | **ตั้งค่าระบบ** | system | Inventory, Reports, Delivery, Audit Log, Errors, Settings, Tenants, Onboarding, Billing |

**Rationale:**
- "ภาพรวม" (Dashboard) is just the landing page → merge into Operations
- "จัดการออเดอร์" + "เมนู" are daily operational tasks → combine
- "ระบบและการตั้งค่า" is already settings-focused
- Reduces cognitive load: 3 top-level categories vs 5

### Role-based nav (adminUi.ts:108-124) — Update allowlists
| Role | Current Allow | New Allow (operations/customers/settings) |
|---|---|---|
| pos | dashboard, orders, pos, customers, reports | operations, customers, settings(reports) |
| kitchen | dashboard, orders, kitchen, recipes, delivery, products | operations, settings(delivery) |
| inventory | dashboard, inventory, products | operations, settings(inventory) |
| finance | dashboard, reports, orders, pos | operations, settings(reports) |
| marketing | dashboard, marketing, promotions, media, portfolio | operations, customers(media/portfolio) |
| support | dashboard, orders, customers, notifications | operations, customers |
| auditor | all | all |
| developer | all | all |
| owner/admin/staff | all | all |

---

## 2. Full Thai Language Conversion

### Files to Audit & Convert
| File | Current English Labels | Target (Thai) |
|---|---|---|
| `src/lib/adminUi.ts` | "POS หน้าร้าน", "Master Switch", "COD", "Billing", "Wizard", "SEO", "Brand" | "POS หน้าร้าน"→"POS หน้าร้าน" (keep), "Master Switch"→"สวิตช์หลัก", "COD"→"เงินสดปลายทาง", "Billing"→"การเรียกเก็บเงิน", "Wizard"→"วิซาร์ดเปิดร้าน", "SEO"→"SEO/คำค้นหา", "Brand"→"แบรนด์" |
| `src/components/admin/AdminNav.tsx` | "หน้าลูกค้า" (already Thai) | ✅ |
| `src/components/admin/AdminHubs.tsx` | "Storefront" (tab label) | Already "หน้าร้าน" ✅ |
| `src/pages/admin/AdminSettings.tsx` | "Save All Settings", "Form", "JSON", "Master Switch (เปิด/ปิดร้านทั้งระบบ)", "เงินสดปลายทาง (COD)", "โซเชียล & LINE", "SEO / คำโปรยเว็บ", "ค่าส่ง/โซน", "Brand", "Branch (รัศมี + เวลาสาขา)" | "บันทึกทั้งหมด", "ฟอร์ม", "JSON", "สวิตช์หลัก (เปิด/ปิดร้าน)", "เงินสดปลายทาง", "โซเชียลและไลน์", "SEO / คำค้นหา", "ค่าส่ง/โซน", "แบรนด์", "สาขา (รัศมี + เวลาเปิด-ปิด)" |
| `src/pages/admin/StoreFrontSettingsPage.tsx` | "Store Front Settings" (comment) | "ตั้งค่าหน้าร้าน" |
| `src/pages/admin/AdminPrintSettings.tsx` | Check for English | Convert |
| `src/pages/admin/MascotSettingsPage.tsx` | Check for English | Convert |
| `src/pages/admin/AdminTenants.tsx` | Check for English | Convert |
| `src/pages/admin/AdminBrands.tsx` | Check for English | Convert |
| `src/pages/admin/DeliveryManagement.tsx` | Check for English | Convert |
| `src/pages/admin/RouteOptimizationPage.tsx` | Check for English | Convert |
| `src/pages/admin/AdminRounds.tsx` | Check for English | Convert |
| `src/pages/admin/AdminBilling.tsx` | Check for English | Convert |
| `src/pages/admin/AdminOnboarding.tsx` | Check for English | Convert |

**Conversion Rules:**
- Technical terms that are universally understood (POS, SEO, API, URL, JSON) → keep as-is
- All UI labels, button text, tooltips, section headers → Thai
- Comments in code → keep English (developer-facing)

---

## 3. Boolean Settings → ToggleSwitch

### Current State
- `store_master_open` → ✅ ToggleSwitch (AdminSettings.tsx:278-283)
- `cod_enabled` → ✅ ToggleSwitch (AdminSettings.tsx:296-301)
- Generic JSON editor allows typing `true`/`false` for any key → **Problem**

### Target: Typed Forms with ToggleSwitch for ALL boolean settings

| Setting Key | Path | Type | Current UI | Target UI |
|---|---|---|---|---|
| `store_master_open` | root | boolean | ToggleSwitch ✅ | Keep |
| `cod_enabled.enabled` | root | boolean | ToggleSwitch ✅ | Keep |
| `crm_automation.enabled` | root | boolean | JSON editor | **New ToggleSwitch** |
| `promotion_policy.promotions_enabled` | root | boolean | JSON editor | **New ToggleSwitch** |
| `delivery_zones[].is_active` | array | boolean | DeliveryZonesPanel | ToggleSwitch in panel |

### Implementation Approach

**Option A: Extend AdminSettings.tsx with typed boolean fields** (Recommended)
- Add dedicated ToggleSwitch sections for each boolean setting
- Keep generic JSON editor only for non-boolean complex objects
- Move boolean keys to `TYPED_FORM_KEYS` set so generic editor skips them

**Option B: Create reusable `BooleanSettingsPanel` component**
- Auto-discovers boolean keys from loaded settings
- Renders ToggleSwitch for each
- More flexible but more complex

**Recommendation: Option A** — explicit, testable, follows existing pattern (OrderPolicyPanel, social links, SEO copy, status copy)

### Code Changes for Option A

1. **Update `TYPED_FORM_KEYS`** (AdminSettings.tsx:23)
   ```typescript
   const TYPED_FORM_KEYS = new Set<string>([
     SOCIAL_LINKS_SETTING_KEY, 
     SEO_SETTINGS_KEY, 
     STORE_STATUS_COPY_KEY, 
     'order_policy', 
     'store_master_open', 
     'cod_enabled',
     'crm_automation',      // ADD
     'promotion_policy',    // ADD
   ])
   ```

2. **Add typed boolean sections** in "Final Config Closure" area (after line 303)
   ```tsx
   {/* CRM Automation Kill Switch */}
   <div className="card" data-testid="crm-automation-switch">
     <div className="flex items-center justify-between gap-3">
       <div className="text-sm">
         <div className="font-semibold">CRM Automation</div>
         <div className="text-xs text-brand-muted">
           ปิด = หยุดการส่งอัตโนมัติ (Win-back/Birthday/Segment) ทันที · เปิด = ทำงานตามตาราง · ค่าเริ่มต้น = เปิด
         </div>
       </div>
       <ToggleSwitch
         checked={settings.crm_automation?.enabled !== false}
         onChange={(v) => handleToggleBoolean('crm_automation', 'enabled', v)}
         label={settings.crm_automation?.enabled !== false ? 'เปิด' : 'ปิด'}
         testId="crm-automation-toggle"
       />
     </div>
   </div>
   
   {/* Promotions Kill Switch */}
   <div className="card" data-testid="promotions-switch">
     <div className="flex items-center justify-between gap-3">
       <div className="text-sm">
         <div className="font-semibold">โปรโมชัน (Kill Switch)</div>
         <div className="text-xs text-brand-muted">
           ปิด = ซ่อนโปรโมชันทั้งหมดจากหน้าร้าน/เมนู · เปิด = แสดงตามกฎปกติ · ค่าเริ่มต้น = เปิด
         </div>
       </div>
       <ToggleSwitch
         checked={settings.promotion_policy?.promotions_enabled !== false}
         onChange={(v) => handleToggleBoolean('promotion_policy', 'promotions_enabled', v)}
         label={settings.promotion_policy?.promotions_enabled !== false ? 'เปิด' : 'ปิด'}
         testId="promotions-toggle"
       />
     </div>
   </div>
   ```

3. **Add `handleToggleBoolean` function**
   ```typescript
   async function handleToggleBoolean(key: string, field: string, value: boolean) {
     const nextValue = { ...(settings[key] || {}), [field]: value }
     setSettings({ ...settings, [key]: nextValue })
     const ok = await setBusinessSetting(key, nextValue)
     showToast(ok ? `Updated ${key}.${field}` : `Failed`, ok ? 'success' : 'error')
     await load()
   }
   ```

---

## 4. Affected Files Summary

| File | Changes |
|---|---|
| `src/lib/adminUi.ts` | Consolidate nav groups (5→3), update role allowlists, Thai labels |
| `src/components/admin/AdminNav.tsx` | No logic change (consumes groups) |
| `src/components/admin/AdminHubs.tsx` | Thai labels for hub tabs (verify) |
| `src/pages/admin/AdminSettings.tsx` | Add 2 ToggleSwitch sections, update TYPED_FORM_KEYS, Thai labels |
| `src/pages/admin/StoreFrontSettingsPage.tsx` | Thai labels |
| `src/pages/admin/AdminPrintSettings.tsx` | Thai labels |
| `src/pages/admin/MascotSettingsPage.tsx` | Thai labels |
| `src/pages/admin/AdminTenants.tsx` | Thai labels |
| `src/pages/admin/AdminBrands.tsx` | Thai labels |
| `src/pages/admin/DeliveryManagement.tsx` | Thai labels |
| `src/pages/admin/RouteOptimizationPage.tsx` | Thai labels |
| `src/pages/admin/AdminRounds.tsx` | Thai labels |
| `src/pages/admin/AdminBilling.tsx` | Thai labels |
| `src/pages/admin/AdminOnboarding.tsx` | Thai labels |
| `src/__tests__/adminUi.test.ts` | Update tests for new group structure |
| `src/__tests__/adminShell.test.ts` | Update tests if nav structure assertions change |

---

## 5. Validation Plan

### Automated Tests
- `adminUi.test.ts` — flatten invariant, role allowlists, route registration
- `adminShell.test.ts` — sidebar structure, no horizontal bar
- New: ToggleSwitch rendering for crm_automation, promotion_policy

### Manual QA
1. Login as each role (owner, admin, staff, pos, kitchen, inventory, finance, marketing, support, auditor, developer)
2. Verify nav groups = 3, labels in Thai
3. Verify no English labels in admin area
4. Go to `/admin/settings` → verify ToggleSwitch for:
   - Master Switch (existing)
   - COD (existing)
   - CRM Automation (new)
   - Promotions Kill Switch (new)
5. Toggle each → verify toast, DB persistence, immediate UI update
6. Verify generic JSON editor no longer shows the 4 typed keys

### Edge Cases
- Missing settings row → default to `true` (ZERO-FAKE)
- Malformed JSON in DB → safe fallback
- Concurrent edits → last-write-wins (acceptable for settings)

---

## 6. Rollout

1. **Phase 1**: Menu consolidation + Thai labels (no DB changes)
2. **Phase 2**: ToggleSwitch for crm_automation + promotion_policy
3. **Phase 3**: Full Thai audit of remaining admin pages
4. Deploy behind feature flag if needed; otherwise direct

---

## 7. Out of Scope

- DeliveryZonesPanel `is_active` toggles (separate component)
- Migration of existing JSON values (they're already correct)
- New settings keys not yet in DB
- Customer-facing pages (only admin area)