
## Phase 3: Optimization & Growth (4-6 สัปดาห์)

### เป้าหมายหลัก
- เพิ่ม AI capabilities
- ปรับปรุง performance และ SEO
- สร้าง customer engagement features

### Tasks

#### Week 15-17: AI Enhancements
| ID | Task | Description | Priority | Estimated Time |
|----|------|-------------|----------|----------------|
| AI-01 | Add context-aware responses | ให้ AI รู้ history ลูกค้า | 🟡 P2 | 12 hours |
| AI-02 | Multi-language support | รองรับอังกฤษ + ไทยใน AI | 🟡 P2 | 8 hours |
| AI-03 | Intent recognition for orders | จัดการคำสั่งซื้อผ่าน chat ได้เลย | 🟡 P2 | 16 hours |
| AI-04 | Add recommendation engine | แนะนำเมนูตาม preference | 🟢 P3 | 8 hours |

#### Week 18-20: Performance & SEO
| ID | Task | Description | Priority | Estimated Time |
|----|------|-------------|----------|----------------|
| PERF-01 | Implement code splitting | Lazy-load routes สำหรับ non-critical pages | 🟢 P3 | 4 hours |
| PERF-02 | Add React.memo | Memoization สำหรับ CartItem, ProductCard | 🟢 P3 | 4 hours |
| PERF-03 | Optimize images | Compress + lazy-load images | 🟢 P3 | 4 hours |
| PERF-04 | Setup testing suite | Vitest + Playwright สำหรับ unit + E2E tests | 🟢 P3 | 12 hours |
| PERF-05 | Fix TypeScript strict mode | Set noUnusedLocals + noUnusedParameters เป็น true | 🟢 P3 | 4 hours |
| PERF-06 | Improve JSON-LD schema | Update Restaurant schema ใน index.html | 🟢 P3 | 2 hours |
| PERF-07 | Generate dynamic sitemaps | สร้าง sitemap.xml อัตโนมัติ | 🟢 P3 | 4 hours |
| PERF-08 | Add dynamic meta tags | Connect router กับ meta tags | 🟢 P3 | 4 hours |

#### Week 21-22: Customer Engagement
| ID | Task | Description | Priority | Estimated Time |
|----|------|-------------|----------|----------------|
| ENG-01 | Create notification center | แยกประเภท notification สำหรับลูกค้า | 🟡 P2 | 12 hours |
| ENG-02 | Implement referral system | เชื่อมโยง rewardsStore กับ referral flow | 🟡 P2 | 8 hours |
| ENG-03 | Add review/rating backend | ระบบรีวิวสินค้าพร้อม backend | 🟡 P2 | 12 hours |
| ENG-04 | Loyalty redemption flow | ให้ลูกค้าแลกแต้มเป็น rewards ได้จริง | 🟡 P2 | 8 hours |
| ENG-05 | Add offline support (PWA) | Service worker สำหรับ cache resources | 🟡 P2 | 8 hours |

---

## สรุปภาพรวม Roadmap

### Total Estimated Effort

| Phase | Weeks | Hours | Percentage |
|-------|-------|-------|------------|
| Phase 1 | 6 | ~96 | 27% |
| Phase 2 | 8 | ~152 | 43% |
| Phase 2.5 | 1 | ~20 | 6% |
| Phase 3 | 6 | ~72 | 20% |
| **Total** | **22** | **~356** | **100%** |

### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supabase migration takes longer | Schedule buffer 2 weeks | เริ่มทำ database abstraction layer เร็วขึ้น |
| Delivery provider APIs not available | Start with self-delivery only | Implement mock interface สำหรับทดสอบ |
| Team capacity insufficient | Split into parallel tracks | Assign senior dev สำหรับ securitycritical tasks |
| Testing takes more time | Start unit tests earlier | Integrate test writing ทุก feature development |

### Success Metrics After Full Implementation

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Security Score | 🔴 Low | 🔵 High | Audit API keys, password hashing |
| Database Status | ⚠️ localStorage | ✅ Supabase | Check data persistence |
| Payment Integration | ❌ Mock | ✅ Live | Test real payment flow |
| Delivery Coverage | ⚠️ Self-only | ✅ Multi-provider | Count active providers |
| Testing Coverage | 0% | 80%+ | Code coverage report |
| Bundle Size | Unknown | <200KB | Build output analysis |
| Lighthouse Score | Unknown | 90+ | Lighthouse audit |

### Deliverables Checklist

- [ ] Phase 1: Security fixes + Supabase setup
- [ ] Phase 2: Payment gateway + delivery integrations
- [ ] Phase 3: AI enhancements + optimization + engagement
- [ ] All GAPs resolved (P0: 3/3, P1: 9/9, P2: 8/8, P3: 9/9)
- [ ] Documentation updated
- [ ] Team training completed
- [ ] Go-live approved

## Phase 2: Core Features (6-8 สัปดาห์)

### เป้าหมายหลัก
- Implement Payment Gateway Integration
- เชื่อมต่อกับ Delivery Provider APIs
- สร้างระบบ Pre-order และ Batch Processing

### Tasks

#### Week 7-9: Payment & Order System
| ID | Task | Description | Priority | Estimated Time |
|----|------|-------------|----------|----------------|
| PAY-01 | Integrate Stripe payment | เชื่อมต่อ Stripe สำหรับ credit card payments | 🟠 P1 | 16 hours |
| PAY-02 | Add PromptPay QR flow | เพิ่มระบบสแกนจ่ายผ่าน QR Code | 🟠 P1 | 12 hours |
| PAY-03 | Update order creation flow | เชื่อมต่อ order creation กับ payment status | 🟠 P1 | 8 hours |
| PAY-04 | Implement webhook handlers | จัดการ webhook จาก payment providers | 🟠 P1 | 8 hours |

#### Week 10-12: Delivery Integration
| ID | Task | Description | Priority | Estimated Time |
|----|------|-------------|----------|----------------|
| DEL-01 | Build delivery provider interface | สร้าง abstract interface สำหรับ delivery providers | 🟠 P1 | 12 hours |
| DEL-02 | Integrate Grab API | เชื่อมต่อกับ Grab delivery API | 🟠 P1 | 16 hours |
| DEL-03 | Integrate Linemen API | เชื่อมต่อกับ Linemen delivery API | 🟠 P1 | 12 hours |
| DEL-04 | Integrate Foodpanda API | เชื่อมต่อกับ Foodpanda delivery API | 🟠 P1 | 12 hours |
| DEL-05 | Implement route optimization | คำนวณเส้นทางที่ดีที่สุดสำหรับ deliveries | 🟡 P2 | 16 hours |
| DEL-06 | Add ETA calculation | ประมาณเวลาเดินทางให้ลูกค้าเห็น real-time | 🟡 P2 | 8 hours |
| DEL-07 | Driver assignment logic | Assign driver/provider อัตโนมัติตาม distance | 🟡 P2 | 8 hours |

#### Week 13-14: Inventory & Kitchen Ops
| ID | Task | Description | Priority | Estimated Time |
|----|------|-------------|----------|----------------|
| INV-01 | Add recipe-inventory linking | เชื่อมโยง recipe กับ ingredient deduction | 🟠 P1 | 12 hours |
| INV-02 | Implement stock validation | ป้องกันสั่งซื้อเมื่อ stock = 0 | 🟠 P1 | 8 hours |
| INV-03 | Create purchase order system | ระบบสั่งวัตถุดิบจากผู้จัดจำหน่าย | 🟡 P2 | 12 hours |
| INV-04 | Batch production planning | Freeze batch หลัง cutoff time | 🟡 P2 | 12 hours |

---

## Phase 2.5: Visual Upgrade & Image Automation (เพิ่มใหม่ 2026-09-14 — 2 สัปดาห์)

### เป้าหมายหลัก
- อัปเกรดหน้า PWA Home/Menu เป็น 3D Floating Visual Layout
- ปรับปรุงการอัปโหลดรูปอาหารโดย Admin (ไม่ใช่ AI Generate)
- แยกปุ่ม Same-day / Pre-order พร้อม log อิสระ

> เงื่อนไขก่อนเริ่ม: เอกสาร `docs/COMPONENT_SPEC_UI.md` v1.1 ต้องผ่านการอนุมัติ (Documentation Gate)

### Tasks

#### Week 11-12: Visual Upgrade & Image Automation
| ID | Task | Description | Priority | Estimated Time |
|----|------|-------------|----------|----------------|
| UI-01 | สร้าง `src/components/FoodMenuCard.tsx` | 3D Floating card: negative margin + drop-shadow ซ้อนเลเยอร์ + hover/active animations + props interface ตาม COMPONENT_SPEC_UI §6 | 🟠 P1 | 8 hours |
| UI-02 | Refactor MenuPage grid | ตัด mock `any[]` → `Product[]` + FoodMenuCard (แก้ bug `product.image` ด้วย) | 🟠 P1 | 4 hours |
| UI-03 | Refactor HomePage featured area | ใช้ FoodMenuCard สำหรับสินค้าแนะนำ | 🟡 P2 | 3 hours |
| UI-04 | Same-day / Pre-order split buttons + logs | สอง action แยก + append-only log entries ตาม COMPONENT_SPEC_UI §5 | 🟠 P1 | 5 hours |
# Implementation Roadmap — แผนงานพัฒนา Bite Me Baby

## ภาพรวม
Roadmap นี้วางแผนการแก้ไข GAP ที่พบใน Gap Analysis Map แบ่งเป็น **3 Phases** พร้อมระยะเวลาโดยประมาณและ deliverables สำหรับแต่ละ phase

---

## Phase 1: Foundation & Security (4-6 สัปดาห์)

### เป้าหมายหลัก
- แก้ไข Critical security issues
- ย้ายจาก localStorage ไป Supabase
- เริ่มสร้างระบบ authentication ที่ปลอดภัย

### Tasks

#### Week 1-2: Security Fixes
| ID | Task | Description | Priority | Estimated Time |
|----|------|-------------|----------|----------------|
| SEC-01 | Move API Keys to .env | ย้าย OpenRouter API key ออกจาก source code | 🔴 P0 | 2 hours |
| SEC-02 | Add bcrypt password hashing | ใช้ bcrypt แทน hash() ใน bmbStorage.ts | 🔴 P0 | 4 hours |
| SEC-03 | Add CSRF tokens | เพิ่ม CSRF protection สำหรับทุก mutation | 🟠 P1 | 8 hours |
| SEC-04 | Validate environment variables | เช็คว่ามี .env file ก่อน startup | 🟢 P3 | 2 hours |

#### Week 3-4: Database Migration Start
| ID | Task | Description | Priority | Estimated Time |
|----|------|-------------|----------|----------------|
| DB-01 | Set up Supabase project | สร้าง Supabase project และ configure | 🟠 P1 | 4 hours |
| DB-02 | Create migration scripts | เขียน migration จาก schema ที่มีอยู่ | 🟠 P1 | 8 hours |
| DB-03 | Implement storage abstraction layer | สร้าง abstract interface แทนที่ localStorage calls | 🟠 P1 | 12 hours |
| DB-04 | Enable RLS policies | เปิดใช้งาน RLS ทุก table ตาม schema | 🟠 P1 | 6 hours |

#### Week 5-6: Core Features Backup
| ID | Task | Description | Priority | Estimated Time |
|----|------|-------------|----------|----------------|
| CORE-01 | Implement data backup strategy | ทำ backup ทุกวันสำหรับข้อมูลสำคัญ | 🟠 P1 | 8 hours |
| CORE-02 | Add audit log basic | บันทึกการเปลี่ยนแปลงสำคัญในระบบ | 🟠 P1 | 8 hours |
| CORE-03 | Update admin access control | Replace email check กับ role-based access | 🔴 P1 | 4 hours |