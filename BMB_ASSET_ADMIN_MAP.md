# BMB ASSET ADMIN MAP — คู่มือจัดการ Asset สำหรับ Admin (ภาษาไทย)

ปรับปรุง: 2026-10-02 · อ้างอิง implementation จริงเท่านั้น (ไม่มี assumption)

## หลักการสำคัญ

- Admin **ไม่ต้องเข้า folder ใน repository** (public/, src/assets/) เพื่อเปลี่ยนรูป — ทุกอย่างที่ replaceable เปลี่ยนผ่าน **Admin Command Center** แล้ว runtime จะอ่านค่าใหม่จากฐานข้อมูลทันที **โดยไม่ต้อง deploy ใหม่**
- ตำแหน่งไฟล์ใน repository ที่ระบุด้านล่างเป็นเพียง **"ต้นทางอ้างอิง / ค่า fallback"** เท่านั้น
- ระบบที่ใช้งานได้จริงตอนนี้: **Mascot** (ครบทุก pose), **Brand theme/favicon** (ผ่าน AdminBrands), **รูปสินค้า** (ผ่าน AdminProducts/AdminMedia)

## ตาราง Asset ที่ Admin เปลี่ยนได้จริงตอนนี้

| Asset Key | Asset ปัจจุบัน | ต้นทางอ้างอิง (repo) | ใช้ที่ไหน | Admin เปลี่ยนที่ไหน | Runtime Source | Mock ได้ |
|---|---|---|---|---|---|---|
| `mascot.pose.<role>` (23 ท่า: greeting, heart, thumbsup, running, pointing, peeking, thinking, empty, bye, award, cooking, eating, feedback, menu, ready, recommend, reviewing, shopping, success, vote, waiting, sad, closed) | ภาพ mascot 3D | `public/assets/mascot/*.webp` + `public/mascot_*.webp` (เป็น fallback เมื่อไม่มี override) | UI ทุกจุดที่มี mascot (MascotBadge, BiteMascot) | **หน้า Mascot Settings** (MascotSettingsPage) — เลือก role แล้วใส่ URL รูป + alt | `mascot_overrides.media_url` (DB) → ถ้าไม่มีใช้ fallback static | ได้ (ใส่ URL placeholder ได้ แต่ควรระบุใน alt ว่า mock) |
| `brand.logo_icon` | ไอคอนแบรนด์ (favicon runtime) | `public/favicon.svg` (fallback) | browser tab favicon (BrandProvider ฉีดแบบ dynamic) | **Admin → Brands** (AdminBrands) — กรอก `logo_url_icon` | `brands.logo_url_icon` (DB) | ได้ |
| `brand.theme` | ชุดสี/ฟอนต์แบรนด์ | CSS เดิมในโค้ด (ค่า default ใน BrandProvider) | สี/ฟอนต์ทั้งเว็บผ่าน CSS variables | **Admin → Brands** — แก้ `theme_tokens` (primary/secondary/accent/bg/surface/text/font) | `brands.theme_tokens` (DB) | N/A |
| `product.image.<id>` | รูปสินค้า | — (อยู่ใน Storage แล้ว) | หน้าเมนู/สินค้า | **Admin → Products** (อัปโหลดตรง) หรือ **Admin → Media** | Storage `bmb-images` → `media_assets` → `products.image_url` | ได้ (อัปโหลด placeholder แล้ว replace ทีหลัง) |

**ข้อควรรู้**: ระบบ Brand (theme/favicon/title/OG) ถูกควบคุมด้วย feature flag `VITE_FEATURE_BRAND_ROUTING` — ตอนนี้ยัง OFF ใน production build ค่า default จึงมาจากโค้ด การเปิดใช้เป็น Owner decision

## Asset ที่ **ยังเปลี่ยนผ่าน Admin ไม่ได้** (ต้องรอระบบ Asset Registry)

| Asset | ต้นทางอ้างอิง | ใช้ที่ไหน | สถานะ |
|---|---|---|---|
| OG Image (ภาพตัวอย่างตอน share) | `public/og-image.png` | Facebook/Line/Twitter preview | BUILD-TIME — เปลี่ยนได้เฉพาะแก้ repo + deploy ใหม่ (รอ registry: Owner decision) |
| Hero หน้าแรก | `src/assets/hero.png` | ภาพใหญ่หน้าแรก (bundled เข้า build) | BUILD-TIME ONLY (รอ registry) |
| สติกเกอร์วงกลม | `/Logo_Sticker_Circle.webp` | แถบรีวิวหน้าแรก | STATIC (รอ registry) |
| ไอคอนหมวดเครื่องดื่ม/ขนม | `/images/drinks/*.svg`, `/images/snacks/*.svg` | หน้าเมนู | STATIC (รอ registry) |
| Badge รีวิว Facebook | `/Facebook Logo.webp` | การ์ดรีวิว | SYSTEM — ไม่ต้องเปลี่ยน |

## Asset ที่ **ห้าม** Admin ปล่อยเข้าระบบ Social/Brand โดยเด็ดขาด

| Asset | เหตุผล |
|---|---|
| **QR PromptPay** (`public/assets/Qr Code/BMB_Promptpay_Qr.webp`) | `PAYMENT_CONTROLLED` — เป็น asset ทางการเงิน ตอนนี้ไม่มี code ใดอ้างถึงเลย ห้ามให้ AI/social automation เลือกหรือแก้ไข |

## วิธีเปลี่ยน Mascot (สรุปสั้น)

1. เข้า Admin → Mascot Settings
2. เลือก pose ที่ต้องการ (เช่น greeting)
3. ใส่ URL รูปใหม่ (ควรอัปโหลดไฟล์ผ่าน Admin → Media แล้วคัดลอก public URL มาใช้)
4. บันทึก → runtime ทุกเครื่องใช้รูปใหม่ทันที (ไม่ต้อง deploy)
5. ถ้าเครื่องไหนยังเห็นของเก่า = browser cache ของรูป ให้ refresh/hard-refresh

## วิธีตรวจว่า runtime ใช้ของใหม่แล้ว

1. เปิดเว็บลูกค้า (ไม่ใช่ admin) → ดู mascot/favicon/สี
2. ถ้าเปลี่ยนไม่สำเร็จ: ตรวจว่า URL รูปเปิดได้จริง (เปิด URL ใน tab ใหม่)
3. ระบบ mascot มี fallback อัตโนมัติ — ถ้า URL พังจะกลับไปใช้ภาพในระบบ ไม่มีภาพแตก

## Asset จริงที่ Owner ควรเตรียม (REAL FILE REQUIRED — อิง implementation จริง)

1. **Mascot ตามท่า** — ถ้าต้องการเปลี่ยนจากภาพในระบบ: REAL FILE REQUIRED (อัปโหลดผ่าน Media แล้ว set override)
2. **Brand logo icon** — สำหรับ favicon แบบแบรนด์ (REAL FILE REQUIRED ถ้าจะเปิด brand routing)
3. **OG Image ขนาดมาตรฐาน (~1200×630)** — ตอนนี้เป็นไฟล์ static ในระบบ (REAL FILE REQUIRED เมื่อระบบ registry พร้อม)
4. **รูปสินค้า** — Admin อัปโหลดเองได้แล้ว (ไม่ต้องส่งไฟล์ให้ dev)

ส่วนที่เหลือ (hero, sticker, catalog icons) ยังไม่บังคับให้ส่งไฟล์จริง — รอ Owner decision เรื่อง Asset Registry ก่อน

## สิ่งที่ระบบยังทำไม่ได้ (ตรงไปตรงมา)

- ยังไม่มีหน้า "Brand & Assets" รวมที่แสดงทุก asset พร้อม preview/สถานะ MOCK — รอ Owner อนุมัติ Asset Registry (ทางเลือก A/B) ก่อน
- ยังไม่มีการ runtime-verified แบบ E2E (Test A–J) เพราะต้องมี admin session จริง — สถานะ **NOT VERIFIED** ทุกข้อที่เกี่ยวกับ upload/replace/isolation จริง