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
const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TOKEN = Deno.env.get("AUTOMATION_TOKEN") || "";
const PUSH_SEND_URL = Deno.env.get("PUSH_SEND_URL") || (SB_URL ? `${SB_URL}/functions/v1/push-send` : "");
function defaultEventId(job) {
  const now = /* @__PURE__ */ new Date();
  const bucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
  return `${job}:${bucket.toISOString()}`;
}
async function rest(key, method, path, body, prefer) {
  const headers = {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  };
  if (prefer) headers["Prefer"] = prefer;
  const r = await fetch(SB_URL + path, {
    method,
    headers,
    body: body === void 0 ? void 0 : JSON.stringify(body)
  });
  const text = await r.text();
  let j = null;
  try {
    j = JSON.parse(text);
  } catch {
  }
  return { status: r.status, j };
}
async function previousExecution(eventId) {
  const q = await rest(
    SERVICE,
    "GET",
    `/rest/v1/audit_logs?action=eq.automation.execution&id=eq.auto-exec-${encodeURIComponent(eventId)}&select=metadata&limit=1`
  );
  const m = q.j?.[0]?.metadata;
  return m || null;
}
async function recordExecution(ctx, status) {
  const row = {
    id: "auto-exec-" + ctx.eventId,
    action: "automation.execution",
    entity_type: "automation",
    entity_id: ctx.job,
    description: `automation ${ctx.job} ${status}`,
    metadata: {
      job: ctx.job,
      event_id: ctx.eventId,
      execution_id: ctx.executionId,
      status,
      results: ctx.results,
      errors: ctx.errors,
      finished_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  };
  await rest(SERVICE, "POST", "/rest/v1/audit_logs", row, "resolution=merge-duplicates");
}
async function notifyOnce(id, title, message, type, opts) {
  const ex = await rest(SERVICE, "GET", `/rest/v1/notifications?id=eq.${encodeURIComponent(id)}&select=id&limit=1`);
  if (ex.status === 200 && Array.isArray(ex.j) && ex.j.length > 0) return "duplicate";
  const ins = await rest(
    SERVICE,
    "POST",
    "/rest/v1/notifications",
    { id, title, message, notification_type: type, is_read: false, customer_id: opts?.customerId ?? null, category: opts?.category ?? "Transactional" },
    "resolution=ignore-duplicates"
  );
  if (ins.status === 201) return "created";
  return "failed:" + ins.status + ":" + JSON.stringify(ins.j).slice(0, 200);
}
async function adminJwt() {
  const email = Deno.env.get("AUTO_CANCEL_ADMIN_EMAIL") || "";
  const password = Deno.env.get("AUTO_CANCEL_ADMIN_PASSWORD") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!email || !password || !anon) return null;
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  return typeof j.access_token === "string" ? j.access_token : null;
}
async function runOrdersStalePending(ctx, p) {
  const maxAge = Math.max(1, Math.min(60 * 24 * 7, p.maxAgeMinutes ?? 120));
  const cutoff = new Date(Date.now() - maxAge * 6e4).toISOString();
  let path = `/rest/v1/orders?select=order_number,customer_name,created_at&status=eq.pending&created_at=lt.${encodeURIComponent(cutoff)}&limit=100`;
  if (p.customerNamePrefix) path += `&customer_name=like.${encodeURIComponent(p.customerNamePrefix + "*")}`;
  const q = await rest(SERVICE, "GET", path);
  if (q.status !== 200) throw new Error("orders read failed: " + q.status);
  const orders = q.j || [];
  const created = [];
  const dup = [];
  for (const o of orders) {
    const r = await notifyOnce(
      "auto-stale-" + o.order_number,
      "\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E04\u0E49\u0E32\u0E07 pending",
      `\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C ${o.order_number} (\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32: ${o.customer_name || "-"}) \u0E22\u0E31\u0E07 pending \u0E19\u0E32\u0E19\u0E40\u0E01\u0E34\u0E19 ${maxAge} \u0E19\u0E32\u0E17\u0E35 \u2014 \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E17\u0E35\u0E48\u0E2B\u0E49\u0E2D\u0E07\u0E04\u0E23\u0E31\u0E27/\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19`,
      "automation"
    );
    (r === "created" ? created : dup).push(o.order_number);
  }
  ctx.results.orders_stale_pending = { found: orders.length, notified: created, already_notified: dup };
  const cancelAfter = Math.floor(p.cancelAfterMinutes ?? 0);
  if (cancelAfter <= 0) return;
  const cancelCutoff = new Date(Date.now() - cancelAfter * 6e4).toISOString();
  const cq = await rest(
    SERVICE,
    "GET",
    `/rest/v1/orders?select=order_number,order_mode,created_at&status=eq.pending&payment_status=eq.pending&payment_method=neq.cash_on_delivery&created_at=lt.${encodeURIComponent(cancelCutoff)}&limit=100`
  );
  if (cq.status !== 200) throw new Error("auto_cancel orders read failed: " + cq.status);
  const candidates = cq.j || [];
  const cancelled = [];
  const blocked = [];
  if (candidates.length > 0) {
    const jwt = await adminJwt();
    if (!jwt) {
      ctx.errors.push("auto_cancel: admin credentials not configured (AUTO_CANCEL_ADMIN_* / SUPABASE_ANON_KEY)");
      ctx.results.auto_cancel = { candidates: candidates.length, cancelled, blocked, configured: false };
      return;
    }
    for (const o of candidates) {
      const r = await fetch(`${SB_URL}/rest/v1/rpc/cancel_order`, {
        method: "POST",
        headers: { apikey: SERVICE, Authorization: "Bearer " + jwt, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_order_number: o.order_number,
          p_reason: `auto-cancel: pending+unpaid > ${cancelAfter} min (R69)`
        })
      });
      const t = await r.text();
      let j = null;
      try {
        j = JSON.parse(t);
      } catch {
      }
      if (r.status === 200 && j && j.ok !== false) {
        cancelled.push(o.order_number);
      } else {
        blocked.push({ order_number: o.order_number, error: `http ${r.status} ${t.slice(0, 200)}` });
        if (r.status === 401 || r.status === 403) ctx.errors.push("auto_cancel auth failed: http " + r.status);
      }
    }
  }
  ctx.results.auto_cancel = { candidates: candidates.length, cancelled, blocked };
}
async function runInventoryLowStock(ctx, p) {
  const th = Math.max(0, Math.min(999, p.stockThreshold ?? 3));
  const q = await rest(SERVICE, "GET", `/rest/v1/products?select=id,name,stock&stock=not.is.null&stock=lt.${th}&limit=100`);
  if (q.status !== 200) throw new Error("products read failed: " + q.status);
  const items = q.j || [];
  const created = [];
  const dup = [];
  for (const it of items) {
    const r = await notifyOnce(
      "auto-stock-" + it.id,
      "\u0E2A\u0E15\u0E4A\u0E2D\u0E01\u0E43\u0E01\u0E25\u0E49\u0E2B\u0E21\u0E14",
      `${it.name} \u0E40\u0E2B\u0E25\u0E37\u0E2D stock ${it.stock} \u0E0A\u0E34\u0E49\u0E19 (\u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32 ${th}) \u2014 \u0E41\u0E08\u0E49\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E2A\u0E15\u0E4A\u0E2D\u0E01 (\u0E04\u0E48\u0E32\u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E25 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48 capacity authority)`,
      "automation"
    );
    (r === "created" ? created : dup).push(it.id);
  }
  ctx.results.inventory_low_stock = { threshold: th, found: items.length, notified: created, already_notified: dup };
}
const ORDER_EVENT_MAP = {
  pending: "ORDER_CREATED",
  confirmed: "ORDER_CONFIRMED",
  preparing: "ORDER_PREPARING",
  ready_for_dispatch: "ORDER_READY",
  dispatched: "ORDER_OUT_FOR_DELIVERY",
  delivered: "ORDER_DELIVERED",
  cancelled: "ORDER_CANCELLED"
  // in_transit / arrived: no approved notification semantic in the Owner command
  // → deliberately skipped (event exists in feed, notification not approved).
};
const DRIVER_EVENT_MAP = {
  assigned: "DRIVER_ASSIGNED",
  accepted: "DRIVER_ACCEPTED",
  picked_up: "DRIVER_PICKED_UP"
  // in_transit / delivered: covered by the ORDER_* feed — same logical fact,
  // a second notification would double-notify (idempotency at fact level).
};
const EVENT_COPY = {
  ORDER_CREATED: { title: "\u0E23\u0E31\u0E1A\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E41\u0E25\u0E49\u0E27", body: (d) => `\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C ${d.orderNumber} \u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27` },
  ORDER_CONFIRMED: { title: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C", body: (d) => `\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C ${d.orderNumber} \u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27` },
  ORDER_PREPARING: { title: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E2D\u0E32\u0E2B\u0E32\u0E23", body: (d) => `\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C ${d.orderNumber} \u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E2D\u0E32\u0E2B\u0E32\u0E23` },
  ORDER_READY: { title: "\u0E2D\u0E32\u0E2B\u0E32\u0E23\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E41\u0E25\u0E49\u0E27", body: (d) => `\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C ${d.orderNumber} \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2A\u0E48\u0E07/\u0E23\u0E31\u0E1A\u0E41\u0E25\u0E49\u0E27` },
  ORDER_OUT_FOR_DELIVERY: { title: "\u0E2D\u0E2D\u0E01\u0E2A\u0E48\u0E07\u0E41\u0E25\u0E49\u0E27", body: (d) => `\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C ${d.orderNumber} \u0E2D\u0E2D\u0E01\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E41\u0E25\u0E49\u0E27` },
  ORDER_DELIVERED: { title: "\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08", body: (d) => `\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C ${d.orderNumber} \u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23` },
  ORDER_CANCELLED: { title: "\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E16\u0E39\u0E01\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01", body: (d) => `\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C ${d.orderNumber} \u0E16\u0E39\u0E01\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01` },
  DRIVER_ASSIGNED: { title: "\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07: \u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E44\u0E23\u0E40\u0E14\u0E2D\u0E23\u0E4C", body: (d) => `\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C ${d.orderNumber} \u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E44\u0E23\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E41\u0E25\u0E49\u0E27` },
  DRIVER_ACCEPTED: { title: "\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07: \u0E44\u0E23\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E23\u0E31\u0E1A\u0E07\u0E32\u0E19", body: (d) => `\u0E44\u0E23\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E23\u0E31\u0E1A\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C ${d.orderNumber} \u0E41\u0E25\u0E49\u0E27` },
  DRIVER_PICKED_UP: { title: "\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07: \u0E23\u0E31\u0E1A\u0E02\u0E2D\u0E07\u0E41\u0E25\u0E49\u0E27", body: (d) => `\u0E44\u0E23\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E23\u0E31\u0E1A\u0E2D\u0E32\u0E2B\u0E32\u0E23\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C ${d.orderNumber} \u0E41\u0E25\u0E49\u0E27` }
};
async function runNotificationDispatch(ctx, p) {
  const lookback = Math.max(1, Math.min(60 * 24, p.lookbackMinutes ?? 60));
  const limit = Math.max(1, Math.min(500, p.limit ?? 200));
  const cutoff = new Date(Date.now() - lookback * 6e4).toISOString();
  const events = [];
  let orderEventsScanned = 0;
  let driverEventsScanned = 0;
  const oshPath = `/rest/v1/order_status_history?select=order_number,to_status&changed_at=gte.${encodeURIComponent(cutoff)}&order=changed_at.desc&limit=${limit}`;
  const osh = await rest(SERVICE, "GET", oshPath);
  if (osh.status !== 200) throw new Error("order_status_history read failed: " + osh.status);
  for (const h of osh.j || []) {
    orderEventsScanned++;
    const mapped = ORDER_EVENT_MAP[h.to_status];
    if (!mapped) continue;
    events.push({ id: `evt-ord-${h.order_number}-${h.to_status}`, orderNumber: h.order_number, eventType: mapped });
  }
  const daPath = `/rest/v1/delivery_assignments?select=id,order_number,status,driver_id,assigned_at,rider_pushed_at&updated_at=gte.${encodeURIComponent(cutoff)}&status=in.(assigned,accepted,picked_up)&order=updated_at.desc&limit=${limit}`;
  const da = await rest(SERVICE, "GET", daPath);
  if (da.status !== 200) {
    ctx.errors.push("delivery_assignments read failed: " + da.status);
  } else {
    for (const a of da.j || []) {
      driverEventsScanned++;
      const mapped = DRIVER_EVENT_MAP[a.status];
      if (!mapped) continue;
      events.push({ id: `evt-drv-${a.order_number}-${a.status}`, orderNumber: a.order_number, eventType: mapped });
    }
  }
  if (events.length === 0) {
    ctx.results.notification_dispatch = { window_minutes: lookback, order_events: orderEventsScanned, driver_events: driverEventsScanned, created: [], duplicate: [], skipped: 0, suppressed: 0 };
    return;
  }
  const numbers = [...new Set(events.map((e) => e.orderNumber))];
  let ordPath = `/rest/v1/orders?select=order_number,customer_id,customer_name&order_number=in.(${numbers.map(encodeURIComponent).join(",")})`;
  if (p.customerNamePrefix) ordPath += `&customer_name=like.${encodeURIComponent(p.customerNamePrefix + "*")}`;
  const ords = await rest(SERVICE, "GET", ordPath);
  if (ords.status !== 200) throw new Error("orders read failed: " + ords.status);
  const byOrder = /* @__PURE__ */ new Map();
  for (const o of ords.j || []) byOrder.set(o.order_number, o);
  const userUuids = [...new Set([...byOrder.values()].map((o) => o.customer_id).filter((c) => !!c))];
  const userToCustomer = /* @__PURE__ */ new Map();
  if (userUuids.length > 0) {
    const custPath = `/rest/v1/customers?select=id,user_id&user_id=in.(${userUuids.map(encodeURIComponent).join(",")})`;
    const cres = await rest(SERVICE, "GET", custPath);
    if (cres.status !== 200) throw new Error("customers read failed: " + cres.status);
    for (const c of cres.j || []) {
      if (c.user_id) userToCustomer.set(c.user_id, c.id);
    }
  }
  const customerIds = [.../* @__PURE__ */ new Set([...userToCustomer.values()])];
  const suppressed = /* @__PURE__ */ new Set();
  if (customerIds.length > 0) {
    const prefPath = `/rest/v1/notification_prefs?customer_id=in.(${customerIds.map(encodeURIComponent).join(",")})&select=customer_id,channels`;
    const prefs = await rest(SERVICE, "GET", prefPath);
    if (prefs.status === 200) {
      for (const pr of prefs.j || []) {
        if (pr.channels && pr.channels.Transactional === false) suppressed.add(pr.customer_id);
      }
    } else ctx.errors.push("notification_prefs read failed: " + prefs.status);
  }
  const created = [];
  const duplicate = [];
  let skipped = 0;
  let suppressedCount = 0;
  for (const e of events) {
    const o = byOrder.get(e.orderNumber);
    const recipient = o && o.customer_id ? userToCustomer.get(o.customer_id) : void 0;
    if (!o || !recipient) {
      skipped++;
      continue;
    }
    if (suppressed.has(recipient)) {
      suppressedCount++;
      continue;
    }
    const copy = EVENT_COPY[e.eventType];
    const r = await notifyOnce(e.id, copy.title, copy.body({ orderNumber: e.orderNumber }), e.eventType, {
      customerId: recipient,
      category: "Transactional"
    });
    if (r.startsWith("failed:")) ctx.errors.push(`notify ${e.id}: ${r}`);
    else ;
    (r === "created" ? created : duplicate).push(e.id);
  }
  if (PUSH_SEND_URL) {
    const pushed = [];
    let pushErrors = 0;
    for (const eventId of created) {
      const e = events.find((x) => x.id === eventId);
      const o = e ? byOrder.get(e.orderNumber) : void 0;
      const recipient = o && o.customer_id ? userToCustomer.get(o.customer_id) : void 0;
      if (!e || !recipient) continue;
      const copy = EVENT_COPY[e.eventType];
      try {
        const res = await fetch(PUSH_SEND_URL, {
          method: "POST",
          headers: {
            apikey: SERVICE,
            Authorization: "Bearer " + SERVICE,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            customerId: recipient,
            title: copy.title,
            body: copy.body({ orderNumber: e.orderNumber }),
            url: "/notifications",
            tag: `bmb-${e.orderNumber}`,
            notificationId: eventId
          })
        });
        if (res.ok) pushed.push(eventId);
        else {
          pushErrors++;
          if (pushErrors <= 3) ctx.errors.push(`push-send ${eventId}: HTTP ${res.status}`);
        }
      } catch (err) {
        pushErrors++;
        if (pushErrors <= 3) ctx.errors.push(`push-send ${eventId}: ${err?.message ?? "fetch failed"}`);
      }
    }
    ctx.results.notification_push = { attempted: created.length, pushed: pushed.length, errors: pushErrors };
  }
  if (PUSH_SEND_URL) {
    const riderRows = (da.j || []).filter(
      (a) => a.driver_id && !a.rider_pushed_at && (da.j || []).some((x) => x.order_number === a.order_number && x.status === "assigned")
    );
    let riderPushed = 0;
    let riderErrors = 0;
    for (const a of riderRows) {
      try {
        const res = await fetch(PUSH_SEND_URL, {
          method: "POST",
          headers: {
            apikey: SERVICE,
            Authorization: "Bearer " + SERVICE,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            driverId: a.driver_id,
            title: "\u{1F6F5} \u0E21\u0E35\u0E07\u0E32\u0E19\u0E43\u0E2B\u0E21\u0E48",
            body: `\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C ${a.order_number} \u0E21\u0E2D\u0E1A\u0E2B\u0E21\u0E32\u0E22\u0E43\u0E2B\u0E49\u0E04\u0E38\u0E13 \u2014 \u0E40\u0E1B\u0E34\u0E14\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E23\u0E31\u0E1A\u0E07\u0E32\u0E19`,
            url: "/rider",
            tag: `bmb-rider-${a.order_number}`
          })
        });
        if (res.ok) {
          riderPushed++;
          await rest(
            SERVICE,
            "PATCH",
            `/rest/v1/delivery_assignments?id=eq.${encodeURIComponent(a.id)}&rider_pushed_at=is.null`,
            { rider_pushed_at: (/* @__PURE__ */ new Date()).toISOString() }
          );
        } else {
          riderErrors++;
          if (riderErrors <= 3) ctx.errors.push(`rider-push ${a.order_number}: HTTP ${res.status}`);
        }
      } catch (err) {
        riderErrors++;
        if (riderErrors <= 3) ctx.errors.push(`rider-push ${a.order_number}: ${err?.message ?? "fetch failed"}`);
      }
    }
    ctx.results.rider_push = { attempted: riderRows.length, pushed: riderPushed, errors: riderErrors };
  }
  if (PUSH_SEND_URL) {
    let offerPushed = 0;
    let offerErrors = 0;
    const offRes = await rest(
      SERVICE,
      "GET",
      `/rest/v1/dispatch_offers?select=id,order_number&status=eq.offered&rider_pushed_at=is.null&updated_at=gte.${encodeURIComponent(cutoff)}&order=updated_at.desc&limit=${limit}`
    );
    if (offRes.status !== 200) {
      ctx.errors.push("dispatch_offers read failed: " + offRes.status);
    } else {
      const drvRes = await rest(SERVICE, "GET", "/rest/v1/drivers?select=id&user_id=not.is.null");
      const driverIds = drvRes.status === 200 ? (drvRes.j || []).map((d) => d.id) : [];
      if (drvRes.status !== 200) ctx.errors.push("drivers read failed: " + drvRes.status);
      for (const o of offRes.j || []) {
        for (const dId of driverIds) {
          try {
            const res = await fetch(PUSH_SEND_URL, {
              method: "POST",
              headers: {
                apikey: SERVICE,
                Authorization: "Bearer " + SERVICE,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                driverId: dId,
                title: "\u{1F4E3} \u0E07\u0E32\u0E19\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E43\u0E2B\u0E21\u0E48 \u2014 \u0E43\u0E04\u0E23\u0E23\u0E31\u0E1A\u0E01\u0E48\u0E2D\u0E19\u0E44\u0E14\u0E49\u0E01\u0E48\u0E2D\u0E19",
                body: `\u0E07\u0E32\u0E19\u0E2A\u0E48\u0E07 ${o.order_number} \u0E40\u0E1B\u0E34\u0E14\u0E43\u0E2B\u0E49\u0E23\u0E31\u0E1A \u2014 \u0E01\u0E14\u0E23\u0E31\u0E1A\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E19 \u0E44\u0E14\u0E49\u0E07\u0E32\u0E19\u0E44\u0E1B`,
                url: "/rider",
                tag: `bmb-offer-${o.order_number}`
              })
            });
            if (res.ok) offerPushed++;
            else {
              offerErrors++;
              if (offerErrors <= 3) ctx.errors.push(`offer-push ${o.order_number}/${dId}: HTTP ${res.status}`);
            }
          } catch (err) {
            offerErrors++;
            if (offerErrors <= 3) ctx.errors.push(`offer-push ${o.order_number}: ${err?.message ?? "fetch failed"}`);
          }
        }
        if (driverIds.length > 0) {
          await rest(
            SERVICE,
            "PATCH",
            `/rest/v1/dispatch_offers?id=eq.${encodeURIComponent(o.id)}&rider_pushed_at=is.null`,
            { rider_pushed_at: (/* @__PURE__ */ new Date()).toISOString() }
          );
        }
      }
    }
    ctx.results.offer_broadcast = { pushed: offerPushed, errors: offerErrors };
  }
  ctx.results.notification_dispatch = {
    window_minutes: lookback,
    order_events: orderEventsScanned,
    driver_events: driverEventsScanned,
    created,
    duplicate,
    skipped,
    suppressed: suppressedCount
  };
}
async function runMarketingPublish(ctx, p) {
  const limit = Math.min(Math.max(Number(p.limit) || 10, 1), 50);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const due = await rest(
    SERVICE,
    "GET",
    `/rest/v1/marketing_posts?select=id,status,approval_id,image_urls,publish_attempts&or=(status.eq.scheduled,and(status.eq.published,provider_post_id.is.null))&scheduled_for=lte.${encodeURIComponent(nowIso)}&order=scheduled_for.asc&limit=${limit}`
  );
  if (due.status !== 200) {
    ctx.errors.push("marketing_posts read failed: " + due.status);
    return;
  }
  const rows = due.j || [];
  let published = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.approval_id) {
      skipped++;
      if (row.status === "scheduled") {
        await rest(SERVICE, "PATCH", `/rest/v1/marketing_posts?id=eq.${encodeURIComponent(row.id)}`, {
          status: "failed",
          error: "ERR_APPROVAL_REQUIRED",
          publish_attempts: row.publish_attempts + 1,
          updated_at: nowIso
        });
      }
      continue;
    }
    const ap = await rest(SERVICE, "GET", `/rest/v1/content_approvals?select=status&id=eq.${encodeURIComponent(row.approval_id)}`);
    const apStatus = ap.status === 200 && Array.isArray(ap.j) && ap.j.length > 0 ? ap.j[0].status : null;
    if (apStatus !== "approved") {
      skipped++;
      if (row.status === "scheduled") {
        await rest(SERVICE, "PATCH", `/rest/v1/marketing_posts?id=eq.${encodeURIComponent(row.id)}`, {
          status: "failed",
          error: "ERR_APPROVAL_REQUIRED:" + (apStatus || "missing"),
          publish_attempts: row.publish_attempts + 1,
          updated_at: nowIso
        });
      }
      continue;
    }
    try {
      const res = await fetch(`${SB_URL}/functions/v1/social-publish-worker`, {
        method: "POST",
        headers: {
          apikey: SERVICE,
          Authorization: "Bearer " + SERVICE,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ approvalId: row.approval_id, imageUrls: row.image_urls || [] })
      });
      const j = await res.json().catch(() => ({}));
      const meta = j.meta;
      if (res.ok && j.ok) {
        published++;
        await rest(SERVICE, "PATCH", `/rest/v1/marketing_posts?id=eq.${encodeURIComponent(row.id)}`, {
          status: "published",
          provider_post_id: meta?.post_id || null,
          published_at: (/* @__PURE__ */ new Date()).toISOString(),
          error: null,
          publish_attempts: row.publish_attempts + 1,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      } else {
        failed++;
        await rest(SERVICE, "PATCH", `/rest/v1/marketing_posts?id=eq.${encodeURIComponent(row.id)}`, {
          error: String(j.detail || j.error || "HTTP " + res.status).slice(0, 500),
          publish_attempts: row.publish_attempts + 1,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        if (failed <= 3) ctx.errors.push(`marketing-publish ${row.id}: HTTP ${res.status}`);
      }
    } catch (err) {
      failed++;
      await rest(SERVICE, "PATCH", `/rest/v1/marketing_posts?id=eq.${encodeURIComponent(row.id)}`, {
        error: String(err instanceof Error ? err.message : err).slice(0, 500),
        publish_attempts: row.publish_attempts + 1,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (failed <= 3) ctx.errors.push(`marketing-publish ${row.id}: ${err instanceof Error ? err.message : "fetch failed"}`);
    }
  }
  ctx.results.marketing_publish = { scanned: rows.length, published, failed, skipped };
  try {
    const pr = await fetch(`${SB_URL}/functions/v1/social-publish-worker`, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "poll_comments" }),
      signal: AbortSignal.timeout(9e4)
    });
    const pj = await pr.json().catch(() => ({}));
    ctx.results.comment_poll = pj;
    if (!pr.ok) ctx.errors.push("comment_poll http " + pr.status);
    try {
      await rest(SERVICE, "POST", "/rest/v1/audit_logs", {
        id: "g26-poll-" + (/* @__PURE__ */ new Date()).toISOString().slice(0, 13),
        action: "social.comment_poll",
        entity_type: "marketing_post",
        entity_id: "poll",
        description: "comment poll: " + JSON.stringify(pj).slice(0, 400),
        metadata: pj
      });
    } catch {
    }
  } catch (err) {
    ctx.errors.push("comment_poll: " + String(err instanceof Error ? err.message : err).slice(0, 150));
  }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const hdr = req.headers.get("x-automation-token") || "";
  if (!TOKEN) return json({ error: "automation not configured (AUTOMATION_TOKEN missing)" }, 500);
  if (hdr !== TOKEN) return json({ error: "unauthorized" }, 401);
  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const job = payload.job || "";
  if (!["orders_stale_pending", "inventory_low_stock", "notification_dispatch", "marketing_publish"].includes(job)) return json({ error: "unknown job" }, 400);
  const eventId = payload.eventId || defaultEventId(job);
  const prev = await previousExecution(eventId);
  if (prev && prev.status === "succeeded") {
    return json({ duplicate: true, event_id: eventId, previous_execution_id: prev.execution_id || null });
  }
  const ctx = {
    eventId,
    executionId: crypto.randomUUID(),
    job,
    results: {},
    errors: []
  };
  try {
    if (job === "orders_stale_pending") await runOrdersStalePending(ctx, payload);
    else if (job === "notification_dispatch") await runNotificationDispatch(ctx, payload);
    else if (job === "marketing_publish") await runMarketingPublish(ctx, payload);
    else await runInventoryLowStock(ctx, payload);
  } catch (e) {
    ctx.errors.push(String(e && e instanceof Error ? e.message : e));
  }
  const status = ctx.errors.length === 0 ? "succeeded" : Object.keys(ctx.results).length ? "partial" : "failed";
  await recordExecution(ctx, status);
  return json({ event_id: eventId, execution_id: ctx.executionId, status, results: ctx.results, errors: ctx.errors });
});
