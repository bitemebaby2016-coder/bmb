// ============================================
// Bite Me Baby — Edge Function: social-publish-worker (G4/G9 publish path)
//
// Owner-approved NEW capability (2026-10-05: "ทำให้จบรวม meta เลย"). This is
// the FIRST Meta write path in the codebase — G7's draft boundary (D-G7-A)
// stays untouched and unchanged.
//
// Purpose: PUBLISH an APPROVED draft to the Facebook Page feed.
//   internal invocation (x-automation-token, same as the other workers)
//   → content_approvals row (content_type='post', status='approved')
//   → Graph API POST /{page_id}/feed with message=body
//     (META_PAGE_ACCESS_TOKEN — Edge Function secret only)
//   → idempotent by draft id: replay returns the same result, never posts twice
//   → records the outcome on the approval row (published / publish_failed)
//
// Hard boundaries (unchanged from G7):
//   - NOT an approval path: it refuses anything not already 'approved'
//   - NO business mutation (orders/payment/inventory/delivery/price/capacity)
//   - NO scheduler/queue (G8 owns orchestration)
//   - secrets never echoed: logs carry draft_ref/status only
//
// Env (supabase secrets set ...):
//   META_PAGE_ACCESS_TOKEN, META_PAGE_ID (optional — falls back to /me),
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUTOMATION_TOKEN
// ============================================

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const TOKEN = Deno.env.get('AUTOMATION_TOKEN') || ''
const PAGE_TOKEN = Deno.env.get('META_PAGE_ACCESS_TOKEN') || ''
const PAGE_ID = Deno.env.get('META_PAGE_ID') || ''

const GRAPH = 'https://graph.facebook.com/v21.0'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-automation-token',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json',
    },
  })
}

/** Constant-time token compare (same pattern as automation-worker). */
function tokenMatches(provided: string): boolean {
  if (!TOKEN) return false
  if (provided.length !== TOKEN.length) return false
  let diff = 0
  for (let i = 0; i < TOKEN.length; i++) diff |= provided.charCodeAt(i) ^ TOKEN.charCodeAt(i)
  return diff === 0
}

async function rest(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' }
  const r = await fetch(SB_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  let j: any = null
  try { j = JSON.parse(text) } catch { /* empty */ }
  return { status: r.status, j }
}

/** Publish an APPROVED post draft to the Page feed — idempotent by draft id. */
async function publishDraft(approvalId: string) {
  // 1) the approval row must be an APPROVED post (never pending/rejected)
  const rowRes = await rest('GET', `/rest/v1/content_approvals?id=eq.${encodeURIComponent(approvalId)}&select=id,title,body,status,content_type`)
  if (rowRes.status !== 200 || !Array.isArray(rowRes.j) || rowRes.j.length === 0) {
    return { ok: false, error: 'ERR_APPROVAL_NOT_FOUND', http: 404 }
  }
  const row = rowRes.j[0]
  if (row.content_type !== 'post') {
    return { ok: false, error: 'ERR_NOT_A_POST', http: 400 }
  }
  if (row.status !== 'approved') {
    // G7 boundary intact: APPROVED ≠ PUBLISHED, but publishing a PENDING/REJECTED
    // draft is forbidden — replay of an already published draft is handled below.
    return { ok: false, error: 'ERR_APPROVAL_NOT_PENDING', http: 409 }
  }

  // 2) idempotency: audit_logs PK g9-publish-<approval_id> is written only on
  //    the first successful publish — a replay short-circuits here.
  const prev = await rest('GET', `/rest/v1/audit_logs?id=eq.g9-publish-${encodeURIComponent(approvalId)}&select=id,metadata&limit=1`)
  if (prev.status === 200 && Array.isArray(prev.j) && prev.j.length > 0) {
    return { ok: true, already: true, meta: prev.j[0].metadata }
  }

  if (!PAGE_TOKEN) return { ok: false, error: 'ERR_NO_PAGE_TOKEN', http: 503 }

  // 3) resolve the Page (META_PAGE_ID wins; else /me on the page token)
  const pageRes = await fetch(`${GRAPH}/${PAGE_ID || 'me'}?fields=id,name`, {
    headers: { Authorization: 'Bearer ' + PAGE_TOKEN },
  })
  const pageJ = await pageRes.json().catch(() => null)
  if (!pageRes.ok || !pageJ?.id) {
    const reason = (pageJ && (pageJ.error?.message || '')) || `HTTP ${pageRes.status}`
    await auditFailure(approvalId, reason)
    return { ok: false, error: 'ERR_META_PAGE_RESOLVE', detail: reason, http: 502 }
  }

  // 4) publish the feed post (message = the approved body)
  const form = new URLSearchParams()
  form.set('message', `${row.title}\n\n${row.body}`.trim())
  const pubRes = await fetch(`${GRAPH}/${pageJ.id}/feed`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAGE_TOKEN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  const pubJ = await pubRes.json().catch(() => null)
  if (!pubRes.ok || !pubJ?.id) {
    const reason = (pubJ && (pubJ.error?.message || '')) || `HTTP ${pubRes.status}`
    await auditFailure(approvalId, reason)
    return { ok: false, error: 'ERR_META_PUBLISH', detail: reason, http: 502 }
  }

  // 5) record the outcome on the approval row (status stays 'approved' — the
  //    CHECK constraint has no 'published' state; the audit row is the record)
  const meta = {
    page_id: pageJ.id,
    page_name: pageJ.name || null,
    post_id: pubJ.id,
    published_at: new Date().toISOString(),
  }
  await rest('PATCH', `/rest/v1/content_approvals?id=eq.${encodeURIComponent(approvalId)}`, { review_note: 'PUBLISHED ' + pubJ.id })
  await rest('POST', '/rest/v1/audit_logs', {
    id: 'g9-publish-' + approvalId,
    action: 'social.publish',
    entity_type: 'content_approval',
    entity_id: approvalId,
    description: 'Published post ' + row.title + ' to Page ' + pageJ.id,
    metadata: meta,
  })

  return { ok: true, already: false, meta }
}

async function auditFailure(approvalId: string, reason: string) {
  // Failure audit uses a DETERMINISTIC id too, so replays of the same failure do
  // not pile up duplicate rows (same idempotency rule as the success trace).
  await rest('POST', '/rest/v1/audit_logs', {
    id: 'g9-publish-fail-' + approvalId,
    action: 'social.publish_failed',
    entity_type: 'content_approval',
    entity_id: approvalId,
    description: 'Publish failed: ' + reason.slice(0, 200),
    metadata: { reason: reason.slice(0, 500), attempted_at: new Date().toISOString() },
  }).catch(() => null)
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const automationToken = req.headers.get('x-automation-token') || ''
  const hasServiceKey = SERVICE !== '' && req.headers.get('authorization') === 'Bearer ' + SERVICE
  if (!hasServiceKey && !tokenMatches(automationToken)) return json({ error: 'unauthorized' }, 401)

  if (!PAGE_TOKEN) return json({ error: 'ERR_NO_PAGE_TOKEN', hint: 'set META_PAGE_ACCESS_TOKEN secret' }, 503)

  let body: { approvalId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  const approvalId = (body.approvalId || '').trim()
  if (!approvalId) return json({ error: 'ERR_INVALID_APPROVAL' }, 400)

  const result = await publishDraft(approvalId)
  const http = result.ok ? 200 : (result.http ?? 500)
  // No secrets, no tokens in the response — page/post ids and errors only.
  return json(result, http)
})