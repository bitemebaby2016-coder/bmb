# 🍽️ Bite Me Baby — Cloud Kitchen Operating Platform

> **Master Architecture, Business Rules & Development Foundation**

**Bite Me Baby Cloud Kitchen — เมืองจันทบุรี**

**Mobile-first PWA + Order Hub + Kitchen Operations + Bite Drive + External Delivery + AI Service Staff + Content Automation + Customer Intelligence**

## 📋 Documentation Status Update (2026-09-13)

### ✅ Phase 1: Core Documentation + Gap Analysis + Roadmap Created

**เอกสารที่สร้างเสร็จแล้ว:**
- ✅ `BiteMeBaby_TARGET_PRODUCT_SPEC.md` — ข้อกำหนดผลิตภัณฑ์เป้าหมาย (ภาษาไทย)
- ✅ `BiteMeBaby_REALITY_MAP.md` — แผนที่ระบบจริงจาก code analysis (ภาษาไทย)
- ✅ `docs/BiteMeBaby_API.md` — เอกสาร API และ internal modules (ภาษาไทย)
- ✅ `docs/BiteMeBaby_ARCHITECTURE.md` — System architecture diagrams (ภาษาไทย)
- ✅ `docs/BiteMeBaby_DEPLOYMENT.md` — คู่มือ deployment (ภาษาไทย)
- ✅ `docs/BiteMeBaby_USER_GUIDE.md` — คู่มือการใช้งาน (ภาษาไทย)
- ✅ `docs/BiteMeBaby_GAP_ANALYSIS.md` — Gap analysis Map (Target vs Reality) (ภาษาไทย)
- ✅ `docs/BiteMeBaby_IMPLEMENTATION_ROADMAP.md` — Implementation roadmap 20 weeks (~320 hours) (ภาษาไทย)

### 🆕 Phase 2: 3D Floating Visual Layout (2026-09-14)

**เป้าหมาย:** ปรับปรุงหน้าตา UI บนหน้า PWA (Home/Menu) เป็นสไตล์ **"3D Floating Visual Layout"** — Admin อัปโหลดรูปเอง ไม่ใช่ AI สร้างรูป

**เอกสารที่อัปเดต/สร้าง (Step 1 — Documentation Gate):**
- 🆕 `docs/COMPONENT_SPEC_UI.md` v2.0 — Component Spec + Admin Image Upload + Cross-Audit (เอกสารหลักของงานนี้)
- ♻️ `BiteMeBaby_TARGET_PRODUCT_SPEC.md` v1.5 — เพิ่ม Feature 7 (3D Floating UI)
- ♻️ `BiteMeBaby_REALITY_MAP.md` — เพิ่ม Current UI Reality (ผลตรวจ D0)
- ♻️ `docs/BiteMeBaby_GAP_ANALYSIS.md` — เพิ่ม GAP กลุ่ม Visual Upgrade
- ♻️ `docs/BiteMeBaby_IMPLEMENTATION_ROADMAP.md` — เพิ่ม Phase 2.5 (Visual Upgrade)
- ♻️ `docs/BiteMeBaby_DEPLOYMENT.md` — อัปเดต env vars (AI Chat เท่านั้น)
- ♻️ `docs/BiteMeBaby_USER_GUIDE.md` — เพิ่มวิธีใช้ปุ่ม Same-day / Pre-order ใหม่
- ♻️ `README.md` — เพิ่ม Section #101

**สถานะ:** ✅ อนุมัติแล้ว — โค้ด FoodMenuCard พร้อมใช้งาน

---

# 0. DOCUMENT STATUS

**Document:** `README.md`

**Status:** MASTER FOUNDATION

**Purpose:** Single Source of Truth สำหรับ Business Model, System Architecture, Operating Rules และ Development Direction

**Development Principle:**

> **Documentation First → Existing System Audit → Gap Map → Architecture Documents → Cross-document Audit → Implementation**

ห้ามเริ่มสร้างหรือรื้อระบบขนาดใหญ่จาก README เพียงอย่างเดียว

README ฉบับนี้กำหนด **สิ่งที่ระบบควรเป็น**

แต่ไม่ได้ยืนยันว่า Feature ใดมีอยู่จริงใน Production

ก่อน Implementation ต้องตรวจสอบ:

```text
Production Code
Production Database
Migrations
Edge Functions
Existing UI
Existing APIs
Existing Integrations
Existing Automation
Existing Delivery / Tracking Logic
```

---

# 1. PROJECT IDENTITY

## 1.1 Bite Me Baby คืออะไร

**Bite Me Baby คือ Cloud Kitchen Operating Platform ที่มี Mobile-first PWA เป็นช่องทางหลักสำหรับลูกค้า และมี AI Service Staff "Bite" เป็นผู้ช่วยบริการลูกค้าและ Intelligence Layer ของระบบ**

ระบบรองรับทั้ง:

```text
PRE-ORDER
+
SAME-DAY ORDER
```

และ:

```text
BITE DRIVE
+
EXTERNAL DELIVERY PROVIDERS
```

โดยเชื่อม:

```text
Customer
Marketing
Ordering
Payment
Kitchen
Capacity
Inventory
Production
Delivery
Tracking
Customer Data
Loyalty
AI
Automation
Content
```

เข้ากับ Order Hub เดียว

---

# 2. CORE BUSINESS MODEL

Bite Me Baby มี **2 Business Modes หลัก**

```text
                    BITE ME BABY
                         │
              ┌──────────┴──────────┐
              ↓                     ↓
         PRE-ORDER              SAME-DAY
              │                     │
       Future Delivery        Current Day
       Delivery Round         Live Availability
       Vote / Random Menu     Available Menu
       Batch Production       Current Capacity
              │                     │
              └──────────┬──────────┘
                         ↓
                    ORDER HUB
                         ↓
              DELIVERY DECISION
                 ┌───────┴───────┐
                 ↓               ↓
             BITE DRIVE      EXTERNAL
                             PROVIDER
```

---

# 3. ONE-SENTENCE DEFINITION

> **Bite Me Baby คือ Cloud Kitchen Operating Platform ที่รับทั้ง Pre-order และ Same-day Order ผ่าน Mobile-first PWA และช่องทางภายนอก รวมออเดอร์เข้าสู่ Supabase Order Hub เดียว บริหาร Kitchen / Inventory / Capacity / Production / Payment / Delivery / Tracking และใช้ Bite AI + Automation + Customer Intelligence + Content Automation เพื่อช่วยให้ธุรกิจดำเนินงานและเติบโตแบบ Closed-loop โดย Business Rules และ Transaction Authority ยังคงอยู่ที่ระบบ ไม่ใช่ AI**

---

# 4. NORTH STAR

Bite Me Baby ไม่ได้สร้างเพื่อเป็นเพียง:

```text
Online Menu
```

หรือ:

```text
Food Ordering Website
```

แต่เป็น:

> **Cloud Kitchen Operating Platform**

ที่ทำให้เจ้าของสามารถบริหาร:

```text
ขาย
↓
รับออเดอร์
↓
วางแผนครัว
↓
จัดการวัตถุดิบ
↓
จัดส่ง
↓
ติดตาม
↓
ดูปัญหา
↓
ดูข้อมูลลูกค้า
↓
ทำการตลาด
↓
สร้างออเดอร์รอบถัดไป
```

จากระบบเดียว

---

# 5. MASTER SYSTEM MODEL

```text
                         CUSTOMER
                            │
              ┌─────────────┼─────────────┐
              ↓             ↓             ↓
             PWA        FACEBOOK      OTHER CHANNELS
              │             │             │
              └─────────────┼─────────────┘
                            ↓
                    OMNICHANNEL ORDER
                         INTAKE
                            ↓
                     ORDER HUB
                      SUPABASE
                            │
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
    CUSTOMER            KITCHEN             DELIVERY
    IDENTITY            OPERATIONS          OPERATIONS
        │                   │                   │
        ↓                   ↓                   ↓
      BITE               CAPACITY          BITE DRIVE
      AI                  INVENTORY         EXTERNAL
        │                PRODUCTION         PROVIDERS
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ↓
                     COMMAND CENTER
                            │
              ┌─────────────┼─────────────┐
              ↓             ↓             ↓
          AUTOMATION       AI         EXCEPTIONS
              │             │             │
              └─────────────┼─────────────┘
                            ↓
                    CUSTOMER INTELLIGENCE
                            ↓
                    CONTENT AUTOMATION
                            ↓
                       ACQUISITION
                            ↓
                         ORDERS
```

---

# 6. ARCHITECTURAL PRINCIPLES

## Rule 1 — Supabase is the Source of Truth

Supabase PostgreSQL เป็นฐานข้อมูลกลาง

ห้ามให้สิ่งต่อไปนี้เป็น Order Database:

```text
Facebook
Messenger
LINE
Make.com
AI
Frontend
Google Sheets
External Delivery Provider
```

---

## Rule 2 — One Order Hub

ทุก Order ไม่ว่าจะมาจาก:

```text
PWA
Facebook
Messenger
LINE
TikTok
Google
QR
Manual/Admin
Future Channels
```

ต้องเข้าสู่:

```text
Unified Order Hub
```

---

## Rule 3 — One Unified Order ID

ทุก Order ต้องมี:

```text
order_id
```

เพียงหนึ่งเดียว

External Systems สามารถมี:

```text
external_order_id
external_reference
provider_reference
```

แต่ต้อง map กลับมายัง:

```text
order_id
```

ของ Bite Me Baby

---

# 7. ORDER MODE

Order ต้องแยกอย่างชัดเจน:

```text
PRE_ORDER
SAME_DAY
```

ห้ามใช้ Delivery Round หรือ Delivery Provider เป็นตัวบอกว่า Order เป็น Pre-order หรือ Same-day

---

# 8. DELIVERY METHOD

Delivery Method แยกจาก Order Mode:

```text
BITE_DRIVE
EXTERNAL_PROVIDER
```

ทำให้เกิด 4 Combination หลัก:

| Order Mode | Delivery Method   | ความหมาย                            |
| ---------- | ----------------- | ----------------------------------- |
| PRE_ORDER  | BITE_DRIVE        | พรีออเดอร์ ส่งโดย Bite Drive        |
| PRE_ORDER  | EXTERNAL_PROVIDER | พรีออเดอร์ ส่งโดยไรเดอร์ภายนอก      |
| SAME_DAY   | BITE_DRIVE        | สั่งวันนี้ ส่งโดย Bite Drive        |
| SAME_DAY   | EXTERNAL_PROVIDER | สั่งวันนี้ ส่งโดยผู้ให้บริการภายนอก |

Architecture ต้องรองรับทั้ง 4 กรณีตั้งแต่ต้น

---

# 9. PRE-ORDER BUSINESS MODEL

Pre-order เป็นหนึ่งใน Business Model หลัก

Flow:

```text
Customer
↓
เลือกเมนู
↓
เลือก Delivery Date
↓
เลือก Delivery Round
↓
Order
↓
รวม Batch
↓
Cutoff
↓
Production Planning
↓
Bite Drive / External Delivery
```

Pre-order Menu สามารถมี:

```text
Regular Menu
Vote Menu
Community Choice
Random Menu
Chef Choice
Limited Menu
Special Menu
Weekly Menu
```

---

# 10. PRE-ORDER MENU EXPERIENCE

Pre-order ไม่ควรเป็นเพียงระบบจองอาหาร

สามารถสร้าง Engagement:

```text
"พรุ่งนี้อยากกินอะไร?"

[กะเพรา]
[ไก่ทอด]
[ข้าวผัด]
[สุ่มให้ Bite เลย]
```

สามารถรองรับ:

```text
Voting
Random Selection
Limited Quantity
Popular Choice
Community Choice
```

แต่ผลการ Vote ต้องไม่สามารถสร้าง Transaction ที่ข้าม Business Validation

---

# 11. SAME-DAY BUSINESS MODEL

Same-day เป็น Business Model จริง

ไม่ใช่ Pre-order ที่ถูกปรับเวลา

Same-day หมายถึง:

> **อาหารที่มี Availability สำหรับการสั่งและจัดส่งภายในวันปัจจุบัน**

ระบบต้องประเมินแบบ Real-time / Near Real-time:

```text
Menu Availability
+
Ingredient Availability
+
Kitchen Capacity
+
Delivery Capacity
+
Delivery Availability
+
Store Operating Status
+
Payment Rules
```

---

# 12. SAME-DAY MENU

Same-day Menu เป็น Concept แยกจาก Pre-order Menu

ตัวอย่าง:

```text
TODAY

กะเพราหมู
8 กล่อง

ไก่ทอด
12 กล่อง

ข้าวผัด
4 กล่อง

แกงเขียวหวาน
SOLD OUT
```

Same-day Menu ต้องสามารถเปลี่ยน Availability ตาม:

```text
Stock
Orders
Production
Capacity
Delivery
Emergency Close
```

---

# 13. LIVE AVAILABILITY ENGINE

Same-day Availability:

```text
AVAILABLE
LIMITED
SOLD_OUT
TEMPORARILY_UNAVAILABLE
STORE_CLOSED
DELIVERY_UNAVAILABLE
```

ระบบต้องไม่แสดงเมนูที่ไม่สามารถขายได้

AI / Content Automation ต้องอ่าน Availability จากระบบจริง

---

# 14. STORE OPERATING CALENDAR

ระบบต้องมี Operating Calendar

แยก:

```text
Store Open
Pre-order Open
Same-day Open
Bite Drive Open
External Delivery Open
Kitchen Operating
```

ตัวอย่าง:

```text
13 Sep

STORE
OPEN

PRE-ORDER
OPEN

SAME-DAY
OPEN

BITE DRIVE
OPEN

EXTERNAL DELIVERY
AVAILABLE
```

สถานะของแต่ละส่วนไม่จำเป็นต้องเหมือนกัน

---

# 15. STORE CLOSING PLANNER

ระบบต้องมี:

> **Store Closing Planner**

ไม่ใช่แค่ Customer Order Cutoff

โครงสร้างเวลา:

```text
ORDER CUTOFF
      ↓
KITCHEN CUTOFF
      ↓
PRODUCTION
      ↓
PACKING
      ↓
DISPATCH
      ↓
LAST DELIVERY
      ↓
STORE CLOSING
```

ค่าตัวเลขจริงต้องเป็น:

```text
Admin Configuration
```

ไม่ Hard-code

---

# 16. CUTOFF ARCHITECTURE

ต้องแยกอย่างน้อย:

```text
Order Cutoff
Kitchen Cutoff
Production Start
Dispatch Time
Last Delivery
Store Closing
```

และต้องรองรับ:

```text
Pre-order Cutoff
Same-day Cutoff
Delivery Round Cutoff
```

README ไม่กำหนดตัวเลขจริงจนกว่าจะตรวจ Business Operation

---

# 17. DELIVERY CAPACITY

Kitchen Capacity กับ Delivery Capacity เป็นคนละ Resource

ตัวอย่าง:

```text
Kitchen Capacity = 30
Delivery Capacity = 15
```

ระบบต้องไม่เปิดรับ 30 Orders แล้วปล่อยให้ Delivery รับไม่ไหว

ต้องคำนวณ:

```text
Order Capacity
+
Kitchen Capacity
+
Delivery Capacity
```

ร่วมกัน

---

# 18. DELIVERY CAPACITY MODEL

Capacity สามารถแยกตาม:

```text
Date
Time
Delivery Round
Delivery Method
Delivery Zone
Driver Availability
External Provider Availability
```

ตัวอย่าง:

```text
Tomorrow Midday

Kitchen
24 / 30

Bite Drive
10 / 15

External Provider
AVAILABLE

Final Sellable Capacity
ตาม Business Rule
```

---

# 19. BITE DRIVE

> **Bite Drive = ระบบจัดส่งของ Bite Me Baby เอง**

ในระยะแรก:

```text
Bite Drive
↓
รถของร้าน 1 คัน
```

ไม่จำเป็นต้องมี Driver App แยก

พนักงานส่งของในอนาคตสามารถใช้:

```text
Mobile Web
PWA
หรือ Admin/Driver Web View
```

ได้

---

# 20. BITE DRIVE ROADMAP

### Initial

```text
1 ร้าน
1 รถ
1 Driver / Staff
```

### Future

```text
1 ร้าน
หลาย Driver
หลาย Vehicle
Driver Assignment
Route
Stops
ETA
Tracking
Delivery History
```

Architecture ต้องรองรับการเพิ่ม Driver โดยไม่ต้องสร้าง Core ใหม่

---

# 21. EXTERNAL DELIVERY PROVIDER

External Delivery หมายถึง:

> **บริการไรเดอร์ภายนอกทุกค่ายที่ระบบสามารถเรียกใช้ได้**

ไม่ล็อกกับ Grab

ตัวอย่าง:

```text
GRAB
Provider B
Provider C
Other Local Rider
Future Provider
```

Grab เป็นเพียงหนึ่ง Provider

ไม่ใช่ Core Delivery Architecture

---

# 22. DELIVERY PROVIDER ABSTRACTION

Core:

```text
EXTERNAL_PROVIDER
```

Provider:

```text
GRAB
OTHER_PROVIDER
```

ห้ามออกแบบ:

```text
delivery_method = GRAB
```

ควรเป็น:

```text
delivery_method = EXTERNAL_PROVIDER
provider = GRAB
```

เพื่อให้เปลี่ยน Provider ได้

---

# 23. DELIVERY ENGINE

Delivery Engine ต้องรองรับ:

```text
Address
Geolocation
Distance
Zone
Delivery Method
Delivery Fee
Delivery Capacity
Route
Stops
Driver
Provider
ETA
Tracking
Delivery Status
Delivery Failure
Proof of Delivery
```

---

# 24. ROUTE CALCULATION

ระบบต้องรองรับ:

```text
Order
↓
Delivery Address
↓
Geolocation
↓
Distance
↓
Route Calculation
↓
Estimated Travel Time
↓
Delivery Cost
↓
Delivery Assignment
```

สามารถรองรับ External Route Provider เช่น:

```text
Google Routes
Future Routing Provider
```

แต่ต้องสร้าง Provider Abstraction

ไม่ผูก Core กับ Provider รายเดียว

---

# 25. DELIVERY COST ENGINE

Delivery Fee ต้องสามารถคำนวณจาก:

```text
Distance
+
Zone
+
Delivery Method
+
Provider Quote
+
Time
+
Business Rule
+
Promotion
```

ตัวอย่าง:

```text
Bite Drive
0–2 km
= Configured Fee

2–5 km
= Configured Fee

External Provider
= Provider Quote
```

ค่าจริงต้องเป็น Configuration

---

# 26. DELIVERY TRACKING

ลูกค้าต้องติดตาม Order ได้จาก PWA

ตัวอย่าง:

```text
✓ Order Confirmed
✓ Kitchen Preparing
✓ Food Ready
✓ Driver Assigned
✓ On the Way
✓ Delivered
```

Bite Drive สามารถรายงาน:

```text
Driver
Location
Status
ETA
```

External Provider สามารถ map สถานะกลับมายัง:

```text
Unified Delivery State
```

---

# 27. DELIVERY STATE

Delivery State แยกจาก Order State

ตัวอย่าง:

```text
PENDING
ASSIGNED
PREPARING_FOR_PICKUP
PICKED_UP
IN_TRANSIT
DELIVERED
FAILED
CANCELLED
```

Order State และ Delivery State ห้ามกลายเป็น State Machine เดียวกันแบบปะปน

---

# 28. ORDER STATE MACHINE

Core Order:

```text
NEW
 ↓
CONFIRMED
 ↓
PREPARING
 ↓
READY
 ↓
OUT_FOR_DELIVERY
 ↓
DELIVERED
```

Exception:

```text
CANCELLED
PAYMENT_FAILED
DELIVERY_FAILED
REFUNDED
```

รายละเอียด Transition ต้องอยู่ใน:

```text
docs/ORDER_STATE_MACHINE.md
```

---

# 29. PAYMENT STATE

Payment แยกจาก Order:

```text
PENDING
PAID
FAILED
REFUNDED
PARTIAL_REFUND
```

ตัวอย่าง:

```text
Order = CONFIRMED
Payment = PENDING
```

เป็น State ที่ถูกต้องได้

---

# 30. PAYMENT

รองรับ:

```text
PromptPay / QR
Cash on Delivery
Future Payment Provider
```

Payment Validation ต้องทำ Server-side

External Delivery หากต้องชำระก่อนเรียก Rider:

```text
Payment
↓
PAID
↓
Book Provider
```

---

# 31. OMNICHANNEL ORDER INTAKE

ระบบต้องรวบรวม Order จาก:

```text
Bite Me Baby PWA
Facebook
Messenger
LINE
TikTok
Google
QR
Manual
Future Channels
```

เข้า:

```text
UNIFIED ORDER HUB
```

---

# 32. FACEBOOK / SOCIAL ORDER

Facebook และ Social Channels เป็น:

```text
Acquisition
Communication
Order Intake
```

ไม่ใช่ Order Database

Architecture:

```text
Facebook
↓
AI / Integration
↓
Order Intent
↓
Validation
↓
Bite Me Baby Checkout
↓
Order Hub
```

---

# 33. AI ORDER AGGREGATION

Bite / AI Integration สามารถอ่านข้อความ:

> "เอากะเพราหมู 2 กล่อง ส่งพรุ่งนี้เที่ยง"

Extract:

```text
Product
Quantity
Date
Round
Address
Potential Customer
```

จากนั้น:

```text
AI Parse
↓
Normalize
↓
Backend Validation
↓
Customer Review
↓
Payment
↓
Order Creation
```

AI ห้ามสร้าง Transaction ที่ข้าม Validation

---

# 34. ORDER DEDUPLICATION

Omnichannel ต้องป้องกัน:

```text
Facebook Order
+
PWA Order
```

กลายเป็น Order ซ้ำ

ต้องมี:

```text
Customer Identity
External Reference
Idempotency Key
Event ID
```

และตรวจสอบ Duplicate ก่อนสร้าง Order

---

# 35. CUSTOMER LOGIN & IDENTITY

PWA ต้องมีระบบ:

```text
Login
Session
Customer Profile
Order History
Address
Preferences
Loyalty
Notifications
Bite Memory
```

Primary Identity:

```text
customer_id
```

External identities:

```text
phone
email
facebook_id
line_id
other_channel_id
```

ไม่ใช้ External ID เป็น Primary Identity

---

# 36. GUEST → CUSTOMER

ระบบสามารถให้ Guest:

```text
Browse
Menu
Explore
Add Cart
```

แล้ว Login ก่อน Transaction ตาม Business Rule

หาก Guest กลายเป็น Registered Customer:

```text
Guest Session
↓
Customer Account
↓
Merge Context
```

ต้องป้องกันการสร้าง Customer ซ้ำ

---

# 37. APP-LIKE PWA

Bite Me Baby PWA ต้องมี Experience แบบ Mobile App มากที่สุด

ไม่ควรเป็น Website ธรรมดาที่เพียง Responsive

Core Navigation:

```text
HOME
MENU
PRE-ORDER
SAME-DAY
ORDERS
BITE
ACCOUNT
```

รองรับ:

```text
Persistent Session
Fast App Shell
Installable PWA
Manifest
Service Worker
Deep Links
Push Notifications
App-like Navigation
Loading States
Skeleton UI
Offline Awareness
```

---

# 38. PWA SAFETY

Offline Mode ต้องไม่ทำให้เกิด:

```text
Duplicate Order
Duplicate Payment
Duplicate Inventory Deduction
```

Transaction สำคัญต้องได้รับ:

```text
Server Confirmation
```

---

# 39. BITE — AI SERVICE STAFF

> **Bite คือ AI Service Staff ของ Bite Me Baby**

ไม่ใช่เพียง Chatbot

Bite มีบทบาท:

```text
Welcome
Explain Bite Me Baby
Introduce Menu
Recommend Menu
Remember Customer
Answer Questions
Assist Ordering
Track Orders
Explain Status
Follow Up
Support Customer
Generate Content
Analyze Customers
Assist Operations
```

---

# 40. BITE CUSTOMER EXPERIENCE

เมื่อเปิด PWA:

```text
Bite:

"สวัสดีจ๊ะ ❤️
วันนี้อยากกินอะไรดี?"

[เมนูวันนี้]
[สั่งล่วงหน้า]
[ให้ Bite แนะนำ]
[ดูออเดอร์]
```

Bite ต้องรู้ Context:

```text
Current Time
Store Status
Available Menu
Pre-order Menu
Same-day Menu
Capacity
Customer Preferences
Customer History
Current Order
Delivery Status
```

---

# 41. BITE MEMORY

แบ่งเป็น:

### Explicit Memory

สิ่งที่ลูกค้าบอก:

```text
ชอบเผ็ด
ไม่กินผักชี
ชอบกะเพรา
```

### Behavioral Memory

สิ่งที่ระบบเรียนรู้:

```text
ซื้อกะเพราบ่อย
ชอบรอบเย็น
มักสั่ง 2 กล่อง
```

### Transaction Memory

```text
Orders
Payments
Reviews
Loyalty
Coupons
```

Memory ต้องมี Privacy / Retention Policy

---

# 42. AI TRANSACTION AUTHORITY

Bite สามารถ:

```text
Suggest
Parse
Recommend
Explain
Prepare
Request
```

แต่ไม่มีสิทธิ์โดยลำพังในการ:

```text
Change Price
Approve Payment
Refund
Deduct Inventory
Confirm Transaction
Change Delivery Fee
Cancel Order
Change Business Rule
```

หลักการ:

```text
AI
↓
Backend Validation
↓
Business Rule
↓
Authorization
↓
Execute
```

---

# 43. AI PROVIDER ARCHITECTURE

Initial Provider:

> **OpenRouter**

สามารถใช้ Free Models ตามความเหมาะสม

แต่ Core Application ต้องไม่ผูกกับ OpenRouter โดยตรง

Architecture:

```text
Bite AI Service
        ↓
AI Provider Interface
        ↓
OpenRouter Adapter
        ↓
Model
```

Future:

```text
OpenRouter
OpenAI
Anthropic
Google
Local Model
Other Provider
```

สามารถเปลี่ยนได้

API Keys ต้องอยู่ใน Server / Secure Environment

ห้ามอยู่ใน Frontend

---

# 44. AI FAILURE & FALLBACK

หาก AI Provider ล่ม:

```text
AI Failure
↓
Retry
↓
Fallback Model / Provider
↓
Rule-based Service
```

ระบบหลักต้องยัง:

```text
Browse
Order
Payment
Kitchen
Delivery
```

ทำงานได้

AI เป็น Enhancement / Intelligence Layer ไม่ใช่ Single Point of Failure ของ Transaction System

---

# 45. AI CONTENT ENGINE

Bite Me Baby ต้องมี AI สำหรับสร้าง Content Marketing

Input:

```text
Menu
Pre-order Menu
Same-day Menu
Promotion
Capacity
Stock
Availability
Delivery Round
Delivery Area
Customer Segment
Season
Current Time
```

Output:

```text
Facebook Post
Facebook Story
Messenger Content
Future LINE Content
Promotion Copy
Menu Introduction
Campaign Copy
CTA
```

---

# 46. CAPACITY-AWARE CONTENT

AI ห้ามสร้าง Content ที่ขัดกับ Operations จริง

ตัวอย่าง:

```text
Midday = FULL
Evening = 12 slots available
```

AI ต้องไม่โพสต์:

> "รอบเที่ยงยังว่าง"

แต่สามารถโพสต์:

> "รอบเย็นพรุ่งนี้ยังเหลืออีก 12 ที่จ้า ❤️"

Content ต้องสร้างจาก:

```text
Live Operational Data
```

---

# 47. CONTENT → ORDER LOOP

```text
Menu
↓
Availability
↓
Capacity
↓
Promotion
↓
AI Content
↓
Image / Creative
↓
CTA
↓
Deep Link
↓
PWA
↓
Order
```

นี่เป็นหนึ่งใน Closed-loop Systems หลักของ Bite Me Baby

---

# 48. DEEP LINK

Social Content ต้องสามารถส่งลูกค้าเข้า Target Action ได้โดยตรง

ตัวอย่าง:

```text
/menu
/preorder
/sameday
/menu/CK001
/preorder?menu=CK001
/preorder?round=tomorrow-midday
/order?product=CK001&round=tomorrow-midday
```

Query Parameter ไม่ใช่ Business Rule

Backend ต้อง Validate ใหม่ทุกครั้ง

---

# 49. COMMAND CENTER

Admin PWA ต้องเป็น:

> **Cloud Kitchen Command Center**

ไม่ใช่เพียง Admin CRUD

Dashboard ต้องแสดง:

```text
Orders
Kitchen
Capacity
Inventory
Delivery
Drivers
Customers
Payments
Promotion
Content
Automation
AI
Exceptions
```

---

# 50. EXCEPTION CENTER

Admin ต้องเห็นปัญหาที่ต้องจัดการทันที

ตัวอย่าง:

```text
🔴 หมูไม่พอ
🔴 รอบเที่ยงเต็ม
🟠 Order ยังไม่จ่าย
🟠 ยังไม่มี Driver
🔴 External Provider ไม่พร้อม
🟠 Delivery ล่าช้า
🔴 Emergency Close Active
```

ไม่ควรให้ Admin ต้องเปิด 10 หน้าจึงจะรู้ว่าธุรกิจมีปัญหาอะไร

---

# 51. ORDER IMPACT ENGINE

เมื่อเกิดปัญหา:

```text
Ingredient Shortage
Delivery Failure
Capacity Change
Emergency Close
Provider Failure
```

ระบบต้องสามารถวิเคราะห์:

```text
Affected Menus
Affected Orders
Affected Customers
Affected Delivery
Required Actions
```

ตัวอย่าง:

```text
🔴 หมูหมด

Affected:
7 Orders
9 Menu Items
7 Customers

[ดู Orders]
[เปลี่ยน Menu]
[แจ้งลูกค้า]
[Refund]
```

---

# 52. EMERGENCY CLOSE

Admin ต้องสามารถ:

```text
Stop Same-day
Stop Pre-order
Stop Bite Drive
Stop External Delivery
Stop Specific Menu
Stop Specific Round
Close Store
```

พร้อม Reason:

```text
Ingredient Shortage
Heavy Rain
Vehicle Problem
Driver Shortage
Kitchen Problem
Equipment Problem
Owner Emergency
Other
```

ทุก Action ต้อง Audit Log

---

# 53. ADMIN OPERATING MODE

ระบบต้องรองรับ:

```text
NORMAL
LIMITED
EMERGENCY
CLOSED
```

ตัวอย่าง:

```text
NORMAL
รับทุก Order

LIMITED
หยุด Same-day
แต่ยังรับ Pre-order

EMERGENCY
หยุด Delivery
แต่ยังให้ Pickup

CLOSED
หยุดทั้งหมด
```

---

# 54. MANUAL OPERATIONS

Automation ล่มแล้วธุรกิจต้องยังเดินได้

Admin ต้องสามารถ:

```text
Create Manual Order
Confirm Payment
Assign Driver
Update Delivery
Adjust Capacity
Adjust Stock
Change Order Status
Retry Automation
Send Notification
Close Store
Reopen Store
```

แต่ทุก Manual Action ต้องมี:

```text
Who
When
What
Before
After
Reason
```

---

# 55. OPERATIONAL OVERRIDE

Business Configuration:

```text
Default Rule
```

สามารถมี:

```text
Temporary Admin Override
```

ตัวอย่าง:

ปกติ:

```text
Bite Drive ≤ 5 km
```

วันนี้ฝนตก:

```text
Bite Drive ≤ 3 km
```

Override ต้องสามารถกำหนด:

```text
Scope
Start
End
Reason
```

และ Audit ได้

---

# 56. KITCHEN CAPACITY

Capacity ต้องผูกกับ:

```text
Delivery Date
Delivery Round
Order Mode
Kitchen Availability
```

ตัวอย่าง:

```text
Tomorrow Midday
22 / 25
```

เมื่อเต็ม:

```text
ROUND FULL
```

---

# 57. BATCH KITCHEN OPERATIONS

หลัง Cutoff:

```text
ORDER COLLECTION
↓
CUTOFF
↓
FREEZE BATCH
↓
MENU AGGREGATION
↓
INGREDIENT REQUIREMENT
↓
INVENTORY CHECK
↓
PRODUCTION PLAN
```

---

# 58. PRODUCTION PLANNING

Production Plan สามารถแนะนำ:

```text
Orders
Meals
Ingredients
Preparation
Cooking
Packing
Ready Time
```

AI สามารถช่วยวิเคราะห์ / แนะนำ

แต่ Production Commitment ต้องอยู่ภายใต้ Business / Staff Control

---

# 59. INVENTORY

รองรับ:

```text
Ingredients
Recipes
Stock
Stock Movement
Low Stock
Purchase
Reorder
Inventory History
Order Deduction
Adjustment
```

ทุก Stock Movement ต้องตรวจสอบย้อนหลังได้

---

# 60. INVENTORY → ORDER VALIDATION

ระบบต้องป้องกัน:

```text
Stock = 0
```

แต่ยังเปิดขาย Same-day ต่อโดยไม่รู้ตัว

Flow:

```text
Order
↓
Menu
↓
Recipe
↓
Ingredient Requirement
↓
Inventory
↓
Availability
```

---

# 61. ROUTE & DISPATCH PLANNING

```text
READY ORDERS
↓
GROUP BY DELIVERY ROUND
↓
GROUP BY ZONE
↓
GROUP BY DELIVERY METHOD
↓
CALCULATE ROUTE
↓
CALCULATE DISTANCE
↓
CALCULATE ETA
↓
CALCULATE COST
↓
ASSIGN DRIVER / PROVIDER
↓
DISPATCH
```

---

# 62. DELIVERY ROUTES

ระบบต้องรองรับ:

```text
delivery_routes
delivery_route_stops
```

หาก Production Code มีระบบเดิมอยู่แล้ว:

> ต้อง Reuse / Extend / Repair

ไม่สร้างระบบซ้ำ

---

# 63. CUSTOMER TRACKING

ลูกค้าทุก Channel ต้องสามารถติดตามผ่าน Bite Me Baby PWA ได้

```text
Order Confirmed
↓
Kitchen
↓
Ready
↓
Driver Assigned
↓
On the Way
↓
Delivered
```

Source ต้องมาจาก Unified Order / Delivery State

---

# 64. NOTIFICATION CENTER

ลูกค้าต้องมี Notification Center

แยก:

```text
Transactional
Marketing
Bite
Operational
```

ตัวอย่าง:

```text
Order confirmed
Food ready
Driver on the way
Delivered

Bite:
"พรุ่งนี้มีเมนูที่คุณชอบนะ ❤️"
```

---

# 65. LOYALTY

รองรับ:

```text
Points
Coupons
Rewards
Referral
Birthday
Personalized Promotion
```

Eligibility ต้องอยู่ที่ Backend

---

# 66. CUSTOMER INTELLIGENCE

รวม:

```text
Customer
Orders
Menu
Frequency
AOV
Reviews
Delivery Behavior
Promotion Response
Loyalty
Bite Conversations
```

ใช้สำหรับ:

```text
Recommendation
Retention
Segmentation
Promotion
Demand Forecast
Content
Personalization
```

---

# 67. CLOSED-LOOP BUSINESS SYSTEM

```text
CONTENT
↓
ACQUISITION
↓
DEEP LINK
↓
PWA
↓
ORDER
↓
KITCHEN
↓
DELIVERY
↓
CUSTOMER
↓
REVIEW
↓
CUSTOMER DATA
↓
AI
↓
BETTER CONTENT
↓
NEXT ORDER
```

นี่คือ:

> **Closed-loop Cloud Kitchen Intelligence**

---

# 68. IDEMPOTENCY

ต้องป้องกัน:

```text
Duplicate Order
Duplicate Payment
Duplicate Webhook
Duplicate Notification
Duplicate Inventory Deduction
Duplicate Loyalty Transaction
Duplicate Delivery Booking
```

External Events ต้อง Retry ได้อย่างปลอดภัย

---

# 69. EVENT ARCHITECTURE

ตัวอย่าง Event:

```text
order.created
order.confirmed
order.cancelled

payment.pending
payment.paid
payment.failed
payment.refunded

kitchen.preparing
kitchen.ready

delivery.assigned
delivery.picked_up
delivery.in_transit
delivery.delivered
delivery.failed

inventory.low_stock

review.created
loyalty.earned
promotion.redeemed

content.generated
content.published

ai.requested
ai.completed
ai.failed

store.opened
store.closed
store.emergency_closed
```

Event Architecture ต้องไม่สร้าง State Machine ซ้ำ

---

# 70. AUDIT LOG

ต้องบันทึก:

```text
Who
What
When
Before
After
Source
Reason
```

อย่างน้อย:

```text
Order
Payment
Inventory
Delivery
Promotion
Admin
Automation
AI
Store Operations
Emergency Actions
```

AI Log ต้องแยก:

```text
Suggested
Parsed
Recommended
Requested
Executed by System
```

ไม่เรียก AI ว่า Approved หาก AI ไม่มี Authority

---

# 71. AUTOMATION

Make.com / Automation Layer ทำหน้าที่:

```text
Trigger
Orchestrate
Notify
Schedule
Publish
Connect APIs
Process Events
Retry
```

ไม่ใช่:

```text
Database
Order Authority
Payment Authority
Business Rule Authority
```

---

# 72. AUTOMATION SAFETY

ต้องมี:

```text
Retry
Idempotency
Timeout
Error Handling
Logging
Failure Notification
Webhook Verification
```

Automation Failure ต้องไม่ทำให้ Core Order State เสีย

---

# 73. CONTENT AUTOMATION

ระบบต้องสามารถ:

```text
Analyze Availability
↓
Select Content Opportunity
↓
Generate Content
↓
Generate CTA
↓
Generate Deep Link
↓
Human Review / Auto Publish ตาม Policy
↓
Publish
↓
Track Result
```

Content Automation ต้องรู้:

```text
Menu
Capacity
Stock
Store Status
Delivery Availability
Promotion
Customer Segment
```

---

# 74. AI + AUTOMATION AUTHORITY

หลักการ:

```text
AI
↓
Recommendation / Extraction
↓
Backend
↓
Business Rule
↓
Authorization
↓
Execute
```

ไม่มี Automation หรือ AI ใดสามารถ bypass:

```text
Pricing
Payment
Inventory
Capacity
Delivery
Order State
Security
```

---

# 75. SECURITY

Mandatory:

```text
Authentication
Authorization
RLS
Server Validation
Input Validation
Webhook Verification
Payment Verification
Admin Roles
Rate Limiting
Audit Logging
Secure Environment Variables
```

API Keys:

```text
NEVER IN FRONTEND
```

---

# 76. TECHNOLOGY STACK

## Frontend

```text
React
Vite
TypeScript
Tailwind CSS / PostCSS
Zustand
PWA
Service Worker
Manifest
```

## Backend

```text
Supabase
PostgreSQL
Edge Functions
Realtime
RLS
```

## Automation

```text
Make.com
Webhooks
External APIs
Event-driven integrations
```

## AI

```text
Bite AI Service
OpenRouter Initial Provider
Free Model Initial Strategy
Provider Abstraction
Tool Calling
Extraction
Recommendation
Customer Intelligence
Content Generation
```

---

# 77. PROJECT STRUCTURE

```text
Bite Me Baby/
│
├── README.md
├── package.json
├── index.html
├── vite.config.ts
├── tsconfig.json
│
├── public/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── store/
│   ├── hooks/
│   ├── lib/
│   └── types/
│
├── supabase/
│   ├── functions/
│   └── migrations/
│
└── docs/
    ├── EXISTING_SYSTEM_AUDIT.md
    ├── GAP_MAP.md
    ├── DATABASE_SCHEMA.md
    ├── ORDER_STATE_MACHINE.md
    ├── PAYMENT_ARCHITECTURE.md
    ├── DELIVERY_ENGINE.md
    ├── BITE_DRIVE.md
    ├── EXTERNAL_DELIVERY.md
    ├── ROUTE_ENGINE.md
    ├── KITCHEN_CAPACITY.md
    ├── STORE_OPERATING_MODEL.md
    ├── STORE_CLOSING_PLANNER.md
    ├── INVENTORY_SYSTEM.md
    ├── PRODUCTION_PLANNING.md
    ├── AI_SERVICE_STAFF.md
    ├── AI_PROVIDER_ARCHITECTURE.md
    ├── AI_MEMORY.md
    ├── ADMIN_COMMAND_CENTER.md
    ├── EXCEPTION_CENTER.md
    ├── CUSTOMER_IDENTITY.md
    ├── CUSTOMER_INTELLIGENCE.md
    ├── API_CONTRACT.md
    ├── EVENT_ARCHITECTURE.md
    ├── WEBHOOK_ARCHITECTURE.md
    ├── AUTOMATION_ARCHITECTURE.md
    ├── FACEBOOK_INTEGRATION.md
    ├── OMNICHANNEL_ORDERING.md
    ├── CONTENT_AUTOMATION.md
    ├── LOYALTY_PROMOTION.md
    ├── NOTIFICATION_ARCHITECTURE.md
    ├── SECURITY.md
    ├── QA_TEST_PLAN.md
    └── DEPLOYMENT.md
```

---

# 78. DEVELOPMENT DOCUMENTATION GATE

ห้าม AI Developer เริ่ม Implementation ขนาดใหญ่จาก README เพียงอย่างเดียว

ลำดับบังคับ:

```text
README
↓
D0 Existing System Audit
↓
D1 Gap Map
↓
D2 Documentation Build
↓
D3 Cross-document Audit
↓
D4 Implementation Handoff
↓
CODE
```

---

# 79. D0 — EXISTING SYSTEM AUDIT

AI ต้องตรวจ:

```text
Production Code
Database
Migrations
Edge Functions
UI
Components
Services
Authentication
Order System
Delivery
Tracking
Payment
Admin
Inventory
Automation
AI
Integrations
```

เป้าหมาย:

```text
มีจริง
มีแต่เสีย
มีบางส่วน
ไม่มี
ซ้ำ
ขัด Architecture
```

---

# 80. D1 — GAP MAP

ทุก Feature ต้องถูกจัด:

```text
EXISTS
BROKEN
PARTIAL
MISSING
DUPLICATE
CONFLICT
UNKNOWN
```

ห้าม AI สรุปจาก README ว่ามี Feature จริง

---

# 81. D2 — DOCUMENTATION BUILD

หลัง Audit ต้องสร้าง `/docs` ตามความเป็นจริง

เอกสารต้องระบุ:

```text
Current State
Target State
Gap
Dependencies
Business Rules
Database
API
Events
Security
Testing
```

---

# 82. D3 — CROSS-DOCUMENT AUDIT

ตรวจความสอดคล้อง:

```text
Database
↔
Order State
↔
Payment
↔
Delivery
↔
Kitchen
↔
Inventory
↔
API
↔
Events
↔
Automation
↔
AI
↔
Customer
```

ห้ามมีเอกสารสองฉบับกำหนด Rule คนละแบบ

---

# 83. D4 — IMPLEMENTATION HANDOFF

ก่อน Coding ต้องมี:

```text
Approved Architecture
Database Contract
State Machine
API Contract
Event Contract
Integration Contract
Security Contract
QA Plan
Migration Plan
```

แล้วจึงให้ AI Developer Implement

---

# 84. REUSE EXISTING SYSTEMS

ก่อนสร้าง:

```text
Order
Delivery
Tracking
Driver
Inventory
Admin
Authentication
AI
```

ต้องตรวจ Production ก่อน

หากมีอยู่:

```text
Reuse
Repair
Refactor
Extend
```

ไม่ใช่สร้างระบบคู่ขนาน

---

# 85. DEFINITION OF DONE

Feature จะถือว่าเสร็จเมื่อ:

```text
Business Rule Defined
↓
Database Contract
↓
API Contract
↓
State Transition
↓
Error Cases
↓
Security
↓
Tests
↓
Implementation
↓
Integration Test
↓
E2E Test
↓
Production Verification
```

หน้าเว็บแสดงผลได้อย่างเดียว:

> **ไม่ถือว่า Feature เสร็จ**

---

# 86. TESTING

## Unit

```text
Pricing
Promotion
Capacity
Delivery Fee
Distance
Cutoff
State Transition
Inventory
Store Closing
Delivery Eligibility
```

## Integration

```text
Supabase
Edge Functions
Payment
Webhooks
Make
AI Provider
External Delivery
Route Provider
```

## E2E

```text
Acquisition
↓
Deep Link
↓
PWA
↓
Login
↓
Menu
↓
Pre-order / Same-day
↓
Delivery
↓
Payment
↓
Order
↓
Kitchen
↓
Dispatch
↓
Tracking
↓
Delivered
↓
Review
↓
Loyalty
```

ต้องทดสอบ:

```text
Duplicate Order
Duplicate Webhook
Payment Failure
Capacity Full
Inventory Insufficient
Delivery Unavailable
Provider Failure
Driver Failure
Emergency Close
Store Reopen
AI Failure
Automation Failure
```

---

# 87. ROADMAP

## PHASE 0 — FOUNDATION

```text
Customer Identity
Unified Order ID
Order Hub
Order Mode
Delivery Method
Order State
Payment State
Delivery State
Idempotency
Audit Log
Business Configuration
Store Operating Status
```

---

## PHASE 1 — CUSTOMER PWA

```text
App-like PWA
Login
Menu
Pre-order
Same-day
Cart
Checkout
Payment
Address
Delivery Selection
Order Tracking
Bite
Notifications
```

---

## PHASE 2 — CLOUD KITCHEN COMMAND CENTER

```text
Orders
Kitchen
Capacity
Inventory
Production
Delivery
Bite Drive
External Providers
Exceptions
Emergency Close
Manual Operations
Store Closing Planner
```

---

## PHASE 3 — DELIVERY ENGINE

```text
Distance
Route
Cost
Zone
Capacity
Bite Drive
Driver Assignment
Tracking
ETA
External Provider Integration
```

---

## PHASE 4 — AI SERVICE STAFF

```text
Bite
Memory
Recommendation
Order Assistance
Customer Service
Voice Future
Tool Calling
Customer Intelligence
```

---

## PHASE 5 — AI CONTENT & MARKETING

```text
Menu
Capacity
Availability
Promotion
AI Content
CTA
Deep Link
Facebook
Future Channels
Performance Data
```

---

## PHASE 6 — INTELLIGENCE LOOP

```text
Sales
Customer
Menu
Kitchen
Inventory
Delivery
Marketing
Review
Loyalty
        ↓
       AI
        ↓
Recommendations
        ↓
Operations
        ↓
Better Customer Experience
        ↓
More Orders
```

---

# 88. PRIORITY

## P0 — FOUNDATION / LAUNCH CRITICAL

```text
PWA
Login / Customer Identity
Menu
Pre-order
Same-day
Cart
Checkout
Payment
Delivery Eligibility
Delivery Round
Order Hub
Order State
Payment State
Delivery State
Kitchen Capacity
Delivery Capacity
Store Operating Mode
Core Admin
Bite Drive
External Delivery Abstraction
Order Tracking
Bite Core
Security
RLS
Idempotency
Audit Log
Manual Operations
Exception Center
Emergency Close
```

---

## P0.5 — IMMEDIATE OPERATIONAL

```text
Route Calculation
Distance
Delivery Cost
ETA
Route Dashboard
Advanced Delivery Capacity
Store Closing Planner
Order Impact Engine
Capacity-aware Content
Notification Center
```

---

## P1

```text
Full AI Service Staff
AI Memory
Voice
Advanced Chat
AI Menu Recommendation
AI Order Assistance
Inventory
Loyalty
Promotion
Referral
Customer Intelligence
Content Automation
```

---

## P2

```text
Multiple Bite Drive Drivers
Multiple Vehicles
Advanced External Providers
Advanced Route Optimization
Customer Personalization
AI Pre-order Recommendation
Advanced Marketing Automation
```

---

## P3

```text
Demand Forecasting
AI Promotion Intelligence
Advanced Inventory Prediction
Advanced Driver Optimization
Advanced Customer Intelligence
```

---

# 89. SOURCE OF TRUTH HIERARCHY

เมื่อข้อมูลขัดกัน:

```text
1. Production Reality
2. Production Database
3. Production Code
4. Database Migrations / Technical Contracts
5. Approved Architecture Documents
6. README.md
7. Older Documents
8. AI Assumptions
```

หลักการ:

> **README กำหนด Target Architecture แต่ Production Reality กำหนด Current State**

---

# 90. AI DEVELOPMENT RULE

ก่อน Coding:

```text
1. Inspect existing code
2. Inspect database
3. Inspect migrations
4. Inspect existing functions
5. Inspect existing UI
6. Inspect existing integrations
7. Inspect existing automation
8. Identify reusable components
9. Identify conflicts
10. Build documentation
11. Cross-audit documentation
12. Then implement
```

ห้าม:

```text
README says Feature exists
↓
AI assumes it exists
↓
AI builds duplicate
```

ต้องเป็น:

```text
README says Feature exists
↓
Inspect Production
↓
FOUND
↓
Reuse / Repair / Extend

NOT FOUND
↓
Document Gap
↓
Design
↓
Implement
```

---

# 91. CHANGE MANAGEMENT

Business Rule เปลี่ยน:

```text
README
+
Relevant Architecture
+
Database Contract
+
API Contract
+
Tests
```

ต้องถูก Update ตามกัน

ห้ามแก้ Code อย่างเดียว

---

# 92. CURRENT TERMINOLOGY

## ใช้

```text
Cloud Kitchen
Bite Me Baby
Bite Me Baby PWA
Order Hub
Pre-order
Same-day
Pre-order Menu
Same-day Menu
Delivery Date
Delivery Round
Kitchen Capacity
Delivery Capacity
Bite Drive
External Delivery Provider
AI Service Staff "Bite"
Customer Intelligence
Content Automation
Command Center
Exception Center
```

## ห้ามใช้

```text
Crown Kitchen
ร้านอาหารหน้าร้าน
Restaurant POS
AI เป็น Order Authority
AI เป็น Source of Truth
Make.com เป็น Order Database
Facebook เป็น Order Database
Grab เป็น Core Delivery System
Self Delivery เป็น Product Name
```

---

# 93. IMPORTANT DELIVERY TERMINOLOGY

ใช้:

> **Bite Drive**

สำหรับระบบส่งของของ Bite Me Baby

ใช้:

> **External Delivery Provider**

สำหรับบริการไรเดอร์ภายนอกทุกค่าย

เช่น:

```text
Grab
Other Rider Providers
Local Rider
Future Providers
```

Grab ไม่ใช่ชื่อ Architecture

---

# 94. BUSINESS AUTHORITY MODEL

```text
                    HUMAN / ADMIN
                         │
                         ↓
                  COMMAND CENTER
                         │
                         ↓
                  BUSINESS RULES
                         │
              ┌──────────┴──────────┐
              ↓                     ↓
           SYSTEM                  BITE
         EXECUTION             INTELLIGENCE
              ↑                     │
              └─────────────────────┘
```

AI ช่วยคิด

System ตรวจสอบ

Business Rules ตัดสิน

Authorized System จึง Execute

---

# 95. FINAL ARCHITECTURAL PRINCIPLE

Bite Me Baby ต้องสามารถทำงานได้แม้:

```text
AI ล่ม
Make ล่ม
Facebook ล่ม
External Rider ล่ม
Route API ล่ม
```

Core Business ต้องยังสามารถ:

```text
รับ Order
จัดการ Order
จัดการ Kitchen
จัดการ Payment
จัดการ Delivery
จัดการ Customer
```

ผ่าน Manual Operations / Core System ได้

---

# 96. MASTER BUSINESS LOOP

```text
                CONTENT
                   ↓
              ACQUISITION
                   ↓
               DEEP LINK
                   ↓
              BITE ME BABY
                   ↓
        ┌──────────┴──────────┐
        ↓                     ↓
    PRE-ORDER              SAME-DAY
        ↓                     ↓
        └──────────┬──────────┘
                   ↓
                ORDER
                   ↓
               ORDER HUB
                   ↓
                KITCHEN
                   ↓
              PRODUCTION
                   ↓
              DELIVERY
          ┌────────┴────────┐
          ↓                 ↓
      BITE DRIVE        EXTERNAL
                        PROVIDER
          └────────┬────────┘
                   ↓
                CUSTOMER
                   ↓
                REVIEW
                   ↓
                LOYALTY
                   ↓
           CUSTOMER DATA
                   ↓
                 BITE
                   ↓
           INTELLIGENCE
                   ↓
          CONTENT AUTOMATION
                   ↓
               ACQUISITION
```

---

# 97. PROJECT NORTH STAR

Bite Me Baby คือ:

> **Cloud Kitchen Operating Platform + AI Service Staff**

ที่รวม:

```text
Customer
+
Marketing
+
Content
+
Pre-order
+
Same-day
+
Ordering
+
Payment
+
Kitchen
+
Capacity
+
Inventory
+
Production
+
Bite Drive
+
External Delivery
+
Route
+
Cost
+
Tracking
+
Customer Identity
+
Bite Memory
+
Loyalty
+
Automation
+
AI
```

เข้าด้วยกันบน:

> **Unified Order Hub**

และบริหารผ่าน:

> **Cloud Kitchen Command Center**

---

# 98. FINAL DEVELOPMENT COMMAND

README ฉบับนี้เป็น **Master Foundation**

AI Developer ห้ามเริ่มจากการเขียน Code ใหม่ทันที

ให้ดำเนินการตามลำดับ:

```text
README
   ↓
D0 — EXISTING SYSTEM AUDIT
   ↓
D1 — GAP MAP
   ↓
D2 — DOCUMENTATION BUILD
   ↓
D3 — CROSS-DOCUMENT AUDIT
   ↓
D4 — IMPLEMENTATION HANDOFF
   ↓
ONLY THEN
   ↓
IMPLEMENT / REPAIR / REFACTOR EXISTING CODE
```

เป้าหมายไม่ใช่สร้างระบบใหม่ทับของเดิม

แต่คือ:

> **ตรวจของเดิม → เข้าใจของเดิม → รักษาของที่ดี → ซ่อมของที่เสีย → เติมของที่ขาด → รวมระบบที่ซ้ำ → แล้วจึงพัฒนาให้เป็น Bite Me Baby Cloud Kitchen Operating Platform อย่างสมบูรณ์**

---

# 99. FINAL RULE

เมื่อไม่แน่ใจ:

> **ห้ามเดา**

ให้ตรวจ:

```text
Code
Database
Migration
UI
API
Integration
Automation
```

ก่อนเสมอ

เมื่อมีระบบเดิม:

> **Reuse / Repair / Refactor / Extend**

เมื่อไม่มี:

> **Document → Design → Implement**

เมื่อ AI ต้องตัดสินใจ:

> **AI Suggests → Backend Validates → Business Rule Decides → System Executes**

---

# 100. END STATE

Bite Me Baby ไม่ใช่:

```text
Online Menu
```

ไม่ใช่:

```text
Food Ordering Website
```

ไม่ใช่:

```text
Facebook Automation
```

ไม่ใช่:

```text
AI Chatbot
```

แต่คือ:

> **Bite Me Baby Cloud Kitchen Operating Platform**

ที่มี:

> **Bite — AI Service Staff**

และ:

> **Bite Drive — ร้านส่งเอง**

เป็นส่วนหนึ่งของระบบเดียวกัน

พร้อมเชื่อม:

```text
Customer
→
Content
→
Order
→
Kitchen
→
Inventory
→
Production
→
Delivery
→
Tracking
→
Customer Intelligence
→
AI
→
Content
→
Next Order
```

เป็นวงจรเดียว

> **Order once. Operate intelligently. Learn continuously.**

---

# 101. 3D FLOATING VISUAL LAYOUT AND ADMIN IMAGE UPLOAD

> เพิ่มตาม Change Management (#91) เมื่อ 2026-09-14 — รายละเอียดฉบับเต็ม: `docs/COMPONENT_SPEC_UI.md`


## 101.2 3D Floating UI (PWA Home/Menu)

- ภาพอาหารเหลื่อมหลุดจากขอบบนการ์ด (Negative Margin Layering)
- ความลึกด้วย `filter drop-shadow` ซ้อนเลเยอร์ — **ห้าม `box-shadow` บนรูปอาหาร**
- พื้นการ์ด: Glassmorphism / Soft UI

## 101.3 Micro-interactions

```text
Hover/Active ภาพ : group-hover:-translate-y-4 group-hover:scale-105
Active การ์ด     : group-active:scale-[0.99] + เงาฟุ้งกระจาย
```

## 101.4 Business Rules (ผูกกับ #13 LIVE AVAILABILITY ENGINE)

- ปุ่ม "Same-day Order" แสดงเมื่อ `products.is_available = true` ผ่าน Live Availability Engine เท่านั้น
- ปุ่ม "Pre-order" เปิดให้เลือกส่งตาม Delivery Round
- สองปุ่ม = สอง Action + Log แยกกันเด็ดขาด (append-only)
- Props ของคอมโพเนนต์ต้อง Type-safe — ห้ามใช้ `any`

**Bite Me Baby Cloud Kitchen**
**Cloud Kitchen Operating Platform**
