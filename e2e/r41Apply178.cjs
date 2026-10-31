// R41 apply 178 — pg_cron/pg_net + bmb-promote + bmb_tick_http + secret (BMB_TICK_TOKEN · IMAGE_GEN_MODELS)
// แล้ว E2E ทันที: schedule bmb-tick · เรียก cron-tick ตรง ๆ (พิสูจน์ chain tick→worker→FB+poll) · promote แถวค้าง
// evidence → e2e/r41Apply178-result.json
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const ENV = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const ANON = (/^VITE_SUPABASE_ANON_KEY=(.*)$/m.exec(ENV) || [])[1]
const REF = 'ivkdfognyiwjcmrhcnwz'
const q = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}
const IMG_MODELS = 'google/gemini-3.1-flash-lite-image,google/gemini-3.1-flash-image,google/gemini-2.5-flash-image,openai/gpt-5-image-mini,openai/gpt-5.4-image-2,google/gemini-3-pro-image'
;(async () => {
  const out = { at: new Date().toISOString() }
  const token = crypto.randomBytes(18).toString('hex')
  out.precheck = {
    extBefore: await q("SELECT extname FROM pg_extension WHERE extname IN ('pg_cron','pg_net')"),
    cronBefore: await q("SELECT jobname FROM cron.job"),
  }
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '178_cron_publish_tick.sql'), 'utf8')
    .split('\n').filter((l) => !/^BEGIN;\s*$/i.test(l.trim()) && !/^COMMIT;\s*$/i.test(l.trim())).join('\n')
  out.apply = await q(sql)
  out.reload = await q("NOTIFY pgrst, 'reload schema'")
  // secrets = โหมดใหม่: IMAGE_GEN_MODELS (ทะเบียนจริง — ค่าเก่าเป็น ID ผิด qwen/seedream) + tick token
  try {
    execSync(`npx supabase secrets set IMAGE_GEN_MODELS=${IMG_MODELS} BMB_TICK_TOKEN=${token} --project-ref ${REF}`, {
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT }, encoding: 'utf8', cwd: ROOT, maxBuffer: 4 * 1024 * 1024,
    })
    out.secrets = 'SET_OK'
  } catch (e) { out.secrets = 'FAIL ' + String(e.stdout || e.message).slice(0, 300) }
  // schedule bmb-tick (unschedule เดิมกันซ้ำ)
  out.scheduleTick = await q(`
    DO $$ BEGIN
      PERFORM cron.unschedule('bmb-tick');
    EXCEPTION WHEN OTHERS THEN NULL; END $$;
    DO $$ BEGIN
      PERFORM cron.schedule('bmb-tick', '*/5 * * * *', $$SELECT public.bmb_tick_http('${token}')$$);
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'bmb-tick skipped: %', SQLERRM; END $$;`)
  out.verify = {
    extAfter: await q("SELECT extname FROM pg_extension WHERE extname IN ('pg_cron','pg_net')"),
    cronAfter: await q("SELECT jobname, schedule, active FROM cron.job ORDER BY jobname"),
    fnTick: await q("SELECT proname FROM pg_proc WHERE proname = 'bmb_tick_http'"),
  }
  // E2E ทันที: เรียก cron-tick ตรง ๆ ด้วย token = พิสูจน์ tick → worker → FB push + comment poll
  try {
    const r = await fetch(`https://${REF}.supabase.co/functions/v1/cron-tick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tick-token': token },
      body: JSON.stringify({ job: 'marketing_publish' }),
      signal: AbortSignal.timeout(130000),
    })
    out.tickE2E = { http: r.status, body: (await r.text()).slice(0, 800) }
  } catch (e) { out.tickE2E = { error: String(e).slice(0, 300) } }
  // promote แถวค้างทันที (site เห็น)
  out.promote = await q('SELECT public.marketing_publish_due() AS promoted')
  out.postsAfter = await q("SELECT id, status, scheduled_for::text AS sched, publish_attempts AS att, provider_post_id IS NOT NULL AS prov, updated_at::text AS upd FROM public.marketing_posts ORDER BY created_at DESC LIMIT 5")
  out.pollAfter = await q("SELECT id, created_at::text FROM public.audit_logs WHERE id LIKE 'g26-poll%' ORDER BY created_at DESC LIMIT 3")
  out.queueAfter = await q("SELECT job_type, status, created_at::text FROM public.automation_queue WHERE job_type='marketing_publish' ORDER BY created_at DESC LIMIT 3")
  const ext = out.verify.extAfter || ''
  out.allPass = String(ext).includes('pg_cron') && String(ext).includes('pg_net')
    && String(out.verify.cronAfter).includes('bmb-promote') && String(out.verify.cronAfter).includes('bmb-tick')
    && out.secrets === 'SET_OK'
  fs.writeFileSync(path.join(__dirname, 'r41Apply178-result.json'), JSON.stringify(out, null, 2))
  console.log('ALL_PASS=' + out.allPass)
  console.log('SECRETS=' + out.secrets)
  console.log('CRON=' + JSON.stringify(out.verify.cronAfter))
  console.log('TICK_E2E=' + JSON.stringify(out.tickE2E))
  console.log('PROMOTED=' + JSON.stringify(out.promote))
  console.log('POSTS=' + JSON.stringify(out.postsAfter))
  console.log('POLL=' + JSON.stringify(out.pollAfter))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))