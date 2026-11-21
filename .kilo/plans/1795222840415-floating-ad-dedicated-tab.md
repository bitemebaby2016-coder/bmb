# แผนงาน: แท็บจัดการโฆษณาลอย (Floating Ad) แยกต่างหาก — รุ่นปรับปรุงตาม R80

## สถานะปัจจุบัน (จาก AI_WORK_STATE.md R80)

R80 (2026-11-20) ได้ implement "Floating Ad Exact Clone" แล้ว:
- **m209**: `is_floating_ad` column บน `products` + `marketing_posts` (2 partial indexes)
- **FloatingAdBanners.tsx**: 3 แหล่งชัดเจน (`floating_promotions`, `floating_products`, `floating_posts`) + interleaving cap 3 + badge เงียบ 3 ชนิด
- **HomePage.tsx**: query แยก 3 แหล่งตรงจาก DB + R64 interleaving
- **Admin UI**: AdminProducts toggle+badge, AdminMarketing toggle, ContentTab sources 3 แบบ

**ปัญหาคงเหลือ** (จากคำร้องของผู้ใช้ + การ inspect โค้ด):
1. **Badge ขนาด 9px** (`text-[9px]` line 252) — อ่านยาก แยกประเภทไม่ออก
2. **การตั้งค่ากระจายอยู่ ContentTab** — ปนกับสร้างเนื้อหา ไม่มีที่จัดการโฆษณาลอยเฉพาะ
3. **ไม่มี per-card override** — ไม่ได้แก้หัวข้อ/คำอธิบาย/รูป/ลำดับต่อการ์ดได้
4. **จำนวนการ์ดคงที่ที่ 3** — แอดมินปรับ max count ไม่ได้
5. **ไม่มี backgroundImage** — `floating_ad_image` (single overlay bg) ยังแยกออกมา

---

## เป้าหมาย

สร้าง **แท็บ Floating Ad ใหม่** ใน `/admin/marketing-promotions` แยกจาก ContentTab ให้แอดมิน:
- เปิด/ปิด โฆษณาลอยทั้งหมด
- ตั้ง `maxCount` (1-5)
- เลือกแหล่ง 3 แบบ + `maxItems` ต่อแหล่ง
- **จัดการการ์ดระดับรายการ**: เลือกรายการเฉพาะ จัดลำดับ (up/down) แก้ title/description/image ต่อการ์ด (override)
- ตั้ง `backgroundImage` (optional)
- Preview ก่อนเซฟ

---

## ข้อมูลและ Types ใหม่

### Types (`src/types/index.ts`)

```ts
export type FloatingAdSourceType = 'promotion' | 'post' | 'product';

export interface FloatingAdSourceConfig {
  enabled: boolean;
  maxItems: number;  // 1-5
}

export interface FloatingAdItem {
  id: string;                    // promotion_id | post_id | product_id
  type: FloatingAdSourceType;
  title?: string;                // override
  description?: string;          // override
  image?: string;                // override
  order: number;                 // 0-based display order
  enabled: boolean;              // per-card toggle
}

export interface FloatingAdConfig {
  enabled: boolean;
  maxCount: number;              // 1-5
  backgroundImage?: string;      // optional single overlay bg
  sources: {
    promotions: FloatingAdSourceConfig;
    posts: FloatingAdSourceConfig;
    products: FloatingAdSourceConfig;
  };
  items?: FloatingAdItem[];      // hand-picked overrides
}
```

### Default config (fallback ถ้ายังไม่มีใน DB)

```ts
const DEFAULT_FLOATING_AD_CONFIG: FloatingAdConfig = {
  enabled: true,
  maxCount: 3,
  sources: {
    promotions: { enabled: true, maxItems: 3 },
    posts: { enabled: true, maxItems: 3 },
    products: { enabled: true, maxItems: 3 },
  },
};
```

---

## ไฟล์ที่ต้องแก้/สร้าง

| ไฟล์ | การเปลี่ยนแปลง | สถานะ |
|---|---|---|
| `src/types/index.ts` | เพิ่ม types ด้านบน | NEW |
| `src/components/admin/FloatingAdTab.tsx` | **สร้างใหม่** — UI แท็บจัดการโฆษณาลอยครบ | NEW |
| `src/pages/admin/AdminMarketingPromotions.tsx` | เพิ่ม tab `floating_ad`, import FloatingAdTab | EDIT |
| `src/components/home/FloatingAdBanners.tsx` | รับ `sourceType` แสดง badge ใหญ่ขึ้น (`text-xs` min), ใช้ `floating_ad_config` | EDIT |
| `src/pages/HomePage.tsx` | โหลด `floating_ad_config` แทน `floatingAdSources`, build promos ตาม config ใหม่ | EDIT |
| `src/components/admin/ContentTab.tsx` | ลบ state/UI `floatingAdEnabled`, `floatingAdSources`, `floatingAdImage`, `toggleFloatingAd` | EDIT |
| `src/lib/bmbAdminApi_settings.ts` | เพิ่ม `getFloatingAdConfig()`, `setFloatingAdConfig()` typed accessors | EDIT |

---

## งานย่อย (Atomic Tasks — ทำทีละขั้น ตรวจจริงทุกขั้น)

### Task 1: Types — เพิ่ม FloatingAdConfig types ใน `src/types/index.ts`
- เพิ่ม `FloatingAdSourceType`, `FloatingAdSourceConfig`, `FloatingAdItem`, `FloatingAdConfig`
- Export ทั้งหมด
- **Verify**: `npx tsc --noEmit` pass

### Task 2: Settings API — เพิ่ม typed accessors ใน `src/lib/bmbAdminApi_settings.ts`
- `getFloatingAdConfig(): Promise<FloatingAdConfig>` — อ่านจาก `business_settings` key `floating_ad_config`, fallback ไปอ่าน `floating_ad_enabled` + `floating_ad_sources` + `floating_ad_image` แปลงเป็น config ใหม่
- `setFloatingAdConfig(config: FloatingAdConfig): Promise<boolean>` — เขียน key `floating_ad_config` (JSONB)
- **Verify**: `npx tsc --noEmit` pass

### Task 3: FloatingAdTab — สร้าง `src/components/admin/FloatingAdTab.tsx` (component ใหม่)

**Props**: `{ load: () => Promise<void> }` (สำหรับ refresh parent)

**State**:
- `config: FloatingAdConfig` (load จาก API)
- `availableItems: { promotions: PromotionRow[]; posts: MarketingPostRow[]; products: Product[] }`
- `editingItem: FloatingAdItem | null`
- `isSaving: boolean`

**Section A: การตั้งค่าภาพรวม** (Card)
- Toggle `enabled` (สวิทซ์)
- Number input `maxCount` (1-5)
- 3 Checkbox groups: โปรโมชั่น / กิจกรรม / เมนูแนะนำ — แต่ละอันมี `enabled` + `maxItems` (1-5)
- Input `backgroundImage` (URL หรือปุ่ม browse AI album — optional)

**Section B: รายการการ์ด (Table)** — โหลด available items จาก 3 แหล่ง:
- Promotions: `is_banner=true, is_active=true, date valid, approved image`
- Posts: `is_floating_ad=true, status='published'`
- Products: `is_floating_ad=true, is_available=true, archived=false`

Columns: [Drag handle / Up-Down] [Checkbox enabled] [Thumb 40x40] [Type badge] [Title] [Description] [Edit btn]

- รายการที่อยู่ใน `config.items` แสดงข้างบน เรียงตาม `order`
- รายการอื่นแสดงด้านล่าง (available pool) ให้ติ๊กเพิ่มเข้ามา
- ปุ่ม Up/Down เปลี่ยน `order` (reorder)
- Checkbox toggle `enabled` ต่อการ์ด
- ปุ่ม Edit → เปิด modal/inline form แก้ `title`, `description`, `image` (override)

**Section C: Preview** — render `FloatingAdBanners` แบบ inline ด้วย `config` ปัจจุบัน (disabled pointer-events)

**Save**: เรียก `setFloatingAdConfig(config)` → toast success → `load()`

**Verify**: `npx tsc --noEmit` pass, lint pass

### Task 4: AdminMarketingPromotions — เพิ่ม tab `floating_ad`
- เพิ่ม `{ id: 'floating_ad', label: '🫘 Floating Ad' }` ใน `TABS`
- Import `FloatingAdTab` render เมื่อ `tab === 'floating_ad'`
- **Verify**: `npx tsc --noEmit` pass, lint pass, build pass

### Task 5: FloatingAdBanners — ปรับ badge ใหญ่ขึ้น + รับ config
- เปลี่ยน badge size จาก `text-[9px]` เป็น `text-xs` (12px) + padding เหมาะสม
- Badge text ชัดเจน: `โปรโมชั่น` / `กิจกรรม` / `เมนูแนะนำ` (ไม่ใช้ emoji นำหน้า)
- รับ `config?: FloatingAdConfig` prop (optional) สำหรับ preview ในแท็บแอดมิน
- การ์ดซ่อนที่ `item.enabled === false`
- **Verify**: `npx tsc --noEmit` pass, lint pass

### Task 6: HomePage — โหลด floating_ad_config + build promos ตาม config
- แทน `floatingAdSources` array ด้วย `floatingAdConfig: FloatingAdConfig`
- เรียก `getFloatingAdConfig()` ใน useEffect โหลด settings
- Build promos:
  - ถ้า `config.items` มี → ใช้รายการนั้น เรียงตาม `order` filter `enabled=true`
  - ไม่มี → query แต่ละแหล่งตาม `sources.*.enabled` + `sources.*.maxItems`
  - รวมแล้ว slice `maxCount`
- ส่ง `promos` ที่มี `sourceType` ชัดเจนไป `FloatingAdBanners`
- **Verify**: `npx tsc --noEmit` pass, lint pass, build pass

### Task 7: ContentTab — ลบ Floating Ad settings ออก
- ลบ state: `floatingAdImage`, `floatingAdEnabled`, `floatingAdSources`
- ลบ useEffect โหลดค่าเหล่านี้จาก business_settings
- ลบ `toggleFloatingAd` function
- ลบ UI ส่วน Floating Ad (ถ้ามีใน render)
- **Verify**: `npx tsc --noEmit` pass, lint pass, build pass, tests pass

### Task 8: Migration data (optional — รันครั้งเดียวตอน deploy)
- ไม่ต้อง migration DB (เก็บใน `business_settings` JSONB เดียวกัน)
- Logic fallback ใน `getFloatingAdConfig()` จะแปลงค่าเก่า (`floating_ad_enabled`, `floating_ad_sources`, `floating_ad_image`) ให้อัตโนมัติตอนอ่านครั้งแรก

---

## การตรวจสอบ (Validation Gates)

| Gate | คำสั่ง | เกณฑ์ผ่าน |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | 0 errors |
| Lint | `npm run lint` | 0 errors |
| Build | `npm run build` | success |
| Unit tests | `npm run test` | ทั้งหมด PASS (ไม่ลดจำนวน) |
| Manual: Admin Tab | เปิด `/admin/marketing-promotions?tab=floating_ad` | เห็นแท็บ 3 ส่วนทำงานครบ |
| Manual: Badge size | เปิด `/shop` dark/light | badge อ่านง่าย แยกประเภทชัด |
| Manual: Override | แก้ title/description/image ต่อการ์ด → save → `/shop` | แสดงตาม override |
| Manual: Max count | ตั้ง `maxCount=1` / `5` → `/shop` | จำนวนการ์ดตรงที่ตั้ง |
| Manual: Background | ตั้ง `backgroundImage` → `/shop` | โชว์พื้นหลัง overlay |
| Manual: Toggle off | ปิด `enabled` → `/shop` | ไม่มีโฆษณาลอยเลย |

---

## คำถามค้าง / Out of Scope

| หัวข้อ | สถานะ |
|---|---|
| Drag-and-drop reorder (vs ปุ่ม up/down) | เริ่มปุ่ม up/down ก่อน ไม่ต้อง library |
| Auto-select "สมาร์ท" (rule-based) | Out of scope — แอดมินจัดเองเต็มที่ |
| Animation/transition การ์ด | ใช้ CSS เดิม ไม่เพิ่ม |
| Test อัตโนมัติใหม่ | ไม่จำเป็น รักษา existing tests ให้ PASS |

---

## ไฟล์แผน

บันทึกที่: `.kilo/plans/1795222840415-floating-ad-dedicated-tab.md`