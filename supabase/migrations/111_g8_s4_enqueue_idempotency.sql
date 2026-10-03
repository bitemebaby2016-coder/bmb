-- ============================================
-- BMB migration 111 — G8-S4: trusted enqueue boundary + OD-6 AI timeout (ADDITIVE ONLY)
-- Owner decisions: OD-2 (DB-enforced deterministic uniqueness — no app check-then-insert)
--                  OD-6 (ai_timeout: base 120s, max 2 attempts, jitter ±20%)
-- OD-1: queue stores canonical worker outcome; retry/dead classification happens via
--       fail_automation_job (canonical worker remains authority). No reinterpretation here.
-- No schema change to existing columns. No destructive change to migration 110 objects
-- (fail_automation_job is CREATE OR REPLACE — same signature, superset behavior).
-- ============================================

-- OD-2/S4-01: trusted enqueue boundary.
-- Atomic DB-enforced idempotency: single INSERT ... ON CONFLICT (id) DO NOTHING.
-- Duplicate deterministic identity => DUPLICATE (no second execution identity, never DLQ).
create or replace function public.enqueue_automation_job(
  p_id text, p_job_type text, p_worker text,
  p_payload jsonb default '{}'::jsonb, p_max_attempts integer default 3
) returns text
language plpgsql security definer set search_path = public as $$
declare v_max int := greatest(p_max_attempts, 1);
begin
  if p_id is null or length(trim(p_id)) = 0
     or p_job_type is null or length(trim(p_job_type)) = 0
     or p_worker is null or length(trim(p_worker)) = 0 then
    return 'INVALID';
  end if;
  insert into public.automation_queue
    (id, job_type, worker, payload, status, attempt_count, max_attempts, available_at)
  values
    (trim(p_id), trim(p_job_type), trim(p_worker), coalesce(p_payload, '{}'::jsonb),
     'queued', 0, v_max, now())
  on conflict (id) do nothing;
  if found then return 'ENQUEUED'; else return 'DUPLICATE'; end if;
end;
$$;

-- OD-6/S4-04: fail_automation_job v2 — same signature as migration 110 (superset).
-- ai_timeout: base 120s (not the generic 60s default) AND hard cap 2 attempts.
create or replace function public.fail_automation_job(
  p_id text, p_error text, p_reason text, p_retryable boolean default true
) returns text
language plpgsql security definer set search_path = public as $$
declare j public.automation_queue; base int; nxt timestamptz; eff_max int;
begin
  select * into j from public.automation_queue where id = p_id for update;
  if not found then return 'NOT_FOUND'; end if;
  if j.status = 'dead' then return 'ALREADY_DEAD'; end if;
  -- OD-6: ai_timeout class caps effective attempts at 2 regardless of max_attempts
  eff_max := case when p_reason = 'ai_timeout' then least(j.max_attempts, 2) else j.max_attempts end;
  if not p_retryable
     or p_reason in ('auth','malformed_input','schema_violation','safety_rejection','business_rejection','unknown_job')
     or j.attempt_count >= eff_max then
    update public.automation_queue set status='dead', failed_at=now(), last_error=left(p_error,2000),
      failure_reason=case when p_retryable then 'exhausted_retries' else p_reason end, updated_at=now()
    where id = p_id;
    return 'DEAD';
  end if;
  base := case p_reason when 'db_transient' then 30 when 'ai_failure' then 120 when 'ai_timeout' then 120 else 60 end;
  nxt := now() + make_interval(secs => base * power(2, j.attempt_count - 1) * (0.8 + random() * 0.4));
  update public.automation_queue set status='queued', available_at=nxt, next_retry_at=nxt,
    last_error=left(p_error,2000), failure_reason=p_reason, updated_at=now()
  where id = p_id;
  return 'REQUEUED';
end;
$$;

-- explicit grants: trusted automation only (service_role); anon/authenticated never
revoke all on function public.enqueue_automation_job(text,text,text,jsonb,integer),
  public.fail_automation_job(text,text,text,boolean) from anon, authenticated;
grant execute on function public.enqueue_automation_job(text,text,text,jsonb,integer),
  public.fail_automation_job(text,text,text,boolean) to service_role;