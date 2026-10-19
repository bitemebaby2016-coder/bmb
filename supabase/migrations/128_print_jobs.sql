-- ============================================================
-- Bite Me Baby — Migration 128: PRINT JOBS (Receipt + Kitchen Ticket)
-- Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
--
-- Print state machine (states kept DISTINCT per Owner requirement):
--   requested = print requested (job enqueued, nothing proven)
--   sent = job handed to browser/printer bridge (NOT proof of printing)
--   acknowledged = printer/OS accepted the job (NOT proof of paper)
--   printed = operator/bridge confirmed physical print
--   failed = any step failed (retryable -> back to requested)
-- Physical print is NEVER claimed without an explicit 'printed' mark.
--
-- Auto-print wiring: orders INSERT -> receipt job; status -> confirmed ->
-- kitchen_ticket job. Duplicate jobs impossible: deterministic job id per
-- (order, type) with ON CONFLICT DO NOTHING.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.print_jobs (
  id            TEXT PRIMARY KEY,
  order_number  TEXT NOT NULL,
  job_type      TEXT NOT NULL CHECK (job_type IN ('receipt', 'kitchen_ticket')),
  status        TEXT NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested', 'sent', 'acknowledged', 'printed', 'failed')),
  printer_id    TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  requested_by  TEXT,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  printed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_order ON public.print_jobs (order_number);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON public.print_jobs (status, job_type);

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS print_jobs_admin_all ON public.print_jobs;
CREATE POLICY print_jobs_admin_all ON public.print_jobs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
-- staff policy added in 129 (is_staff created there)

-- ---------- enqueue (idempotent) ----------
CREATE OR REPLACE FUNCTION public.enqueue_print_job(
  p_order_number text,
  p_job_type text,
  p_printer_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_uid uuid := auth.uid();
  v_row public.print_jobs%ROWTYPE;
BEGIN
  IF p_job_type NOT IN ('receipt', 'kitchen_ticket') THEN
    RAISE EXCEPTION 'ERR_INVALID_PRINT_JOB_TYPE';
  END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = p_order_number) THEN
    RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND';
  END IF;

  v_id := 'pj-' || p_order_number || '-' || p_job_type;
  INSERT INTO public.print_jobs (id, order_number, job_type, printer_id, requested_by)
  VALUES (v_id, p_order_number, p_job_type, NULLIF(trim(COALESCE(p_printer_id, '')), ''), v_uid::text)
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_row FROM public.print_jobs WHERE id = v_id;
  RETURN jsonb_build_object(
    'ok', true, 'id', v_row.id, 'status', v_row.status,
    'created_at', v_row.requested_at
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enqueue_print_job FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_print_job TO authenticated, service_role;

-- ---------- status transitions ----------
CREATE OR REPLACE FUNCTION public.mark_print_job(
  p_job_id text,
  p_status text,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.print_jobs%ROWTYPE;
  v_ok boolean := false;
BEGIN
  IF NOT public.is_admin() THEN
    -- staff allowed via is_staff() (created in 129); guard keeps anon/customer out
    IF NOT COALESCE(public.is_staff(), false) THEN
      RAISE EXCEPTION 'ERR_FORBIDDEN';
    END IF;
  END IF;
  IF p_status NOT IN ('requested', 'sent', 'acknowledged', 'printed', 'failed') THEN
    RAISE EXCEPTION 'ERR_INVALID_PRINT_STATUS';
  END IF;

  SELECT * INTO v_row FROM public.print_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_PRINT_JOB_NOT_FOUND'; END IF;

  IF v_row.status = p_status THEN
    v_ok := true;
  ELSE
    v_ok :=
      (v_row.status = 'requested'    AND p_status IN ('sent', 'acknowledged', 'printed', 'failed')) OR
      (v_row.status = 'sent'         AND p_status IN ('acknowledged', 'printed', 'failed')) OR
      (v_row.status = 'acknowledged' AND p_status IN ('printed', 'failed')) OR
      (v_row.status = 'failed'       AND p_status = 'requested');
  END IF;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'ERR_INVALID_PRINT_TRANSITION: % -> %', v_row.status, p_status;
  END IF;

  UPDATE public.print_jobs
     SET status = p_status,
         attempts = attempts + CASE WHEN p_status = 'requested' AND v_row.status = 'failed' THEN 1
                                    WHEN v_row.status = 'requested' THEN 1 ELSE 0 END,
         last_error = CASE WHEN p_status = 'failed' THEN COALESCE(p_error, last_error) ELSE NULL END,
         printed_at = CASE WHEN p_status = 'printed' THEN NOW() ELSE printed_at END,
         updated_at = NOW()
   WHERE id = p_job_id;

  PERFORM public.append_audit_log(
    p_action := 'print_job_status',
    p_entity_type := 'print_job',
    p_entity_id := p_job_id,
    p_description := 'print job ' || v_row.status || ' -> ' || p_status
                     || ' (state only - physical print not implied)',
    p_metadata := jsonb_build_object('from', v_row.status, 'to', p_status,
                                     'order_number', v_row.order_number,
                                     'job_type', v_row.job_type,
                                     'error', p_error)
  );

  SELECT * INTO v_row FROM public.print_jobs WHERE id = p_job_id;
  RETURN jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status,
                            'attempts', v_row.attempts, 'printed_at', v_row.printed_at);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_print_job FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_print_job TO authenticated, service_role;

-- ---------- auto-enqueue triggers ----------
CREATE OR REPLACE FUNCTION public.trg_orders_print_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_print_job(NEW.order_number, 'receipt');
    RETURN NEW;
  END IF;
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
    PERFORM public.enqueue_print_job(NEW.order_number, 'kitchen_ticket');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_print_enqueue_ins ON public.orders;
CREATE TRIGGER trg_orders_print_enqueue_ins
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_print_enqueue();

DROP TRIGGER IF EXISTS trg_orders_print_enqueue_upd ON public.orders;
CREATE TRIGGER trg_orders_print_enqueue_upd
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_print_enqueue();

-- ========== CONTRACT NOTES (128) ==========
-- * print failure can NEVER fail an order creation path by itself: triggers only
--   INSERT a print_jobs row (deterministic id, ON CONFLICT DO NOTHING).
-- * print_jobs is the audit surface: requested/sent/acknowledged/printed/failed
--   are recorded states, never inferred.
