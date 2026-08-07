'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface CartItem {
  lineId: string
  productId: string
  productName: string
  sizeId: string
  sizeLabel: string
  templateId?: string | null
  templateName?: string | null
  designId?: string | null
  customizationRef?: string | null
  artworkId?: string | null
  designSource?: 'online_editor' | 'customer_upload' | 'design_assistance'
  quantity: number
  price: number
  image?: string
  specifications?: Record<string, string>
}
interface CartContextType { items: CartItem[]; total: number; ready: boolean; addItem: (item: Omit<CartItem, 'lineId'>) => void; removeItem: (lineId: string) => void; updateQuantity: (lineId: string, quantity: number) => void; clearCart: () => void }
const CartContext = createContext<CartContextType | undefined>(undefined)
const storageKey = 'ali-baba-signs-cart-v2'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)
  useEffect(() => { const timer = window.setTimeout(() => { try { const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(parsed)) setItems(parsed.filter((item) => item?.productId && item?.sizeId && item?.lineId)) } catch { localStorage.removeItem(storageKey) } finally { setReady(true) } }, 0); return () => window.clearTimeout(timer) }, [])
  useEffect(() => { if (ready) localStorage.setItem(storageKey, JSON.stringify(items)) }, [items, ready])
  const addItem = useCallback((item: Omit<CartItem, 'lineId'>) => { const lineId = `${item.productId}:${item.sizeId}:${item.templateId || 'none'}:${item.customizationRef || item.designId || item.artworkId || 'standard'}`; setItems((current) => { const existing = current.find((line) => line.lineId === lineId); return existing ? current.map((line) => line.lineId === lineId ? { ...line, quantity: Math.min(1000, line.quantity + item.quantity) } : line) : [...current, { ...item, lineId }] }) }, [])
  const removeItem = useCallback((lineId: string) => setItems((current) => current.filter((item) => item.lineId !== lineId)), [])
  const updateQuantity = useCallback((lineId: string, quantity: number) => { if (quantity <= 0) removeItem(lineId); else setItems((current) => current.map((item) => item.lineId === lineId ? { ...item, quantity: Math.min(1000, Math.max(1, quantity)) } : item)) }, [removeItem])
  const clearCart = useCallback(() => setItems([]), [])
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items])
  return <CartContext.Provider value={{ items, total, ready, addItem, removeItem, updateQuantity, clearCart }}>{children}</CartContext.Provider>
}
export function useCart() { const value = useContext(CartContext); if (!value) throw new Error('useCart must be used within CartProvider'); return value }
