// ============================================
// Bite Me Baby â€” Admin Portfolio Management (CAT-04, migration 094)
// CRUD management of admin-curated past works / promotional images
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getAllPortfolioItems, createPortfolioItem, updatePortfolioItem, togglePortfolioItem, deletePortfolioItem } from '@/lib/bmbAdminApi_portfolio'
import { uploadMediaAsset, validateImageFile } from '@/lib/bmbAdminApi_media'
import { showToast } from '@/components/ui/ToastContainer'
import type { AdminPortfolioItem } from '@/types'

export function AdminPortfolioPage() {
  const [items, setItems] = useState<AdminPortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try { setItems(await getAllPortfolioItems()) } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function handleCreate() {
    if (!title || !imageUrl) { showToast('Title and image URL required', 'error'); return }
    const created = await createPortfolioItem({ title, description: description || null, image_url: imageUrl, media_asset_id: null, display_order: items.length, is_active: true })
    if (created) { setItems([...items, created]); setTitle(''); setDescription(''); setImageUrl(''); showToast('Portfolio item created', 'success') }
    else { showToast('Failed to create', 'error') }
  }

  async function handleToggle(id: string, active: boolean) {
    if (await togglePortfolioItem(id, active)) { loadData(); showToast(active ? 'Activated' : 'Deactivated', 'success') }
  }

  async function handleDelete(id: string) {
    if (window.confirm('Delete this portfolio item?')) {
      if (await deletePortfolioItem(id)) { loadData(); showToast('Deleted', 'success') }
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-brand-accent mb-6">Portfolio Gallery Management</h1>

      {/* Create form */}
      <div className="card p-6 mb-6">
        <h3 className="font-bold mb-4">Add New Portfolio Item</h3>
        <div className="grid grid-cols-2 gap-4">
          <input className="border rounded px-3 py-2" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Image URL (or upload via Media)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
          <textarea className="border rounded px-3 py-2 col-span-2" placeholder="Description" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <button className="btn btn-primary mt-4" onClick={handleCreate}>Add Item</button>
      </div>

      {/* Items list */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="card p-4 flex items-center gap-4 border-l-4 border-brand-primary">
            <img src={item.image_url} alt={item.title} className="w-20 h-20 object-cover rounded" />
            <div className="flex-1 min-w-0">
              <h4 className="font-bold truncate">{item.title}</h4>
              <p className="text-sm text-brand-muted">{item.description || 'No description'}</p>
              <span className={`text-xs px-2 py-1 rounded ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {item.is_active ? 'Active' : 'Inactive'} | Order: {item.display_order}
              </span>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-sm" onClick={() => handleToggle(item.id, !item.is_active)}>
                {item.is_active ? 'Disable' : 'Enable'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link to="/admin/dashboard" className="text-sm text-brand-primary hover:underline">â† Back to Admin Dashboard</Link>
      </div>
    </div>
  )
}
