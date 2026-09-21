// ============================================
// Bite Me Baby — Mascot self-service (ADM-07, migration 021)
// Admin swaps mascot art per role name (greeting/cooking/delivering/empty_cart…)
// via mascot_overrides — storefront renders the override without any code change.
// ============================================

import { supabase } from './supabase'

export interface MascotOverride {
  role_name: string
  media_url: string
  alt: string
  updated_at: string
}

/** Public read (anon SELECT allowed) — storefront mascot resolution. */
export async function getMascotOverrides(): Promise<MascotOverride[]> {
  const { data, error } = await supabase.from('mascot_overrides').select('role_name,media_url,alt,updated_at')
  if (error) return []
  return (data ?? []) as MascotOverride[]
}

/** Resolve the override URL for a role (returns '' when no override set). */
export function resolveOverride(overrides: MascotOverride[], roleName: string): MascotOverride | undefined {
  return overrides.find((o) => o.role_name === roleName && o.media_url?.length > 0)
}

/** Admin upsert (guard inside RPC). */
export async function upsertMascotOverride(roleName: string, mediaUrl: string, alt = ''): Promise<boolean> {
  const { error } = await supabase.rpc('upsert_mascot_override', {
    p_role_name: roleName,
    p_media_url: mediaUrl,
    p_alt: alt,
  })
  return !error
}

/** Roles the mascot badge can render (23 poses + 14 3D set). */
export const MASCOT_ROLES = [
  'greeting',
  'cooking',
  'delivering',
  'empty_cart',
  'checkout',
  'thanks',
  'pointing',
  'thumbsup',
] as const