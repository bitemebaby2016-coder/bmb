import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AiAvatar } from './AiAvatar'

export function FloatingAiButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-24 right-4 z-40">
      {/* Chat Window */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 bg-brand-surface rounded-2xl shadow-2xl border border-brand-border overflow-hidden animate-slideUp">
          <div className="bg-gradient-to-r from-brand-primary to-brand-secondary p-4 text-white">
            <div className="flex items-center gap-3">
              <AiAvatar state="talking" size="sm" />
              <div>
                <h3 className="font-bold">ไบต์ AI</h3>
                <p className="text-xs opacity-90">พร้อมช่วยเหลือค่ะ!</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="ml-auto text-white hover:opacity-75">
                ✕
              </button>
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm text-brand-accent mb-3">
              👋 สวัสดีค่ะ! ไบต์นะคะ คุณต้องการให้ช่วยอะไรดีคะ?
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="px-3 py-1 bg-brand-bg text-brand-accent rounded-full text-xs font-medium hover:bg-brand-secondary transition-colors">
                🍽️ สั่งอาหาร
              </button>
              <button className="px-3 py-1 bg-brand-bg text-brand-accent rounded-full text-xs font-medium hover:bg-brand-secondary transition-colors">
                📦 ติดตามออเดอร์
              </button>
              <button className="px-3 py-1 bg-brand-bg text-brand-accent rounded-full text-xs font-medium hover:bg-brand-secondary transition-colors">
                ❓ ถามไบต์
              </button>
            </div>
          </div>
          <div className="p-3 border-t border-brand-border">
            <Link to="/ai-chat" className="block text-center text-brand-primary font-medium text-sm hover:underline">
              เปิดแชทเต็มจอ →
            </Link>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-full shadow-lg flex items-center justify-center text-white text-2xl hover:scale-110 transition-transform animate-float animate-bounce-slow overflow-hidden"
      >
        {isOpen ? (
          <span className="text-2xl">✕</span>
        ) : (
          <img 
            src="/icon_Quick_chat.webp" 
            alt="Chat with AI" 
            className="w-10 h-10 object-contain"
          />
        )}
      </button>
    </div>
  )
}