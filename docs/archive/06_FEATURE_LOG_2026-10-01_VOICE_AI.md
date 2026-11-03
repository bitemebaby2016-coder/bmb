# FIX/FEATURE LOG — 2026-10-01 (งาน 2): Voice AI Framework (STT → LLM → TTS)

## สถาปัตยกรรมที่ implement (ตาม owner spec)
`Voice Input (STT) → LLM (OpenRouter ผ่าน ai-proxy, key server-side) → Voice Output (TTS)`

| ชั้น | หลัก | รอง | สถานะ live probe 2026-10-01 |
|---|---|---|---|
| STT (ถอดเสียง) | Web Speech API (realtime, latency ต่ำสุด) | **ai-proxy `mode=transcribe`**: `google/gemini-2.5-flash` → whisper-large-v3 ผ่าน Groq (ถ้าตั้ง `GROQ_API_KEY`) | **PASS** — round-trip เสียงไทยถอดกลับได้ถูกต้อง |
| LLM | ระบบเดิม: `chatWithAI({voiceMode:true})` → ai-proxy (Qwen→GLM fallback + guardrail server-side; เปลี่ยนโมเดลได้ที่ env `VITE_OPENROUTER_MODEL`) | — | PASS (เดิม) |
| TTS (สร้างเสียง) | **voice-tts EF**: Edge-TTS → **Google Translate TTS (ฟรี ไม่ต้องมี key)** → Botnoi (ถ้าตั้ง `BOTNOI_API_KEY`) | browser speechSynthesis (fallback ปลายทาง) | **PASS** — 200 audio/mpeg |

## สิ่งที่เปลี่ยน
- **`supabase/functions/voice-tts/` (ใหม่)** — TTS chain server-side; แบ่งข้อความ >190 chars เป็นหลายชิ้นตามประโยค; auth เดียวกับ ai-proxy (guest key / user JWT)
- **`supabase/functions/ai-proxy/`** — เพิ่ม `mode:'transcribe'` (audio base64 → STT model chain); key ไม่หลุด client
- **`src/lib/aiVoice.ts`** — `serverTranscribe()` / `serverSpeak()` + MediaRecorder path (`startRecording`/`stopRecordingAndTranscribe`) สำหรับ browser ที่ไม่มี Web Speech API; `speak()` ใช้ server TTS เมื่อเปิด env
- **`src/lib/aiService.ts`** — persona เสียงตาม spec: พนักงานชาย BiteMeBaby พูดไพเราะติดตลกภาษาไทยธรรมชาติ ตอบสั้น **≤ 2 ประโยค** (realtime latency ต่ำ)
- **`.env.example`** — `VITE_VOICE_SERVER_TTS=1` (เปิด/ปิดเสียง server จาก env ไม่ต้องแก้โค้ด)

## การตรวจสอบ (ทั้งหมดผ่าน)
- `tsc --noEmit` 0 errors · `vitest` **354/354** · `npm run build` PASS
- **Live (prod)**: voice-tts → `200 audio/mpeg` (Edge-TTS โดน MS บล็อก datacenter → Google TTS รับช่วง); STT round-trip: TTS→ai-proxy transcribe → ข้อความตรงความ
- EFs deployed: `ai-proxy`, `voice-tts`

## ข้อจำกัด/ทางต่อยอด
- Edge-TTS: Microsoft ตัด websocket จาก datacenter IP (turn.start→disconnect) — โค้ดพร้อม ใช้ได้ทันทีเมื่อ MS ปลด (เสียงไทย Achara/Anan ธรรมชาติกว่า)
- Botnoi/Groq: ตั้ง key ผ่าน `supabase secrets set BOTNOI_API_KEY=...` / `GROQ_API_KEY=...` — ระบบพร้อมรออยู่แล้ว
- LLM ตาม spec เดิม (Nemotron/Gemini): เปลี่ยนได้จาก env `VITE_OPENROUTER_MODEL` — admin ควบคุมเองไม่ต้องแก้โค้ด

---

# FIX ROUND — 2026-10-01 (owner report: พูด eng + พูดขาดตอน)

| ปัญหาที่รายงาน | สาเหตุที่ตรวจพบ | แก้ด้วย | ทดสอบ |
|---|---|---|---|
| เสียงพูดภาษาอังกฤษ/เพี้ยน | `.env` จริงไม่มี `VITE_VOICE_SERVER_TTS=1` → ใช้ speechSynthesis ของ browser ซึ่งเครื่องไม่มี Thai voice; LLM ตอบผสม eng ได้ | **V1** เปิด server TTS ใน `.env` + **V4** directive บังคับ "ตอบภาษาไทยเท่านั้น" + browser fallback กรองเฉพาะ Thai voice (`pickThaiVoice`) | tsc 0 · vitest 358/358 · build PASS |
| พูดขาดตอนกลางประโยค | Google TTS จำกัด ~200 chars/req — วิธีแบ่ง chunk เดิมหาช่องว่าง แต่ **ไทยไม่มีช่องว่างระหว่างคำ** → ตัดกลางคำ | **V2** แบ่งที่ "ขอบคำ" ด้วย `Intl.Segmenter` (ไฟล์ `splitWordSafe` ทั้ง client + voice-tts EF, deploy แล้ว) + **V3** เล่นเป็นคิว gapless (`playAudioQueue` — ชิ้นถัดไปต่อทันที ไม่มีช่องว่าง; barge-in เคลียร์คิวทั้งหมด) | **V5 live prod**: ข้อความไทยยาว >180 ผ่าน EF → `200 audio/mpeg`; unit test ยืนยันต่อชิ้นได้ข้อความเดิม + ไม่ตัดกลางคำสำคัญ |

- tsconfig: เพิ่ม lib `ES2022.Intl` (type ของ Intl.Segmenter)
- ไฟล์ที่แก้: `.env`, `src/lib/aiVoice.ts`, `src/lib/aiService.ts` (directive), `supabase/functions/voice-tts/index.ts` (deploy แล้ว), `src/__tests__/aiVoiceServer.test.ts`, `src/__tests__/aiVoice.test.ts` (stub env ให้ test deterministic), `tsconfig.json`