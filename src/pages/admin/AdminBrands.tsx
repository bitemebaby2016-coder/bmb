

// ============================================
// Bite Me Baby — Admin Brand Management (TEN-05)
// Platform/Tenant admin CRUD for brands table
// Owner decisions applied: TEN-D01 (tenant-owned catalog), TEN-D06 (brand vs ops split)
// ====================================================

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'

interface BrandRow {
  id: string
  tenant_id: string
  name: string
  slug: string
  display_name: string
  tagline: string
  description: string
  logo_url_icon: string
  status: 'active' | 'inactive' | 'suspended'
  is_default: boolean
  is_published: boolean
  theme_tokens: any
  created_at: string
  updated_at: string
}

export function AdminBrands() {
  const [brands, setBrands] = useState<BrandRow[]>([])
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formTagline, setFormTagline] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formLogoUrlIcon, setFormLogoUrlIcon] = useState('')
  const [formTenantId, setFormTenantId] = useState('tenant-bmb-001')
  const [formDataStatus, setFormDataStatus] = useState<'active' | 'inactive' | 'suspended'>('active')
  const [formDataIsDefault, setFormDataIsDefault] = useState(false)
  const [formDataIsPublished, setFormDataIsPublished] = useState(true)

  async function loadAll() {
    try {
      setLoading(true)
      const tRes = await supabase.from('tenants').select('id, name').order('name')
      if (tRes.data) setTenants(tRes.data as any)
      const bRes = await supabase.from('brands').select('*').order('is_default', { ascending: false })
      if (bRes.error) { console.error('[AdminBrands] Error:', bRes.error); return }
      setBrands(bRes.data as BrandRow[])
    } catch (err) { console.error('[AdminBrands] Load error:', err) }
    finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const brandData = {
      name: formName.trim(),
      slug: formName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
      display_name: formDisplayName || formName.trim(),
      tagline: formTagline.trim(),
      description: formDescription.trim(),
      logo_url_icon: formLogoUrlIcon.trim(),
      tenant_id: formTenantId,
      status: formDataStatus,
      is_default: formDataIsDefault,
      is_published: formDataIsPublished,
      theme_tokens: JSON.parse(JSON.stringify({
        primary_color: '#F97316', secondary_color: '#FBBF24', accent_color: '#92400E',
        bg_base: '#FFF7ED', surface_color: '#FFFFFF', text_base: '#1C1917',
        font_display: 'Nunito', font_body: 'Quicksand'
      }))
    }
    try {
      if (editingId) {
        const { error } = await supabase.from('brands').update(brandData).eq('id', editingId)
        if (error) throw error
        showToast('Brand updated', 'success')
      } else {
        const id = `brand-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const { error } = await supabase.from('brands').insert({ ...brandData, id })
        if (error) throw error
        showToast('Brand created', 'success')
      }
      resetForm(); await loadAll()
    } catch (err: any) {
      console.error('[AdminBrands] Submit error:', err)
      showToast(err.message || 'Failed to save brand', 'error')
    }
  }

  function resetForm() {
    setShowForm(false); setEditingId(null)
    setFormName(''); setFormDisplayName(''); setFormTagline(''); setFormDescription('')
    setFormLogoUrlIcon(''); setFormTenantId('tenant-bmb-001')
    setFormDataStatus('active'); setFormDataIsDefault(false); setFormDataIsPublished(true)
  }

  function startEdit(b: BrandRow) {
    setEditingId(b.id); setFormName(b.name); setFormDisplayName(b.display_name)
    setFormTagline(b.tagline); setFormDescription(b.description)
    setFormLogoUrlIcon(b.logo_url_icon); setFormTenantId(b.tenant_id!)
    setFormDataStatus(b.status); setFormDataIsDefault(b.is_default); setFormDataIsPublished(b.is_published)
    setShowForm(true)
  }

  async function togglePublish(b: BrandRow) {
    const np = !b.is_published
    const { error } = await supabase.from('brands').update({ is_published: np }).eq('id', b.id)
    if (error) { showToast(`Failed to ${np ? 'publish' : 'unpublish'}: ${error.message}`, 'error'); return }
    showToast(`Brand ${np ? 'published' : 'unpublished'}`, 'success'); await loadAll()
  }

  async function updateStatus(b: BrandRow, s: 'active'|'inactive'|'suspended') {
    const { error } = await supabase.from('brands').update({ status: s }).eq('id', b.id)
    if (error) { showToast(`Update failed: ${error.message}`, 'error'); return }
    showToast(`Brand status: ${s}`, 'success'); await loadAll()
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold text-brand-accent">Brand Management</h1><p className="text-sm text-brand-muted">Manage brand presentation, publishing, and status</p></div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="btn btn-primary">+ New Brand</button>
      </div>
      <div className="space-y-4">
        {brands.map(b => (
          <div key={b.id} className="card"><div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{b.display_name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${b.status==='active'?'bg-green-100 text-green-800':b.status==='suspended'?'bg-red-100 text-red-800':'bg-gray-100'}`}>{b.status}</span>
                {b.is_published ? <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">Published</span> : <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">Unpublished</span>}
                {b.is_default && <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">Default</span>}
              </div>
              <p className="text-sm text-brand-muted mt-1"><strong>Tenant:</strong> {b.tenant_id} · <strong>Slug:</strong> {b.slug}</p>
              {b.tagline && <p className="text-sm text-brand-muted italic mt-1">{b.tagline}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(b)} className="btn btn-outline">Edit</button>
              <button onClick={() => togglePublish(b)} className="btn btn-outline">Pub</button>
              <select value={b.status} onChange={e => updateStatus(b, e.target.value as any)} className="input text-sm" style={{width:'auto'}}>
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option>
              </select>
            </div>
          </div></div>
        ))}
        {brands.length === 0 && <div className="text-center py-16 text-brand-muted">No brands found.</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={resetForm}>
          <div className="card max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editingId ? 'Edit Brand' : 'New Brand'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><label className="block text-sm font-medium mb-1">Name *</label><input type="text" value={formName} onChange={e=>setFormName(e.target.value)} className="input w-full" required /></div>
              <div><label className="block text-sm font-medium mb-1">Display Name</label><input type="text" value={formDisplayName} onChange={e=>setFormDisplayName(e.target.value)} className="input w-full" /></div>
              <div><label className="block text-sm font-medium mb-1">Tagline</label><input type="text" value={formTagline} onChange={e=>setFormTagline(e.target.value)} className="input w-full" /></div>
              <div><label className="block text-sm font-medium mb-1">Logo URL Icon</label><input type="url" value={formLogoUrlIcon} onChange={e=>setFormLogoUrlIcon(e.target.value)} className="input w-full" placeholder="https://..." /></div>
              <div><label className="block text-sm font-medium mb-1">Tenant *</label>
                <select value={formTenantId} onChange={e=>setFormTenantId(e.target.value)} className="input w-full">
                  {tenants.map(t=><option key={t.id} value={t.id}>{t.name} ({t.id})</option>)}
                </select>
              </div>
              <div className="flex gap-4"><label><input type="checkbox" checked={formDataIsDefault} onChange={e=>setFormDataIsDefault(e.target.checked)}/> Default brand</label><label><input type="checkbox" checked={formDataIsPublished} onChange={e=>setFormDataIsPublished(e.target.checked)}/> Published</label></div>
              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={resetForm} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
