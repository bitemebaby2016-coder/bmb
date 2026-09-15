// ============================================
// Bite Me Baby Admin API - Inventory
// ============================================

import { storageGet, storageSet, generateId } from './bmbStorage'
import type { Ingredient, IngredientUnit } from '@/types'

export interface InventoryForm {
  id?: string
  name: string
  category: string
  unit: IngredientUnit
  current_stock: number
  min_stock: number
  max_stock: number
  unit_price: number
  supplier_name: string
  supplier_phone: string
}

export function getInventory(): Ingredient[] {
  return storageGet<Ingredient[]>('bmb_inventory', [
    { id: 'ing-1', name: 'ข้าว', category: 'carb', unit: 'kg', current_stock: 10, min_stock: 5, max_stock: 20, unit_price: 45, supplier_name: 'ร้านข้าวจันทบุรี', supplier_phone: '0812345678', status: 'in_stock', last_restocked_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'ing-2', name: 'ไก่', category: 'protein', unit: 'kg', current_stock: 5, min_stock: 3, max_stock: 15, unit_price: 85, supplier_name: 'ฟาร์มไก่จันทบุรี', supplier_phone: '0812345679', status: 'in_stock', last_restocked_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'ing-3', name: 'ไข่ไก่', category: 'protein', unit: 'piece', current_stock: 2, min_stock: 10, max_stock: 50, unit_price: 3, supplier_name: 'ฟาร์มไข่จันทบุรี', supplier_phone: '0812345680', status: 'low_stock', last_restocked_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'ing-4', name: 'น้ำมัน', category: 'sauce', unit: 'liter', current_stock: 3, min_stock: 2, max_stock: 10, unit_price: 40, supplier_name: 'ร้านน้ำมันจันทบุรี', supplier_phone: '0812345681', status: 'in_stock', last_restocked_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ])
}

export function getInventoryByName(name: string): Ingredient | undefined {
  return getInventory().find(i => i.name === name)
}

export function createInventory(data: InventoryForm): Ingredient {
  const inventory = getInventory()
  const item: Ingredient = {
    id: data.id || generateId('ing'),
    name: data.name,
    category: data.category,
    unit: data.unit,
    current_stock: data.current_stock,
    min_stock: data.min_stock,
    max_stock: data.max_stock,
    unit_price: data.unit_price,
    supplier_name: data.supplier_name,
    supplier_phone: data.supplier_phone,
    status: data.current_stock <= 0 ? 'out_of_stock' : data.current_stock <= data.min_stock ? 'low_stock' : 'in_stock',
    last_restocked_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  inventory.push(item)
  storageSet('bmb_inventory', inventory)
  return item
}

export function updateInventoryStock(id: string, quantity: number, reason: string): Ingredient | null {
  const inventory = getInventory()
  const index = inventory.findIndex(i => i.id === id)
  if (index === -1) return null
  
  inventory[index].current_stock = Math.max(0, inventory[index].current_stock + quantity)
  inventory[index].status = inventory[index].current_stock <= 0 ? 'out_of_stock' : inventory[index].current_stock <= inventory[index].min_stock ? 'low_stock' : 'in_stock'
  inventory[index].last_restocked_at = new Date().toISOString()
  inventory[index].updated_at = new Date().toISOString()
  storageSet('bmb_inventory', inventory)
  return inventory[index]
}

export function deleteInventory(id: string): boolean {
  const inventory = getInventory()
  const filtered = inventory.filter(i => i.id !== id)
  if (filtered.length === inventory.length) return false
  storageSet('bmb_inventory', filtered)
  return true
}

export function getLowStockAlerts(): Ingredient[] {
  return getInventory().filter(i => i.status === 'low_stock' || i.status === 'out_of_stock')
}