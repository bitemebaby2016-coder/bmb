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
      .replace(
        /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{2500}-\u{25FF}]/gu,
        ''
      )
      // markdown residue
      .replace(/[*_~`#>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
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

  async speak(text: string): Promise<void> {
    if (!this.synthesis) {
      throw new Error('Speech synthesis not supported in this browser');
    }

    return new Promise((resolve, reject) => {
      this.synthesis!.cancel();

      this.currentUtterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance.lang = this.config.language;
      this.currentUtterance.rate = this.config.rate;
      this.currentUtterance.pitch = this.config.pitch;
      this.currentUtterance.volume = this.config.volume;

      if (this.config.voice) {
        this.currentUtterance.voice = this.config.voice;
      }

      this.isSpeakingFlag = true;

      this.currentUtterance.onend = () => {
        this.isSpeakingFlag = false;
        this.currentUtterance = null;
        resolve();
      };

      this.currentUtterance.onerror = (event) => {
        this.isSpeakingFlag = false;
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
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isSpeakingFlag = false;
    }
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