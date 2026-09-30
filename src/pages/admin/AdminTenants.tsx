// ============================================
// Bite Me Baby â€” Admin Tenants Management (TEN-06)
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { listTenants, createTenant, updateTenant, setTenantStatus, setDefaultBrand } from '@/lib/adminTenantApi'
import type { TenantItem } from '@/lib/adminTenantContext'
import { useAdminTenantContextStore } from '@/lib/adminTenantContext'
import { showToast } from '@/components/ui/ToastContainer'

interface TenantRow {
  id: string; name: string; slug: string; status: 'active'|'inactive'|'suspended'
}

export function AdminTenants() {
  const [tenants,setTenants] = useState<TenantRow[]>([])
  const [loading,setLoading] = useState(true)
  const [showForm,setShowForm] = useState(false)
  const [editingId,setEditingId] = useState<string|null>(null)
  const [formName,setFormName] = useState('')
  const [formSlug,setFormSlug] = useState('')
  const [formStatus,setFormStatus] = useState<'active'|'inactive'|'suspended'>('active')
  // Default brand management
  const [brands,setBrands] = useState<{id:string;name:string}[]>([])
  const [defaultBrandId,setDefaultBrandId] = useState<string>('')
  const {isAdminScopePlatform,setActiveTenant,activeTenantId} = useAdminTenantContextStore()

  async function loadAll(): Promise<void> {
    try { setLoading(true); setTenants(await listTenants()) }
    catch(e){ console.error('[AdminTenants]',e) } finally{ setLoading(false) }
  }

   
  async function handleSubmit(e: React.FormEvent<any>): Promise<void> {
    e.preventDefault()
    const n: string = formName || ''
    const s: string = formSlug || ''
    if (!n || !s) return
    try {
      if (editingId != null) {
        const r = await updateTenant(editingId, {name:n||undefined,slug:s||undefined,status:(formStatus==='active'?undefined:formStatus)})
        if(r.ok){ showToast('Tenant updated','success'); resetForm(); await loadAll() }
        else { showToast(String(r.error||'Update failed'),'error') }
      } else {
        const r = await createTenant(n, s)
        if(r.ok && r.tenant != null){
          setActiveTenant(r.tenant.id)
          showToast('Created '+String(r.tenant.name),'success')
          resetForm(); await loadAll()
        } else { showToast(String(r.error||'Create failed'),'error') }
      }
    } catch(e: any) { showToast((typeof e === 'object' && e && 'message' in e) ? String(e.message) : 'Failed','error') }
  }

  async function handleToggle(t: TenantRow): Promise<void> {
    const ns: 'active'|'inactive' = t.status==='active'?'inactive':'active'
    const r = await setTenantStatus(t.id, ns)
    if(r.ok){ showToast(ns,'success'); await loadAll() }
    else { showToast(String(r.error||'Status change failed'),'error') }
  }

  function startEdit(t: TenantRow): void { setEditingId(t.id); setFormName(t.name); setFormSlug(t.slug); setFormStatus(t.status); setShowForm(true) }
  function resetForm(): void { setShowForm(false); setEditingId(null); setFormName(''); setFormSlug(''); setFormStatus('active') }
  
  async function selectFor(id: string): Promise<void> { setActiveTenant(id); showToast('Switched to tenant context','success'); await loadBrands(id) }
  
  async function loadBrands(tid: string): Promise<void> {
    try {
      const brandsRes = await supabase.from('brands').select('id,name,display_name,is_default,is_published,status').eq('tenant_id', tid).eq('is_published', true).eq('status', 'active')
      if (!brandsRes.error && brandsRes.data) setBrands(brandsRes.data as any)
      const tenantsRes = await supabase.from('tenants').select('default_brand_id').eq('id', tid).single()
      if (tenantsRes.data) setDefaultBrandId((tenantsRes.data as any).default_brand_id || '')
    } catch(e) { console.error('[loadBrands]', e) }
  }

  async function handleSetDefault(brandId: string): Promise<void> {
    if (!activeTenantId) return
    const r = await setDefaultBrand(activeTenantId, brandId)
    if(r.ok){ showToast('Default brand updated','success'); await loadBrands(activeTenantId) }
    else showToast(String(r.error||'Failed'),'error')
  }


  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6"><h1 className="text-xl font-bold text-brand-text">Tenant Management</h1><button onClick={()=>setShowForm(true)} className="btn btn-primary" disabled={!isAdminScopePlatform}>+ Create Tenant</button></div>
      {activeTenantId && <div className="mb-4 p-3 rounded-lg bg-brand-primary/5 border border-brand-primary/20"><span className="text-xs font-semibold text-brand-primary">Active Context:</span>{' '}<span className="text-sm">{tenants.find(x=>x.id===activeTenantId)?.name || activeTenantId}</span></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenants.map(t=>(
          <div key={t.id} className={'card p-4 '+((t.id===activeTenantId?'border-2 border-brand-primary':''))}>
            <div className="flex items-start justify-between mb-2">
              <div><h3 className="font-bold">{t.name}</h3><p className="text-sm text-brand-muted">{t.slug}</p></div>
              <span className={'px-2 py-0.5 rounded-full text-xs '+(t.status==='active'?'bg-green-100 text-green-700':t.status==='inactive'?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700')}>{t.status}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={()=>selectFor(t.id)} className="btn btn-outline btn-sm">Select</button>
              {isAdminScopePlatform && <><button onClick={()=>startEdit(t)} className="btn btn-outline btn-sm">Edit</button><button onClick={()=>handleToggle(t)} className={'btn btn-sm '+(t.status==='active'?'btn-warning':'btn-success')}>{t.status==='active'?'Deactivate':'Activate'}</button></>}
            </div>
          </div>
        ))}
        {tenants.length===0&&!loading&&<div className="col-span-full text-center py-16 text-brand-muted">No tenants found.</div>}
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={resetForm}>
          <div className="card max-w-md w-full" onClick={e=>e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editingId?'Edit Tenant':'New Tenant'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><label className="block text-sm font-medium mb-1">Name *</label><input type="text" value={formName} onChange={e=>setFormName(e.target.value)} className="input w-full" required /></div>
              <div><label className="block text-sm font-medium mb-1">Slug *</label><input type="text" value={formSlug} onChange={e=>setFormSlug(e.target.value)} className="input w-full" required /></div>
              {editingId!=null && <div><label className="block text-sm font-medium mb-1">Status</label><select value={formStatus} onChange={e=>setFormStatus(e.target.value as 'active'|'inactive'|'suspended')} className="input w-full"><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></div>}
              <div className="flex gap-2 justify-end pt-4"><button type="button" onClick={resetForm} className="btn btn-outline">Cancel</button><button type="submit" className="btn btn-primary">{editingId?'Update':'Create'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

