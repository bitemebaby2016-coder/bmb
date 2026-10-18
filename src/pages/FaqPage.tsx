import { useState } from 'react'
import { Link } from 'react-router-dom'

import { faqs } from '@/lib/faqContent'


export function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-brand-accent mb-2">❓ คำถามที่พบบ่อย (FAQ)</h1>
      <p className="text-brand-muted mb-8">คำตอบสำหรับคำถามที่คุมักถามมา</p>

      <div className="space-y-4">
        {faqs.map((faq, idx) => (
          <div key={idx} className="card overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-semibold text-brand-accent pr-4">{faq.q}</span>
              <span className={`text-xl transition-transform duration-200 ${openIndex === idx ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {openIndex === idx && (
              <div className="px-4 pb-4 text-brand-text-secondary whitespace-pre-line">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 card bg-gradient-to-r from-orange-50 to-yellow-50 text-center">
        <h3 className="text-lg font-bold text-brand-accent mb-2">🤔 ยังไงไม่ได้?</h3>
        <p className="text-brand-muted mb-4">ติดต่อเราดยตรงหรือถาม AI Assistant ของเรา</p>
        <div className="flex gap-3 justify-center">
          <Link to="/contact" className="btn btn-primary">📧 ติดต่อเรา</Link>
          <Link to="/ai-chat" className="btn btn-outline">💬 ถาม AI</Link>
        </div>
      </div>
    </div>
  )
}
