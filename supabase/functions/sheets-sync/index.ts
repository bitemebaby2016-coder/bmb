// ============================================
// Bite Me Baby — Edge Function: sheets-sync (Master Prompt Task 4 · T4-a)
// ============================================
// สรุปยอดขายรายวัน/รายเดือน ส่งเข้า Google Sheets ของร้านค้าอัตโนมัติ
// (ใช้วิเคราะห์ภาพรวมงบการเงิน — อ่านอย่างเดียว ไม่สร้าง/ไม่แก้แถวธุรกิจใด ๆ)
//
// เรียกโดย: GitHub Actions `.github/workflows/sheets-sync.yml`
//   (platform JWT layer เหมือน queue-enqueue + x-automation-token เหมือน
//    automation-worker/push-send — ใช้ AUTOMATION_TOKEN ตัวเดิม ไม่มี secret ใหม่)
//
// Env (supabase secrets set ...):
//   AUTOMATION_TOKEN           — shared secret ของ scheduler (ตัวเดิม)
//   GOOGLE_SHEETS_WEBHOOK_URL  — Google Apps Script Web App (doPost) ที่ผูกกับชีตของร้าน
//                                ยังไม่ตั้งค่า → ตอบ skipped/not_configured (CI ไม่แดง · เงียบ)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — auto-injected
//
// ตัวอย่าง doPost ฝั่ง Apps Script (Owner วางใน Script Editor แล้ว Deploy as Web App):
//   function doPost(e) {
//     const p = JSON.parse(e.postData.contents)
//     if (p.secret !== PropertiesService.getScriptProperties().getProperty('SYNC_SECRET')) ...
//     const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(p.tab) ||
//               SpreadsheetApp.getActiveSpreadsheet().insertSheet(p.tab)
//     // upsert ด้วย key (วิ่งซ้ำงวดเดิม = แทนที่แถวเดิม ไม่ทับกัน)
//     const values = sh.getDataRange().getValues()
//     for (let i = 0; i < values.length; i++)
//       if (values[i][0] === p.key) { sh.deleteRow(i + 1); break }
//     sh.appendRow([p.key, ...p.rows[p.rows.length - 1].slice(1)])
//     return ContentService.createTextOutput(JSON.stringify({ ok: true }))
//   }
//
// idempotency: payload มี `key` คงที่ต่อรอบงวด (daily=วันที่ · monthly=เดือน) —
//   รันซ้ำได้โดยไม่งอกแถวซ้ำ (ฝั่ง sheet upsert ด้วย key ตามตัวอย่างข้างบน)
// Timezone: งวดวัน = วันปฏิทินใน Asia/Bangkok (UTC+7 ไม่มี DST) — ตัดที่ 00:00 ICT
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const AUTOMATION_TOKEN = Deno.env.get('AUTOMATION_TOKEN') || ''
const SHEETS_WEBHOOK_URL = Deno.env.get('GOOGLE_SHEETS_WEBHOOK_URL') || ''

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000 // Asia/Bangkok = UTC+7 (ไม่มี DST)

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

type Period = 'daily' | 'monthly'

/** งวด "วันปฏิทินล่าสุดที่ปิดสนิทแล้ว" ในเวลากรุงเทพฯ (มัก = เมื่อวาน ณ เวลาเรียก 00:15 ICT) */
export function previousDayKey(nowUtcMs: number): string {
  const bkkYesterday = new Date(nowUtcMs + BKK_OFFSET_MS - 24 * 60 * 60 * 1000)
  return bkkYesterday.toISOString().slice(0, 10)
}

/** ขอบเขต [start, end) ของงวดใน ISO แบบ offset +07:00 (pure — test ได้) */
export function bkkPeriodRange(
  period: Period,
  nowUtcMs: number,
): { start: string; end: string; key: string; label: string } {
  const dayKey = previousDayKey(nowUtcMs)
  if (period === 'daily') {
    const [y, m, d] = dayKey.split('-').map(Number)
    const nextKey = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
    return {
      start: `${dayKey}T00:00:00+07:00`,
      end: `${nextKey}T00:00:00+07:00`,
      key: `daily:${dayKey}`,
      label: dayKey,
    }
  }
  const [y, m] = dayKey.split('-').map(Number)
  const startKey = `${y}-${String(m).padStart(2, '0')}-01`
  const endKey = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
  return {
    start: `${startKey}T00:00:00+07:00`,
    end: `${endKey}T00:00:00+07:00`,
    key: `monthly:${startKey.slice(0, 7)}`,
    label: startKey.slice(0, 7),
  }
}

interface OrderRow {
  status: string
  total_amount: number | null
  delivery_fee: number | null
  discount_amount: number | null
}

/** แถวสรุป 1 งวด (ฟังก์ชันเดียวของ daily/monthly — pure, test ได้) */
export function summarizeOrders(rows: OrderRow[]): (string | number)[] {
  let count = 0
  let gross = 0
  let delivery = 0
  let discount = 0
  const statusCounts: Record<string, number> = {}
  for (const r of Array.isArray(rows) ? rows : []) {
    count += 1
    gross += Number(r?.total_amount) || 0
    delivery += Number(r?.delivery_fee) || 0
    discount += Number(r?.discount_amount) || 0
    const st = String(r?.status ?? 'unknown')
    statusCounts[st] = (statusCounts[st] || 0) + 1
  }
  const round2 = (n: number) => Math.round(n * 100) / 100
  return [count, round2(gross), round2(discount), round2(delivery), JSON.stringify(statusCounts)]
}

const HEADER = ['period', 'orders', 'gross_sales_baht', 'discount_baht', 'delivery_fee_baht', 'status_breakdown']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  // ประตู auth ชั้นที่ 2 (platform verify_jwt = ชั้นที่ 1 ตาม config.toml)
  const token = req.headers.get('x-automation-token') || ''
  if (!AUTOMATION_TOKEN || token !== AUTOMATION_TOKEN) {
    return json({ ok: false, error: 'bad_token' }, 401)
  }

  let period: Period = 'daily'
  try {
    const body = (await req.json()) as { period?: Period }
    if (body?.period === 'monthly') period = 'monthly'
  } catch {
    // ไม่มี body = ใช้ daily (ค่าเริ่มต้นของ schedule รายวัน)
  }

  if (!SHEETS_WEBHOOK_URL) {
    // เงียบ ไม่ใช่ความล้มเหลว — ยังไม่ได้ตั้งค่า secret (สถานะเตรียมพร้อม)
    return json({ ok: true, result: 'skipped', reason: 'not_configured', period })
  }

  if (!SB_URL || !SERVICE) return json({ ok: false, error: 'missing_supabase_env' }, 500)

  const range = bkkPeriodRange(period, Date.now())
  const db = createClient(SB_URL, SERVICE, { auth: { persistSession: false } })
  const { data, error } = await db
    .from('orders')
    .select('status, total_amount, delivery_fee, discount_amount')
    .gte('created_at', range.start)
    .lt('created_at', range.end)
    .limit(50000)
  if (error) return json({ ok: false, error: 'orders_read_failed', detail: error.message }, 502)

  const summary = summarizeOrders((data || []) as OrderRow[])
  const payload = {
    key: range.key,
    period,
    label: range.label,
    generatedAt: new Date().toISOString(),
    tab: period === 'daily' ? 'DailySales' : 'MonthlySales',
    header: HEADER,
    rows: [[range.label, ...summary]],
  }

  const push = await fetch(SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!push.ok) return json({ ok: false, error: 'sheets_push_failed', status: push.status }, 502)
  return json({ ok: true, result: 'synced', period, key: range.key, orders: summary[0] })
})