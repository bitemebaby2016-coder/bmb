// ============================================
// BMB R63 — IMG-1 image sweep: audit + downscale storage images (web-fit)
// Owner directive 2026-11-03: "ทุกภาพที่ระบบเอามาใช้ให้ลดขนาดอัตโนมัติให้เหมาะกับเว็บ
//   ทุกภาพ ที่ทำไปแล้วก็แก้ไขด้วย" → ไฟล์เก่าในคลัง = ย่อให้ด้วย
// Scope: bucket `bmb-images` (ai-generated/** · marketing/** · uploads/** · brands/**)
//   — คลังส่วนตัว (payment-slips / address-photos / pod-photos) = หลักฐาน ห้ามแตะ
// Modes:
//   node e2e/r63ImageSweep.cjs           → AUDIT (read-only) → r63ImageSweep-audit.json
//   node e2e/r63ImageSweep.cjs --apply   → ย่อเฉพาะไฟล์ที่เกินเกณฑ์ (same path upsert = URL เดิม)
// Thresholds: longEdge > 1024px หรือ bytes > 400KB → re-encode jpeg q0.82 maxSide 1024
// Skip: GIF (แอนิเมชัน) · SVG · parse ไม่ได้ (บันทึกเหตุ) · ย่อแล้วไม่เล็กกว่าเดิม = คืนของเดิม
// Evidence: e2e/r63ImageSweep-{audit,apply}.json
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, SERVICE } = require('./wave2Lib.cjs')

const APPLY = process.argv.includes('--apply')
const rootArg = (process.argv.find((a) => a.startsWith('--root=')) || '').slice('--root='.length)
const BUCKET = 'bmb-images'
const MAX_SIDE = 1024
const QUALITY = 0.82
const MAX_BYTES = 400 * 1024
const ROOTS = ['ai-generated', 'marketing', 'uploads', 'brands']
const roots = rootArg ? [rootArg] : ROOTS

async function listAll(prefix) {
  const out = []
  let offset = 0
  for (;;) {
    const r = await fetch(`${SB}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: prefix || '', limit: 100, offset }),
    })
    let rows = []
    try { rows = await r.json() } catch {}
    if (!Array.isArray(rows)) break
    for (const row of rows) {
      const full = (prefix ? prefix.replace(/\/$/, '') + '/' : '') + row.name
      if (row.id == null) { out.push(...await listAll(full)) } // folder
      else out.push({ path: full, size: row.metadata?.size ?? null, mime: row.metadata?.mimetype ?? null })
    }
    if (rows.length < 100) break
    offset += 100
  }
  return out
}

// Pure header parse — PNG / JPEG / WebP(VP8/VP8L/VP8X)
function readDims(buf) {
  try {
    if (buf.length > 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
    }
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue }
        const m = buf[i + 1]
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue }
        const len = buf.readUInt16BE(i + 2)
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
        }
        i += 2 + len
      }
      return null
    }
    if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const fmt = buf.toString('ascii', 12, 16)
      if (fmt === 'VP8X') return { w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)) }
      if (fmt === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff }
      if (fmt === 'VP8L') {
        const b = buf.readUInt32LE(21)
        return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }
      }
      return null
    }
  } catch { /* fallthrough */ }
  return null
}
async function downscaleViaBrowser(browser, b64, mime) {
  const page = await browser.newPage()
  try {
    const out = await page.evaluate(async ({ b64, mime, maxSide, quality }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const bmp = await createImageBitmap(new Blob([bin], { type: mime }), { imageOrientation: 'from-image' })
      const longest = Math.max(bmp.width, bmp.height)
      const scale = Math.min(1, maxSide / longest)
      const w = Math.max(1, Math.round(bmp.width * scale))
      const h = Math.max(1, Math.round(bmp.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(bmp, 0, 0, w, h)
      bmp.close?.()
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality))
      if (!blob) return null
      const ab = await blob.arrayBuffer()
      let s = ''
      const u8 = new Uint8Array(ab)
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000))
      return { b64: btoa(s), w, h, bytes: blob.size }
    }, { b64, mime, maxSide: MAX_SIDE, quality: QUALITY })
    return out
  } finally { await page.close() }
}

;(async () => {
  const out = { mode: APPLY ? 'apply' : 'audit', ran_at: new Date().toISOString(), bucket: BUCKET, files: [], totals: { scanned: 0, over: 0, skipped: 0, done: 0, before: 0, after: 0 }, reasons: {} }
  const skip = (reason) => { out.totals.skipped++; out.reasons[reason] = (out.reasons[reason] || 0) + 1 }
  // เก็บรายการไฟล์ — AUDIT = list+download ปกติ · APPLY = เอาเฉพาะรายการจาก audit ที่ would_downscale
  // (ดาวน์โหลดซ้ำทั้งคลัง = เกิน 30s — บทเรียนรอบ apply แรก)
  const all = []
  if (APPLY) {
    const auditFile = path.join(__dirname, `r63ImageSweep-audit${rootArg ? '-' + rootArg : ''}.json`)
    if (!fs.existsSync(auditFile)) throw new Error('run audit first: missing ' + auditFile)
    const audit = JSON.parse(fs.readFileSync(auditFile, 'utf8'))
    for (const rec of audit.files || []) {
      if (rec.action === 'would_downscale') all.push({ path: rec.path, size: rec.before?.bytes ?? null, mime: null })
    }
    out.totals.fromAudit = all.length
  } else {
    for (const root of roots) all.push(...await listAll(root))
  }
  out.totals.listed = all.length
  let idx = 0
  async function worker() {
    for (;;) {
      const i = idx++
      if (i >= all.length) return
      const f = all[i]
      out.totals.scanned++
      const ext = (f.path.split('.').pop() || '').toLowerCase()
      if (ext === 'gif' || ext === 'svg') { skip(ext); continue }
      if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) { skip('ext:' + ext); continue }
      if (f.size == null) { skip('no_metadata'); continue }
      const dl = await fetch(`${SB}/storage/v1/object/${BUCKET}/${f.path}`, { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } })
      if (!dl.ok) { skip('download_' + dl.status); continue }
      const buf = Buffer.from(await dl.arrayBuffer())
      const dims = readDims(buf)
      if (!dims) { skip('no_dims'); continue }
      const longest = Math.max(dims.w, dims.h)
      const over = longest > MAX_SIDE || buf.length > MAX_BYTES
      const rec = { path: f.path, before: { w: dims.w, h: dims.h, bytes: buf.length } }
      if (!over) { out.totals.skipped++; rec.action = 'ok_small'; out.files.push(rec); continue }
      out.totals.over++
      rec.action = APPLY ? 'pending' : 'would_downscale'
      if (APPLY) {
        const b64 = buf.toString('base64')
        const r = await downscaleViaBrowser(sharedBrowser, b64, f.mime || ('image/' + ext))
        if (!r) { rec.action = 'failed_reencode'; out.files.push(rec); continue }
        if (r.bytes >= buf.length && longest <= MAX_SIDE) { rec.action = 'kept_original_smaller'; out.files.push(rec); continue }
        const up = await fetch(`${SB}/storage/v1/object/${BUCKET}/${f.path}`, {
          method: 'POST',
          headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
          body: Buffer.from(r.b64, 'base64'),
        })
        rec.after = { w: r.w, h: r.h, bytes: r.bytes }
        rec.action = up.ok ? 'downscaled' : 'upload_failed_' + up.status
        if (up.ok) { out.totals.done++; out.totals.before += buf.length; out.totals.after += r.bytes }
      }
      out.files.push(rec)
      if (APPLY && out.totals.done >= 400) return // safety bound
    }
  }
  // APPLY = chromium ตัวเดียวทั้ง run (เปิดใหม่ทุกไฟล์ = เกิน 30s — บทเรียนรอบแรก)
  let sharedBrowser = null
  if (APPLY) {
    const { chromium } = require('playwright')
    sharedBrowser = await chromium.launch()
  }
  try {
    await Promise.all(Array.from({ length: APPLY ? 2 : 8 }, () => worker()))
  } finally {
    if (sharedBrowser) await sharedBrowser.close()
  }
  const outFile = path.join(__dirname, APPLY ? `r63ImageSweep-apply${rootArg ? '-' + rootArg : ''}.json` : `r63ImageSweep-audit${rootArg ? '-' + rootArg : ''}.json`)
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ mode: out.mode, ...out.totals, reasons: out.reasons, saved_bytes: out.totals.before - out.totals.after }, null, 2))
  console.log('SAVED ' + outFile)
})().catch((e) => { console.error('SWEEP FAIL', e); process.exit(1) })