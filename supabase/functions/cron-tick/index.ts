// ============================================
// Bite Me Baby — cron-tick (R41 · 2026-10-31)
// ============================================
// สะพาน pg_cron (ใน DB) → automation-worker — ภารกิจ time-based ไม่ต้องพึ่ง GitHub Actions อีก
//   ปัญหาจริง: GH automation-scheduler ง่อยข้ามชั่วโมง → marketing_publish ไม่รัน = FB ไม่ถูก push +
//   comment poll หยุด → "AI ไม่ตอบโพส" (inbound webhook ยังทำงาน — เส้นที่พังคือ outbound/poll)
// ความปลอดภัย: verify_jwt=false (pg_net ยิงตรงไม่มี JWT) + ต้องแนบ x-tick-token = secret `BMB_TICK_TOKEN`
//   (ตั้งตอน apply m178 — ไม่มีใน git) · job ล็อกเฉพาะ marketing_publish · eventId = นาที (กันซ้ำ)
// worker ตัวเดิม (automation-worker) = เดิมทุกอย่าง: FB push + g26 comment poll + audit trace
// ============================================

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const TOKEN = Deno.env.get('AUTOMATION_TOKEN') || '' // secret ตัวเดียวกับที่ GH ใช้ (มีบน production แล้ว)
const TICK = Deno.env.get('BMB_TICK_TOKEN') || ''

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-tick-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders() })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  try {
    if (!TICK) return json({ error: 'not_configured', hint: 'set BMB_TICK_TOKEN secret' }, 500)
    const hdr = req.headers.get('x-tick-token') || ''
    if (hdr !== TICK) return json({ error: 'unauthorized' }, 401)
    if (!TOKEN) return json({ error: 'worker_token_missing', hint: 'AUTOMATION_TOKEN secret' }, 500)
    // eventId = นาที UTC (tick */5 → ทุก firing มี id ใหม่ · ซ้ำในนาทีเดียวกัน = dedupe โดย worker)
    const bucket = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', 't')
    const res = await fetch(`${SB_URL}/functions/v1/automation-worker`, {
      method: 'POST',
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        'Content-Type': 'application/json',
        'x-automation-token': TOKEN,
      },
      body: JSON.stringify({ job: 'marketing_publish', eventId: `tick-mk-${bucket}` }),
      signal: AbortSignal.timeout(120000),
    })
    const bodyText = await res.text().catch(() => '')
    return json({ ok: res.ok, worker_status: res.status, result: bodyText.slice(0, 600) }, res.ok ? 200 : 502)
  } catch (e) {
    return json({ error: 'ERR_UNCAUGHT', detail: String(e instanceof Error ? e.message : e).slice(0, 300) }, 500)
  }
})