// ============================================
// Bite Me Baby — Edge Function: voice-tts (AI-VOICE WS-2f)
// สังเคราะห์เสียงไทยสำหรับผู้ช่วยเสียง — ทำงานฝั่ง server เพราะ Edge-TTS
// เชื่อม Microsoft websocket โดยตรง (browser เรียกไม่ได้: CORS/network)
//
// Chain (ตาม owner spec 2026-10-01 + live probe):
//   1. Edge-TTS (Microsoft) — ฟรี แต่ live probe 2026-10-01 พบ MS ตัด websocket
//      จาก datacenter IP (turn.start → disconnect) เก็บไว้ก่อน ใช้เมื่อ MS ปลดบล็อก
//   2. Google Translate TTS — ฟรี ไม่ต้องมี key ใช้ได้จริง (live probe PASS)
//      จำกัด ~190 chars/request → แบ่งตามประโยคแล้วต่อ mp3
//   3. Botnoi Voice API — ถ้าตั้ง BOTNOI_API_KEY ใน secrets
//   ถ้าทั้งหมดล้ม → 503 (client fallback speechSynthesis ของ browser — ระบบไม่ตาย)
//
// Security: verify_jwt เหมือน ai-proxy (guest key / user JWT) — ไม่มี key
// ใดหลุดไป client; ข้อความถูกจำกัดความยาว + sanitize ก่อนส่ง provider
//
// Request:  { text: string, voice?: string }   (voice เช่น "th-TH-AcharaNeural")
// Response: audio/mpeg binary  (ok)  |  { error } (fail)
// ============================================

import { MsEdgeTTS, OUTPUT_FORMAT } from 'npm:msedge-tts@2.0.8'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_CHARS = 600 // ประโยคตอบ ≤2 ประโยค → 600 พอ และจำกัด abuse
const DEFAULT_VOICE = 'th-TH-AcharaNeural' // หญิง ไทยธรรมชาติ (สำรอง: th-TH-AnanNeural ชาย)
const BOTNOI_URL = 'https://api.botnoi.ai/voice/api/v1/generate'
const GOOGLE_TTS_URL = 'https://translate.google.com/translate_tts'
const GOOGLE_CHUNK = 190 // ขีดจำกัดต่อ request (~200)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

function sanitizeText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.slice(0, MAX_CHARS)
}

/**
 * V2 FIX (owner report: พูดขาดตอน): แบ่งข้อความยาวเป็นชิ้น ≤190 ตัวอักษร
 * ตัดที่ "ขอบคำ" ด้วย Intl.Segmenter (ตัดคำไทยได้จริง) — ห้ามตัดกลางคำ
 * ภาษาไทยไม่มีช่องว่าง วิธีเดิม (lastIndexOf ' ') จึงตัดกลางคำ → เสียงหลุด
 */
export function splitWordSafe(text: string, max: number): string[] {
  if (text.length <= max) return [text]
  // ใช้ Segmenter word granularity; ถ้าไม่มี → fallback ตัดที่ max ตรง ๆ (ไม่แย่กว่าเดิม)
  let segments: string[]
  try {
    const seg = new Intl.Segmenter('th', { granularity: 'word' })
    segments = Array.from(seg.segment(text), (s) => s.segment)
  } catch {
    segments = [text]
  }
  const chunks: string[] = []
  let buf = ''
  for (const word of segments) {
    // คำเดี่ยวยาวเกิน max (ผิดปกติ) → บังคับตัด
    if (word.length > max) {
      if (buf) { chunks.push(buf); buf = '' }
      for (let i = 0; i < word.length; i += max) chunks.push(word.slice(i, i + max))
      continue
    }
    if ((buf + word).length > max && buf) {
      chunks.push(buf)
      buf = word
    } else {
      buf += word
    }
  }
  if (buf) chunks.push(buf)
  return chunks
}

/** รองที่ใช้ได้จริงตอนนี้: Google Translate TTS (ฟรี, ไม่ต้องมี key) — ต่อ mp3 หลายชิ้น */
async function googleTts(text: string): Promise<ArrayBuffer> {
  const chunks = splitWordSafe(text, GOOGLE_CHUNK)
  const parts: Uint8Array[] = []
  for (const [i, c] of chunks.entries()) {
    const url = GOOGLE_TTS_URL + '?ie=UTF-8&tl=th&client=tw-ob&q=' + encodeURIComponent(c) + '&idx=' + i + '&total=' + chunks.length
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    })
    if (!r.ok) throw new Error('google tts ' + r.status)
    parts.push(new Uint8Array(await r.arrayBuffer()))
  }
  let size = 0
  for (const p of parts) size += p.byteLength
  const out = new Uint8Array(size)
  let off = 0
  for (const p of parts) { out.set(p, off); off += p.byteLength }
  if (out.byteLength < 100) throw new Error('google tts empty audio')
  return out.buffer
}

/** หลัก: Edge-TTS (ฟรี 100%) — คืน audio/mpeg bytes */
async function edgeTts(text: string, voice: string): Promise<ArrayBuffer> {
  const tts = new MsEdgeTTS()
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITPRO_MONO_MP3)
  const { audioStream } = tts.toStream(text)
  const chunks: Uint8Array[] = []
  await new Promise<void>((resolve, reject) => {
    audioStream.on('data', (c: Uint8Array) => chunks.push(new Uint8Array(c)))
    audioStream.on('end', () => resolve())
    audioStream.on('close', () => resolve())
    audioStream.on('error', (e: Error) => reject(e))
  })
  try { await (tts as unknown as { close?: () => Promise<void> }).close?.() } catch { }
  let size = 0
  for (const c of chunks) size += c.byteLength
  const out = new Uint8Array(size)
  let off = 0
  for (const c of chunks) { out.set(c, off); off += c.byteLength }
  try { await (tts as unknown as { close?: () => Promise<void> }).close?.() } catch { }
  if (out.byteLength < 100) throw new Error('edge-tts returned empty audio')
  return out.buffer
}

/** รอง: Botnoi Voice API (ต้องมี BOTNOI_API_KEY ใน secrets) */
async function botnoiTts(text: string, apiKey: string): Promise<ArrayBuffer> {
  const r = await fetch(BOTNOI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text, speaker: 'default', volume: 100, speed: 1.0, type_media: 'mp3', save_file: false }),
  })
  if (!r.ok) throw new Error('botnoi ' + r.status)
  const data = await r.json()
  const url = data?.audio_url
  if (!url) throw new Error('botnoi: no audio_url')
  const audio = await fetch(url)
  if (!audio.ok) throw new Error('botnoi audio fetch ' + audio.status)
  return audio.arrayBuffer()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  // auth: รูปแบบเดียวกับ ai-proxy — guest key หรือ user JWT (ไม่มีสิทธิ์ยกระดับใด ๆ)
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/, '')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_DEFAULT_KEY') || ''
  const isGuestKey = (!!anonKey && token === anonKey) || (!!publishableKey && token === publishableKey)
  if (!token || !isGuestKey) {
    // user JWT path: ตรวจกับ auth server (guest key พลาด = ต้องเป็น session JWT จริง)
    const authCheck = await fetch(`${Deno.env.get('SUPABASE_URL') || ''}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    }).catch(() => null)
    if (!authCheck || !authCheck.ok) return json({ error: 'unauthorized' }, 401)
  }

  let payload: { text?: unknown; voice?: unknown }
  try { payload = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
  const text = sanitizeText(payload.text)
  if (!text) return json({ error: 'text required' }, 400)
  const voice = typeof payload.voice === 'string' && /^[\w-]+$/.test(payload.voice) ? payload.voice : DEFAULT_VOICE

  // 1) หลักตาม spec: Edge-TTS (ฟรี — MS บล็อก datacenter ชั่วคราว, เผื่อปลด)
  try {
    const audio = await edgeTts(text, voice)
    return new Response(audio, { headers: { ...CORS, 'Content-Type': 'audio/mpeg' } })
  } catch (e) {
    console.error('voice-tts edge-tts failed:', String(e).slice(0, 200))
  }

  // 2) หลักที่ใช้ได้จริงตอนนี้: Google Translate TTS (ฟรี, ไม่ต้องมี key)
  try {
    const audio = await googleTts(text)
    return new Response(audio, { headers: { ...CORS, 'Content-Type': 'audio/mpeg' } })
  } catch (e) {
    console.error('voice-tts google failed:', String(e).slice(0, 200))
  }

  // 3) รอง: Botnoi (ถ้า owner ตั้ง key)
  const botnoiKey = Deno.env.get('BOTNOI_API_KEY') || ''
  if (botnoiKey) {
    try {
      const audio = await botnoiTts(text, botnoiKey)
      return new Response(audio, { headers: { ...CORS, 'Content-Type': 'audio/mpeg' } })
    } catch (e) {
      console.error('voice-tts botnoi failed:', String(e).slice(0, 200))
    }
  }

  return json({ error: 'tts_unavailable', hint: 'all TTS providers failed; client falls back to browser speechSynthesis' }, 503)
})