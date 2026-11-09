// ============================================
// Bite Me Baby — Admin Media & Portfolio (Merged)
// ============================================
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import {
  listMediaAssets,
  uploadMediaAsset,
  uploadRegisteredAsset,
  deleteMediaAsset,
  listRegistryAssets,
  setRegistryAssetActive,
  MEDIA_KINDS,
  type MediaAssetRow,
  type RegistryAssetRow,
} from '@/lib/bmbAdminApi_media'
import { getAllPortfolioItems, createPortfolioItem, updatePortfolioItem, togglePortfolioItem, deletePortfolioItem } from '@/lib/bmbAdminApi_portfolio'
import { getProducts } from '@/lib/bmbAdminApi_products'
import { uploadMediaAsset as uploadMediaAssetFn, validateImageFile } from '@/lib/bmbAdminApi_media'
// R21d backlog: โหลด portfolio ไม่สำเร็จต้องฟ้อง + ลองใหม่ (เดิม catch เฉย ๆ = หน้าเปล่าเงย)
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'
import type { AdminPortfolioItem, Product } from '@/types'
import { AdminAssetAudit } from '@/pages/admin/AdminAssetAudit'

const KIND_LABEL: Record<string, string> = {
  image: 'รูปภาพ',
  video: 'วิดีโอ',
  logo: 'โลโก้',
  hero: 'Hero',
  mascot: 'มาสคอต',
  portfolio: 'ผลงาน',
}

type Tab = 'library' | 'portfolio' | 'theater' | 'audit' | 'registry'

export function AdminMediaPortfolio() {
  const [tab, setTab] = useState<Tab>(() =>
    new URLSearchParams(window.location.search).get('tab') === 'audit' ? 'audit' : 'library',
  )
  const [assets, setAssets] = useState<MediaAssetRow[]>([])
  const [registry, setRegistry] = useState<RegistryAssetRow[]>([])
  const [portfolioItems, setPortfolioItems] = useState<AdminPortfolioItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [uploading, setUploading] = useState(false)
  const [kind, setKind] = useState<MediaAssetRow['kind']>('image')
  const [alt, setAlt] = useState('')
  const [assetKey, setAssetKey] = useState('')
  // Portfolio form state
  const [portfolioForm, setPortfolioForm] = useState({ title: '', description: '', imageUrl: '', displayOrder: 0, isActive: true, productId: '', isTheaterCarousel: false, theaterCaption: '' })
  // Media picker state
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [mediaPickerFilter, setMediaPickerFilter] = useState<'all' | 'image'>('image')
  // Product picker state
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  // R21d: โหลด portfolio ไม่สำเร็จต้องฟ้อง (toast อย่างเดียวหายไปเมื่อปิด)
  const [portfolioLoadError, setPortfolioLoadError] = useState('')
  const [mediaLoadError, setMediaLoadError] = useState('')

  const loadMedia = async () => {
    setMediaLoadError('')
    try {
      const [a, r] = await Promise.all([listMediaAssets(), listRegistryAssets()])
      setAssets(a)
      setRegistry(r)
    } catch (e) {
      console.error('[AdminMediaPortfolio] loadMedia failed:', e)
      setMediaLoadError('โหลดคลังรูปภาพไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
      showToast('โหลดคลังรูปภาพไม่สำเร็จ', 'error')
    }
  }

  const loadPortfolio = async () => {
    setPortfolioLoadError('')
    try {
      const items = await getAllPortfolioItems()
      setPortfolioItems(items)
    } catch (e) {
      console.error('[AdminMediaPortfolio] loadPortfolio failed:', e)
      setPortfolioLoadError('โหลดผลงานไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
      showToast('โหลดผลงานไม่สำเร็จ', 'error')
    }
  }

  const loadProducts = async () => {
    try {
      const items = await getProducts()
      setProducts(items)
    } catch (e) {
      console.error('[AdminMediaPortfolio] loadProducts failed:', e)
    }
  }

  useEffect(() => {
    void loadMedia()
    void loadPortfolio()
    void loadProducts()
  }, [])

  async function handleToggleActive(asset: RegistryAssetRow) {
    const ok = await setRegistryAssetActive(asset.id, !asset.is_active)
    showToast(ok ? (asset.is_active ? 'ปิดใช้งานแล้ว (runtime จะ fallback)' : 'เปิดใช้งานแล้ว') : 'เปลี่ยนสถานะไม่สำเร็จ', ok ? 'success' : 'error')
    await loadMedia()
  }

  async function handleUpload(file: File | undefined) {
    if (!file) { showToast('เลือกไฟล์ก่อนอัปโหลด', 'error'); return }
    setUploading(true)
    try {
      const key = assetKey.trim()
      const row = key
        ? await uploadRegisteredAsset(file, kind, alt.trim(), { assetKey: key, category: 'system' })
        : await uploadMediaAsset(file, kind, alt.trim())
      if (row) {
        showToast('อัปโหลดสำเร็จ', 'success')
        setAlt(''); setAssetKey('')
        await loadMedia()
      } else {
        showToast('อัปโหลดไม่สำเร็จ (ตรวจ storage policy / การล็อกอิน admin)', 'error')
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(asset: MediaAssetRow) {
    const ok = await deleteMediaAsset(asset)
    showToast(ok ? 'ลบแล้ว' : 'ลบไม่สำเร็จ', ok ? 'success' : 'error')
    await loadMedia()
  }

  // Portfolio CRUD
  async function handleCreatePortfolio() {
    if (!portfolioForm.title || !portfolioForm.imageUrl) { showToast('Title and image URL required', 'error'); return }
    const created = await createPortfolioItem({ 
      title: portfolioForm.title, 
      description: portfolioForm.description || null, 
      image_url: portfolioForm.imageUrl, 
      media_asset_id: null, 
      display_order: portfolioForm.displayOrder, 
      is_active: portfolioForm.isActive,
      product_id: portfolioForm.productId || null,
      is_theater_carousel: portfolioForm.isTheaterCarousel,
      theater_caption: portfolioForm.theaterCaption || null,
    })
    if (created) {
      setPortfolioItems([...portfolioItems, created])
      setPortfolioForm({ title: '', description: '', imageUrl: '', displayOrder: 0, isActive: true, productId: '', isTheaterCarousel: false, theaterCaption: '' })
      showToast('เพิ่มผลงานแล้ว', 'success')
    } else { showToast('เพิ่มผลงานไม่สำเร็จ', 'error') }
  }

  async function handleTogglePortfolio(id: string, active: boolean) {
    if (await togglePortfolioItem(id, active)) { await loadPortfolio(); showToast(active ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว', 'success') }
  }

  async function handleDeletePortfolio(id: string) {
    if (window.confirm('ลบผลงานนี้?')) {
      if (await deletePortfolioItem(id)) { await loadPortfolio(); showToast('ลบแล้ว', 'success') }
    }
  }

  // Media picker for portfolio
  function openMediaPicker() {
    setMediaPickerFilter('image')
    setMediaPickerOpen(true)
  }

  function pickMediaForPortfolio(asset: MediaAssetRow) {
    setPortfolioForm((f) => ({ ...f, imageUrl: asset.url }))
    setMediaPickerOpen(false)
    showToast('เลือกภาพจากคลังแล้ว', 'success')
  }

  function openProductPicker() {
    setProductSearch('')
    setProductPickerOpen(true)
  }

  function pickProductForTheater(product: Product) {
    setPortfolioForm((f) => ({ ...f, productId: product.id, title: f.title || product.name, imageUrl: f.imageUrl || product.image_url || '' }))
    setProductPickerOpen(false)
    showToast(`เลือกเมนู "${product.name}" แล้ว`, 'success')
  }

  const filteredAssets = mediaPickerFilter === 'all' ? assets : assets.filter((a) => a.kind === 'image')
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.description?.toLowerCase().includes(productSearch.toLowerCase())
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link to="/admin" className="text-sm text-brand-muted hover:underline">← กลับแดชบอร์ด</Link>
      <h1 className="text-2xl font-bold text-brand-accent mt-2 mb-4">🖼️ คลังรูปภาพและผลงาน</h1>

      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="คลังรูปภาพและผลงาน">
        {([
          ['library', '🗂 คลังรูปภาพ'],
          ['portfolio', '🖼 ผลงาน/พอร์ตโฟลิโอ'],
          ['theater', '🎭 Theater Carousel'],
          ['audit', '🔍 ตรวจรูปสินค้า'],
          ['registry', '🗂 Asset Registry'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k as Tab)}
            data-testid={`media-portfolio-tab-${k}`}
            className={`btn text-sm ${tab === k ? 'btn-primary' : 'btn-outline'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mediaLoadError && tab === 'library' && (
        <div className="mb-4"><LoadErrorBanner message={mediaLoadError} onRetry={() => void loadMedia()} testId="media-load-error" /></div>
      )}
      {portfolioLoadError && tab === 'portfolio' && (
        <div className="mb-4"><LoadErrorBanner message={portfolioLoadError} onRetry={() => void loadPortfolio()} testId="portfolio-load-error" /></div>
      )}

      {tab === 'library' && (
        <>
        <div className="card p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">ประเภท</label>
              <select className="input border rounded px-3 py-2" value={kind} onChange={(e) => setKind(e.target.value as MediaAssetRow['kind'])}>{MEDIA_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k] || k}</option>)}</select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">คำอธิบาย (alt)</label>
              <input className="input border rounded px-3 py-2" placeholder="เช่น ภาพ hero รอบเช้า" value={alt} onChange={(e) => setAlt(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">asset_key <span className="text-xs font-normal">(ถ้ามี — เช่น <code>ai.chat_background</code> / <code>site.background</code>)</span></label>
              <input className="input border rounded px-3 py-2" placeholder="เว้นว่างได้ ใส่เพื่อให้ runtime ใช้ภาพนี้" value={assetKey} onChange={(e) => setAssetKey(e.target.value)} data-testid="media-asset-key" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted mb-1">ไฟล์</label>
              <div className="flex flex-wrap items-center gap-2">
                <input type="file" className="input border rounded px-3 py-2" accept="image/*,video/mp4" disabled={uploading} onChange={(e) => handleUpload(e.target.files?.[0] || undefined)} data-testid="media-file-input" />
                <label className="btn btn-outline btn-sm cursor-pointer" title="ถ่ายภาพ/อัดวิดีโอด้วยกล้อง">📷 ถ่ายภาพ<input type="file" accept="image/*,video/mp4" capture="environment" disabled={uploading} onChange={(e) => handleUpload(e.target.files?.[0] || undefined)} className="hidden" data-testid="media-camera-input" /></label>
              </div>
            </div>
          </div>
          <p className="text-xs text-brand-muted mt-2">ไฟล์จะถูกเก็บใน Storage bucket <code className="bg-gray-100 px-1 rounded">bmb-images</code> และ metadata ในตาราง <code className="bg-gray-100 px-1 rounded">media_assets</code></p>
        </div>

        {registry.length > 0 && (
          <div className="card p-4 mb-6">
            <h2 className="text-lg font-bold text-brand-accent mb-2">🗂️ Asset Registry (migration 105)</h2>
            <p className="text-xs text-brand-muted mb-3">asset ที่ลงทะเบียนแล้ว — runtime อ่านจาก DB โดยตรง (active + ไม่ใช่ MOCK มีลำดับความสำคัญสูงสุด)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="text-left text-xs text-brand-muted border-b"><th className="py-2 pr-3">asset_key</th><th className="py-2 pr-3">category</th><th className="py-2 pr-3">scope (tenant/brand)</th><th className="py-2 pr-3">สถานะ</th><th className="py-2 pr-3">พรีวิว</th><th className="py-2">จัดการ</th></tr></thead><tbody>
                {registry.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs">{a.asset_key || '—'}</td>
                    <td className="py-2 pr-3">{a.category || a.kind}</td>
                    <td className="py-2 pr-3 text-xs text-brand-muted">{a.tenant_id ? a.tenant_id.slice(0, 8) + '…' : 'global'} / {a.brand_id ? a.brand_id.slice(0, 8) + '…' : 'global'}</td>
                    <td className="py-2 pr-3">{a.is_active ? <span className="text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5 text-xs">ACTIVE</span> : <span className="text-gray-500 bg-gray-100 border rounded px-2 py-0.5 text-xs">INACTIVE</span>}{a.is_mock && <span className="ml-1 text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 text-xs">MOCK</span>}</td>
                    <td className="py-2 pr-3">{a.url && a.kind !== 'video' ? <img src={a.url} alt={a.alt || a.asset_key || ''} className="w-10 h-10 object-cover rounded" /> : '—'}</td>
                    <td className="py-2"><button onClick={() => handleToggleActive(a)} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-1 hover:bg-blue-100">{a.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</button></td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          </div>
        )}

        {assets.length === 0 ? <p className="text-brand-muted text-center py-8">ยังไม่มี media — อัปโหลดไฟล์แรกด้านบน</p> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {assets.map((a) => (
              <div key={a.id} className="card overflow-hidden"><div className="aspect-square bg-gray-100 flex items-center justify-center">
                {a.url ? <img src={a.url} alt={a.alt || 'media'} className="w-full h-full object-cover" /> : <span className="text-4xl">🎬</span>}</div>
                <div className="p-3"><div className="text-xs font-medium">{KIND_LABEL[a.kind] || a.kind}</div><div className="text-sm text-brand-muted truncate">{a.alt || a.url}</div>
                <button onClick={() => handleDelete(a)} className="mt-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded px-2 py-1 hover:bg-red-100">ลบ</button></div></div>
            ))}
          </div>
        )}
        </>
      )}

      {tab === 'portfolio' && (
        <div className="space-y-4">
          <div className="card p-6 mb-6">
            <h3 className="font-bold text-brand-accent mb-4">เพิ่มผลงานใหม่</h3>
            <div className="grid grid-cols-2 gap-4">
              <input className="border rounded px-3 py-2" placeholder="ชื่อผลงาน *" value={portfolioForm.title} onChange={(e) => setPortfolioForm({ ...portfolioForm, title: e.target.value })} />
              <div>
                <label className="block text-sm font-medium text-brand-muted mb-1">รูปภาพ</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input className="border rounded px-3 py-2 flex-1" placeholder="Image URL (หรือเลือกจากคลังรูปภาพ)" value={portfolioForm.imageUrl} onChange={(e) => setPortfolioForm({ ...portfolioForm, imageUrl: e.target.value })} />
                  <button type="button" className="btn btn-outline" onClick={openMediaPicker}>📁 เลือกจากคลัง</button>
                </div>
              </div>
              <textarea className="border rounded px-3 py-2 col-span-2" placeholder="คำอธิบาย" rows={2} value={portfolioForm.description} onChange={(e) => setPortfolioForm({ ...portfolioForm, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-4 col-span-2">
                <input type="number" className="border rounded px-3 py-2" placeholder="ลำดับแสดง" value={portfolioForm.displayOrder} onChange={(e) => setPortfolioForm({ ...portfolioForm, displayOrder: Number(e.target.value) })} />
                <label className="flex items-center gap-2"><input type="checkbox" checked={portfolioForm.isActive} onChange={(e) => setPortfolioForm({ ...portfolioForm, isActive: e.target.checked })} /> เปิดใช้งาน</label>
              </div>
            </div>
            <button className="btn btn-primary mt-4" onClick={handleCreatePortfolio}>เพิ่มผลงาน</button>
          </div>

          {portfolioItems.map((item) => (
            <div key={item.id} className="card p-4 flex items-center gap-4 border-l-4 border-brand-primary">
              <img src={item.image_url} alt={item.title} className="w-20 h-20 object-cover rounded" />
              <div className="flex-1 min-w-0"><h4 className="font-bold truncate">{item.title}</h4><p className="text-sm text-brand-muted">{item.description || 'No description'}</p>
                <span className={`text-xs px-2 py-1 rounded ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{item.is_active ? 'Active' : 'Inactive'} | Order: {item.display_order}</span></div>
              <div className="flex gap-2"><button className="btn btn-sm" onClick={() => handleTogglePortfolio(item.id, !item.is_active)}>{item.is_active ? 'Disable' : 'Enable'}</button><button className="btn btn-danger btn-sm" onClick={() => handleDeletePortfolio(item.id)}>Delete</button></div>
            </div>
          ))}
          {portfolioItems.length === 0 && <p className="text-center py-12 text-brand-muted">ยังไม่มีผลงาน — กดปุ่ม "เพิ่มผลงานใหม่" ด้านบนได้เลยค่ะ</p>}
        </div>
      )}

      {tab === 'theater' && (
        <div className="space-y-4">
          <div className="card p-6 mb-6">
            <h3 className="font-bold text-brand-accent mb-4">เพิ่มรายการ Theater Carousel ใหม่</h3>
            <p className="text-sm text-brand-muted mb-4">รายการที่ตั้งค่า is_theater_carousel = true จะแสดงในโหมด Auto-play บนหน้า /shop</p>
            <div className="grid grid-cols-2 gap-4">
              <input className="border rounded px-3 py-2" placeholder="ชื่อ/คำอธิบายสั้น *" value={portfolioForm.title} onChange={(e) => setPortfolioForm({ ...portfolioForm, title: e.target.value })} />
              <div>
                <label className="block text-sm font-medium text-brand-muted mb-1">รูปภาพ</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input className="border rounded px-3 py-2 flex-1" placeholder="Image URL (หรือเลือกจากคลังรูปภาพ)" value={portfolioForm.imageUrl} onChange={(e) => setPortfolioForm({ ...portfolioForm, imageUrl: e.target.value })} />
                  <button type="button" className="btn btn-outline" onClick={openMediaPicker}>📁 เลือกจากคลัง</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-muted mb-1">ลิงก์เมนู (Product)</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input className="border rounded px-3 py-2 flex-1 font-mono text-xs" placeholder="Product ID (เลือกจากคลังเมนู)" value={portfolioForm.productId} onChange={(e) => setPortfolioForm({ ...portfolioForm, productId: e.target.value })} readOnly />
                  <button type="button" className="btn btn-outline" onClick={openProductPicker}>🍽 เลือกเมนู</button>
                </div>
              </div>
              <textarea className="border rounded px-3 py-2 col-span-2" placeholder="คำอธิบายสำหรับ Theater (ใช้แทน description ใน carousel)" rows={2} value={portfolioForm.theaterCaption} onChange={(e) => setPortfolioForm({ ...portfolioForm, theaterCaption: e.target.value })} />
              <div className="grid grid-cols-3 gap-4 col-span-2">
                <input type="number" className="border rounded px-3 py-2" placeholder="ลำดับแสดง" value={portfolioForm.displayOrder} onChange={(e) => setPortfolioForm({ ...portfolioForm, displayOrder: Number(e.target.value) })} />
                <label className="flex items-center gap-2"><input type="checkbox" checked={portfolioForm.isActive} onChange={(e) => setPortfolioForm({ ...portfolioForm, isActive: e.target.checked })} /> เปิดใช้งาน</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={portfolioForm.isTheaterCarousel} onChange={(e) => setPortfolioForm({ ...portfolioForm, isTheaterCarousel: e.target.checked })} /> 🎭 Theater Carousel</label>
              </div>
            </div>
            <button className="btn btn-primary mt-4" onClick={handleCreatePortfolio}>เพิ่มรายการ Theater</button>
          </div>

          {portfolioItems.filter(i => i.is_theater_carousel).map((item) => (
            <div key={item.id} className="card p-4 flex items-center gap-4 border-l-4 border-brand-primary">
              <img src={item.image_url} alt={item.title} className="w-20 h-20 object-cover rounded" />
              <div className="flex-1 min-w-0"><h4 className="font-bold truncate">{item.title}</h4>
                <p className="text-sm text-brand-muted">{item.theater_caption || item.description || 'No description'}</p>
                <span className={`text-xs px-2 py-1 rounded ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{item.is_active ? 'Active' : 'Inactive'} | Order: {item.display_order}</span>
                {item.product_id && <span className="ml-2 text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded">🔗 Product: {item.product_id.slice(0, 8)}…</span>}</div>
              <div className="flex gap-2"><button className="btn btn-sm" onClick={() => handleTogglePortfolio(item.id, !item.is_active)}>{item.is_active ? 'Disable' : 'Enable'}</button><button className="btn btn-danger btn-sm" onClick={() => handleDeletePortfolio(item.id)}>Delete</button></div>
            </div>
          ))}
          {portfolioItems.filter(i => i.is_theater_carousel).length === 0 && <p className="text-center py-12 text-brand-muted">ยังไม่มีรายการ Theater Carousel — กดปุ่ม "เพิ่มรายการ Theater" ด้านบนได้เลยค่ะ</p>}
        </div>
      )}

      {tab === 'audit' && <AdminAssetAudit />}

      {tab === 'registry' && (
        <div className="card p-4">
          <h2 className="text-lg font-bold text-brand-accent mb-4">🗂️ Asset Registry</h2>
          <p className="text-xs text-brand-muted mb-4">asset ที่ลงทะเบียนแล้ว — runtime อ่านจาก DB โดยตรง</p>
          {registry.length === 0 ? <p className="text-brand-muted">ยังไม่มี asset ใน registry</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-brand-muted border-b"><th className="py-2 pr-3">asset_key</th><th className="py-2 pr-3">category</th><th className="py-2 pr-3">scope</th><th className="py-2 pr-3">สถานะ</th><th className="py-2 pr-3">พรีวิว</th><th className="py-2">จัดการ</th></tr></thead><tbody>
              {registry.map((a) => (
                <tr key={a.id} className="border-b last:border-0"><td className="py-2 pr-3 font-mono text-xs">{a.asset_key || '—'}</td><td className="py-2 pr-3">{a.category || a.kind}</td><td className="py-2 pr-3 text-xs text-brand-muted">{a.tenant_id ? a.tenant_id.slice(0, 8) + '…' : 'global'} / {a.brand_id ? a.brand_id.slice(0, 8) + '…' : 'global'}</td><td className="py-2 pr-3">{a.is_active ? <span className="text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5 text-xs">ACTIVE</span> : <span className="text-gray-500 bg-gray-100 border rounded px-2 py-0.5 text-xs">INACTIVE</span>}{a.is_mock && <span className="ml-1 text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 text-xs">MOCK</span>}</td><td className="py-2 pr-3">{a.url && a.kind !== 'video' ? <img src={a.url} alt={a.alt || a.asset_key || ''} className="w-10 h-10 object-cover rounded" /> : '—'}</td><td className="py-2"><button onClick={() => handleToggleActive(a)} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-1 hover:bg-blue-100">{a.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</button></td></tr>
              ))}
            </tbody></table></div>
          )}
        </div>
      )}

      {/* Media Picker Modal */}
      {mediaPickerOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setMediaPickerOpen(false)}>
          <div className="card max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-brand-border"><h3 className="font-bold text-brand-accent">📁 เลือกภาพจากคลังรูปภาพ</h3><button className="btn btn-outline" onClick={() => setMediaPickerOpen(false)}>✕ ปิด</button></div>
            <div className="flex gap-2 p-2 border-b border-brand-border"><button type="button" onClick={() => setMediaPickerFilter('all')} className={`btn text-xs ${mediaPickerFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}>ทั้งหมด</button><button type="button" onClick={() => setMediaPickerFilter('image')} className={`btn text-xs ${mediaPickerFilter === 'image' ? 'btn-primary' : 'btn-outline'}`}>รูปภาพ</button></div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {filteredAssets.length === 0 ? <p className="text-center py-8 text-brand-muted">ไม่มีรูปภาพในคลัง</p> : (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {filteredAssets.map((a) => (
                    <button key={a.id} type="button" onClick={() => pickMediaForPortfolio(a)} className="aspect-square bg-gray-100 rounded-lg border border-brand-border overflow-hidden hover:border-brand-primary transition-colors">
                      {a.url ? <img src={a.url} alt={a.alt || 'media'} className="w-full h-full object-cover" /> : <span className="text-3xl">🎬</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Picker Modal for Theater */}
      {productPickerOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setProductPickerOpen(false)}>
          <div className="card max-w-3xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-brand-border"><h3 className="font-bold text-brand-accent">🍽 เลือกเมนูสำหรับ Theater Carousel</h3><button className="btn btn-outline" onClick={() => setProductPickerOpen(false)}>✕ ปิด</button></div>
            <div className="p-2 border-b border-brand-border"><input type="text" className="input border rounded px-3 py-2 w-full" placeholder="ค้นหาเมนู..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} /></div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {filteredProducts.length === 0 ? <p className="text-center py-8 text-brand-muted">ไม่พบเมนูที่ตรงกัน</p> : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredProducts.map((p) => (
                    <button key={p.id} type="button" onClick={() => pickProductForTheater(p)} className="card p-3 text-left hover:border-brand-primary transition-colors border border-brand-border">
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2 flex items-center justify-center">
                        {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-2xl">🍽</span>}
                      </div>
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      <div className="text-xs text-brand-muted">฿{Number(p.price) || 0}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}