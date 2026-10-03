-- ============================================
-- BMB migration 110 — G8 automation queue (OPTION A, additive only)
-- Owner decisions locked: G8-D01=A · D03 retry policy · D05 retention 90d
-- Conventions: text ids (migration 004), timestamptz, audit via existing audit_logs pattern.
-- RLS: enabled, NO policies => deny anon/authenticated; service_role bypasses (S2-10).
-- Non-destructive: new objects only.
-- ============================================

create table if not exists public.automation_queue (
  id text primary key,
  job_type text not null,
  worker text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','claimed','running','succeeded','failed','dead')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default now(),
  next_retry_at timestamptz,
  claimed_at timestamptz,
  lease_until timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_queue_attempts_check check (attempt_count >= 0 and max_attempts >= 1)
);

create index if not exists automation_queue_dispatch_idx
  on public.automation_queue (job_type, status, available_at);
create index if not exists automation_queue_lease_idx
  on public.automation_queue (status, lease_until)
  where status in ('claimed','running');

alter table public.automation_queue enable row level security;
revoke all on public.automation_queue from anon, authenticated;

-- S2-03: atomic claim — FOR UPDATE SKIP LOCKED; one winner; lease+attempt assigned atomically
create or replace function public.claim_automation_jobs(
  p_job_type text, p_worker text, p_batch integer default 1, p_lease_minutes integer default 5
) returns setof public.automation_queue
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.automation_queue q
  set status = 'claimed',
      worker = coalesce(nullif(p_worker, ''), q.worker),
      claimed_at = now(),
      lease_until = now() + make_interval(mins => greatest(p_lease_minutes, 1)),
      attempt_count = q.attempt_count + 1,
      started_at = coalesce(q.started_at, now()),
      updated_at = now()
  where q.id in (
    select c.id from public.automation_queue c
    where c.job_type = p_job_type
      and c.status = 'queued'
      and c.available_at <= now()
    order by c.created_at
    limit greatest(p_batch, 1)
    for update skip locked
  )
  returning q.*;
end;
$$;

-- S2-04: stale lease recovery — requeue expired claims, attempt preserved
create or replace function public.requeue_stale_automation_jobs()
returns integer
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update public.automation_queue q
  set status = 'queued',
      available_at = now(),
      last_error = coalesce(q.last_error, 'lease_expired'),
      updated_at = now()
  where q.status in ('claimed','running')
    and q.lease_until is not null and q.lease_until < now()
    and q.attempt_count < q.max_attempts;
  get diagnostics v = row_count;
  update public.automation_queue q
  set status = 'dead', failed_at = now(), last_error = 'lease_expired_exhausted', updated_at = now()
  where q.status in ('claimed','running')
    and q.lease_until is not null and q.lease_until < now()
    and q.attempt_count >= q.max_attempts;
  return v;
end;
$$;

-- S2-05/06: result recording — retryable backoff per G8-D03 (±20% jitter), terminal = dead
create or replace function public.fail_automation_job(
  p_id text, p_error text, p_reason text, p_retryable boolean default true
) returns text
language plpgsql security definer set search_path = public as $$
declare j public.automation_queue; base int; nxt timestamptz;
begin
  select * into j from public.automation_queue where id = p_id for update;
  if not found then return 'NOT_FOUND'; end if;
  if j.status = 'dead' then return 'ALREADY_DEAD'; end if;
  if not p_retryable
     or p_reason in ('auth','malformed_input','schema_violation','safety_rejection','business_rejection','unknown_job')
     or j.attempt_count >= j.max_attempts then
    update public.automation_queue set status='dead', failed_at=now(), last_error=left(p_error,2000),
      failure_reason=case when p_retryable then 'exhausted_retries' else p_reason end, updated_at=now()
    where id = p_id;
    return 'DEAD';
  end if;
  base := case p_reason when 'db_transient' then 30 when 'ai_failure' then 120 else 60 end;
  nxt := now() + make_interval(secs => base * power(2, j.attempt_count - 1) * (0.8 + random() * 0.4));
  update public.automation_queue set status='queued', available_at=nxt, next_retry_at=nxt,
    last_error=left(p_error,2000), failure_reason=p_reason, updated_at=now()
  where id = p_id;
  return 'REQUEUED';
end;
$$;

create or replace function public.complete_automation_job(p_id text)
returns text
language plpgsql security definer set search_path = public as $$
begin
  update public.automation_queue set status='succeeded', completed_at=now(), updated_at=now()
  where id = p_id and status in ('claimed','running');
  if found then return 'SUCCEEDED'; else return 'NOT_CLAIMED'; end if;
end;
$$;

-- S2-07: replay — dead preserved; NEW identity; later invoke via same claim path
create or replace function public.replay_automation_job(p_id text)
returns text
language plpgsql security definer set search_path = public as $$
declare src public.automation_queue; new_id text;
begin
  select * into src from public.automation_queue where id = p_id;
  if not found then return 'NOT_FOUND'; end if;
  if src.status <> 'dead' then return 'NOT_DEAD'; end if;
  new_id := p_id || '-r' || to_char(now(), 'YYYYMMDDTHH24MISS');
  insert into public.automation_queue (id, job_type, worker, payload, status, attempt_count, max_attempts)
  values (new_id, src.job_type, src.worker, src.payload, 'queued', 0, src.max_attempts);
  return new_id;
end;
$$;

revoke all on function public.claim_automation_jobs(text,text,integer,integer),
  public.requeue_stale_automation_jobs(), public.fail_automation_job(text,text,text,boolean),
  public.complete_automation_job(text), public.replay_automation_job(text)
  from anon, authenticated;
grant execute on function public.claim_automation_jobs(text,text,integer,integer),
  public.requeue_stale_automation_jobs(), public.fail_automation_job(text,text,text,boolean),
  public.complete_automation_job(text), public.replay_automation_job(text)
  to service_role;