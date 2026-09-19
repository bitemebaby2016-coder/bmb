// ============================================
// Bite Me Baby Admin API — Media Library (D6 gap, Phase D)
// Phase D: uploads go to Storage bucket `bmb-images`, metadata rows to `media_assets`.
// Requires migration 011 storage policies + media_assets RLS (owner-applied) to work live.
// ============================================

import { supabase } from './supabase'

export interface MediaAssetRow {
  id: string
  url: string
  alt: string
  kind: 'image' | 'video' | 'logo' | 'hero' | 'mascot'
  created_by?: string | null
  created_at?: string
}

export const MEDIA_BUCKET = 'bmb-images'

export const MEDIA_KINDS: MediaAssetRow['kind'][] = ['image', 'video', 'logo', 'hero', 'mascot']

export async function listMediaAssets(): Promise<MediaAssetRow[]> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('[listMediaAssets] Error:', error); return [] }
  return (data || []) as MediaAssetRow[]
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
}

export async function uploadMediaAsset(
  file: File,
  kind: MediaAssetRow['kind'],
  alt = '',
): Promise<MediaAssetRow | null> {
  const path = `uploads/${Date.now()}-${sanitizeName(file.name)}`
  const { data: up, error: upErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (upErr || !up) { console.error('[uploadMediaAsset] storage error:', upErr); return null }

  const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  const { data: user } = await supabase.auth.getUser()
  const id = `media-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const row: MediaAssetRow = { id, url: urlData.publicUrl, alt, kind, created_by: user?.user?.id }

  const { data, error } = await supabase.from('media_assets').insert(row).select().single()
  if (error) {
    console.error('[uploadMediaAsset] row insert error:', error)
    await supabase.storage.from(MEDIA_BUCKET).remove([path]) // rollback the stored file
    return null
  }
  return data as MediaAssetRow
}

export async function deleteMediaAsset(asset: MediaAssetRow): Promise<boolean> {
  let ok = true
  const path = extractPath(asset.url)
  if (path) {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path])
    if (error) ok = false
  }
  const { error: rowErr } = await supabase.from('media_assets').delete().eq('id', asset.id)
  if (rowErr) ok = false
  return ok
}

function extractPath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`
  const i = publicUrl.indexOf(marker)
  return i >= 0 ? decodeURIComponent(publicUrl.slice(i + marker.length)) : null
}