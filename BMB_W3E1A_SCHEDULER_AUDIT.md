# BMB_W3E1A_SCHEDULER_AUDIT.md
**W3-E-1A — External Scheduler Implementation Audit · วันที่: 2026-09-27 · REPORT ONLY (ยังไม่ implement) · Decision A = EXTERNAL HTTP SCHEDULER (อนุมัติโดย Owner)**

## Option A candidates ที่ตรวจจริง

1. **GitHub Actions scheduled workflow** — repo จริง: `bitemebaby2016-coder/bmb` · **visibility = PUBLIC** (GitHub API ยืนยัน) · default branch = `main` · active (pushed วันนี้) · มี workflow CI อยู่แล้ว (`.github/workflows/` — push/PR เท่านั้น, ยังไม่มี schedule)
2. **External cron provider** (cron-job.org ฯลฯ) — ไม่มี account/infrastructure อยู่เดิม
3. **Existing infrastructure อื่น** — Cloudflare Pages (hosting เท่านั้น ไม่มี cron), Supabase (pg_cron = ตัดตาม Owner decision B)

## Selected candidate (เสนอ): GitHub Actions scheduled workflow
Reason: ใช้ repository infrastructure ที่มีอยู่ · repo public → Actions **ไม่มีค่า billing minutes** · ไม่เพิ่ม third-party service · ไม่แตะ DB · ตรง architecture A ที่ Owner อนุมัติ

## ตรวจรายการที่ Owner กำหนด (ตามเอกสาร GitHub + repo จริง)

| หัวข้อ | ผล |
|---|---|
| Schedule capability | cron granularity — 5 นาทีได้ · **runs เฉพาะ default branch (main) — ตรงกับ repo** |
| Reliability | **BEST-EFFORT เท่านั้น** — เอกสาร GitHub ยืนยันว่า schedule สามารถ **delay ช่วง load สูง** (โดยเฉพาะใกล้ top-of-hour) · จึงไม่ควรประกาศ "exact 5-minute SLA" · ปิดอัตโนมัติถ้า repo ไม่ active 60 วัน (repo active ทุกวัน — ความเสี่ยงต่ำ) |
| Authentication | HTTPS + `x-automation-token` (mechanism RUNTIME VERIFIED แล้วใน E-1) |
| Secret storage | **GitHub repository secret** (`AUTOMATION_TOKEN`) — ไม่อยู่ใน source/YAML · public repo: secrets masked ใน logs โดยอัตโนมัติ |
| Secret rotation | rotate ใน 2 ที่: `supabase secrets set AUTOMATION_TOKEN=<ใหม่>` + แก้ GitHub repo secret — Owner ทำเอง ไม่ผ่าน chat |
| Failure visibility | workflow run history (Actions tab) + บังคับ job fail ถ้า worker ตอบ `status != succeeded` → run แดง = operator เห็น |
| Retry | workflow-level: re-run ปลอดภัย (worker idempotent — E-1 พิสูจน์ delayed replay duplicate=true) |
| Concurrency | `concurrency: group: bmb-automation` (queue, ไม่ cancel) → กัน overlap → ลด race ที่พบใน E-1 ที่ระดับ scheduler โดยไม่แก้ schema |
| Cost | **0** (public repo) |
| Rate limits | Actions: ไม่มีปัญหาที่ 288 runs/day (~60 วิ/รัน, curl-only) |
| Operational dependency | GitHub uptime (third-party) — ถ้า Actions ล่ม → notification หน่วง ไม่ทำข้อมูลเสีย |

## Schedule (ตาม Owner direction, พิสูจน์ runtime แล้วว่าเหมาะสม)
- ทุก 5 นาที: `notification_dispatch` + `orders_stale_pending` (eventId = per-run → dispatch pass ทำงานทุกครั้ง, dedupe อยู่ที่ notification row)
- ทุก 1 ชม.: `inventory_low_stock` (default hourly event bucket รองรับ)
- **ไม่เพิ่ม frequency** — 5 นาทีคือค่าที่ Owner กำหนด; ถ้าพบ delay จาก GitHub load ให้ประเมินตอน runtime evidence จริง

## Files/config affected
- ใหม่: `.github/workflows/automation-scheduler.yml` (cron `*/5` + hourly job + `workflow_dispatch` สำหรับ manual test)
- Owner action: ใส่ `AUTOMATION_TOKEN` ลง GitHub repo secrets (การ copy secret ที่มีอยู่ ไม่ใช่ credential ใหม่)
- Schema affected: **NONE** · Migration required: **NONE**

## Security findings
- Token จะไม่ถูก echo ใน workflow (`curl -sS -H "Authorization: Bearer ${{ secrets.AUTOMATION_TOKEN }}"` — GitHub mask ค่าใน log อัตโนมัติ) · ไม่มี token ใน git history (scan แล้ว CLEAN) · worker ฝั่ง Supabase ไม่เปลี่ยน
- git history / workflow YAML / repo: ไม่มี secret (ยืนยันด้วย scan)

## Runtime findings
- HTTP+token: 200/200, cold 2.18s / warm <1s, delayed-replay idempotent (E-1)
- Race ยังคงอยู่ (ยึดตาม report เดิม — ไม่เปลี่ยนเป็น "no race") — `concurrency` ของ workflow ลดโอกาสได้โดยไม่แก้ schema; optimization ถาวร (advisory lock) เสนอแยก ไม่บล็อก scheduler

## สถานะ
```
IMPLEMENTED      = รอ (workflow file ยังไม่สร้าง — checkpoint นี้ REPORT ONLY)
CONNECTED        = MISSING (ต้องรอ Owner ใส่ AUTOMATION_TOKEN ลง repo secrets)
DEPLOYED         = N/A (workflow deploy = commit+push)
RUNTIME VERIFIED = รอ (manual workflow_dispatch test หลัง secret พร้อม + schedule observation)
MISSING          = GitHub repo secret AUTOMATION_TOKEN (Owner action)
BLOCKED          = ไม่มี (ไม่มี paid provider / new account / schema)
DEFERRED         = ไม่มี
```

## OWNER DECISION REQUIRED
1. อนุมัติให้ implement `.github/workflows/automation-scheduler.yml` (candidate ที่เสนอ) — หลังจากนั้น implement + runtime test ได้ทันทีไม่ต้อง gate เพิ่ม (ตาม §8: ไม่มี dependency ใหม่)
2. Owner action: ใส่ `AUTOMATION_TOKEN` ลง GitHub → Settings → Secrets and variables → Actions (ค่าเดียวกับ Supabase secret ปัจจุบัน — Owner paste เอง)

## RECOMMENDED IMPLEMENTATION
GitHub Actions scheduled workflow (single workflow, 2 schedule tiers, concurrency queue, fail-visible, workflow_dispatch สำหรับทดสอบ) + Owner ใส่ repo secret → runtime test (§9) → W3-E-1 Scheduler Gate

========================================
HARD STOP — รอ Owner อนุมัติ implement ตามข้างบน
========================================
