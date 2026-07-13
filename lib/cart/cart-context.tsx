"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

export type CartItem = {
  productId: string
  unitId: string | null      // null untuk produk single-unit
  unitName: string | null    // nama kemasan, e.g. "Pack", "Dus"
  multiplier: number         // berapa pcs per unit, e.g. Pack = 10 pcs
  name: string
  price: number              // harga per unit kemasan
  imageUrl: string | null
  stockQty: number           // stok dalam satuan unit kemasan
  quantity: number
}

// Unique key per kombinasi produk+unit agar bisa add 2 kemasan berbeda dari produk sama
export function cartItemKey(productId: string, unitId: string | null) {
  return unitId ? `${productId}::${unitId}` : productId
}

type CartContextValue = {
  items: CartItem[]
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => void
  removeItem: (productId: string, unitId?: string | null) => void
  updateQuantity: (productId: string, qty: number, unitId?: string | null) => void
  clearCart: () => void
  totalItems: number
  totalPrice: number
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

const STORAGE_KEY = "pos_grosir_customer_cart_v2"

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {
      // ignore corrupted cart storage
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, hydrated])

  const addItem = useCallback((item: Omit<CartItem, "quantity">, qty: number = 1) => {
    const key = cartItemKey(item.productId, item.unitId)
    setItems((prev) => {
      const existing = prev.find(
        (i) => cartItemKey(i.productId, i.unitId) === key
      )
      if (existing) {
        return prev.map((i) =>
          cartItemKey(i.productId, i.unitId) === key
            ? { ...i, quantity: Math.min(i.quantity + qty, item.stockQty || i.quantity + qty) }
            : i
        )
      }
      return [...prev, { ...item, quantity: qty }]
    })
  }, [])

  const removeItem = useCallback((productId: string, unitId: string | null = null) => {
    const key = cartItemKey(productId, unitId)
    setItems((prev) => prev.filter((i) => cartItemKey(i.productId, i.unitId) !== key))
  }, [])

  const updateQuantity = useCallback((productId: string, qty: number, unitId: string | null = null) => {
    const key = cartItemKey(productId, unitId)
    setItems((prev) => {
      if (qty <= 0) return prev.filter((i) => cartItemKey(i.productId, i.unitId) !== key)
      return prev.map((i) =>
        cartItemKey(i.productId, i.unitId) === key ? { ...i, quantity: qty } : i
      )
    })
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const totalPrice = items.reduce((sum, i) => sum + i.quantity * i.price, 0)

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within a CartProvider")
  return ctx
}
