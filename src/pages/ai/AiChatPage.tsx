import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { AiAvatar } from '@/components/ai/AiAvatar'
import { showToast } from '@/components/ui/ToastContainer'
import { chatWithAI, resetConversation as resetAiConversation } from '@/lib/aiService'
import { storeConversationMessage, getConversationHistory, getMemorySummary, updateCustomerMemory } from '@/lib/aiMemory'
import { hydrateMemoryFromServer, pushLocalMemoryToServer } from '@/lib/aiServerMemory'
interface ChatMsg { id: string; role: 'user'|'assistant'; content: string; timestamp: string }
const WELCOME_MSG = 'Welcome! Bite here What can I help you with today?'
function getUserClass(role: 'user'|'assistant') {
  return role === 'user' ? 'justify-end order-1' : 'justify-start'
}
export function AiChatPage() {
  const navigate = useNavigate()
  const customer = useAuthStore((s) => s.customer)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (customer?.id) {
      // AI-03: bridge server memory -> local on open (cross-device context continuity).
      void (async () => {
        await hydrateMemoryFromServer(customer.id)
        void pushLocalMemoryToServer(customer.id).catch(() => {})
        const history = getConversationHistory(customer.id)
        if (history.length > 0) { setMessages(history.map(e => ({ id:e.id, role:e.value.role as 'user'|'assistant', content:e.value.content as string, timestamp:e.created_at }))) }
        else { setMessages([{ id:'1', role:'assistant', content:WELCOME_MSG, timestamp:new Date().toISOString() }]) }
      })()
    } else { setMessages([{ id:'1', role:'assistant', content:WELCOME_MSG, timestamp:new Date().toISOString() }]) }
  }, [customer?.id])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  async function handleSend() {
    if (!input.trim() || isLoading) return
    const userId = customer?.id || 'guest'
    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date().toISOString() }
    storeConversationMessage(userId, 'user', input)
    setMessages(prev => [...prev, userMsg]); setInput(''); setIsTyping(true); setIsLoading(true)
    try {
      let memoryContext = ''
      if (customer?.id) { const s = getMemorySummary(customer.id); if (s) memoryContext = '\n\nCustomer Context:\n' + s }
      const aiResponse = await chatWithAI(userMsg.content + memoryContext)
      const assistantMsg: ChatMsg = { id:(Date.now()+1).toString(), role:'assistant', content:aiResponse, timestamp:new Date().toISOString() }
      storeConversationMessage(userId, 'assistant', aiResponse)
      updateCustomerMemory(userId, { last_order_date: new Date().toISOString() })
      setMessages(prev => [...prev, assistantMsg])
    } catch (error) { console.error('Chat error:', error); showToast('Error occurred', 'error') }
    finally { setIsTyping(false); setIsLoading(false) }
  }
  function handleResetChat() {
    setMessages([{ id: Date.now().toString(), role: 'assistant', content: 'Starting fresh!', timestamp: new Date().toISOString() }])
    resetAiConversation(); showToast('เริ่มการสนทนาใหม่แล้ว', 'info')
  }
  const isInputEmpty = !input.trim()
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 h-screen flex flex-col">
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-brand-border">
        <AiAvatar state="talking" />
        <div className="flex-1"><h1 className="text-2xl font-bold text-brand-accent">Bite AI</h1><p className="text-sm text-brand-muted">AI Waiter of Bite Me Baby</p></div>
        <button onClick={handleResetChat} className="btn btn-outline text-sm">Re-chat</button>
        <button onClick={() => navigate(-1)} className="btn btn-outline text-sm">Back</button>
      </div>
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={'flex ' + getUserClass(msg.role)}>
            <div className={'max-w-[80%] ' + (msg.role === 'user' ? 'order-1' : '')}>
              {msg.role === 'assistant' && (<div className="flex items-start gap-3"><AiAvatar state="talking" /><div className="card bg-brand-surface"><p className="text-brand-text">{msg.content}</p><p className="text-xs text-brand-muted mt-2">{new Date(msg.timestamp).toLocaleTimeString()}</p></div></div>)}
              {msg.role === 'user' && (<div className="card bg-brand-primary text-white"><p>{msg.content}</p><p className="text-xs opacity-90 mt-2">{new Date(msg.timestamp).toLocaleTimeString()}</p></div>)}
            </div>
          </div>
        ))}
        {isTyping && (<div className="flex justify-start"><div className="card bg-brand-surface flex items-center gap-3"><AiAvatar state="thinking" /><div className="flex gap-1"><div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" style={{animationDelay:'0ms'}}></div><div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" style={{animationDelay:'150ms'}}></div><div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" style={{animationDelay:'300ms'}}></div></div></div></div>)}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {['Order food', 'Recommend menu', 'Check status', 'Ask Bite'].map((action) => (<button key={action} onClick={() => setInput(action)} className="px-4 py-2 bg-brand-bg text-brand-accent rounded-full text-sm whitespace-nowrap hover:bg-brand-secondary transition-colors">{action}</button>))}
      </div>
      <div className="flex gap-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Type a message..." className="input flex-1" />
        <button onClick={handleSend} disabled={isInputEmpty} className={'btn btn-primary ' + (isInputEmpty ? 'btn-disabled' : '')}>Send</button>
      </div>
    </div>
  )
}
