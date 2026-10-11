import { useState } from 'react'
import { Link } from 'react-router-dom'

import { faqs } from '@/lib/faqContent'


export function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-brand-accent mb-2">â“ à¸„à¸³à¸–à¸²à¸¡à¸—à¸µà¹ˆà¸žà¸šà¸šà¹ˆà¸­à¸¢ (FAQ)</h1>
      <p className="text-brand-muted mb-8">à¸„à¸³à¸•à¸­à¸šà¸ªà¸³à¸«à¸£à¸±à¸šà¸„à¸³à¸–à¸²à¸¡à¸—à¸µà¹ˆà¸„à¸¸à¸¡à¸±à¸à¸–à¸²à¸¡à¸¡à¸²</p>

      <div className="space-y-4">
        {faqs.map((faq, idx) => (
          <div key={idx} className="card overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-semibold text-brand-accent pr-4">{faq.q}</span>
              <span className={`text-xl transition-transform duration-200 ${openIndex === idx ? 'rotate-180' : ''}`}>â–¼</span>
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
        <h3 className="text-lg font-bold text-brand-accent mb-2">ðŸ¤” à¸¢à¸±à¸‡à¹„à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰?</h3>
        <p className="text-brand-muted mb-4">à¸•à¸´à¸”à¸•à¹ˆà¸­à¹€à¸£à¸²à¸”à¸¢à¸•à¸£à¸‡à¸«à¸£à¸·à¸­à¸–à¸²à¸¡ AI Assistant à¸‚à¸­à¸‡à¹€à¸£à¸²</p>
        <div className="flex gap-3 justify-center">
          <Link to="/contact" className="btn btn-primary">ðŸ“§ à¸•à¸´à¸”à¸•à¹ˆà¸­à¹€à¸£à¸²</Link>
          <Link to="/ai-chat" className="btn btn-outline">ðŸ’¬ à¸–à¸²à¸¡ AI</Link>
        </div>
      </div>
    </div>
  )
}
