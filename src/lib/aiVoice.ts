// ============================================
// Bite Me Baby — AI Voice (Web Speech API + ai-proxy)
// Primary: qwen/qwen3.7-flash
// Fallback: z-ai/glm-5.3-flash
// Architecture: Voice Input → STT → chatWithAI (ai-proxy, server-side key) → TTS
// F-17 FIX (Wave 1): NO OpenRouter API key on the client. The key lives ONLY in
// the ai-proxy Edge Function env — voice requests ride the same JWT-authenticated
// proxy as chat (Client → Supabase Auth JWT → ai-proxy → OpenRouter).
// WS-2 (2026-10-01): ประวัติเสียงเดินระบบเดียวกับ conversationHistory ของ
// aiService (sendTextMessage ไปที่ chatWithAI({ voiceMode: true })) — ไม่แยก
// ระบบคู่ขนาน; ตอบผ่าน voice-mode prompt สั้นกระชับ + guardrail เดิมครอบเสียง
// ============================================

// WS-2: supabase client ไม่ถูกใช้แล้วตรงนี้ — การเรียก AI ไปที่ chatWithAI
// (aiService) ซึ่งจัดการ ai-proxy + JWT + fallback ให้เอง
import { chatWithAI } from './aiService'
import { supabase } from './supabase'

// Web Speech API types (not in standard lib.dom.d.ts)
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognition;
    SpeechRecognition: new () => SpeechRecognition;
  }
}

export interface VoiceConfig {
  model: string;
  fallbackModel: string;
  voice: SpeechSynthesisVoice | null;
  language: string;
  rate: number;
  pitch: number;
  volume: number;
}

export interface VoiceMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface VoiceResponse {
  content: string;
  toolCalls?: ToolCall[];
  error?: string;
}

export interface AIVoiceCallbacks {
  onTranscript: (text: string) => void;
  onResponse: (response: VoiceResponse) => void;
  onError: (error: Error) => void;
}

// ============================================
// WS-2b/c: browser support helpers (graceful fallback)
// Web Speech API เต็มรูปแบบใช้ได้บน Chrome/Edge; Firefox/iOS บางส่วนไม่รองรับ
// → UI ต้องซ่อนปุ่มไมค์และพิมพ์ต่อได้ปกติ ห้ามพัง UX เดิม
// ============================================
export function isSpeechRecognitionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  )
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function isVoiceSupported(): boolean {
  return isSpeechRecognitionSupported() && isSpeechSynthesisSupported()
}

// ============================================
// WS-2c: กรองข้อความก่อนพูด — ตัด markdown/emoji/สัญลักษณ์ที่อ่านไม่ได้
// ============================================
export function speakableText(text: string): string {
  return (
    text
      // code blocks / inline code → เก็บเฉพาะข้อความใน code
      .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-z]*\n?/gi, '').replace(/```/g, ' '))
      .replace(/`([^`]+)`/g, '$1')
      // markdown: headers, bold/italic, links (เก็บ label), bullets, blockquote, tables
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^\s*[-*•]\s+/gm, '')
      .replace(/^\s*\|.*\|\s*$/gm, (m) => m.replace(/\|/g, ' '))
      .replace(/^>\s?/gm, '')
      // emoji / pictographs / สัญลักษณ์ตกแต่ง (อ่าน TTS ได้แปลกหรือไม่อ่าน)
      // หมายเหตุ: variation selectors (U+FE00-FE0F) แยก replace เพราะ eslint
      // no-misleading-character-class ห้ามใส่ combining char ใน character class
      .replace(/\uFE0F/g, '')
      .replace(
        /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{2500}-\u{25FF}]/gu,
        ''
      )
      // markdown residue
      .replace(/[*_~`#>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
    // TTS safety: ถ้าข้อความมีภาษาไทย ห้ามมี Latin "Bite"/"Bite Me Baby" หลงเหลือ —
    // เอนจินอ่านเป็น /bit/ ("บิท") ผิดทุกครั้ง → แทนด้วยการออกเสียงไทยที่ถูกต้อง
    // รูปชื่อไทยทุกเวอร์ชัน (ไบ๊ท์ / ไบท๊ / ไบท์) → "ไบท": วรรณยุกต์ ๊ ติดไม้หัวอากาศ ท์
    // ทำให้เอนจินไทยอ่านชื่อเพี้ยน (owner report: ออกมาเป็น "บั๊บ") — เขียนบนหน้ายังคงรูปเดิม
    .replace(/Bite Me Baby/gi, (m, _offset, whole: string) =>
      /[\u0E00-\u0E7F]/.test(whole) ? 'ไบทมีเบบี้' : m)
    .replace(/\bBite\b/g, (m, _offset, whole: string) =>
      /[\u0E00-\u0E7F]/.test(whole) ? 'ไบท' : m)
    .replace(/ไบ๊ท์|ไบ๊ท|ไบท๊|ไบท์/g, 'ไบท')
}

// WS-2c: จำการตั้งค่าเปิด/ปิดเสียงตอบ (localStorage — aiMemory ไม่มี key นี้)
const VOICE_REPLY_ENABLED_KEY = 'bmb_voice_reply_enabled'

export function isVoiceReplyEnabled(): boolean {
  try {
    return localStorage.getItem(VOICE_REPLY_ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function setVoiceReplyEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(VOICE_REPLY_ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    /* storage unavailable — ปุ่มยังใช้ได้ใน session เดียว */
  }
}

const DEFAULT_CONFIG: VoiceConfig = {
  model: import.meta.env.VITE_OPENROUTER_MODEL || 'qwen/qwen3.7-flash',
  fallbackModel: 'z-ai/glm-5.3-flash',
  voice: null,
  language: 'th-TH',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
};

// ============================================
// WS-2f (2026-10-01 owner spec): server-side STT/TTS chains
// STT: ai-proxy mode=transcribe (gemini-2.5-flash → whisper-large-v3/Groq)
// TTS: voice-tts EF (Edge-TTS ฟรี → Botnoi) — key ทั้งหมด server-side
// ทุก path ล้มเหลว → client fallback Web Speech API เดิม (ระบบไม่ตาย)
// ============================================

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('read blob failed'))
    reader.readAsDataURL(blob)
  })
}

/** STT ผ่าน ai-proxy (server key) — ใช้เมื่อ Web Speech API ไม่รองรับ */
export async function serverTranscribe(blob: Blob): Promise<string> {
  const audioBase64 = await blobToBase64(blob)
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: { mode: 'transcribe', audioBase64, mimeType: blob.type || 'audio/webm' },
  })
  if (error) throw new Error(error.message || 'STT request failed')
  const text = data?.text
  if (!text || text === '[ไม่ได้ยิน]') throw new Error('stt_empty')
  return String(text)
}

/** TTS ผ่าน voice-tts EF (Edge-TTS หลัก / Botnoi รอง) — คืน blob เสียง mp3 */
const SERVER_TTS_CHUNK = 180 // ต่ำกว่าขีดจำกัด Google TTS (~200) เผื่อ padding

/**
 * V2 FIX (owner report: พูดขาดตอน): แบ่งข้อความยาวเป็นชิ้นตัดที่ "ขอบคำ" ด้วย
 * Intl.Segmenter — ภาษาไทยไม่มีช่องว่าง วิธีหาช่องว่างตัดกลางคำเสมอ → เสียงหลุด
 * ทดสอบได้ offline (unit test) และใช้จริงใน serverSpeak (V3 เล่นเป็นคิว gapless)
 */
export function splitWordSafe(text: string, max: number): string[] {
  if (text.length <= max) return [text]
  let segments: string[]
  try {
    const seg = new Intl.Segmenter('th', { granularity: 'word' })
    segments = Array.from(seg.segment(text), (s) => s.segment)
  } catch {
    segments = [text] // ไม่มี Segmenter → ตรง ๆ (ไม่แย่กว่าเดิม)
  }
  const chunks: string[] = []
  let buf = ''
  for (const word of segments) {
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

/**
 * V4 FIX (owner report: พูด eng): เลือกเสียงไทยเท่านั้นจาก browser —
 * เครื่องที่ไม่มี Thai voice จะอ่านไทยด้วยเสียงอังกฤษเพี้ยน ๆ
 * คืน null = ไม่มี Thai voice → caller ควรใช้ server TTS แทน
 */
export function pickThaiVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  return voices.find((v) => v.lang?.toLowerCase().startsWith('th')) || null
}

export async function serverSpeak(text: string, voice?: string): Promise<Blob> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-tts`
  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers.Authorization = `Bearer ${token}`
    if (anonKey) headers.apikey = anonKey
  } else if (anonKey) {
    headers.Authorization = `Bearer ${anonKey}`
    headers.apikey = anonKey
  }
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ text: speakableText(text), voice }) })
  if (!r.ok) throw new Error('voice-tts ' + r.status)
  return r.blob()
}

export function isMediaRecorderSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

// ============================================
// AIVoiceService Class
// ============================================
export class AIVoiceService {
  private config: VoiceConfig;
  private callbacks: AIVoiceCallbacks | null = null;
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private conversation: VoiceMessage[] = [];
  private isListeningFlag = false;
  private isSpeakingFlag = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  /** V3: คิวเสียง gapless — ชิ้นถัดไปเล่นทันทีเมื่อชิ้นปัจจุบันจบ */
  private audioQueue: Blob[] = [];
  private queueActive = false;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private abortController: AbortController | null = null;

  constructor(config?: Partial<VoiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initSpeechRecognition();
    this.initSpeechSynthesis();
  }

  private initSpeechRecognition(): void {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition!.lang = this.config.language;
      this.recognition!.continuous = true;
      this.recognition!.interimResults = true;
      this.recognition!.maxAlternatives = 1;

      this.recognition!.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript && this.callbacks) {
          this.callbacks.onTranscript(finalTranscript.trim());
        }
      };

      this.recognition!.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (this.callbacks && event.error !== 'no-speech' && event.error !== 'aborted') {
          this.callbacks.onError(new Error('Speech recognition error: ' + event.error));
        }
        this.isListeningFlag = false;
      };

      this.recognition!.onend = () => {
        this.isListeningFlag = false;
      };
    }
  }

  private initSpeechSynthesis(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    }
  }

  setCallbacks(callbacks: AIVoiceCallbacks): void {
    this.callbacks = callbacks;
  }

  startListening(): boolean {
    if (!this.recognition) {
      this.callbacks?.onError(new Error('Speech recognition not supported in this browser'));
      return false;
    }
    if (this.isListeningFlag) return false;

    // WS-2c barge-in: เริ่มพูดใหม่ = หยุดเสียง AI ทันที (ลูกค้าขัดจังหวะได้)
    if (this.isSpeakingFlag) this.stopSpeaking();

    this.isListeningFlag = true;
    try {
      this.recognition.start();
      return true;
    } catch (e) {
      this.isListeningFlag = false;
      this.callbacks?.onError(e as Error);
      return false;
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListeningFlag) {
      this.recognition.stop();
      this.isListeningFlag = false;
    }
  }

  isListening(): boolean {
    return this.isListeningFlag;
  }

  isSpeaking(): boolean {
    return this.isSpeakingFlag;
  }

  async sendTextMessage(text: string): Promise<VoiceResponse> {
    // WS-2 (2026-10-01): ประวัติเสียงเดินระบบเดียวกับ chat — เรียก chatWithAI
    // (voice mode) ที่รวม DB context + ใช้ ai-proxy + fallback chain เดิมแล้ว
    // F-17: ไม่มี key ฝั่ง client ทั้งหมด (ai-proxy ออก key server-side)
    this.abortController = new AbortController();
    try {
      const content = await chatWithAI(text, undefined, { voiceMode: true });
      this.conversation.push(
        { role: 'user', content: text, timestamp: Date.now() },
        { role: 'assistant', content, timestamp: Date.now() }
      );
      return { content };
    } catch (error) {
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // V3/V4: token ของ "เสียงที่มีสิทธิ์เล่น" — เรียก speak/stop ใหม่ทีไรค่าเปลี่ยนทันที
  // ทำให้ await ค้างจาก network เก่าหมดสิทธิ์ (กัน two-voice overlap)
  private speakToken = 0

  async speak(text: string): Promise<void> {
    // Serialize: ยกเลิกเสียง/คิวที่กำลังเล่นอยู่ก่อนเสมอ — หนึ่งข้อความ = หนึ่งเสียง
    this.stopSpeaking()
    const token = ++this.speakToken
    const stale = () => token !== this.speakToken

    // WS-2f: server TTS (Edge-TTS หลัก / Google TTS / Botnoi รอง) — เปิดผ่าน env
    // VITE_VOICE_SERVER_TTS=1 หรือ AUTO: เครื่องไม่มี Thai voice → ใช้ server เอง
    // (แก้ owner report 2026-10-01: เครื่องที่ไม่มี Thai voice อ่านไทยเป็น eng เพี้ยน
    //  และ production build บน Cloudflare ไม่ต้องตั้ง env ก็ได้เสียงไทยที่ถูกต้อง)
    const envTts = String(import.meta.env.VITE_VOICE_SERVER_TTS ?? '')
    const serverTtsEnabled =
      envTts === '1' || (envTts !== '0' && !!import.meta.env.VITE_SUPABASE_URL && !pickThaiVoice())
    if (serverTtsEnabled) {
      try {
        // V2/V3: แบ่งที่ขอบคำฝั่ง client แล้วเล่นเป็นคิวต่อเนื่อง (gapless) —
        // ข้อความสั้น = ชิ้นเดียวเหมือนเดิม; ยาว >180 = หลายชิ้นไม่มีช่องว่างพูด
        const blobs = await this.serverSpeakChunks(text)
        if (stale()) return // เสียงใหม่แทรกมาขณะดึง blob → เงียบ ๆ ปล่อยเสียงใหม่เล่น
        await this.playAudioQueue(blobs, token)
        return
      } catch {
        if (stale()) return
        /* fall through to browser TTS */
      }
    }
    if (!this.synthesis) {
      throw new Error('Speech synthesis not supported in this browser');
    }
    if (stale()) return

    return new Promise((resolve, reject) => {
      this.synthesis!.cancel();

      this.currentUtterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance.lang = this.config.language;
      this.currentUtterance.rate = this.config.rate;
      this.currentUtterance.pitch = this.config.pitch;
      this.currentUtterance.volume = this.config.volume;

      const thaiVoice = this.config.voice || pickThaiVoice()
      if (thaiVoice) {
        this.currentUtterance.voice = thaiVoice;
      }

      this.isSpeakingFlag = true;

      this.currentUtterance.onend = () => {
        if (token === this.speakToken) this.isSpeakingFlag = false;
        this.currentUtterance = null;
        resolve();
      };

      this.currentUtterance.onerror = (event) => {
        if (token === this.speakToken) this.isSpeakingFlag = false;
        this.currentUtterance = null;
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          reject(new Error('Speech synthesis error: ' + event.error));
        } else {
          resolve();
        }
      };

      this.synthesis!.speak(this.currentUtterance);
    });
  }

  stopSpeaking(): void {
    this.speakToken++ // เสียงที่กำลังส่ง/ค้างอยู่หมดสิทธิ์ทันที
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isSpeakingFlag = false;
    }
    this.audioQueue = [] // V3: เคลียร์คิว — barge-in หยุดทันทีทั้งคิว
    this.queueActive = false
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
      this.isSpeakingFlag = false;
    }
  }

  /** WS-2f: เล่น mp3 จาก voice-tts EF (barge-in ได้ผ่าน stopSpeaking) */
  /**
 * V2/V3 (owner report: พูดขาดตอน): แบ่งข้อความที่ "ขอบคำ" (Intl.Segmenter) แล้ว
 * ดึงเสียงทีละชิ้นจาก voice-tts EF — ชิ้นสั้น ≤180 จึงไม่เจอการตัดกลางคำใน EF
 */
  private async serverSpeakChunks(text: string): Promise<Blob[]> {
    const chunks = splitWordSafe(text, SERVER_TTS_CHUNK)
    const blobs: Blob[] = []
    for (const c of chunks) blobs.push(await serverSpeak(c))
    return blobs
  }

  /**
   * V3: เล่นเป็นคิวต่อเนื่อง (gapless) — ชิ้นถัดไปเริ่มทันทีเมื่อชิ้นปัจจุบันจบ
   * stopSpeaking (barge-in) เคลียร์คิว = หยุดทันทีทั้งประโยค
   */
  private playAudioQueue(blobs: Blob[], token: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (blobs.length === 0) { resolve(); return }
      this.audioQueue = [...blobs]
      this.queueActive = true
      const next = () => {
        // barge-in / เสียงใหม่แทรก → หยุดคิวนี้เงียบ ๆ (หมดสิทธิ์เล่น)
        if (!this.queueActive || token !== this.speakToken) { resolve(); return }
        const blob = this.audioQueue.shift()
        if (!blob) { this.queueActive = false; this.isSpeakingFlag = false; resolve(); return }
        this.playAudioBlob(blob)
          .then(() => { this.currentAudio = null; next() })
          .catch((e) => {
            if (token !== this.speakToken) { resolve(); return } // เสียงใหม่接管แล้ว → เงียบ
            this.queueActive = false; this.audioQueue = []; this.isSpeakingFlag = false; this.currentAudio = null; reject(e)
          })
      }
      this.isSpeakingFlag = true
      next()
    })
  }

  private playAudioBlob(blob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      this.currentAudio = audio
      this.isSpeakingFlag = true
      const done = () => {
        URL.revokeObjectURL(url)
        this.currentAudio = null
        this.isSpeakingFlag = false
        resolve()
      }
      audio.onended = done
      audio.onerror = () => { URL.revokeObjectURL(url); this.currentAudio = null; this.isSpeakingFlag = false; reject(new Error('audio playback failed')) }
      audio.play().catch((e) => { URL.revokeObjectURL(url); this.currentAudio = null; this.isSpeakingFlag = false; reject(e as Error) })
    })
  }

  /** WS-2f: STT fallback path — บันทึกเสียง (browser ที่ไม่มี Web Speech API) */
  async startRecording(): Promise<boolean> {
    if (!isMediaRecorderSupported()) {
      this.callbacks?.onError(new Error('MediaRecorder not supported in this browser'))
      return false
    }
    if (this.isListeningFlag) return false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.recordedChunks = []
      this.mediaRecorder = new MediaRecorder(stream)
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data)
      }
      this.mediaRecorder.start()
      this.isListeningFlag = true
      return true
    } catch (e) {
      this.callbacks?.onError(e as Error)
      return false
    }
  }

  /** หยุดบันทึก → ถอดเสียงผ่าน ai-proxy (gemini → whisper) แล้วคืนข้อความ */
  async stopRecordingAndTranscribe(): Promise<string | null> {
    const rec = this.mediaRecorder
    if (!rec) return null
    return new Promise((resolve) => {
      rec.onstop = async () => {
        rec.stream.getTracks().forEach((t) => t.stop())
        this.isListeningFlag = false
        try {
          const blob = new Blob(this.recordedChunks, { type: rec.mimeType || 'audio/webm' })
          const text = await serverTranscribe(blob)
          this.callbacks?.onTranscript(text)
          resolve(text)
        } catch (e) {
          this.callbacks?.onError(e as Error)
          resolve(null)
        }
      }
      rec.stop()
    })
  }

  clearConversation(): void {
    this.conversation = [];
    this.stopSpeaking();
    this.stopListening();
  }

  getConversation(): VoiceMessage[] {
    return [...this.conversation];
  }

  setVoice(voice: SpeechSynthesisVoice): void {
    this.config.voice = voice;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (this.synthesis) {
      return this.synthesis.getVoices();
    }
    return [];
  }
}

// ============================================
// Singleton Instance
// ============================================
let aiVoiceInstance: AIVoiceService | null = null;

export function getAIVoiceService(config?: Partial<VoiceConfig>): AIVoiceService {
  if (!aiVoiceInstance) {
    aiVoiceInstance = new AIVoiceService(config);
  }
  return aiVoiceInstance;
}

export function resetAIVoiceService(): void {
  aiVoiceInstance = null;
}

// ============================================
// React Hook
// ============================================
import { useState, useEffect } from 'react';

export function useAIVoice(config?: Partial<VoiceConfig>) {
  const [service] = useState(() => getAIVoiceService(config));
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState<VoiceResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    service.setCallbacks({
      onTranscript: (text: string) => setTranscript(text),
      onResponse: (resp: VoiceResponse) => {
        setLastResponse(resp);
        setIsSpeaking(false);
      },
      onError: (err: Error) => {
        setError(err);
        setIsListening(false);
        setIsSpeaking(false);
      },
    });

    const interval = setInterval(() => {
      setIsSpeaking(service.isSpeaking());
    }, 100);

    return () => clearInterval(interval);
  }, [service]);

  const startListening = () => {
    if (service.startListening()) {
      setIsListening(true);
      setError(null);
    }
  };

  const stopListening = () => {
    service.stopListening();
    setIsListening(false);
  };

  const sendMessage = async (text: string) => {
    const response = await service.sendTextMessage(text);
    setLastResponse(response);
    return response;
  };

  const speak = async (text: string) => {
    setIsSpeaking(true);
    await service.speak(text);
    setIsSpeaking(false);
  };

  return {
    service,
    isListening,
    isSpeaking,
    transcript,
    lastResponse,
    error,
    startListening,
    stopListening,
    sendMessage,
    speak,
    clearConversation: () => service.clearConversation(),
  };
}