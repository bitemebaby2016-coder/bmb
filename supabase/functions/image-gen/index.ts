// ============================================
// Bite Me Baby — image-gen (E5/E6 · Part C 2026-10-22)
// ============================================
// E5: สร้างภาพโปรโมตอัตโนมัติจาก prompt สำเร็จรูป (menu / promo / festival)
// E6: สร้างได้ 3 แนว (realistic / illustration / poster) จากโจทย์เดียวกัน
//     แล้วแอดมินเลือก/ใช้เลย/แก้ prompt ใหม่ได้
//   · คีย์ OpenRouter อยู่ฝั่ง server เท่านั้น — **`BMB_OPENROUTER_API_KEY` = คีย์แยกของงาน
//     คอนเทนต์/เจนรูป/marketing/talk-to-bite** (Owner 2026-10-31) fallback
//     `OPENROUTER_API_KEY` (dev) กันดับ · ห้ามลง client)
//   · รูปที่ได้ = อัปโหลดเข้า site_assets (public-read ตาม m120/122) แล้วคืน
//     URL จริง — ใช้กับ social-publish-worker ได้ทันที (ไม่มี placeholder)
//   · verify_jwt = true (platform กัน anon) + เช็ค role=admin จากโปรไฟล์ผู้เรียก
// ============================================

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
// Owner 2026-10-31: คีย์งานคอนเทนต์/เจนรูป/marketing/talk-to-bite = `BMB_openrouter_api_key`
// (Supabase secret: BMB_OPENROUTER_API_KEY) "แยกจาก dev" — BMB ก่อน · fallback dev กันดับ
const OPENROUTER_KEY = Deno.env.get('BMB_OPENROUTER_API_KEY') || Deno.env.get('OPENROUTER_API_KEY') || ''
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
// โมเดลสร้างภาพ — env `IMAGE_GEN_MODELS` (comma-separated) · fallback หลายชื่อ
// R32: โมเดลเดิมชื่อเดียวโดน retiring ของ OpenRouter = ตายทั้งฟีเจอร์ → วนลองทีละชื่อจนมีรูป
// R41 (Owner 2026-10-31 "ยังติด gemini"): attempts จริงจาก production พิสูจน์ว่า
//   ID คู่แรก (qwen image / bytedance seedream) = "not a valid model ID" / 404 no endpoint → ถอดทั้งคู่
//   (ชื่อที่ Owner เคยเห็น = ไม่ตรงทะเบียน) · list ใหม่ = "เฉพาะโมเดลที่ /api/v1/models ยืนยัน
//   output_modalities=image จริง 12 ตัว" (e2e/r41_models_probe.cjs) เรียงถูก→แพง
const IMAGE_MODEL_CANDIDATES = (Deno.env.get('IMAGE_GEN_MODELS') || Deno.env.get('IMAGE_GEN_MODEL') ||
  'google/gemini-3.1-flash-lite-image,google/gemini-3.1-flash-image,google/gemini-2.5-flash-image,openai/gpt-5-image-mini,openai/gpt-5.4-image-2,google/gemini-3-pro-image')
  .split(',').map((s) => s.trim()).filter(Boolean)

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
// R34 (Owner): รูปอาหาร = ใช้ภาพจริงจากแคตตาลอก (Picker แนบ image_url ให้) — ไม่ต้องเจน
//   → เมนู preset เก็บไว้เฉพาะ back-compat (UI ไม่เสนอ 'menu' แล้ว · เจนได้เฉพาะ promo/festival)
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
  try {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'unauthorized' }, 401)
  if (!(await isAdmin(jwt))) return json({ error: 'ERR_FORBIDDEN' }, 403)
  if (!OPENROUTER_KEY) return json({ error: 'ERR_IMAGE_GEN_UNCONFIGURED', hint: 'set OPENROUTER_API_KEY secret' }, 503)

  let body: { kind?: string; style?: string; subject?: string; note?: string; reference_image_url?: string }
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
  // R39 (Owner): "เอาภาพที่ชี้มาทำร่วมเจนด้วย" — ส่งภาพอ้างอิงเป็น part ที่ 2 ของ message
  // (โมเดลที่รับ image input จะใช้เป็นต้นแบบ · ตัวที่ไม่รับ = HTTP error → วน pass ถัดไปแบบไม่แนบภาพ)
  const refUrl = String(body.reference_image_url || '').trim()

  // 1) สร้างภาพผ่าน OpenRouter — R41: 2 ทางต่อโมเดล
  //   (A) /api/v1/images/generations (ทุกโมเดล image ในทะเบียนมี endpoint นี้) — text-only pass
  //   (B) chat/completions (fallback + ทางเดียวตอนแนบภาพอ้างอิง)
  //   parse รวมทุกรูปทรง response ที่พบ (data[].b64_json/url · message.images[] · content parts · source base64)
  let dataUrl = ''
  let usedModel = ''
  const attempts: string[] = []
  const passes: Array<'with-ref' | 'text-only'> = refUrl ? ['with-ref', 'text-only'] : ['text-only']
  const pickImage = (j: unknown): string => {
    const o = j as Record<string, unknown> | null
    const d0 = Array.isArray(o?.data) ? ((o.data as Array<Record<string, string>>)[0] || null) : null
    if (d0) {
      if (d0.b64_json) return `data:image/png;base64,${d0.b64_json}`
      if (d0.url) return d0.url
      if (d0.image_url) return d0.image_url
    }
    const msg = (o?.choices as Array<Record<string, unknown>> | undefined)?.[0]?.message as Record<string, unknown> | undefined
    if (msg) {
      const imgs = Array.isArray(msg.images) ? (msg.images as Array<Record<string, string>>) : []
      for (const im of imgs) {
        const u = im?.image?.url || im?.image_url?.url || (typeof im?.image_url === 'string' ? im.image_url : '') || im?.url
        if (u) return u
      }
      const parts = Array.isArray(msg.content) ? (msg.content as Array<Record<string, unknown>>) : []
      for (const part of parts) {
        if (part?.type === 'image_url' && (part.image_url as { url?: string })?.url) return (part.image_url as { url: string }).url
        if (part?.type === 'image') {
          const src = part.source as { data?: string; media_type?: string } | undefined
          if (src?.data) return `data:${src.media_type || 'image/png'};base64,${src.data}`
          if (typeof part.image_url === 'string') return part.image_url
        }
        if (typeof part?.text === 'string') {
          const m = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/.exec(part.text)
          if (m) return m[0]
        }
      }
      if (typeof msg.content === 'string') {
        const m = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/.exec(msg.content)
        if (m) return m[0]
      }
    }
    return ''
  }
  try {
    outer: for (const pass of passes) {
      for (const model of IMAGE_MODEL_CANDIDATES) {
        // (A) images API — text-only เท่านั้น (ภาพอ้างอิง = chat path ที่ model รับ input image)
        if (pass === 'text-only') {
          try {
            const ir = await fetch('https://openrouter.ai/api/v1/images/generations', {
              method: 'POST',
              headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model, prompt, n: 1 }),
            })
            const ij = await ir.json().catch(() => null)
            const iu = ir.ok ? pickImage(ij) : ''
            if (iu) { dataUrl = iu; usedModel = `${model} [images-api]`; break outer }
            const imsg = ((ij as { error?: { message?: string } } | null)?.error?.message) || ''
            attempts.push(`${model}:images${ir.status}${imsg ? ' ' + String(imsg).slice(0, 70) : ''}`)
          } catch { attempts.push(`${model}:images_exception`) }
        }
        // (B) chat completions
        const content = pass === 'with-ref'
          ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: refUrl } }]
          : prompt
        const res = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENROUTER_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            modalities: ['image', 'text'],
            messages: [{ role: 'user', content }],
          }),
        })
        const j = await res.json().catch(() => null)
        const u = res.ok ? pickImage(j) : ''
        if (u) { dataUrl = u; usedModel = model; break outer }
        const msgErr = ((j as { error?: { message?: string } } | null)?.error?.message) || ''
        attempts.push(`${model}:chat${res.status}${msgErr ? ' ' + String(msgErr).slice(0, 70) : ''}${res.ok ? ' no_image' : ''}`)
      }
    }
    if (!dataUrl) return json({ error: 'ERR_IMAGE_GEN_FAILED', detail: attempts.join(' · ') || 'no model succeeded', attempts }, 502)
  } catch (e) {
    return json({ error: 'ERR_IMAGE_GEN_FAILED', detail: String(e instanceof Error ? e.message : e).slice(0, 200), attempts }, 502)
  }

  // 2) อัปโหลดเข้า site_assets (public) — ได้ URL จริงไปใช้ต่อทันที
  const isDataUrl = dataUrl.startsWith('data:')
  const mime = isDataUrl ? (dataUrl.match(/^data:([^;]+);/)?.[1] || 'image/png') : 'image/png'
  const ext = mime.includes('jpeg') ? 'jpg' : 'png'
  // R40 (Owner: "ให้ไปอยู่ในอัลบั้มเดียวกันแยกโฟลเดอร์") — เดิม site-assets/marketing = เห็นที่อื่นยาก
  // → bmb-images/ai-generated/ = อัลบั้มเดียวกับภาพแคตตาลอก/browse แยกโฟลเดอร์ชัดเจน (list ได้จาก UI)
  const objectPath = `ai-generated/gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.${ext}`
  try {
    let bytes: Uint8Array
    if (isDataUrl) {
      bytes = Uint8Array.from(atob(dataUrl.split(',')[1] || ''), (c) => c.charCodeAt(0))
    } else {
      bytes = new Uint8Array(await (await fetch(dataUrl)).arrayBuffer())
    }
    const up = await fetch(`${SB_URL}/storage/v1/object/bmb-images/${objectPath}`, {
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

  const publicUrl = `${SB_URL}/storage/v1/object/public/bmb-images/${objectPath}`
  return json({ ok: true, url: publicUrl, kind, style, prompt, model: usedModel, attempts, folder: 'ai-generated' })
  } catch (e) {
    // R40: error ทุกกรณีต้องเป็น JSON ที่ client อ่านได้ — เดิม crash = body ว่าง → Owner เห็นแค่ "non-2xx" ไม่รู้เหตุ
    return json({ error: 'ERR_UNCAUGHT', detail: String(e instanceof Error ? e.message : e).slice(0, 300) }, 500)
  }
})