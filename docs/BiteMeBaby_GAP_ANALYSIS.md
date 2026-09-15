
## 🟡 P2: Medium Gaps

### 1. AI Service
| Item | Target | Reality | Status |
|------|--------|---------|--------|
| Context-aware Responses | รู้บริบทลูกค้า (ประวัติ, loyalty) | Conversation history เก็บเฉพาะ session ปัจจุบัน | ⚠️ Partially implemented |
| Multi-language Support | ไทย + อังกฤษ | ตอบเฉพาะภาษาไทย | ⚠️ Partially implemented |
| Intent Recognition | จัดการคำสั่งซื้อผ่าน chat | มีโครงสร้างแต่ยังไม่ได้ connect กับ order flow | ❌ Not implemented |

### 2. Route & Dispatch
| Item | Target | Reality | Status |
|------|--------|---------|--------|
| Route Optimization | คำนวณเส้นทางที่ดีที่สุด | ไม่มี route calculation | ❌ Not implemented |
| ETA Calculation | ประมาณเวลาเดินทาง | ไม่มี | ❌ Not implemented |
| Driver Assignment | Assign driver/provider อัตโนมัติ | ไม่มี assignment logic | ❌ Not implemented |

### 3. Frontend/UI
| Item | Target | Reality | Status |
|------|--------|---------|--------|
| Offline Support (PWA) | Cache resources สำหรับ offline | manifest.json มีแต่ไม่มี service worker | ⚠️ Partially implemented |
| Responsive Design | Mobile-first + Desktop | ใช้ Tailwind responsive classes แต่ทดสอบบน desktop น้อย | ✅ Implemented (ควร test) |
| Loading States / Error Boundaries | แสดง loading/error อย่างชัดเจน | มี ErrorBoundary component แต่ใช้ limited scope | ⚠️ Partially implemented |

---

## 🟢 P3: Low Gaps (Improvements)

### 1. Code Quality
| Item | Target | Reality | Action |
|------|--------|---------|--------|
| TypeScript Strict Mode | strict: true + noUnusedLocals | noUnusedLocals: false, noUnusedParameters: false | Fix และ set to true |
| Testing Coverage | Unit + E2E tests | ไม่มี test suite เลย | เพิ่ม Vitest + Playwright |
| Code Splitting | Lazy-load routes | Import ทั้งหมดที่ root | เพิ่ม React.lazy สำหรับ non-critical pages |

### 2. Performance
| Item | Target | Reality | Action |
|------|--------|---------|--------|
| Image Optimization | Compressed images, lazy load | มี placeholder images บางส่วน | Optimize และ lazy-load |
| Bundle Size < 200KB | Minify + tree-shaking | ขนาด bundle ยังไม่ได้วัด | Run `npm run build` แล้วตรวจสอบ |
| Memoization | React.memo สำหรับ components ที่ render บ่อย | ไม่มี memoization | Add memoization สำหรับ CartItem, ProductCard |

### 3. SEO
| Item | Target | Reality | Status |
|------|--------|---------|--------|
| JSON-LD Schema | Restaurant schema | มีใน index.html แต่ incomplete | Update with full schema |
| Dynamic Meta Tags | Per-page meta tags | มี seo.ts แต่ยังไม่ได้ update document.title fully | Connect router with meta tags |
| Sitemap | Auto-generate sitemap.xml | ไม่มี | Add sitemap generation |

---

## สรุป GAP Counts

| Level | Count | Percentage |
|-------|-------|------------|
| 🔴 P0 - Critical | 3 | 5% |
| 🟠 P1 - High | 9 | 16% |
| 🟡 P2 - Medium | 8 | 14% |
| 🟢 P3 - Low | 9 | 16% |
| ✅ Already Done | 25 | 44% |
| **Total** | **54** | **100%** |

## Priority Actions (เรียงตามลำดับความสำคัญ)

1. 🔴 **ย้าย API Key ออกจาก source code** — ทำทันที
2. 🔴 **เพิ่ม password hashing ที่ปลอดภัยกว่า** — Phase 1
3. 🔣 **เริ่ม Supabase migration plan** — Phase 1
4. 🔵 **Implement payment gateway integration** — Phase 2
5. 🔵 **Implement delivery provider APIs** — Phase 2
6. 🔵 **FoodMenuCard 3D Floating UI ตาม `docs/COMPONENT_SPEC_UI.md`** — Phase 2.5 (หลังอนุมัติเอกสาร)
# Gap Analysis Map — แผนที่ช่องว่างระหว่าง Target vs Reality

## ภาพรวม
เอกสารนี้เปรียบเทียบ **ข้อกำหนดเป้าหมาย (Target Product Spec)** กับ **สิ่งที่ทำจริง (Code Realization)** ของ Bite Me Baby เพื่อระบุ GAP ที่ต้องแก้ไข

## ระดับความสำคัญของ GAP

| ระดับ | ความหมาย | ตัวอย่าง |
|-------|---------|----------|
| 🔴 P0 - Critical | ระบบล้มเหลว/ทำงานไม่ถูกต้อง | Password hash ไม่ปลอดภัย, API key hardcoded |
| 🟠 P1 - High | Feature สำคัญยังไม่ทำ | Supabase integration, RLS policies |
| 🟡 P2 - Medium | Feature ทำงานแต่จำกัด | localStorage แทน database จริง |
| 🟢 P3 - Low | ปรับปรุงเล็กน้อย | UI polish, error handling |

---

## 🔴 P0: Critical Gaps

### 1. Security — รหัสผ่านและ API Key
| Item | Target | Reality | Action |
|------|--------|---------|--------|
| Password Hash |bcrypt บน server | hash() ธรรมดาใน client (`bmbStorage.ts`) | migrate ไป Supabase + bcrypt |
| OpenRouter API Key | stored in .env | Hardcoded ใน `aiService.ts` | ย้ายเป็น env variable ทันที |
| CSRF Protection | มีใน specification | ไม่มีใน SPA | เพิ่ม middleware หรือ header |

### 2. Database & Persistence
| Item | Target | Reality | Action |
|------|--------|---------|--------|
| Supabase Integration | PostgreSQL สำหรับ persistent data | localStorage เท่านั้น | replace storageGet/StorageSet ด้วย Supabase queries |
| RLS Policies | กำหนดไว้แล้วใน schema | ไม่ได้เปิดใช้งาน | enable RLS ทุก table |
| Data Backup | มีใน requirements | ไม่มี — localStorage ล้างหายง่าย | implement backup strategy |

---

## 🟠 P1: High Gaps

### 1. Order Management
| Item | Target | Reality | Status |
|------|--------|---------|--------|
| Pre-order System | รองรับ pre-order | มี UI แต่ mock order creation | ⚠️ Partially implemented |
| Payment Gateway | PromptPay QR + Credit Card | Mock only — ไม่มีการ integrate Stripe จริง | ❌ Not implemented |
| Delivery Provider Integration | Grab, Linemen, Foodpanda | Define type enum แต่ไม่มี API call | ❌ Not implemented |
| Batch Production Plan | Freeze batch หลัง cutoff | ไม่มี logic batch processing | ❌ Not implemented |

### 2. Inventory Management
| Item | Target | Reality | Status |
|------|--------|---------|--------|
| Recipe-Inventory Link | Recipe → Ingredient deduction | ไม่มี recipe linking | ❌ Not implemented |
| Stock Validation on Order | ป้องกันขายเมื่อ stock = 0 | ไม่มี validation | ❌ Not implemented |
| Purchase Order | Purchase + Reorder | ไม่มี UI/function | ❌ Not implemented |

### 3. Customer Features
| Item | Target | Reality | Status |
|------|--------|---------|--------|
| Notification Center | แยกประเภท notification | ไม่มี | ❌ Not implemented |
| Referral System | มี referral flow | มี rewardsStore แต่ไม่เชื่อม referral | ⚠️ Partially implemented |
| Loyalty Redemption | Redeem points for rewards | มี rewardsStore action แต่ยังใช้ไม่ได้ | ⚠️ Partially implemented |
| Review/Rating System | รีวิวสินค้า | มี page structure แต่ไม่มี backend | ⚠️ Partially implemented |

### 4. Admin Features
| Item | Target | Reality | Status |
|------|--------|---------|--------|
| Dashboard Analytics | Real-time stats, charts | มี getDashboardStats function แต่ยังแสดงข้อมูล mock | ⚠️ Partially implemented |
| Role-based Access | Admin + Staff roles | ใช้ email check แบบ hardcode (`admin@bmb.co.th`) | 🔴 Needs fix |
| Audit Log | ติดตามการเปลี่ยนแปลงทุกอย่าง | ไม่มี audit log | ❌ Not implemented |



รายละเอียดข้อกำหนด: `docs/COMPONENT_SPEC_UI.md` (v1.1)