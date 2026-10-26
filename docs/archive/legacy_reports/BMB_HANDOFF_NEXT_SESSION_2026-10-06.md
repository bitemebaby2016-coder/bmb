# BMB HANDOFF — เซสชันถัดไป (2026-10-06 หลังรอบ 6)

> อ่านก่อนเริ่มทำอะไรทุกครั้ง · ตัวตนต่อจากเซสชัน backup+admin-audit (HEAD `12640ab` @ `origin/main`)
> Master status อยู่ที่ `BMB_PRODUCTION_MASTER_STATUS.md` (§14 คือ changelog จริง — อัปเดตทุกรอบ)

## 1. กฎการทำงาน (ห้ามลืม — จาก BMB_G9_CONTRACT.md §2 spine + กติกาสะสม)

1. **HARD STOP รอ Owner** ทุกงานที่ต้องใช้ Owner input: SMS key, Stripe live, push device จริง, Asset Registry, brand routing flag — ห้ามทำแทน Owner
2. **Production mutation ต้องมี Owner อนุมัติเป็นลายลักษณ์** ก่อนรัน (write ลง prod DB, deploy EF, rotate secret)
3. **Gates ก่อน commit เสมอ:** `npx tsc --noEmit` = 0 · `npm run lint` = 0 · `npm test -- --run` = 527+/527+ · `npm run build` = exit 0
4. **Commit + push `origin/main` ทุกจบงาน** — ห้ามปล่อย worktree ค้าง; รายงาน commit hash ใน changelog ด้วย
5. **อ่านสถานะก่อนเสมอ** — งานที่เคย DONE ห้ามทำซ้ำ/reimplement (เช็ค §14 ก่อนเริ่ม)
6. **ห้ามแตะ containers ของ selfprint-v3-react** (Supabase local stack รันอยู่บนเครื่องนี้) — งาน DB ใช้ temp container จากภายนอกเท่านั้น
7. **Secrets/passwords ห้าม print/commit** — `.dbpw.tmp` ลบทิ้งหลังใช้ · `backups/` gitignored (มีข้อมูลลูกค้า)
8. แก้ prod DB: ผ่าน migration + `supabase db push` (**ประวัติ reconcile แล้ว 117/117 — push ปกติได้, อย่ากด --include-all**)
9. Edge Function deploy ต้อง verify runtime จริง (probe) ก่อนขึ้นสถานะ DONE
10. `.env.local` มี `SUPABASE_ACCESS_TOKEN` **ซ้ำ 2 บรรทัด** — script ต้องลอง token ย้อนหลัง (reverse) ใช้ตัวแรกที่ HTTP 200

## 2. สถานะ ณ ปิดเซสชัน

**DONE ล่าสุด:**
- **BACKUP WORKING** (รอบ 5): rotate+dump ได้จริง — `node e2e\dbBackup.cjs` (rotate password → set secret `BMB_DB_PASSWORD`) แล้ว `e2e\dbDump.cmd` (pg_dump ผ่าน temp `postgres:17-alpine` → `backups/`, ไฟล์จริง 3 × 4.67 MB) · ⚠️ secret เก่า `SUPABASE_DB_URL` = platform-managed ลบไม่ได้ ค่าเป็น password เก่า **ห้ามใช้ — ใช้ `BMB_DB_PASSWORD`** · rotate password ต้องรัน dbBackup.cjs ทั้งรอบเสมอ (rotate+set คู่กัน)
- **ADMIN AUDIT** (รอบ 6): 28 หน้า admin ครบ · แก้ 3 routes หาย (pre-orders/kitchen/recipes) — commit `12640ab`
- ก่อนหน้า (รอบ 3–4): G4 CLOSED (simulated 9/9) · W-1.6 secrets clean · migration history 117/117 · `sms-send` EF deployed+verified · หน้าแรกโชว์หมวด admin-added เสมอ
- Gates ล่าสุด: **TSC 0 / LINT 0 / VITEST 527/527 / BUILD 0**

## 3. ค้างรอ Owner (HARD STOP — ทำต่อได้ทันทีเมื่อของมา)

| รายการ | รออะไร | ทำอะไรต่อเมื่อได้ |
|---|---|---|
| Stripe LIVE | account review ผ่าน (2–3 วัน) | live webhook + acceptance ตาม pattern เดิม |
| SMS จริง | `SMS_PROVIDER/SMS_API_URL/SMS_API_KEY` | set secrets → probe ส่งจริง → ปิด W-2.3 |
| Push เครื่องจริง | Owner ทดสอบ device | ยืนยัน subscription → ปิด |
| ไรเดอร์ภายนอก | Grab/LINE MAN API key | connect adapter (sandbox พร้อม) |
| Asset Registry | Owner decision (A/B) | ทำหน้า Brand & Assets + เปลี่ยน OG/hero/สติกเกอร์/ไอคอนหมวดผ่าน admin ได้ |
| Brand routing flag | Owner decision | เปิด `VITE_FEATURE_BRAND_ROUTING` |
| E2E admin session (Test A–J) | Owner ให้ admin login จริง | verify upload/replace/isolation บน prod |
| Backup ตามรอบ | Owner เลือกความถี่ | แนะนำสัปดาห์ละครั้ง (Free plan ไม่มี auto backup) |

## 4. งานถัดไปที่ทำได้โดยไม่ติด Owner

- **G10 True Production Closure** (ตาม BMB_G9_CONTRACT.md §2 spine + W-4.4): ประกอบ closure checklist · รัน verification ที่ไม่ต้องใช้ Owner input · ผลิต `BMB_G10_FINAL_REPORT.md` ตาม report pattern เดิม (gates TSC/LINT/VITEST/BUILD · probes · flags LOGIC/DB/MIGRATION/SECURITY/PRODUCTION MUTATION) · **HARD STOP รอ Owner sign-off**
- จุดเริ่มที่ค้างจากเซสชันก่อน: G10 ยังไม่ได้เริ่มจริง — เซสชันนี้ใช้เวลาไปกับ backup + admin audit

## 5. ข้อมูลอ้างอิงเร็ว

- Repo: `D:\A PROJECT\Bite Me Baby` (mirror: `...\workspaces\chat\bmb`) · branch `main`
- Supabase ref: `ivkdfognyiwjcmrhcnwz` · API `api.supabase.com/v1/projects/<ref>` — `/database/query` ตอบ **201**; secrets API **ห้ามชื่อขึ้นต้น `SUPABASE_`** (POST อาร์เรย์ `{name,value}` ได้, DELETE ไม่ได้ถ้า platform-managed)
- DB ผ่าน pooler: `aws-0-ap-northeast-2.pooler.supabase.com:6543` user `postgres.ivkdfognyiwjcmrhcnwz` (password อยู่ใน secret `BMB_DB_PASSWORD` — อ่านผ่าน `GET /secrets` ได้ อย่า print)
- Docker ใช้: `docker run --rm -v "${PWD}\backups:/backup" -e PGPASSWORD=<pw> postgres:17-alpine pg_dump …` (server = PG17.6)
- คู่มือแอดมิน: `docs/03_ADMIN_USER_GUIDE.md` · asset map: `BMB_ASSET_ADMIN_MAP.md`
- ⚠️ ไฟล์ untracked ค้าง: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `openapi-paths.txt` — ยังไม่ตัดสินใจ (Docker deploy ไม่เกี่ยวกับ BMB prod = Cloudflare Pages)

## 6. เปิดเซสชันใหม่ด้วยข้อความนี้

"อ่าน BMB_HANDOFF_NEXT_SESSION_2026-10-06.md ใน repo ก่อน — ทำงานต่อจากสถานะล่าสุดใน BMB_PRODUCTION_MASTER_STATUS.md §14 ตามกฎทุกข้อ อย่าทำซ้ำของที่ DONE"