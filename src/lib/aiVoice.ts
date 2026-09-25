// ============================================
// Bite Me Baby — AI Voice (OpenRouter + Web Speech API)
// Primary: nvidia/nemotron-3-ultra-550b-a55b:free
// Fallback: qwen/qwen3.7-flash
// Architecture: Voice Input → STT → AI → Authorized Tools → TTS → Voice Output
// ============================================

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
  apiKey: string;
  baseUrl: string;
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

const DEFAULT_CONFIG: VoiceConfig = {
  model: import.meta.env.VITE_OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
  fallbackModel: 'qwen/qwen3.7-flash',
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
  baseUrl: 'https://openrouter.ai/api/v1',
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
    if (!this.config.apiKey) {
      return {
        content: '',
        error: 'OpenRouter API key not configured. Please set VITE_OPENROUTER_API_KEY in .env.local',
      };
    }

    this.abortController = new AbortController();
    const messages = [
      {
        role: 'system' as const,
        content: this.buildSystemPrompt(),
      },
      ...this.conversation,
      {
        role: 'user' as const,
        content: text,
      },
    ];

    try {
      const response = await this.callOpenRouter(messages);
      const assistantMessage: VoiceMessage = {
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
      };
      this.conversation.push(
        { role: 'user', content: text, timestamp: Date.now() },
        assistantMessage
      );
      return response;
    } catch (error) {
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private buildSystemPrompt(): string {
    return 'You are the AI Voice Assistant for "Bite Me Baby" — a food delivery service in Thailand.\nLanguage: Thai (th-TH) primary, English secondary.\nTone: Friendly, helpful, concise.\n\nCAPABILITIES (read-only tools you can call via function calling):\n- list_menu: Get current menu with prices, availability\n- get_product: Get details for a specific product\n- check_delivery: Check if address is within 5km delivery zone, get fee & ETA\n- get_order_status: Get status of an order by order_id\n- list_promotions: Get active promotions\n- get_kitchen_summary: Get kitchen workload summary (admin)\n- list_drivers: List available drivers (admin)\n- list_recipes: List recipes (admin)\n\nGUARDRAILS:\n- NEVER promise, modify, or confirm prices/stock/payment — these are server-authoritative.\n- NEVER create orders or process payments — user must use the app UI.\n- If user asks for write operations, politely decline and direct them to the app.\n- Keep responses short and conversational for voice.\n- Always respond in Thai unless user speaks English.';
  }

  private async callOpenRouter(messages: Array<{ role: string; content: string }>): Promise<VoiceResponse> {
    const controller = this.abortController;
    const modelsToTry = [this.config.model, this.config.fallbackModel].filter(Boolean);

    for (const model of modelsToTry) {
      if (controller?.signal.aborted) break;

      try {
        const response = await fetch(this.config.baseUrl + '/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + this.config.apiKey,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Bite Me Baby AI Voice',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            max_tokens: 500,
          }),
          signal: controller?.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error('OpenRouter error (' + response.status + '): ' + (errorData.error?.message || response.statusText));
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        return { content: content.trim() };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') break;
        if (model === modelsToTry[modelsToTry.length - 1]) throw error;
      }
    }

    throw new Error('All models failed');
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