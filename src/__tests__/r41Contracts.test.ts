import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { stickerPageHeight, stickerDrawList, clampFaceHeight } from '@/lib/stickerPng'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const migSrc = read('supabase/migrations/178_cron_publish_tick.sql')
const tickSrc = read('supabase/functions/cron-tick/index.ts')
const imgSrc = read('supabase/functions/image-gen/index.ts')
const cfgSrc = read('supabase/config.toml')
const printSrc = read('src/pages/admin/AdminPrintSettings.tsx')

describe('R41-1 · m178 = time-based ย้ายเข้า DB (ไม่พึ่ง GH cron ที่ง่อย) — promote ทุกนาที + tick ทุก 5 นาที', () => {
  it('m178: pg_cron+pg_net guarded · bmb-promote ทุกนาที · bmb_tick_http → cron-tick (token ไม่อยู่ในไฟล์)', () => {
    expect(migSrc).toContain('CREATE EXTENSION IF NOT EXISTS pg_cron')
    expect(migSrc).toContain('CREATE EXTENSION IF NOT EXISTS pg_net')
    expect(migSrc).toContain("cron.schedule('bmb-promote', '* * * * *'")
    expect(migSrc).toContain('marketing_publish_due')
    expect(migSrc).toContain('public.bmb_tick_http')
    expect(migSrc).toContain('functions/v1/cron-tick')
    expect(migSrc).toContain('EXCEPTION WHEN OTHERS') // guarded ทุกจุด — extension ไม่มี = ข้ามเงียบ
    expect(migSrc).not.toContain('BMB_TICK_TOKEN') // secret ห้ามอยู่ใน git
  })

  it('cron-tick EF: x-tick-token = env · ยิง automation-worker job marketing_publish (eventId นาที กันซ้ำ) + config verify_jwt=false', () => {
    expect(tickSrc).toContain("x-tick-token")
    expect(tickSrc).toContain("BMB_TICK_TOKEN")
    expect(tickSrc).toContain("job: 'marketing_publish'")
    expect(tickSrc).toContain('tick-mk-')
    expect(tickSrc).toContain('x-automation-token')
    expect(tickSrc).toContain("'ERR_UNCAUGHT'")
    expect(cfgSrc).toContain('[functions.cron-tick]')
    expect(cfgSrc).toContain('verify_jwt = false')
  })

  it('gates: sticker = R41 หน้าคงที่ (offset ไม่ยืด) — png ↔ SetPageSize ↔ drawList ตรงกันทุก offset', () => {
    for (const off of [0, 62, 300, -40]) {
      expect(stickerPageHeight(off, 709)).toBe(709)
      expect(stickerPageHeight(off, 640)).toBe(640)
      expect(clampFaceHeight(stickerPageHeight(off, 9999))).toBe(760)
    }
    const ops = stickerDrawList({ order_number: 'T', items: [], total_amount: 0 }, 62, 709)
    const bg = ops[0]
    expect(bg.kind === 'rect' && bg.h).toBe(709) // bg = หน้าคงที่ — ไม่มีแถบเติบโตตาม offset
    for (const op of ops) {
      const yEnd = op.kind === 'line' ? Math.max(op.y1, op.y2)
        : op.kind === 'rect' ? op.y + op.h
          : op.kind === 'qr' ? op.y + op.size
            : op.y
      expect(yEnd).toBeLessThanOrEqual(709)
    }
  })
})

describe('R41-2 · image-gen = ทะเบียนโมเดลจริง + images API + parse ทุกรูปทรง', () => {
  it('รายการโมเดล = เฉพาะ output=image ที่ทะเบียนยืนยัน (qwen/seedream ผิดจริง = ถอดแล้ว)', () => {
    expect(imgSrc).toContain('google/gemini-3.1-flash-lite-image')
    expect(imgSrc).toContain('openai/gpt-5-image-mini')
    expect(imgSrc).not.toContain('qwen/qwen-image-3')
    expect(imgSrc).not.toContain('seedream-5-0-flash')
    expect(imgSrc).not.toContain('gemini-nano-banana-2.1') // ไม่อยู่ใน list สั้น — ทะเบียนมี แต่ถอดออกจาก default แล้ว (env ตั้งเองได้)
  })

  it('EF: images API ก่อน (text-only) + chat fallback + pickImage รวมทุกรูปทรง (b64_json/source base64)', () => {
    expect(imgSrc).toContain('/api/v1/images/generations')
    expect(imgSrc).toContain('[images-api]')
    expect(imgSrc).toContain('const pickImage =')
    expect(imgSrc).toContain('b64_json')
    expect(imgSrc).toContain("part?.type === 'image'")
    expect(imgSrc).toContain("passes: Array<'with-ref' | 'text-only'>")
    expect(imgSrc).toContain('attempts.join')
  })
})