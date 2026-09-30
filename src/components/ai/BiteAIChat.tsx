// ============================================
// Bite Me Baby — Bite AI Full-Screen Chat (Stage 4)
// ============================================
// Grows from the mascot anchor into a full-screen contextual chat. The active
// UI state (user name, cart contents, viewport category) is piped into the AI
// context payload so the conversation continues naturally.
//
// 🛡️ Security boundary: this prompt loop may ONLY emit `EXECUTE_ADD_TO_CART`.
// It holds zero authorization over stock decrements or financial layers —
// everything funnels through the platform's standard validation routes.

import { useEffect, useRef, useState } from 'react'
import { useBiteAIStore } from '@/stores/useBiteAIStore'
import { GlassCard } from '@/components/ui/GlassCard'
import { chatWithAI } from '@/lib/aiService'
import {
  getAIVoiceService,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  isVoiceReplyEnabled,
  setVoiceReplyEnabled,
  speakableText,
  type AIVoiceService,
} from '@/lib/aiVoice'

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface BiteAIChatProps {
  /** Injectable responder for deterministic tests / custom backends. */
  sendMessage?: (text: string, voiceMode?: boolean) => Promise<string>
}

export function BiteAIChat({ sendMessage = defaultSend }: BiteAIChatProps) {
  const chatOpen = useBiteAIStore((s) => s.chatOpen)
  const fullContext = useBiteAIStore((s) => s.fullContext)
  const closeChat = useBiteAIStore((s) => s.closeChat)

  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voiceReply, setVoiceReply] = useState(isVoiceReplyEnabled())
  const micSupported = isSpeechRecognitionSupported()
  const ttsSupported = isSpeechSynthesisSupported()
  const voiceRef = useRef<AIVoiceService | null>(null)
  const voiceInputRef = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chatOpen || !micSupported) return
    const service = getAIVoiceService()
    voiceRef.current = service
    service.setCallbacks({
      // WS-2d: transcript ไหลเข้าช่อง input เหมือนพิมพ์ → กดส่งเองหรือรอประโยคสุดท้าย
      onTranscript: (text) => {
        voiceInputRef.current = true
        setInput(text)
      },
      onResponse: () => {},
      onError: () => setListening(false),
    })
    // barge-in + สถานะพูด (poll เบา ๆ — synthesis API ไม่มี event แบบ reactive)
    const interval = window.setInterval(() => setSpeaking(service.isSpeaking()), 150)
    return () => {
      window.clearInterval(interval)
      service.stopListening()
      service.stopSpeaking()
      voiceRef.current = null
    }
  }, [chatOpen, micSupported])

  useEffect(() => {
    if (chatOpen) {
      setMessages([
        {
          id: 'ctx',
          role: 'assistant',
          content: fullContext ? `[Context] ${fullContext}\n\nสวัสดีค่ะ น้อง Bite พร้อมช่วยต่อจากบนหน้าจอเลย 🍊` : 'สวัสดีค่ะ น้อง Bite พร้อมช่วยคุณแล้วนะ 🍊',
        },
      ])
    }
  }, [chatOpen, fullContext])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  if (!chatOpen) return null

  function toggleMic() {
    const service = voiceRef.current
    if (!service) return
    if (listening) {
      service.stopListening()
      setListening(false)
    } else {
      if (service.startListening()) setListening(true)
    }
  }

  function toggleVoiceReply() {
    const next = !voiceReply
    setVoiceReply(next)
    setVoiceReplyEnabled(next)
    if (!next) voiceRef.current?.stopSpeaking()
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || typing) return
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    const fromVoice = voiceInputRef.current
    voiceInputRef.current = false
    if (listening) {
      voiceRef.current?.stopListening()
      setListening(false)
    }
    setTyping(true)
    try {
      // WS-2e: ข้อความที่มาจากไมค์ หรือเมื่อเปิดเสียงตอบ → ใช้ voice mode (ตอบสั้นแบบพูด)
      const reply = await sendMessage(`${fullContext ? `[Context: ${fullContext}] ` : ''}${text}`, fromVoice || voiceReply)
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: reply }])
      // WS-2c: อ่านคำตอบด้วยเสียงเมื่อผู้ใช้เปิดลำโพง (กรอง markdown/emoji ก่อนพูด)
      if (voiceReply && ttsSupported) {
        await voiceRef.current?.speak(speakableText(reply))
      }
    } finally {
      setTyping(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-gradient-to-b from-brand-bg to-brand-surface-warm"
      role="dialog"
      aria-modal="true"
      aria-label="Bite AI แชทเต็มหน้าจอ"
      data-testid="bite-ai-chat"
    >
      <header className="flex items-center gap-3 px-4 py-3 bg-white/70 backdrop-blur-md border-b border-white/20">
        <GlassCard className="!p-0 w-11 h-11 flex items-center justify-center text-2xl">🐻</GlassCard>
        <div className="flex-1">
          <h2 className="font-bold text-slate-800 leading-tight">Bite AI — 4-Stage Assistant</h2>
          <p className="text-xs text-slate-500" data-testid="bite-ai-status">
            {listening ? '🎤 กำลังฟัง...' : typing ? 'กำลังคิด...' : speaking ? '🔊 กำลังพูด...' : 'โหมด Full-Screen Chat (Stage 4)'}
          </p>
        </div>
        <button onClick={closeChat} className="btn btn-outline text-sm" data-testid="bite-ai-close">
          ปิด
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-brand-primary text-white'
                  : 'bg-white/80 backdrop-blur-md border border-white/20 text-slate-800'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {typing && <div className="text-sm text-slate-500">Bite กำลังพิมพ์...</div>}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-white/30 bg-white/60 backdrop-blur-md">
        <span className="text-xs text-slate-400 whitespace-nowrap">🛡️ ระบบเพิ่มสินค้าผ่าน EXECUTE_ADD_TO_CART เท่านั้น</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={listening ? 'กำลังฟัง... พูดเลยค่ะ' : 'พิมพ์ข้อความหรือกดไมค์เพื่อพูด...'}
          className="input flex-1"
          data-testid="bite-ai-input"
        />
        {/* WS-2b: ปุ่มไมค์ (กดพูด/กดหยุด) — ซ่อนเมื่อเบราว์เซอร์ไม่รองรับ STT (พิมพ์ต่อได้ปกติ) */}
        {micSupported && (
          <button
            onClick={toggleMic}
            className={listening ? 'btn btn-primary' : 'btn btn-outline'}
            data-testid="bite-ai-mic"
            aria-label={listening ? 'หยุดฟัง' : 'กดเพื่อพูด'}
            title={listening ? 'หยุดฟัง' : 'พูดเลย'}
          >
            🎤
          </button>
        )}
        {/* WS-2c: เปิด/ปิดเสียงตอบ (จำการตั้งค่าไว้ใน localStorage) — ซ่อนถ้าไม่มี TTS */}
        {ttsSupported && (
          <button
            onClick={toggleVoiceReply}
            className={voiceReply ? 'btn btn-primary' : 'btn btn-outline'}
            data-testid="bite-ai-speaker"
            aria-label={voiceReply ? 'ปิดเสียงตอบ' : 'เปิดเสียงตอบ'}
            title={voiceReply ? 'ปิดเสียงตอบ' : 'เปิดเสียงตอบ'}
          >
            {voiceReply ? '🔊' : '🔇'}
          </button>
        )}
        <button onClick={() => handleSend()} disabled={!input.trim() || typing} className="btn btn-primary" data-testid="bite-ai-send">
          ส่ง
        </button>
      </div>
    </div>
  )
}

async function defaultSend(text: string, voiceMode?: boolean): Promise<string> {
  try {
    return await chatWithAI(text, undefined, { voiceMode })
  } catch (e) {
    return 'ขอโทษค่ะ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่นะ 🙏'
  }
}
