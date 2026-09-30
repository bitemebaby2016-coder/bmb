# BMB — OPEN-SHOP DEPENDENCY MATRIX

**สถานะ ณ `df2de9f` · vocabulary: IMPLEMENTED / CONNECTED / DEPLOYED / RUNTIME VERIFIED / DOCUMENTED / MISSING / BLOCKED / DEFERRED** · "Required" = สิ่งที่ต้องปิดก่อนขั้นนั้น (Owner รีวิวได้) · ห้ามอ่านว่า COMPLETE ถ้ายังไม่ RUNTIME VERIFIED

| Area | Status | Required before Software Open | Required before Physical Pilot | Owner Decision |
|---|---|---|---|---|
| Security | CONNECTED (RLS is_admin จริง; บาง policy cmd=ALL-anon ต้อง audit qual) | qual audit + P1-1 race closed เดิมคงอยู่ | TEN-08 RLS (ถ้า multi-store ก่อน pilot) | NO (ทำตาม contract) |
| Commerce | CONNECTED (canonical create_order + payment) | runtime verify ชุดใหม่ (G-phase) | — | NO |
| SAME_DAY | CONNECTED | — | — | NO |
| PRE_ORDER | CONNECTED | CAT-D02 (weekly menu) แนะนำให้ปิดก่อนเปิดรับจริง | — | YES (CAT-D02 เลือกแล้ว = A, implement รอ) |
| Orders | CONNECTED | — | — | NO |
| Kitchen | CONNECTED (054 gate) | — | — | NO |
| Payment | CONNECTED (Stripe เดิม) | reconciliation runbook | TEN-D04 (ถ้าหลาย tenant) | YES (TEN-D04) |
| Dispatch | CONNECTED (3B-2D; deferred gaps: active-status check, reassign stale, auto-reassign) | ปิด deferred gaps หรือ Owner ยอมรับความเสี่ยง | Physical pilot ต้องปิด | YES (ยอมรับหรือแก้) |
| Automation | CONNECTED (pg_cron เดิม) | stale pending/low stock runbook | tenant context ถ้า multi-store | NO |
| Catalog | CONNECTED (CRUD+PWA canonical) | CAT-01 hardening | CAT-01..04 + verify | YES (CAT-D01..05 ตอบแล้ว; implement รอ) |
| Menu Schedule | DEPLOYED/NOT CONNECTED | CAT-D02=A implement | ก่อน PRE_ORDER จริงรายวัน | DONE (A) — รอ implement |
| Media | DEPLOYED/NOT CONNECTED | CAT-D03=B: connect upload | migrate base64 ก่อนเปิดจริงแนะนำ | DONE (B) — รอ implement |
| Add-ons | CONNECTED (JSONB) | CAT-D05=B normalized (แยก gate, risk สูง) | แนะนำปิดก่อน pilot (required/min ถ้า business ต้องการ) | DONE (B) — รอ implement |
| Brand | MISSING (runtime) | WL-01 ต้องปิดก่อน white-label | — | DONE (Q2=B) — รอ TEN-D01/06 |
| Theme | MISSING (runtime) | WL-02 | — | DONE (Q3=A) — รอ |
| Mascot | CONNECTED (single-brand) | WL-04 metadata แนะนำ | — | DONE (Q6=A) — รอ |
| Tenancy | MISSING (contract DOCUMENTED) | **ไม่จำเป็นก่อน Software Open** (BMB = default tenant อยู่ได้) | จำเป็นก่อนเปิดร้านที่ 2 จริง | YES (TEN-D01..D06 PENDING) |
| DR / Backup | MISSING (ตรวจ Supabase Pro/PITR — frozen, DEFERRED) | runbook + backup verify | จำเป็น | YES (เปิดใช้ PITR หรืออื่น — เคย DEFERRED) |
| Physical Delivery | MISSING | ไม่เกี่ยว (G3 gate แยก) | G3 Physical Pilot authorization | DEFERRED ตาม roadmap |

**สรุปบล็อกสำคัญก่อนขั้นต่อไป:** TEN-D01..D06 (owner) → กำหนดลำดับ TEN/WL/CAT implementation · Software Open ไม่บังคับ tenancy (default tenant) · Physical Pilot บังคับ: dispatch deferred gaps, CAT archive/media, DR runbook