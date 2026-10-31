// ============================================
// R43 — B2/B3 publish probe (READ-ONLY · ห้ามเขียนทุกตาราง)
// ตามแฮนออฟ docs/BMB_HANDOFF_NEXT_SESSION_2026-10-31.md ข้อ 2:
//   SQL 24-48 ชม. — marketing_posts (status/scheduled_for/published_at/provider_post_id/prov)
//   + automation_queue marketing rows + cron.job_run_details (bmb-promote/tick ยิงครบไหม)
//   + audit: g26-poll · marketing · automation.execution
//   + FB read-only GET page feed → เทียบเวลาจริงกับ scheduled_for/published_at
// evidence → e2e/r43_publish_probe.json (key `approved_not_on_fb` ของ B3 ตามสเปก)
// ใช้: node e2e/r43_publish_probe.cjs
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const { S } = require('./wave2Lib.cjs')

const ROOT = path.resolve(__dirname, '..')
const AT = S.SUPABASE_ACCESS_TOKEN ||
  ((/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1])
const OUT = path.join(__dirname, 'r43_publish_probe.json')
const WINDOW = "interval '48 hours'"

async function q(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 300))
  return JSON.parse(t)
}

/** รัน query แบบ fail-soft — ตาราง/cron ที่ไม่มี = บันทึก error ไม่พัง probe ทั้งชุด */
async function tryQ(label, query) {
  try { return { ok: true, rows: await q(query) } }
  catch (e) { return { ok: false, error: String(e.message || e).slice(0, 400) } }
}

function isoDeltaMs(a, b) {
  if (!a || !b) return null
  const ta = Date.parse(a), tb = Date.parse(b)
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null
  return ta - tb
}

;(async () => {
  const out = { probe: 'r43_publish_probe', ran_at: new Date().toISOString(), window: '48h', read_only: true }

  // --- เวลาอ้างอิง (UTC + ICT) ---
  out.now = await tryQ('now', "SELECT now()::text AS utc, (now() AT TIME ZONE 'Asia/Bangkok')::text AS ict")

  // --- B2: marketing_posts 48 ชม. (ทุกสถานะที่เกี่ยวกับการเผยแพร่) ---
  out.marketing_posts_48h = await tryQ('marketing_posts_48h', `
    SELECT id, status, (approval_id IS NOT NULL) AS has_approval, content_type,
           scheduled_for::text AS scheduled_for, published_at::text AS published_at,
           provider_post_id, error, publish_attempts,
           created_at::text AS created_at, updated_at::text AS updated_at
    FROM public.marketing_posts
    WHERE created_at >= now() - ${WINDOW}
       OR scheduled_for >= now() - ${WINDOW}
       OR published_at  >= now() - ${WINDOW}
    ORDER BY created_at DESC
    LIMIT 200`)

  // --- B3: approve แล้ว/publish แล้ว แต่ provider_post_id IS NULL (ยังไม่ขึ้น FB) ---
  out.approved_not_on_fb = await tryQ('approved_not_on_fb', `
    SELECT id, status, (approval_id IS NOT NULL) AS has_approval,
           scheduled_for::text AS scheduled_for, published_at::text AS published_at,
           provider_post_id, error, publish_attempts,
           updated_at::text AS updated_at
    FROM public.marketing_posts
    WHERE status IN ('approved','scheduled','published')
      AND provider_post_id IS NULL
      AND updated_at >= now() - ${WINDOW}
    ORDER BY updated_at DESC
    LIMIT 100`)

  // --- B2: automation_queue rows 48 ชม. (กรอง marketing ใน JS กันพัง schema) ---
  out.automation_queue_48h = await tryQ('automation_queue_48h', `
    SELECT * FROM public.automation_queue
    WHERE created_at >= now() - ${WINDOW}
    ORDER BY created_at DESC
    LIMIT 200`)
  if (out.automation_queue_48h.ok) {
    const rows = out.automation_queue_48h.rows || []
    out.automation_queue_marketing = rows
      .filter((r) => /marketing|publish|promote|tick/i.test(JSON.stringify(r)))
      .slice(0, 60)
  }

  // --- B2: cron jobs + job_run_details 48 ชม. (bmb-promote ทุกนาที · bmb-tick */5) ---
  out.cron_jobs = await tryQ('cron_jobs', 'SELECT jobname, schedule, active FROM cron.job ORDER BY jobname')
  out.cron_runs_48h = await tryQ('cron_runs_48h', `
    SELECT j.jobname, count(*)::int AS runs,
           min(rd.start_time)::text AS first_run, max(rd.start_time)::text AS last_run
    FROM cron.job_run_details rd
    JOIN cron.job j ON j.jobid = rd.jobid
    WHERE j.jobname IN ('bmb-promote','bmb-tick') AND rd.start_time >= now() - ${WINDOW}
    GROUP BY 1 ORDER BY 1`)
  if (out.cron_runs_48h.ok && Array.isArray(out.cron_runs_48h.rows)) {
    // ความคาดหวังตาม schedule: * * * * * = 2880/48h · */5 = 576/48h
    const expected = { 'bmb-promote': 2880, 'bmb-tick': 576 }
    out.cron_runs_48h.rows = out.cron_runs_48h.rows.map((r) => ({
      ...r,
      expected_48h: expected[r.jobname] ?? null,
      coverage_pct: expected[r.jobname] ? Math.round((r.runs / expected[r.jobname]) * 100) : null,
    }))
  }

  // --- audit: g26-poll (inbound FB poll ของ social-publish-worker) ---
  out.g26_poll = await tryQ('g26_poll', `
    SELECT id, created_at::text FROM public.audit_logs
    WHERE id LIKE 'g26-poll%' AND created_at >= now() - ${WINDOW}
    ORDER BY created_at DESC LIMIT 10`)

  // --- audit: marketing actions 48 ชม. (approve/schedule/publish จริง) ---
  out.audit_marketing = await tryQ('audit_marketing', `
    SELECT id, action, entity_id, description, created_at::text
    FROM public.audit_logs
    WHERE entity_type = 'marketing' AND created_at >= now() - ${WINDOW}
    ORDER BY created_at DESC LIMIT 100`)

  // --- audit: automation.execution 48 ชม. (tick→worker→push สำเร็จ/พัง) ---
  out.automation_executions = await tryQ('automation_executions', `
    SELECT id, entity_id, description, created_at::text
    FROM public.audit_logs
    WHERE action = 'automation.execution' AND created_at >= now() - ${WINDOW}
    ORDER BY created_at DESC LIMIT 60`)

  // --- FB read-only: page feed ล่าสุด 50 โพสต์ (ไม่มี token = skip + บันทึกเหตุผล) ---
  const PAGE_TOKEN = S.META_PAGE_ACCESS_TOKEN
  const PAGE_ID = S.META_PAGE_ID
  if (PAGE_TOKEN && PAGE_ID) {
    try {
      const r = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/posts?limit=50&fields=id,message,created_time&access_token=${PAGE_TOKEN}`)
      const j = await r.json()
      out.fb_feed = {
        ok: !!Array.isArray(j.data),
        http: r.status,
        error: j.error ? j.error.message : null,
        posts: (Array.isArray(j.data) ? j.data : []).map((p) => ({
          id: p.id, created_time: p.created_time, msg_head: String(p.message || '').slice(0, 80),
        })),
      }
    } catch (e) {
      out.fb_feed = { ok: false, error: String(e.message || e).slice(0, 300) }
    }
  } else {
    out.fb_feed = { ok: false, skipped: 'META_PAGE_ACCESS_TOKEN/META_PAGE_ID not set in env' }
  }

  // --- เทียบ DB vs FB จริง: prov row หาใน feed ด้วย id ก่อน ---
  const rows = (out.marketing_posts_48h.ok && out.marketing_posts_48h.rows) || []
  const feed = (out.fb_feed && out.fb_feed.ok && out.fb_feed.posts) || []
  out.fb_compare = rows
    .filter((r) => r.status === 'published' || r.provider_post_id)
    .map((r) => {
      let hit = null, via = null
      if (r.provider_post_id) {
        hit = feed.find((f) => f.id === r.provider_post_id) || null
        if (hit) via = 'provider_post_id'
      }
      return {
        id: r.id,
        status: r.status,
        scheduled_for: r.scheduled_for,
        published_at: r.published_at,
        provider_post_id: r.provider_post_id,
        publish_attempts: r.publish_attempts,
        error: r.error,
        fb_id: hit ? hit.id : null,
        fb_created_time: hit ? hit.created_time : null,
        matched_via: via,
        // delta_ms > 0 = ขึ้น FB ช้ากว่าเวลาที่ตั้ง/บันทึก
        delta_vs_scheduled_ms: hit ? isoDeltaMs(hit.created_time, r.scheduled_for) : null,
        delta_vs_published_ms: hit ? isoDeltaMs(hit.created_time, r.published_at) : null,
      }
    })

  // --- summary (บันทึกตรง ๆ ห้ามแปลงเกินหลักฐาน) ---
  out.summary = {
    posts_48h: rows.length,
    by_status: rows.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {}),
    published_without_provider_id: rows.filter((r) => r.status === 'published' && !r.provider_post_id).length,
    approved_or_scheduled_without_provider_id:
      rows.filter((r) => ['approved', 'scheduled'].includes(r.status) && !r.provider_post_id).length,
    b3_rows: (out.approved_not_on_fb.ok && out.approved_not_on_fb.rows) ? out.approved_not_on_fb.rows.length : null,
    cron_runs: (out.cron_runs_48h.ok && out.cron_runs_48h.rows) || out.cron_runs_48h.error || null,
    fb_feed_ok: !!(out.fb_feed && out.fb_feed.ok),
    fb_matched: out.fb_compare.filter((c) => c.fb_id).length,
    fb_published_unmatched: out.fb_compare.filter((c) => c.status === 'published' && !c.fb_id).map((c) => c.id),
    errors: Object.fromEntries(
      Object.entries(out)
        .filter(([, v]) => v && v.ok === false && v.error)
        .map(([k, v]) => [k, v.error]),
    ),
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('WROTE ' + OUT)
  console.log('SUMMARY ' + JSON.stringify(out.summary))
})().catch((e) => {
  console.log('FATAL ' + String(e).slice(0, 500))
  process.exitCode = 1
})