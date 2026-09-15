# Bite Me Baby Reality Map

## ภาพรวมของระบบ
Bite Me Baby เป็น **Cloud Kitchen Operating Platform** ที่รวมระบบ Order Management, Inventory Control, Customer Relationship Management และ AI-Powered Customer Service เข้าด้วยกันในระบบเดียว

## โมดูลของระบบ

### 1. Order Management
- **Order Hub** — ระบบประมวลผลออเดอร์แบบรวมศูนย์
- **Order Lifecycle** — Pre-order → Confirmed → Preparing → Dispatched → In Transit → Delivered
- **Order Forms** — โครงสร้างข้อมูลสำหรับการติดตามออเดอร์ (customer info, items, delivery details, payments)
- **Order Status** — การติดตามสถานะแบบเรียลไทม์ตั้งแต่การสร้างจนส่งมอบ

### 2. Bite Drive (Delivery Network)
- **External Providers** — Self-delivery, Grab Rider, Lineman Rider, Foodpanda Rider
- **Route Optimization** — Dynamic assignment ตามความจุและพิกัด
- **Delivery Tracking** — การติดตามสถานะจากการ dispatch จนถึง
- **Capacity Management** — การประสานงานจากครัวไปสู่การส่งมอบ

### 3. Customer Management
- **Customer Profiles** — ประสบการณ์เฉพาะบุคคลพร้อม Loyalty tracking
- **Loyalty Program** — การสะสมและแลกคะแนน
- **Referral System** — การได้มาซึ่งลูกค้าผ่านคำแนะนำ
- **Communication** — Push notifications, emails, in-app messaging

### 4. Inventory Management
- **Ingredient Tracking** — Stock levels, minimum thresholds, low stock alerts
- **Supplier Integration** — Automatic restocking triggers
- **Kitchen Operations** — Prep times, order preparation workflow
- **Batch Management** — Ingredient batch tracking และ expiration

### 5. AI-Powered Service
- **OpenRouter AI** — Conversational AI สำหรับการสนับสนุนลูกค้า
- **Natural Language Processing** — การประมวลภาษาธรรมชนภาษาไทย
- **Context Awareness** — การทำความเข้าใจ user intent และ context
- **Integration** — Seamless handoff ระหว่าง AI และ human support

### 6. Kitchen Operations
- **Multi-Category Catalog** — หมวด Dish, Rice, Drink, Dessert
- **Prep Workflow** — ขั้นตอนการเตรียมออเดอร์
- **Staff Coordination** — การมอบหมายงานให้พนักงานในครัว
- **Quality Assurance** — กระบวนการและมาตรฐานการตรวจเช็ค

### 7. UI Presentation (PWA Customer) — Current State (Audit 2026-09-14)
- `HomePage.tsx` / `MenuPage.tsx` — ใช้ mock data (`any[]`) + placeholder; **ยังไม่มี `FoodMenuCard`** (การ์ด 3D Floating Visual Layout)
- OpenRouter API Key **hardcode** ใน `src/lib/aiService.ts` (P0 — ดู GAP_ANALYSIS SEC-01)
- ไม่มีปุ่ม Same-day/Pre-order แยกบนการ์ดเมนู (มีเพียงปุ่มเดียว "+ เพิ่ม") — Target: ปุ่ม Same-day แสดงเมื่อ `is_available = true` ผ่าน Live Availability Engine และทั้งสองปุ่มแยก Action + Log
- `MenuPage.tsx` render `product.image` ซึ่งไม่มีฟิลด์นี้ใน mock data (ภาพแสดงไม่ออก)

> **Target State ฉบับเต็ม (3D Floating UI + Micro-interactions):

## การไหลของข้อมูล

```
Customer → Order Placement → Order Hub → Kitchen Preparation → Bite Drive → Delivery → Customer
                                    ↑
                            AI Assistance (QA, Support)
```

## Entity สำคัญ

| Entity | วัตถุประสงค์ | ตำแหน่งใน codebase |
|--------|-------------|---------------------|
| Order | ลำดับชีวิตออเดอร์ครบวงจร | src/lib/bmbAdminApi_orders.ts |
| Product | รายการเมนูและวัตถุดิบ | src/lib/bmbAdminApi_products.ts |
| Inventory | Stock levels และ suppliers | src/lib/bmbAdminApi_inventory.ts |
| Customer | User profiles และ loyalty | src/store/authStore.ts |
| AI Assistant | Conversational support | src/lib/aiService.ts |
| Delivery | External provider integration | src/lib/bmbAdminApi_orders.ts |

## Critical Paths

### Order Fulfillment
1. Customer places order → Order created → Kitchen receives order → Prep starts → Order dispatched → Delivery completes

### Inventory Management
1. Stock levels tracked → Low stock alert → Reorder trigger → Supplier notification → Restock → Stock updated

### Customer Engagement
1. User interacts via app/web → AI responds → Action taken (order, info, support) → Follow-up

## Technical Dependencies

- **Supabase** — Primary database (PostgreSQL) สำหรับ persistent data
- **OpenRouter** — AI API สำหรับ conversational interfaces
- **Zustand** — Client-side state management
- **React Router** — Application routing
- **Tailwind CSS** — Styling framework

## Monitoring & Observability

- **Order Status Dashboard** — การติดตามสถานะออเดอร์แบบเรียลไทม์
- **Inventory Alerts** — Low stock และ out-of-stock warnings
- **Delivery Tracking** — Real-time driver location
- **Customer Analytics** — Engagement metrics และ retention
- **Performance Metrics** — Order throughput, prep times, delivery success rates

## Risk Areas

1. **Inventory Accuracy** — Stock discrepancies ระหว่าง system และ physical stock
2. **Delivery Reliability** — การส่งมอบทันท่วงเวลา
3. **AI Accuracy** — การตีความคำถามของลูกค้า
4. **Scalability** — การรองรับ peak order volumes
5. **Data Consistency** — การซิงโครไนซ์ระหว่าง frontend, backend และ inventory systems

## Success Criteria

- Order accuracy 100% ตั้งแต่ placement จน delivery
- เวลาการเตรียมออเดอร์เฉลี่ยน้อยกว่า 30 นาที
- Delivery success rate 95%+
- การมองเห็นสต็อกแบบเรียลไทม์สำหรับพนักงานในครัว
- AI ตอบคำถาม routine customers ได้ 80%+
- Zero critical bugs ใน production

## Maintenance Requirements

- Database backups
- AI model retraining และ evaluation
- Inventory reconciliation procedures
- Delivery partner performance monitoring
- Customer feedback loop integration

## Future Enhancements

- Advanced analytics และ predictive modeling
- ขยายความสามารถของ AI (voice, multimodal)
- Additional delivery partnerships
- Enhanced loyalty program features
- ขยายการรองรับหลายภาษา
- การบูรณาการ payment gateways จากภายนอก