// R26 — AI ตอบคอมเม้นบนโพส (Owner 2026-10-30 "ใช้ AI ที่มีอยู่"): poll → ingest RPC → kick social-ai-worker
import { describe, it, expect } from 'vitest'
import publishSrc from '../../supabase/functions/social-publish-worker/index.ts?raw'
import automationSrc from '../../supabase/functions/automation-worker/index.ts?raw'
import webhookSrc from '../../supabase/functions/channel-webhook/index.ts?raw'

describe('R26 — comment poll → social_events (RPC) → kick social-ai-worker', () => {
  it('social-publish-worker มี action=poll_comments (ทางเข้าเดียวของ poll)', () => {
    expect(publishSrc).toContain("action === 'poll_comments'")
  })

  it('ingest ผ่าน RPC ingest_social_event เท่านั้น — ห้าม INSERT INTO social_events ตรง ๆ', () => {
    expect(publishSrc).toContain('ingest_social_event')
    expect(publishSrc).not.toMatch(/INSERT\s+INTO\s+public\.social_events/i)
  })

  it('กัน self-echo (from.id == page) + ข้ามคอมเม้นว่าง/ไม่มี id', () => {
    expect(publishSrc).toMatch(/c\.from\.id === pageId/)
    expect(publishSrc).toContain('c.message.trim()')
    expect(publishSrc).toContain('if (!c.id')
  })

  it('kick social-ai-worker ด้วย x-automation-token + event_id (pattern เดียวกับ webhook)', () => {
    expect(publishSrc).toContain("'/functions/v1/social-ai-worker'")
    expect(publishSrc).toContain("'x-automation-token': TOKEN")
    expect(publishSrc).toContain("event_id: c.id")
    expect(webhookSrc).toContain('triggerAi')
  })

  it('automation-worker เรียก poll หลัง marketing_publish + ผลรวมอยู่ใน ctx.results', () => {
    expect(automationSrc).toContain("action: 'poll_comments'")
    expect(automationSrc).toContain('ctx.results.comment_poll')
  })

  it('ไม่มีเส้นทางตอบเพจคู่ขนาน — publish worker ไม่ยิง /replies เอง (ส่ง = social-ai-worker เดิม)', () => {
    expect(publishSrc).not.toContain('/replies')
  })
})