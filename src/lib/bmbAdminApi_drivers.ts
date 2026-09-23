// ============================================
// Bite Me Baby Admin API — Driver & Delivery Management
// ============================================

import { supabase } from './supabase'

export interface DriverRow {
  id: string
  driver_name: string
  phone_number: string
  status: string
  max_capacity: number
  current_latitude: number | null
  current_longitude: number | null
  active_assignments: number
  last_active: string | null
}

export async function listDrivers(): Promise<{ ok: boolean; drivers: DriverRow[] }> {
  const { data, error } = await supabase.rpc('list_drivers')
  if (error) { console.error('[Drivers] list failed:', error); return { ok: false, drivers: [] } }
  return data as { ok: boolean; drivers: DriverRow[] }
}

export async function upsertDriver(driverName: string, phoneNumber: string): Promise<boolean> {
  const { error } = await supabase.rpc('upsert_driver', { p_name: driverName, p_phone: phoneNumber })
  if (error) { console.error('[Drivers] upsert failed:', error); return false }
  return true
}

export async function setDriverStatus(phoneNumber: string, status: 'available' | 'on_delivery' | 'off_duty'): Promise<boolean> {
  // Update directly via Supabase (RLS allows authenticated/admin to update)
  const { error } = await supabase.from('drivers').update({ status }).eq('phone_number', phoneNumber)
  if (error) { console.error('[Drivers] setStatus failed:', error); return false }
  return true
}

export async function assignOrderToDriver(orderNumber: string, driverPhone: string): Promise<any> {
  const { data, error } = await supabase.rpc('assign_driver', { p_order_number: orderNumber, p_driver_phone: driverPhone })
  if (error) { console.error('[Drivers] assign failed:', error); return null }
  return data
}

