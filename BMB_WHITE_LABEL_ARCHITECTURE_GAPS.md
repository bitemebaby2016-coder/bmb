# BMB — WHITE-LABEL ARCHITECTURE GAPS

อ้างหลัก: `BMB_WHITE_LABEL_READINESS_AUDIT.md` (เอกสารเดียวกัน commit) — ไฟล์นี้สรุปเฉพาะ gap เชิงสถาปัตยกรรมที่ต้อง Owner decision ก่อน implement

| GAP | พื้นที่ | สภาพปัจจุบัน | ผลถ้า implement โดยไม่ตัดสิน | Decision |
|---|---|---|---|---|
| GAP-W1 | Tenancy | ไม่มี tenant/store/brand id ในทั้ง 37 ตาราง; single-store ทั้ง order spine | ใส่ brand โดยไม่มี model → เสี่ยงต้องรื้อ + order spine ต้อง migrate ซ้ำ | **Q1** |
| GAP-W2 | Brand runtime config | brand = build static (index.html/manifest/seo.ts) | ทำ WL-01 แบบเดา → อาจเกิด brand source ชุดที่สอง | **Q2 (+Q5)** |
| GAP-W3 | Theme config | tokens อยู่ใน index.css | เปิด Admin แก้ CSS arbitrary → PWA แตกได้ | **Q3** (แนะนำ controlled tokens + fallback + validation) |
| GAP-W4 | Static mockup catalog | drinksMenu/snacksMenu แสดงบน HomePage (display-only) | ทิ้งไว้ = customer content อยู่ใน code (ขัดหลัก canonical) | **Q4** |
| GAP-W5 | Mascot ownership | mascot_overrides มีแค่ role_name/media_url/alt | เพิ่ม metadata แบบไม่เลือกที่อยู่ → ระบบ media ซ้ำซ้อน | **Q6** |
| GAP-W6 | PWA build-time surfaces | manifest/favicon/icon เปลี่ยนต้อง deploy | อ้าง runtime white-label เกินจริง | **Q5** (ระบุข้อจำกัดชัด) |
| GAP-W7 | Media storage ไม่ถูกใช้ | bucket ว่าง, upload 0 callers, รูป = base64 ใน DB | WL-03 ผูกกับ CAT-D03 ต้องตัดสินก่อน | **CAT-D03** |
| GAP-W8 | Catalog structure/archive/add-on/menu-schedule | ดู CATALOG AUDIT (GAP-C1..C8) | CAT-01 ต้องรอ decisions เดิม | **CAT-D01..D05** |

**ข้อสรุป:** ไม่มี conflict กับ canonical order spine (server pricing/snapshot/RLS คงอยู่ได้ทุกแผน) แต่ มี architecture decision ที่ห้ามเลี่ยง = tenancy (GAP-W1) และ brand storage (GAP-W2) → จึง STOP รอ Owner ตาม §24/§31 ของ directive
