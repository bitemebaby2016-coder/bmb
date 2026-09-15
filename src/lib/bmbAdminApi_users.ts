// ============================================
// Bite Me Baby Admin API - Users & Dashboard
// ============================================

import { storageGet, storageSet, generateId, hashPassword, verifyPassword } from './bmbStorage'
import { getOrders } from './bmbAdminApi_orders'
import { getInventory } from './bmbAdminApi_inventory'
import type { Ingredient } from '@/types'

export interface User {
  id: string
  email: string
  phone: string
  name: string
  password_hash: string
  role: 'customer' | 'admin'
  is_active: boolean
  created_at: string
}

export function getUsers(): User[] {
  return storageGet<User[]>('bmb_users', [])
}

export function getUserByEmail(email: string): User | undefined {
  return getUsers().find(u => u.email === email)
}

export function getUserByPhone(phone: string): User | undefined {
  return getUsers().find(u => u.phone === phone)
}

export function getUserById(id: string): User | undefined {
  return getUsers().find(u => u.id === id)
}

export function createUser(data: {
  email: string
  phone: string
  name: string
  password: string
  role?: 'customer' | 'admin'
}): User | null {
  const users = getUsers()
  
  if (users.find(u => u.email === data.email)) return null
  if (users.find(u => u.phone === data.phone)) return null
  
  const user: User = {
    id: generateId('user'),
    email: data.email,
    phone: data.phone,
    name: data.name,
    password_hash: hashPassword(data.password),
    role: data.role || 'customer',
    is_active: true,
    created_at: new Date().toISOString()
  }
  users.push(user)
  storageSet('bmb_users', users)
  return user
}

export function authenticateUser(email: string, password: string): User | null {
  const user = getUserByEmail(email)
  if (!user) return null
  if (!verifyPassword(password, user.password_hash)) return null
  return user
}

export function authenticateUserByPhone(phone: string, password: string): User | null {
  const user = getUserByPhone(phone)
  if (!user) return null
  if (!verifyPassword(password, user.password_hash)) return null
  return user
}

export function updateUser(id: string, data: Partial<User>): User | null {
  const users = getUsers()
  const index = users.findIndex(u => u.id === id)
  if (index === -1) return null
  users[index] = { ...users[index], ...data }
  storageSet('bmb_users', users)
  return users[index]
}

export function initializeAdmin(): void {
  const users = getUsers()
  if (!users.find(u => u.email === 'admin@bmb.co.th')) {
    users.push({
      id: 'admin-001',
      email: 'admin@bmb.co.th',
      phone: '0812345678',
      name: 'Admin Bite Me Baby',
      password_hash: hashPassword('admin123'),
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString()
    })
    storageSet('bmb_users', users)
  }
}

initializeAdmin()

export interface DashboardStats {
  todayOrders: number
  todayRevenue: number
  pendingOrders: number
  completionRate: number
  lowStockItems: number
  totalOrders: number
  totalRevenue: number
  totalCustomers: number
}

export function getDashboardStats(): DashboardStats {
  const orders = getOrders()
  const inventory = getInventory()
  const users = getUsers()
  
  const today = new Date().toISOString().slice(0, 10)
  const todayOrders = orders.filter((o: any) => o.created_at.startsWith(today))
  const todayRevenue = todayOrders.reduce((sum: number, o: any) => sum + o.total_amount, 0)
  const pendingOrders = todayOrders.filter((o: any) => o.status === 'pending' || o.status === 'confirmed').length
  const deliveredOrders = todayOrders.filter((o: any) => o.status === 'delivered').length
  const completionRate = todayOrders.length > 0 ? Math.round((deliveredOrders / todayOrders.length) * 100) : 0
  const lowStockItems = inventory.filter((i: Ingredient) => i.status === 'low_stock' || i.status === 'out_of_stock').length
  
  return {
    todayOrders: todayOrders.length,
    todayRevenue,
    pendingOrders,
    completionRate,
    lowStockItems,
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum: number, o: any) => sum + o.total_amount, 0),
    totalCustomers: users.filter((u: User) => u.role === 'customer').length
  }
}