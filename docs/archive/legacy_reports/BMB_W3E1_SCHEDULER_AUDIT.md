# BMB_W3E1_SCHEDULER_AUDIT.md
**W3-E-1 — Scheduler Reality Audit · วันที่: 2026-09-27 · AUDIT ONLY (ไม่มี implement) · หลักการ: runtime คือ source of truth ไม่ใช่เอกสาร**

## 1. ข้อเท็จจริงจาก runtime/repo (ไม่ใช่เอกสาร)

| หัวข้อ | ข้อเท็จจริง |
|---|---|
| GitHub Actions | CI เท่านั้น (test/lint/build บน push/PR) — **ไม่มี `schedule:` trigger** |
| External cron (cron-job.org / uptime pinger / wrangler crons) | **ไม่พบ configuration ใด ๆ ใน repo** |
| pg_cron | ไม่ได้ enable ใน production (ไม่มี migration ที่ใช้ `cron.schedule`) |
| ผู้ trigger automation-worker จริง | **manual HTTP + `x-automation-token` เท่านั้น** (probes ของ AI DEV / owner) |

## 2. วัดผล HTTP+token path จริง (production, วันนี้)

| การวัด | ผล |
|---|---|
| Cold-ish call (notification_dispatch, empty window) | **200 · 2,180 ms · succeeded** |
| Warm calls ×3 | **200 · 697–820 ms · succeeded** ทุกครั้ง |
| Concurrency: eventId เดียวยิงพร้อมกัน 3 ตัว | **executed=3, duplicate=0** ← **RACE จริง**: previousExecution check อ่าน audit_logs ก่อน execution แรกเขียน trace → ทั้ง 3 เห็น "ยังไม่มี" → ทำงานซ้ำ |
| Delayed replay (eventId เดิม หลัง 3 วิ) | **duplicate=true** ✓ — idempotency ถูกต้องเมื่อไม่ overlap |

## 3. ประเมินความรุนแรงของ race (ไม่เดา — ตรวจโค้ด+ผล E2E)
- **Side effect ปลอดภัย**: notification ใช้ deterministic id + `ignore-duplicates` → แม้ worker รันซ้ำ 3 ครั้งพร้อมกัน ยังได้ **ONE notification row** (W3-D E2E ข้อ 8 พิสูจน์แล้ว)
- **Audit trace ยัง 1 row**: `auto-exec-<eventId>` + merge-duplicates (last-writer-wins)
- ต้นทุนจริงของ race = **wasted work** (อ่าน feeds/insert ซ้ำ) + สถานะ trace อาจถูก overwrite — ไม่มี data corruption, ไม่มี duplicate notification, ไม่มี order mutation
- สรุป: race = benign ในสถาปัตยกรรมปัจจุบัน · ไม่จำเป็นต้องแก้ก่อนมี scheduler จริง (ถ้าจะแก้: advisory lock / unique claim row — เป็น implementation decision เมื่อ scheduler frequency สูง)

## 4. ปัญหาจริงของ HTTP+token ตาม runtime (ไม่ใช่เรื่อง pg_cron)
- **ปัญหาเดียวที่พิสูจน์ได้: ไม่มีใคร trigger worker อัตโนมัติเลย** → notification_dispatch / stale-pending / low-stock จะทำงานเฉพาะเมื่อมีคนยิง HTTP
- ผลคือ notification latency = เท่ากับความถี่ที่มีคน trigger (manual) — ลูกค้าไม่ได้รับแจ้งเตือนจนกว่าจะมีการ trigger
- ส่วนตัว mechanism เอง (HTTP+token): **เสถียร 200/200, latency < 2.2s, idempotent, secure (JWT+token), 0 secret leak** — ไม่มีหลักฐานว่า mechanism มีปัญหา

## 5. ทางเลือก (รอ OWNER DECISION — ไม่ implement เอง)

| ทางเลือก | ต้นทุน | ข้อดี | ข้อเสีย |
|---|---|---|---|
| **A. External HTTP cron** (เช่น cron-job.org / GitHub Actions `schedule:` เรียก EF ทุก N นาที, token เก็บเป็น secret) | 0 บาท, ไม่แตะ DB | ไม่แตะ Supabase · เปลี่ยนความถี่ได้ง่าย · ตรงกับ architecture เดิม | ต้องพึ่ง third-party uptime · token อยู่นอก Supabase secrets (GH secret / cron service) |
| **B. pg_cron + pg_net ใน Supabase** | DB change (enable extension + cron job) → **ต้อง Owner approval** | native · ไม่พึ่ง third-party | DB change · debug ยากกว่า · Supabase plan constraint |
| **C. ไม่ทำ scheduler** — dispatch เมื่อมีเหตุการณ์บังคับ (owner กด / admin action) | 0 | ง่ายสุด | notification ไม่ real-time |

ความถี่ที่แนะนำให้พิจารณา (ถ้าเลือก trigger): ทุก 5–15 นาที (notification_dispatch + stale-pending) · low-stock ทุก 1–6 ชม. (มี hourly event bucket idempotency รองรับอยู่แล้ว)

## 6. สรุปสำหรับ Owner
- **HTTP+token = ไม่มีปัญหา mechanism จริง** (พิสูจน์ด้วยการวัด)
- **ปัญหาเดียว = ยังไม่มี trigger อัตโนมัติ** → เป็น decision เรื่อง "ความถี่/ความต้องการ latency ของ notification" ไม่ใช่เรื่องเทคนิคบังคับ
- แนะนำทางเลือก A หากต้องการ latency ต่ำโดยไม่แตะ DB (ไม่ขัด HARD RULE — ไม่ใช่ Make.com) · B หากต้องการ all-native
