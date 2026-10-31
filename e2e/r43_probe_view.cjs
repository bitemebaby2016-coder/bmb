// R43 helper — ดูสรุป evidence r43_publish_probe.json (อ่านอย่างเดียว ไม่แตะ DB)
'use strict'
const j = require('./r43_publish_probe.json')
const show = (label, v) => console.log(label + '=' + JSON.stringify(v, null, 1))
show('SUMMARY', j.summary)
show('POSTS_48H', (j.marketing_posts_48h.rows || []).map((r) => ({
  id: r.id, status: r.status, sched: r.scheduled_for, pub: r.published_at,
  prov: r.provider_post_id, att: r.publish_attempts, err: r.error, upd: r.updated_at,
})))
show('B3_APPROVED_NOT_ON_FB', (j.approved_not_on_fb.rows || []))
show('FB_COMPARE', j.fb_compare)
show('CRON_JOBS', j.cron_jobs.rows || j.cron_runs_48h)
show('AUDIT_MARKETING', (j.audit_marketing.rows || []).slice(0, 20))
show('G26_POLL', j.g26_poll.rows || j.g26_poll)
const ax = j.automation_executions
show('AUTO_EXEC_SAMPLE', ax.rows ? ax.rows.slice(0, 8) : ax)
show('QUEUE_MKT_SAMPLE', (j.automation_queue_marketing || []).slice(0, 8))
show('QUEUE_MKT_COUNT', (j.automation_queue_marketing || []).length)
show('ERRORS', j.summary && j.summary.errors)