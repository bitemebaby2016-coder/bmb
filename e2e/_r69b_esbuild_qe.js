const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TOKEN = Deno.env.get("AUTOMATION_TOKEN") || "";
const ALLOWED = {
  notification_dispatch: {
    worker: "automation-worker",
    build: (p) => {
      const lookback = Number(p.lookbackMinutes);
      const limit = Number(p.limit);
      if (!Number.isInteger(lookback) || lookback < 1 || lookback > 1440) return "lookbackMinutes must be integer 1..1440";
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) return "limit must be integer 1..500";
      return { lookbackMinutes: lookback, limit };
    }
  },
  orders_stale_pending: {
    worker: "automation-worker",
    build: (p) => {
      const maxAge = Number(p.maxAgeMinutes);
      if (!Number.isInteger(maxAge) || maxAge < 1 || maxAge > 10080) return "maxAgeMinutes must be integer 1..10080";
      const cancelAfter = p.cancelAfterMinutes === void 0 ? 0 : Number(p.cancelAfterMinutes);
      if (!Number.isInteger(cancelAfter) || cancelAfter < 0 || cancelAfter > 10080) return "cancelAfterMinutes must be integer 0..10080";
      return cancelAfter > 0 ? { maxAgeMinutes: maxAge, cancelAfterMinutes: cancelAfter } : { maxAgeMinutes: maxAge };
    }
  },
  inventory_low_stock: {
    worker: "automation-worker",
    build: (p) => {
      const th = Number(p.stockThreshold);
      if (!Number.isInteger(th) || th < 0 || th > 100) return "stockThreshold must be integer 0..100";
      return { stockThreshold: th };
    }
  },
  // Part C (2026-10-22): เผยแพร่โพสต์การตลาดที่ถึงเวลา (สถานะ scheduled ที่คน
  // อนุมัติแล้วเท่านั้น — บังคับที่ marketing_schedule_post) — จำกัดจำนวนต่อรัน
  marketing_publish: {
    worker: "automation-worker",
    build: (p) => {
      const limit = Number(p.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) return "limit must be integer 1..50";
      return { limit };
    }
  },
  synthetic_selftest: {
    worker: "synthetic-evidence",
    build: () => ({ synthetic: true })
    // fixed shape — nothing caller-controllable
  }
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automation-token",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json"
    }
  });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automation-token",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    });
  }
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const hdr = req.headers.get("x-automation-token") || "";
  if (!TOKEN) return json({ error: "transport not configured (AUTOMATION_TOKEN missing)" }, 500);
  if (!hdr || hdr !== TOKEN) return json({ error: "unauthorized" }, 401);
  if (!SERVICE) return json({ error: "service not configured" }, 500);
  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const job = typeof payload.job === "string" ? payload.job : "";
  const spec = ALLOWED[job];
  if (!spec) return json({ error: "unknown job" }, 400);
  const ref = typeof payload.ref === "string" ? payload.ref : "";
  if (!/^[a-z0-9][a-z0-9-]{3,63}$/.test(ref)) return json({ error: "invalid_ref" }, 400);
  const params = payload.params && typeof payload.params === "object" ? payload.params : {};
  const built = spec.build(params);
  if (typeof built === "string") return json({ error: "invalid_params", detail: built }, 400);
  const id = "sched-" + job + "-" + ref;
  const r = await fetch(SB_URL + "/rest/v1/rpc/enqueue_automation_job", {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_id: id,
      p_job_type: job,
      p_worker: spec.worker,
      p_payload: built,
      p_max_attempts: 3
    })
  });
  if (r.status !== 200) return json({ error: "rpc_failed", status: r.status }, 502);
  const result = await r.text().then((t) => t.replace(/"/g, ""));
  if (result === "ENQUEUED") return json({ ok: true, result: "ENQUEUED", id });
  if (result === "DUPLICATE") return json({ ok: true, result: "DUPLICATE", duplicate: true, id });
  return json({ error: result || "INVALID" }, 400);
});
