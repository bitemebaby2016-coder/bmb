// ============================================
// Bite Me Baby â€” AI Voice (OpenRouter + Web Speech API)
// Primary: nvidia/nemotron-3-ultra-550b-a55b:free
// Fallback: qwen/qwen3.7-flash
// Architecture: Voice Input â†’ STT â†’ AI â†’ Authorized Tools â†’ TTS â†’ Voice Output
// ============================================

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

const DEFAULT_CONFIG: VoiceConfig = {
  model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
  fallbackModel: 'qwen/qwen3.7-flash',
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
  baseUrl: 'https://openrouter.ai/api/v1',
  voice: null,
  language: 'th-TH',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
};// ============================================
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
      onTranscript: (text) => setTranscript(text),
      onResponse: (resp) => {
        setLastResponse(resp);
        setIsSpeaking(false);
      },
      onError: (err) => {
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