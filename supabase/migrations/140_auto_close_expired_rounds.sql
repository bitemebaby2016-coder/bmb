-- ============================================================
-- 140_auto_close_expired_rounds.sql
-- ============================================================
-- Owner policy (approved 2026-10-23): auto-close ตาม cutoff + admin-only
-- manual toggle + audit ทุกครั้ง.
--   * round ที่ cutoff ผ่านไปแล้ว (วันเดียวกันหลัง cutoff หรือวันก่อนหน้า)
--     จะถูกปิดอัตโนมัติ active → closed
--   * เขียน audit ทุกรอบที่ถูกปิด (append_audit_log) — action=settings_change
--   * idempotent: รันซ้ำได้ตลอด (วนเฉพาะ status='active')
--   * ไม่แตะ round ที่ปิดแล้ว/ไม่เปิดย้อนหลังเอง/ไม่แตะออเดอร์/current_count
--   * นโยบาย capacity (approved): เต็มแล้ว = ปิดรับ (ERR_ROUND_FULL คงเดิม)
--     admin แก้ max_capacity ได้ผ่าน AdminRounds (audit แล้วจาก client)
-- Wiring: เรียกจาก client (ensureRoundsForDate / AdminRounds) ก่อน list rounds
--   — server order gate (025/118 ERR_CUTOFF_PASSED) ยังเป็น enforcement จริง
--   ฟังก์ชันนี้ทำหน้าที่ bookkeeping/consistency + audit trail
-- ============================================================

create or replace function public.auto_close_expired_rounds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_now_sec integer := extract(hour from (now() at time zone 'Asia/Bangkok')) * 3600
                     + extract(minute from (now() at time zone 'Asia/Bangkok')) * 60;
  v_closed integer := 0;
  r record;
begin
  for r in
    select id, display_name, scheduled_date, cutoff_time
    from public.delivery_rounds
    where status = 'active'
      and (
        scheduled_date < v_today
        or (
          scheduled_date = v_today
          and cutoff_time is not null
          -- mirror deliveryRoundStatus.ts: ปิดเมื่อ now > cutoff (strict, วินาทีตัดทิ้ง)
          and (extract(hour from cutoff_time) * 3600 + extract(minute from cutoff_time) * 60) < v_now_sec
        )
      )
  loop
    update public.delivery_rounds
    set status = 'closed', updated_at = now()
    where id = r.id and status = 'active';
    begin
      perform public.append_audit_log(
        p_action := 'settings_change',
        p_entity_type := 'delivery_round',
        p_entity_id := r.id,
        p_description := format('auto-close รอบส่ง "%s" (%s) : active → closed (cutoff ผ่านแล้ว)', r.display_name, r.scheduled_date),
        p_metadata := jsonb_build_object('from', 'active', 'to', 'closed', 'reason', 'auto-close-cutoff', 'cutoff_time', r.cutoff_time),
        p_user_email := null
      );
    exception when others then
      -- audit ห้ามพังงานหลัก — แต่ก็ไม่เงียบ: ทิ้ง notice ไว้ใน log
      raise notice 'auto_close_expired_rounds: audit write failed for % (%)', r.id, sqlerrm;
    end;
    v_closed := v_closed + 1;
  end loop;
  return v_closed;
end;
$$;

revoke all on function public.auto_close_expired_rounds() from public, anon;
grant execute on function public.auto_close_expired_rounds() to authenticated, service_role;
