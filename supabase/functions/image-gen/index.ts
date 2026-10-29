// ============================================
// Bite Me Baby — image-gen (E5/E6 · Part C 2026-10-22)
// ============================================
// E5: สร้างภาพโปรโมตอัตโนมัติจาก prompt สำเร็จรูป (menu / promo / festival)
// E6: สร้างได้ 3 แนว (realistic / illustration / poster) จากโจทย์เดียวกัน
//     แล้วแอดมินเลือก/ใช้เลย/แก้ prompt ใหม่ได้
//   · คีย์ OpenRouter อยู่ฝั่ง server เท่านั้น (OPENROUTER_API_KEY — ชุดเดียว
//     กับ ai-proxy; ห้ามลง client)
//   · รูปที่ได้ = อัปโหลดเข้า site_assets (public-read ตาม m120/122) แล้วคืน
//     URL จริง — ใช้กับ social-publish-worker ได้ทันที (ไม่มี placeholder)
//   · verify_jwt = true (platform กัน anon) + เช็ค role=admin จากโปรไฟล์ผู้เรียก
// ============================================

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const OPENROUTER_KEY = Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('BMB_OPENROUTER_API_KEY') || ''
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
// โมเดลสร้างภาพ — ตั้งค่าผ่าน env (ห้าม hardcode ในโค้ด logic)
const IMAGE_MODEL = Deno.env.get('IMAGE_GEN_MODEL') || 'google/gemini-2.5-flash-image-preview'

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}

// E5: prompt สำเร็จรูปตามประเภทงาน (แอดมินแค่เลือก+ใส่ชื่อสินค้า/หัวข้อ)
const KIND_PRESETS: Record<string, (subject: string, note: string) => string> = {
  menu: (subject, note) =>
    `ภาพอาหารจานเด็ด "${subject}" สำหรับเมนูร้านของหวาน Bite Me Baby — ภาพถ่ายเมนู มุม 45 องศา แสงธรรมชาตินุ่ม ดูน่ากิน พื้นหลังสะอาด ไม่มีตัวอักษร${note ? ' · ' + note : ''}`,
  promo: (subject, note) =>
    `ป้ายโปรโมต "${subject}" สำหรับร้านของหวาน Bite Me Baby — ดีไซน์ดึงดูด สีสดใส จุดเด่นที่ข้อเสนอ พื้นที่ว่างสำหรับข้อความ ไม่มีตัวอักษรยาว${note ? ' · ' + note : ''}`,
  festival: (subject, note) =>
    `ภาพบรรยากาศเทศกาล "${subject}" โทนอบอุ่น สนุก ฉลอง สำหรับโปรโมทร้านของหวานไทย Bite Me Baby — องค์ประกอบเทศกาลชัดเจน ไม่มีตัวอักษร${note ? ' · ' + note : ''}`,
}

// E6: 3 แนวจากโจทย์เดียวกัน
const STYLE_MODIFIERS: Record<string, string> = {
  realistic: 'สไตล์ภาพถ่ายสมจริง แสงนุ่ม รายละเอียดสูง สมดุลสีธรรมชาติ',
  illustration: 'สไตล์ภาพประกอบสีน้ำน่ารัก ลายเส้นละมุน พาสเทล',
  poster: 'สไตล์กราฟิกป้ายโฆษณา รูปทรงหนา คอนทราสต์สูง ดูทันสมัย',
}

async function isAdmin(jwt: string): Promise<boolean> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/profiles?select=role`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${jwt}` },
    })
    if (!res.ok) return false
    const rows = (await res.json()) as Array<{ role?: string | null }>
    return rows.length > 0 && rows[0].role === 'admin'
  } catch {
    return false
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  // R21 Phase 4 EF audit (live probe 2026-10-29): OPTIONS เดิมตอบ 200 "ok"
// โดยไม่มีหัว CORS → browser preflight จาก biteme-baby.com ถูกบล็อก
// (AdminMarketing → image-gen invoke ไม่ผ่าน) — ตอบ CORS ทุกเมธอดเสมอ
if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders() })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'unauthorized' }, 401)
  if (!(await isAdmin(jwt))) return json({ error: 'ERR_FORBIDDEN' }, 403)
  if (!OPENROUTER_KEY) return json({ error: 'ERR_IMAGE_GEN_UNCONFIGURED', hint: 'set OPENROUTER_API_KEY secret' }, 503)

  let body: { kind?: string; style?: string; subject?: string; note?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  const kind = String(body.kind || '')
  const style = String(body.style || '')
  const subject = String(body.subject || '').trim()
  if (!KIND_PRESETS[kind]) return json({ error: 'ERR_INVALID_KIND' }, 400)
  if (!STYLE_MODIFIERS[style]) return json({ error: 'ERR_INVALID_STYLE' }, 400)
  if (!subject) return json({ error: 'ERR_MISSING_SUBJECT' }, 400)

  const prompt = KIND_PRESETS[kind](subject, String(body.note || '')) + ' — ' + STYLE_MODIFIERS[style]

  // 1) สร้างภาพผ่าน OpenRouter (modalities image)
  let dataUrl = ''
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        modalities: ['image', 'text'],
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok || !j) return json({ error: 'ERR_IMAGE_GEN_FAILED', detail: `HTTP ${res.status}` }, 502)
    const msg = (j as { choices?: Array<{ message?: { images?: Array<{ image?: { url?: string } }>; content?: unknown } }> }).choices?.[0]?.message
    dataUrl = msg?.images?.[0]?.image?.url || ''
    if (!dataUrl && Array.isArray(msg?.content)) {
      for (const part of msg.content as Array<{ type?: string; image_url?: { url?: string } }>) {
        if (part.type === 'image_url' && part.image_url?.url) { dataUrl = part.image_url.url; break }
      }
    }
    if (!dataUrl) return json({ error: 'ERR_IMAGE_EMPTY', detail: 'model returned no image' }, 502)
  } catch (e) {
    return json({ error: 'ERR_IMAGE_GEN_FAILED', detail: String(e instanceof Error ? e.message : e).slice(0, 200) }, 502)
  }

  // 2) อัปโหลดเข้า site_assets (public) — ได้ URL จริงไปใช้ต่อทันที
  const isDataUrl = dataUrl.startsWith('data:')
  const mime = isDataUrl ? (dataUrl.match(/^data:([^;]+);/)?.[1] || 'image/png') : 'image/png'
  const ext = mime.includes('jpeg') ? 'jpg' : 'png'
  const objectPath = `marketing/gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.${ext}`
  try {
    let bytes: Uint8Array
    if (isDataUrl) {
      bytes = Uint8Array.from(atob(dataUrl.split(',')[1] || ''), (c) => c.charCodeAt(0))
    } else {
      bytes = new Uint8Array(await (await fetch(dataUrl)).arrayBuffer())
    }
    const up = await fetch(`${SB_URL}/storage/v1/object/site-assets/${objectPath}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        'Content-Type': mime,
        'x-upsert': 'true',
      },
      body: bytes,
    })
    if (!up.ok) return json({ error: 'ERR_IMAGE_UPLOAD_FAILED', detail: `HTTP ${up.status}` }, 502)
  } catch (e) {
    return json({ error: 'ERR_IMAGE_UPLOAD_FAILED', detail: String(e instanceof Error ? e.message : e).slice(0, 200) }, 502)
  }

  const publicUrl = `${SB_URL}/storage/v1/object/public/site-assets/${objectPath}`
  return json({ ok: true, url: publicUrl, kind, style, prompt })
})