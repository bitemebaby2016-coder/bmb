// ============================================
// Bite Me Baby — Admin Asset Audit (READ-ONLY)
// Owner request: a place to "ดูไฟล์ได้" and see exactly which product rows are
// MISSING an image so an admin can go fill them (Talk to Bite product cards use
// the real catalog `image_url` only — no AI-generated images, ever). This page
// performs NO writes; it only reads the real catalog + shows the mascot asset
// manifest for reference.
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '@/types'

// The mascot asset files Bite uses (mirror of public/assets/mascot/). Read-only
// reference so an admin can confirm which pose files exist on disk / in the build.
const MASCOT_ASSETS: Array<{ pose: string; file: string }> = [
  { pose: 'ready', file: 'bite_ready.webp' },
  { pose: 'greeting', file: 'bite_hero_greeting.webp' },
  { pose: 'thinking', file: 'bite_thinking.webp' },
  { pose: 'recommend', file: 'bite_recommend.webp' },
  { pose: 'waiting', file: 'bite_waiting.webp' },
  { pose: 'pointing', file: 'bite_pointing.webp' },
  { pose: 'shopping', file: 'bite_shopping.webp' },
  { pose: 'success', file: 'bite_success.webp' },
  { pose: 'bye', file: 'bite_goodbye.webp' },
  { pose: 'sad', file: 'bite_sad.webp' },
  { pose: 'empty', file: 'bite_empty_sad.webp' },
  { pose: 'closed', file: 'bite_closed.webp' },
  { pose: 'menu', file: 'bite_menu.webp' },
  { pose: 'cooking', file: 'bite_cooking.webp' },
  { pose: 'eating', file: 'bite_eating.webp' },
  { pose: 'delivery', file: 'bite_delivery_run.webp' },
  { pose: 'award', file: 'bite_award.webp' },
  { pose: 'feedback', file: 'bite_feedback.webp' },
  { pose: 'reviewing', file: 'bite_reviewing.webp' },
  { pose: 'vote', file: 'bite_vote.webp' },
  { pose: 'peeking', file: 'bite_peeking.webp' },
  { pose: 'heart', file: 'bite_badge_mini_heart.webp' },
  { pose: 'thumbsup', file: 'bite_badge_thumbsup_approval.webp' },
  { pose: 'main', file: 'Bite_Main.webp' },
]

function hasImage(product: Product): boolean {
  return !!product.image_url && String(product.image_url).trim() !== ''
}

export function AdminAssetAudit() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const { getProducts } = await import('@/lib/bmbAdminApi_products')
        const rows = await getProducts()
        if (!active) return
        setProducts(rows || [])
      } catch (e) {
        console.error('[AssetAudit] load failed', e)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])
  const missing = products.filter((p) => !hasImage(p))
  const available = products.filter((p) => p.is_available && !p.archived)
  const missingAvailable = missing.filter((p) => p.is_available && !p.archived)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link to="/admin" className="text-sm text-brand-muted hover:underline">← กลับแดชบอร์ด</Link>
      <h1 className="text-2xl font-bold text-brand-accent mt-2 mb-1">🔍 Asset Audit (read-only)</h1>
      <p className="text-sm text-brand-muted mb-4">
        สถานะรูปสินค้าในแคตตาล็อกจริง — <b>อ่านอย่างเดียว ไม่บันทึก</b> · AI ไม่เจนรูปเด็ดขาด ·
        Product card (Talk to Bite) แสดงเฉพาะ <code>image_url</code> จริง; รายการที่ยังไม่มีรูปจะเห็น placeholder ไปก่อน
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-3">
          <div className="text-xs text-brand-muted">สินค้าทั้งหมด</div>
          <div className="text-2xl font-bold text-brand-accent">{products.length}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-brand-muted">ขายได้</div>
          <div className="text-2xl font-bold text-brand-accent">{available.length}</div>
        </div>
        <div className="card p-3 border-red-200">
          <div className="text-xs text-brand-muted">ขาดรูป (image_url ว่าง)</div>
          <div className="text-2xl font-bold text-red-600">{missing.length}</div>
        </div>
        <div className="card p-3 border-amber-200">
          <div className="text-xs text-brand-muted">ขายได้แต่ขาดรูป ⚠️</div>
          <div className="text-2xl font-bold text-amber-700">{missingAvailable.length}</div>
        </div>
      </div>

      {loading ? (
        <p className="text-brand-muted py-8 text-center">กำลังโหลดแคตตาล็อก…</p>
      ) : missing.length === 0 ? (
        <div className="card p-6 text-center text-green-700">✅ สินค้าทุกตัวมีรูปครบแล้ว — ไม่มีอะไรต้องเติม</div>
      ) : (
        <div className="card overflow-hidden mb-8">
          <div className="px-4 py-2 bg-brand-bg border-b border-brand-border font-bold text-brand-accent">
            รายการสินค้าที่ขาดรูป — ไปเติมใน Admin → สินค้า (แก้ไขรายการ → เพิ่มภาพ → save)
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-brand-muted text-xs border-b border-brand-border">
              <tr>
                <th className="py-2 pr-3 pl-4">ชื่อสินค้า</th>
                <th className="py-2 pr-3">ราคา</th>
                <th className="py-2 pr-3">ขายได้</th>
                <th className="py-2 pr-3">หมวด</th>
                <th className="py-2 pr-3">image_url</th>
                <th className="py-2 pr-4">สถานะ/ชี้เป้า</th>
              </tr>
            </thead>
            <tbody>
              {missing.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 pl-4 font-medium text-brand-accent">{p.name}</td>
                  <td className="py-2 pr-3">฿{Number(p.price) || 0}</td>
                  <td className="py-2 pr-3">
                    {p.is_available && !p.archived ? (
                      <span className="text-green-700">✅</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs text-brand-muted">{p.category_id ? p.category_id.slice(0, 8) : '—'}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-red-600">{p.image_url ? '(ว่าง/ไม่ถูกต้อง)' : '(ว่าง)'}</td>
                  <td className="py-2 pr-4">
                    {p.is_available && !p.archived ? (
                      <Link to="/admin/products" className="text-brand-primary text-xs font-medium hover:underline">ไปใส่รูป →</Link>
                    ) : (
                      <span className="text-xs text-brand-muted">ไม่อยู่ในเมนูขาย</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Mascot asset manifest (reference — files live in public/assets/mascot/) */}
      <div className="card overflow-hidden">
        <div className="px-4 py-2 bg-brand-bg border-b border-brand-border font-bold text-brand-accent">
          🧬 ไฟล์มาสคอต Bite ที่ระบบใช้ ({MASCOT_ASSETS.length} ไฟล์) — อ้างอิงเท่านั้น
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-4">
          {MASCOT_ASSETS.map((a) => (
            <div key={a.pose} className="flex items-center gap-2 text-xs border border-brand-border bg-white rounded px-2 py-1.5">
              <img
                src={`/assets/mascot/${a.file}`}
                alt={a.pose}
                loading="lazy"
                className="w-8 h-8 rounded object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2' }}
              />
              <div className="min-w-0">
                <div className="font-medium text-brand-accent truncate">{a.pose}</div>
                <div className="font-mono text-brand-muted truncate">{a.file}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}