# BMB_DR_RUNBOOK.md
**BMB Disaster Recovery Runbook · วันที่: 2026-09-27 · ห้ามใส่ค่า secret จริง — ระบุเฉพาะชื่อ/ตำแหน่ง/วิธี reconfigure**

> **STATUS**: Draft v1 — *ยังไม่ TESTED end-to-end* (restore verification รอ Owner เปิด backup + test project)
> ห้ามอ้างว่า DR tested จนกว่าจะผ่าน verification checklist จริง

---

## A. DATABASE RECOVERY

### สถานะปัจจุบัน (VERIFIED @ 48b1cf8 + หลังจากนั้น)
- Automated backup: **ไม่มี** (Management API: backups=[], PITR off) — Owner ต้องเปิดก่อน
- เมื่อเปิดแล้ว (Pro plan): Daily backups คงอยู่ 7 วัน · PITR (add-on) ครอบคลุมถึงระดับนาที

### Recovery point selection
| ต้องการกู้ถึง | กลไก |
|---|---|
| จุดใด ๆ ภายในช่วง PITR retention | PITR restore (dashboard: Database → Backups → PITR) — **ต้องเปิด add-on** |
| จุดตาม daily snapshot (ไม่เกิน 7 วัน) | Daily backup restore (dashboard) |

### Restore procedure (ห้าม restore-over-production)
1. Dashboard → Project Settings → Database → Backups
2. เลือก backup/PITR timestamp → **Restore to NEW project** (หรือ restore ลง existing non-prod) — ห้ามกด restore บน production ยกเว้นเหตุฉุกเฉินที่ Owner อนุมัติชัดเจน
3. รอ restore complete → บันทึก duration

### Restore verification (หลัง restore เสร็จ)
- `BMB_W3E3_BACKUP_DR_AUDIT.md` §test plan: เทียบ 49 migrations · row counts (orders/osh/order_items/delivery_assignments/customers/channel_identities/notifications/audit_logs) · ยิง F-18 probe เทียบ · ยิง contracts_*.sql
- บันทึก: actual recovery result + ช่องว่างที่พบ

---

## B. APPLICATION RECOVERY

| ขั้น | วิธี | แหล่งหลักฐาน |
|---|---|---|
| Git repository | clone `bitemebaby2016-coder/bmb` (commit/tag ล่าสุดที่ production ใช้) | GitHub |
| Migrations | `supabase db push` หรือ `e2e/prodApplyMigrations.cjs` (49 migrations 001–049) | repo |
| Edge Functions | `npx supabase functions deploy <slug> --project-ref ivkdfognyiwjcmrhcnwz` ทีละตัว: create-checkout, stripe-webhook, stripe-refund, phone-auto-login, ai-proxy, automation-worker, channel-webhook | repo (16 folders; 7 deployed จริง) |
| PWA/Admin | build + deploy ตาม Cloudflare pipeline ปกติ | repo |
| Deployment sequence | DB migrations → secrets → Edge Functions → frontend → scheduler workflow verification | ลำดับนี้ |

---

## C. SECRETS RECOVERY (ชื่อ/ตำแหน่งเท่านั้น — ไม่มีค่า)

| Secret | Source of Truth | Reconfiguration Method | Access |
|---|---|---|---|
| SUPABASE_SERVICE_ROLE_KEY | Supabase (Platform) | Dashboard → Settings → API / CLI auto | Owner |
| SUPABASE_URL / ANON (publishable) | Supabase (Platform) | Dashboard → Settings → API | Owner |
| SUPABASE_DB_URL | Supabase (Platform) | Dashboard → Settings → Database (reset DB password ได้) | Owner |
| AUTOMATION_TOKEN | local `supabase/secrets.local.env` (gitignored) + Supabase secrets | regenerate ค่าใหม่ → `supabase secrets set AUTOMATION_TOKEN` → อัปเดต GitHub repo secret (Actions) | Owner |
| CHANNEL_WEBHOOK_APP_SECRET / CHANNEL_WEBHOOK_VERIFY_TOKEN | local + Meta App config | กำหนดค่าใหม่ → `supabase secrets set` → ตั้งเหมือนกันใน Meta App webhook config (FROZEN จนกว่าจะ resume Meta) | Owner |
| STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET | Stripe Dashboard | สร้าง/rotated key → `supabase secrets set` → update webhook endpoint secret ใน Stripe | Owner |
| OPENROUTER_API_KEY | OpenRouter Dashboard | สร้าง key → `supabase secrets set OPENROUTER_API_KEY` | Owner |
| BMB_TEST_* (admin/customer/driver passwords) | local secrets.local.env | re-enter ผ่าน auth admin API ตาม wave2Setup.cjs | Owner |
| GitHub Actions: AUTOMATION_TOKEN | GitHub repo secrets | ต้องมีค่าเดียวกับ Supabase secret — Owner paste ใน Settings → Secrets and variables → Actions | Owner |

**หลักการ**: ถ้าเครื่องหาย → secrets.local.env หาย → Owner ต้อง re-enter จาก provider dashboards ทั้งหมด (จึงต้องมีรายการนี้)

---

## D. SCHEDULER RECOVERY
1. Workflow `automation-scheduler.yml` อยู่ใน repo (default branch) — schedule ทำงานอัตโนมัติเมื่อ push
2. `AUTOMATION_TOKEN` repo secret (GitHub) ต้องตรงกับ Supabase secret — ดู C
3. Worker calls ต้องแนบ `x-automation-token` + `apikey` (publishable key — public ตาม design)
4. Manual test: Actions → automation-scheduler → Run workflow (job: all|dispatch|stale|stock)
5. Verify: Actions run history (green) + audit_logs `auto-exec-gh-*` traces + notifications effect

## E. EXTERNAL DEPENDENCIES (FROZEN — reconfigure หลัง DR เท่านั้น)
- **Payment (Stripe)**: webhook endpoint + secret ต้อง re-setup
- **Meta (FB/Messenger)**: App/Page/webhook config ฝั่ง Meta ต้อง re-setup (currently DEFERRED)
- **Email / SMS / LINE / Web Push**: ไม่มี integration ปัจจุบัน — FROZEN

## F. POST-RECOVERY VERIFICATION CHECKLIST
- [ ] Database reachable + row counts ตรง snapshot (orders/osh/order_items/delivery_assignments/customers/channel_identities/notifications/audit_logs)
- [ ] RLS: F-18 probe ผ่าน 15/15 + anon write ถูกปฏิเสธ (401/403)
- [ ] Functions: `supabase functions list` ครบ 7 ตัว + channel-webhook GET → 403 (correct rejection)
- [ ] Auth: login ทดสอบได้ (qa accounts) · transition_order_status RPC ทำงาน
- [ ] Order creation: `create_order_with_items` (TEST DATA ONLY) สำเร็จ + history row ถูกสร้าง
- [ ] Order state: transition pending→confirmed → order_status_history + notifications ถูกสร้างตาม deterministic id
- [ ] Automation: `notification_dispatch` + `orders_stale_pending` + `inventory_low_stock` รัน succeeded
- [ ] Scheduler: Actions run เขียว + traces ล่าสุด succeeded
- [ ] Notifications: customer อ่าน own rows ได้ (RLS) · admin อ่านได้
- [ ] Admin: dashboard/orders/audit-log/errors/notifications โหลดได้
- [ ] Audit logs: append_audit_log ทำงาน · execution traces ปรากฏ

**หมายเหตุ**: runbook นี้ยังไม่ได้ทดสอบจริง end-to-end — ห้ามประกาศ DR tested จนกว่าจะผ่าน restore verification (W3-E-3 step 3)